import { Test, TestingModule } from '@nestjs/testing';
import { Repository } from 'typeorm';
import { RegistroIngresoService } from '../src/registro-ingreso/registro-ingreso.service';
import { RegistroIngresoGateway } from '../src/registro-ingreso/registro-ingreso.gateway';
import { getDayStartEnd } from '../src/util/day-start-end-util';
import { CustomError } from '../src/constants/errors/custom-error';
import { ERROR_MESSAGES, ERROR_CODES } from '../src/constants/errors/error-messages';

describe('RegistroIngresoService', () => {
  let service: RegistroIngresoService;
  let registroIngresoRepository: jest.Mocked<Repository<unknown>>;
  let socioRepository: jest.Mocked<Repository<unknown>>;
  let registroIngresoGateway: RegistroIngresoGateway;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RegistroIngresoService,
        {
          provide: 'REGISTRO_INGRESO_REPOSITORY',
          useValue: {
            find: jest.fn().mockResolvedValue([]),
            findOne: jest.fn().mockResolvedValue(null),
            save: jest.fn().mockResolvedValue({}),
            findAndCount: jest.fn().mockResolvedValue([[], 0]),
          },
        },
        {
          provide: 'SOCIO_REPOSITORY',
          useValue: {
            find: jest.fn().mockResolvedValue([]),
            findOne: jest.fn().mockResolvedValue(null),
            save: jest.fn().mockResolvedValue({}),
          },
        },
        {
          provide: RegistroIngresoGateway,
          useValue: {
            emitNuevoRegistro: jest.fn(),
            emitUpdatedList: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<RegistroIngresoService>(RegistroIngresoService);
    registroIngresoRepository =
      module.get<Repository<unknown>>('REGISTRO_INGRESO_REPOSITORY');
    socioRepository = module.get<Repository<unknown>>('SOCIO_REPOSITORY');
    registroIngresoGateway =
      module.get<RegistroIngresoGateway>(RegistroIngresoGateway);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('create', () => {
    it('debería crear correctamente un registro', async () => {
      const result = await service.create({
        dniNoSocio: '12345678',
        tipoIngreso: 'NO_SOCIO' as any,
        habilitaPileta: true,
      });

      expect(result).toBeDefined();
    });

    it('debería lanzar error si el registro no existe', async () => {
      (registroIngresoRepository.findOne as jest.Mock).mockResolvedValue(null);

      await expect(service.findOne(999)).rejects.toThrow(CustomError);
      await expect(service.findOne(999)).rejects.toThrow(
        ERROR_MESSAGES.REGISTRO_NOT_FOUND,
      );
    });
  });
});
