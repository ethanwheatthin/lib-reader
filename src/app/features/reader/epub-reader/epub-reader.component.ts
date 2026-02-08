import { Component, Input, inject, OnInit, OnDestroy, ElementRef, ViewChild, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Store } from '@ngrx/store';
import ePub from 'epubjs';
import { IndexDBService } from '../../../core/services/indexdb.service';
import { DocumentsActions } from '../../../store/documents/documents.actions';
import {
  selectSelectedDocumentBookmarks,
  selectReadingProgress,
  selectEstimatedTimeRemaining,
  selectReadingStats,
  selectReadingGoal,
  selectTodayReadingTime,
} from '../../../store/documents/documents.selectors';
import {
  Bookmark,
  ReadingSession,
  ReaderSettings,
  DEFAULT_READER_SETTINGS,
  ThemeOption,
  FONT_SIZE_MIN,
  FONT_SIZE_MAX,
  FONT_SIZE_STEP,
  MARGIN_MIN,
  MARGIN_MAX,
  MARGIN_STEP,
  LINE_HEIGHT_MIN,
  LINE_HEIGHT_MAX,
  LINE_HEIGHT_STEP,
  READER_PRESETS,
  ReaderPreset,
} from '../../../core/models/document.model';

const STORAGE_KEY = 'epub-reader-settings';

@Component({
  selector: 'app-epub-reader',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './epub-reader.component.html',
  styleUrl: './epub-reader.component.css'
})
export class EpubReaderComponent implements OnInit, OnDestroy {
  @Input() documentId!: string;
  @ViewChild('viewer', { static: true }) viewer!: ElementRef;

  private store = inject(Store);
  private indexDB = inject(IndexDBService);
  private book: any;
  private rendition: any;

  currentLocation = '';
  canGoPrev = false;
  canGoNext = true;

  // --- Bookmarks & progress from store ---
  bookmarks$ = this.store.select(selectSelectedDocumentBookmarks);
  readingProgress$ = this.store.select(selectReadingProgress);
  estimatedTimeRemaining$ = this.store.select(selectEstimatedTimeRemaining);
  readingStats$ = this.store.select(selectReadingStats);
  readingGoal$ = this.store.select(selectReadingGoal);
  todayReadingTime$ = this.store.select(selectTodayReadingTime);

  bookmarksOpen = signal<boolean>(false);
  isCurrentLocationBookmarked = signal<boolean>(false);

  // --- Reading session tracking ---
  private sessionStartTime: Date | null = null;
  private sessionStartPage = 0;
  private currentPageNumber = 0;
  private currentCfi = '';

  // --- Reader settings signals ---
  fontSize = signal<number>(DEFAULT_READER_SETTINGS.fontSize);
  margin = signal<number>(DEFAULT_READER_SETTINGS.margin);
  lineHeight = signal<number>(DEFAULT_READER_SETTINGS.lineHeight);
  theme = signal<ThemeOption>(DEFAULT_READER_SETTINGS.theme);
  settingsOpen = signal<boolean>(false);

  // --- Slider constraints ---
  readonly FONT_SIZE_MIN = FONT_SIZE_MIN;
  readonly FONT_SIZE_MAX = FONT_SIZE_MAX;
  readonly FONT_SIZE_STEP = FONT_SIZE_STEP;
  readonly MARGIN_MIN = MARGIN_MIN;
  readonly MARGIN_MAX = MARGIN_MAX;
  readonly MARGIN_STEP = MARGIN_STEP;
  readonly LINE_HEIGHT_MIN = LINE_HEIGHT_MIN;
  readonly LINE_HEIGHT_MAX = LINE_HEIGHT_MAX;
  readonly LINE_HEIGHT_STEP = LINE_HEIGHT_STEP;

  /** Presets for quick-select */
  readonly presets: ReaderPreset[] = READER_PRESETS;

  /** Predefined theme options */
  readonly themeOptions: { label: string; value: ThemeOption }[] = [
    { label: 'Light', value: 'light' },
    { label: 'Dark', value: 'dark' },
    { label: 'Sepia', value: 'sepia' },
  ];

  // --- Dragging state ---
  isDragging = false;
  panelX = signal<number | null>(null);
  panelY = signal<number | null>(null);
  private dragOffsetX = 0;
  private dragOffsetY = 0;
  private boundOnDragMove = this.onDragMove.bind(this);
  private boundOnDragEnd = this.onDragEnd.bind(this);

  async ngOnInit(): Promise<void> {
    this.loadSettings();
    this.startReadingSession();

    try {
      const blob = await this.indexDB.getFile(this.documentId);
      if (blob) {
        const arrayBuffer = await blob.arrayBuffer();
        this.book = ePub(arrayBuffer);

        this.rendition = this.book.renderTo(this.viewer.nativeElement, {
          width: '100%',
          height: '100%',
          spread: 'none',
          allowScriptedContent: true,
        });

        // Register all themes before displaying so they are ready to use
        this.registerThemes();

        // Resume from saved position if available
        const metadata = await this.indexDB.getMetadata(this.documentId);
        if (metadata?.currentCfi) {
          await this.rendition.display(metadata.currentCfi);
        } else {
          await this.rendition.display();
        }

        // Apply persisted settings once the rendition is ready
        this.applyAllSettings();

        // Track location changes
        this.rendition.on('relocated', (location: any) => {
          this.updateLocation(location);
        });
      }
    } catch (error) {
      console.error('Error loading EPUB:', error);
    }
  }

  ngOnDestroy(): void {
    this.endReadingSession();
    if (this.rendition) {
      this.rendition.destroy();
    }
    // Clean up any lingering drag listeners
    document.removeEventListener('mousemove', this.boundOnDragMove);
    document.removeEventListener('mouseup', this.boundOnDragEnd);
    document.removeEventListener('touchmove', this.boundOnDragMove);
    document.removeEventListener('touchend', this.boundOnDragEnd);
  }

  // ---------------------------------------------------------------------------
  // Navigation
  // ---------------------------------------------------------------------------

  async nextPage(): Promise<void> {
    if (this.rendition) {
      await this.rendition.next();
    }
  }

  async prevPage(): Promise<void> {
    if (this.rendition) {
      await this.rendition.prev();
    }
  }

  // ---------------------------------------------------------------------------
  // Settings panel toggle
  // ---------------------------------------------------------------------------

  toggleSettings(): void {
    this.settingsOpen.update(open => !open);
    // Reset panel position when re-opening
    if (this.settingsOpen()) {
      this.panelX.set(null);
      this.panelY.set(null);
    }
  }

  // ---------------------------------------------------------------------------
  // Dragging logic
  // ---------------------------------------------------------------------------

  onDragStart(event: MouseEvent | TouchEvent): void {
    const panel = (event.target as HTMLElement).closest('.settings-panel') as HTMLElement | null;
    if (!panel) return;

    this.isDragging = true;
    const rect = panel.getBoundingClientRect();
    if (event instanceof MouseEvent) {
      this.dragOffsetX = event.clientX - rect.left;
      this.dragOffsetY = event.clientY - rect.top;
    } else {
      const touch = event.touches[0];
      this.dragOffsetX = touch.clientX - rect.left;
      this.dragOffsetY = touch.clientY - rect.top;
    }

    document.addEventListener('mousemove', this.boundOnDragMove);
    document.addEventListener('mouseup', this.boundOnDragEnd);
    document.addEventListener('touchmove', this.boundOnDragMove, { passive: false });
    document.addEventListener('touchend', this.boundOnDragEnd);
    event.preventDefault();
  }

  private onDragMove(event: MouseEvent | TouchEvent): void {
    if (!this.isDragging) return;
    let clientX: number, clientY: number;
    if (event instanceof MouseEvent) {
      clientX = event.clientX;
      clientY = event.clientY;
    } else {
      clientX = event.touches[0].clientX;
      clientY = event.touches[0].clientY;
      event.preventDefault();
    }
    this.panelX.set(clientX - this.dragOffsetX);
    this.panelY.set(clientY - this.dragOffsetY);
  }

  private onDragEnd(): void {
    this.isDragging = false;
    document.removeEventListener('mousemove', this.boundOnDragMove);
    document.removeEventListener('mouseup', this.boundOnDragEnd);
    document.removeEventListener('touchmove', this.boundOnDragMove);
    document.removeEventListener('touchend', this.boundOnDragEnd);
  }

  // ---------------------------------------------------------------------------
  // Control update methods
  // ---------------------------------------------------------------------------

  /** Update font size and re-render via epub.js themes API */
  updateFontSize(event: Event): void {
    const size = +(event.target as HTMLInputElement).value;
    this.fontSize.set(size);
    if (this.rendition) {
      this.rendition.themes.fontSize(`${size}px`);
    }
    this.saveSettings();
  }

  /** Update horizontal margin and apply via epub.js theme overrides */
  updateMargin(event: Event): void {
    const px = +(event.target as HTMLInputElement).value;
    this.margin.set(px);
    if (this.rendition) {
      this.rendition.themes.override('padding', `0 ${px}px`);
    }
    this.saveSettings();
  }

  /** Update line height and apply via epub.js theme overrides */
  updateLineHeight(event: Event): void {
    const height = +(event.target as HTMLInputElement).value;
    this.lineHeight.set(height);
    if (this.rendition) {
      this.rendition.themes.override('line-height', `${height}`);
    }
    this.saveSettings();
  }

  /** Switch the active theme (light / dark / sepia) */
  updateTheme(value: ThemeOption): void {
    this.theme.set(value);
    if (this.rendition) {
      this.rendition.themes.select(value);
      // Re-apply margin & line-height overrides since theme change resets them
      this.applyMarginAndLineHeight();
    }
    this.applyHostTheme(value);
    this.saveSettings();
  }

  /** Apply a named preset (Compact, Comfortable, Spacious) */
  applyPreset(preset: ReaderPreset): void {
    this.fontSize.set(preset.settings.fontSize);
    this.margin.set(preset.settings.margin);
    this.lineHeight.set(preset.settings.lineHeight);
    if (this.rendition) {
      this.rendition.themes.fontSize(`${preset.settings.fontSize}px`);
      this.applyMarginAndLineHeight();
    }
    this.saveSettings();
  }

  /** Reset all settings to factory defaults */
  resetToDefaults(): void {
    this.fontSize.set(DEFAULT_READER_SETTINGS.fontSize);
    this.margin.set(DEFAULT_READER_SETTINGS.margin);
    this.lineHeight.set(DEFAULT_READER_SETTINGS.lineHeight);
    this.theme.set(DEFAULT_READER_SETTINGS.theme);
    if (this.rendition) {
      this.rendition.themes.fontSize(`${DEFAULT_READER_SETTINGS.fontSize}px`);
      this.rendition.themes.select(DEFAULT_READER_SETTINGS.theme);
      this.applyMarginAndLineHeight();
    }
    this.applyHostTheme(DEFAULT_READER_SETTINGS.theme);
    this.saveSettings();
  }

  // ---------------------------------------------------------------------------
  // epub.js theme registration
  // ---------------------------------------------------------------------------

  /**
   * Register all three reader themes with epub.js.
   * Each theme supplies body-level styles that control background, text colour,
   * margin, and line height so the book content matches the selected theme.
   */
  private registerThemes(): void {
    if (!this.rendition) return;

    const margin = this.margin();
    const lh = this.lineHeight();

    this.rendition.themes.register('light', {
      body: {
        background: '#ffffff',
        color: '#000000',
        padding: `0 ${margin}px`,
        'line-height': `${lh}`,
      },
    });

    this.rendition.themes.register('dark', {
      body: {
        background: '#1a1a1a',
        color: '#e0e0e0',
        padding: `0 ${margin}px`,
        'line-height': `${lh}`,
      },
    });

    this.rendition.themes.register('sepia', {
      body: {
        background: '#f4f1ea',
        color: '#5f4b32',
        padding: `0 ${margin}px`,
        'line-height': `${lh}`,
      },
    });
  }

  // ---------------------------------------------------------------------------
  // Applying settings
  // ---------------------------------------------------------------------------

  /** Apply all persisted settings to the rendition at once */
  private applyAllSettings(): void {
    if (!this.rendition) return;

    this.rendition.themes.fontSize(`${this.fontSize()}px`);
    this.rendition.themes.select(this.theme());
    this.applyMarginAndLineHeight();
    this.applyHostTheme(this.theme());
  }

  /** Re-apply margin & line-height overrides (needed after theme selection) */
  private applyMarginAndLineHeight(): void {
    if (!this.rendition) return;
    const px = this.margin();
    this.rendition.themes.override('padding', `0 ${px}px`);
    this.rendition.themes.override('line-height', `${this.lineHeight()}`);
  }

  /**
   * Mirror the chosen theme onto the host element so that the surrounding
   * chrome (controls, background) can adapt via CSS.
   */
  private applyHostTheme(value: ThemeOption): void {
    const el = this.viewer?.nativeElement?.parentElement;
    if (el) {
      el.setAttribute('data-theme', value);
    }
  }

  // ---------------------------------------------------------------------------
  // Persistence helpers
  // ---------------------------------------------------------------------------

  /** Save the current signal values to localStorage */
  private saveSettings(): void {
    const settings: ReaderSettings = {
      fontSize: this.fontSize(),
      margin: this.margin(),
      lineHeight: this.lineHeight(),
      theme: this.theme(),
    };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch {
      console.warn('Could not persist reader settings to localStorage');
    }
  }

  /** Load persisted settings from localStorage into signals */
  private loadSettings(): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const saved: Partial<ReaderSettings> = JSON.parse(raw);
        if (saved.fontSize) this.fontSize.set(saved.fontSize);
        if (saved.margin) this.margin.set(saved.margin);
        if (saved.lineHeight) this.lineHeight.set(saved.lineHeight);
        if (saved.theme) this.theme.set(saved.theme);
      }
    } catch {
      console.warn('Could not load reader settings from localStorage');
    }
  }

  // ---------------------------------------------------------------------------
  // Bookmarks
  // ---------------------------------------------------------------------------

  toggleBookmarksPanel(): void {
    this.bookmarksOpen.update((open) => !open);
  }

  toggleBookmarkAtCurrentLocation(): void {
    if (!this.currentCfi) return;

    // Check if already bookmarked
    let alreadyBookmarked = false;
    let existingBookmarkId = '';
    this.bookmarks$.subscribe((bookmarks) => {
      const existing = bookmarks.find((b) => b.location === this.currentCfi);
      if (existing) {
        alreadyBookmarked = true;
        existingBookmarkId = existing.id;
      }
    }).unsubscribe();

    if (alreadyBookmarked) {
      this.store.dispatch(
        DocumentsActions.removeBookmark({ id: this.documentId, bookmarkId: existingBookmarkId })
      );
      this.isCurrentLocationBookmarked.set(false);
    } else {
      const bookmark: Bookmark = {
        id: crypto.randomUUID(),
        location: this.currentCfi,
        label: this.currentLocation || 'Bookmark',
        createdAt: new Date(),
      };
      this.store.dispatch(DocumentsActions.addBookmark({ id: this.documentId, bookmark }));
      this.isCurrentLocationBookmarked.set(true);
    }
  }

  jumpToBookmark(bookmark: Bookmark): void {
    if (this.rendition) {
      this.rendition.display(bookmark.location);
      this.bookmarksOpen.set(false);
    }
  }

  removeBookmark(bookmarkId: string, event: Event): void {
    event.stopPropagation();
    this.store.dispatch(
      DocumentsActions.removeBookmark({ id: this.documentId, bookmarkId })
    );
  }

  // ---------------------------------------------------------------------------
  // Reading session tracking
  // ---------------------------------------------------------------------------

  private startReadingSession(): void {
    this.sessionStartTime = new Date();
    this.sessionStartPage = this.currentPageNumber;
    this.store.dispatch(DocumentsActions.startReadingSession({ id: this.documentId }));
  }

  private endReadingSession(): void {
    if (!this.sessionStartTime) return;
    const now = new Date();
    const duration = now.getTime() - this.sessionStartTime.getTime();
    // Only record sessions > 5 seconds
    if (duration < 5000) return;

    const session: ReadingSession = {
      startedAt: this.sessionStartTime,
      endedAt: now,
      duration,
      pagesRead: Math.max(0, this.currentPageNumber - this.sessionStartPage),
    };
    this.store.dispatch(DocumentsActions.endReadingSession({ id: this.documentId, session }));
    this.sessionStartTime = null;
  }

  /** Format milliseconds into a human-readable duration */
  formatDuration(ms: number): string {
    const totalMinutes = Math.floor(ms / 60000);
    if (totalMinutes < 60) return `${totalMinutes}m`;
    const hours = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    return `${hours}h ${mins}m`;
  }

  // ---------------------------------------------------------------------------
  // Location tracking (existing)
  // ---------------------------------------------------------------------------

  private updateLocation(location: any): void {
    this.currentLocation = location.start.displayed.page
      ? `Page ${location.start.displayed.page} of ${location.start.displayed.total}`
      : 'Reading...';

    this.canGoPrev = !location.atStart;
    this.canGoNext = !location.atEnd;

    // Track CFI and page for bookmarks / session
    this.currentCfi = location.start.cfi ?? '';
    if (location.start.displayed.page) {
      this.currentPageNumber = location.start.displayed.page;
    }

    // Check if current location is bookmarked
    this.bookmarks$.subscribe((bookmarks) => {
      this.isCurrentLocationBookmarked.set(
        bookmarks.some((b) => b.location === this.currentCfi)
      );
    }).unsubscribe();

    // Save progress
    if (location.start.displayed.page) {
      this.store.dispatch(
        DocumentsActions.updateReadingProgress({
          id: this.documentId,
          page: location.start.displayed.page,
          cfi: this.currentCfi,
        })
      );
    }
  }
}
