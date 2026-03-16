import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { EstadisticasService } from '../estadisticas.service';
import {
  RegistroIngreso,
  TipoIngreso,
} from '../../registro-ingreso/entities/registro-ingreso.entity';
import { getDayStartEnd } from 'src/util/day-start-end-util';
import { createMockRepository } from '../../../test/mocks/repository.mock';
import { socioFixture } from '../../../test/fixtures/entities/socio.fixture';

type RegistroIngresoQueryBuilder = Pick<
  SelectQueryBuilder<RegistroIngreso>,
  'leftJoinAndSelect' | 'where' | 'andWhere' | 'orderBy' | 'getMany'
>;

const createRegistroIngresoQueryBuilder = (
  registros: RegistroIngreso[] = [],
): jest.Mocked<RegistroIngresoQueryBuilder> => {
  return {
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    getMany: jest.fn().mockResolvedValue(registros),
  };
};

describe('EstadisticasService', () => {
  let service: EstadisticasService;
  let registroIngresoRepository: jest.Mocked<Repository<RegistroIngreso>>;

  beforeEach(async () => {
    registroIngresoRepository = createMockRepository<RegistroIngreso>();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EstadisticasService,
        {
          provide: getRepositoryToken(RegistroIngreso),
          useValue: registroIngresoRepository,
        },
      ],
    }).compile();

    service = module.get<EstadisticasService>(EstadisticasService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('debería calcular estadísticas correctamente cuando hay datos', async () => {
    const registros = [
      {
        idIngreso: 1,
        idSocio: socioFixture.id,
        tipoIngreso: TipoIngreso.SOCIO_PILETA,
        habilitaPileta: true,
        fechaHoraIngreso: new Date('2026-03-10T10:00:00.000Z'),
        socio: socioFixture,
      },
      {
        idIngreso: 2,
        idSocio: socioFixture.id,
        tipoIngreso: TipoIngreso.SOCIO_CLUB,
        habilitaPileta: false,
        fechaHoraIngreso: new Date('2026-03-10T11:00:00.000Z'),
        socio: socioFixture,
      },
      {
        idIngreso: 3,
        dniNoSocio: '12345678',
        nombreNoSocio: 'Ana',
        apellidoNoSocio: 'Lopez',
        tipoIngreso: TipoIngreso.NO_SOCIO,
        habilitaPileta: true,
        fechaHoraIngreso: new Date('2026-03-10T12:00:00.000Z'),
      },
    ] as RegistroIngreso[];

    const queryBuilder = createRegistroIngresoQueryBuilder(registros);
    jest
      .spyOn(registroIngresoRepository, 'createQueryBuilder')
      .mockReturnValue(
        queryBuilder as unknown as SelectQueryBuilder<RegistroIngreso>,
      );

    const result = await service.getDailyStatistics('2026-03-10');

    expect(result.totalIngresos).toBe(3);
    expect(result.totalIngresosPileta).toBe(2);
    expect(result.totalIngresosClub).toBe(1);
    expect(result.totalSocios).toBe(2);
    expect(result.totalNoSocios).toBe(1);
    expect(result.registros).toHaveLength(3);
  });

  it('debería aplicar filtros por fecha usando inicio y fin del día', async () => {
    const fecha = '2026-03-10';
    const { inicioDia, finDia } = getDayStartEnd(fecha);

    const queryBuilder = createRegistroIngresoQueryBuilder([]);
    jest
      .spyOn(registroIngresoRepository, 'createQueryBuilder')
      .mockReturnValue(
        queryBuilder as unknown as SelectQueryBuilder<RegistroIngreso>,
      );

    await service.getDailyStatistics(fecha);

    expect(queryBuilder.where).toHaveBeenCalledWith(
      'registro.fechaHoraIngreso BETWEEN :inicio AND :fin',
      {
        inicio: inicioDia,
        fin: finDia,
      },
    );
  });

  it('debería buscar correctamente con una sola palabra', async () => {
    const queryBuilder = createRegistroIngresoQueryBuilder([]);
    jest
      .spyOn(registroIngresoRepository, 'createQueryBuilder')
      .mockReturnValue(
        queryBuilder as unknown as SelectQueryBuilder<RegistroIngreso>,
      );

    await service.getDailyStatistics('2026-03-10', 'Juan');

    expect(queryBuilder.andWhere).toHaveBeenCalledWith(
      expect.stringContaining('unaccent(socio.nombre) ILIKE unaccent(:term)'),
      { term: '%Juan%' },
    );
  });

  it('debería buscar correctamente con múltiples palabras', async () => {
    const queryBuilder = createRegistroIngresoQueryBuilder([]);
    jest
      .spyOn(registroIngresoRepository, 'createQueryBuilder')
      .mockReturnValue(
        queryBuilder as unknown as SelectQueryBuilder<RegistroIngreso>,
      );

    await service.getDailyStatistics('2026-03-10', 'Juan Perez');

    expect(queryBuilder.andWhere).toHaveBeenCalledWith(
      expect.stringContaining('word0'),
      {
        word0: '%Juan%',
        word1: '%Perez%',
      },
    );
  });

  it('debería mantener agregaciones consistentes en el resultado', async () => {
    const registros = [
      {
        idIngreso: 1,
        tipoIngreso: TipoIngreso.SOCIO_PILETA,
        habilitaPileta: true,
        fechaHoraIngreso: new Date('2026-03-10T10:00:00.000Z'),
      },
      {
        idIngreso: 2,
        tipoIngreso: TipoIngreso.NO_SOCIO,
        habilitaPileta: false,
        fechaHoraIngreso: new Date('2026-03-10T11:00:00.000Z'),
      },
    ] as RegistroIngreso[];

    const queryBuilder = createRegistroIngresoQueryBuilder(registros);
    jest
      .spyOn(registroIngresoRepository, 'createQueryBuilder')
      .mockReturnValue(
        queryBuilder as unknown as SelectQueryBuilder<RegistroIngreso>,
      );

    const result = await service.getDailyStatistics('2026-03-10');

    expect(result.totalIngresosClub).toBe(
      result.totalIngresos - result.totalIngresosPileta,
    );
    expect(result.totalNoSocios).toBe(result.totalIngresos - result.totalSocios);
  });

  it('debería devolver respuesta vacía sin errores cuando no hay registros', async () => {
    const queryBuilder = createRegistroIngresoQueryBuilder([]);
    jest
      .spyOn(registroIngresoRepository, 'createQueryBuilder')
      .mockReturnValue(
        queryBuilder as unknown as SelectQueryBuilder<RegistroIngreso>,
      );

    const result = await service.getDailyStatistics('2026-03-10');

    expect(result).toEqual({
      totalIngresos: 0,
      totalIngresosPileta: 0,
      totalIngresosClub: 0,
      totalSocios: 0,
      totalNoSocios: 0,
      registros: [],
    });
  });
});
