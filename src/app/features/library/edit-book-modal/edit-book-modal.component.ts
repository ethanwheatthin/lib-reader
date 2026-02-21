import { Component, Input, Output, EventEmitter, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { BookMetadata, Document } from '../../../core/models/document.model';
import { OpenLibraryService } from '../../../core/services/open-library.service';
import { DocumentApiService } from '../../../core/services/document-api.service';
import { CoverUrlPipe } from '../../../core/pipes/cover-url.pipe';
import { Subject, Subscription, of } from 'rxjs';
import { debounceTime, distinctUntilChanged, filter, switchMap, tap, catchError } from 'rxjs/operators';

@Component({
  selector: 'app-edit-book-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, CoverUrlPipe],
  templateUrl: './edit-book-modal.component.html',
  styleUrl: './edit-book-modal.component.css'
})
export class EditBookModalComponent implements OnInit, OnDestroy {
  @Input() document!: Document;
  @Output() close = new EventEmitter<void>();
  @Output() save = new EventEmitter<{ metadata: BookMetadata; coverFile?: File }>();

  private openLibraryService = inject(OpenLibraryService);
  private documentApi = inject(DocumentApiService);

  metadata: BookMetadata = {};
  searchResults: BookMetadata[] = [];
  isSearching = false;
  showSearchResults = false;
  hasSearched = false;

  /** Locally selected cover image file (not yet uploaded) */
  coverFile: File | null = null;
  /** Data URL preview of the selected cover file */
  coverPreviewUrl: string | null = null;

  // the query typed into the search box (separate from the editable metadata.title)
  searchQuery = '';
  private titleSearch$ = new Subject<string>();
  private titleSearchSub?: Subscription;
  private originalMetadata: BookMetadata = {};

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

    // keep a copy to allow "Cancel" to revert edits
    this.originalMetadata = { ...this.metadata };
    this.searchQuery = this.metadata.title || '';

    // set up dynamic search stream
    this.titleSearchSub = this.titleSearch$.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      tap((q) => {
        if (!q?.trim()) {
          this.searchResults = [];
          this.showSearchResults = false;
          this.isSearching = false;
        }
      }),
      filter((q) => !!q?.trim()),
      tap(() => {
        this.isSearching = true;
        console.log(`[EditBookModal] Searching Open Library for: "${this.searchQuery}"`);
      }),
      switchMap((q) =>
        this.openLibraryService.searchByTitle(q).pipe(
          catchError((err) => {
            console.error('[EditBookModal] Search failed:', err);
            return of([]);
          })
        )
      )
    ).subscribe((results) => {
      console.log(`[EditBookModal] Search returned ${results.length} result(s)`, results);
      this.searchResults = results;
      this.showSearchResults = results.length > 0;
      this.hasSearched = true;
      this.isSearching = false;
    });
  }

  // called when the search input changes (dynamic search)
  onSearchQueryChange(query: string): void {
    this.searchQuery = query;
    this.titleSearch$.next(query);
  }

  // manual search button still triggers a search
  searchByTitle(): void {
    if (!this.searchQuery?.trim()) return;
    this.titleSearch$.next(this.searchQuery);
  }

  selectSearchResult(result: BookMetadata): void {
    this.metadata = { ...result };
    this.searchQuery = result.title || '';
    this.searchResults = [];
    this.showSearchResults = false;
    // Clear any locally selected cover file when picking a search result
    this.coverFile = null;
    this.coverPreviewUrl = null;
  }

  /** Handle cover image file selection */
  onCoverFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.coverFile = input.files[0];
      // Generate preview
      const reader = new FileReader();
      reader.onload = () => {
        this.coverPreviewUrl = reader.result as string;
      };
      reader.readAsDataURL(this.coverFile);
      // Clear the URL field since we're using a file
      this.metadata.coverUrl = '';
    }
  }

  /** Remove the selected cover file */
  removeCoverFile(): void {
    this.coverFile = null;
    this.coverPreviewUrl = null;
  }

  /** Get the resolved cover URL for display */
  getResolvedCoverUrl(): string | undefined {
    return this.documentApi.getCoverImageUrl(this.metadata.coverUrl);
  }

  onSave(): void {
    this.save.emit({ metadata: this.metadata, coverFile: this.coverFile || undefined });
  }

  onCancel(): void {
    // revert any changes but keep modal open
    this.metadata = { ...this.originalMetadata };
    this.searchQuery = this.metadata.title || '';
    this.searchResults = [];
    this.showSearchResults = false;
    this.hasSearched = false;
    this.isSearching = false;
  }

  onClose(): void {
    // Only the top-left close button should close the modal
    this.close.emit();
  }

  ngOnDestroy(): void {
    this.titleSearchSub?.unsubscribe();
  }
}
