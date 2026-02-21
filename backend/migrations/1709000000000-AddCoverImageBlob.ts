import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCoverImageBlob1709000000000 implements MigrationInterface {
  name = 'AddCoverImageBlob1709000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "book_metadata"
      ADD COLUMN IF NOT EXISTS "cover_image" bytea,
      ADD COLUMN IF NOT EXISTS "cover_image_type" varchar(50)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "book_metadata"
      DROP COLUMN IF EXISTS "cover_image",
      DROP COLUMN IF EXISTS "cover_image_type"
    `);
  }
}
