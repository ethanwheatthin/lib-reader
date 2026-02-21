import { adapter, librarySourcesFeature } from './library-sources.reducer';
import { createSelector } from '@ngrx/store';

export const {
  selectLibrarySourcesState,
  selectIds,
  selectEntities,
  selectLoading: selectLibrarySourcesLoading,
  selectError: selectLibrarySourcesError,
  selectScanningSourceId,
} = librarySourcesFeature;

const { selectAll, selectTotal } = adapter.getSelectors(selectLibrarySourcesState);

export const selectAllLibrarySources = selectAll;
export const selectLibrarySourcesTotal = selectTotal;

export const selectLibrarySourceById = (id: string) =>
  createSelector(selectEntities, (entities) => entities[id]);
