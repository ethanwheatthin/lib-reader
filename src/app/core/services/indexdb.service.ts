import { Injectable } from '@angular/core';
import localforage from 'localforage';
import { Document } from '../models/document.model';

@Injectable({ providedIn: 'root' })
export class IndexDBService {
  private filesStore = localforage.createInstance({
    name: 'epub-pdf-reader',
    storeName: 'documents'
  });

  private metadataStore = localforage.createInstance({
    name: 'epub-pdf-reader',
    storeName: 'metadata'
  });

  async saveFile(id: string, blob: Blob): Promise<void> {
    await this.filesStore.setItem(id, blob);
  }

  async getFile(id: string): Promise<Blob | null> {
    return await this.filesStore.getItem<Blob>(id);
  }

  async deleteFile(id: string): Promise<void> {
    await this.filesStore.removeItem(id);
    await this.metadataStore.removeItem(id);
  }

  async getAllFileIds(): Promise<string[]> {
    return await this.filesStore.keys();
  }

  async saveMetadata(document: Document): Promise<void> {
    await this.metadataStore.setItem(document.id, document);
  }

  async getMetadata(id: string): Promise<Document | null> {
    return await this.metadataStore.getItem<Document>(id);
  }

  async getAllMetadata(): Promise<Document[]> {
    const keys = await this.metadataStore.keys();
    const metadata: Document[] = [];
    
    for (const key of keys) {
      const doc = await this.metadataStore.getItem<Document>(key);
      if (doc) {
        metadata.push(doc);
      }
    }
    
    return metadata;
  }
}
