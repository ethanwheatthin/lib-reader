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
      mergeMap(({ id, page }) =>
        from(this.updateMetadata(id, page)).pipe(
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
      totalPages: metadata.totalPages
    };

    await this.indexDB.saveFile(id, file);
    
    return document;
  }

  private async loadStoredDocuments(): Promise<Document[]> {
    return await this.indexDB.getAllMetadata();
  }

  private async updateMetadata(id: string, page: number): Promise<void> {
    const document = await this.indexDB.getMetadata(id);
    if (document) {
      document.currentPage = page;
      document.lastOpened = new Date();
      await this.indexDB.saveMetadata(document);
    }
  }
}
