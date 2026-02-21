import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddBookmarkChapter1708523246000 implements MigrationInterface {
  name = 'AddBookmarkChapter1708523246000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "bookmarks"
      ADD COLUMN IF NOT EXISTS "chapter" varchar(500)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "bookmarks"
      DROP COLUMN IF EXISTS "chapter"
    `);
  }
}
