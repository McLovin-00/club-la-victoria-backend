import { MigrationInterface, QueryRunner } from 'typeorm';

interface IndexRow {
  indexdef: string;
}

interface DuplicateAssociationRow {
  id_socio: number;
  id_temporada: number;
  cantidad: string;
}

interface ColumnExistsRow {
  exists: boolean;
}

export class AddCertificadoMedicoToSocioTemporada1795561197313
  implements MigrationInterface
{
  name = 'AddCertificadoMedicoToSocioTemporada1795561197313';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const indexesResult: unknown = await queryRunner.query(`
      SELECT indexdef
      FROM pg_indexes
      WHERE schemaname = 'public'
        AND tablename = 'socio_temporada'
    `);
    const indexes = Array.isArray(indexesResult)
      ? (indexesResult as IndexRow[])
      : [];

    const hasUniqueSocioTemporadaIndex = indexes.some(({ indexdef }) => {
      const columnList = indexdef.match(/\bUSING\s+\w+\s*\(([^()]*)\)/i)?.[1];
      const columns = columnList
        ?.split(',')
        .map((column) => column.trim().replaceAll('"', ''));

      return (
        /^CREATE UNIQUE INDEX/i.test(indexdef) &&
        !/\bWHERE\b/i.test(indexdef) &&
        columns?.length === 2 &&
        columns.includes('id_socio') &&
        columns.includes('id_temporada')
      );
    });

    if (!hasUniqueSocioTemporadaIndex) {
      const duplicatesResult: unknown = await queryRunner.query(`
        SELECT id_socio, id_temporada, COUNT(*) AS cantidad
        FROM public.socio_temporada
        GROUP BY id_socio, id_temporada
        HAVING COUNT(*) > 1
        LIMIT 1
      `);
      const duplicates = Array.isArray(duplicatesResult)
        ? (duplicatesResult as DuplicateAssociationRow[])
        : [];
      const duplicate = duplicates[0];

      if (duplicate) {
        throw new Error(
          `No se puede garantizar una asociación única: socio ${duplicate.id_socio}, temporada ${duplicate.id_temporada} tiene ${duplicate.cantidad} registros duplicados.`,
        );
      }

      await queryRunner.query(`
        CREATE UNIQUE INDEX "uq_socio_temporada_certificado_integrity"
        ON public.socio_temporada ("id_socio", "id_temporada")
      `);
    }

    const columnsResult: unknown = await queryRunner.query(`
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'socio_temporada'
          AND column_name = 'certificado_medico_presentado'
      ) AS "exists"
    `);
    const columnRows = Array.isArray(columnsResult)
      ? (columnsResult as ColumnExistsRow[])
      : [];
    const exists = columnRows[0]?.exists ?? false;

    if (!exists) {
      await queryRunner.query(`
        ALTER TABLE public.socio_temporada
        ADD COLUMN "certificado_medico_presentado" boolean NOT NULL DEFAULT false
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE public.socio_temporada
      DROP COLUMN IF EXISTS "certificado_medico_presentado"
    `);

    // La unicidad socio-temporada es una regla de integridad independiente del certificado.
  }
}
