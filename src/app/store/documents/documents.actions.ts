import { createActionGroup, emptyProps, props } from '@ngrx/store';
import { Document } from '../../core/models/document.model';

export const DocumentsActions = createActionGroup({
  source: 'Documents',
  events: {
    'Upload Document': props<{ file: File }>(),
    'Upload Document Success': props<{ document: Document }>(),
    'Upload Document Failure': props<{ error: string }>(),
    'Load Documents': emptyProps(),
    'Load Documents Success': props<{ documents: Document[] }>(),
    'Delete Document': props<{ id: string }>(),
    'Delete Document Success': props<{ id: string }>(),
    'Open Document': props<{ id: string }>(),
    'Update Reading Progress': props<{ id: string; page: number }>()
  }
});
