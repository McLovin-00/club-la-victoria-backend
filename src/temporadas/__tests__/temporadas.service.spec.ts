import { Test, TestingModule } from '@nestjs/testing';
import { SelectQueryBuilder } from 'typeorm';
import { TemporadasService } from '../temporadas.service';
import { TemporadaPiletaRepository } from '../repositories/temporada.repository';
import { SocioRepository } from '../../socios/repositories/socio.repository';
import { AsociacionesRepository } from '../../asociaciones/repositories/asociaciones.repository';
import { RegistroIngresoRepository } from '../../registro-ingreso/repositories/registro-ingreso.repository';
import { CreateTemporadaDto } from '../dto/create-temporada.dto';
import { TemporadaPileta } from '../entities/temporada.entity';
import { Socio } from '../../socios/entities/socio.entity';
import { ERROR_CODES } from 'src/constants/errors/error-messages';
import { temporadaFixture } from '../../../test/fixtures/entities/temporada.fixture';
import { socioFixture } from '../../../test/fixtures/entities/socio.fixture';

type TemporadaValidationQueryBuilder = Pick<
  SelectQueryBuilder<TemporadaPileta>,
  'where' | 'setParameters' | 'andWhere' | 'getMany'
>;

const createTemporadaValidationQueryBuilder = (
  temporadas: TemporadaPileta[] = [],
): jest.Mocked<TemporadaValidationQueryBuilder> => {
  return {
    where: jest.fn().mockReturnThis(),
    setParameters: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    getMany: jest.fn().mockResolvedValue(temporadas),
  };
};

describe('TemporadasService', () => {
  let service: TemporadasService;
  let temporadaRepository: {
    createQueryBuilder: jest.Mock;
    save: jest.Mock;
    find: jest.Mock;
    findOne: jest.Mock;
    update: jest.Mock;
    delete: jest.Mock;
  };
  let socioRepository: {
    createQueryBuilder: jest.Mock;
  };
  let asociacionesRepository: {
    find: jest.Mock;
    createQueryBuilder: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    findOne: jest.Mock;
    remove: jest.Mock;
  };
  let registroIngresoRepository: {
    createQueryBuilder: jest.Mock;
  };

  beforeEach(async () => {
    temporadaRepository = {
      createQueryBuilder: jest.fn(),
      save: jest.fn(),
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn().mockResolvedValue(null),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
      delete: jest.fn().mockResolvedValue({ affected: 1 }),
    };

    socioRepository = {
      createQueryBuilder: jest.fn(),
    };

    asociacionesRepository = {
      find: jest.fn().mockResolvedValue([]),
      createQueryBuilder: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      findOne: jest.fn(),
      remove: jest.fn(),
    };

    registroIngresoRepository = {
      createQueryBuilder: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TemporadasService,
        {
          provide: TemporadaPiletaRepository,
          useValue: temporadaRepository,
        },
        {
          provide: SocioRepository,
          useValue: socioRepository,
        },
        {
          provide: AsociacionesRepository,
          useValue: asociacionesRepository,
        },
        {
          provide: RegistroIngresoRepository,
          useValue: registroIngresoRepository,
        },
      ],
    }).compile();

    service = module.get<TemporadasService>(TemporadasService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('debería crear una temporada exitosamente', async () => {
    const createDto: CreateTemporadaDto = {
      nombre: 'Temporada Verano 2026-2027',
      fechaInicio: '2026-12-01',
      fechaFin: '2027-03-31',
      descripcion: 'Temporada de verano',
    };

    const queryBuilder = createTemporadaValidationQueryBuilder([]);
    temporadaRepository.createQueryBuilder.mockReturnValue(
      queryBuilder as unknown as SelectQueryBuilder<TemporadaPileta>,
    );
    temporadaRepository.save.mockResolvedValue({
      ...temporadaFixture,
      ...createDto,
    });

    const result = await service.create(createDto);

    expect(queryBuilder.where).toHaveBeenCalled();
    expect(temporadaRepository.save).toHaveBeenCalledWith({ ...createDto });
    expect(result.nombre).toBe(createDto.nombre);
  });

  it('debería validar que no exista solapamiento de fechas', async () => {
    const createDto: CreateTemporadaDto = {
      nombre: 'Temporada Nueva',
      fechaInicio: '2024-06-01',
      fechaFin: '2024-09-01',
      descripcion: 'Se solapa con una existente',
    };

    const temporadaSolapada = {
      ...temporadaFixture,
      nombre: 'Temporada 2024',
      fechaInicio: '2024-01-01',
      fechaFin: '2024-12-31',
    };

    const queryBuilder = createTemporadaValidationQueryBuilder([
      temporadaSolapada,
    ]);
    temporadaRepository.createQueryBuilder.mockReturnValue(
      queryBuilder as unknown as SelectQueryBuilder<TemporadaPileta>,
    );

    await expect(service.create(createDto)).rejects.toMatchObject({
      statusCode: 400,
      errorCode: ERROR_CODES.OVERLAPPING_SEASONS,
    });
    expect(temporadaRepository.save).not.toHaveBeenCalled();
  });

  it('debería lanzar error cuando la temporada no existe', async () => {
    temporadaRepository.findOne.mockResolvedValue(null);

    await expect(service.tieneRegistrosPileta(999)).rejects.toMatchObject({
      statusCode: 404,
      errorCode: ERROR_CODES.TEMPORADA_NOT_FOUND,
    });
  });

  it('debería paginar socios disponibles correctamente', async () => {
    asociacionesRepository.find.mockResolvedValue([
      {
        socio: { id: 1 },
      },
    ]);

    const sociosDisponibles = [
      { ...socioFixture, id: 2, nombre: 'Ana' },
      { ...socioFixture, id: 3, nombre: 'Pedro' },
    ];

    const socioQueryBuilder = {
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn().mockResolvedValue([sociosDisponibles, 3]),
    };

    socioRepository.createQueryBuilder.mockReturnValue(
      socioQueryBuilder as unknown as SelectQueryBuilder<Socio>,
    );

    const result = await service.getSociosDisponibles(1, 2, 2, 'an');

    expect(socioQueryBuilder.andWhere).toHaveBeenNthCalledWith(
      1,
      'socio.id NOT IN (:...sociosEnTemporada)',
      {
        sociosEnTemporada: [1],
      },
    );
    expect(socioQueryBuilder.skip).toHaveBeenCalledWith(2);
    expect(socioQueryBuilder.take).toHaveBeenCalledWith(2);
    expect(result).toEqual({
      data: sociosDisponibles,
      total: 3,
      page: 2,
      limit: 2,
      totalPages: 2,
    });
  });
});
