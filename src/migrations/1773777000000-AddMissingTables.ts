import { MigrationInterface, QueryRunner } from 'typeorm';
import * as fs from 'fs';
import * as path from 'path';

const HISTORICAL_SQL_FILES = [
  '2026-01-02-add-nombre-apellido-no-socio.sql',
  '2026-02-27-add-cobros-categorias.sql',
  '2026-02-27-add-override-manual-socio.sql',
  '2026-02-27-update-categorias-estatuto.sql',
  '2026-02-27-backfill-categorias-socios.sql',
  '2026-02-28-add-moroso-estado-socio.sql',
  '2026-02-28-add-tarjeta-centro-socio.sql',
  '2026-02-28-update-barcode-format.sql',
  '2026-03-01-add-grupos-familiares.sql',
  '2026-03-02-add-fecha-emision-cuota-en-pago.sql',
  '2026-03-04-add-metodos-pago-table-clean.sql',
  '2026-03-04-remove-barcode-cuota.sql',
  '2026-03-04-add-rechazada-tarjeta-centro-cuota.sql',
  '2026-03-05-add-mobile-cobranzas-collector-ledger.sql',
  '2026-03-09-add-fecha-rechazo-tarjeta-centro-cuota.sql',
  '2026-03-11-enable-unaccent-extension.sql',
  '2026-03-11-create-unaccent-indexes.sql',
  '2026-03-11-cleanup-data-issues.sql',
  '2026-03-11-add-integrity-constraints.sql',
];

export class AddMissingTables1773777000000 implements MigrationInterface {
  name = 'AddMissingTables1773777000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const schemaLooksCurrent = await this.schemaLooksCurrent(queryRunner);
    if (schemaLooksCurrent) {
      return;
    }

    for (const fileName of HISTORICAL_SQL_FILES) {
      const sql = this.readHistoricalSql(fileName);
      if (!sql.trim()) {
        continue;
      }

      await queryRunner.query(sql);
    }
  }

  public async down(): Promise<void> {
    // Migración histórica reconstruida. No revertir automáticamente.
  }

  private async schemaLooksCurrent(queryRunner: QueryRunner): Promise<boolean> {
    const [result] = await queryRunner.query(`
      SELECT
        EXISTS (
          SELECT 1
          FROM information_schema.tables
          WHERE table_schema = 'public'
            AND table_name = 'cobro_operacion'
        ) AS has_cobro_operacion,
        EXISTS (
          SELECT 1
          FROM information_schema.tables
          WHERE table_schema = 'public'
            AND table_name = 'metodos_pago'
        ) AS has_metodos_pago,
        EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'cuota'
            AND column_name = 'fecha_rechazo_tarjeta_centro'
        ) AS has_fecha_rechazo,
        EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'socio'
            AND column_name = 'id_grupo_familiar'
        ) AS has_grupo_familiar
    `);

    return Boolean(
      result?.has_cobro_operacion &&
        result?.has_metodos_pago &&
        result?.has_fecha_rechazo &&
        result?.has_grupo_familiar,
    );
  }

  private readHistoricalSql(fileName: string): string {
    const sqlPath = path.resolve(process.cwd(), 'migrations', fileName);
    const raw = fs.readFileSync(sqlPath, 'utf8');

    return raw
      .split(/\r?\n/u)
      .filter((line) => {
        const trimmed = line.trim();
        return (
          !trimmed.startsWith('#') &&
          trimmed.toUpperCase() !== 'BEGIN;' &&
          trimmed.toUpperCase() !== 'COMMIT;'
        );
      })
      .join('\n');
  }
}
