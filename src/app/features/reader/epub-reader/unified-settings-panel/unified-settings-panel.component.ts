import { Component, Input, Output, EventEmitter, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { 
  ThemeOption, 
  FlowMode,
  SpreadMode,
  ZoomLevel,
  PageLayout,
  TocItem, 
  Bookmark, 
  ReadingGoal, 
  ReadingStats,
  READER_FONTS, 
  FONT_SIZE_MIN, 
  FONT_SIZE_STEP, 
  LINE_HEIGHT_MIN, 
  LINE_HEIGHT_STEP,
  FOLLOW_MODE_SPEED_MIN,
  FOLLOW_MODE_SPEED_MAX,
  FOLLOW_MODE_SPEED_STEP
} from '../../../../core/models/document.model';

export interface SettingsState {
  fontSize: number;
  lineHeight: number;
  fontFamily: string;
  theme: ThemeOption;
  flowMode: FlowMode;
  spreadMode: SpreadMode;
  focusMode: boolean;
  followMode: boolean;
  followModeSpeed: number;
  zoomLevel: ZoomLevel;
  pageLayout: PageLayout;
}

export type TabType = 'settings' | 'chapters' | 'bookmarks';

@Component({
  selector: 'app-unified-settings-panel',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './unified-settings-panel.component.html',
  styleUrl: './unified-settings-panel.component.css'
})
export class UnifiedSettingsPanelComponent {
  @Input() isOpen = false;
  @Input() theme: ThemeOption = 'light';
  
  // Settings tab inputs
  @Input() settings!: SettingsState;
  
  // Chapters tab inputs
  @Input() chapters: TocItem[] = [];
  @Input() currentChapter: string | null = null;
  
  // Bookmarks tab inputs
  @Input() bookmarks: Bookmark[] = [];
  @Input() readingStats: ReadingStats | null = null;
  @Input() readingGoal: ReadingGoal | null = null;
  @Input() todayReadingTime: number | null = null;
  @Input() progressPercent: number | null = null;

  // Outputs
  @Output() close = new EventEmitter<void>();
  @Output() settingsChange = new EventEmitter<SettingsState>();
  @Output() chapterSelect = new EventEmitter<TocItem>();
  @Output() bookmarkJump = new EventEmitter<Bookmark>();
  @Output() bookmarkRemove = new EventEmitter<string>();

  // Tab state
  activeTab = signal<TabType>('settings');

  // Zoom dropdown state
  zoomDropdownOpen = signal<boolean>(false);

  // --- Control constraints ---
  readonly FONT_SIZE_MIN = FONT_SIZE_MIN;
  readonly FONT_SIZE_STEP = FONT_SIZE_STEP;
  readonly LINE_HEIGHT_MIN = LINE_HEIGHT_MIN;
  readonly LINE_HEIGHT_STEP = LINE_HEIGHT_STEP;
  readonly FOLLOW_MODE_SPEED_MIN = FOLLOW_MODE_SPEED_MIN;
  readonly FOLLOW_MODE_SPEED_MAX = FOLLOW_MODE_SPEED_MAX;
  readonly FOLLOW_MODE_SPEED_STEP = FOLLOW_MODE_SPEED_STEP;

  /** Available font families */
  readonly fonts = READER_FONTS;

  /** Predefined theme options */
  readonly themeOptions: { label: string; value: ThemeOption }[] = [
    { label: 'Light', value: 'light' },
    { label: 'Dark', value: 'dark' },
    { label: 'Sepia', value: 'sepia' },
  ];

  /** Zoom level options */
  readonly zoomOptions: { label: string; value: ZoomLevel }[] = [
    { label: 'Fit to width', value: 'fit-width' },
    { label: 'Fit to screen', value: 'fit-screen' },
    { label: '100%', value: '100' },
    { label: '200%', value: '200' },
    { label: '300%', value: '300' },
  ];

  /** Page layout options */
  readonly pageLayoutOptions: { label: string; value: PageLayout; icon: string }[] = [
    { label: 'Automatic', value: 'automatic', icon: 'auto' },
    { label: 'Two Page', value: 'two-page', icon: 'two-page' },
    { label: 'One Page', value: 'one-page', icon: 'one-page' },
  ];

  // --- Dragging state ---
  isDragging = false;
  panelX = signal<number | null>(null);
  panelY = signal<number | null>(null);
  private dragOffsetX = 0;
  private dragOffsetY = 0;
  private boundOnDragMove = this.onDragMove.bind(this);
  private boundOnDragEnd = this.onDragEnd.bind(this);

  ngOnDestroy(): void {
    // Clean up any lingering drag listeners
    document.removeEventListener('mousemove', this.boundOnDragMove);
    document.removeEventListener('mouseup', this.boundOnDragEnd);
    document.removeEventListener('touchmove', this.boundOnDragMove);
    document.removeEventListener('touchend', this.boundOnDragEnd);
  }

  // ---------------------------------------------------------------------------
  // Tab management
  // ---------------------------------------------------------------------------

  switchTab(tab: TabType): void {
    this.activeTab.set(tab);
  }

  toggleZoomDropdown(): void {
    this.zoomDropdownOpen.update(v => !v);
  }

  selectZoomLevel(value: ZoomLevel): void {
    this.zoomDropdownOpen.set(false);
    this.updateZoomLevel(value);
  }

  // ---------------------------------------------------------------------------
  // Dragging logic
  // ---------------------------------------------------------------------------

  onDragStart(event: MouseEvent | TouchEvent): void {
    // Disable dragging on mobile (small screens)
    if (window.innerWidth <= 768) {
      return;
    }

    const panel = (event.target as HTMLElement).closest('.unified-panel') as HTMLElement | null;
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
  // Settings controls
  // ---------------------------------------------------------------------------

  increaseFontSize(): void {
    const newSize = this.settings.fontSize + FONT_SIZE_STEP;
    this.emitSettings({ ...this.settings, fontSize: newSize });
  }

  decreaseFontSize(): void {
    if (this.settings.fontSize > FONT_SIZE_MIN) {
      const newSize = this.settings.fontSize - FONT_SIZE_STEP;
      this.emitSettings({ ...this.settings, fontSize: newSize });
    }
  }

  increaseLineHeight(): void {
    const newHeight = Math.round((this.settings.lineHeight + LINE_HEIGHT_STEP) * 10) / 10;
    this.emitSettings({ ...this.settings, lineHeight: newHeight });
  }

  decreaseLineHeight(): void {
    if (this.settings.lineHeight > LINE_HEIGHT_MIN) {
      const newHeight = Math.round((this.settings.lineHeight - LINE_HEIGHT_STEP) * 10) / 10;
      this.emitSettings({ ...this.settings, lineHeight: newHeight });
    }
  }

  updateFontFamily(font: string): void {
    this.emitSettings({ ...this.settings, fontFamily: font });
  }

  updateTheme(value: ThemeOption): void {
    this.emitSettings({ ...this.settings, theme: value });
  }

  updateFlowMode(value: FlowMode): void {
    this.emitSettings({ ...this.settings, flowMode: value });
  }

  updateSpreadMode(value: SpreadMode): void {
    this.emitSettings({ ...this.settings, spreadMode: value });
  }

  updateZoomLevel(value: ZoomLevel): void {
    this.emitSettings({ ...this.settings, zoomLevel: value });
  }

  updatePageLayout(value: PageLayout): void {
    this.emitSettings({ ...this.settings, pageLayout: value });
  }

  /** Label for the currently selected zoom level */
  get currentZoomLabel(): string {
    const opt = this.zoomOptions.find(o => o.value === this.settings.zoomLevel);
    return opt?.label ?? 'Fit to screen';
  }

  toggleFocusMode(): void {
    this.emitSettings({ ...this.settings, focusMode: !this.settings.focusMode });
  }

  toggleFollowMode(): void {
    this.emitSettings({ ...this.settings, followMode: !this.settings.followMode });
  }

  increaseFollowSpeed(): void {
    const newSpeed = Math.min(
      this.settings.followModeSpeed + FOLLOW_MODE_SPEED_STEP,
      FOLLOW_MODE_SPEED_MAX
    );
    this.emitSettings({ ...this.settings, followModeSpeed: newSpeed });
  }

  decreaseFollowSpeed(): void {
    const newSpeed = Math.max(
      this.settings.followModeSpeed - FOLLOW_MODE_SPEED_STEP,
      FOLLOW_MODE_SPEED_MIN
    );
    this.emitSettings({ ...this.settings, followModeSpeed: newSpeed });
  }

  private emitSettings(newSettings: SettingsState): void {
    this.settingsChange.emit(newSettings);
  }

  // ---------------------------------------------------------------------------
  // Chapter controls
  // ---------------------------------------------------------------------------

  onChapterClick(chapter: TocItem): void {
    this.chapterSelect.emit(chapter);
  }

  // ---------------------------------------------------------------------------
  // Bookmark controls
  // ---------------------------------------------------------------------------

  onBookmarkClick(bookmark: Bookmark): void {
    this.bookmarkJump.emit(bookmark);
  }

  onBookmarkRemove(bookmarkId: string, event: Event): void {
    event.stopPropagation();
    this.bookmarkRemove.emit(bookmarkId);
  }

  // ---------------------------------------------------------------------------
  // Close panel
  // ---------------------------------------------------------------------------

  closePanel(): void {
    this.close.emit();
  }

  // ---------------------------------------------------------------------------
  // Utility functions
  // ---------------------------------------------------------------------------

  formatDuration(milliseconds: number): string {
    const totalMinutes = Math.floor(milliseconds / 60000);
    if (totalMinutes < 60) {
      return `${totalMinutes}m`;
    }
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `${hours}h ${minutes}m`;
  }
}
