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
  FONT_SIZE_STEP,
  LINE_HEIGHT_MIN,
  LINE_HEIGHT_STEP,
  READER_FONTS,
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
  lineHeight = signal<number>(DEFAULT_READER_SETTINGS.lineHeight);
  fontFamily = signal<string>(DEFAULT_READER_SETTINGS.fontFamily);
  theme = signal<ThemeOption>(DEFAULT_READER_SETTINGS.theme);
  settingsOpen = signal<boolean>(false);

  // --- Control constraints ---
  readonly FONT_SIZE_MIN = FONT_SIZE_MIN;
  readonly FONT_SIZE_STEP = FONT_SIZE_STEP;
  readonly LINE_HEIGHT_MIN = LINE_HEIGHT_MIN;
  readonly LINE_HEIGHT_STEP = LINE_HEIGHT_STEP;

  /** Available font families */
  readonly fonts = READER_FONTS;

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

  /** Increase font size */
  increaseFontSize(): void {
    const current = this.fontSize();
    const newSize = current + FONT_SIZE_STEP;
    this.fontSize.set(newSize);
    if (this.rendition) {
      this.rendition.themes.fontSize(`${newSize}px`);
    }
    this.saveSettings();
  }

  /** Decrease font size */
  decreaseFontSize(): void {
    const current = this.fontSize();
    if (current > FONT_SIZE_MIN) {
      const newSize = current - FONT_SIZE_STEP;
      this.fontSize.set(newSize);
      if (this.rendition) {
        this.rendition.themes.fontSize(`${newSize}px`);
      }
      this.saveSettings();
    }
  }

  /** Increase line height */
  increaseLineHeight(): void {
    const current = this.lineHeight();
    const newHeight = Math.round((current + LINE_HEIGHT_STEP) * 10) / 10;
    this.lineHeight.set(newHeight);
    if (this.rendition) {
      this.rendition.themes.override('line-height', `${newHeight}`);
    }
    this.saveSettings();
  }

  /** Decrease line height */
  decreaseLineHeight(): void {
    const current = this.lineHeight();
    if (current > LINE_HEIGHT_MIN) {
      const newHeight = Math.round((current - LINE_HEIGHT_STEP) * 10) / 10;
      this.lineHeight.set(newHeight);
      if (this.rendition) {
        this.rendition.themes.override('line-height', `${newHeight}`);
      }
      this.saveSettings();
    }
  }

  /** Update font family */
  updateFontFamily(font: string): void {
    this.fontFamily.set(font);
    if (this.rendition) {
      this.rendition.themes.override('font-family', font);
    }
    this.saveSettings();
  }

  /** Switch the active theme (light / dark / sepia) */
  updateTheme(value: ThemeOption): void {
    this.theme.set(value);
    if (this.rendition) {
      this.rendition.themes.select(value);
      // Re-apply line-height and font-family overrides since theme change resets them
      this.applyLineHeightAndFont();
    }
    this.applyHostTheme(value);
    this.saveSettings();
  }

  /** Reset all settings to factory defaults */
  resetToDefaults(): void {
    this.fontSize.set(DEFAULT_READER_SETTINGS.fontSize);
    this.lineHeight.set(DEFAULT_READER_SETTINGS.lineHeight);
    this.fontFamily.set(DEFAULT_READER_SETTINGS.fontFamily);
    this.theme.set(DEFAULT_READER_SETTINGS.theme);
    if (this.rendition) {
      this.rendition.themes.fontSize(`${DEFAULT_READER_SETTINGS.fontSize}px`);
      this.rendition.themes.select(DEFAULT_READER_SETTINGS.theme);
      this.applyLineHeightAndFont();
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
   * and line height so the book content matches the selected theme.
   */
  private registerThemes(): void {
    if (!this.rendition) return;

    const lh = this.lineHeight();

    this.rendition.themes.register('light', {
      body: {
        background: '#ffffff',
        color: '#000000',
        'line-height': `${lh}`,
      },
    });

    this.rendition.themes.register('dark', {
      body: {
        background: '#1a1a1a',
        color: '#e0e0e0',
        'line-height': `${lh}`,
      },
    });

    this.rendition.themes.register('sepia', {
      body: {
        background: '#f4f1ea',
        color: '#5f4b32',
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
    this.applyLineHeightAndFont();
    this.applyHostTheme(this.theme());
  }

  /** Re-apply line-height and font-family overrides (needed after theme selection) */
  private applyLineHeightAndFont(): void {
    if (!this.rendition) return;
    this.rendition.themes.override('line-height', `${this.lineHeight()}`);
    this.rendition.themes.override('font-family', this.fontFamily());
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
      lineHeight: this.lineHeight(),
      fontFamily: this.fontFamily(),
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
        if (saved.lineHeight) this.lineHeight.set(saved.lineHeight);
        if (saved.fontFamily) this.fontFamily.set(saved.fontFamily);
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
