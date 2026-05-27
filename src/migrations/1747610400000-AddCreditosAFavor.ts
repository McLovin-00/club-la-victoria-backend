import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCreditosAFavor1747610400000 implements MigrationInterface {
  name = 'AddCreditosAFavor1747610400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create credito_individual table
    await queryRunner.query(`
      CREATE TABLE "credito_individual" (
        "id_credito_individual" SERIAL PRIMARY KEY,
        "id_socio" integer NOT NULL UNIQUE,
        "saldo" decimal(12,2) NOT NULL DEFAULT 0,
        "created_at" TIMESTAMP DEFAULT now(),
        "updated_at" TIMESTAMP DEFAULT now(),
        CONSTRAINT "uq_credito_individual_socio" UNIQUE ("id_socio"),
        CONSTRAINT "fk_credito_individual_socio" FOREIGN KEY ("id_socio")
          REFERENCES "socio"("id_socio") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_credito_individual_socio" ON "credito_individual" ("id_socio")
    `);

    // Create credito_grupal table
    await queryRunner.query(`
      CREATE TABLE "credito_grupal" (
        "id_credito_grupal" SERIAL PRIMARY KEY,
        "id_grupo_familiar" integer NOT NULL UNIQUE,
        "saldo" decimal(12,2) NOT NULL DEFAULT 0,
        "created_at" TIMESTAMP DEFAULT now(),
        "updated_at" TIMESTAMP DEFAULT now(),
        CONSTRAINT "uq_credito_grupal_grupo" UNIQUE ("id_grupo_familiar"),
        CONSTRAINT "fk_credito_grupal_grupo" FOREIGN KEY ("id_grupo_familiar")
          REFERENCES "grupo_familiar"("id_grupo_familiar") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_credito_grupal_grupo" ON "credito_grupal" ("id_grupo_familiar")
    `);

    // Add credit columns to cobro_operacion
    await queryRunner.query(`
      ALTER TABLE "cobro_operacion"
      ADD COLUMN "total_cargos" decimal(12,2) DEFAULT 0,
      ADD COLUMN "credito_aplicado" decimal(12,2) DEFAULT 0,
      ADD COLUMN "credito_generado" decimal(12,2) DEFAULT 0,
      ADD COLUMN "id_grupo_familiar" integer NULL
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_cobro_operacion_grupo" ON "cobro_operacion" ("id_grupo_familiar")
    `);

    // Add group FK constraint
    await queryRunner.query(`
      ALTER TABLE "cobro_operacion"
      ADD CONSTRAINT "fk_cobro_operacion_grupo" FOREIGN KEY ("id_grupo_familiar")
        REFERENCES "grupo_familiar"("id_grupo_familiar") ON DELETE SET NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop FK constraints and indexes first
    await queryRunner.query(`
      ALTER TABLE "cobro_operacion" DROP CONSTRAINT IF EXISTS "fk_cobro_operacion_grupo"
    `);

    await queryRunner.query(`
      DROP INDEX IF EXISTS "idx_cobro_operacion_grupo"
    `);

    // Remove credit columns from cobro_operacion
    await queryRunner.query(`
      ALTER TABLE "cobro_operacion"
      DROP COLUMN IF EXISTS "id_grupo_familiar",
      DROP COLUMN IF EXISTS "credito_generado",
      DROP COLUMN IF EXISTS "credito_aplicado",
      DROP COLUMN IF EXISTS "total_cargos"
    `);

    // Drop credito_grupal
    await queryRunner.query(`
      DROP TABLE IF EXISTS "credito_grupal"
    `);

    // Drop credito_individual
    await queryRunner.query(`
      DROP TABLE IF EXISTS "credito_individual"
    `);
  }
}
