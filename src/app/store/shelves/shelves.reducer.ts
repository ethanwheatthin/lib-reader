import { createFeature, createReducer, on } from '@ngrx/store';
import { createEntityAdapter, EntityAdapter, EntityState } from '@ngrx/entity';
import { Shelf } from '../../core/models/shelf.model';
import { ShelvesActions } from './shelves.actions';

export interface ShelvesState extends EntityState<Shelf> {
  selectedShelfId: string | null;
  loading: boolean;
  error: string | null;
}

export const adapter: EntityAdapter<Shelf> = createEntityAdapter<Shelf>();

export const initialState: ShelvesState = adapter.getInitialState({
  selectedShelfId: null,
  loading: false,
  error: null
});

export const shelvesFeature = createFeature({
  name: 'shelves',
  reducer: createReducer(
    initialState,
    on(ShelvesActions.loadShelves, (state) => ({
      ...state,
      loading: true,
      error: null
    })),
    on(ShelvesActions.loadShelvesSuccess, (state, { shelves }) =>
      adapter.setAll(shelves, { ...state, loading: false })
    ),
    on(ShelvesActions.loadShelvesFailure, (state, { error }) => ({
      ...state,
      loading: false,
      error
    })),
    on(ShelvesActions.createShelf, (state) => ({
      ...state,
      loading: true,
      error: null
    })),
    on(ShelvesActions.createShelfSuccess, (state, { shelf }) =>
      adapter.addOne(shelf, { ...state, loading: false })
    ),
    on(ShelvesActions.createShelfFailure, (state, { error }) => ({
      ...state,
      loading: false,
      error
    })),
    on(ShelvesActions.updateShelfSuccess, (state, { shelf }) =>
      adapter.updateOne({ id: shelf.id, changes: shelf }, state)
    ),
    on(ShelvesActions.deleteShelfSuccess, (state, { id }) =>
      adapter.removeOne(id, state)
    ),
    on(ShelvesActions.addDocumentToShelf, (state, { shelfId, documentId }) => {
      const shelf = state.entities[shelfId];
      if (!shelf) return state;
      return adapter.updateOne(
        {
          id: shelfId,
          changes: {
            documentIds: [...shelf.documentIds, documentId]
          }
        },
        state
      );
    }),
    on(ShelvesActions.removeDocumentFromShelf, (state, { shelfId, documentId }) => {
      const shelf = state.entities[shelfId];
      if (!shelf) return state;
      return adapter.updateOne(
        {
          id: shelfId,
          changes: {
            documentIds: shelf.documentIds.filter(id => id !== documentId)
          }
        },
        state
      );
    }),
    on(ShelvesActions.selectShelf, (state, { id }) => ({
      ...state,
      selectedShelfId: id
    }))
  )
});
