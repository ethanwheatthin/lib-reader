import { Component, inject, OnInit, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Store } from '@ngrx/store';
import { Observable, map, combineLatest, BehaviorSubject } from 'rxjs';
import { Document, BookMetadata } from '../../core/models/document.model';
import { selectAllDocuments, selectLoading } from '../../store/documents/documents.selectors';
import { DocumentsActions } from '../../store/documents/documents.actions';
import { UploadComponent } from '../upload/upload.component';
import { EditBookModalComponent } from './edit-book-modal/edit-book-modal.component';

@Component({
  selector: 'app-library',
  standalone: true,
  imports: [CommonModule, FormsModule, UploadComponent, EditBookModalComponent],
  templateUrl: './library.component.html',
  styleUrl: './library.component.css'
})
export class LibraryComponent implements OnInit {
  private store = inject(Store);
  private router = inject(Router);
  
  documents$: Observable<Document[]> = this.store.select(selectAllDocuments);
  loading$: Observable<boolean> = this.store.select(selectLoading);
  
  editingDocument: Document | null = null;
  
  // New UI state
  searchQuery = '';
  viewMode: 'grid' | 'list' = 'grid';
  sortBy: 'recent' | 'progress' = 'recent';
  shelvesExpanded = true;
  openMenuId: string | null = null;
  
  private searchQuery$ = new BehaviorSubject<string>('');
  
  filteredDocuments$: Observable<Document[]> = combineLatest([
    this.documents$,
    this.searchQuery$
  ]).pipe(
    map(([docs, query]) => {
      if (!query.trim()) return docs;
      const q = query.toLowerCase();
      return docs.filter(d => 
        d.title.toLowerCase().includes(q) ||
        (d.metadata?.author?.toLowerCase().includes(q))
      );
    })
  );

  @HostListener('document:click')
  onDocumentClick(): void {
    this.openMenuId = null;
  }

  ngOnInit(): void {
    this.store.dispatch(DocumentsActions.loadDocuments());
  }

  onSearchChange(): void {
    this.searchQuery$.next(this.searchQuery);
  }

  toggleMenu(id: string, event: Event): void {
    event.stopPropagation();
    this.openMenuId = this.openMenuId === id ? null : id;
  }

  openDocument(id: string): void {
    this.router.navigate(['/reader', id]);
  }

  deleteDocument(id: string): void {
    if (confirm('Are you sure you want to delete this document?')) {
      this.store.dispatch(DocumentsActions.deleteDocument({ id }));
    }
  }

  formatFileSize(bytes: number): string {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  formatDate(date: Date): string {
    return new Date(date).toLocaleDateString();
  }

  getProgress(doc: Document): number {
    if (!doc.currentPage || !doc.totalPages || doc.totalPages === 0) return 0;
    return Math.round((doc.currentPage / doc.totalPages) * 100);
  }

  formatDuration(ms: number): string {
    const totalMinutes = Math.floor(ms / 60000);
    if (totalMinutes < 60) return `${totalMinutes}m`;
    const hours = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    return `${hours}h ${mins}m`;
  }

  openEditModal(doc: Document, event: Event): void {
    event.stopPropagation();
    this.editingDocument = doc;
  }

  closeEditModal(): void {
    this.editingDocument = null;
  }

  saveMetadata(metadata: BookMetadata): void {
    if (this.editingDocument) {
      this.store.dispatch(DocumentsActions.updateBookMetadata({ 
        id: this.editingDocument.id, 
        metadata 
      }));
      this.editingDocument = null;
    }
  }

  fetchMetadata(doc: Document, event: Event): void {
    event.stopPropagation();
    this.store.dispatch(DocumentsActions.fetchMetadataFromOpenLibrary({ 
      id: doc.id, 
      title: doc.title 
    }));
  }

  getCoverImage(doc: Document): string | null {
    return doc.metadata?.coverUrl || null;
  }

  getAuthor(doc: Document): string {
    return doc.metadata?.author || 'Unknown Author';
  }
}
