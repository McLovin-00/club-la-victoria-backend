import { ObjectLiteral, Repository } from 'typeorm';

/**
 * Crea un mock de Repository con todos los métodos comunes
 * @param overrides Sobrescribir métodos específicos con implementaciones personalizadas
 */
export function createMockRepository<T extends ObjectLiteral>(
  overrides: Partial<Repository<T>> = {},
): jest.Mocked<Repository<T>> {
  return {
    find: jest.fn().mockResolvedValue([]),
    findOne: jest.fn().mockResolvedValue(null),
    findOneBy: jest.fn().mockResolvedValue(null),
    findOneOrFail: jest.fn().mockResolvedValue(null),
    save: jest.fn().mockResolvedValue({}),
    update: jest.fn().mockResolvedValue({ affected: 1, generatedMaps: [], raw: [] }),
    delete: jest.fn().mockResolvedValue({ affected: 1, generatedMaps: [], raw: [] }),
    softDelete: jest.fn().mockResolvedValue({ affected: 1, generatedMaps: [], raw: [] }),
    restore: jest.fn().mockResolvedValue({ affected: 1, generatedMaps: [], raw: [] }),
    create: jest.fn().mockReturnValue({} as T),
    createQueryBuilder: jest.fn(),
    count: jest.fn().mockResolvedValue(0),
    exists: jest.fn().mockResolvedValue(false),
    existsBy: jest.fn().mockResolvedValue(false),
    findByIds: jest.fn().mockResolvedValue([]),
    findBy: jest.fn().mockResolvedValue([]),
    insert: jest.fn().mockResolvedValue({ identifiers: [], generatedMaps: [], raw: [] }),
    remove: jest.fn().mockResolvedValue({}),
    softRemove: jest.fn().mockResolvedValue({}),
    recover: jest.fn().mockResolvedValue({}),
    upsert: jest.fn().mockResolvedValue({ identifiers: [], generatedMaps: [], raw: [] }),
    increment: jest.fn().mockResolvedValue({ affected: 1, generatedMaps: [], raw: [] }),
    decrement: jest.fn().mockResolvedValue({ affected: 1, generatedMaps: [], raw: [] }),
    extend: jest.fn(),
    target: '',
    manager: {} as Repository<T>['manager'],
    metadata: {} as Repository<T>['metadata'],
    query: jest.fn().mockResolvedValue([]),
    clear: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  } as jest.Mocked<Repository<T>>;
}

/**
 * Crea un mock de Repository con datos predefinidos
 * @param initialData Datos iniciales para simular la base de datos
 */
export function createMockRepositoryWithData<
  T extends ObjectLiteral & { id: number },
>(initialData: T[] = []): jest.Mocked<Repository<T>> & { data: T[] } {
  const data = [...initialData];
  let nextId = Math.max(0, ...data.map((item) => item.id)) + 1;

  const repository = createMockRepository<T>({
    find: jest.fn().mockImplementation(async () => [...data]),
    findOne: jest
      .fn()
      .mockImplementation(async (options?: { where?: { id?: number } }) => {
        const id = options?.where?.id;
        if (id !== undefined) {
          return data.find((item) => item.id === id) || null;
        }
        return data[0] || null;
      }),
    findOneBy: jest
      .fn()
      .mockImplementation(async (criteria?: { id?: number }) => {
        if (criteria?.id !== undefined) {
          return data.find((item) => item.id === criteria.id) || null;
        }
        return data[0] || null;
      }),
    save: jest
      .fn()
      .mockImplementation(async (entity: Partial<T> & { id?: number }) => {
        if (entity.id) {
          const index = data.findIndex((item) => item.id === entity.id);
          if (index >= 0) {
            data[index] = { ...data[index], ...entity } as T;
            return data[index];
          }
        }

        const newEntity = { ...entity, id: nextId++ } as T;
        data.push(newEntity);
        return newEntity;
      }),
    update: jest
      .fn()
      .mockImplementation(async (criteria: { id?: number } | number, updateData: Partial<T>) => {
        const id = typeof criteria === 'number' ? criteria : criteria.id;
        const index = data.findIndex((item) => item.id === id);
        if (index >= 0) {
          data[index] = { ...data[index], ...updateData } as T;
          return { affected: 1, generatedMaps: [], raw: [] };
        }

        return { affected: 0, generatedMaps: [], raw: [] };
      }),
    delete: jest
      .fn()
      .mockImplementation(async (criteria: { id?: number } | number) => {
        const id = typeof criteria === 'number' ? criteria : criteria.id;
        const index = data.findIndex((item) => item.id === id);
        if (index >= 0) {
          data.splice(index, 1);
          return { affected: 1, generatedMaps: [], raw: [] };
        }

        return { affected: 0, generatedMaps: [], raw: [] };
      }),
    create: jest.fn().mockImplementation((entity: Partial<T>) => ({ ...entity } as T)),
    count: jest.fn().mockImplementation(async () => data.length),
  });

  return Object.assign(repository, { data });
}
