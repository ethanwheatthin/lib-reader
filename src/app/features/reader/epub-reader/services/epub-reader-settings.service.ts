import { Injectable, signal } from '@angular/core';
import {
  ReaderSettings,
  DEFAULT_READER_SETTINGS,
  ThemeOption,
  FlowMode,
  SpreadMode,
  ZoomLevel,
  PageLayout,
  CustomColorPalette,
  FONT_SIZE_MIN,
  FONT_SIZE_STEP,
  LINE_HEIGHT_MIN,
  LINE_HEIGHT_STEP,
  READER_FONTS,
} from '../../../../core/models/document.model';
import { SettingsState } from '../unified-settings-panel/unified-settings-panel.component';

const STORAGE_KEY = 'epub-reader-settings';

/**
 * Manages all epub reader settings signals and their persistence to localStorage.
 * Provided at the component level so each reader instance gets its own copy.
 */
@Injectable()
export class EpubReaderSettingsService {
  // --- Reader settings signals ---
  fontSize = signal<number>(DEFAULT_READER_SETTINGS.fontSize);
  lineHeight = signal<number>(DEFAULT_READER_SETTINGS.lineHeight);
  fontFamily = signal<string>(DEFAULT_READER_SETTINGS.fontFamily);
  theme = signal<ThemeOption>(DEFAULT_READER_SETTINGS.theme);
  flowMode = signal<FlowMode>(DEFAULT_READER_SETTINGS.flowMode);
  spreadMode = signal<SpreadMode>(DEFAULT_READER_SETTINGS.spreadMode);
  focusMode = signal<boolean>(DEFAULT_READER_SETTINGS.focusMode);
  followMode = signal<boolean>(DEFAULT_READER_SETTINGS.followMode);
  followModeSpeed = signal<number>(DEFAULT_READER_SETTINGS.followModeSpeed);
  zoomLevel = signal<ZoomLevel>(DEFAULT_READER_SETTINGS.zoomLevel);
  pageLayout = signal<PageLayout>(DEFAULT_READER_SETTINGS.pageLayout);
  letterSpacing = signal<number>(DEFAULT_READER_SETTINGS.letterSpacing);
  wordHighlighting = signal<boolean>(DEFAULT_READER_SETTINGS.wordHighlighting);
  bionicReading = signal<boolean>(DEFAULT_READER_SETTINGS.bionicReading);
  customColorPalette = signal<CustomColorPalette | null>(DEFAULT_READER_SETTINGS.customColorPalette);

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

  /** Settings state as a computed object for child components */
  get currentSettings(): SettingsState {
    return {
      fontSize: this.fontSize(),
      lineHeight: this.lineHeight(),
      fontFamily: this.fontFamily(),
      theme: this.theme(),
      flowMode: this.flowMode(),
      spreadMode: this.spreadMode(),
      focusMode: this.focusMode(),
      followMode: this.followMode(),
      followModeSpeed: this.followModeSpeed(),
      zoomLevel: this.zoomLevel(),
      pageLayout: this.pageLayout(),
      letterSpacing: this.letterSpacing(),
      wordHighlighting: this.wordHighlighting(),
      bionicReading: this.bionicReading(),
      customColorPalette: this.customColorPalette(),
    };
  }

  /** Save the current signal values to localStorage */
  saveSettings(): void {
    const settings: ReaderSettings = {
      fontSize: this.fontSize(),
      lineHeight: this.lineHeight(),
      fontFamily: this.fontFamily(),
      theme: this.theme(),
      flowMode: this.flowMode(),
      spreadMode: this.spreadMode(),
      focusMode: this.focusMode(),
      followMode: this.followMode(),
      followModeSpeed: this.followModeSpeed(),
      zoomLevel: this.zoomLevel(),
      pageLayout: this.pageLayout(),
      letterSpacing: this.letterSpacing(),
      wordHighlighting: this.wordHighlighting(),
      bionicReading: this.bionicReading(),
      customColorPalette: this.customColorPalette(),
    };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch {
      console.warn('Could not persist reader settings to localStorage');
    }
  }

  /** Load persisted settings from localStorage into signals */
  loadSettings(): void {
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
        if (saved.followModeSpeed) this.followModeSpeed.set(saved.followModeSpeed);
        if (saved.zoomLevel) this.zoomLevel.set(saved.zoomLevel);
        if (saved.pageLayout) this.pageLayout.set(saved.pageLayout);
        if (saved.letterSpacing != null) this.letterSpacing.set(saved.letterSpacing);
        if (saved.wordHighlighting != null) this.wordHighlighting.set(saved.wordHighlighting);
        if (saved.bionicReading != null) this.bionicReading.set(saved.bionicReading);
        if (saved.customColorPalette !== undefined) this.customColorPalette.set(saved.customColorPalette);
      }
    } catch {
      console.warn('Could not load reader settings from localStorage');
    }
  }

  /** Apply a batch of settings changes from the settings panel */
  applySettingsState(newSettings: SettingsState): void {
    this.fontSize.set(newSettings.fontSize);
    this.lineHeight.set(newSettings.lineHeight);
    this.fontFamily.set(newSettings.fontFamily);
    this.theme.set(newSettings.theme);
    this.flowMode.set(newSettings.flowMode);
    this.spreadMode.set(newSettings.spreadMode);
    this.focusMode.set(newSettings.focusMode);
    this.followMode.set(newSettings.followMode);
    this.followModeSpeed.set(newSettings.followModeSpeed);
    this.zoomLevel.set(newSettings.zoomLevel);
    this.pageLayout.set(newSettings.pageLayout);
    this.letterSpacing.set(newSettings.letterSpacing);
    this.wordHighlighting.set(newSettings.wordHighlighting);
    this.bionicReading.set(newSettings.bionicReading);
    this.customColorPalette.set(newSettings.customColorPalette);
  }
}
