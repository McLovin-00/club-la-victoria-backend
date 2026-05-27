import { QueryRunner } from 'typeorm';
import { AddCreditosAFavor1747610400000 } from '../1747610400000-AddCreditosAFavor';

function createQueryRunner(): QueryRunner {
  return {
    query: jest.fn().mockResolvedValue([]),
  } as unknown as QueryRunner;
}

describe('AddCreditosAFavor1747610400000', () => {
  it('uses idempotent DDL so reruns and partial production deploys are safe', async () => {
    const migration = new AddCreditosAFavor1747610400000();
    const queryRunner = createQueryRunner();

    await migration.up(queryRunner);

    const executedSql = (queryRunner.query as jest.Mock).mock.calls
      .map(([sql]) => String(sql))
      .join('\n');

    expect(executedSql).toContain('CREATE TABLE IF NOT EXISTS "credito_individual"');
    expect(executedSql).toContain('CREATE TABLE IF NOT EXISTS "credito_grupal"');
    expect(executedSql).toContain('ADD COLUMN IF NOT EXISTS "total_cargos"');
    expect(executedSql).toContain('CREATE INDEX IF NOT EXISTS "idx_cobro_operacion_grupo"');
    expect(executedSql).not.toContain('"id_socio" integer NOT NULL UNIQUE');
    expect(executedSql).not.toContain('"id_grupo_familiar" integer NOT NULL UNIQUE');
  });
});
