import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { LibrarySource } from '../models/library-source.model';
import { environment } from '../../../environments/environment';

export interface ScanResult {
  source: LibrarySource;
  imported: { id: string; title: string; type: string; filePath: string }[];
}

@Injectable({ providedIn: 'root' })
export class LibrarySourceApiService {
  private http = inject(HttpClient);
  private baseUrl = `${environment.apiUrl}/api/library-sources`;

  /** List all library sources */
  getAll(): Observable<LibrarySource[]> {
    return this.http.get<LibrarySource[]>(this.baseUrl);
  }

  /** Get a single library source */
  getOne(id: string): Observable<LibrarySource> {
    return this.http.get<LibrarySource>(`${this.baseUrl}/${id}`);
  }

  /** Create a new library source */
  create(payload: {
    name: string;
    paths: string[];
    pollingEnabled?: boolean;
    pollingIntervalSeconds?: number;
  }): Observable<LibrarySource> {
    return this.http.post<LibrarySource>(this.baseUrl, payload);
  }

  /** Update a library source */
  update(
    id: string,
    changes: Partial<{
      name: string;
      paths: string[];
      pollingEnabled: boolean;
      pollingIntervalSeconds: number;
    }>
  ): Observable<LibrarySource> {
    return this.http.put<LibrarySource>(`${this.baseUrl}/${id}`, changes);
  }

  /** Delete a library source */
  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }

  /** Trigger a scan of all paths in a source, importing new files */
  scan(id: string): Observable<ScanResult> {
    return this.http.post<ScanResult>(`${this.baseUrl}/${id}/scan`, {});
  }
}
