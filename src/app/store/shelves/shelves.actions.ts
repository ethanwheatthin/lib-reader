import { createActionGroup, emptyProps, props } from '@ngrx/store';
import { Shelf } from '../../core/models/shelf.model';

export const ShelvesActions = createActionGroup({
  source: 'Shelves',
  events: {
    'Load Shelves': emptyProps(),
    'Load Shelves Success': props<{ shelves: Shelf[] }>(),
    'Load Shelves Failure': props<{ error: string }>(),

    'Create Shelf': props<{ name: string; color: string }>(),
    'Create Shelf Success': props<{ shelf: Shelf }>(),
    'Create Shelf Failure': props<{ error: string }>(),

    'Update Shelf': props<{ id: string; changes: Partial<Shelf> }>(),
    'Update Shelf Success': props<{ shelf: Shelf }>(),
    'Update Shelf Failure': props<{ error: string }>(),

    'Delete Shelf': props<{ id: string }>(),
    'Delete Shelf Success': props<{ id: string }>(),
    'Delete Shelf Failure': props<{ error: string }>(),

    'Add Document To Shelf': props<{ shelfId: string; documentId: string }>(),
    'Remove Document From Shelf': props<{ shelfId: string; documentId: string }>(),
    'Move Document To Shelf': props<{ documentId: string; fromShelfId: string | null; toShelfId: string | null }>(),

    'Select Shelf': props<{ id: string | null }>(),
  }
});
