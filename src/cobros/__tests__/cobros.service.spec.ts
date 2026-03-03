import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import {
  CobrosService,
  ResultadoGeneracionCuotas,
  CuentaCorriente,
  ReporteCobranza,
} from '../cobros.service';
import { Cuota, EstadoCuota } from '../entities/cuota.entity';
import { PagoCuota, MetodoPago } from '../entities/pago-cuota.entity';
import { Socio } from '../../socios/entities/socio.entity';
import { CustomError } from 'src/constants/errors/custom-error';
import { NotificacionesService } from '../../notificaciones/notificaciones.service';

const mockNotificacionesService = {
  crearNotificacion: jest.fn().mockResolvedValue(undefined),
};

describe('CobrosService', () => {
  let service: CobrosService;
  let cuotaRepository: Repository<Cuota>;
  let pagoCuotaRepository: Repository<PagoCuota>;
  let socioRepository: Repository<Socio>;
  let dataSource: DataSource;

  const mockQueryRunner = {
    connect: jest.fn().mockResolvedValue(undefined),
    startTransaction: jest.fn().mockResolvedValue(undefined),
    commitTransaction: jest.fn().mockResolvedValue(undefined),
    rollbackTransaction: jest.fn().mockResolvedValue(undefined),
    release: jest.fn().mockResolvedValue(undefined),
    manager: {
      find: jest.fn(),
      findOne: jest.fn(),
      save: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      createQueryBuilder: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CobrosService,
        {
          provide: getRepositoryToken(Cuota),
          useValue: {
            find: jest.fn(),
            findOne: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
            createQueryBuilder: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(PagoCuota),
          useValue: {
            find: jest.fn(),
            findOne: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Socio),
          useValue: {
            find: jest.fn(),
            findOne: jest.fn(),
            createQueryBuilder: jest.fn(),
          },
        },
        {
          provide: DataSource,
          useValue: {
            createQueryRunner: jest.fn().mockReturnValue(mockQueryRunner),
          },
        },
        {
          provide: NotificacionesService,
          useValue: mockNotificacionesService,
        },
      ],
    }).compile();

    service = module.get<CobrosService>(CobrosService);
    cuotaRepository = module.get(getRepositoryToken(Cuota));
    pagoCuotaRepository = module.get(getRepositoryToken(PagoCuota));
    socioRepository = module.get(getRepositoryToken(Socio));
    dataSource = module.get(DataSource);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('generarCuotasMensuales', () => {
    it('debería crear el servicio correctamente', () => {
      expect(service).toBeDefined();
    });

    it('debería generar cuotas correctamente para socios activos con categoría', async () => {
      const mockSocios = [
        {
          id: 1,
          nombre: 'Juan',
          apellido: 'Pérez',
          estado: 'ACTIVO',
          categoria: {
            id: 1,
            nombre: 'General',
            montoMensual: 5000,
          },
        },
        {
          id: 2,
          nombre: 'María',
          apellido: 'Gómez',
          estado: 'ACTIVO',
          categoria: {
            id: 1,
            nombre: 'General',
            montoMensual: 5000,
          },
        },
      ];

      // Mock para identificar socios morosos (query builder)
      const mockMorososQueryBuilder = {
        innerJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        having: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      };
      mockQueryRunner.manager.createQueryBuilder.mockReturnValue(
        mockMorososQueryBuilder,
      );

      // Mock para encontrar socios activos
      mockQueryRunner.manager.find
        .mockResolvedValueOnce(mockSocios) // socios activos
        .mockResolvedValueOnce([]); // cuotas existentes

      // Mock para crear cuota
      mockQueryRunner.manager.create.mockReturnValue({
        socioId: 1,
        periodo: '2026-02',
        monto: 5000,
        estado: EstadoCuota.PENDIENTE,
        barcode: 'CUOTA-test-1',
      });
      mockQueryRunner.manager.save.mockResolvedValue({ id: 1 });

      const result = await service.generarCuotasMensuales({
        periodo: '2026-02',
      });

      expect(result.creadas).toBe(2);
      expect(result.omitidas).toBe(0);
      expect(result.desactivados).toBe(0);
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
    });

    it('debería omitir cuotas que ya existen (idempotencia)', async () => {
      const mockSocios = [
        {
          id: 1,
          nombre: 'Juan',
          apellido: 'Pérez',
          estado: 'ACTIVO',
          categoria: {
            id: 1,
            nombre: 'General',
            montoMensual: 5000,
          },
        },
      ];

      const mockCuotasExistentes = [{ id: 1, socioId: 1, periodo: '2026-02' }];

      // Mock para identificar socios morosos
      const mockMorososQueryBuilder = {
        innerJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        having: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      };
      mockQueryRunner.manager.createQueryBuilder.mockReturnValue(
        mockMorososQueryBuilder,
      );

      mockQueryRunner.manager.find
        .mockResolvedValueOnce(mockSocios) // socios activos
        .mockResolvedValueOnce(mockCuotasExistentes); // cuotas existentes

      const result = await service.generarCuotasMensuales({
        periodo: '2026-02',
      });

      expect(result.creadas).toBe(0);
      expect(result.omitidas).toBe(1);
    });
  });

  describe('registrarPago', () => {
    it('debería registrar un pago correctamente', async () => {
      const fechaEmisionCuota = new Date('2026-02-01T10:00:00.000Z');

      const mockCuota = {
        id: 1,
        socioId: 1,
        periodo: '2026-02',
        monto: 5000,
        estado: EstadoCuota.PENDIENTE,
        barcode: '02-2026-123',
        createdAt: fechaEmisionCuota,
        socio: { id: 1, nombre: 'Juan', apellido: 'Pérez' },
      };

      mockQueryRunner.manager.findOne.mockResolvedValue(mockCuota);
      mockQueryRunner.manager.create.mockReturnValue({
        cuotaId: 1,
        montoPagado: 5000,
        metodoPago: MetodoPago.EFECTIVO,
        fechaPago: new Date(),
      });
      mockQueryRunner.manager.save.mockResolvedValue({ id: 1 });

      const result = await service.registrarPago({
        barcode: '02-2026-123',
        metodoPago: MetodoPago.EFECTIVO,
      });

      expect(result.cuota.estado).toBe(EstadoCuota.PAGADA);
      expect(result.pago.montoPagado).toBe(5000);
      expect(mockQueryRunner.manager.create).toHaveBeenCalledWith(
        PagoCuota,
        expect.objectContaining({ fechaEmisionCuota }),
      );
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
    });

    it('debería rechazar barcode con formato inválido', async () => {
      await expect(
        service.registrarPago({
          barcode: 'INVALID-BARCODE',
          metodoPago: MetodoPago.EFECTIVO,
        }),
      ).rejects.toThrow(CustomError);
    });

    it('debería rechazar cuota ya pagada', async () => {
      const mockCuota = {
        id: 1,
        socioId: 1,
        periodo: '2026-02',
        monto: 5000,
        estado: EstadoCuota.PAGADA,
        barcode: 'CUOTA-test-123',
      };

      mockQueryRunner.manager.findOne.mockResolvedValue(mockCuota);

      await expect(
        service.registrarPago({
          barcode: 'CUOTA-test-123',
          metodoPago: MetodoPago.EFECTIVO,
        }),
      ).rejects.toThrow(CustomError);
    });

    it('debería rechazar cuota no encontrada', async () => {
      mockQueryRunner.manager.findOne.mockResolvedValue(null);

      await expect(
        service.registrarPago({
          barcode: 'CUOTA-noexiste',
          metodoPago: MetodoPago.EFECTIVO,
        }),
      ).rejects.toThrow(CustomError);
    });
  });

  describe('obtenerCuentaCorriente', () => {
    it('debería retornar la cuenta corriente de un socio', async () => {
      const mockSocio = {
        id: 1,
        nombre: 'Juan',
        apellido: 'Pérez',
      };

      const mockCuotas = [
        {
          id: 1,
          periodo: '2026-01',
          monto: 5000,
          estado: EstadoCuota.PAGADA,
          fechaPago: new Date(),
        },
        {
          id: 2,
          periodo: '2026-02',
          monto: 5000,
          estado: EstadoCuota.PENDIENTE,
        },
      ];

      jest
        .spyOn(socioRepository, 'findOne')
        .mockResolvedValue(mockSocio as Socio);
      jest
        .spyOn(cuotaRepository, 'find')
        .mockResolvedValue(mockCuotas as Cuota[]);

      const result = await service.obtenerCuentaCorriente(1);

      expect(result.socioId).toBe(1);
      expect(result.socioNombre).toBe('Juan');
      expect(result.totalDeuda).toBe(5000);
      expect(result.totalPagado).toBe(5000);
      expect(result.mesesAdeudados).toBe(1);
    });

    it('debería lanzar error si el socio no existe', async () => {
      jest.spyOn(socioRepository, 'findOne').mockResolvedValue(null);

      await expect(service.obtenerCuentaCorriente(999)).rejects.toThrow(
        CustomError,
      );
    });
  });

  describe('obtenerReporteCobranza', () => {
    it('debería retornar el reporte de cobranza del período', async () => {
      const mockCuotas = [
        { id: 1, periodo: '2026-02', monto: 5000, estado: EstadoCuota.PAGADA },
        { id: 2, periodo: '2026-02', monto: 5000, estado: EstadoCuota.PAGADA },
        {
          id: 3,
          periodo: '2026-02',
          monto: 5000,
          estado: EstadoCuota.PENDIENTE,
        },
      ];

      jest
        .spyOn(cuotaRepository, 'find')
        .mockResolvedValue(mockCuotas as Cuota[]);

      const result = await service.obtenerReporteCobranza('2026-02');

      expect(result.periodo).toBe('2026-02');
      expect(result.totalGenerado).toBe(15000);
      expect(result.totalCobrado).toBe(10000);
      expect(result.cuotasPagadas).toBe(2);
      expect(result.cuotasPendientes).toBe(1);
    });

    it('deberia lanzar error si no hay cuotas para el periodo', async () => {
      jest.spyOn(cuotaRepository, 'find').mockResolvedValue([]);

      await expect(service.obtenerReporteCobranza('2026-12')).rejects.toThrow(
        CustomError,
      );
    });
  });

  describe('getSociosElegibles', () => {
    it('deberia incluir socios MOROSO solo cuando ya tienen cuota generada en el periodo', async () => {
      const mockSocios = [
        {
          id: 1,
          nombre: 'Juan',
          apellido: 'Perez',
          dni: '12345678',
          estado: 'ACTIVO',
          categoria: {
            id: 1,
            nombre: 'General',
            montoMensual: 5000,
            exento: false,
          },
        },
        {
          id: 2,
          nombre: 'Pedro',
          apellido: 'Lopez',
          dni: '87654321',
          estado: 'MOROSO',
          categoria: {
            id: 1,
            nombre: 'General',
            montoMensual: 5000,
            exento: false,
          },
        },
        {
          id: 3,
          nombre: 'Ana',
          apellido: 'Ruiz',
          dni: '11222333',
          estado: 'MOROSO',
          categoria: {
            id: 1,
            nombre: 'General',
            montoMensual: 5000,
            exento: false,
          },
        },
      ];

      jest
        .spyOn(socioRepository, 'find')
        .mockResolvedValue(mockSocios as Socio[]);
      jest
        .spyOn(cuotaRepository, 'find')
        .mockResolvedValue([{ socioId: 2, periodo: '2026-02' }] as Cuota[]);

      const result = await service.getSociosElegibles('2026-02');

      expect(result.total).toBe(2);
      expect(result.socios.map((s) => s.id)).toEqual([1, 2]);
      expect(result.socios.find((s) => s.id === 1)?.cuotaExistente).toBe(false);
      expect(result.socios.find((s) => s.id === 2)?.cuotaExistente).toBe(true);
    });
  });

  describe('getMorososDetallados', () => {
    const createMockQueryBuilder = () => ({
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      innerJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      having: jest.fn().mockReturnThis(),
      andHaving: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      clone: jest.fn().mockReturnThis(),
      getCount: jest.fn().mockResolvedValue(1),
      getMany: jest.fn().mockResolvedValue([]),
    });

    it('deberia retornar lista de morosos sin filtros', async () => {
      const mockMorosos = [
        {
          id: 1,
          nombre: 'Juan',
          apellido: 'Perez',
          dni: '12345678',
          telefono: '1234567',
          email: 'juan@test.com',
          estado: 'ACTIVO',
          categoria: { id: 1, nombre: 'General', montoMensual: 5000 },
        },
      ];

      const mockQueryBuilder = createMockQueryBuilder();
      mockQueryBuilder.getMany.mockResolvedValueOnce(mockMorosos);
      mockQueryBuilder.getCount.mockResolvedValueOnce(1);

      jest
        .spyOn(socioRepository, 'createQueryBuilder')
        .mockReturnValue(mockQueryBuilder as unknown as any);

      jest.spyOn(cuotaRepository, 'createQueryBuilder').mockReturnValue({
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([
          {
            socioId: 1,
            periodo: '2026-01',
            monto: 5000,
            estado: EstadoCuota.PENDIENTE,
          },
          {
            socioId: 1,
            periodo: '2026-02',
            monto: 5000,
            estado: EstadoCuota.PENDIENTE,
          },
          {
            socioId: 1,
            periodo: '2026-03',
            monto: 5000,
            estado: EstadoCuota.PENDIENTE,
          },
        ]),
      } as unknown as any);

      const result = await service.getMorososDetallados({});

      expect(result.morosos).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.morosos[0].mesesDeuda).toBe(3);
    });

    it('deberia filtrar por severidad 3-meses', async () => {
      const mockMorosos = [
        {
          id: 1,
          nombre: 'Juan',
          apellido: 'Perez',
          dni: '12345678',
          estado: 'ACTIVO',
          categoria: { id: 1, nombre: 'General', montoMensual: 5000 },
        },
      ];

      const mockQueryBuilder = createMockQueryBuilder();
      mockQueryBuilder.getMany.mockResolvedValueOnce(mockMorosos);
      mockQueryBuilder.getCount.mockResolvedValueOnce(1);

      jest
        .spyOn(socioRepository, 'createQueryBuilder')
        .mockReturnValue(mockQueryBuilder as unknown as any);

      jest.spyOn(cuotaRepository, 'createQueryBuilder').mockReturnValue({
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([
          {
            socioId: 1,
            periodo: '2026-01',
            monto: 5000,
            estado: EstadoCuota.PENDIENTE,
          },
          {
            socioId: 1,
            periodo: '2026-02',
            monto: 5000,
            estado: EstadoCuota.PENDIENTE,
          },
          {
            socioId: 1,
            periodo: '2026-03',
            monto: 5000,
            estado: EstadoCuota.PENDIENTE,
          },
        ]),
      } as unknown as any);

      const result = await service.getMorososDetallados({
        severidad: '3-meses' as any,
      });

      expect(mockQueryBuilder.andHaving).toHaveBeenCalledWith(
        'COUNT(cuota.id) = :exacto',
        { exacto: 3 },
      );
      expect(result.morosos).toHaveLength(1);
    });

    it('deberia filtrar por busqueda de nombre/DNI', async () => {
      const mockMorosos = [
        {
          id: 1,
          nombre: 'Juan',
          apellido: 'Perez',
          dni: '12345678',
          estado: 'ACTIVO',
          categoria: { id: 1, nombre: 'General', montoMensual: 5000 },
        },
      ];

      const mockQueryBuilder = createMockQueryBuilder();
      mockQueryBuilder.getMany.mockResolvedValueOnce(mockMorosos);
      mockQueryBuilder.getCount.mockResolvedValueOnce(1);

      jest
        .spyOn(socioRepository, 'createQueryBuilder')
        .mockReturnValue(mockQueryBuilder as unknown as any);

      jest.spyOn(cuotaRepository, 'createQueryBuilder').mockReturnValue({
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([
          {
            socioId: 1,
            periodo: '2026-01',
            monto: 5000,
            estado: EstadoCuota.PENDIENTE,
          },
          {
            socioId: 1,
            periodo: '2026-02',
            monto: 5000,
            estado: EstadoCuota.PENDIENTE,
          },
          {
            socioId: 1,
            periodo: '2026-03',
            monto: 5000,
            estado: EstadoCuota.PENDIENTE,
          },
        ]),
      } as unknown as any);

      const result = await service.getMorososDetallados({
        busqueda: 'Perez',
      });

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        '(socio.nombre LIKE :busqueda OR socio.apellido LIKE :busqueda OR socio.dni LIKE :busqueda)',
        { busqueda: '%Perez%' },
      );
      expect(result.morosos).toHaveLength(1);
    });

    it('deberia aplicar paginacion correctamente', async () => {
      const mockMorosos = [
        {
          id: 1,
          nombre: 'Juan',
          apellido: 'Perez',
          dni: '12345678',
          estado: 'ACTIVO',
          categoria: { id: 1, nombre: 'General', montoMensual: 5000 },
        },
      ];

      const mockQueryBuilder = createMockQueryBuilder();
      mockQueryBuilder.getMany.mockResolvedValueOnce(mockMorosos);
      mockQueryBuilder.getCount.mockResolvedValueOnce(25);

      jest
        .spyOn(socioRepository, 'createQueryBuilder')
        .mockReturnValue(mockQueryBuilder as unknown as any);

      jest.spyOn(cuotaRepository, 'createQueryBuilder').mockReturnValue({
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([
          {
            socioId: 1,
            periodo: '2026-01',
            monto: 5000,
            estado: EstadoCuota.PENDIENTE,
          },
          {
            socioId: 1,
            periodo: '2026-02',
            monto: 5000,
            estado: EstadoCuota.PENDIENTE,
          },
          {
            socioId: 1,
            periodo: '2026-03',
            monto: 5000,
            estado: EstadoCuota.PENDIENTE,
          },
        ]),
      } as unknown as any);

      const result = await service.getMorososDetallados({
        page: 2,
        limit: 10,
      });

      expect(mockQueryBuilder.skip).toHaveBeenCalledWith(10);
      expect(mockQueryBuilder.take).toHaveBeenCalledWith(10);
      expect(result.page).toBe(2);
      expect(result.limit).toBe(10);
      expect(result.totalPages).toBe(3);
    });

    it('deberia calcular montoTotalDeuda correctamente', async () => {
      const mockMorosos = [
        {
          id: 1,
          nombre: 'Juan',
          apellido: 'Perez',
          dni: '12345678',
          estado: 'ACTIVO',
          categoria: { id: 1, nombre: 'General', montoMensual: 5000 },
        },
      ];

      const mockQueryBuilder = createMockQueryBuilder();
      mockQueryBuilder.getMany.mockResolvedValueOnce(mockMorosos);
      mockQueryBuilder.getCount.mockResolvedValueOnce(1);

      jest
        .spyOn(socioRepository, 'createQueryBuilder')
        .mockReturnValue(mockQueryBuilder as unknown as any);

      jest.spyOn(cuotaRepository, 'createQueryBuilder').mockReturnValue({
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        getMany: jest
          .fn()
          .mockResolvedValueOnce([
            // Cuotas pendientes
            {
              socioId: 1,
              periodo: '2026-01',
              monto: 5000,
              estado: EstadoCuota.PENDIENTE,
            },
            {
              socioId: 1,
              periodo: '2026-02',
              monto: 5500,
              estado: EstadoCuota.PENDIENTE,
            },
            {
              socioId: 1,
              periodo: '2026-03',
              monto: 6000,
              estado: EstadoCuota.PENDIENTE,
            },
          ])
          .mockResolvedValueOnce([
            // Ultimo pago
            {
              socioId: 1,
              periodo: '2025-12',
              fechaPago: new Date('2025-12-15'),
            },
          ]),
      } as unknown as any);

      const result = await service.getMorososDetallados({});

      expect(result.morosos[0].montoTotalDeuda).toBe(16500);
      expect(result.morosos[0].periodosAdeudados).toEqual([
        '2026-01',
        '2026-02',
        '2026-03',
      ]);
    });
  });
});
