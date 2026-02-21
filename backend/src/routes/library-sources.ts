import { Router, Request, Response, NextFunction } from 'express';
import fs from 'fs';
import path from 'path';
import { AppDataSource } from '../data-source';
import {
  LibrarySourceEntity,
  LibrarySourcePathEntity,
  DocumentEntity,
  DocumentFileEntity,
  ReadingStatsEntity,
} from '../entities';
import logger from '../logger';

const router = Router();

// Helper repos
function getSourceRepo() {
  return AppDataSource.getRepository(LibrarySourceEntity);
}
function getPathRepo() {
  return AppDataSource.getRepository(LibrarySourcePathEntity);
}

// ===== DTO mapper =====
function toSourceDTO(entity: LibrarySourceEntity) {
  const paths = (entity.paths ?? []).map((p) => ({
    id: p.id,
    path: p.path,
    lastScannedAt: p.lastScannedAt?.toISOString() ?? undefined,
    fileCount: p.fileCount,
  }));

  const totalFilesFound = paths.reduce((sum, p) => sum + p.fileCount, 0);

  return {
    id: entity.id,
    name: entity.name,
    paths,
    pollingEnabled: entity.pollingEnabled,
    pollingIntervalSeconds: entity.pollingIntervalSeconds,
    createdAt: entity.createdAt.toISOString(),
    lastScannedAt: entity.lastScannedAt?.toISOString() ?? undefined,
    totalFilesFound,
    scanning: false,
  };
}

// ===== CRUD =====

/** GET /api/library-sources — list all sources */
router.get('/', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const sources = await getSourceRepo().find({
      relations: ['paths'],
      order: { createdAt: 'DESC' },
    });
    res.json(sources.map(toSourceDTO));
  } catch (err) {
    next(err);
  }
});

/** GET /api/library-sources/:id — single source */
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const source = await getSourceRepo().findOne({
      where: { id: req.params.id },
      relations: ['paths'],
    });
    if (!source) return res.status(404).json({ error: { message: 'Library source not found' } });
    res.json(toSourceDTO(source));
  } catch (err) {
    next(err);
  }
});

/** POST /api/library-sources — create a new library source */
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, paths, pollingEnabled, pollingIntervalSeconds } = req.body;
    if (!name || !paths || !Array.isArray(paths) || paths.length === 0) {
      return res
        .status(400)
        .json({ error: { message: 'name and paths (string[]) are required' } });
    }

    const sourceRepo = getSourceRepo();
    const source = sourceRepo.create({
      name,
      pollingEnabled: pollingEnabled ?? true,
      pollingIntervalSeconds: pollingIntervalSeconds ?? 300,
      paths: paths.map((p: string) => {
        const pe = new LibrarySourcePathEntity();
        pe.path = p;
        pe.fileCount = 0;
        return pe;
      }),
    });

    const saved = await sourceRepo.save(source);
    const reloaded = await sourceRepo.findOne({
      where: { id: saved.id },
      relations: ['paths'],
    });
    res.status(201).json(toSourceDTO(reloaded!));
  } catch (err) {
    next(err);
  }
});

/** PUT /api/library-sources/:id — update name, polling settings, or paths */
router.put('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const sourceRepo = getSourceRepo();
    const source = await sourceRepo.findOne({
      where: { id: req.params.id },
      relations: ['paths'],
    });
    if (!source) return res.status(404).json({ error: { message: 'Library source not found' } });

    const { name, pollingEnabled, pollingIntervalSeconds, paths } = req.body;
    if (name !== undefined) source.name = name;
    if (pollingEnabled !== undefined) source.pollingEnabled = pollingEnabled;
    if (pollingIntervalSeconds !== undefined) source.pollingIntervalSeconds = pollingIntervalSeconds;

    // If paths array is provided, reconcile: add new, remove missing
    if (paths && Array.isArray(paths)) {
      const pathRepo = getPathRepo();
      const existingPaths = source.paths.map((p) => p.path);
      const newPaths = paths as string[];

      // Remove paths no longer listed
      const toRemove = source.paths.filter((p) => !newPaths.includes(p.path));
      if (toRemove.length > 0) {
        await pathRepo.remove(toRemove);
      }

      // Add paths not yet tracked
      const toAdd = newPaths.filter((p) => !existingPaths.includes(p));
      for (const p of toAdd) {
        const pe = pathRepo.create({ path: p, fileCount: 0, librarySourceId: source.id });
        await pathRepo.save(pe);
      }
    }

    await sourceRepo.save(source);

    const reloaded = await sourceRepo.findOne({
      where: { id: source.id },
      relations: ['paths'],
    });
    res.json(toSourceDTO(reloaded!));
  } catch (err) {
    next(err);
  }
});

/** DELETE /api/library-sources/:id */
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const sourceRepo = getSourceRepo();
    const source = await sourceRepo.findOne({ where: { id: req.params.id } });
    if (!source) return res.status(404).json({ error: { message: 'Library source not found' } });
    await sourceRepo.remove(source);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

// ===== SCANNING =====

const ALLOWED_EXTS = new Set(['.epub', '.pdf']);

/** Recursively walk a directory and return matching file paths */
function walkDir(dir: string): string[] {
  const results: string[] = [];
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        results.push(...walkDir(fullPath));
      } else if (entry.isFile() && ALLOWED_EXTS.has(path.extname(entry.name).toLowerCase())) {
        results.push(fullPath);
      }
    }
  } catch (err: any) {
    logger.warn(`Cannot read directory ${dir}: ${err.message}`);
  }
  return results;
}

/** POST /api/library-sources/:id/scan — scan all paths and import new files */
router.post('/:id/scan', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const sourceRepo = getSourceRepo();
    const source = await sourceRepo.findOne({
      where: { id: req.params.id },
      relations: ['paths'],
    });
    if (!source) return res.status(404).json({ error: { message: 'Library source not found' } });

    const docRepo = AppDataSource.getRepository(DocumentEntity);
    const fileRepo = AppDataSource.getRepository(DocumentFileEntity);
    const statsRepo = AppDataSource.getRepository(ReadingStatsEntity);
    const pathRepo = getPathRepo();

    // Collect all known file paths already in the library
    const existingFiles = await fileRepo.find({ select: ['filePath'] });
    const existingFilePaths = new Set(
      existingFiles.filter((f) => f.filePath).map((f) => path.resolve(f.filePath!))
    );

    const importedDocs: any[] = [];

    for (const sourcePath of source.paths) {
      if (!fs.existsSync(sourcePath.path)) {
        logger.warn(`Library source path does not exist: ${sourcePath.path}`);
        sourcePath.fileCount = 0;
        sourcePath.lastScannedAt = new Date();
        await pathRepo.save(sourcePath);
        continue;
      }

      const files = walkDir(sourcePath.path);
      sourcePath.fileCount = files.length;
      sourcePath.lastScannedAt = new Date();
      await pathRepo.save(sourcePath);

      for (const filePath of files) {
        const resolved = path.resolve(filePath);
        if (existingFilePaths.has(resolved)) continue; // skip already-imported

        const ext = path.extname(filePath).toLowerCase();
        const type: 'epub' | 'pdf' = ext === '.epub' ? 'epub' : 'pdf';
        const title = path.basename(filePath, ext);
        const stat = fs.statSync(filePath);

        // Create document
        const doc = docRepo.create({ title, type, fileSize: stat.size });
        const savedDoc = await docRepo.save(doc);

        // Create stats
        const stats = statsRepo.create({ documentId: savedDoc.id });
        await statsRepo.save(stats);

        // Create file reference (filesystem strategy — link to existing path)
        const mimeType = type === 'epub' ? 'application/epub+zip' : 'application/pdf';
        const fileEntity = fileRepo.create({
          documentId: savedDoc.id,
          filePath: resolved,
          mimeType,
        });
        await fileRepo.save(fileEntity);

        existingFilePaths.add(resolved); // prevent duplicate within same scan

        importedDocs.push({ id: savedDoc.id, title, type, filePath: resolved });
      }
    }

    source.lastScannedAt = new Date();
    await sourceRepo.save(source);

    logger.info(
      `Scan complete for source "${source.name}": ${importedDocs.length} new files imported`
    );

    const reloaded = await sourceRepo.findOne({
      where: { id: source.id },
      relations: ['paths'],
    });

    res.json({
      source: toSourceDTO(reloaded!),
      imported: importedDocs,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
