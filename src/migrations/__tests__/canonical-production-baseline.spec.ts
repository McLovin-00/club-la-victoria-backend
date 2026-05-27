import { QueryRunner } from 'typeorm';
import { CanonicalProductionBaseline1699999999000 } from '../1699999999000-CanonicalProductionBaseline';

type QueryResult = unknown[];

function createQueryRunner(results: QueryResult[]): QueryRunner {
  return {
    query: jest.fn().mockImplementation(() => Promise.resolve(results.shift() ?? [])),
  } as unknown as QueryRunner;
}

describe('CanonicalProductionBaseline1699999999000', () => {
  it('does not modify an already canonical database', async () => {
    const migration = new CanonicalProductionBaseline1699999999000();
    const queryRunner = createQueryRunner([
      [{ table_count: '17' }],
      [
        {
          has_socio: true,
          has_categoria_socio: true,
          has_cuota_periodo: true,
          has_cuota_socio: true,
          has_grupo_nombre: true,
          has_pago_metodo_pago: true,
          has_cobro_operacion: true,
        },
      ],
    ]);

    await expect(migration.up(queryRunner)).resolves.toBeUndefined();

    expect(queryRunner.query).toHaveBeenCalledTimes(2);
  });

  it('creates the canonical schema when the database is empty', async () => {
    const migration = new CanonicalProductionBaseline1699999999000();
    const queryRunner = createQueryRunner([[{ table_count: '0' }]]);

    await expect(migration.up(queryRunner)).resolves.toBeUndefined();

    const executedSql = (queryRunner.query as jest.Mock).mock.calls
      .map(([sql]) => String(sql))
      .join('\n');

    expect(executedSql).toContain('CREATE TYPE public.estado_socio');
    expect(executedSql).toContain('CREATE TABLE public.cuota');
    expect(executedSql).toContain('id_socio integer NOT NULL');
    expect(executedSql).toContain('periodo character varying(7) NOT NULL');
    expect(executedSql).toContain('CREATE TABLE public.grupo_familiar');
    expect(executedSql).toContain('nombre character varying(100) NOT NULL');
  });

  it('fails on a non-empty non-canonical database instead of silently continuing', async () => {
    const migration = new CanonicalProductionBaseline1699999999000();
    const queryRunner = createQueryRunner([
      [{ table_count: '4' }],
      [
        {
          has_socio: true,
          has_categoria_socio: false,
          has_cuota_periodo: false,
          has_cuota_socio: false,
          has_grupo_nombre: false,
          has_pago_metodo_pago: false,
          has_cobro_operacion: true,
        },
      ],
    ]);

    await expect(migration.up(queryRunner)).rejects.toThrow(
      'non-empty database does not match the canonical production baseline',
    );
  });
});
