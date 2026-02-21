import { Router, Request, Response, NextFunction } from 'express';
import fs from 'fs';
import path from 'path';
import os from 'os';
import logger from '../logger';

const router = Router();

interface DirEntry {
  name: string;
  path: string;
  isDirectory: boolean;
  /** Size in bytes (files only) */
  size?: number;
}

/** GET /api/filesystem/browse?dir=<path>
 *  Returns the contents of a directory on the server.
 *  Only directories are listed (plus epub/pdf files for preview counts).
 *  If no `dir` query param is provided, returns platform root(s).
 */
router.get('/browse', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const requestedDir = req.query.dir as string | undefined;

    // If no dir provided, return root / drives
    if (!requestedDir) {
      const roots = getRoots();
      return res.json({
        current: '',
        parent: null,
        entries: roots,
      });
    }

    const resolved = path.resolve(requestedDir);

    if (!fs.existsSync(resolved)) {
      return res.status(404).json({ error: { message: `Directory not found: ${resolved}` } });
    }

    const stat = fs.statSync(resolved);
    if (!stat.isDirectory()) {
      return res.status(400).json({ error: { message: 'Path is not a directory' } });
    }

    const entries: DirEntry[] = [];

    try {
      const dirents = fs.readdirSync(resolved, { withFileTypes: true });
      for (const dirent of dirents) {
        // Skip hidden files/folders (starting with .)
        if (dirent.name.startsWith('.')) continue;

        const fullPath = path.join(resolved, dirent.name);

        if (dirent.isDirectory()) {
          entries.push({
            name: dirent.name,
            path: fullPath,
            isDirectory: true,
          });
        } else if (dirent.isFile()) {
          const ext = path.extname(dirent.name).toLowerCase();
          if (ext === '.epub' || ext === '.pdf') {
            try {
              const fileStat = fs.statSync(fullPath);
              entries.push({
                name: dirent.name,
                path: fullPath,
                isDirectory: false,
                size: fileStat.size,
              });
            } catch {
              // skip unreadable files
            }
          }
        }
      }
    } catch (err: any) {
      // Permission denied on some sub-entries is OK, we just skip them
      logger.warn(`Could not fully read directory ${resolved}: ${err.message}`);
    }

    // Sort: directories first (alphabetical), then files (alphabetical)
    entries.sort((a, b) => {
      if (a.isDirectory && !b.isDirectory) return -1;
      if (!a.isDirectory && b.isDirectory) return 1;
      return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
    });

    const parentDir = path.dirname(resolved);

    res.json({
      current: resolved,
      parent: parentDir !== resolved ? parentDir : null,
      entries,
    });
  } catch (err) {
    next(err);
  }
});

/** Return filesystem roots (drive letters on Windows, '/' on Unix) */
function getRoots(): DirEntry[] {
  if (os.platform() === 'win32') {
    // List available drive letters
    const drives: DirEntry[] = [];
    for (let i = 65; i <= 90; i++) {
      const letter = String.fromCharCode(i);
      const drivePath = `${letter}:\\`;
      try {
        if (fs.existsSync(drivePath)) {
          drives.push({ name: drivePath, path: drivePath, isDirectory: true });
        }
      } catch {
        // not accessible
      }
    }
    return drives;
  }

  // Unix / macOS: return root plus common mount points
  const roots: DirEntry[] = [{ name: '/', path: '/', isDirectory: true }];
  const mountDirs = ['/home', '/mnt', '/media', '/Volumes'];
  for (const dir of mountDirs) {
    try {
      if (fs.existsSync(dir) && fs.statSync(dir).isDirectory()) {
        roots.push({ name: dir, path: dir, isDirectory: true });
      }
    } catch {
      // skip
    }
  }
  return roots;
}

export default router;
