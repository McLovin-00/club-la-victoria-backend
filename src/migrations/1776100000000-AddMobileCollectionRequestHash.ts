import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMobileCollectionRequestHash1776100000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "cobro_mobile_request" (
        "id_cobro_operacion" integer PRIMARY KEY REFERENCES "cobro_operacion"("id_cobro_operacion") ON DELETE CASCADE,
        "request_hash" varchar(64) NOT NULL
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS "cobro_mobile_request"');
  }
}
