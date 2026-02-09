import { Component, Input, Output, EventEmitter, inject, OnInit, OnDestroy, ElementRef, ViewChild, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Store } from '@ngrx/store';
import ePub from 'epubjs';
import { IndexDBService } from '../../../core/services/indexdb.service';
import { DocumentsActions } from '../../../store/documents/documents.actions';
import { ReadingProgressComponent } from './reading-progress/reading-progress.component';
import { UnifiedSettingsPanelComponent, SettingsState } from './unified-settings-panel/unified-settings-panel.component';
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
  FlowMode,
  SpreadMode,
  FONT_SIZE_MIN,
  FONT_SIZE_STEP,
  LINE_HEIGHT_MIN,
  LINE_HEIGHT_STEP,
  READER_FONTS,
  TocItem,
} from '../../../core/models/document.model';

const STORAGE_KEY = 'epub-reader-settings';
const LOCATIONS_CACHE_PREFIX = 'epub-locations-';

@Component({
  selector: 'app-epub-reader',
  standalone: true,
  imports: [CommonModule, FormsModule, ReadingProgressComponent, UnifiedSettingsPanelComponent],
  templateUrl: './epub-reader.component.html',
  styleUrl: './epub-reader.component.css'
})
export class EpubReaderComponent implements OnInit, OnDestroy {
  @Input() documentId!: string;
  @Output() focusModeChange = new EventEmitter<boolean>();
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

  isCurrentLocationBookmarked = signal<boolean>(false);

  // --- Page info toggle ---
  showProgress = signal<boolean>(false);

  // --- Unified panel state ---
  panelOpen = signal<boolean>(false);

  // --- Focus mode temporary controls visibility ---
  focusModeControlsVisible = signal<boolean>(false);
  private focusModeControlsTimeout: any = null;

  // --- Chapters/TOC ---
  chapters = signal<TocItem[]>([]);
  currentChapterHref = signal<string | null>(null);

  // --- Reading session tracking ---
  private sessionStartTime: Date | null = null;
  private sessionStartPage = 0;
  private currentPageNumber = 0;
  private currentCfi = '';
  private locationsReady = false;

  // --- Follow mode tracking ---
  private followModeWords: string[] = [];
  private followModeCurrentIndex = 0;
  private followModeHighlightElement: HTMLElement | null = null;

  // --- Reader settings signals ---
  fontSize = signal<number>(DEFAULT_READER_SETTINGS.fontSize);
  lineHeight = signal<number>(DEFAULT_READER_SETTINGS.lineHeight);
  fontFamily = signal<string>(DEFAULT_READER_SETTINGS.fontFamily);
  theme = signal<ThemeOption>(DEFAULT_READER_SETTINGS.theme);
  flowMode = signal<FlowMode>(DEFAULT_READER_SETTINGS.flowMode);
  spreadMode = signal<SpreadMode>(DEFAULT_READER_SETTINGS.spreadMode);
  focusMode = signal<boolean>(DEFAULT_READER_SETTINGS.focusMode);
  followMode = signal<boolean>(DEFAULT_READER_SETTINGS.followMode);

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

  // Settings state as a computed object for child component
  get currentSettings(): SettingsState {
    return {
      fontSize: this.fontSize(),
      lineHeight: this.lineHeight(),
      fontFamily: this.fontFamily(),
      theme: this.theme(),
      flowMode: this.flowMode(),
      spreadMode: this.spreadMode(),
      focusMode: this.focusMode(),
      followMode: this.followMode()
    };
  }

  async ngOnInit(): Promise<void> {
    this.loadSettings();
    this.startReadingSession();
    this.setupKeyboardShortcuts();

    try {
      const blob = await this.indexDB.getFile(this.documentId);
      if (blob) {
        const arrayBuffer = await blob.arrayBuffer();
        this.book = ePub(arrayBuffer);

        this.rendition = this.book.renderTo(this.viewer.nativeElement, {
          width: '100%',
          height: '100%',
          spread: this.spreadMode(),
          flow: this.flowMode(),
          allowScriptedContent: true,
        });

        // Load table of contents
        await this.loadTableOfContents();

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

        // Dispatch the previously saved progress immediately so the UI
        // shows the last-known percentage without waiting for locations
        if (metadata?.readingProgressPercent != null) {
          this.store.dispatch(
            DocumentsActions.updateReadingProgress({
              id: this.documentId,
              page: metadata.currentPage ?? 0,
              cfi: metadata.currentCfi,
              progressPercent: metadata.readingProgressPercent,
            })
          );
        }

        // Track location changes
        this.rendition.on('relocated', (location: any) => {
          this.updateLocation(location);
        });

        // Attach keyboard listeners to the epub iframe
        this.attachIframeKeyboardListeners();

        // Try to load cached locations for instant progress, otherwise generate
        await this.loadOrGenerateLocations();
      }
    } catch (error) {
      console.error('Error loading EPUB:', error);
    }
  }

  ngOnDestroy(): void {
    this.endReadingSession();
    this.cleanupKeyboardShortcuts();
    this.detachIframeKeyboardListeners();
    this.cleanupFollowMode();
    if (this.focusModeControlsTimeout) {
      clearTimeout(this.focusModeControlsTimeout);
    }
    if (this.rendition) {
      this.rendition.destroy();
    }
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
  // Unified panel toggle
  // ---------------------------------------------------------------------------

  togglePanel(): void {
    this.panelOpen.update(open => !open);
  }

  togglePageInfo(): void {
    this.showProgress.update(v => !v);
  }

  onViewerClick(): void {
    if (this.focusMode()) {
      // Temporarily show controls in focus mode
      this.focusModeControlsVisible.set(true);
      
      // Clear existing timeout
      if (this.focusModeControlsTimeout) {
        clearTimeout(this.focusModeControlsTimeout);
      }
      
      // Hide controls after 3 seconds
      this.focusModeControlsTimeout = setTimeout(() => {
        this.focusModeControlsVisible.set(false);
      }, 3000);
    }
  }

  exitFocusMode(): void {
    this.focusMode.set(false);
    this.focusModeControlsVisible.set(false);
    if (this.focusModeControlsTimeout) {
      clearTimeout(this.focusModeControlsTimeout);
    }
    this.focusModeChange.emit(false);
    this.saveSettings();
  }

  // ---------------------------------------------------------------------------
  // Settings change handler from child component
  // ---------------------------------------------------------------------------

  onSettingsChange(newSettings: SettingsState): void {
    const needsRecreate = 
      this.flowMode() !== newSettings.flowMode || 
      this.spreadMode() !== newSettings.spreadMode;

    // Update local signals
    this.fontSize.set(newSettings.fontSize);
    this.lineHeight.set(newSettings.lineHeight);
    this.fontFamily.set(newSettings.fontFamily);
    this.theme.set(newSettings.theme);
    this.flowMode.set(newSettings.flowMode);
    this.spreadMode.set(newSettings.spreadMode);
    const focusModeChanged = this.focusMode() !== newSettings.focusMode;
    this.focusMode.set(newSettings.focusMode);
    const followModeChanged = this.followMode() !== newSettings.followMode;
    this.followMode.set(newSettings.followMode);

    if (focusModeChanged) {
      this.focusModeChange.emit(newSettings.focusMode);
    }

    if (needsRecreate) {
      // Flow/spread changes require recreating the rendition
      this.recreateRendition();
    } else if (this.rendition) {
      // Apply other settings without recreating
      this.rendition.themes.fontSize(`${newSettings.fontSize}px`);
      this.rendition.themes.select(newSettings.theme);
      this.applyLineHeightAndFont();
    }

    // Handle follow mode toggle
    if (followModeChanged) {
      if (newSettings.followMode) {
        this.startFollowMode();
      } else {
        this.cleanupFollowMode();
      }
    }

    this.applyHostTheme(newSettings.theme);
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
      flowMode: this.flowMode(),
      spreadMode: this.spreadMode(),
      focusMode: this.focusMode(),
      followMode: this.followMode(),
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
        if (saved.flowMode) this.flowMode.set(saved.flowMode);
        if (saved.spreadMode) this.spreadMode.set(saved.spreadMode);
        if (saved.focusMode != null) this.focusMode.set(saved.focusMode);
        if (saved.followMode != null) this.followMode.set(saved.followMode);
      }
    } catch {
      console.warn('Could not load reader settings from localStorage');
    }
    // Emit initial focus mode state after loading settings
    this.focusModeChange.emit(this.focusMode());
  }

  // ---------------------------------------------------------------------------
  // Bookmarks
  // ---------------------------------------------------------------------------

  private async loadTableOfContents(): Promise<void> {
    if (!this.book) return;
    try {
      const navigation = await this.book.loaded.navigation;
      const tocItems: TocItem[] = navigation.toc.map((item: any) => ({
        id: item.id || crypto.randomUUID(),
        label: item.label,
        href: item.href,
        subitems: item.subitems?.map((sub: any) => ({
          id: sub.id || crypto.randomUUID(),
          label: sub.label,
          href: sub.href,
          parent: item.id,
        })),
      }));
      this.chapters.set(tocItems);
    } catch (error) {
      console.warn('Could not load table of contents:', error);
      this.chapters.set([]);
    }
  }

  /**
   * Load cached locations from localStorage or generate them.
   * Caching avoids the expensive ~5 s generation on every book open.
   */
  private async loadOrGenerateLocations(): Promise<void> {
    if (!this.book) return;

    const cacheKey = LOCATIONS_CACHE_PREFIX + this.documentId;

    try {
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        this.book.locations.load(cached);
        this.locationsReady = true;
        // Re-dispatch progress now that locations are available
        const loc = this.rendition?.currentLocation();
        if (loc) this.updateLocation(loc);
        return;
      }
    } catch {
      // Cache miss or corrupt — fall through to generate
    }

    // Generate in the background (increased granularity for speed)
    this.book.locations.generate(1600).then(() => {
      this.locationsReady = true;
      // Cache for next time
      try {
        localStorage.setItem(cacheKey, this.book.locations.save());
      } catch {
        // localStorage full — non-critical
      }
      // Re-dispatch with accurate progress
      const loc = this.rendition?.currentLocation();
      if (loc) this.updateLocation(loc);
    });
  }

  onChapterSelect(chapter: TocItem): void {
    if (this.rendition) {
      this.rendition.display(chapter.href);
      // Panel stays open for easier navigation
    }
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
      // Panel stays open for easier navigation
    }
  }

  removeBookmark(bookmarkId: string): void {
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

    // Update current chapter based on href
    if (location.start.href) {
      this.currentChapterHref.set(location.start.href);
    }

    // Check if current location is bookmarked
    this.bookmarks$.subscribe((bookmarks) => {
      this.isCurrentLocationBookmarked.set(
        bookmarks.some((b) => b.location === this.currentCfi)
      );
    }).unsubscribe();

    // Calculate overall book progress percentage
    let progressPercent: number | undefined;
    if (this.locationsReady && this.book?.locations?.length() > 0 && this.currentCfi) {
      progressPercent = Math.round(
        this.book.locations.percentageFromCfi(this.currentCfi) * 100
      );
    } else if (location.start.percentage != null) {
      // Spine-based percentage — available instantly from epub.js
      progressPercent = Math.round(location.start.percentage * 100);
    }

    // Save progress
    if (location.start.displayed.page) {
      this.store.dispatch(
        DocumentsActions.updateReadingProgress({
          id: this.documentId,
          page: location.start.displayed.page,
          cfi: this.currentCfi,
          progressPercent,
        })
      );
    }
  }

  // ---------------------------------------------------------------------------
  // Keyboard shortcuts
  // ---------------------------------------------------------------------------

  private keyboardHandler = (event: KeyboardEvent) => {
    const isInputActive = document.activeElement?.tagName === 'INPUT' || 
                          document.activeElement?.tagName === 'TEXTAREA';

    // Focus mode toggle: F key
    if (event.key === 'f' || event.key === 'F') {
      if (!isInputActive) {
        event.preventDefault();
        this.focusMode.update(v => !v);
        this.focusModeChange.emit(this.focusMode());
        this.saveSettings();
      }
    }

    // Follow mode controls
    if (this.followMode()) {
      if (event.key === 'ArrowRight' || event.key === ' ') {
        event.preventDefault();
        this.advanceFollowMode();
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault();
        this.retreatFollowMode();
      } else if (event.key === 'Escape') {
        event.preventDefault();
        this.followMode.set(false);
        this.cleanupFollowMode();
        this.saveSettings();
      }
      return; // Don't process other shortcuts in follow mode
    }

    // Page navigation and other shortcuts (when NOT in follow mode and NOT in input)
    if (!isInputActive) {
      if (event.key === 'ArrowRight') {
        event.preventDefault();
        this.nextPage();
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault();
        this.prevPage();
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        this.increaseFontSize();
      } else if (event.key === 'ArrowDown') {
        event.preventDefault();
        this.decreaseFontSize();
      } else if (event.key === 'd' || event.key === 'D') {
        event.preventDefault();
        this.nextPage();
      } else if (event.key === 'a' || event.key === 'A') {
        event.preventDefault();
        this.prevPage();
      } else if (event.key === 'b' || event.key === 'B') {
        event.preventDefault();
        this.toggleBookmarkAtCurrentLocation();
      } else if (event.key === 'o' || event.key === 'O') {
        event.preventDefault();
        this.togglePanel();
      }
    }
  };

  private setupKeyboardShortcuts(): void {
    document.addEventListener('keydown', this.keyboardHandler);
  }

  private cleanupKeyboardShortcuts(): void {
    document.removeEventListener('keydown', this.keyboardHandler);
  }

  private increaseFontSize(): void {
    const newSize = this.fontSize() + this.FONT_SIZE_STEP;
    this.fontSize.set(newSize);
    if (this.rendition) {
      this.rendition.themes.fontSize(`${newSize}px`);
    }
    this.saveSettings();
  }

  private decreaseFontSize(): void {
    const currentSize = this.fontSize();
    if (currentSize > this.FONT_SIZE_MIN) {
      const newSize = Math.max(this.FONT_SIZE_MIN, currentSize - this.FONT_SIZE_STEP);
      this.fontSize.set(newSize);
      if (this.rendition) {
        this.rendition.themes.fontSize(`${newSize}px`);
      }
      this.saveSettings();
    }
  }

  /**
   * Attach keyboard event listeners to the epub.js iframe so shortcuts
   * work when the user is focused on the book content.
   */
  private attachIframeKeyboardListeners(): void {
    if (!this.rendition) return;

    try {
      const contents = this.rendition.getContents();
      if (contents && contents.length > 0) {
        contents.forEach((content: any) => {
          const iframeDoc = content.document;
          if (iframeDoc) {
            iframeDoc.addEventListener('keydown', this.keyboardHandler);
          }
        });
      }
    } catch (error) {
      console.warn('Could not attach iframe keyboard listeners:', error);
    }
  }

  /**
   * Remove keyboard event listeners from the epub.js iframe.
   */
  private detachIframeKeyboardListeners(): void {
    if (!this.rendition) return;

    try {
      const contents = this.rendition.getContents();
      if (contents && contents.length > 0) {
        contents.forEach((content: any) => {
          const iframeDoc = content.document;
          if (iframeDoc) {
            iframeDoc.removeEventListener('keydown', this.keyboardHandler);
          }
        });
      }
    } catch (error) {
      // Silently ignore cleanup errors
    }
  }

  // ---------------------------------------------------------------------------
  // Rendition recreation (for flow/spread changes)
  // ---------------------------------------------------------------------------

  private async recreateRendition(): Promise<void> {
    if (!this.book || !this.rendition) return;

    const currentCfi = this.currentCfi;
    
    // Destroy old rendition
    this.rendition.destroy();

    // Create new rendition with updated settings
    this.rendition = this.book.renderTo(this.viewer.nativeElement, {
      width: '100%',
      height: '100%',
      spread: this.spreadMode(),
      flow: this.flowMode(),
      allowScriptedContent: true,
    });

    // Re-register themes
    this.registerThemes();

    // Apply all settings
    this.applyAllSettings();

    // Restore position
    if (currentCfi) {
      await this.rendition.display(currentCfi);
    } else {
      await this.rendition.display();
    }

    // Re-attach location tracking
    this.rendition.on('relocated', (location: any) => {
      this.updateLocation(location);
    });

    // Re-attach keyboard listeners to the new iframe
    this.attachIframeKeyboardListeners();
  }

  // ---------------------------------------------------------------------------
  // Follow mode (word-by-word highlighting)
  // ---------------------------------------------------------------------------

  private startFollowMode(): void {
    if (!this.rendition) return;

    try {
      // Get the current page's text content
      const contents = this.rendition.getContents();
      if (contents && contents.length > 0) {
        const iframe = contents[0];
        const doc = iframe.document;
        
        if (doc && doc.body) {
          const text = doc.body.innerText || '';
          // Split into words (basic tokenization)
          this.followModeWords = text.split(/\s+/).filter((w: any) => w.length > 0);
          this.followModeCurrentIndex = 0;
          this.highlightCurrentWord();
        }
      }
    } catch (error) {
      console.warn('Could not initialize follow mode:', error);
    }
  }

  private highlightCurrentWord(): void {
    if (!this.rendition || this.followModeWords.length === 0) return;

    try {
      const contents = this.rendition.getContents();
      if (contents && contents.length > 0) {
        const iframe = contents[0];
        const doc = iframe.document;
        
        if (doc && doc.body) {
          // Remove previous highlight
          if (this.followModeHighlightElement) {
            this.followModeHighlightElement.remove();
          }

          // Find and highlight current word
          const currentWord = this.followModeWords[this.followModeCurrentIndex];
          const bodyText = doc.body.innerHTML;
          
          // Simple word highlighting (can be improved with better text processing)
          const wordRegex = new RegExp(`\\b${this.escapeRegex(currentWord)}\\b`, 'i');
          const match = wordRegex.exec(doc.body.innerText);
          
          if (match) {
            // Create highlight element
            const range = doc.createRange();
            const textNode = this.findTextNode(doc.body, currentWord, this.followModeCurrentIndex);
            
            if (textNode) {
              const startOffset = textNode.textContent?.indexOf(currentWord) ?? 0;
              range.setStart(textNode, startOffset);
              range.setEnd(textNode, startOffset + currentWord.length);
              
              const highlight = doc.createElement('span');
              highlight.style.backgroundColor = 'rgba(255, 255, 0, 0.5)';
              highlight.style.transition = 'background-color 0.3s';
              range.surroundContents(highlight);
              
              this.followModeHighlightElement = highlight;
              
              // Scroll into view
              highlight.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
          }
        }
      }
    } catch (error) {
      console.warn('Error highlighting word:', error);
    }
  }

  private advanceFollowMode(): void {
    if (this.followModeCurrentIndex < this.followModeWords.length - 1) {
      this.followModeCurrentIndex++;
      this.highlightCurrentWord();
    } else {
      // End of page, go to next page
      this.nextPage().then(() => {
        setTimeout(() => this.startFollowMode(), 500);
      });
    }
  }

  private retreatFollowMode(): void {
    if (this.followModeCurrentIndex > 0) {
      this.followModeCurrentIndex--;
      this.highlightCurrentWord();
    }
  }

  private cleanupFollowMode(): void {
    this.followModeWords = [];
    this.followModeCurrentIndex = 0;
    if (this.followModeHighlightElement) {
      this.followModeHighlightElement.remove();
      this.followModeHighlightElement = null;
    }
  }

  private findTextNode(element: Node, word: string, occurrence: number): Text | null {
    let currentOccurrence = 0;
    
    const walk = (node: Node): Text | null => {
      if (node.nodeType === Node.TEXT_NODE) {
        const text = node.textContent || '';
        if (text.includes(word)) {
          if (currentOccurrence === occurrence) {
            return node as Text;
          }
          currentOccurrence++;
        }
      } else {
        for (let i = 0; i < node.childNodes.length; i++) {
          const result = walk(node.childNodes[i]);
          if (result) return result;
        }
      }
      return null;
    };
    
    return walk(element);
  }

  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}

