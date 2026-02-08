import { Component, Input, Output, EventEmitter, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { BookMetadata, Document } from '../../../core/models/document.model';
import { OpenLibraryService } from '../../../core/services/open-library.service';

@Component({
  selector: 'app-edit-book-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './edit-book-modal.component.html',
  styleUrl: './edit-book-modal.component.css'
})
export class EditBookModalComponent implements OnInit {
  @Input() document!: Document;
  @Output() close = new EventEmitter<void>();
  @Output() save = new EventEmitter<BookMetadata>();

  private openLibraryService = inject(OpenLibraryService);

  metadata: BookMetadata = {};
  searchResults: BookMetadata[] = [];
  isSearching = false;
  showSearchResults = false;

  ngOnInit(): void {
    // Initialize with existing metadata or defaults
    this.metadata = {
      title: this.document.metadata?.title || this.document.title,
      author: this.document.metadata?.author || '',
      publisher: this.document.metadata?.publisher || '',
      publishYear: this.document.metadata?.publishYear || '',
      isbn: this.document.metadata?.isbn || '',
      coverUrl: this.document.metadata?.coverUrl || '',
      description: this.document.metadata?.description || '',
      pageCount: this.document.metadata?.pageCount || this.document.totalPages,
      subjects: this.document.metadata?.subjects || [],
      openLibraryKey: this.document.metadata?.openLibraryKey
    };
  }

  searchByTitle(): void {
    if (!this.metadata.title?.trim()) return;

    this.isSearching = true;
    this.openLibraryService.searchByTitle(this.metadata.title).subscribe({
      next: (results) => {
        this.searchResults = results;
        this.showSearchResults = results.length > 0;
        this.isSearching = false;
      },
      error: () => {
        this.isSearching = false;
      }
    });
  }

  selectSearchResult(result: BookMetadata): void {
    this.metadata = { ...result };
    this.showSearchResults = false;
  }

  onSave(): void {
    this.save.emit(this.metadata);
  }

  onClose(): void {
    this.close.emit();
  }

  onBackdropClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      this.onClose();
    }
  }
}
