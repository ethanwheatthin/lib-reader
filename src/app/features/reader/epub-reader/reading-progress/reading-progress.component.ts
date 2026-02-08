import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-reading-progress',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './reading-progress.component.html',
  styleUrl: './reading-progress.component.css'
})
export class ReadingProgressComponent {
  @Input() progress: number | null = 0;
  @Input() theme: 'light' | 'dark' | 'sepia' = 'light';
}
