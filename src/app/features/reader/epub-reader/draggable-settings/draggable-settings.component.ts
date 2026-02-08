import { Component, Input, Output, EventEmitter, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ThemeOption, READER_FONTS, FONT_SIZE_MIN, FONT_SIZE_STEP, LINE_HEIGHT_MIN, LINE_HEIGHT_STEP } from '../../../../core/models/document.model';

export interface SettingsState {
  fontSize: number;
  lineHeight: number;
  fontFamily: string;
  theme: ThemeOption;
}

@Component({
  selector: 'app-draggable-settings',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './draggable-settings.component.html',
  styleUrl: './draggable-settings.component.css'
})
export class DraggableSettingsComponent {
  @Input() settings!: SettingsState;
  @Input() theme: ThemeOption = 'light';
  @Input() isOpen = false;

  @Output() settingsChange = new EventEmitter<SettingsState>();
  @Output() close = new EventEmitter<void>();

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

  ngOnDestroy(): void {
    // Clean up any lingering drag listeners
    document.removeEventListener('mousemove', this.boundOnDragMove);
    document.removeEventListener('mouseup', this.boundOnDragEnd);
    document.removeEventListener('touchmove', this.boundOnDragMove);
    document.removeEventListener('touchend', this.boundOnDragEnd);
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

  resetToDefaults(): void {
    this.emitSettings({
      fontSize: 18,
      lineHeight: 1.6,
      fontFamily: 'Georgia',
      theme: 'light'
    });
  }

  closePanel(): void {
    this.panelX.set(null);
    this.panelY.set(null);
    this.close.emit();
  }

  private emitSettings(newSettings: SettingsState): void {
    this.settingsChange.emit(newSettings);
  }
}
