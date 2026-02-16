import {
  Component,
  Input,
  Output,
  EventEmitter,
  OnChanges,
  SimpleChanges,
  ElementRef,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Bookmark } from '../../../../core/models/document.model';

export interface PdfOutlineItem {
  title: string;
  dest: any;
  items?: PdfOutlineItem[];
}

export type PagesPanelTab = 'contents' | 'pages' | 'bookmarks';

@Component({
  selector: 'app-pages-panel',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './pages-panel.component.html',
  styleUrl: './pages-panel.component.css',
})
export class PagesPanelComponent implements OnChanges {
  @Input() isOpen = false;
  @Input() totalPages = 0;
  @Input() currentPage = 1;
  @Input() pdfDoc: any = null;
  @Input() outline: PdfOutlineItem[] = [];
  @Input() bookmarks: Bookmark[] = [];

  @Output() close = new EventEmitter<void>();
  @Output() pageSelect = new EventEmitter<number>();
  @Output() outlineSelect = new EventEmitter<PdfOutlineItem>();
  @Output() bookmarkSelect = new EventEmitter<Bookmark>();
  @Output() bookmarkRemove = new EventEmitter<string>();

  activeTab = signal<PagesPanelTab>('pages');
  thumbnails = signal<Map<number, string>>(new Map());
  generatingThumbnails = signal<boolean>(false);

  private thumbnailScale = 0.3;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['isOpen'] && this.isOpen && this.pdfDoc && this.thumbnails().size === 0) {
      this.generateThumbnails();
    }
  }

  setTab(tab: PagesPanelTab): void {
    this.activeTab.set(tab);
  }

  closePanel(): void {
    this.close.emit();
  }

  onPageClick(page: number): void {
    this.pageSelect.emit(page);
  }

  onOutlineClick(item: PdfOutlineItem): void {
    this.outlineSelect.emit(item);
  }

  onBookmarkClick(bookmark: Bookmark): void {
    this.bookmarkSelect.emit(bookmark);
  }

  onBookmarkRemove(bookmarkId: string, event: Event): void {
    event.stopPropagation();
    this.bookmarkRemove.emit(bookmarkId);
  }

  private async generateThumbnails(): Promise<void> {
    if (!this.pdfDoc || this.generatingThumbnails()) return;
    this.generatingThumbnails.set(true);

    const thumbMap = new Map<number, string>();
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;

    for (let i = 1; i <= this.totalPages; i++) {
      try {
        const page = await this.pdfDoc.getPage(i);
        const viewport = page.getViewport({ scale: this.thumbnailScale });
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // White background
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        await page.render({ canvasContext: ctx, viewport }).promise;
        thumbMap.set(i, canvas.toDataURL('image/jpeg', 0.6));
      } catch {
        // skip failed thumbnails
      }

      // Update progressively every 5 pages
      if (i % 5 === 0 || i === this.totalPages) {
        this.thumbnails.set(new Map(thumbMap));
      }
    }

    this.generatingThumbnails.set(false);
  }
}
