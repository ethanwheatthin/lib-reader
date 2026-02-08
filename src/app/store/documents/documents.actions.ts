import { createActionGroup, emptyProps, props } from '@ngrx/store';
import { Document, Bookmark, ReadingSession, ReadingGoal } from '../../core/models/document.model';

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
    'Update Reading Progress': props<{ id: string; page: number; cfi?: string }>(),

    // Bookmark actions
    'Add Bookmark': props<{ id: string; bookmark: Bookmark }>(),
    'Remove Bookmark': props<{ id: string; bookmarkId: string }>(),
    'Update Bookmark': props<{ id: string; bookmarkId: string; note: string }>(),

    // Reading session tracking
    'Start Reading Session': props<{ id: string }>(),
    'End Reading Session': props<{ id: string; session: ReadingSession }>(),

    // Reading goals
    'Set Reading Goal': props<{ id: string; goal: ReadingGoal }>(),
    'Update Reading Streak': props<{ id: string }>(),
  }
});
