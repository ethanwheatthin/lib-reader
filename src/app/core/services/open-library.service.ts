import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map, catchError, of } from 'rxjs';
import { BookMetadata } from '../models/document.model';

interface OpenLibrarySearchResult {
  docs: Array<{
    key: string;
    title: string;
    author_name?: string[];
    publisher?: string[];
    publish_year?: number[];
    isbn?: string[];
    cover_i?: number;
    subject?: string[];
    number_of_pages_median?: number;
    first_sentence?: string[];
  }>;
  numFound: number;
}

interface OpenLibraryBook {
  title: string;
  authors?: Array<{ name: string }>;
  publishers?: string[];
  publish_date?: string;
  isbn_10?: string[];
  isbn_13?: string[];
  covers?: number[];
  subjects?: string[];
  number_of_pages?: number;
  description?: string | { value: string };
}

@Injectable({
  providedIn: 'root'
})
export class OpenLibraryService {
  private http = inject(HttpClient);
  private readonly API_BASE = 'https://openlibrary.org';

  /**
   * Search for a book by title
   */
  searchByTitle(title: string): Observable<BookMetadata[]> {
    const query = encodeURIComponent(title.trim());
    return this.http.get<OpenLibrarySearchResult>(
      `${this.API_BASE}/search.json?title=${query}&limit=5`
    ).pipe(
      map(response => this.mapSearchResults(response)),
      catchError(() => of([]))
    );
  }

  /**
   * Search for a book by ISBN
   */
  searchByISBN(isbn: string): Observable<BookMetadata | null> {
    const cleanISBN = isbn.replace(/[-\s]/g, '');
    return this.http.get<any>(
      `${this.API_BASE}/isbn/${cleanISBN}.json`
    ).pipe(
      map(book => {
        // The response is the book directly, not wrapped in an object
        if (!book || typeof book !== 'object') return null;
        return this.mapBookDetails(book);
      }),
      catchError(() => of(null))
    );
  }

  /**
   * Get book details by Open Library key (e.g., "/works/OL45804W")
   */
  getBookByKey(key: string): Observable<BookMetadata | null> {
    return this.http.get<OpenLibraryBook>(`${this.API_BASE}${key}.json`).pipe(
      map(book => this.mapBookDetails(book)),
      catchError(() => of(null))
    );
  }

  /**
   * Get cover image URL
   */
  getCoverUrl(coverId: number, size: 'S' | 'M' | 'L' = 'M'): string {
    return `https://covers.openlibrary.org/b/id/${coverId}-${size}.jpg`;
  }

  /**
   * Map search results to BookMetadata array
   */
  private mapSearchResults(response: OpenLibrarySearchResult): BookMetadata[] {
    return response.docs.slice(0, 5).map(doc => ({
      title: doc.title,
      author: doc.author_name?.join(', '),
      publisher: doc.publisher?.[0],
      publishYear: doc.publish_year?.[0]?.toString(),
      isbn: doc.isbn?.[0],
      coverUrl: doc.cover_i ? this.getCoverUrl(doc.cover_i, 'L') : undefined,
      subjects: doc.subject?.slice(0, 5),
      pageCount: doc.number_of_pages_median,
      openLibraryKey: doc.key,
      description: doc.first_sentence?.join(' ')
    }));
  }

  /**
   * Map book details to BookMetadata
   */
  private mapBookDetails(book: OpenLibraryBook): BookMetadata {
    const description = typeof book.description === 'string' 
      ? book.description 
      : book.description?.value;

    return {
      title: book.title,
      author: book.authors?.map(a => a.name).join(', '),
      publisher: book.publishers?.[0],
      publishYear: book.publish_date,
      isbn: book.isbn_13?.[0] || book.isbn_10?.[0],
      coverUrl: book.covers?.[0] ? this.getCoverUrl(book.covers[0], 'L') : undefined,
      subjects: book.subjects?.slice(0, 5),
      pageCount: book.number_of_pages,
      description
    };
  }
}
