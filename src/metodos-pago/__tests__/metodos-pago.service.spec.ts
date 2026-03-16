import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { MetodosPagoService } from '../metodos-pago.service';
import { MetodoPago } from '../entities/metodo-pago.entity';

describe('MetodosPagoService', () => {
  let service: MetodosPagoService;
  let repository: Repository<MetodoPago>;

  // Datos mock para pruebas
  const mockMetodoPago1: MetodoPago = {
    id: 1,
    nombre: 'Tarjeta de Crédito',
    descripcion: 'Pago con tarjeta de crédito',
    activo: true,
    orden: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    pagos: [],
  };

  const mockMetodoPago2: MetodoPago = {
    id: 2,
    nombre: 'Transferencia',
    descripcion: 'Pago por transferencia bancaria',
    activo: true,
    orden: 2,
    createdAt: new Date(),
    updatedAt: new Date(),
    pagos: [],
  };

  const mockMetodoPagoInactivo: MetodoPago = {
    id: 3,
    nombre: 'Cheque',
    descripcion: 'Pago con cheque',
    activo: false,
    orden: 3,
    createdAt: new Date(),
    updatedAt: new Date(),
    pagos: [],
  };

  // Mock del QueryBuilder
  const mockQueryBuilder: Partial<SelectQueryBuilder<MetodoPago>> = {
    where: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    getMany: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MetodosPagoService,
        {
          provide: getRepositoryToken(MetodoPago),
          useValue: {
            createQueryBuilder: jest.fn().mockReturnValue(mockQueryBuilder),
          },
        },
      ],
    }).compile();

    service = module.get<MetodosPagoService>(MetodosPagoService);
    repository = module.get<Repository<MetodoPago>>(
      getRepositoryToken(MetodoPago),
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    describe('cuando hay métodos de pago activos', () => {
      it('debería retornar todos los métodos de pago activos ordenados por orden', async () => {
        // Arrange
        const metodosEsperados = [mockMetodoPago1, mockMetodoPago2];
        (mockQueryBuilder.getMany as jest.Mock).mockResolvedValue(
          metodosEsperados,
        );

        // Act
        const resultado = await service.findAll();

        // Assert
        expect(resultado).toEqual(metodosEsperados);
        expect(repository.createQueryBuilder).toHaveBeenCalledWith('metodo');
        expect(mockQueryBuilder.where).toHaveBeenCalledWith(
          'metodo.activo = :activo',
          { activo: true },
        );
        expect(mockQueryBuilder.orderBy).toHaveBeenCalledWith(
          'metodo.orden',
          'ASC',
        );
        expect(mockQueryBuilder.getMany).toHaveBeenCalled();
      });

      it('debería retornar los métodos en el orden correcto', async () => {
        // Arrange
        const metodosOrdenados = [mockMetodoPago1, mockMetodoPago2];
        (mockQueryBuilder.getMany as jest.Mock).mockResolvedValue(
          metodosOrdenados,
        );

        // Act
        const resultado = await service.findAll();

        // Assert
        expect(resultado[0].orden).toBe(1);
        expect(resultado[1].orden).toBe(2);
      });

      it('debería filtrar solo los métodos activos', async () => {
        // Arrange
        const metodosActivos = [mockMetodoPago1, mockMetodoPago2];
        (mockQueryBuilder.getMany as jest.Mock).mockResolvedValue(
          metodosActivos,
        );

        // Act
        await service.findAll();

        // Assert
        expect(mockQueryBuilder.where).toHaveBeenCalledWith(
          'metodo.activo = :activo',
          expect.objectContaining({ activo: true }),
        );
      });
    });

    describe('cuando no hay métodos de pago activos', () => {
      it('debería retornar un array vacío', async () => {
        // Arrange
        (mockQueryBuilder.getMany as jest.Mock).mockResolvedValue([]);

        // Act
        const resultado = await service.findAll();

        // Assert
        expect(resultado).toEqual([]);
        expect(resultado).toHaveLength(0);
        expect(Array.isArray(resultado)).toBe(true);
      });

      it('debería seguir llamando a los métodos del query builder correctamente', async () => {
        // Arrange
        (mockQueryBuilder.getMany as jest.Mock).mockResolvedValue([]);

        // Act
        await service.findAll();

        // Assert
        expect(repository.createQueryBuilder).toHaveBeenCalled();
        expect(mockQueryBuilder.where).toHaveBeenCalled();
        expect(mockQueryBuilder.orderBy).toHaveBeenCalled();
        expect(mockQueryBuilder.getMany).toHaveBeenCalled();
      });
    });

    describe('chain methods correctamente', () => {
      it('debería encadenar where, orderBy y getMany correctamente', async () => {
        // Arrange
        const metodosEsperados = [mockMetodoPago1];
        (mockQueryBuilder.getMany as jest.Mock).mockResolvedValue(
          metodosEsperados,
        );

        // Act
        const resultado = await service.findAll();

        // Assert
        // Verificar que el chaining es correcto (cada llamada retorna this)
        expect(mockQueryBuilder.where).toHaveBeenCalled();
        expect(mockQueryBuilder.orderBy).toHaveBeenCalled();
        expect(mockQueryBuilder.getMany).toHaveBeenCalled();
        expect(resultado).toBeDefined();
        expect(resultado).not.toBeNull();
      });

      it('debería retornar una Promise', async () => {
        // Arrange
        (mockQueryBuilder.getMany as jest.Mock).mockResolvedValue([]);

        // Act
        const promesa = service.findAll();

        // Assert
        expect(promesa).toBeInstanceOf(Promise);
        await promesa;
      });
    });

    describe('con múltiples métodos de pago', () => {
      it('debería manejar una lista grande de métodos de pago', async () => {
        // Arrange
        const muchosMétodos: MetodoPago[] = Array.from({ length: 100 }, (_, i) => ({
          id: i + 1,
          nombre: `Método ${i + 1}`,
          descripcion: `Descripción ${i + 1}`,
          activo: true,
          orden: i + 1,
          createdAt: new Date(),
          updatedAt: new Date(),
          pagos: [],
        }));
        (mockQueryBuilder.getMany as jest.Mock).mockResolvedValue(
          muchosMétodos,
        );

        // Act
        const resultado = await service.findAll();

        // Assert
        expect(resultado).toHaveLength(100);
        expect(resultado).toEqual(muchosMétodos);
      });

      it('debería mantener el orden de los métodos', async () => {
        // Arrange
        const metodosConOrden = [
          { ...mockMetodoPago2, orden: 2 },
          { ...mockMetodoPago1, orden: 1 },
        ];
        (mockQueryBuilder.getMany as jest.Mock).mockResolvedValue(
          metodosConOrden,
        );

        // Act
        const resultado = await service.findAll();

        // Assert
        expect(resultado[0].orden).toBe(2);
        expect(resultado[1].orden).toBe(1);
      });
    });
  });
});
