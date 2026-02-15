import { Injectable, inject, OnDestroy } from '@angular/core';
import { IndexDBService } from './indexdb.service';
import { AutoBackupEntry } from '../models/document.model';

/** How often to auto-backup (ms) — 5 minutes */
const BACKUP_INTERVAL_MS = 5 * 60 * 1000;

/** Maximum number of auto-backups to keep */
const MAX_BACKUPS = 1;

@Injectable({ providedIn: 'root' })
export class AutoBackupService implements OnDestroy {
  private indexDB = inject(IndexDBService);
  private timerId: ReturnType<typeof setInterval> | null = null;

  /** Start the periodic auto-backup timer */
  start(): void {
    if (this.timerId) return; // already running
    // Run the first backup after the interval, not immediately on app start
    this.timerId = setInterval(() => this.runBackup(), BACKUP_INTERVAL_MS);
  }

  /** Stop the periodic auto-backup timer */
  stop(): void {
    if (this.timerId) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
  }

  ngOnDestroy(): void {
    this.stop();
  }

  /** Manually trigger a backup (also called by the timer) */
  async runBackup(): Promise<AutoBackupEntry | null> {
    try {
      const blob = await this.indexDB.exportLibrary();
      const entry = await this.indexDB.saveAutoBackup(blob);
      await this.indexDB.pruneAutoBackups(MAX_BACKUPS);
      return entry;
    } catch (err) {
      console.error('[AutoBackup] Backup failed:', err);
      return null;
    }
  }

  /** List all stored auto-backups (newest first) */
  async listBackups(): Promise<AutoBackupEntry[]> {
    return this.indexDB.listAutoBackups();
  }

  /** Delete a stored auto-backup by ID */
  async deleteBackup(id: string): Promise<void> {
    await this.indexDB.deleteAutoBackup(id);
  }

  /** Download a stored auto-backup as a file */
  async downloadBackup(id: string): Promise<void> {
    const blob = await this.indexDB.getAutoBackup(id);
    if (!blob) return;
    const filename = `library-auto-backup-${id.replace('backup-', '')}.json`;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  /** Get a backup blob as a File for restore */
  async getBackupAsFile(id: string): Promise<File | null> {
    const blob = await this.indexDB.getAutoBackup(id);
    if (!blob) return null;
    return new File([blob], `${id}.json`, { type: 'application/json' });
  }
}
