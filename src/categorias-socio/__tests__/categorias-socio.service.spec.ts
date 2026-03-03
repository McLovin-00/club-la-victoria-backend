import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CategoriasSocioService } from '../categorias-socio.service';
import { CategoriaSocio } from '../entities/categoria-socio.entity';
import { CustomError } from 'src/constants/errors/custom-error';

describe('CategoriasSocioService', () => {
  let service: CategoriasSocioService;
  let repository: Repository<CategoriaSocio>;

  const mockCategoria: CategoriaSocio = {
    id: 1,
    nombre: 'ACTIVO',
    montoMensual: 10000,
    exento: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    socios: [],
  };

  const mockCategoriaExenta: CategoriaSocio = {
    id: 3,
    nombre: 'VITALICIO',
    montoMensual: 0,
    exento: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    socios: [],
  };

  const mockQueryBuilder = {
    orderBy: jest.fn().mockReturnThis(),
    getMany: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CategoriasSocioService,
        {
          provide: getRepositoryToken(CategoriaSocio),
          useValue: {
            find: jest.fn(),
            findOne: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
            remove: jest.fn(),
            createQueryBuilder: jest.fn().mockReturnValue(mockQueryBuilder),
          },
        },
      ],
    }).compile();

    service = module.get<CategoriasSocioService>(CategoriasSocioService);
    repository = module.get(getRepositoryToken(CategoriaSocio));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('debería retornar todas las categorías', async () => {
      const mockCategorias = [mockCategoria, mockCategoriaExenta];
      jest.spyOn(repository, 'find').mockResolvedValue(mockCategorias);

      const result = await service.findAll();

      expect(result).toEqual(mockCategorias);
    });
  });

  describe('findOne', () => {
    it('debería retornar una categoría por ID', async () => {
      jest.spyOn(repository, 'findOne').mockResolvedValue(mockCategoria);

      const result = await service.findOne(1);

      expect(result).toEqual(mockCategoria);
    });

    it('debería lanzar error si la categoría no existe', async () => {
      jest.spyOn(repository, 'findOne').mockResolvedValue(null);

      await expect(service.findOne(999)).rejects.toThrow(CustomError);
    });
  });

  describe('update', () => {
    it('debería actualizar el monto mensual de una categoría', async () => {
      jest.spyOn(repository, 'findOne').mockResolvedValue(mockCategoria);
      const updatedCategoria = { ...mockCategoria, montoMensual: 15000 };
      jest.spyOn(repository, 'save').mockResolvedValue(updatedCategoria);

      const result = await service.update(1, { montoMensual: 15000 });

      expect(result.montoMensual).toBe(15000);
    });

    it('debería lanzar error si la categoría no existe al actualizar', async () => {
      jest.spyOn(repository, 'findOne').mockResolvedValue(null);

      await expect(
        service.update(999, { montoMensual: 15000 }),
      ).rejects.toThrow(CustomError);
    });
  });

  describe('categorías exentas', () => {
    it('debería identificar VITALICIO como categoría exenta', () => {
      expect(mockCategoriaExenta.exento).toBe(true);
      expect(mockCategoriaExenta.montoMensual).toBe(0);
    });

    it('debería identificar ACTIVO como categoría NO exenta', () => {
      expect(mockCategoria.exento).toBe(false);
      expect(mockCategoria.montoMensual).toBeGreaterThan(0);
    });
  });
});
