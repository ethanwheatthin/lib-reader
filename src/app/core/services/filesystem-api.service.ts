import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface DirEntry {
  name: string;
  path: string;
  isDirectory: boolean;
  size?: number;
}

export interface BrowseResult {
  /** Absolute path of the directory being browsed */
  current: string;
  /** Parent directory path, or null if at root */
  parent: string | null;
  /** Directory contents (sub-dirs + epub/pdf files) */
  entries: DirEntry[];
}

@Injectable({ providedIn: 'root' })
export class FilesystemApiService {
  private http = inject(HttpClient);
  private baseUrl = `${environment.apiUrl}/api/filesystem`;

  /** Browse a directory on the server. Omit `dir` to get root/drives. */
  browse(dir?: string): Observable<BrowseResult> {
    let params = new HttpParams();
    if (dir) {
      params = params.set('dir', dir);
    }
    return this.http.get<BrowseResult>(`${this.baseUrl}/browse`, { params });
  }
}
