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
import { PagoCuota } from '../entities/pago-cuota.entity';
import { CobroOperacion } from '../entities/cobro-operacion.entity';
import { CobroOperacionLinea } from '../entities/cobro-operacion-linea.entity';
import { Socio } from '../../socios/entities/socio.entity';
import { CustomError } from 'src/constants/errors/custom-error';
import { NotificacionesService } from '../../notificaciones/notificaciones.service';
import { CobradorCuentaCorrienteMovimiento, TipoMovimientoCobrador } from '../../cobradores/entities/cobrador-cuenta-corriente-movimiento.entity';
import { CobradorDispositivo } from '../../cobradores/entities/cobrador-dispositivo.entity';
import { ActorCobro } from '../entities/cobro-operacion.entity';
import { CreditoService } from '../../credito/credito.service';

const mockNotificacionesService = {
  crearNotificacion: jest.fn().mockResolvedValue(undefined),
};

const mockCreditoService = {
  aplicarCreditoIndividual: jest.fn().mockResolvedValue({
    creditoAplicado: 0,
    nuevoSaldo: 0,
    montoACobrar: 5000, // default: no credit available, full amount to pay
  }),
  acumularCreditoIndividual: jest.fn().mockResolvedValue({
    saldoAnterior: 0,
    nuevoSaldo: 0,
    creditoGenerado: 0,
  }),
  aplicarCreditoGrupal: jest.fn().mockResolvedValue({
    creditoAplicado: 0,
    nuevoSaldo: 0,
    montoACobrar: 5000,
  }),
  acumularCreditoGrupal: jest.fn().mockResolvedValue({
    saldoAnterior: 0,
    nuevoSaldo: 0,
    creditoGenerado: 0,
  }),
};

describe('CobrosService', () => {
  let service: CobrosService;
  let cuotaRepository: Repository<Cuota>;
  let pagoCuotaRepository: Repository<PagoCuota>;
  let cobroOperacionRepository: Repository<CobroOperacion>;
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
      count: jest.fn(),
      save: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
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
            createQueryBuilder: jest.fn(),
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
          provide: getRepositoryToken(CobroOperacion),
          useValue: {
            find: jest.fn(),
            findOne: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(CobroOperacionLinea),
          useValue: {
            find: jest.fn(),
            findOne: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
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
        {
          provide: CreditoService,
          useValue: mockCreditoService,
        },
      ],
    }).compile();

    service = module.get<CobrosService>(CobrosService);
    cuotaRepository = module.get(getRepositoryToken(Cuota));
    pagoCuotaRepository = module.get(getRepositoryToken(PagoCuota));
    cobroOperacionRepository = module.get(getRepositoryToken(CobroOperacion));
    socioRepository = module.get(getRepositoryToken(Socio));
    dataSource = module.get(DataSource);
  });

  afterEach(() => {
    // Reset all mocks except CreditoService which needs persistent behavior
    jest.resetAllMocks();
    // Re-configure CreditoService mocks after reset since resetAllMocks clears implementations
    // CreditoService works in decimal pesos; CobrosService converts at the boundary.
    mockCreditoService.aplicarCreditoIndividual.mockResolvedValue({
      creditoAplicado: 0,
      nuevoSaldo: 0,
      montoACobrar: 5000,
    });
    mockCreditoService.acumularCreditoIndividual.mockResolvedValue({
      saldoAnterior: 0,
      nuevoSaldo: 0,
      creditoGenerado: 0,
    });
    mockCreditoService.aplicarCreditoGrupal.mockResolvedValue({
      creditoAplicado: 0,
      nuevoSaldo: 0,
      montoACobrar: 5000,
    });
    mockCreditoService.acumularCreditoGrupal.mockResolvedValue({
      saldoAnterior: 0,
      nuevoSaldo: 0,
      creditoGenerado: 0,
    });
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

  describe('reglas de morosidad', () => {
    it('debería identificar morosos por cuotas pendientes sin filtrar por estado actual del socio', async () => {
      const mockMorososQueryBuilder = {
        innerJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        having: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      };

      mockQueryRunner.manager.createQueryBuilder.mockReturnValue(
        mockMorososQueryBuilder as unknown as any,
      );

      await (
        service as unknown as {
          identificarSociosMorosos: (
            queryRunner: typeof mockQueryRunner,
          ) => Promise<Socio[]>;
        }
      ).identificarSociosMorosos(mockQueryRunner);

      expect(mockMorososQueryBuilder.where).toHaveBeenCalledWith(
        'cuota.estado = :cuotaEstado',
        {
          cuotaEstado: EstadoCuota.PENDIENTE,
        },
      );
      expect(mockMorososQueryBuilder.andWhere).not.toHaveBeenCalledWith(
        'socio.estado = :estado',
        expect.anything(),
      );
    });
  });

  describe('getSociosElegibles', () => {
    it('debería usar monto histórico cuando ya existe cuota del período', async () => {
      const mockSocios = [
        {
          id: 1,
          nombre: 'Juan',
          apellido: 'Perez',
          dni: '12345678',
          estado: 'ACTIVO',
          tarjetaCentro: false,
          categoria: {
            id: 1,
            nombre: 'ACTIVO',
            montoMensual: 15000,
            exento: false,
          },
        },
        {
          id: 2,
          nombre: 'Ana',
          apellido: 'Gomez',
          dni: '23456789',
          estado: 'ACTIVO',
          tarjetaCentro: true,
          categoria: {
            id: 1,
            nombre: 'ACTIVO',
            montoMensual: 15000,
            exento: false,
          },
        },
      ] as unknown as Socio[];

      const sociosQueryBuilder = {
        andWhere: jest.fn().mockReturnThis(),
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(mockSocios),
      };

      jest
        .spyOn(socioRepository, 'createQueryBuilder')
        .mockReturnValue(sociosQueryBuilder as unknown as any);

      jest.spyOn(cuotaRepository, 'find').mockResolvedValue([
        {
          socioId: 1,
          monto: 10000,
          createdAt: new Date('2026-01-01T10:00:00.000Z'),
        },
      ] as unknown as Cuota[]);

      const result = await service.getSociosElegibles('2026-01');

      const socioConCuota = result.socios.find((s) => s.id === 1);
      const socioSinCuota = result.socios.find((s) => s.id === 2);

      expect(socioConCuota).toBeDefined();
      expect(socioConCuota?.cuotaExistente).toBe(true);
      expect(socioConCuota?.montoMensual).toBe(10000);

      expect(socioSinCuota).toBeDefined();
      expect(socioSinCuota?.cuotaExistente).toBe(false);
      expect(socioSinCuota?.montoMensual).toBe(15000);
    });

    it('debería usar el monto de categoría cuando no existe cuota para el período', async () => {
      const mockSocios = [
        {
          id: 10,
          nombre: 'Laura',
          apellido: 'Diaz',
          dni: '30111222',
          estado: 'ACTIVO',
          tarjetaCentro: false,
          categoria: {
            id: 2,
            nombre: 'ADHERENTE',
            montoMensual: 8000,
            exento: false,
          },
        },
      ] as unknown as Socio[];

      const sociosQueryBuilder = {
        andWhere: jest.fn().mockReturnThis(),
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(mockSocios),
      };

      jest
        .spyOn(socioRepository, 'createQueryBuilder')
        .mockReturnValue(sociosQueryBuilder as unknown as any);

      jest.spyOn(cuotaRepository, 'find').mockResolvedValue([]);

      const result = await service.getSociosElegibles('2026-02');

      expect(result.socios).toHaveLength(1);
      expect(result.socios[0].cuotaExistente).toBe(false);
      expect(result.socios[0].montoMensual).toBe(8000);
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
        createdAt: fechaEmisionCuota,
        socio: { id: 1, nombre: 'Juan', apellido: 'Pérez' },
      };

      mockQueryRunner.manager.findOne
        .mockResolvedValueOnce(mockCuota)
        .mockResolvedValueOnce({ id: 1, activo: true })
        .mockResolvedValueOnce({ id: 1, estado: 'ACTIVO' });
      mockQueryRunner.manager.count.mockResolvedValue(2);
      mockQueryRunner.manager.create.mockReturnValue({
        cuotaId: 1,
        montoPagado: 5000,
        metodoPagoId: 1,
        fechaPago: new Date(),
      });
      mockQueryRunner.manager.save.mockResolvedValue({ id: 1 });

      const result = await service.registrarPago({
        cuotaId: 1,
        metodoPagoId: 1,
      });

      expect(result.cuota.estado).toBe(EstadoCuota.PAGADA);
      expect(result.pago.montoPagado).toBe(5000);
      expect(mockQueryRunner.manager.create).toHaveBeenCalledWith(
        PagoCuota,
        expect.objectContaining({ fechaEmisionCuota }),
      );
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
    });

    it('debería bloquear solo la cuota al registrar pago para evitar doble pago concurrente', async () => {
      const mockCuota = {
        id: 1,
        socioId: 1,
        periodo: '2026-02',
        monto: 5000,
        estado: EstadoCuota.PENDIENTE,
        createdAt: new Date('2026-02-01T10:00:00.000Z'),
        socio: { id: 1, nombre: 'Juan', apellido: 'Pérez' },
      };

      mockQueryRunner.manager.findOne
        .mockResolvedValueOnce(mockCuota)
        .mockResolvedValueOnce({ id: 1, activo: true })
        .mockResolvedValueOnce({ id: 1, estado: 'ACTIVO' });
      mockQueryRunner.manager.count.mockResolvedValue(2);
      mockQueryRunner.manager.create.mockImplementation((_entity, payload) => payload);
      mockQueryRunner.manager.save.mockImplementation(async (entity) => entity);

      await service.registrarPago({
        cuotaId: 1,
        metodoPagoId: 1,
      });

      expect(mockQueryRunner.manager.findOne).toHaveBeenNthCalledWith(
        1,
        Cuota,
        expect.objectContaining({
          where: { id: 1 },
          lock: { mode: 'pessimistic_write' },
        }),
      );
      expect(mockQueryRunner.manager.findOne.mock.calls[0][1]).not.toHaveProperty(
        'relations',
      );
    });

    it('debería acumular como crédito individual el excedente de un pago por cuota', async () => {
      const fechaEmisionCuota = new Date('2026-02-01T10:00:00.000Z');
      const mockCuota = {
        id: 1,
        socioId: 1,
        periodo: '2026-02',
        monto: 5000,
        estado: EstadoCuota.PENDIENTE,
        createdAt: fechaEmisionCuota,
        socio: { id: 1, nombre: 'Juan', apellido: 'Pérez' },
      };

      mockQueryRunner.manager.findOne
        .mockResolvedValueOnce(mockCuota)
        .mockResolvedValueOnce({ id: 1, activo: true })
        .mockResolvedValueOnce({ id: 1, estado: 'ACTIVO' });
      mockQueryRunner.manager.count.mockResolvedValue(2);
      mockQueryRunner.manager.create.mockImplementation((_entity, payload) => payload);
      mockQueryRunner.manager.save.mockImplementation(async (entity) => entity);

      mockCreditoService.aplicarCreditoIndividual.mockResolvedValueOnce({
        creditoAplicado: 0,
        nuevoSaldo: 0,
        montoACobrar: 5000,
      });
      mockCreditoService.acumularCreditoIndividual.mockResolvedValueOnce({
        saldoAnterior: 0,
        nuevoSaldo: 2000,
        creditoGenerado: 2000,
      });

      const result = await service.registrarPago({
        cuotaId: 1,
        metodoPagoId: 1,
        montoPagado: 7000,
      });

      expect(mockCreditoService.acumularCreditoIndividual).toHaveBeenCalledWith(
        mockQueryRunner,
        1,
        2000,
      );
      expect(result.pago.montoPagado).toBe(5000);
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
    });

    it('debería reactivar socio moroso cuando queda con menos de 4 cuotas pendientes', async () => {
      const fechaEmisionCuota = new Date('2026-02-01T10:00:00.000Z');
      const mockCuota = {
        id: 1,
        socioId: 1,
        periodo: '2026-02',
        monto: 5000,
        estado: EstadoCuota.PENDIENTE,
        createdAt: fechaEmisionCuota,
        socio: { id: 1, nombre: 'Agustin', apellido: 'Acosta' },
      };

      mockQueryRunner.manager.findOne
        .mockResolvedValueOnce(mockCuota)
        .mockResolvedValueOnce({ id: 1, activo: true })
        .mockResolvedValueOnce({ id: 1, estado: 'MOROSO' });
      mockQueryRunner.manager.count.mockResolvedValue(3);
      mockQueryRunner.manager.create.mockReturnValue({
        cuotaId: 1,
        montoPagado: 5000,
        metodoPagoId: 1,
        fechaPago: new Date(),
      });
      mockQueryRunner.manager.save.mockResolvedValue({ id: 1 });

      await service.registrarPago({
        cuotaId: 1,
        metodoPagoId: 1,
      });

      expect(mockQueryRunner.manager.update).toHaveBeenCalledWith(Socio, 1, {
        estado: 'ACTIVO',
      });
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
    });

    it('debería rechazar cuando no existe la cuota', async () => {
      mockQueryRunner.manager.findOne.mockResolvedValue(null);

      await expect(
        service.registrarPago({
          cuotaId: 999,
          metodoPagoId: 1,
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
      };

      mockQueryRunner.manager.findOne.mockResolvedValue(mockCuota);

      await expect(
        service.registrarPago({
          cuotaId: 1,
          metodoPagoId: 1,
        }),
      ).rejects.toThrow(CustomError);
    });

    it('debería rechazar método de pago inexistente o inactivo', async () => {
      const mockCuota = {
        id: 1,
        socioId: 1,
        periodo: '2026-02',
        monto: 5000,
        estado: EstadoCuota.PENDIENTE,
        createdAt: new Date('2026-02-01T10:00:00.000Z'),
        socio: { id: 1, nombre: 'Juan', apellido: 'Pérez' },
      };

      mockQueryRunner.manager.findOne
        .mockResolvedValueOnce(mockCuota)
        .mockResolvedValueOnce(null);

      await expect(
        service.registrarPago({
          cuotaId: 1,
          metodoPagoId: 999,
        }),
      ).rejects.toMatchObject({
        message: 'El metodo de pago seleccionado no existe o esta inactivo',
      });
    });

    it('debería rechazar cuota no encontrada', async () => {
      mockQueryRunner.manager.findOne.mockResolvedValue(null);

      await expect(
        service.registrarPago({
          cuotaId: 999,
          metodoPagoId: 1,
        }),
      ).rejects.toThrow(CustomError);
    });
  });

  describe('procesarResultadosTarjetaCentro', () => {
    it('debería marcar al socio como MOROSO cuando acumula 4 cuotas pendientes al rechazar tarjeta', async () => {
      const mockCuota = {
        id: 10,
        socioId: 1,
        periodo: '2026-02',
        monto: 5000,
        estado: EstadoCuota.PENDIENTE,
        rechazadaTarjetaCentro: false,
        createdAt: new Date('2026-02-01T10:00:00.000Z'),
        socio: { id: 1, nombre: 'Juan', apellido: 'Pérez' },
      } as unknown as Cuota;

      mockQueryRunner.manager.find.mockResolvedValue([mockCuota]);
      mockQueryRunner.manager.findOne.mockResolvedValue({
        id: 1,
        estado: 'ACTIVO',
      });
      mockQueryRunner.manager.count.mockResolvedValue(4);
      mockQueryRunner.manager.save.mockResolvedValue({
        ...mockCuota,
        rechazadaTarjetaCentro: true,
      });

      const result = await service.procesarResultadosTarjetaCentro({
        resultados: [{ cuotaId: 10, aprobada: false }],
      });

      expect(result.procesados).toBe(1);
      expect(result.rechazados).toBe(1);
      expect(mockQueryRunner.manager.update).toHaveBeenCalledWith(Socio, 1, {
        estado: 'MOROSO',
      });
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
    });
  });

  describe('obtenerCuentaCorriente', () => {
    it('debería retornar la cuenta corriente de un socio', async () => {
      const mockSocio = {
        id: 1,
        nombre: 'Juan',
        apellido: 'Pérez',
        tarjetaCentro: true,
      };

      const fechaRechazo = new Date('2026-02-15T10:30:00.000Z');

      const mockCuotas = [
        {
          id: 1,
          periodo: '2026-01',
          monto: 5000,
          estado: EstadoCuota.PAGADA,
          fechaPago: new Date(),
          rechazadaTarjetaCentro: false,
        },
        {
          id: 2,
          periodo: '2026-02',
          monto: 5000,
          estado: EstadoCuota.PENDIENTE,
          rechazadaTarjetaCentro: true,
          fechaRechazoTarjetaCentro: fechaRechazo,
        },
      ];

      jest
        .spyOn(socioRepository, 'findOne')
        .mockResolvedValue(mockSocio as Socio);

      const mockCuentaCorrienteQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(mockCuotas as Cuota[]),
      };

      jest
        .spyOn(cuotaRepository, 'createQueryBuilder')
        .mockReturnValue(mockCuentaCorrienteQueryBuilder as unknown as any);

      const result = await service.obtenerCuentaCorriente(1);

      expect(result.socioId).toBe(1);
      expect(result.socioNombre).toBe('Juan');
      expect(result.totalDeuda).toBe(5000);
      expect(result.totalPagado).toBe(5000);
      expect(result.mesesAdeudados).toBe(1);
      expect(result.cuotas[0].tarjetaCentroEstado).toBe('APROBADA');
      expect(result.cuotas[1].tarjetaCentroEstado).toBe('RECHAZADA');
      expect(result.cuotas[1].tarjetaCentroFechaEstado).toEqual(fechaRechazo);
      // creditoIndividual is exposed in account current (field from relation)
      expect(result.creditoIndividual).toBe(0); // mockSocio has no creditoIndividual relation
    });

    it('debería exponer creditoIndividual desde la relación del socio', async () => {
      // Test that when socio has a creditoIndividual relation, it is correctly exposed
      const mockSocioWithCredit = {
        id: 2,
        nombre: 'María',
        apellido: 'García',
        tarjetaCentro: false,
        creditoIndividual: {
          saldo: 1500, // decimal pesos = $1,500
        },
      };

      const mockCuotas = [
        {
          id: 20,
          periodo: '2026-05',
          monto: 5000,
          estado: EstadoCuota.PENDIENTE,
          rechazadaTarjetaCentro: false,
        },
      ];

      jest
        .spyOn(socioRepository, 'findOne')
        .mockResolvedValue(mockSocioWithCredit as Socio);

      const mockCuentaCorrienteQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(mockCuotas as Cuota[]),
      };

      jest
        .spyOn(cuotaRepository, 'createQueryBuilder')
        .mockReturnValue(mockCuentaCorrienteQueryBuilder as unknown as any);

      const result = await service.obtenerCuentaCorriente(2);

      // Prove creditoIndividual is correctly exposed from the socio relation
      expect(result.creditoIndividual).toBe(1500);
      expect(result.mesesAdeudados).toBe(1);
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

      const pagoCuotaQueryBuilder = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        innerJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([
          {
            montoPagado: 5000,
            metodoPago: { nombre: 'EFECTIVO' },
          },
          {
            montoPagado: 5000,
            metodoPago: { nombre: 'TRANSFERENCIA' },
          },
        ]),
      };

      jest
        .spyOn(pagoCuotaRepository, 'createQueryBuilder')
        .mockReturnValue(pagoCuotaQueryBuilder as unknown as any);

      const result = await service.obtenerReporteCobranza('2026-02');

      expect(result.periodo).toBe('2026-02');
      expect(result.totalGenerado).toBe(15000);
      expect(result.totalCobrado).toBe(10000);
      expect(result.cuotasPagadas).toBe(2);
      expect(result.cuotasPendientes).toBe(1);
      expect(result.desglosePorMetodoPago).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            metodoPago: 'EFECTIVO',
            totalCobrado: 5000,
          }),
          expect.objectContaining({
            metodoPago: 'TRANSFERENCIA',
            totalCobrado: 5000,
          }),
        ]),
      );
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

      const sociosQueryBuilder = {
        andWhere: jest.fn().mockReturnThis(),
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(mockSocios),
      };

      jest
        .spyOn(socioRepository, 'createQueryBuilder')
        .mockReturnValue(sociosQueryBuilder as unknown as any);
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
      leftJoin: jest.fn().mockReturnThis(),
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      innerJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      addGroupBy: jest.fn().mockReturnThis(),
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

    const setupSocioQueryBuilders = (
      morosos: unknown[],
      totalMorosos: unknown[] = morosos,
      statsMorosos: unknown[] = morosos,
    ) => {
      const mainQueryBuilder = createMockQueryBuilder();
      const totalQueryBuilder = createMockQueryBuilder();
      const statsQueryBuilder = createMockQueryBuilder();

      mainQueryBuilder.getMany.mockResolvedValue(morosos);
      totalQueryBuilder.getMany.mockResolvedValue(totalMorosos);
      statsQueryBuilder.getMany.mockResolvedValue(statsMorosos);
      mainQueryBuilder.clone.mockReturnValue(totalQueryBuilder);

      jest
        .spyOn(socioRepository, 'createQueryBuilder')
        .mockReturnValueOnce(mainQueryBuilder as unknown as any)
        .mockReturnValueOnce(statsQueryBuilder as unknown as any);

      return { mainQueryBuilder };
    };

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

      setupSocioQueryBuilders(mockMorosos);

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

      const { mainQueryBuilder } = setupSocioQueryBuilders(mockMorosos);

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

      expect(mainQueryBuilder.andHaving).toHaveBeenCalledWith(
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

      const { mainQueryBuilder } = setupSocioQueryBuilders(mockMorosos);

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

      expect(mainQueryBuilder.andWhere).toHaveBeenCalledWith(
        '(unaccent(socio.nombre) ILIKE unaccent(:busqueda0) OR unaccent(socio.apellido) ILIKE unaccent(:busqueda0) OR socio.dni ILIKE :busqueda0)',
        { busqueda0: '%Perez%' },
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

      const mockTotalMorosos = Array.from({ length: 25 }, (_, i) => ({
        id: i + 1,
        nombre: 'Juan',
        apellido: 'Perez',
        dni: `1000000${i}`,
        estado: 'ACTIVO',
        categoria: { id: 1, nombre: 'General', montoMensual: 5000 },
      }));
      const { mainQueryBuilder } = setupSocioQueryBuilders(
        mockMorosos,
        mockTotalMorosos,
        mockTotalMorosos,
      );

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

      expect(mainQueryBuilder.skip).toHaveBeenCalledWith(10);
      expect(mainQueryBuilder.take).toHaveBeenCalledWith(10);
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

      setupSocioQueryBuilders(mockMorosos);

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
          ])
          .mockResolvedValueOnce([]),
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

  describe('registrarOperacionCobro', () => {
    it('debería rechazar cobro mobile si actor COBRADOR no envía cobradorId', async () => {
      mockQueryRunner.manager.findOne.mockResolvedValue(null);
      mockQueryRunner.manager.find.mockResolvedValue([
        {
          id: 10,
          socioId: 1,
          monto: 1000,
          estado: EstadoCuota.PENDIENTE,
          createdAt: new Date(),
        },
      ]);

      await expect(
        service.registrarOperacionCobro({
          socioId: 1,
          cuotaIds: [10],
          metodoPagoId: 1,
          actorCobro: 'COBRADOR' as never,
          origenCobro: 'MOBILE' as never,
          total: 1000,
        }),
      ).rejects.toThrow(CustomError);
    });

    it('debería rechazar cobro web si actor COBRADOR no envía cobradorId', async () => {
      mockQueryRunner.manager.findOne.mockResolvedValue(null);
      mockQueryRunner.manager.find.mockResolvedValue([
        {
          id: 10,
          socioId: 1,
          monto: 1000,
          estado: EstadoCuota.PENDIENTE,
          createdAt: new Date(),
        },
      ]);
      mockCreditoService.aplicarCreditoIndividual.mockResolvedValueOnce({
        creditoAplicado: 0,
        nuevoSaldo: 0,
        montoACobrar: 1000,
      });

      await expect(
        service.registrarOperacionCobro({
          socioId: 1,
          cuotaIds: [10],
          metodoPagoId: 1,
          actorCobro: 'COBRADOR' as never,
          origenCobro: 'WEB' as never,
          total: 1000,
        }),
      ).rejects.toThrow(CustomError);
    });

    it('debería rechazar si el total informado no coincide', async () => {
      mockQueryRunner.manager.findOne.mockResolvedValue(null);
      mockQueryRunner.manager.find.mockResolvedValue([
        {
          id: 10,
          socioId: 1,
          monto: 1000,
          estado: EstadoCuota.PENDIENTE,
          createdAt: new Date(),
        },
      ]);
      mockCreditoService.aplicarCreditoIndividual.mockResolvedValueOnce({
        creditoAplicado: 0,
        nuevoSaldo: 0,
        montoACobrar: 1000,
      });

      await expect(
        service.registrarOperacionCobro({
          socioId: 1,
          cuotaIds: [10],
          metodoPagoId: 1,
          actorCobro: 'OPERADOR' as never,
          origenCobro: 'WEB' as never,
          total: 999,
        }),
      ).rejects.toThrow(CustomError);
    });

    it('debería devolver operación existente ante misma idempotencyKey', async () => {
      const existente = { id: 99, idempotencyKey: 'idempotent-1', lineas: [] };
      mockQueryRunner.manager.findOne.mockResolvedValue(existente);

      const result = await service.registrarOperacionCobro({
        socioId: 1,
        cuotaIds: [10],
        metodoPagoId: 1,
        actorCobro: 'OPERADOR' as never,
        origenCobro: 'WEB' as never,
        total: 1000,
        idempotencyKey: 'idempotent-1',
      });

      expect(result).toBe(existente);
      expect(mockQueryRunner.manager.find).not.toHaveBeenCalled();
    });

    it('debería bloquear cuotas de la operación para evitar doble cobro concurrente', async () => {
      const mockCuota = {
        id: 10,
        socioId: 1,
        monto: 1000,
        periodo: '2026-02',
        estado: EstadoCuota.PENDIENTE,
        createdAt: new Date(),
      };

      mockQueryRunner.manager.findOne.mockResolvedValueOnce(null);
      mockQueryRunner.manager.find
        .mockResolvedValueOnce([mockCuota])
        .mockResolvedValueOnce([]);
      mockQueryRunner.manager.count.mockResolvedValue(1);
      mockQueryRunner.manager.create.mockImplementation(
        (_entity: unknown, payload: Record<string, unknown>) => payload,
      );
      mockQueryRunner.manager.save.mockImplementation(async (entity) => {
        if (Array.isArray(entity)) return entity;
        return { id: 77, ...entity, fechaHoraServidor: new Date() };
      });
      mockCreditoService.aplicarCreditoIndividual.mockResolvedValueOnce({
        creditoAplicado: 0,
        nuevoSaldo: 0,
        montoACobrar: 1000,
      });

      await service.registrarOperacionCobro({
        socioId: 1,
        cuotaIds: [10],
        metodoPagoId: 1,
        actorCobro: 'OPERADOR' as never,
        origenCobro: 'WEB' as never,
        total: 1000,
      });

      expect(mockQueryRunner.manager.find).toHaveBeenCalledWith(
        Cuota,
        expect.objectContaining({
          where: { id: expect.any(Object), socioId: 1 },
          lock: { mode: 'pessimistic_write' },
        }),
      );
    });

    it('debería devolver operación existente si una carrera choca por idempotencyKey al guardar', async () => {
      const mockCuota = {
        id: 10,
        socioId: 1,
        monto: 1000,
        periodo: '2026-02',
        estado: EstadoCuota.PENDIENTE,
        createdAt: new Date(),
      };
      const existente = {
        id: 99,
        idempotencyKey: 'race-key-1',
        lineas: [{ id: 901, cuotaId: 10 }],
      };
      const uniqueError = Object.assign(new Error('duplicate key value'), {
        code: '23505',
        constraint: 'uq_cobro_operacion_idempotency',
      });

      mockQueryRunner.manager.findOne.mockResolvedValueOnce(null);
      mockQueryRunner.manager.find.mockResolvedValueOnce([mockCuota]);
      mockQueryRunner.manager.create.mockImplementation(
        (_entity: unknown, payload: Record<string, unknown>) => payload,
      );
      mockQueryRunner.manager.save.mockRejectedValueOnce(uniqueError);
      (cobroOperacionRepository.findOne as jest.Mock).mockResolvedValue(existente);
      mockCreditoService.aplicarCreditoIndividual.mockResolvedValueOnce({
        creditoAplicado: 0,
        nuevoSaldo: 0,
        montoACobrar: 1000,
      });

      const result = await service.registrarOperacionCobro({
        socioId: 1,
        cuotaIds: [10],
        metodoPagoId: 1,
        actorCobro: 'OPERADOR' as never,
        origenCobro: 'WEB' as never,
        total: 1000,
        idempotencyKey: 'race-key-1',
      });

      expect(result).toBe(existente);
      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
      expect(cobroOperacionRepository.findOne).toHaveBeenCalledWith({
        where: { idempotencyKey: 'race-key-1' },
        relations: ['lineas'],
      });
    });

    it('debería generar movimiento de comisión para cobrador al registrar operación', async () => {
      const fechaOperacion = new Date('2026-03-06T10:00:00.000Z');

      mockQueryRunner.manager.create.mockImplementation(
        (_entity: unknown, payload: Record<string, unknown>) => payload,
      );

      mockQueryRunner.manager.find.mockResolvedValueOnce([
        {
          cobradorId: 1,
          porcentaje: 0.1,
          vigenteDesde: new Date('2026-01-01T00:00:00.000Z'),
        },
      ]);

      mockCreditoService.aplicarCreditoIndividual.mockResolvedValueOnce({
        creditoAplicado: 0,
        nuevoSaldo: 0,
        montoACobrar: 1000,
      });

      mockQueryRunner.manager.save
        .mockResolvedValueOnce({ id: 77, fechaHoraServidor: fechaOperacion })
        .mockResolvedValueOnce({ id: 501 })
        .mockResolvedValueOnce([{ id: 901 }]);

      mockQueryRunner.manager.findOne.mockResolvedValueOnce({
        id: 77,
        lineas: [{ id: 901 }],
      });

      await service.registrarOperacionCobro({
        socioId: 1,
        conceptos: [{ concepto: 'Pago manual', monto: 1000 }],
        metodoPagoId: 1,
        actorCobro: 'COBRADOR' as never,
        origenCobro: 'WEB' as never,
        cobradorId: 1,
        total: 1000,
      });

      expect(mockQueryRunner.manager.save).toHaveBeenCalledWith(
        expect.objectContaining({
          cobradorId: 1,
          tipoMovimiento: 'COMISION_GENERADA',
          monto: 100,
          cobroOperacionId: 77,
        }),
      );
    });
  });

  describe('obtenerCuotasTarjetaCentro', () => {
    it('debería excluir cuotas con tarjetas inválidas y devolver solo las exportables', async () => {
      const queryBuilder = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([
          {
            id: 1,
            socioId: 10,
            socio: {
              id: 10,
              tarjetaCentro: true,
              numeroTarjetaCentro: '5400000012345678',
            },
          },
          {
            id: 2,
            socioId: 11,
            socio: {
              id: 11,
              tarjetaCentro: true,
              numeroTarjetaCentro: 'TC143102',
            },
          },
        ]),
      };

      jest
        .spyOn(cuotaRepository, 'createQueryBuilder')
        .mockReturnValue(queryBuilder as never);

      const result = await service.obtenerCuotasTarjetaCentro('2026-04');

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(1);
      expect(queryBuilder.getMany).toHaveBeenCalled();
    });
  });

  describe('obtenerCuotasParaTalonario', () => {
    it('debería excluir socios con tarjeta del centro del talonario mensual', async () => {
      const queryBuilder = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([
          {
            id: 1,
            socioId: 10,
            socio: {
              id: 10,
              tarjetaCentro: false,
            },
          },
        ]),
      };

      jest
        .spyOn(cuotaRepository, 'createQueryBuilder')
        .mockReturnValue(queryBuilder as never);

      const result = await service.obtenerCuotasParaTalonario('2026-04');

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(1);
      expect(queryBuilder.andWhere).toHaveBeenCalledWith(
        '(socio.tarjetaCentro = :tarjetaCentro OR socio.tarjetaCentro IS NULL)',
        { tarjetaCentro: false },
      );
      expect(queryBuilder.getMany).toHaveBeenCalled();
    });
  });

  describe('actualizarOperacionCobro', () => {
    const mockOperacionCobro = {
      id: 77,
      socioId: 1,
      cobradorId: 5,
      actorCobro: 'COBRADOR',
      metodoPagoId: 1,
      total: 5000,
      referencia: 'REF-001',
      observaciones: 'Test',
      fechaHoraServidor: new Date('2026-03-06T10:00:00.000Z'),
      lineas: [
        { id: 901, cuotaId: 10, tipoLinea: 'CUOTA', monto: 5000 },
      ],
      socio: { id: 1, nombre: 'Juan', apellido: 'Pérez' },
    };

    const mockCuotas = [
      {
        id: 10,
        socioId: 1,
        monto: 5000,
        estado: 'PENDIENTE',
        periodo: '2026-02',
        createdAt: new Date('2026-02-01T10:00:00.000Z'),
      },
    ];

    beforeEach(() => {
      mockQueryRunner.manager.findOne.mockReset();
      mockQueryRunner.manager.find.mockReset();
      mockQueryRunner.manager.save.mockReset();
      mockQueryRunner.manager.delete.mockReset();
      mockQueryRunner.manager.create.mockReset();
      mockQueryRunner.manager.count.mockReset();
      mockQueryRunner.manager.count.mockResolvedValue(1);
    });

    it('debería rechazar si la operación no existe (404)', async () => {
      mockQueryRunner.manager.findOne.mockResolvedValue(null);

      await expect(
        service.actualizarOperacionCobro(999, {
          cuotaIds: [10],
          conceptos: [],
          total: 5000,
          metodoPagoId: 1,
          installationId: 'device-abc',
        }),
      ).rejects.toMatchObject({
        message: 'Operación no encontrada',
        statusCode: 404,
      });
    });

    it('debería rechazar si la operación no es de COBRADOR (403)', async () => {
      mockQueryRunner.manager.findOne.mockResolvedValue({
        ...mockOperacionCobro,
        actorCobro: 'OPERADOR',
      });

      await expect(
        service.actualizarOperacionCobro(77, {
          cuotaIds: [10],
          conceptos: [],
          total: 5000,
          metodoPagoId: 1,
          installationId: 'device-abc',
        }),
      ).rejects.toMatchObject({
        message: 'Solo se pueden editar operaciones de cobrador',
        statusCode: 403,
      });
    });

    it('debería rechazar si el cobrador no coincide con la operación', async () => {
      mockQueryRunner.manager.findOne.mockResolvedValue(mockOperacionCobro);
      mockQueryRunner.manager.find
        .mockResolvedValueOnce(mockCuotas)
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([
          {
            cobradorId: 5,
            porcentaje: 0.1,
            vigenteDesde: new Date('2026-01-01'),
          },
        ]);
      mockQueryRunner.manager.create.mockImplementation(
        (_entity: unknown, payload: Record<string, unknown>) => payload,
      );
      mockQueryRunner.manager.save.mockResolvedValue({ id: 77 });
      mockQueryRunner.manager.delete.mockResolvedValue(undefined);

      await expect(
        service.actualizarOperacionCobro(77, {
          cuotaIds: [10],
          conceptos: [],
          total: 5000,
          metodoPagoId: 1,
          cobradorId: 99,
          installationId: 'device-abc',
        }),
      ).rejects.toMatchObject({
        message: 'No autorizado para editar esta operación',
        statusCode: 403,
      });
    });

    it('debería rechazar si el installationId no está vinculado al cobrador', async () => {
      mockQueryRunner.manager.findOne
        .mockResolvedValueOnce(mockOperacionCobro)
        .mockResolvedValueOnce({
          id: 77,
          lineas: [{ id: 901, cuotaId: 10 }],
        });
      mockQueryRunner.manager.count.mockResolvedValue(0);
      mockQueryRunner.manager.find
        .mockResolvedValueOnce(mockCuotas)
        .mockResolvedValueOnce([{ id: 901, cuotaId: 10 }])
        .mockResolvedValueOnce([
          {
            cobradorId: 5,
            porcentaje: 0.1,
            vigenteDesde: new Date('2026-01-01'),
          },
        ]);
      mockQueryRunner.manager.create.mockImplementation(
        (_entity: unknown, payload: Record<string, unknown>) => payload,
      );
      mockQueryRunner.manager.save.mockResolvedValue({ id: 77 });
      mockQueryRunner.manager.delete.mockResolvedValue(undefined);

      await expect(
        service.actualizarOperacionCobro(77, {
          cuotaIds: [10],
          conceptos: [],
          total: 5000,
          metodoPagoId: 1,
          cobradorId: 5,
          installationId: 'device-invalid',
        }),
      ).rejects.toMatchObject({
        message: 'No autorizado para editar esta operación',
        statusCode: 403,
      });

      expect(mockQueryRunner.manager.count).toHaveBeenCalledWith(
        CobradorDispositivo,
        {
          where: {
            installationId: 'device-invalid',
            cobradorId: 5,
          },
        },
      );
    });

    it('debería rechazar si alguna cuota no existe o no pertenece al socio', async () => {
      mockQueryRunner.manager.findOne.mockResolvedValue(mockOperacionCobro);
      mockQueryRunner.manager.find.mockResolvedValue([]);

      await expect(
        service.actualizarOperacionCobro(77, {
          cuotaIds: [10, 999],
          conceptos: [],
          total: 5000,
          metodoPagoId: 1,
          cobradorId: 5,
          installationId: 'device-abc',
        }),
      ).rejects.toMatchObject({
        message: 'Una o más cuotas seleccionadas no existen o no pertenecen al socio',
        statusCode: 400,
      });
    });

    it('debería rechazar si una cuota ya fue pagada por otra operación', async () => {
      const mockOperacionSinCuota10 = {
        ...mockOperacionCobro,
        lineas: [],
      };
      mockQueryRunner.manager.findOne.mockResolvedValue(mockOperacionSinCuota10);
      mockQueryRunner.manager.find.mockResolvedValue([
        { ...mockCuotas[0], estado: EstadoCuota.PAGADA },
      ]);

      await expect(
        service.actualizarOperacionCobro(77, {
          cuotaIds: [10],
          conceptos: [],
          total: 5000,
          metodoPagoId: 1,
          cobradorId: 5,
          installationId: 'device-abc',
        }),
      ).rejects.toMatchObject({
        statusCode: 409,
      });
    });

    it('debería rechazar si el total no coincide con la suma de cuotas y conceptos', async () => {
      mockQueryRunner.manager.findOne.mockResolvedValue(mockOperacionCobro);
      mockQueryRunner.manager.find.mockResolvedValue(mockCuotas);

      await expect(
        service.actualizarOperacionCobro(77, {
          cuotaIds: [10],
          conceptos: [{ concepto: 'Cargo', monto: 500, descripcion: 'Test' }],
          total: 9999,
          metodoPagoId: 1,
          cobradorId: 5,
          installationId: 'device-abc',
        }),
      ).rejects.toMatchObject({
        message: 'El total informado no coincide con la suma de cuotas y conceptos',
        statusCode: 400,
      });
    });

    it('debería rechazar si no se indica ningún método de pago', async () => {
      mockQueryRunner.manager.findOne.mockResolvedValue(mockOperacionCobro);
      mockQueryRunner.manager.find.mockResolvedValue(mockCuotas);

      await expect(
        service.actualizarOperacionCobro(77, {
          cuotaIds: [10],
          conceptos: [],
          total: 5000,
          cobradorId: 5,
          installationId: 'device-abc',
        }),
      ).rejects.toMatchObject({
        message: 'Debe indicar al menos un método de pago',
        statusCode: 400,
      });
    });

    it('debería rechazar si se indican más de 2 métodos de pago', async () => {
      mockQueryRunner.manager.findOne.mockResolvedValue(mockOperacionCobro);
      mockQueryRunner.manager.find.mockResolvedValue(mockCuotas);

      await expect(
        service.actualizarOperacionCobro(77, {
          cuotaIds: [10],
          conceptos: [],
          total: 5000,
          cobradorId: 5,
          installationId: 'device-abc',
          pagos: [
            { metodoPagoId: 1, monto: 2000 },
            { metodoPagoId: 2, monto: 2000 },
            { metodoPagoId: 3, monto: 1000 },
          ],
        }),
      ).rejects.toMatchObject({
        message: 'Solo se permiten hasta dos métodos de pago',
        statusCode: 400,
      });
    });

    it('debería rechazar si se repite el mismo método de pago', async () => {
      mockQueryRunner.manager.findOne.mockResolvedValue(mockOperacionCobro);
      mockQueryRunner.manager.find.mockResolvedValue(mockCuotas);

      await expect(
        service.actualizarOperacionCobro(77, {
          cuotaIds: [10],
          conceptos: [],
          total: 5000,
          cobradorId: 5,
          installationId: 'device-abc',
          pagos: [
            { metodoPagoId: 1, monto: 3000 },
            { metodoPagoId: 1, monto: 2000 },
          ],
        }),
      ).rejects.toMatchObject({
        message: 'No se puede repetir el mismo método de pago',
        statusCode: 400,
      });
    });

    it('debería rechazar si la suma de pagos es menor al total a cobrar', async () => {
      mockQueryRunner.manager.findOne.mockResolvedValue(mockOperacionCobro);
      mockQueryRunner.manager.find.mockResolvedValue(mockCuotas);

      await expect(
        service.actualizarOperacionCobro(77, {
          cuotaIds: [10],
          conceptos: [],
          total: 5000,
          cobradorId: 5,
          installationId: 'device-abc',
          pagos: [{ metodoPagoId: 1, monto: 3000 }],
        }),
      ).rejects.toMatchObject({
        message: 'La suma de importes por método debe ser al menos el monto total a cobrar (después de aplicar crédito)',
        statusCode: 400,
      });
    });

    it('debería actualizar operación exitosamente y recalcular comisión', async () => {
      mockQueryRunner.manager.findOne
        .mockResolvedValueOnce(mockOperacionCobro)
        .mockResolvedValueOnce({
          id: 77,
          lineas: [{ id: 901, cuotaId: 10 }],
        });
      mockQueryRunner.manager.find
        .mockResolvedValueOnce(mockCuotas)
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ cobradorId: 5, porcentaje: 0.1, vigenteDesde: new Date('2026-01-01') }]);

      mockQueryRunner.manager.create.mockImplementation(
        (_entity: unknown, payload: Record<string, unknown>) => payload,
      );
      mockQueryRunner.manager.save.mockResolvedValue({ id: 77 });
      mockQueryRunner.manager.delete.mockResolvedValue(undefined);

      const result = await service.actualizarOperacionCobro(77, {
        cuotaIds: [10],
        conceptos: [],
        total: 5000,
        metodoPagoId: 2,
        cobradorId: 5,
        installationId: 'device-abc',
        referencia: 'REF-NUEVA',
      });

      expect(mockQueryRunner.manager.save).toHaveBeenCalled();
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
      expect(mockQueryRunner.manager.delete).toHaveBeenCalledWith(
        CobradorCuentaCorrienteMovimiento,
        { cobroOperacionId: 77 },
      );
    });

    it('debería reemplazar pagos previos de la operación al editar el método', async () => {
      mockQueryRunner.manager.findOne
        .mockResolvedValueOnce(mockOperacionCobro)
        .mockResolvedValueOnce({
          id: 77,
          lineas: [{ id: 901, cuotaId: 10 }],
        });
      mockQueryRunner.manager.find
        .mockResolvedValueOnce(mockCuotas)
        .mockResolvedValueOnce([{ id: 901, cuotaId: 10 }])
        .mockResolvedValueOnce([
          {
            cobradorId: 5,
            porcentaje: 0.1,
            vigenteDesde: new Date('2026-01-01'),
          },
        ]);

      mockQueryRunner.manager.create.mockImplementation(
        (_entity: unknown, payload: Record<string, unknown>) => payload,
      );
      mockQueryRunner.manager.save.mockResolvedValue({ id: 77 });
      mockQueryRunner.manager.delete.mockResolvedValue(undefined);

      await service.actualizarOperacionCobro(77, {
        cuotaIds: [10],
        conceptos: [],
        total: 5000,
        metodoPagoId: 2,
        cobradorId: 5,
        installationId: 'device-abc',
      });

      expect(mockQueryRunner.manager.delete).toHaveBeenCalledWith(PagoCuota, {
        operacionCobroId: 77,
      });
    });

    it('debería distribuir edición cuando crédito cubre parte y efectivo cubre el neto', async () => {
      mockQueryRunner.manager.findOne
        .mockResolvedValueOnce(mockOperacionCobro)
        .mockResolvedValueOnce({ id: 1, estado: 'ACTIVO' })
        .mockResolvedValueOnce({
          id: 77,
          lineas: [{ id: 901, cuotaId: 10 }],
          socio: { id: 1, nombre: 'Juan', apellido: 'Pérez' },
          metodoPago: { id: 1, nombre: 'Efectivo' },
        });
      mockQueryRunner.manager.find
        .mockResolvedValueOnce(mockCuotas)
        .mockResolvedValueOnce([{ id: 901, cuotaId: 10 }])
        .mockResolvedValueOnce([
          {
            cobradorId: 5,
            porcentaje: 0.1,
            vigenteDesde: new Date('2026-01-01'),
          },
        ]);
      mockQueryRunner.manager.create.mockImplementation(
        (_entity: unknown, payload: Record<string, unknown>) => payload,
      );
      mockQueryRunner.manager.save.mockImplementation(async (entity) => entity);
      mockQueryRunner.manager.delete.mockResolvedValue(undefined);
      mockCreditoService.aplicarCreditoIndividual.mockResolvedValueOnce({
        creditoAplicado: 2000,
        nuevoSaldo: 0,
        montoACobrar: 3000,
      });

      await service.actualizarOperacionCobro(77, {
        cuotaIds: [10],
        conceptos: [],
        pagos: [{ metodoPagoId: 1, monto: 3000 }],
        cobradorId: 5,
        installationId: 'device-abc',
        total: 3000,
      });

      const pagosGuardados = mockQueryRunner.manager.save.mock.calls
        .map((call) => call[0])
        .filter((entity) => entity && 'montoPagado' in entity);

      expect(pagosGuardados).toHaveLength(1);
      expect(pagosGuardados[0].montoPagado).toBe(3000);
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
    });

    it('debería conservar referencia y observaciones si no se envían en la edición', async () => {
      const operacion = {
        ...mockOperacionCobro,
        referencia: 'REF-001',
        observaciones: 'Test',
      };
      mockQueryRunner.manager.findOne
        .mockResolvedValueOnce(operacion)
        .mockResolvedValueOnce({
          id: 77,
          lineas: [{ id: 901, cuotaId: 10 }],
        });
      mockQueryRunner.manager.find
        .mockResolvedValueOnce(mockCuotas)
        .mockResolvedValueOnce([{ id: 901, cuotaId: 10 }])
        .mockResolvedValueOnce([
          {
            cobradorId: 5,
            porcentaje: 0.1,
            vigenteDesde: new Date('2026-01-01'),
          },
        ]);

      mockQueryRunner.manager.create.mockImplementation(
        (_entity: unknown, payload: Record<string, unknown>) => payload,
      );
      mockQueryRunner.manager.save.mockResolvedValue({ id: 77 });
      mockQueryRunner.manager.delete.mockResolvedValue(undefined);

      await service.actualizarOperacionCobro(77, {
        cuotaIds: [10],
        conceptos: [],
        total: 5000,
        metodoPagoId: 2,
        cobradorId: 5,
        installationId: 'device-abc',
      });

      expect(operacion.referencia).toBe('REF-001');
      expect(operacion.observaciones).toBe('Test');
    });

    it('debería limpiar fechaPago al sacar una cuota de la operación', async () => {
      const cuotaRemovida = {
        ...mockCuotas[0],
        estado: EstadoCuota.PAGADA,
        fechaPago: new Date('2026-03-06T10:00:00.000Z'),
      };

      mockQueryRunner.manager.findOne
        .mockResolvedValueOnce(mockOperacionCobro)
        .mockResolvedValueOnce({
          id: 77,
          lineas: [{ id: 902, tipoLinea: 'CONCEPTO', concepto: 'Cargo' }],
        });
      mockQueryRunner.manager.find
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ id: 901, cuotaId: 10 }])
        .mockResolvedValueOnce([cuotaRemovida])
        .mockResolvedValueOnce([
          {
            cobradorId: 5,
            porcentaje: 0.1,
            vigenteDesde: new Date('2026-01-01'),
          },
        ]);

      mockQueryRunner.manager.create.mockImplementation(
        (_entity: unknown, payload: Record<string, unknown>) => payload,
      );
      mockQueryRunner.manager.save.mockResolvedValue({ id: 77 });
      mockQueryRunner.manager.delete.mockResolvedValue(undefined);

      await service.actualizarOperacionCobro(77, {
        cuotaIds: [],
        conceptos: [{ concepto: 'Cargo', monto: 5000 }],
        total: 5000,
        metodoPagoId: 1,
        cobradorId: 5,
        installationId: 'device-abc',
      });

      expect(cuotaRemovida.estado).toBe(EstadoCuota.PENDIENTE);
      expect(cuotaRemovida.fechaPago).toBeNull();
    });

    it('debería eliminar movimientos de comisión old y crear nuevos al cambiar total', async () => {
      const operacionConCambio = {
        ...mockOperacionCobro,
        total: 3000,
      };

      mockQueryRunner.manager.findOne
        .mockResolvedValueOnce(operacionConCambio)
        .mockResolvedValueOnce({
          id: 77,
          lineas: [{ id: 901, cuotaId: 10 }],
        });
      mockQueryRunner.manager.find
        .mockResolvedValueOnce(mockCuotas)
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ cobradorId: 5, porcentaje: 0.1, vigenteDesde: new Date('2026-01-01') }]);

      mockQueryRunner.manager.create.mockImplementation(
        (_entity: unknown, payload: Record<string, unknown>) => {
          if (payload.tipoMovimiento === 'COMISION_GENERADA') {
            return { ...payload, id: 502 };
          }
          return payload;
        },
      );
      mockQueryRunner.manager.save.mockResolvedValue({ id: 77 });
      mockQueryRunner.manager.delete.mockResolvedValue(undefined);

      await service.actualizarOperacionCobro(77, {
        cuotaIds: [10],
        conceptos: [],
        total: 5000,
        metodoPagoId: 1,
        cobradorId: 5,
        installationId: 'device-abc',
      });

      const saveCalls = mockQueryRunner.manager.save.mock.calls;
      const comisionCall = saveCalls.find(
        (call) =>
          call[0] &&
          typeof call[0] === 'object' &&
          'tipoMovimiento' in call[0] &&
          call[0].tipoMovimiento === 'COMISION_GENERADA',
      );
      expect(comisionCall).toBeDefined();
    });
  });

  describe('registrarOperacionCobro credito integration', () => {
    const mockQueryRunnerCredito = {
      connect: jest.fn().mockResolvedValue(undefined),
      startTransaction: jest.fn().mockResolvedValue(undefined),
      commitTransaction: jest.fn().mockResolvedValue(undefined),
      rollbackTransaction: jest.fn().mockResolvedValue(undefined),
      release: jest.fn().mockResolvedValue(undefined),
      manager: {
        find: jest.fn(),
        findOne: jest.fn(),
        count: jest.fn(),
        save: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        createQueryBuilder: jest.fn(),
      },
    };

    beforeEach(() => {
      mockQueryRunner.manager.find.mockReset();
      mockQueryRunner.manager.findOne.mockReset();
      mockQueryRunner.manager.save.mockReset();
      mockQueryRunner.manager.create.mockReset();
      mockQueryRunner.manager.count.mockReset();
      mockQueryRunner.commitTransaction.mockClear();
      mockQueryRunner.rollbackTransaction.mockClear();
    });

    it('debería generar solo 5000 pesos de crédito cuando cobra 15000 por una cuota de 10000', async () => {
      const mockCuota = {
        id: 10,
        socioId: 1,
        monto: 10000,
        estado: EstadoCuota.PENDIENTE,
        createdAt: new Date(),
      };
      mockQueryRunner.manager.findOne
        .mockResolvedValueOnce(null) // idempotency
        .mockResolvedValueOnce({ id: 1, activo: true }) // cobrador
        .mockResolvedValueOnce({ id: 1, estado: 'COBRADOR' }); // cobrador estado
      mockQueryRunner.manager.find
        .mockResolvedValueOnce([mockCuota]) // cuotas
        .mockResolvedValueOnce([]) // pagos
        .mockResolvedValueOnce([]) // comisiones
        .mockResolvedValueOnce([]); // dispositivos
      mockQueryRunner.manager.count.mockResolvedValue(1);
      mockQueryRunner.manager.createQueryBuilder.mockReturnValue({
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue({ id: 1, nombre: 'Juan', apellido: 'P', estado: 'COBRADOR' }),
      } as any);
      mockQueryRunner.manager.create.mockImplementation(
        (_entity: unknown, payload: Record<string, unknown>) => payload,
      );
      mockQueryRunner.manager.save.mockImplementation(async (entity) => {
        if (Array.isArray(entity)) return entity;
        return { id: 79, ...entity, fechaHoraServidor: new Date() };
      });

      mockCreditoService.aplicarCreditoIndividual.mockResolvedValueOnce({
        creditoAplicado: 0,
        nuevoSaldo: 0,
        montoACobrar: 10000,
      });
      mockCreditoService.acumularCreditoIndividual.mockResolvedValueOnce({
        saldoAnterior: 0,
        nuevoSaldo: 5000,
        creditoGenerado: 5000,
      });

      await service.registrarOperacionCobro({
        socioId: 1,
        cuotaIds: [10],
        metodoPagoId: 1,
        actorCobro: 'COBRADOR' as any,
        origenCobro: 'MOBILE' as any,
        cobradorId: 1,
        total: 15000,
      });

      expect(mockCreditoService.acumularCreditoIndividual).toHaveBeenCalledWith(
        expect.anything(),
        1,
        5000,
      );

      const operacionCreate = (mockQueryRunner.manager.create as jest.Mock).mock.calls.find(
        (call) => call[0] === CobroOperacion,
      );
      expect(operacionCreate).toBeDefined();
      expect(operacionCreate[1].totalCargos).toBe(10000);
      expect(operacionCreate[1].creditoGenerado).toBe(5000);
    });

    it('debería validar que la suma de pagos cubra montoACobrar neto (después de aplicar crédito)', async () => {
      // Scenario: charges=5000, individual credit=2000, montoACobrar=3000
      // pagos que entran deben sumar al menos 3000
      const mockCuota = {
        id: 10,
        socioId: 1,
        monto: 3000, // parte de los cargos
        estado: EstadoCuota.PENDIENTE,
        createdAt: new Date(),
      };
      const mockCuota2 = {
        id: 11,
        socioId: 1,
        monto: 2000, // resto de los cargos
        estado: EstadoCuota.PENDIENTE,
        createdAt: new Date(),
      };
      // mockQueryRunner.manager.findOne returns null (no existing operation for idempotency)
      mockQueryRunner.manager.findOne
        .mockResolvedValueOnce(null) // idempotency check
        .mockResolvedValueOnce({ id: 1, activo: true }) // cobrador active check
        .mockResolvedValueOnce({ id: 1, estado: 'COBRADOR' }); // cobrador estado
      mockQueryRunner.manager.find
        .mockResolvedValueOnce([mockCuota, mockCuota2]) // cuotas
        .mockResolvedValueOnce([]) // pagos existentes
        .mockResolvedValueOnce([]) // comisiones
        .mockResolvedValueOnce([]); // dispositivos
      mockQueryRunner.manager.count.mockResolvedValue(1);

      // Simular que Socio tiene creditoIndividual
      const mockSocioConCredito = {
        id: 1,
        nombre: 'Juan',
        apellido: 'Pérez',
        estado: 'COBRADOR',
        creditoIndividual: { saldo: 2000 },
      };
      mockQueryRunner.manager.createQueryBuilder.mockReturnValue({
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(mockSocioConCredito),
      } as any);

      mockQueryRunner.manager.create.mockImplementation(
        (_entity: unknown, payload: Record<string, unknown>) => payload,
      );
      mockQueryRunner.manager.save.mockImplementation(async (entity) => {
        if (Array.isArray(entity)) return entity;
        return { id: 78, ...entity, fechaHoraServidor: new Date() };
      });

      // Intentamos registrar con pagos=2500 (menos que montoACobrar=3000)
      // Debería fallar porque 2500 < 3000 (neto tras crédito)
      await expect(
        service.registrarOperacionCobro({
          socioId: 1,
          cuotaIds: [10, 11],
          metodoPagoId: 1,
          actorCobro: 'COBRADOR' as any,
          origenCobro: 'MOBILE' as any,
          cobradorId: 1,
          total: 2500, // informado pero con lógica de crédito esto no debería pasar
        }),
      ).rejects.toMatchObject({
        message: expect.stringContaining('monto total a cobrar'),
      });
    });

    it('debería generar crédito individual cuando el pago supera los cargos netos', async () => {
      // Scenario: charges=$5,000, pago=$7,000, overpayment=$2,000 -> credito individual
      // All peso amounts in decimal-pesos (5000 = $5,000.00)
      const mockCuota = {
        id: 10,
        socioId: 1,
        monto: 5000, // decimal pesos: $5,000.00
        estado: EstadoCuota.PENDIENTE,
        createdAt: new Date(),
      };
      mockQueryRunner.manager.findOne
        .mockResolvedValueOnce(null) // idempotency
        .mockResolvedValueOnce({ id: 1, activo: true }) // cobrador
        .mockResolvedValueOnce({ id: 1, estado: 'COBRADOR' }); // cobrador estado
      mockQueryRunner.manager.find
        .mockResolvedValueOnce([mockCuota]) // cuotas
        .mockResolvedValueOnce([]) // pagos
        .mockResolvedValueOnce([]) // comisiones
        .mockResolvedValueOnce([]); // dispositivos
      mockQueryRunner.manager.count.mockResolvedValue(1);
      mockQueryRunner.manager.createQueryBuilder.mockReturnValue({
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue({ id: 1, nombre: 'Juan', apellido: 'P', estado: 'COBRADOR' }),
      } as any);
      mockQueryRunner.manager.create.mockImplementation(
        (_entity: unknown, payload: Record<string, unknown>) => payload,
      );
      mockQueryRunner.manager.save.mockImplementation(async (entity) => {
        if (Array.isArray(entity)) return entity;
        return { id: 79, ...entity, fechaHoraServidor: new Date() };
      });

      // aplicarCreditoIndividual: no prior credit -> montoACobrar stays 5000 pesos
      mockCreditoService.aplicarCreditoIndividual.mockResolvedValueOnce({
        creditoAplicado: 0,
        nuevoSaldo: 0,
        montoACobrar: 5000,
      });
      // acumularCreditoIndividual: excedente = 7000 - 5000 = 2000 pesos
      mockCreditoService.acumularCreditoIndividual.mockResolvedValueOnce({
        saldoAnterior: 0,
        nuevoSaldo: 2000,
        creditoGenerado: 2000,
      });

      // Pago que supera los cargos genera crédito
      const result = await service.registrarOperacionCobro({
        socioId: 1,
        cuotaIds: [10],
        metodoPagoId: 1,
        actorCobro: 'COBRADOR' as any,
        origenCobro: 'MOBILE' as any,
        cobradorId: 1,
        total: 7000, // decimal pesos: $7,000 - exceeds $5,000 charge -> $2,000 credit
      });

      expect(result).toBeDefined();
      // Prove the operation stored the credit columns
      // CreditoService stores saldo in decimal-pesos; CobrosService persists the same peso amount.
      const operacionCreate = (mockQueryRunner.manager.create as jest.Mock).mock.calls.find(
        (call) => call[0] === CobroOperacion,
      );
      expect(operacionCreate).toBeDefined();
      expect(operacionCreate[1].creditoGenerado).toBe(2000);
      expect(operacionCreate[1].totalCargos).toBe(5000);
      expect(operacionCreate[1].creditoAplicado).toBe(0);
      // Prove acumularCreditoIndividual was called with excedente in decimal pesos
      expect(mockCreditoService.acumularCreditoIndividual).toHaveBeenCalledWith(
        expect.anything(),
        1,
        2000,
      );
    });

    it('debería permitir pago menor a cargos brutos cuando hay crédito individual disponible', async () => {
      // Scenario: charges=$5,000, individual credit=$2,000 applied, cobradora selects $3,000 quota
      // cash payment=$3,000 = exact match to selected quota (after credit)
      // NOTE: credit reduces montoACobrar; cobradora only selects what she can pay in cash.
      // The selected quota.monto must match the cash payment when credit is applied.
      const mockCuota = {
        id: 10,
        socioId: 1,
        monto: 3000, // decimal pesos: $3,000 - only what will be paid in cash (after credit)
        estado: EstadoCuota.PENDIENTE,
        createdAt: new Date(),
      };
      mockQueryRunner.manager.findOne
        .mockResolvedValueOnce(null) // idempotency
        .mockResolvedValueOnce({ id: 1, activo: true }) // cobrador
        .mockResolvedValueOnce({ id: 1, estado: 'COBRADOR' }); // cobrador estado
      mockQueryRunner.manager.find
        .mockResolvedValueOnce([mockCuota]) // cuotas
        .mockResolvedValueOnce([]) // pagos
        .mockResolvedValueOnce([]) // comisiones
        .mockResolvedValueOnce([]); // dispositivos
      mockQueryRunner.manager.count.mockResolvedValue(1);
      mockQueryRunner.manager.createQueryBuilder.mockReturnValue({
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue({ id: 1, nombre: 'Juan', estado: 'COBRADOR' }),
      } as any);
      mockQueryRunner.manager.create.mockImplementation(
        (_entity: unknown, payload: Record<string, unknown>) => payload,
      );
      mockQueryRunner.manager.save.mockImplementation(async (entity) => {
        if (Array.isArray(entity)) return entity;
        return { id: 80, ...entity, fechaHoraServidor: new Date() };
      });

      // aplicarCreditoIndividual: 2000 pesos credit applied; 3000 pesos remain as cash payment.
      mockCreditoService.aplicarCreditoIndividual.mockResolvedValueOnce({
        creditoAplicado: 2000,
        nuevoSaldo: 0,
        montoACobrar: 3000,
      });
      // No new credit generated
      mockCreditoService.acumularCreditoIndividual.mockResolvedValueOnce({
        saldoAnterior: 0,
        nuevoSaldo: 0,
        creditoGenerado: 0,
      });

      // Cash payment = $3,000 (decimal pesos) = montoACobrar (net after credit)
      const result = await service.registrarOperacionCobro({
        socioId: 1,
        cuotaIds: [10],
        metodoPagoId: 1,
        pagos: [{ metodoPagoId: 1, monto: 3000 }], // 3000 decimal pesos = $3,000
        actorCobro: 'COBRADOR' as any,
        origenCobro: 'MOBILE' as any,
        cobradorId: 1,
        total: 3000, // cash collected
      });

      expect(result).toBeDefined();
      // Prove operation stored credit columns correctly
      const operacionCreate = (mockQueryRunner.manager.create as jest.Mock).mock.calls.find(
        (call) => call[0] === CobroOperacion,
      );
      expect(operacionCreate).toBeDefined();
      // totalCargos reflects selected quota value (from selected cuotas)
      expect(operacionCreate[1].totalCargos).toBe(3000);
      expect(operacionCreate[1].creditoAplicado).toBe(2000);
      expect(operacionCreate[1].creditoGenerado).toBe(0);
      // Prove acumular was NOT called (no overpayment)
      expect(mockCreditoService.acumularCreditoIndividual).not.toHaveBeenCalled();
    });

    it('debería ocultar crédito grupal en contexto individual', async () => {
      // Scenario: member belongs to group with 1000 group credit
      // but individual view should NOT expose or use group credit
      const mockCuota = {
        id: 10,
        socioId: 1,
        monto: 5000, // decimal pesos: $5,000.00
        estado: EstadoCuota.PENDIENTE,
        createdAt: new Date(),
      };
      mockQueryRunner.manager.findOne
        .mockResolvedValueOnce(null) // idempotency
        .mockResolvedValueOnce({ id: 1, activo: true }) // cobrador
        .mockResolvedValueOnce({ id: 1, estado: 'COBRADOR' }); // cobrador estado
      mockQueryRunner.manager.find
        .mockResolvedValueOnce([mockCuota]) // cuotas
        .mockResolvedValueOnce([]) // pagos
        .mockResolvedValueOnce([]) // comisiones
        .mockResolvedValueOnce([]); // dispositivos
      mockQueryRunner.manager.count.mockResolvedValue(1);
      mockQueryRunner.manager.createQueryBuilder.mockReturnValue({
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue({
          id: 1,
          nombre: 'Juan',
          apellido: 'P',
          estado: 'COBRADOR',
          grupoFamiliarId: 5, // belongs to group
          // NO creditoIndividual field = no individual credit
        }),
      } as any);
      mockQueryRunner.manager.create.mockImplementation(
        (_entity: unknown, payload: Record<string, unknown>) => payload,
      );
      mockQueryRunner.manager.save.mockImplementation(async (entity) => {
        if (Array.isArray(entity)) return entity;
        return { id: 80, ...entity, fechaHoraServidor: new Date() };
      });

      // Individual context: only individual credit can be applied here.
      mockCreditoService.aplicarCreditoIndividual.mockResolvedValueOnce({
        creditoAplicado: 0,
        nuevoSaldo: 0,
        montoACobrar: 5000,
      });

      const result = await service.registrarOperacionCobro({
        socioId: 1,
        cuotaIds: [10],
        metodoPagoId: 1,
        actorCobro: 'COBRADOR' as any,
        origenCobro: 'MOBILE' as any,
        cobradorId: 1,
        total: 5000, // decimal pesos: exact match - no credit applied
      });

      expect(result).toBeDefined();
      // Prove group credit was NOT used in individual context
      expect((result as any).credito).toBeDefined();
      // creditoDisponible must be 0 (no individual credit existed)
      expect((result as any).credito.creditoDisponible).toBe(0);
      // creditoAplicado must be 0 (group credit cannot be applied in individual context)
      expect((result as any).credito.creditoAplicado).toBe(0);
      // montoACobrar must equal total charges (5000) since no credit was used
      expect((result as any).credito.montoACobrar).toBe(5000);
    });

    it('debería aceptar idempotency replay sin ejecutar lógica de crédito nuevamente', async () => {
      // Scenario: same idempotencyKey returns existing operation
      const existingOperacion = {
        id: 99,
        socioId: 1,
        idempotencyKey: 'idempotent-credit-test-1',
        total: 5000,
        lineas: [{ id: 901, cuotaId: 10, tipoLinea: 'CUOTA', monto: 5000 }],
        socio: { id: 1, nombre: 'Juan', apellido: 'Pérez' },
      };

      mockQueryRunner.manager.findOne.mockResolvedValue(existingOperacion);

      const result = await service.registrarOperacionCobro({
        socioId: 1,
        cuotaIds: [10],
        metodoPagoId: 1,
        actorCobro: 'OPERADOR' as any,
        origenCobro: 'WEB' as any,
        total: 5000,
        idempotencyKey: 'idempotent-credit-test-1',
      });

      expect(result).toBe(existingOperacion);
      // No additional credit operations should have been executed
      expect(mockQueryRunner.manager.find).not.toHaveBeenCalled();
    });

    it('debería completar distribución cuando crédito cubre parte y efectivo cubre el resto (5000 cargos, 2000 crédito, 3000 efectivo)', async () => {
      // Scenario: charges=$5,000, individual credit=$2,000 applied.
      // Net cash needed = $3,000; the credit bucket covers $2,000 of the quota.
      const mockCuota = {
        id: 10,
        socioId: 1,
        monto: 5000, // decimal pesos: $5,000.00 full charge
        estado: EstadoCuota.PENDIENTE,
        createdAt: new Date(),
      };
      mockQueryRunner.manager.findOne
        .mockResolvedValueOnce(null) // idempotency
        .mockResolvedValueOnce({ id: 1, activo: true }) // cobrador
        .mockResolvedValueOnce({ id: 1, estado: 'COBRADOR' }); // cobrador estado
      mockQueryRunner.manager.find
        .mockResolvedValueOnce([mockCuota]) // cuotas
        .mockResolvedValueOnce([]) // pagos
        .mockResolvedValueOnce([]) // comisiones
        .mockResolvedValueOnce([]); // dispositivos
      mockQueryRunner.manager.count.mockResolvedValue(1);
      mockQueryRunner.manager.createQueryBuilder.mockReturnValue({
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue({ id: 1, nombre: 'Juan', estado: 'COBRADOR' }),
      } as any);
      mockQueryRunner.manager.create.mockImplementation(
        (_entity: unknown, payload: Record<string, unknown>) => payload,
      );
      mockQueryRunner.manager.save.mockImplementation(async (entity) => {
        if (Array.isArray(entity)) return entity;
        return { id: 81, ...entity, fechaHoraServidor: new Date() };
      });

      mockCreditoService.aplicarCreditoIndividual.mockResolvedValueOnce({
        creditoAplicado: 2000,
        nuevoSaldo: 0,
        montoACobrar: 3000,
      });
      // No new credit generated (cash exactly covers net amount)
      mockCreditoService.acumularCreditoIndividual.mockResolvedValueOnce({
        saldoAnterior: 0,
        nuevoSaldo: 0,
        creditoGenerado: 0,
      });

      // Cash payment = $3,000 (decimal pesos) = exact match to montoACobrar after credit
      const result = await service.registrarOperacionCobro({
        socioId: 1,
        cuotaIds: [10],
        metodoPagoId: 1,
        pagos: [{ metodoPagoId: 1, monto: 3000 }], // 3000 decimal pesos = $3,000
        actorCobro: 'COBRADOR' as any,
        origenCobro: 'MOBILE' as any,
        cobradorId: 1,
        total: 3000, // cash collected = montoACobrar (net after credit)
      });

      expect(result).toBeDefined();
      // Prove the operation has the credito summary attached
      expect((result as any).credito).toBeDefined();
      expect((result as any).credito.creditoAplicado).toBe(2000);
      expect((result as any).credito.montoACobrar).toBe(3000);
      expect((result as any).credito.creditoGenerado).toBe(0);
      // Prove operation persisted credit columns correctly
      const operacionCreate = (mockQueryRunner.manager.create as jest.Mock).mock.calls.find(
        (call) => call[0] === CobroOperacion,
      );
      expect(operacionCreate).toBeDefined();
      expect(operacionCreate[1].creditoAplicado).toBe(2000);
      expect(operacionCreate[1].totalCargos).toBe(5000);
      expect(operacionCreate[1].creditoGenerado).toBe(0);
      // Prove PagoCuota records were created for the cash portion (300000c)
      const pagoCuotaSaves = (mockQueryRunner.manager.save as jest.Mock).mock.calls.filter(
        (call) => !Array.isArray(call[0]) && call[0].constructor.name === 'Object' && call[0].montoPagado !== undefined,
      );
      expect(pagoCuotaSaves.length).toBeGreaterThan(0);
      // Sum of PagoCuota.montoPagado should equal cash paid (3000 decimal pesos)
      const totalPagado = pagoCuotaSaves.reduce((sum, call) => sum + Number(call[0].montoPagado), 0);
      expect(totalPagado).toBe(3000);
    });

    it('debería generar nuevo crédito individual cuando el pago excede montoACobrar después de aplicar crédito', async () => {
      // Scenario: charges=$5,000, individual credit=$2,000 applied.
      // Net cash needed = $3,000; $3,500 cash generates $500 of new individual credit.
      const mockCuota = {
        id: 10,
        socioId: 1,
        monto: 5000, // decimal pesos: $5,000.00
        estado: EstadoCuota.PENDIENTE,
        createdAt: new Date(),
      };
      mockQueryRunner.manager.findOne
        .mockResolvedValueOnce(null) // idempotency
        .mockResolvedValueOnce({ id: 1, activo: true }) // cobrador
        .mockResolvedValueOnce({ id: 1, estado: 'COBRADOR' }); // cobrador estado
      mockQueryRunner.manager.find
        .mockResolvedValueOnce([mockCuota]) // cuotas
        .mockResolvedValueOnce([]) // pagos
        .mockResolvedValueOnce([]) // comisiones
        .mockResolvedValueOnce([]); // dispositivos
      mockQueryRunner.manager.count.mockResolvedValue(1);
      mockQueryRunner.manager.createQueryBuilder.mockReturnValue({
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue({ id: 1, nombre: 'Juan', estado: 'COBRADOR' }),
      } as any);
      mockQueryRunner.manager.create.mockImplementation(
        (_entity: unknown, payload: Record<string, unknown>) => payload,
      );
      mockQueryRunner.manager.save.mockImplementation(async (entity) => {
        if (Array.isArray(entity)) return entity;
        return { id: 82, ...entity, fechaHoraServidor: new Date() };
      });

      mockCreditoService.aplicarCreditoIndividual.mockResolvedValueOnce({
        creditoAplicado: 2000,
        nuevoSaldo: 0,
        montoACobrar: 3000,
      });
      // acumularCreditoIndividual: excedente = 3500 - 3000 = 500 pesos
      mockCreditoService.acumularCreditoIndividual.mockResolvedValueOnce({
        saldoAnterior: 0,
        nuevoSaldo: 500,
        creditoGenerado: 500,
      });

      // Cash payment = $3,500, exceeds montoACobjar (300000c) by 50000c
      const result = await service.registrarOperacionCobro({
        socioId: 1,
        cuotaIds: [10],
        metodoPagoId: 1,
        pagos: [{ metodoPagoId: 1, monto: 3500 }], // 3500 decimal pesos > 300000c net
        actorCobro: 'COBRADOR' as any,
        origenCobro: 'MOBILE' as any,
        cobradorId: 1,
        total: 3500, // cash collected
      });

      expect(result).toBeDefined();
      expect((result as any).credito).toBeDefined();
      expect((result as any).credito.creditoAplicado).toBe(2000);
      expect((result as any).credito.creditoGenerado).toBe(500);
      // Prove accumulate was called with excedente in decimal pesos
      expect(mockCreditoService.acumularCreditoIndividual).toHaveBeenCalledWith(
        expect.anything(),
        1,
        500,
      );
    });
  });

  // ============================================================
  // TDD RED: Tests for credito.montoACobrar contract correctness
  // ============================================================
  describe('credito.montoACobrar contract — individual operations', () => {
    it('debería retornar montoACobrar NETO (no pago) cuando hay sobrepago tras aplicar crédito', async () => {
      // Scenario: charges=$5,000, individual credit=$2,000 applied.
      // Net amount due = $3,000, cobradora pays $3,500 cash.
      // credito.montoACobrar must be the NET amount = $3,000, NOT the cash paid $3,500
      const mockCuota = {
        id: 10,
        socioId: 1,
        monto: 5000,
        estado: EstadoCuota.PENDIENTE,
        createdAt: new Date(),
      };
      mockQueryRunner.manager.findOne
        .mockResolvedValueOnce(null) // idempotency: no prior op
        .mockResolvedValueOnce({ id: 1, activo: true }) // cobrador exists
        .mockResolvedValueOnce({ id: 1, estado: 'COBRADOR' }); // cobrador estado
      mockQueryRunner.manager.find
        .mockResolvedValueOnce([mockCuota]) // cuotas
        .mockResolvedValueOnce([]) // pagos
        .mockResolvedValueOnce([]) // comisiones
        .mockResolvedValueOnce([]); // dispositivos
      mockQueryRunner.manager.count.mockResolvedValue(1);
      mockQueryRunner.manager.createQueryBuilder.mockReturnValue({
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue({ id: 1, nombre: 'Juan', estado: 'COBRADOR' }),
      } as any);
      mockQueryRunner.manager.create.mockImplementation(
        (_entity: unknown, payload: Record<string, unknown>) => payload,
      );
      mockQueryRunner.manager.save.mockImplementation(async (entity) => {
        if (Array.isArray(entity)) return entity;
        return { id: 99, ...entity, fechaHoraServidor: new Date() };
      });

      mockCreditoService.aplicarCreditoIndividual.mockResolvedValueOnce({
        creditoAplicado: 2000,
        nuevoSaldo: 0,
        montoACobrar: 3000,
      });
      // Cash exceeded net by 500 pesos → new credit generated
      mockCreditoService.acumularCreditoIndividual.mockResolvedValueOnce({
        saldoAnterior: 0,
        nuevoSaldo: 500,
        creditoGenerado: 500,
      });

      // Payment: $3,500 — exceeds the net $3,000 by $50
      const result = await service.registrarOperacionCobro({
        socioId: 1,
        cuotaIds: [10],
        metodoPagoId: 1,
        pagos: [{ metodoPagoId: 1, monto: 3500 }],
        actorCobro: 'COBRADOR' as any,
        origenCobro: 'MOBILE' as any,
        cobradorId: 1,
        total: 3500,
      });

      expect(result).toBeDefined();
      expect((result as any).credito).toBeDefined();
      // montoACobrar must be the NET amount due after credit = $3,000
      // NOT the cash paid ($3,500) which includes overpayment
      expect((result as any).credito.montoACobrar).toBe(3000);
    });

    it('debería registrar con dos métodos de pago después de aplicar crédito individual', async () => {
      // Scenario: charges=$5,000, individual credit=$2,000 applied.
      // Net cash needed = $3,000. Two payment methods: $2,000 + $1,000 = $3,000
      // After credit: creditoDisponible=2000, creditoAplicado=2000, saldoCreditoDespues=0
      const mockCuota = {
        id: 10,
        socioId: 1,
        monto: 5000,
        estado: EstadoCuota.PENDIENTE,
        createdAt: new Date(),
      };
      mockQueryRunner.manager.findOne
        .mockResolvedValueOnce(null) // idempotency
        .mockResolvedValueOnce({ id: 1, activo: true }) // cobrador
        .mockResolvedValueOnce({ id: 1, estado: 'COBRADOR' }); // cobrador estado
      mockQueryRunner.manager.find
        .mockResolvedValueOnce([mockCuota]) // cuotas
        .mockResolvedValueOnce([]) // pagos
        .mockResolvedValueOnce([]) // comisiones
        .mockResolvedValueOnce([]); // dispositivos
      mockQueryRunner.manager.count.mockResolvedValue(1);
      mockQueryRunner.manager.createQueryBuilder.mockReturnValue({
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue({ id: 1, nombre: 'Juan', estado: 'COBRADOR' }),
      } as any);
      mockQueryRunner.manager.create.mockImplementation(
        (_entity: unknown, payload: Record<string, unknown>) => payload,
      );
      mockQueryRunner.manager.save.mockImplementation(async (entity) => {
        if (Array.isArray(entity)) return entity;
        return { id: 82, ...entity, fechaHoraServidor: new Date() };
      });

      mockCreditoService.aplicarCreditoIndividual.mockResolvedValueOnce({
        creditoAplicado: 2000,
        nuevoSaldo: 0,
        montoACobrar: 3000,
      });

      // Two payment methods: 2000 + 1000 = 3000 decimal pesos = exact net amount
      const result = await service.registrarOperacionCobro({
        socioId: 1,
        cuotaIds: [10],
        metodoPagoId: 1,
        pagos: [
          { metodoPagoId: 1, monto: 2000 },
          { metodoPagoId: 2, monto: 1000 },
        ],
        actorCobro: 'COBRADOR' as any,
        origenCobro: 'MOBILE' as any,
        cobradorId: 1,
        total: 3000,
      });

      expect(result).toBeDefined();
      expect((result as any).credito).toBeDefined();
      // creditoDisponible: credit available BEFORE this operation in individual context
      expect((result as any).credito.creditoDisponible).toBe(2000);
      expect((result as any).credito.creditoAplicado).toBe(2000);
      // montoACobrar: net after credit = $3,000
      expect((result as any).credito.montoACobrar).toBe(3000);
      // creditoGenerado: no overpayment
      expect((result as any).credito.creditoGenerado).toBe(0);
      // saldoCreditoDespues: after applying credit (all used)
      expect((result as any).credito.saldoCreditoDespues).toBe(0);
    });
  });

  describe('registrarCobroGrupal credito integration', () => {
    it('debería aplicar crédito grupal cuando existe saldo disponible', async () => {
      // Scenario: group has 2000 grupal credit, total charges 5000 (two socios x 2500 each)
      // Group credit should be applied: 5000 - 2000 = 3000 net cash needed
      // Payment = 5000 (exact match to total, credit covers 2000, no excess)
      const mockCuota1 = { id: 10, socioId: 1, monto: 2500, estado: EstadoCuota.PENDIENTE, createdAt: new Date() };
      const mockCuota2 = { id: 11, socioId: 2, monto: 2500, estado: EstadoCuota.PENDIENTE, createdAt: new Date() };

      let findCallCount = 0;
      mockQueryRunner.manager.find.mockImplementation((entity) => {
        if (entity === CobroOperacion) return Promise.resolve([]); // no prior idempotent ops
        if (entity === Cuota) {
          findCallCount++;
          if (findCallCount === 1) return Promise.resolve([mockCuota1]);
          if (findCallCount === 2) return Promise.resolve([mockCuota2]);
          return Promise.resolve([]);
        }
        return Promise.resolve([]);
      });
      mockQueryRunner.manager.count.mockResolvedValue(1);
      mockQueryRunner.manager.createQueryBuilder.mockReturnValue({
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue({ id: 1, nombre: 'Juan', estado: 'COBRADOR' }),
      } as any);
      mockQueryRunner.manager.create.mockImplementation(
        (_entity: unknown, payload: Record<string, unknown>) => payload,
      );
      mockQueryRunner.manager.save.mockImplementation(async (entity) => {
        if (Array.isArray(entity)) return entity;
        return { id: 81, ...entity, fechaHoraServidor: new Date() };
      });

      mockCreditoService.aplicarCreditoGrupal.mockResolvedValueOnce({
        creditoAplicado: 2000,
        nuevoSaldo: 0,
        montoACobrar: 3000,
      });

      const result = await service.registrarCobroGrupal({
        grupoId: 5,
        cobros: [
          { socioId: 1, cuotaIds: [10] },
          { socioId: 2, cuotaIds: [11] },
        ],
        pagos: [{ metodoPagoId: 1, monto: 5000 }],
        actorCobro: 'COBRADOR' as any,
        origenCobro: 'MOBILE' as any,
        cobradorId: 1,
        total: 5000,
      });

      expect(result).toHaveLength(2);
      expect(mockCreditoService.aplicarCreditoGrupal).toHaveBeenCalled();
      // Prove operation has credito summary attached (not raw entity)
      expect((result[0] as any).credito).toBeDefined();
      expect((result[0] as any).credito.montoACobrar).toBe(3000);
    });

it('debería acumular crédito grupal cuando el pago supera los cargos netos', async () => {
      // Scenario: group charges 4000 decimal pesos ($4,000), payment 4600 decimal pesos ($4,600)
      // -> 600 decimal pesos excess becomes group credit
      const mockCuota1 = { id: 10, socioId: 1, monto: 2000, estado: EstadoCuota.PENDIENTE, createdAt: new Date() };
      const mockCuota2 = { id: 11, socioId: 2, monto: 2000, estado: EstadoCuota.PENDIENTE, createdAt: new Date() };

      let findCallCount = 0;
      mockQueryRunner.manager.find.mockImplementation((entity) => {
        if (entity === CobroOperacion) {
          return Promise.resolve([]); // idempotency
        }
        if (entity === Cuota) {
          findCallCount++;
          if (findCallCount === 1) return Promise.resolve([mockCuota1]);
          if (findCallCount === 2) return Promise.resolve([mockCuota2]);
          return Promise.resolve([]);
        }
        return Promise.resolve([]);
      });
      mockQueryRunner.manager.count.mockResolvedValue(1);
      mockQueryRunner.manager.createQueryBuilder.mockReturnValue({
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue({ id: 1, nombre: 'Juan', estado: 'COBRADOR' }),
      } as any);
      mockQueryRunner.manager.create.mockImplementation(
        (_entity: unknown, payload: Record<string, unknown>) => payload,
      );
      mockQueryRunner.manager.save.mockImplementation(async (entity) => {
        if (Array.isArray(entity)) return entity;
        return { id: 82, ...entity, fechaHoraServidor: new Date() };
      });

      // No prior group credit applied
      mockCreditoService.aplicarCreditoGrupal.mockResolvedValueOnce({
        creditoAplicado: 0,
        nuevoSaldo: 0,
        montoACobrar: 4000,
      });
      // acumularCreditoGrupal called with excedente = 4600 - 4000 = 600 pesos
      mockCreditoService.acumularCreditoGrupal.mockResolvedValueOnce({
        saldoAnterior: 0,
        nuevoSaldo: 600,
        creditoGenerado: 600,
      });

      // Payment 4600 decimal pesos > 4000 charges -> 600 excess becomes group credit
      const result = await service.registrarCobroGrupal({
        grupoId: 5,
        cobros: [
          { socioId: 1, cuotaIds: [10] },
          { socioId: 2, cuotaIds: [11] },
        ],
        pagos: [{ metodoPagoId: 1, monto: 4600 }], // 4600 decimal pesos
        actorCobro: 'COBRADOR' as any,
        origenCobro: 'MOBILE' as any,
        cobradorId: 1,
        total: 4000, // total brutto in decimal pesos
      });

      expect(result).toHaveLength(2);
      expect(mockCreditoService.aplicarCreditoGrupal).toHaveBeenCalled();
      // Prove acumularCreditoGrupal was called with the excess amount in decimal pesos
      expect(mockCreditoService.acumularCreditoGrupal).toHaveBeenCalledWith(
        expect.anything(),
        5,
        600,
      );
      // Prove operation has credito summary with correct creditoGenerado
      expect((result[0] as any).credito).toBeDefined();
      expect((result[0] as any).credito.creditoGenerado).toBe(600);
      // Prove group operations stored the new credit columns
      // CreditoService stores saldo in decimal pesos.
      const socio1Create = (mockQueryRunner.manager.create as jest.Mock).mock.calls.find(
        (call) => call[0] === CobroOperacion && call[1].socioId === 1,
      );
      expect(socio1Create).toBeDefined();
      expect(socio1Create[1].creditoGenerado).toBe(600);
      expect(socio1Create[1].totalCargos).toBe(2000);
      expect(socio1Create[1].grupoFamiliarId).toBe(5);
    });

    it('debería completar distribución grupal cuando crédito cubre parte y efectivo cubre el resto (1200 cargos, 800 crédito, 400 efectivo)', async () => {
      // Scenario: group charges=$1,200 (120000c), group credit=$800 (80000c) applied
      // net cash needed = 40000c ($400), cobradora pays exactly 40000c cash
      // Two members: socio1=70000c ($700), socio2=50000c ($500) charges
      // After group credit: net = 40000c cash needed
      const mockCuota1 = { id: 10, socioId: 1, monto: 700, estado: EstadoCuota.PENDIENTE, createdAt: new Date() };
      const mockCuota2 = { id: 11, socioId: 2, monto: 500, estado: EstadoCuota.PENDIENTE, createdAt: new Date() };

      let findCallCount = 0;
      mockQueryRunner.manager.find.mockImplementation((entity) => {
        if (entity === CobroOperacion) return Promise.resolve([]);
        if (entity === Cuota) {
          findCallCount++;
          if (findCallCount === 1) return Promise.resolve([mockCuota1]);
          if (findCallCount === 2) return Promise.resolve([mockCuota2]);
          return Promise.resolve([]);
        }
        return Promise.resolve([]);
      });
      mockQueryRunner.manager.count.mockResolvedValue(1);
      mockQueryRunner.manager.createQueryBuilder.mockReturnValue({
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue({ id: 1, nombre: 'Juan', estado: 'COBRADOR' }),
      } as any);
      mockQueryRunner.manager.create.mockImplementation(
        (_entity: unknown, payload: Record<string, unknown>) => payload,
      );
      mockQueryRunner.manager.save.mockImplementation(async (entity) => {
        if (Array.isArray(entity)) return entity;
        return { id: 83, ...entity, fechaHoraServidor: new Date() };
      });

      mockCreditoService.aplicarCreditoGrupal.mockResolvedValueOnce({
        creditoAplicado: 800,
        nuevoSaldo: 0,
        montoACobrar: 400,
      });
      // No new group credit generated (cash exactly matches net amount)
      mockCreditoService.acumularCreditoGrupal.mockResolvedValueOnce({
        saldoAnterior: 0,
        nuevoSaldo: 0,
        creditoGenerado: 0,
      });

      const result = await service.registrarCobroGrupal({
        grupoId: 5,
        cobros: [
          { socioId: 1, cuotaIds: [10] },
          { socioId: 2, cuotaIds: [11] },
        ],
        pagos: [{ metodoPagoId: 1, monto: 400 }], // 400 decimal pesos = $400 cash = net after credit
        actorCobro: 'COBRADOR' as any,
        origenCobro: 'MOBILE' as any,
        cobradorId: 1,
        total: 1200, // total brutto charges
      });

      expect(result).toHaveLength(2);
      // Prove each member operation has credito summary attached
      expect((result[0] as any).credito).toBeDefined();
      expect((result[0] as any).credito.creditoAplicado).toBeGreaterThan(0);
      expect((result[0] as any).credito.montoACobrar).toBeDefined();
      expect((result[0] as any).credito.creditoGenerado).toBe(0);
      // Prove operaciones were created with total as actual cash collected
      const socio1Create = (mockQueryRunner.manager.create as jest.Mock).mock.calls.find(
        (call) => call[0] === CobroOperacion && call[1].socioId === 1,
      );
      expect(socio1Create).toBeDefined();
      // Verify credit was applied (proportional to member's share of group charges)
      expect(socio1Create[1].creditoAplicado).toBeGreaterThan(0);
    });

    it('debería generar nuevo crédito grupal cuando el pago excede montoACobrar después de aplicar crédito grupal', async () => {
      // Scenario: group charges=$1,200 (120000c), group credit=$800 (80000c) applied
      // net cash needed = 40000c, cobradora pays $600 cash
      // excess = 60000c - 40000c = 20000c ($200) becomes new group credit
      const mockCuota1 = { id: 10, socioId: 1, monto: 700, estado: EstadoCuota.PENDIENTE, createdAt: new Date() };
      const mockCuota2 = { id: 11, socioId: 2, monto: 500, estado: EstadoCuota.PENDIENTE, createdAt: new Date() };

      let findCallCount = 0;
      mockQueryRunner.manager.find.mockImplementation((entity) => {
        if (entity === CobroOperacion) return Promise.resolve([]);
        if (entity === Cuota) {
          findCallCount++;
          if (findCallCount === 1) return Promise.resolve([mockCuota1]);
          if (findCallCount === 2) return Promise.resolve([mockCuota2]);
          return Promise.resolve([]);
        }
        return Promise.resolve([]);
      });
      mockQueryRunner.manager.count.mockResolvedValue(1);
      mockQueryRunner.manager.createQueryBuilder.mockReturnValue({
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue({ id: 1, nombre: 'Juan', estado: 'COBRADOR' }),
      } as any);
      mockQueryRunner.manager.create.mockImplementation(
        (_entity: unknown, payload: Record<string, unknown>) => payload,
      );
      mockQueryRunner.manager.save.mockImplementation(async (entity) => {
        if (Array.isArray(entity)) return entity;
        return { id: 84, ...entity, fechaHoraServidor: new Date() };
      });

      mockCreditoService.aplicarCreditoGrupal.mockResolvedValueOnce({
        creditoAplicado: 800,
        nuevoSaldo: 0,
        montoACobrar: 400,
      });
      // accumulate: excedente = 600 - 400 = 200 pesos -> new group credit
      mockCreditoService.acumularCreditoGrupal.mockResolvedValueOnce({
        saldoAnterior: 0,
        nuevoSaldo: 200,
        creditoGenerado: 200,
      });

      const result = await service.registrarCobroGrupal({
        grupoId: 5,
        cobros: [
          { socioId: 1, cuotaIds: [10] },
          { socioId: 2, cuotaIds: [11] },
        ],
        pagos: [{ metodoPagoId: 1, monto: 600 }], // 600 decimal pesos > 40000c net
        actorCobro: 'COBRADOR' as any,
        origenCobro: 'MOBILE' as any,
        cobradorId: 1,
        total: 1200,
      });

      expect(result).toHaveLength(2);
      // Prove accumulate was called with excedente in decimal pesos
      expect(mockCreditoService.acumularCreditoGrupal).toHaveBeenCalledWith(
        expect.anything(),
        5,
        200,
      );
      // Prove credito summary reflects new group credit generated
      expect((result[0] as any).credito).toBeDefined();
      expect((result[0] as any).credito.creditoGenerado).toBeGreaterThan(0);
    });
  });

  describe('pagoAnual', () => {
    const mockSocioActivo = {
      id: 1,
      nombre: 'Juan',
      apellido: 'Pérez',
      estado: 'ACTIVO',
      categoria: { id: 1, nombre: 'General', montoMensual: 5000, exento: false },
    };

    const mockMetodoPago = { id: 1, activo: true };

    const setupMocksCuotasVacias = () => {
      // findOne: socio, luego método de pago, luego recalcular estado (socio)
      mockQueryRunner.manager.findOne
        .mockResolvedValueOnce(mockSocioActivo)   // socio
        .mockResolvedValueOnce(mockMetodoPago)    // método de pago
        .mockResolvedValue({ id: 1, estado: 'ACTIVO' }); // recalcular estado

      // createQueryBuilder para obtener cuotas existentes del año
      const mockQb = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      };
      mockQueryRunner.manager.createQueryBuilder.mockReturnValue(mockQb);

      // count para recalcularEstadoSocioPorMorosidad
      mockQueryRunner.manager.count.mockResolvedValue(0);

      // create devuelve el objeto con createdAt para que PagoCuota se construya bien
      mockQueryRunner.manager.create.mockImplementation((_entity, data) => ({
        ...data,
        createdAt: new Date(),
      }));
      mockQueryRunner.manager.save.mockImplementation((entity) =>
        Promise.resolve({ ...entity, id: Math.floor(Math.random() * 1000) }),
      );
    };

    it('debería generar y pagar 12 cuotas cuando el socio no tiene ninguna', async () => {
      setupMocksCuotasVacias();

      const result = await service.pagoAnual({
        socioId: 1,
        anio: 2026,
        metodoPagoId: 1,
      });

      expect(result.cuotasGeneradas).toBe(12);
      expect(result.cuotasPagadas).toBe(12);
      expect(result.cuotasYaPagadas).toBe(0);
      expect(result.periodosPagados).toHaveLength(12);
      expect(result.periodosPagados[0]).toBe('2026-01');
      expect(result.periodosPagados[11]).toBe('2026-12');
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
    });

    it('debería omitir cuotas ya pagadas y pagar solo las pendientes', async () => {
      mockQueryRunner.manager.findOne
        .mockResolvedValueOnce(mockSocioActivo)
        .mockResolvedValueOnce(mockMetodoPago)
        .mockResolvedValue({ id: 1, estado: 'ACTIVO' });

      const cuotasExistentes = [
        { id: 10, periodo: '2026-01', monto: 5000, estado: EstadoCuota.PAGADA, createdAt: new Date() },
        { id: 11, periodo: '2026-02', monto: 5000, estado: EstadoCuota.PENDIENTE, createdAt: new Date() },
      ];

      const mockQb = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(cuotasExistentes),
      };
      mockQueryRunner.manager.createQueryBuilder.mockReturnValue(mockQb);
      mockQueryRunner.manager.count.mockResolvedValue(0);
      mockQueryRunner.manager.create.mockImplementation((_entity, data) => ({ ...data, createdAt: new Date() }));
      mockQueryRunner.manager.save.mockImplementation((entity) => Promise.resolve({ ...entity, id: 99 }));

      const result = await service.pagoAnual({ socioId: 1, anio: 2026, metodoPagoId: 1 });

      // 01 ya pagada → omitida; 02 pendiente → pagada; 03-12 no existen → generadas y pagadas
      expect(result.cuotasYaPagadas).toBe(1);
      expect(result.cuotasPagadas).toBe(11);
      expect(result.cuotasGeneradas).toBe(10);
      expect(result.periodosPagados).not.toContain('2026-01');
      expect(result.periodosPagados).toContain('2026-02');
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
    });

    it('debería lanzar CustomError cuando el socio no existe', async () => {
      mockQueryRunner.manager.findOne.mockResolvedValueOnce(null);

      await expect(
        service.pagoAnual({ socioId: 999, anio: 2026, metodoPagoId: 1 }),
      ).rejects.toThrow(CustomError);

      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
    });

    it('debería lanzar CustomError cuando el socio no tiene categoría', async () => {
      mockQueryRunner.manager.findOne.mockResolvedValueOnce({
        ...mockSocioActivo,
        categoria: null,
      });

      await expect(
        service.pagoAnual({ socioId: 1, anio: 2026, metodoPagoId: 1 }),
      ).rejects.toThrow(CustomError);

      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
    });

    it('debería lanzar CustomError cuando el socio tiene categoría exenta', async () => {
      mockQueryRunner.manager.findOne.mockResolvedValueOnce({
        ...mockSocioActivo,
        categoria: { id: 2, nombre: 'VITALICIO', montoMensual: 0, exento: true },
      });

      await expect(
        service.pagoAnual({ socioId: 1, anio: 2026, metodoPagoId: 1 }),
      ).rejects.toThrow(CustomError);

      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
    });

    it('debería lanzar CustomError cuando el método de pago no existe o está inactivo', async () => {
      mockQueryRunner.manager.findOne
        .mockResolvedValueOnce(mockSocioActivo) // socio
        .mockResolvedValueOnce(null);           // método de pago inactivo

      const mockQb = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      };
      mockQueryRunner.manager.createQueryBuilder.mockReturnValue(mockQb);

      await expect(
        service.pagoAnual({ socioId: 1, anio: 2026, metodoPagoId: 99 }),
      ).rejects.toThrow(CustomError);

      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
    });

    it('debería recalcular estado del socio moroso a ACTIVO al pagar todas las cuotas', async () => {
      mockQueryRunner.manager.findOne
        .mockResolvedValueOnce({ ...mockSocioActivo, estado: 'MOROSO' }) // socio
        .mockResolvedValueOnce(mockMetodoPago)                           // método de pago
        .mockResolvedValueOnce({ id: 1, estado: 'MOROSO' });            // recalcular estado

      const mockQb = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      };
      mockQueryRunner.manager.createQueryBuilder.mockReturnValue(mockQb);
      mockQueryRunner.manager.count.mockResolvedValue(0); // 0 pendientes tras pagar
      mockQueryRunner.manager.create.mockImplementation((_entity, data) => ({ ...data, createdAt: new Date() }));
      mockQueryRunner.manager.save.mockImplementation((entity) => Promise.resolve({ ...entity, id: 99 }));

      await service.pagoAnual({ socioId: 1, anio: 2026, metodoPagoId: 1 });

      expect(mockQueryRunner.manager.update).toHaveBeenCalledWith(Socio, 1, {
        estado: 'ACTIVO',
      });
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
    });

    it('debería hacer rollback ante un error inesperado', async () => {
      mockQueryRunner.manager.findOne.mockRejectedValueOnce(new Error('DB error'));

      await expect(
        service.pagoAnual({ socioId: 1, anio: 2026, metodoPagoId: 1 }),
      ).rejects.toThrow();

      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
    });
  });

  describe('registrarPagoCuotasSeleccionadas', () => {
    it('debería permitir pagar cuotas seleccionadas usando crédito individual', async () => {
      mockQueryRunner.manager.find
        .mockResolvedValueOnce([
          {
            id: 101,
            socioId: 12,
            monto: 2500,
            periodo: '2026-01',
            estado: EstadoCuota.PENDIENTE,
            createdAt: new Date('2026-01-01'),
          },
          {
            id: 102,
            socioId: 12,
            monto: 2500,
            periodo: '2026-02',
            estado: EstadoCuota.PENDIENTE,
            createdAt: new Date('2026-02-01'),
          },
        ])
        .mockResolvedValueOnce([{ id: 1 }]);
      mockQueryRunner.manager.create.mockImplementation((_entity, data) => ({ ...data }));
      mockQueryRunner.manager.save.mockImplementation(async (entity) => entity);
      jest
        .spyOn(service as never, 'recalcularEstadoSocioPorMorosidad' as never)
        .mockResolvedValue(undefined as never);

      mockCreditoService.aplicarCreditoIndividual.mockResolvedValue({
        creditoAplicado: 2000,
        nuevoSaldo: 0,
        montoACobrar: 3000,
      });

      const result = await service.registrarPagoCuotasSeleccionadas({
        socioId: 12,
        cuotaIds: [101, 102],
        pagos: [{ metodoPagoId: 1, monto: 3000 }],
        observaciones: 'Pago con crédito aplicado',
      });

      expect(mockCreditoService.aplicarCreditoIndividual).toHaveBeenCalledWith(
        mockQueryRunner,
        12,
        5000,
      );
      expect(result).toEqual({
        cuotasPagadas: 2,
        pagosGenerados: 2,
        totalPagado: 5000,
      });
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
    });

    it('debería bloquear solo cuotas seleccionadas para evitar doble pago concurrente desde web', async () => {
      mockQueryRunner.manager.find
        .mockResolvedValueOnce([
          {
            id: 101,
            socioId: 12,
            monto: 2500,
            periodo: '2026-01',
            estado: EstadoCuota.PENDIENTE,
            createdAt: new Date('2026-01-01'),
          },
        ])
        .mockResolvedValueOnce([{ id: 1 }]);
      mockQueryRunner.manager.create.mockImplementation((_entity, data) => ({ ...data }));
      mockQueryRunner.manager.save.mockImplementation(async (entity) => entity);
      jest
        .spyOn(service as never, 'recalcularEstadoSocioPorMorosidad' as never)
        .mockResolvedValue(undefined as never);
      mockCreditoService.aplicarCreditoIndividual.mockResolvedValue({
        creditoAplicado: 0,
        nuevoSaldo: 0,
        montoACobrar: 2500,
      });

      await service.registrarPagoCuotasSeleccionadas({
        socioId: 12,
        cuotaIds: [101],
        pagos: [{ metodoPagoId: 1, monto: 2500 }],
      });

      expect(mockQueryRunner.manager.find).toHaveBeenCalledWith(
        Cuota,
        expect.objectContaining({
          where: { id: expect.any(Object), socioId: 12 },
          lock: { mode: 'pessimistic_write' },
        }),
      );
      expect(mockQueryRunner.manager.find.mock.calls[0][1]).not.toHaveProperty(
        'relations',
      );
    });
  });
});
