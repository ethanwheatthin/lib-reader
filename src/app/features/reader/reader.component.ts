import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { Store } from '@ngrx/store';
import { Observable } from 'rxjs';
import { Document } from '../../core/models/document.model';
import { selectSelectedDocument } from '../../store/documents/documents.selectors';
import { DocumentsActions } from '../../store/documents/documents.actions';
import { EpubReaderComponent } from './epub-reader/epub-reader.component';
import { PdfReaderComponent } from './pdf-reader/pdf-reader.component';

@Component({
  selector: 'app-reader',
  standalone: true,
  imports: [CommonModule, EpubReaderComponent, PdfReaderComponent],
  template: `
    <div class="reader-container">
      <div class="reader-header">
        <button (click)="goBack()" class="back-btn">← Back to Library</button>
        @if (document$ | async; as doc) {
          <h2>{{ doc.title }}</h2>
        }
      </div>
      
      @if (document$ | async; as doc) {
        @if (doc.type === 'epub') {
          <app-epub-reader [documentId]="doc.id"></app-epub-reader>
        } @else {
          <app-pdf-reader [documentId]="doc.id"></app-pdf-reader>
        }
      } @else {
        <p>Loading document...</p>
      }
    </div>
  `,
  styles: [`
    .reader-container {
      height: 100vh;
      display: flex;
      flex-direction: column;
    }
    
    .reader-header {
      background: #f8f9fa;
      padding: 1rem 2rem;
      border-bottom: 1px solid #ddd;
      display: flex;
      align-items: center;
      gap: 1rem;
    }
    
    .back-btn {
      padding: 0.5rem 1rem;
      background: #6c757d;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
    }
    
    .back-btn:hover {
      background: #5a6268;
    }
    
    .reader-header h2 {
      margin: 0;
      font-size: 1.5rem;
    }
    
    @media (max-width: 768px) {
      .reader-header {
        padding: 0.75rem 1rem;
      }
      
      .reader-header h2 {
        font-size: 1.2rem;
      }
    }
  `]
})
export class ReaderComponent implements OnInit {
  private store = inject(Store);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  
  document$: Observable<Document | null | undefined> = this.store.select(selectSelectedDocument);

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.store.dispatch(DocumentsActions.openDocument({ id }));
    }
  }

  goBack(): void {
    this.router.navigate(['/library']);
  }
}
