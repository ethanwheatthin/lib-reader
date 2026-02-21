import { Pipe, PipeTransform, inject } from '@angular/core';
import { DocumentApiService } from '../services/document-api.service';

/**
 * Resolves a cover URL that may be a relative API path (e.g., /api/documents/:id/cover)
 * to a full URL using the configured API base.
 *
 * Usage: <img [src]="doc.metadata?.coverUrl | coverUrl" />
 */
@Pipe({
  name: 'coverUrl',
  standalone: true,
})
export class CoverUrlPipe implements PipeTransform {
  private documentApi = inject(DocumentApiService);

  transform(value: string | undefined | null): string | undefined {
    if (!value) return undefined;
    return this.documentApi.getCoverImageUrl(value);
  }
}
