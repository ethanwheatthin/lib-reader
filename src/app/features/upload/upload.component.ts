import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Store } from '@ngrx/store';
import { Observable } from 'rxjs';
import { DocumentsActions } from '../../store/documents/documents.actions';
import { LibrarySourcesActions } from '../../store/library-sources/library-sources.actions';
import {
  selectAllLibrarySources,
  selectLibrarySourcesLoading,
  selectScanningSourceId,
} from '../../store/library-sources/library-sources.selectors';
import { LibrarySource } from '../../core/models/library-source.model';
import { DirPickerComponent } from '../library/components/dir-picker/dir-picker.component';

@Component({
  selector: 'app-upload',
  standalone: true,
  imports: [CommonModule, FormsModule, DirPickerComponent],
  templateUrl: './upload.component.html',
  styleUrl: './upload.component.css',
})
export class UploadComponent implements OnInit {
  private store = inject(Store);

  // Library Sources state
  sources$: Observable<LibrarySource[]> = this.store.select(selectAllLibrarySources);
  sourcesLoading$: Observable<boolean> = this.store.select(selectLibrarySourcesLoading);
  scanningSourceId$: Observable<string | null> = this.store.select(selectScanningSourceId);

  // Modal / form state
  showSourcesPanel = false;
  showCreateForm = false;
  newSourceName = '';
  newSourcePaths: string[] = [''];

  // Edit state
  editingSourceId: string | null = null;
  editName = '';
  editPaths: string[] = [];

  // Directory picker state
  showDirPicker = false;
  /** Which path index the picker is filling — for create vs edit */
  pickerTargetIndex: number = -1;
  pickerMode: 'create' | 'edit' = 'create';

  ngOnInit(): void {
    this.store.dispatch(LibrarySourcesActions.loadSources());
  }

  // --- File upload ---
  onFileSelected(event: Event): void {
    const files = (event.target as HTMLInputElement).files;
    if (files && files.length > 0) {
      const fileArray = Array.from(files);
      this.store.dispatch(DocumentsActions.uploadDocuments({ files: fileArray }));
      (event.target as HTMLInputElement).value = '';
    }
  }

  // --- Sources panel ---
  toggleSourcesPanel(): void {
    this.showSourcesPanel = !this.showSourcesPanel;
    if (this.showSourcesPanel) {
      this.store.dispatch(LibrarySourcesActions.loadSources());
    }
  }

  // --- Create form ---
  openCreateForm(): void {
    this.showCreateForm = true;
    this.newSourceName = '';
    this.newSourcePaths = [''];
    this.editingSourceId = null;
  }

  cancelCreateForm(): void {
    this.showCreateForm = false;
    this.editingSourceId = null;
  }

  addPathField(): void {
    if (this.editingSourceId) {
      this.editPaths.push('');
    } else {
      this.newSourcePaths.push('');
    }
  }

  removePathField(index: number): void {
    if (this.editingSourceId) {
      if (this.editPaths.length > 1) this.editPaths.splice(index, 1);
    } else {
      if (this.newSourcePaths.length > 1) this.newSourcePaths.splice(index, 1);
    }
  }

  createSource(): void {
    const paths = this.newSourcePaths.map((p) => p.trim()).filter((p) => p.length > 0);
    if (!this.newSourceName.trim() || paths.length === 0) return;

    this.store.dispatch(
      LibrarySourcesActions.createSource({
        name: this.newSourceName.trim(),
        paths,
      })
    );
    this.showCreateForm = false;
  }

  // --- Edit ---
  startEdit(source: LibrarySource): void {
    this.editingSourceId = source.id;
    this.editName = source.name;
    this.editPaths = source.paths.map((p) => p.path);
    this.showCreateForm = false;
  }

  cancelEdit(): void {
    this.editingSourceId = null;
  }

  saveEdit(): void {
    if (!this.editingSourceId) return;
    const paths = this.editPaths.map((p) => p.trim()).filter((p) => p.length > 0);
    if (!this.editName.trim() || paths.length === 0) return;

    this.store.dispatch(
      LibrarySourcesActions.updateSource({
        id: this.editingSourceId,
        changes: { name: this.editName.trim(), paths },
      })
    );
    this.editingSourceId = null;
  }

  // --- Delete ---
  deleteSource(id: string, event: Event): void {
    event.stopPropagation();
    this.store.dispatch(LibrarySourcesActions.deleteSource({ id }));
    if (this.editingSourceId === id) this.editingSourceId = null;
  }

  // --- Scan ---
  scanSource(id: string, event: Event): void {
    event.stopPropagation();
    this.store.dispatch(LibrarySourcesActions.scanSource({ id }));
  }

  // --- Polling toggle ---
  togglePolling(source: LibrarySource, event: Event): void {
    event.stopPropagation();
    this.store.dispatch(
      LibrarySourcesActions.updateSource({
        id: source.id,
        changes: { pollingEnabled: !source.pollingEnabled },
      })
    );
  }

  // --- Directory picker ---
  openDirPicker(index: number, mode: 'create' | 'edit'): void {
    this.pickerTargetIndex = index;
    this.pickerMode = mode;
    this.showDirPicker = true;
  }

  onPathPicked(selectedPath: string): void {
    if (this.pickerMode === 'edit') {
      this.editPaths[this.pickerTargetIndex] = selectedPath;
    } else {
      this.newSourcePaths[this.pickerTargetIndex] = selectedPath;
    }
    this.showDirPicker = false;
  }

  onPickerCancelled(): void {
    this.showDirPicker = false;
  }

  trackByPath(index: number): number {
    return index;
  }

  trackBySourceId(_index: number, source: LibrarySource): string {
    return source.id;
  }
}
