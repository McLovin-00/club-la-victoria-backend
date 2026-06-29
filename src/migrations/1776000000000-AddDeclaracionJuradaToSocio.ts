import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddDeclaracionJuradaToSocio1776000000000
  implements MigrationInterface
{
  name = 'AddDeclaracionJuradaToSocio1776000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const [{ exists }] = await queryRunner.query(`
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'socio'
          AND column_name = 'declaracion_jurada'
      ) AS "exists"
    `);

    if (!exists) {
      await queryRunner.query(`
        ALTER TABLE "socio"
        ADD COLUMN "declaracion_jurada" boolean NOT NULL DEFAULT false
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "socio" DROP COLUMN "declaracion_jurada"
    `);
  }
}
