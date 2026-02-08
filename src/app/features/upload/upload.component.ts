import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Store } from '@ngrx/store';
import { DocumentsActions } from '../../store/documents/documents.actions';

@Component({
  selector: 'app-upload',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="upload-container">
      <input
        type="file"
        accept=".epub,.pdf"
        (change)="onFileSelected($event)"
        #fileInput
        style="display: none"
      />
      <button (click)="fileInput.click()" class="upload-btn">
        Upload Document
      </button>
    </div>
  `,
  styles: [`
    .upload-container {
      padding: 1rem;
    }
    
    .upload-btn {
      padding: 0.75rem 1.5rem;
      background-color: #007bff;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 1rem;
    }
    
    .upload-btn:hover {
      background-color: #0056b3;
    }
  `]
})
export class UploadComponent {
  private store = inject(Store);

  onFileSelected(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (file) {
      this.store.dispatch(DocumentsActions.uploadDocument({ file }));
      // Reset input
      (event.target as HTMLInputElement).value = '';
    }
  }
}
