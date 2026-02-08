import { createFeature, createReducer, on } from '@ngrx/store';
import { createEntityAdapter, EntityAdapter, EntityState } from '@ngrx/entity';
import { Document } from '../../core/models/document.model';
import { DocumentsActions } from './documents.actions';

export interface DocumentsState extends EntityState<Document> {
  selectedDocumentId: string | null;
  loading: boolean;
  error: string | null;
}

export const adapter: EntityAdapter<Document> = createEntityAdapter<Document>();

export const initialState: DocumentsState = adapter.getInitialState({
  selectedDocumentId: null,
  loading: false,
  error: null
});

export const documentsFeature = createFeature({
  name: 'documents',
  reducer: createReducer(
    initialState,
    on(DocumentsActions.uploadDocument, (state) => ({
      ...state,
      loading: true,
      error: null
    })),
    on(DocumentsActions.uploadDocumentSuccess, (state, { document }) =>
      adapter.addOne(document, { ...state, loading: false })
    ),
    on(DocumentsActions.uploadDocumentFailure, (state, { error }) => ({
      ...state,
      loading: false,
      error
    })),
    on(DocumentsActions.loadDocuments, (state) => ({
      ...state,
      loading: true
    })),
    on(DocumentsActions.loadDocumentsSuccess, (state, { documents }) =>
      adapter.setAll(documents, { ...state, loading: false })
    ),
    on(DocumentsActions.deleteDocumentSuccess, (state, { id }) =>
      adapter.removeOne(id, state)
    ),
    on(DocumentsActions.openDocument, (state, { id }) => ({
      ...state,
      selectedDocumentId: id
    })),
    on(DocumentsActions.updateReadingProgress, (state, { id, page }) =>
      adapter.updateOne(
        { id, changes: { currentPage: page, lastOpened: new Date() } },
        state
      )
    )
  )
});
