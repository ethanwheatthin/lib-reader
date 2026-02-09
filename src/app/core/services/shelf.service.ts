import { Injectable } from '@angular/core';
import localforage from 'localforage';
import { Shelf } from '../models/shelf.model';

@Injectable({ providedIn: 'root' })
export class ShelfService {
  private shelvesStore = localforage.createInstance({
    name: 'epub-pdf-reader',
    storeName: 'shelves'
  });

  async saveShelf(shelf: Shelf): Promise<void> {
    await this.shelvesStore.setItem(shelf.id, shelf);
  }

  async getShelf(id: string): Promise<Shelf | null> {
    return await this.shelvesStore.getItem<Shelf>(id);
  }

  async getAllShelves(): Promise<Shelf[]> {
    const keys = await this.shelvesStore.keys();
    const shelves: Shelf[] = [];
    
    for (const key of keys) {
      const shelf = await this.shelvesStore.getItem<Shelf>(key);
      if (shelf) {
        shelves.push(shelf);
      }
    }
    
    // Sort by order
    return shelves.sort((a, b) => a.order - b.order);
  }

  async deleteShelf(id: string): Promise<void> {
    await this.shelvesStore.removeItem(id);
  }

  async updateShelfDocuments(id: string, documentIds: string[]): Promise<void> {
    const shelf = await this.getShelf(id);
    if (shelf) {
      shelf.documentIds = documentIds;
      await this.saveShelf(shelf);
    }
  }
}
