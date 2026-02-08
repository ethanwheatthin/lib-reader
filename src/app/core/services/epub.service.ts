import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class EpubService {
  async extractMetadata(file: File): Promise<{ title: string; totalPages?: number }> {
    // Basic metadata extraction - can be enhanced
    const title = file.name.replace('.epub', '');
    return { title };
  }
}
