import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddLibrarySources1708600000000 implements MigrationInterface {
  name = 'AddLibrarySources1708600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "library_sources" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "name" varchar(300) NOT NULL,
        "polling_enabled" boolean NOT NULL DEFAULT true,
        "polling_interval_seconds" integer NOT NULL DEFAULT 300,
        "last_scanned_at" timestamptz,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "library_source_paths" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "library_source_id" uuid NOT NULL REFERENCES "library_sources"("id") ON DELETE CASCADE,
        "path" varchar(1000) NOT NULL,
        "last_scanned_at" timestamptz,
        "file_count" integer NOT NULL DEFAULT 0,
        "created_at" timestamptz NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_library_source_paths_source"
        ON "library_source_paths" ("library_source_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "library_source_paths"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "library_sources"`);
  }
}
