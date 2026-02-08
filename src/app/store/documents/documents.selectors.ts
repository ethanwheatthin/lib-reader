import { createSelector } from '@ngrx/store';
import { documentsFeature } from './documents.reducer';
import { adapter } from './documents.reducer';

const { selectDocumentsState } = documentsFeature;

export const { selectAll, selectEntities, selectIds } = adapter.getSelectors(selectDocumentsState);

export const selectAllDocuments = selectAll;
export const selectDocumentEntities = selectEntities;
export const selectSelectedDocumentId = createSelector(
  selectDocumentsState,
  (state) => state.selectedDocumentId
);
export const selectSelectedDocument = createSelector(
  selectDocumentEntities,
  selectSelectedDocumentId,
  (entities, id) => id ? entities[id] : null
);
export const selectLoading = createSelector(
  selectDocumentsState,
  (state) => state.loading
);
