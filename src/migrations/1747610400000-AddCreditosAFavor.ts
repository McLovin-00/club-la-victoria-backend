import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCreditosAFavor1747610400000 implements MigrationInterface {
  name = 'AddCreditosAFavor1747610400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create credito_individual table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "credito_individual" (
        "id_credito_individual" SERIAL PRIMARY KEY,
        "id_socio" integer NOT NULL,
        "saldo" decimal(12,2) NOT NULL DEFAULT 0,
        "created_at" TIMESTAMP DEFAULT now(),
        "updated_at" TIMESTAMP DEFAULT now(),
        CONSTRAINT "fk_credito_individual_socio" FOREIGN KEY ("id_socio")
          REFERENCES "socio"("id_socio") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "uq_credito_individual_socio" ON "credito_individual" ("id_socio")
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'fk_credito_individual_socio'
        ) THEN
          ALTER TABLE "credito_individual"
          ADD CONSTRAINT "fk_credito_individual_socio" FOREIGN KEY ("id_socio")
            REFERENCES "socio"("id_socio") ON DELETE CASCADE;
        END IF;
      END
      $$;
    `);

    // Create credito_grupal table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "credito_grupal" (
        "id_credito_grupal" SERIAL PRIMARY KEY,
        "id_grupo_familiar" integer NOT NULL,
        "saldo" decimal(12,2) NOT NULL DEFAULT 0,
        "created_at" TIMESTAMP DEFAULT now(),
        "updated_at" TIMESTAMP DEFAULT now(),
        CONSTRAINT "fk_credito_grupal_grupo" FOREIGN KEY ("id_grupo_familiar")
          REFERENCES "grupo_familiar"("id_grupo_familiar") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "uq_credito_grupal_grupo" ON "credito_grupal" ("id_grupo_familiar")
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'fk_credito_grupal_grupo'
        ) THEN
          ALTER TABLE "credito_grupal"
          ADD CONSTRAINT "fk_credito_grupal_grupo" FOREIGN KEY ("id_grupo_familiar")
            REFERENCES "grupo_familiar"("id_grupo_familiar") ON DELETE CASCADE;
        END IF;
      END
      $$;
    `);

    // Add credit columns to cobro_operacion
    await queryRunner.query(`
      ALTER TABLE "cobro_operacion"
      ADD COLUMN IF NOT EXISTS "total_cargos" decimal(12,2) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS "credito_aplicado" decimal(12,2) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS "credito_generado" decimal(12,2) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS "id_grupo_familiar" integer NULL
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_cobro_operacion_grupo" ON "cobro_operacion" ("id_grupo_familiar")
    `);

    // Add group FK constraint
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'fk_cobro_operacion_grupo'
        ) THEN
          ALTER TABLE "cobro_operacion"
          ADD CONSTRAINT "fk_cobro_operacion_grupo" FOREIGN KEY ("id_grupo_familiar")
            REFERENCES "grupo_familiar"("id_grupo_familiar") ON DELETE SET NULL;
        END IF;
      END
      $$;
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
