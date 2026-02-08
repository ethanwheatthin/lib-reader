import { Component, Input, inject, OnInit, OnDestroy, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Store } from '@ngrx/store';
import ePub from 'epubjs';
import { IndexDBService } from '../../../core/services/indexdb.service';
import { DocumentsActions } from '../../../store/documents/documents.actions';

@Component({
  selector: 'app-epub-reader',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="epub-container">
      <div class="reader-controls">
        <button (click)="prevPage()" [disabled]="!canGoPrev">Previous</button>
        <span class="page-info">{{ currentLocation }}</span>
        <button (click)="nextPage()" [disabled]="!canGoNext">Next</button>
      </div>
      <div #viewer class="epub-viewer"></div>
    </div>
  `,
  styles: [`
    .epub-container {
      flex: 1;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }
    
    .reader-controls {
      display: flex;
      justify-content: center;
      align-items: center;
      gap: 1rem;
      padding: 1rem;
      background: #f8f9fa;
      border-bottom: 1px solid #ddd;
    }
    
    .reader-controls button {
      padding: 0.5rem 1.5rem;
      background: #007bff;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
    }
    
    .reader-controls button:hover:not(:disabled) {
      background: #0056b3;
    }
    
    .reader-controls button:disabled {
      background: #ccc;
      cursor: not-allowed;
    }
    
    .page-info {
      min-width: 200px;
      text-align: center;
    }
    
    .epub-viewer {
      flex: 1;
      overflow: hidden;
      background: white;
    }
    
    @media (max-width: 768px) {
      .reader-controls {
        padding: 0.5rem;
        gap: 0.5rem;
      }
      
      .reader-controls button {
        padding: 0.5rem 1rem;
        font-size: 0.9rem;
      }
      
      .page-info {
        min-width: 100px;
        font-size: 0.9rem;
      }
    }
  `]
})
export class EpubReaderComponent implements OnInit, OnDestroy {
  @Input() documentId!: string;
  @ViewChild('viewer', { static: true }) viewer!: ElementRef;
  
  private store = inject(Store);
  private indexDB = inject(IndexDBService);
  private book: any;
  private rendition: any;
  
  currentLocation = '';
  canGoPrev = false;
  canGoNext = true;

  async ngOnInit(): Promise<void> {
    try {
      const blob = await this.indexDB.getFile(this.documentId);
      if (blob) {
        const arrayBuffer = await blob.arrayBuffer();
        this.book = ePub(arrayBuffer);
        
        this.rendition = this.book.renderTo(this.viewer.nativeElement, {
          width: '100%',
          height: '100%',
          spread: 'none',
          allowScriptedContent: true
        });
        
        await this.rendition.display();
        
        // Track location changes
        this.rendition.on('relocated', (location: any) => {
          this.updateLocation(location);
        });
      }
    } catch (error) {
      console.error('Error loading EPUB:', error);
    }
  }

  ngOnDestroy(): void {
    if (this.rendition) {
      this.rendition.destroy();
    }
  }

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

  private updateLocation(location: any): void {
    this.currentLocation = location.start.displayed.page 
      ? `Page ${location.start.displayed.page} of ${location.start.displayed.total}`
      : 'Reading...';
    
    this.canGoPrev = !location.atStart;
    this.canGoNext = !location.atEnd;
    
    // Save progress
    if (location.start.displayed.page) {
      this.store.dispatch(
        DocumentsActions.updateReadingProgress({
          id: this.documentId,
          page: location.start.displayed.page
        })
      );
    }
  }
}
