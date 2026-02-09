import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { DEFAULT_SHELF_COLORS } from '../../../core/models/shelf.model';

@Component({
  selector: 'app-create-shelf-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, MatDialogModule, MatButtonModule],
  templateUrl: './create-shelf-modal.component.html',
  styleUrl: './create-shelf-modal.component.css'
})
export class CreateShelfModalComponent {
  private dialogRef = inject(MatDialogRef<CreateShelfModalComponent>);

  shelfName = '';
  selectedColor = DEFAULT_SHELF_COLORS[0];
  availableColors = DEFAULT_SHELF_COLORS;

  onSubmit(): void {
    if (this.shelfName.trim()) {
      this.dialogRef.close({
        name: this.shelfName.trim(),
        color: this.selectedColor
      });
    }
  }

  onCancel(): void {
    this.dialogRef.close();
  }

  selectColor(color: string): void {
    this.selectedColor = color;
  }
}
