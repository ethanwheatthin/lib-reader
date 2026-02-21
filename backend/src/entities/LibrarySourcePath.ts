import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { LibrarySourceEntity } from './LibrarySource';

@Entity('library_source_paths')
export class LibrarySourcePathEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Absolute directory path on the host filesystem */
  @Column({ type: 'varchar', length: 1000 })
  path: string;

  @Column({ name: 'last_scanned_at', type: 'timestamptz', nullable: true })
  lastScannedAt: Date | null;

  @Column({ name: 'file_count', type: 'int', default: 0 })
  fileCount: number;

  @Column({ name: 'library_source_id', type: 'uuid' })
  librarySourceId: string;

  @ManyToOne(() => LibrarySourceEntity, (s) => s.paths, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'library_source_id' })
  librarySource: LibrarySourceEntity;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
