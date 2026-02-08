import { createSelector } from '@ngrx/store';
import { documentsFeature } from './documents.reducer';
import { adapter } from './documents.reducer';
import { Document } from '../../core/models/document.model';

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

// --- Bookmark selectors ---
export const selectBookmarksByDocumentId = (id: string) =>
  createSelector(selectDocumentEntities, (entities) => entities[id]?.bookmarks ?? []);

export const selectSelectedDocumentBookmarks = createSelector(
  selectSelectedDocument,
  (doc) => doc?.bookmarks ?? []
);

// --- Progress selectors ---
export const selectReadingProgress = createSelector(
  selectSelectedDocument,
  (doc): number => {
    if (!doc) return 0;
    if (doc.readingProgressPercent != null) return doc.readingProgressPercent;
    if (!doc.currentPage || !doc.totalPages || doc.totalPages === 0) return 0;
    return Math.round((doc.currentPage / doc.totalPages) * 100);
  }
);

export const selectEstimatedTimeRemaining = createSelector(
  selectSelectedDocument,
  (doc): string | null => {
    if (!doc || !doc.currentPage || !doc.totalPages) return null;
    const stats = doc.readingStats;
    if (!stats || stats.sessions.length === 0) return null;

    // Average pages per minute based on recent sessions
    const recentSessions = stats.sessions.slice(-5);
    const totalPages = recentSessions.reduce((sum, s) => sum + s.pagesRead, 0);
    const totalMinutes = recentSessions.reduce((sum, s) => sum + s.duration, 0) / 60000;
    if (totalMinutes === 0 || totalPages === 0) return null;

    const pagesPerMinute = totalPages / totalMinutes;
    const remainingPages = doc.totalPages - doc.currentPage;
    const remainingMinutes = Math.ceil(remainingPages / pagesPerMinute);

    if (remainingMinutes < 60) return `~${remainingMinutes} min left`;
    const hours = Math.floor(remainingMinutes / 60);
    const mins = remainingMinutes % 60;
    return `~${hours}h ${mins}m left`;
  }
);

// --- Reading stats selectors ---
export const selectReadingStats = createSelector(
  selectSelectedDocument,
  (doc) => doc?.readingStats ?? { totalReadingTime: 0, sessions: [] }
);

export const selectReadingGoal = createSelector(
  selectSelectedDocument,
  (doc) => doc?.readingGoal ?? null
);

export const selectTodayReadingTime = createSelector(
  selectReadingStats,
  (stats): number => {
    const today = new Date().toISOString().slice(0, 10);
    return stats.sessions
      .filter((s) => new Date(s.startedAt).toISOString().slice(0, 10) === today)
      .reduce((sum, s) => sum + s.duration, 0);
  }
);

export const selectDocumentProgress = (id: string) =>
  createSelector(selectDocumentEntities, (entities): number => {
    const doc = entities[id];
    if (doc?.readingProgressPercent != null) return doc.readingProgressPercent;
    if (!doc || !doc.currentPage || !doc.totalPages || doc.totalPages === 0) return 0;
    return Math.round((doc.currentPage / doc.totalPages) * 100);
  });
