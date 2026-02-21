import { Component, inject, Output, EventEmitter, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  FilesystemApiService,
  DirEntry,
  BrowseResult,
} from '../../../../core/services/filesystem-api.service';

@Component({
  selector: 'app-dir-picker',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './dir-picker.component.html',
  styleUrl: './dir-picker.component.css',
})
export class DirPickerComponent implements OnInit {
  private fsApi = inject(FilesystemApiService);

  /** Emits the chosen directory path */
  @Output() pathSelected = new EventEmitter<string>();
  /** Emits when the picker is dismissed */
  @Output() cancelled = new EventEmitter<void>();

  currentPath = '';
  parentPath: string | null = null;
  entries: DirEntry[] = [];
  loading = false;
  error: string | null = null;

  /** Manual path input (address bar) */
  addressBar = '';

  ngOnInit(): void {
    this.browse(); // load root
  }

  browse(dir?: string): void {
    this.loading = true;
    this.error = null;
    this.fsApi.browse(dir).subscribe({
      next: (result: BrowseResult) => {
        this.currentPath = result.current;
        this.parentPath = result.parent;
        this.entries = result.entries;
        this.addressBar = result.current;
        this.loading = false;
      },
      error: (err) => {
        this.error = err?.error?.error?.message || 'Failed to browse directory';
        this.loading = false;
      },
    });
  }

  navigateTo(entry: DirEntry): void {
    if (entry.isDirectory) {
      this.browse(entry.path);
    }
  }

  goUp(): void {
    if (this.parentPath !== null) {
      this.browse(this.parentPath);
    } else {
      this.browse(); // go to root
    }
  }

  goToAddress(): void {
    const trimmed = this.addressBar.trim();
    if (trimmed) {
      this.browse(trimmed);
    }
  }

  selectCurrent(): void {
    if (this.currentPath) {
      this.pathSelected.emit(this.currentPath);
    }
  }

  cancel(): void {
    this.cancelled.emit();
  }

  get dirEntries(): DirEntry[] {
    return this.entries.filter((e) => e.isDirectory);
  }

  get fileEntries(): DirEntry[] {
    return this.entries.filter((e) => !e.isDirectory);
  }

  formatSize(bytes?: number): string {
    if (bytes == null) return '';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }
}
