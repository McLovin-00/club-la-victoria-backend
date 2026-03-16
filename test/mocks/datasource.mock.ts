import { SelectQueryBuilder } from 'typeorm';

/**
 * Crea un mock de SelectQueryBuilder con encadenamiento fluida
 * @param overrides Sobrescribir métodos específicos con implementaciones personalizadas
 */
export function createMockQueryBuilder<T>(overrides: Partial<SelectQueryBuilder<T> = {}): jest.Mocked<SelectQueryBuilder<T>> {
  return {
    select: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    addOrderBy: jest.fn().mockReturnThis(),
    addOrderBy: jest.fn().mockReturnThis(),
    groupBy: jest.fn().mockReturnThis(),
    having: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orWhere: jest.fn().mockReturnThis(),
    join: jest.fn().mockReturnThis(),
    innerJoin: jest.fn().mockReturnThis(),
    leftJoin: jest.fn().mockReturnThis(),
    innerJoinAndSelect: jest.fn().mockReturnThis(),
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    relation: jest.fn().mockReturnThis(),
    setParameter: jest.fn().mockReturnThis(),
    setLock: jest.fn().mockReturnThis(),
    skipLocked: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    offset: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    insertOrUpdate: jest.fn().mockReturnThis(),
    insertParameter: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    softDelete: jest.fn().mockReturnThis(),
    restore: jest.fn().mockReturnThis(),
    withDeleted: jest.fn().mockReturnThis(),
    execute: jest.fn().mockReturnThis(),
    getMany: jest.fn().mockResolvedValue([]),
    getOne: jest.fn().mockResolvedValue(null),
    getOneOrFail: jest.fn().mockRejectedValue(new Error('Not found')),
    stream: jest.fn().mockReturnThis(),
    ...overrides,
  } as unknown as jest.Mocked<SelectQueryBuilder<T>;
}
