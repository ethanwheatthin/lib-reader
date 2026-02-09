import { createSelector } from '@ngrx/store';
import { shelvesFeature, adapter } from './shelves.reducer';

export const {
  selectShelvesState,
  selectSelectedShelfId,
  selectLoading,
  selectError
} = shelvesFeature;

// Get entity selectors bound to the feature state
const adapterSelectors = adapter.getSelectors(shelvesFeature.selectShelvesState);

export const selectAllShelves = adapterSelectors.selectAll;
export const selectShelfEntities = adapterSelectors.selectEntities;
export const selectShelfIds = adapterSelectors.selectIds;
export const selectShelvesTotal = adapterSelectors.selectTotal;

export const selectSelectedShelf = createSelector(
  selectShelfEntities,
  selectSelectedShelfId,
  (entities, selectedId) => (selectedId ? entities[selectedId] : null)
);

export const selectShelfById = (id: string) =>
  createSelector(
    selectShelfEntities,
    (entities) => entities[id]
  );

export const selectDocumentsByShelfId = (shelfId: string | null) =>
  createSelector(
    selectAllShelves,
    (shelves) => {
      const shelf = shelves.find(s => s.id === shelfId);
      return shelf?.documentIds || [];
    }
  );
