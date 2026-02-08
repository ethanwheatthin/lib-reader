import { Injectable, inject } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { Store } from '@ngrx/store';
import { map, mergeMap, catchError } from 'rxjs/operators';
import { of, from } from 'rxjs';
import { DocumentsActions } from './documents.actions';
import { IndexDBService } from '../../core/services/indexdb.service';
import { EpubService } from '../../core/services/epub.service';
import { PdfService } from '../../core/services/pdf.service';
import { Document } from '../../core/models/document.model';

@Injectable()
export class DocumentsEffects {
  private actions$ = inject(Actions);
  private indexDB = inject(IndexDBService);
  private epubService = inject(EpubService);
  private pdfService = inject(PdfService);
  private store = inject(Store);

  uploadDocument$ = createEffect(() =>
    this.actions$.pipe(
      ofType(DocumentsActions.uploadDocument),
      mergeMap(({ file }) =>
        from(this.processUpload(file)).pipe(
          map((document) => DocumentsActions.uploadDocumentSuccess({ document })),
          catchError((error) =>
            of(DocumentsActions.uploadDocumentFailure({ error: error.message }))
          )
        )
      )
    )
  );

  uploadDocumentSuccess$ = createEffect(() =>
    this.actions$.pipe(
      ofType(DocumentsActions.uploadDocumentSuccess),
      mergeMap(({ document }) =>
        from(this.indexDB.saveMetadata(document)).pipe(
          map(() => ({ type: 'NO_ACTION' as const }))
        )
      )
    ),
    { dispatch: false }
  );

  loadDocuments$ = createEffect(() =>
    this.actions$.pipe(
      ofType(DocumentsActions.loadDocuments),
      mergeMap(() => from(this.loadStoredDocuments()).pipe(
        map((documents) => DocumentsActions.loadDocumentsSuccess({ documents }))
      ))
    )
  );

  deleteDocument$ = createEffect(() =>
    this.actions$.pipe(
      ofType(DocumentsActions.deleteDocument),
      mergeMap(({ id }) =>
        from(this.indexDB.deleteFile(id)).pipe(
          map(() => DocumentsActions.deleteDocumentSuccess({ id }))
        )
      )
    )
  );

  updateReadingProgress$ = createEffect(() =>
    this.actions$.pipe(
      ofType(DocumentsActions.updateReadingProgress),
      mergeMap(({ id, page, cfi }) =>
        from(this.updateMetadata(id, { currentPage: page, ...(cfi ? { currentCfi: cfi } : {}) })).pipe(
          map(() => ({ type: 'NO_ACTION' as const }))
        )
      )
    ),
    { dispatch: false }
  );

  // --- Bookmark persistence ---

  addBookmark$ = createEffect(() =>
    this.actions$.pipe(
      ofType(DocumentsActions.addBookmark),
      mergeMap(({ id, bookmark }) =>
        from(this.persistBookmarks(id)).pipe(
          map(() => ({ type: 'NO_ACTION' as const }))
        )
      )
    ),
    { dispatch: false }
  );

  removeBookmark$ = createEffect(() =>
    this.actions$.pipe(
      ofType(DocumentsActions.removeBookmark),
      mergeMap(({ id }) =>
        from(this.persistBookmarks(id)).pipe(
          map(() => ({ type: 'NO_ACTION' as const }))
        )
      )
    ),
    { dispatch: false }
  );

  updateBookmark$ = createEffect(() =>
    this.actions$.pipe(
      ofType(DocumentsActions.updateBookmark),
      mergeMap(({ id }) =>
        from(this.persistBookmarks(id)).pipe(
          map(() => ({ type: 'NO_ACTION' as const }))
        )
      )
    ),
    { dispatch: false }
  );

  // --- Reading session persistence ---

  endReadingSession$ = createEffect(() =>
    this.actions$.pipe(
      ofType(DocumentsActions.endReadingSession),
      mergeMap(({ id }) =>
        from(this.persistReadingStats(id)).pipe(
          map(() => ({ type: 'NO_ACTION' as const }))
        )
      )
    ),
    { dispatch: false }
  );

  // --- Reading goal persistence ---

  setReadingGoal$ = createEffect(() =>
    this.actions$.pipe(
      ofType(DocumentsActions.setReadingGoal),
      mergeMap(({ id }) =>
        from(this.persistReadingGoal(id)).pipe(
          map(() => ({ type: 'NO_ACTION' as const }))
        )
      )
    ),
    { dispatch: false }
  );

  updateReadingStreak$ = createEffect(() =>
    this.actions$.pipe(
      ofType(DocumentsActions.updateReadingStreak),
      mergeMap(({ id }) =>
        from(this.persistReadingGoal(id)).pipe(
          map(() => ({ type: 'NO_ACTION' as const }))
        )
      )
    ),
    { dispatch: false }
  );

  private async processUpload(file: File): Promise<Document> {
    const id = crypto.randomUUID();
    const type = file.name.endsWith('.epub') ? 'epub' : 'pdf';
    
    let metadata: { title: string; totalPages?: number };
    
    if (type === 'epub') {
      metadata = await this.epubService.extractMetadata(file);
    } else {
      metadata = await this.pdfService.extractMetadata(file);
    }

    const document: Document = {
      id,
      title: metadata.title,
      type,
      fileSize: file.size,
      uploadDate: new Date(),
      totalPages: metadata.totalPages,
      bookmarks: [],
      readingStats: { totalReadingTime: 0, sessions: [] },
    };

    await this.indexDB.saveFile(id, file);
    
    return document;
  }

  private async loadStoredDocuments(): Promise<Document[]> {
    const docs = await this.indexDB.getAllMetadata();
    // Migrate older documents that lack new fields
    return docs.map((doc) => ({
      ...doc,
      bookmarks: doc.bookmarks ?? [],
      readingStats: doc.readingStats ?? { totalReadingTime: 0, sessions: [] },
    }));
  }

  private async updateMetadata(id: string, changes: Partial<Document>): Promise<void> {
    const document = await this.indexDB.getMetadata(id);
    if (document) {
      Object.assign(document, changes, { lastOpened: new Date() });
      await this.indexDB.saveMetadata(document);
    }
  }

  private async persistBookmarks(id: string): Promise<void> {
    // We need a small delay for the reducer to apply first
    const document = await this.indexDB.getMetadata(id);
    if (!document) return;
    // Re-read from store is tricky in effects, so we update via current metadata
    // The reducer has already updated the entity; we use selectSnapshot pattern
    await this.syncDocumentField(id, 'bookmarks');
  }

  private async persistReadingStats(id: string): Promise<void> {
    await this.syncDocumentField(id, 'readingStats');
  }

  private async persistReadingGoal(id: string): Promise<void> {
    await this.syncDocumentField(id, 'readingGoal');
  }

  /**
   * Read the current entity from the store and persist the given field to IndexedDB.
   */
  private syncDocumentField(id: string, field: keyof Document): Promise<void> {
    return new Promise((resolve) => {
      this.store.select((state: any) => state.documents.entities[id]).subscribe(async (entity: Document | undefined) => {
        if (entity) {
          const persisted = await this.indexDB.getMetadata(id);
          if (persisted) {
            (persisted as any)[field] = (entity as any)[field];
            await this.indexDB.saveMetadata(persisted);
          }
        }
        resolve();
      }).unsubscribe();
    });
  }
}
