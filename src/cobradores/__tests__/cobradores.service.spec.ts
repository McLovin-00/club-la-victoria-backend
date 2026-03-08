import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CobradoresService } from '../cobradores.service';
import {
  Cobrador,
  CobradorComisionConfig,
  CobradorCuentaCorrienteMovimiento,
  CobradorDispositivo,
  TipoMovimientoCobrador,
} from '../entities';
import { CobroOperacion } from '../../cobros/entities/cobro-operacion.entity';
import { TipoLineaCobro } from '../../cobros/entities/cobro-operacion-linea.entity';
import { Socio } from '../../socios/entities/socio.entity';
import { Cuota } from '../../cobros/entities/cuota.entity';
import { GrupoFamiliar } from '../../grupos-familiares/entities/grupo-familiar.entity';
import { CustomError } from '../../constants/errors/custom-error';

describe('CobradoresService', () => {
  let service: CobradoresService;
  let operacionRepository: Repository<CobroOperacion>;
  let movimientoRepository: Repository<CobradorCuentaCorrienteMovimiento>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CobradoresService,
        {
          provide: getRepositoryToken(Cobrador),
          useValue: {
            find: jest.fn(),
            findOne: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(CobradorDispositivo),
          useValue: { findOne: jest.fn(), create: jest.fn(), save: jest.fn() },
        },
        {
          provide: getRepositoryToken(CobroOperacion),
          useValue: { find: jest.fn(), findOne: jest.fn() },
        },
        {
          provide: getRepositoryToken(CobradorComisionConfig),
          useValue: { find: jest.fn(), create: jest.fn(), save: jest.fn() },
        },
        {
          provide: getRepositoryToken(CobradorCuentaCorrienteMovimiento),
          useValue: { find: jest.fn(), create: jest.fn(), save: jest.fn() },
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
          provide: getRepositoryToken(Cuota),
          useValue: { find: jest.fn(), findOne: jest.fn() },
        },
        {
          provide: getRepositoryToken(GrupoFamiliar),
          useValue: {
            find: jest.fn(),
            findOne: jest.fn(),
            createQueryBuilder: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get(CobradoresService);
    operacionRepository = module.get(getRepositoryToken(CobroOperacion));
    movimientoRepository = module.get(
      getRepositoryToken(CobradorCuentaCorrienteMovimiento),
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('debería calcular saldo de cuenta corriente con movimientos', async () => {
    jest.spyOn(movimientoRepository, 'find').mockResolvedValue([
      {
        tipoMovimiento: TipoMovimientoCobrador.COMISION_GENERADA,
        monto: 100,
      },
      {
        tipoMovimiento: TipoMovimientoCobrador.PAGO_A_COBRADOR,
        monto: 40,
      },
      {
        tipoMovimiento: TipoMovimientoCobrador.AJUSTE,
        monto: -10,
      },
    ] as CobradorCuentaCorrienteMovimiento[]);

    const result = await service.listarCuentaCorriente(1);

    expect(result.saldo).toBe(50);
  });

  it('debería incluir detalle del cobro en movimientos de comisión', async () => {
    const fechaCobro = new Date('2026-03-10T18:45:00.000Z');

    jest.spyOn(movimientoRepository, 'find').mockResolvedValue([
      {
        id: 1,
        tipoMovimiento: TipoMovimientoCobrador.COMISION_GENERADA,
        monto: 150,
        createdAt: fechaCobro,
        cobroOperacion: {
          fechaHoraServidor: fechaCobro,
          socio: { id: 22, nombre: 'Juan', apellido: 'Perez' },
          lineas: [
            {
              tipoLinea: TipoLineaCobro.CUOTA,
              cuotaId: 101,
              monto: 1000,
              cuota: { periodo: '2026-03' },
            },
          ],
        },
      },
    ] as CobradorCuentaCorrienteMovimiento[]);

    const result = await service.listarCuentaCorriente(1);
    expect(result.movimientos).toHaveLength(1);
    expect(result.movimientos[0]).toMatchObject({
      detalleCobro: {
        fechaHoraCobro: fechaCobro,
        socio: { id: 22, nombre: 'Juan', apellido: 'Perez' },
        cuotas: [{ cuotaId: 101, periodo: '2026-03', monto: 1000 }],
      },
    });
  });

  it('debería filtrar cálculo de comisión con actor COBRADOR', async () => {
    jest.spyOn(operacionRepository, 'find').mockResolvedValue([]);

    await service.calcularComision(
      1,
      new Date('2026-03-01T00:00:00.000Z'),
      new Date('2026-03-31T23:59:59.999Z'),
    );

    expect(operacionRepository.find).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ actorCobro: 'COBRADOR' }),
      }),
    );
  });

  it('debería rechazar pagos al cobrador con monto inválido', async () => {
    await expect(
      service.registrarPagoACobrador(1, { monto: 0 }),
    ).rejects.toThrow(CustomError);
  });

  it('debería normalizar porcentaje al configurar comisión (15 => 0.15)', async () => {
    const cobradorRepository = service['cobradorRepository'];
    const comisionConfigRepository = service['comisionConfigRepository'];

    jest.spyOn(cobradorRepository, 'findOne').mockResolvedValue({ id: 1 } as Cobrador);
    jest
      .spyOn(comisionConfigRepository, 'create')
      .mockImplementation((payload) => payload as CobradorComisionConfig);
    jest
      .spyOn(comisionConfigRepository, 'save')
      .mockImplementation(async (payload) => payload as CobradorComisionConfig);

    await service.configurarComision(1, {
      porcentaje: 15,
      vigenteDesde: '2026-03-01T00:00:00.000Z',
    });

    expect(comisionConfigRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ porcentaje: 0.15 }),
    );
  });

  it('debería calcular comisión normalizando configuraciones heredadas (15 => 15%)', async () => {
    const comisionConfigRepository = service['comisionConfigRepository'];
    const fechaOperacion = new Date('2026-03-10T12:00:00.000Z');

    jest.spyOn(operacionRepository, 'find').mockResolvedValue([
      {
        total: 1000,
        fechaHoraServidor: fechaOperacion,
      },
    ] as CobroOperacion[]);

    jest.spyOn(comisionConfigRepository, 'find').mockResolvedValue([
      {
        porcentaje: 15,
        vigenteDesde: new Date('2026-03-01T00:00:00.000Z'),
      },
    ] as CobradorComisionConfig[]);

    const resultado = await service.calcularComision(
      1,
      new Date('2026-03-01T00:00:00.000Z'),
      new Date('2026-03-31T23:59:59.999Z'),
    );

    expect(resultado.base).toBe(1000);
    expect(resultado.comision).toBe(150);
  });

  describe('buscarSociosMobile', () => {
    it('debería devolver socios con cantidad de cuotas pendientes', async () => {
      const socioRepository = service['socioRepository'];
      const mockRows = [
        {
          id: '1',
          nombre: 'Juan',
          apellido: 'Perez',
          dni: '12345678',
          telefono: null,
          estado: 'ACTIVO',
          grupoFamiliarId: null,
          grupoFamiliarNombre: null,
          cantidadCuotasPendientes: '0',
        },
        {
          id: '2',
          nombre: 'Ana',
          apellido: 'Lopez',
          dni: '23456789',
          telefono: '11223344',
          estado: 'MOROSO',
          grupoFamiliarId: '10',
          grupoFamiliarNombre: 'Familia Lopez',
          cantidadCuotasPendientes: '5',
        },
      ];

      const mockQueryBuilder = {
        leftJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        addGroupBy: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue(mockRows),
      };

      jest
        .spyOn(socioRepository, 'createQueryBuilder')
        .mockReturnValue(mockQueryBuilder as any);

      const result = await service.buscarSociosMobile('', 50);

      expect(result).toEqual([
        {
          id: 1,
          nombre: 'Juan',
          apellido: 'Perez',
          dni: '12345678',
          telefono: undefined,
          estado: 'ACTIVO',
          cantidadCuotasPendientes: 0,
          grupoFamiliar: undefined,
        },
        {
          id: 2,
          nombre: 'Ana',
          apellido: 'Lopez',
          dni: '23456789',
          telefono: '11223344',
          estado: 'MOROSO',
          cantidadCuotasPendientes: 5,
          grupoFamiliar: {
            id: 10,
            nombre: 'Familia Lopez',
          },
        },
      ]);
    });
  });

  // Tests para Grupos Familiares Mobile
  describe('getGruposFamiliaresMobile', () => {
    it('debería retornar lista de grupos con resumen de deudas', async () => {
      const mockGrupos = [
        {
          id: 1,
          nombre: 'Familia García',
          descripcion: 'Grupo de prueba',
          orden: 1,
          cantidadMiembros: '3',
          miembrosConDeuda: '2',
          totalPendiente: '5000',
        },
        {
          id: 2,
          nombre: 'Familia López',
          descripcion: null,
          orden: 2,
          cantidadMiembros: '2',
          miembrosConDeuda: '0',
          totalPendiente: '0',
        },
      ];

      const grupoFamiliarRepository = service['grupoFamiliarRepository'];
      const mockQueryBuilder = {
        leftJoin: jest.fn().mockReturnThis(),
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue(mockGrupos),
      };

      jest
        .spyOn(grupoFamiliarRepository, 'createQueryBuilder')
        .mockReturnValue(mockQueryBuilder as any);

      const result = await service.getGruposFamiliaresMobile();

      expect(result).toHaveLength(2);
      expect(result[0].nombre).toBe('Familia García');
      expect(result[0].cantidadMiembros).toBe(3);
      expect(result[0].miembrosConDeuda).toBe(2);
      expect(result[0].totalPendiente).toBe(5000);
      expect(result[1].miembrosConDeuda).toBe(0);
    });
  });

  describe('getGrupoFamiliarMobile', () => {
    it('debería retornar detalle del grupo con miembros', async () => {
      const grupoFamiliarRepository = service['grupoFamiliarRepository'];
      const socioRepository = service['socioRepository'];
      const cuotaRepository = service['cuotaRepository'];

      jest.spyOn(grupoFamiliarRepository, 'findOne').mockResolvedValue({
        id: 1,
        nombre: 'Familia García',
        descripcion: 'Grupo de prueba',
        orden: 1,
      } as GrupoFamiliar);

      const mockMiembros = [
        {
          id: 1,
          nombre: 'Juan',
          apellido: 'García',
          dni: '12345678',
          telefono: '123456',
          cantidadCuotasPendientes: '2',
          totalPendiente: '3000',
        },
        {
          id: 2,
          nombre: 'María',
          apellido: 'García',
          dni: '87654321',
          telefono: null,
          cantidadCuotasPendientes: '0',
          totalPendiente: '0',
        },
      ];

      const mockQueryBuilder = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        leftJoin: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue(mockMiembros),
      };

      jest
        .spyOn(socioRepository, 'createQueryBuilder')
        .mockReturnValue(mockQueryBuilder as any);
      jest.spyOn(cuotaRepository, 'find').mockResolvedValue([
        { id: 1, periodo: '2026-03', monto: 1500 },
        { id: 2, periodo: '2026-04', monto: 1500 },
      ] as Cuota[]);

      const result = await service.getGrupoFamiliarMobile(1);

      expect(result.nombre).toBe('Familia García');
      expect(result.cantidadMiembros).toBe(2);
      expect(result.miembrosConDeuda).toBe(1);
      expect(result.totalPendiente).toBe(3000);
      expect(result.miembros).toHaveLength(2);
    });

    it('debería lanzar error si el grupo no existe', async () => {
      const grupoFamiliarRepository = service['grupoFamiliarRepository'];
      jest.spyOn(grupoFamiliarRepository, 'findOne').mockResolvedValue(null);

      await expect(service.getGrupoFamiliarMobile(999)).rejects.toThrow(
        CustomError,
      );
    });
  });
});
