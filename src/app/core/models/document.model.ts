export interface Document {
  id: string;
  title: string;
  type: 'epub' | 'pdf';
  fileSize: number;
  uploadDate: Date;
  lastOpened?: Date;
  currentPage?: number;
  totalPages?: number;
}

export type ThemeOption = 'light' | 'dark' | 'sepia';

export interface ReaderSettings {
  fontSize: number;
  /** Horizontal padding in pixels */
  margin: number;
  lineHeight: number;
  theme: ThemeOption;
}

export const DEFAULT_READER_SETTINGS: ReaderSettings = {
  fontSize: 16,
  margin: 40,
  lineHeight: 1.6,
  theme: 'light',
};

/** Slider constraints */
export const FONT_SIZE_MIN = 12;
export const FONT_SIZE_MAX = 28;
export const FONT_SIZE_STEP = 1;

export const MARGIN_MIN = 0;
export const MARGIN_MAX = 120;
export const MARGIN_STEP = 4;

export const LINE_HEIGHT_MIN = 1.0;
export const LINE_HEIGHT_MAX = 2.5;
export const LINE_HEIGHT_STEP = 0.1;

/** Named presets for quick-select */
export interface ReaderPreset {
  label: string;
  icon: string;
  settings: Omit<ReaderSettings, 'theme'>;
}

export const READER_PRESETS: ReaderPreset[] = [
  { label: 'Compact', icon: '📐', settings: { fontSize: 14, margin: 16, lineHeight: 1.2 } },
  { label: 'Comfortable', icon: '📖', settings: { fontSize: 16, margin: 40, lineHeight: 1.6 } },
  { label: 'Spacious', icon: '🌿', settings: { fontSize: 20, margin: 80, lineHeight: 2.0 } },
];
