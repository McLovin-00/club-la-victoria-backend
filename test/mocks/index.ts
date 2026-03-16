import { DataSource, from 'typeorm';

/**
 * Crea un mock de DataSource con queryRunner configurado
 */
export function createMockDataSource(options: {
  queryRunner?: Partial<QueryRunner>;
} = {}): jest.Mocked<DataSource> {
  const defaultQueryRunner = createMockQueryRunner();
  
  return {
    createQueryRunner: jest.fn(() => defaultQueryRunner),
    ...options?. options?.queryRunner,
  } as jest.Mocked<DataSource>;
}
