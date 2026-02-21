import { createFeature, createReducer, on } from '@ngrx/store';
import { createEntityAdapter, EntityAdapter, EntityState } from '@ngrx/entity';
import { LibrarySource } from '../../core/models/library-source.model';
import { LibrarySourcesActions } from './library-sources.actions';

export interface LibrarySourcesState extends EntityState<LibrarySource> {
  loading: boolean;
  error: string | null;
  /** ID of a source currently being scanned */
  scanningSourceId: string | null;
}

export const adapter: EntityAdapter<LibrarySource> = createEntityAdapter<LibrarySource>();

export const initialState: LibrarySourcesState = adapter.getInitialState({
  loading: false,
  error: null,
  scanningSourceId: null,
});

export const librarySourcesFeature = createFeature({
  name: 'librarySources',
  reducer: createReducer(
    initialState,

    // Load
    on(LibrarySourcesActions.loadSources, (state) => ({
      ...state,
      loading: true,
      error: null,
    })),
    on(LibrarySourcesActions.loadSourcesSuccess, (state, { sources }) =>
      adapter.setAll(sources, { ...state, loading: false })
    ),
    on(LibrarySourcesActions.loadSourcesFailure, (state, { error }) => ({
      ...state,
      loading: false,
      error,
    })),

    // Create
    on(LibrarySourcesActions.createSource, (state) => ({
      ...state,
      loading: true,
      error: null,
    })),
    on(LibrarySourcesActions.createSourceSuccess, (state, { source }) =>
      adapter.addOne(source, { ...state, loading: false })
    ),
    on(LibrarySourcesActions.createSourceFailure, (state, { error }) => ({
      ...state,
      loading: false,
      error,
    })),

    // Update
    on(LibrarySourcesActions.updateSourceSuccess, (state, { source }) =>
      adapter.upsertOne(source, state)
    ),

    // Delete
    on(LibrarySourcesActions.deleteSourceSuccess, (state, { id }) =>
      adapter.removeOne(id, state)
    ),

    // Scan
    on(LibrarySourcesActions.scanSource, (state, { id }) => ({
      ...state,
      scanningSourceId: id,
    })),
    on(LibrarySourcesActions.scanSourceSuccess, (state, { source }) =>
      adapter.upsertOne(source, { ...state, scanningSourceId: null })
    ),
    on(LibrarySourcesActions.scanSourceFailure, (state, { error }) => ({
      ...state,
      scanningSourceId: null,
      error,
    }))
  ),
});
