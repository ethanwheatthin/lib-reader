import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Store } from '@ngrx/store';
import { Observable } from 'rxjs';
import { Document } from '../../core/models/document.model';
import { selectAllDocuments, selectLoading } from '../../store/documents/documents.selectors';
import { DocumentsActions } from '../../store/documents/documents.actions';
import { UploadComponent } from '../upload/upload.component';

@Component({
  selector: 'app-library',
  standalone: true,
  imports: [CommonModule, UploadComponent],
  template: `
    <div class="library-container">
      <h1>My Library</h1>
      <app-upload></app-upload>
      
      @if (loading$ | async) {
        <p>Loading...</p>
      }
      
      <div class="library-grid">
        @for (doc of documents$ | async; track doc.id) {
          <div class="document-card">
            <div class="document-icon">
              {{ doc.type === 'epub' ? '📖' : '📄' }}
            </div>
            <h3>{{ doc.title }}</h3>
            <p class="doc-type">{{ doc.type | uppercase }}</p>
            <p class="doc-size">{{ formatFileSize(doc.fileSize) }}</p>
            @if (doc.lastOpened) {
              <p class="doc-progress">
                Last opened: {{ formatDate(doc.lastOpened) }}
                @if (doc.currentPage && doc.totalPages) {
                  <br>Page {{ doc.currentPage }} / {{ doc.totalPages }}
                }
              </p>
            }
            <div class="card-actions">
              <button (click)="openDocument(doc.id)" class="btn-primary">Open</button>
              <button (click)="deleteDocument(doc.id)" class="btn-danger">Delete</button>
            </div>
          </div>
        } @empty {
          <p class="empty-state">No documents yet. Upload one to get started!</p>
        }
      </div>
    </div>
  `,
  styles: [`
    .library-container {
      padding: 2rem;
      max-width: 1200px;
      margin: 0 auto;
    }
    
    h1 {
      margin-bottom: 1.5rem;
    }
    
    .library-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
      gap: 1.5rem;
      margin-top: 2rem;
    }
    
    .document-card {
      border: 1px solid #ddd;
      border-radius: 8px;
      padding: 1.5rem;
      background: white;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      transition: transform 0.2s, box-shadow 0.2s;
    }
    
    .document-card:hover {
      transform: translateY(-4px);
      box-shadow: 0 4px 8px rgba(0,0,0,0.15);
    }
    
    .document-icon {
      font-size: 3rem;
      text-align: center;
      margin-bottom: 1rem;
    }
    
    .document-card h3 {
      margin: 0.5rem 0;
      font-size: 1.1rem;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    
    .doc-type {
      color: #666;
      font-weight: bold;
      margin: 0.25rem 0;
    }
    
    .doc-size, .doc-progress {
      color: #888;
      font-size: 0.9rem;
      margin: 0.25rem 0;
    }
    
    .card-actions {
      display: flex;
      gap: 0.5rem;
      margin-top: 1rem;
    }
    
    button {
      flex: 1;
      padding: 0.5rem;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 0.9rem;
    }
    
    .btn-primary {
      background-color: #007bff;
      color: white;
    }
    
    .btn-primary:hover {
      background-color: #0056b3;
    }
    
    .btn-danger {
      background-color: #dc3545;
      color: white;
    }
    
    .btn-danger:hover {
      background-color: #c82333;
    }
    
    .empty-state {
      grid-column: 1 / -1;
      text-align: center;
      color: #888;
      padding: 3rem;
      font-size: 1.1rem;
    }
    
    @media (max-width: 768px) {
      .library-container {
        padding: 1rem;
      }
      
      .library-grid {
        grid-template-columns: 1fr;
      }
    }
  `]
})
export class LibraryComponent implements OnInit {
  private store = inject(Store);
  private router = inject(Router);
  
  documents$: Observable<Document[]> = this.store.select(selectAllDocuments);
  loading$: Observable<boolean> = this.store.select(selectLoading);

  ngOnInit(): void {
    this.store.dispatch(DocumentsActions.loadDocuments());
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
}
