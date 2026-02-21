/** A watched directory path belonging to a library source */
export interface LibrarySourcePath {
  id: string;
  /** Absolute directory path on the server filesystem */
  path: string;
  /** When this path was last successfully scanned */
  lastScannedAt?: string;
  /** Number of files found during last scan */
  fileCount: number;
}

/** A named collection of watched directories that are polled for EPUB/PDF files */
export interface LibrarySource {
  id: string;
  /** User-defined name for this library source */
  name: string;
  /** The watched directory paths */
  paths: LibrarySourcePath[];
  /** Whether automatic polling is enabled */
  pollingEnabled: boolean;
  /** Polling interval in seconds (default: 300 = 5 min) */
  pollingIntervalSeconds: number;
  /** ISO date string — when this source was created */
  createdAt: string;
  /** ISO date string — last time any path was scanned */
  lastScannedAt?: string;
  /** Total files discovered across all paths */
  totalFilesFound: number;
  /** Whether a scan is currently in progress */
  scanning: boolean;
}
