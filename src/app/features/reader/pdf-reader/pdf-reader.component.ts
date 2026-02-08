import { Component, Input, inject, OnInit, OnDestroy, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Store } from '@ngrx/store';
import * as pdfjsLib from 'pdfjs-dist';
import { IndexDBService } from '../../../core/services/indexdb.service';
import { DocumentsActions } from '../../../store/documents/documents.actions';

@Component({
  selector: 'app-pdf-reader',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="pdf-container">
      <div class="reader-controls">
        <button (click)="prevPage()" [disabled]="currentPage <= 1">Previous</button>
        <span>Page {{ currentPage }} / {{ totalPages }}</span>
        <button (click)="nextPage()" [disabled]="currentPage >= totalPages">Next</button>
        <select [(ngModel)]="scale" (change)="onScaleChange()" class="scale-select">
          <option [value]="0.5">50%</option>
          <option [value]="0.75">75%</option>
          <option [value]="1">100%</option>
          <option [value]="1.25">125%</option>
          <option [value]="1.5">150%</option>
          <option [value]="2">200%</option>
        </select>
      </div>
      <div class="canvas-wrapper">
        <canvas #pdfCanvas></canvas>
      </div>
    </div>
  `,
  styles: [`
    .pdf-container {
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
    
    .scale-select {
      padding: 0.5rem;
      border: 1px solid #ddd;
      border-radius: 4px;
    }
    
    .canvas-wrapper {
      flex: 1;
      overflow: auto;
      background: #525659;
      display: flex;
      justify-content: center;
      padding: 2rem;
    }
    
    canvas {
      box-shadow: 0 4px 8px rgba(0,0,0,0.3);
      background: white;
    }
    
    @media (max-width: 768px) {
      .reader-controls {
        padding: 0.5rem;
        gap: 0.5rem;
        flex-wrap: wrap;
      }
      
      .reader-controls button {
        padding: 0.5rem 1rem;
        font-size: 0.9rem;
      }
      
      .canvas-wrapper {
        padding: 0.5rem;
      }
    }
  `]
})
export class PdfReaderComponent implements OnInit, OnDestroy {
  @Input() documentId!: string;
  @ViewChild('pdfCanvas', { static: true }) canvas!: ElementRef<HTMLCanvasElement>;
  
  private store = inject(Store);
  private indexDB = inject(IndexDBService);
  private pdfDoc: any;
  
  currentPage = 1;
  totalPages = 0;
  scale = 1.5;

  async ngOnInit(): Promise<void> {
    // Set worker path - needs to point to the worker file in node_modules
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;
    
    try {
      const blob = await this.indexDB.getFile(this.documentId);
      if (blob) {
        const arrayBuffer = await blob.arrayBuffer();
        this.pdfDoc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        this.totalPages = this.pdfDoc.numPages;
        
        // Load saved page or start at page 1
        const metadata = await this.indexDB.getMetadata(this.documentId);
        if (metadata?.currentPage) {
          this.currentPage = metadata.currentPage;
        }
        
        await this.renderPage(this.currentPage);
      }
    } catch (error) {
      console.error('Error loading PDF:', error);
    }
  }

  ngOnDestroy(): void {
    if (this.pdfDoc) {
      this.pdfDoc.destroy();
    }
  }

  async renderPage(pageNum: number): Promise<void> {
    try {
      const page = await this.pdfDoc.getPage(pageNum);
      const viewport = page.getViewport({ scale: this.scale });
      const canvas = this.canvas.nativeElement;
      const context = canvas.getContext('2d')!;
      
      canvas.height = viewport.height;
      canvas.width = viewport.width;
      
      await page.render({ canvasContext: context, viewport }).promise;
    } catch (error) {
      console.error('Error rendering page:', error);
    }
  }

  async nextPage(): Promise<void> {
    if (this.currentPage < this.totalPages) {
      this.currentPage++;
      await this.renderPage(this.currentPage);
      this.updateProgress();
    }
  }

  async prevPage(): Promise<void> {
    if (this.currentPage > 1) {
      this.currentPage--;
      await this.renderPage(this.currentPage);
      this.updateProgress();
    }
  }

  async onScaleChange(): Promise<void> {
    await this.renderPage(this.currentPage);
  }

  private updateProgress(): void {
    this.store.dispatch(
      DocumentsActions.updateReadingProgress({
        id: this.documentId,
        page: this.currentPage
      })
    );
  }
}
