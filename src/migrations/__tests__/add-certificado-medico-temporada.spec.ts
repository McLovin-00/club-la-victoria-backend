import { QueryRunner } from 'typeorm';
import { AddCertificadoMedicoToSocioTemporada1795561197313 } from '../1795561197313-AddCertificadoMedicoToSocioTemporada';

function createQueryRunner(
  handler: (sql: string) => unknown[] = () => [],
): QueryRunner {
  return {
    query: jest.fn((sql: string) => Promise.resolve(handler(String(sql)))),
  } as unknown as QueryRunner;
}

describe('AddCertificadoMedicoToSocioTemporada1795561197313', () => {
  it('agrega el campo con default false y garantiza la unicidad socio-temporada', async () => {
    const queryRunner = createQueryRunner((sql) => {
      if (sql.includes('FROM pg_indexes')) return [];
      if (sql.includes('GROUP BY id_socio, id_temporada')) return [];
      if (sql.includes('information_schema.columns')) {
        return [{ exists: false }];
      }
      return [];
    });

    await new AddCertificadoMedicoToSocioTemporada1795561197313().up(
      queryRunner,
    );

    const statements = (queryRunner.query as jest.Mock).mock.calls
      .map(([sql]) => String(sql))
      .join('\n');
    expect(statements).toContain(
      'CREATE UNIQUE INDEX "uq_socio_temporada_certificado_integrity"',
    );
    expect(statements).toContain(
      'ADD COLUMN "certificado_medico_presentado" boolean NOT NULL DEFAULT false',
    );
  });

  it('no crea otro índice si ya existe la unicidad', async () => {
    const queryRunner = createQueryRunner((sql) => {
      if (sql.includes('FROM pg_indexes')) {
        return [
          {
            indexdef:
              'CREATE UNIQUE INDEX uq_socio_temporada ON public.socio_temporada USING btree (id_socio, id_temporada)',
          },
        ];
      }
      if (sql.includes('information_schema.columns')) {
        return [{ exists: false }];
      }
      return [];
    });

    await new AddCertificadoMedicoToSocioTemporada1795561197313().up(
      queryRunner,
    );

    const statements = (queryRunner.query as jest.Mock).mock.calls
      .map(([sql]) => String(sql))
      .join('\n');
    expect(statements).not.toContain('GROUP BY id_socio, id_temporada');
    expect(statements).not.toContain(
      'CREATE UNIQUE INDEX "uq_socio_temporada_certificado_integrity"',
    );
    expect(statements).toContain('ADD COLUMN "certificado_medico_presentado"');
  });

  it('no confía en un índice único parcial para garantizar la asociación', async () => {
    const queryRunner = createQueryRunner((sql) => {
      if (sql.includes('FROM pg_indexes')) {
        return [
          {
            indexdef:
              'CREATE UNIQUE INDEX uq_socio_temporada ON public.socio_temporada USING btree (id_socio, id_temporada) WHERE (id_socio > 0)',
          },
        ];
      }
      if (sql.includes('GROUP BY id_socio, id_temporada')) return [];
      if (sql.includes('information_schema.columns')) {
        return [{ exists: false }];
      }
      return [];
    });

    await new AddCertificadoMedicoToSocioTemporada1795561197313().up(
      queryRunner,
    );

    const statements = (queryRunner.query as jest.Mock).mock.calls
      .map(([sql]) => String(sql))
      .join('\n');
    expect(statements).toContain(
      'CREATE UNIQUE INDEX "uq_socio_temporada_certificado_integrity"',
    );
  });

  it('detiene la migración si existen asociaciones duplicadas', async () => {
    const queryRunner = createQueryRunner((sql) => {
      if (sql.includes('FROM pg_indexes')) return [];
      if (sql.includes('GROUP BY id_socio, id_temporada')) {
        return [{ id_socio: 4, id_temporada: 9, cantidad: '2' }];
      }
      return [];
    });

    await expect(
      new AddCertificadoMedicoToSocioTemporada1795561197313().up(queryRunner),
    ).rejects.toThrow(/socio 4, temporada 9 tiene 2 registros duplicados/);
    expect((queryRunner.query as jest.Mock).mock.calls).toHaveLength(2);
  });
});
