import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { LibrarySourcePathEntity } from './LibrarySourcePath';

@Entity('library_sources')
export class LibrarySourceEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 300 })
  name: string;

  @Column({ name: 'polling_enabled', type: 'boolean', default: true })
  pollingEnabled: boolean;

  @Column({ name: 'polling_interval_seconds', type: 'int', default: 300 })
  pollingIntervalSeconds: number;

  @Column({ name: 'last_scanned_at', type: 'timestamptz', nullable: true })
  lastScannedAt: Date | null;

  @OneToMany(() => LibrarySourcePathEntity, (p) => p.librarySource, {
    cascade: true,
    eager: true,
  })
  paths: LibrarySourcePathEntity[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
