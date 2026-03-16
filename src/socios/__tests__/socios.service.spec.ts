import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { SociosService } from '../socios.service';
import { SocioRepository } from '../repositories/socio.repository';
import { CloudinaryService } from 'src/cloudinary/cloudinary.service';
import { AsociacionesRepository } from 'src/asociaciones/repositories/asociaciones.repository';
import { TemporadaPiletaRepository } from 'src/temporadas/repositories/temporada.repository';
import { CategoriaRulesService } from '../services/categoria-rules.service';
import { CategoriasSocioService } from 'src/categorias-socio/categorias-socio.service';
import { CustomError } from 'src/constants/errors/custom-error';
import { PaginationDto } from 'src/common/dto/pagination.dto';
import { CreateSocioDto, Estado, Genero } from '../dto/create-socio.dto';
import { UpdateSocioDto } from '../dto/update-socio.dto';

describe('SociosService', () => {
  let service: SociosService;
  let socioRepository: SocioRepository;
  let cloudinaryService: CloudinaryService;
  let dataSource: DataSource;
  let categoriaRulesService: CategoriaRulesService;
  let categoriasSocioService: CategoriasSocioService;

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
      remove: jest.fn(),
    },
  };

  const mockSocio = {
    id: 1,
    nombre: 'Juan',
    apellido: 'García',
    dni: '12345678',
    telefono: '1234567890',
    email: 'juan@example.com',
    estado: 'ACTIVO',
    fechaAlta: '2024-01-01',
    fechaNacimiento: '1990-01-01',
    fotoUrl: '',
    categoria: { id: 1, nombre: 'ADULTO' },
  };

  const mockSocioRepository = {
    findOne: jest.fn(),
    findByDni: jest.fn(),
    createSocio: jest.fn(),
    findPaginatedAndFiltered: jest.fn(),
    save: jest.fn(),
    delete: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  const mockCloudinaryService = {
    uploadFile: jest.fn(),
    deleteFile: jest.fn(),
  };

  const mockAsociacionesRepository = {
    findOne: jest.fn(),
  };

  const mockTemporadaPiletaRepository = {
    findOne: jest.fn(),
  };

  const mockCategoriaRulesService = {
    calcularCategoria: jest.fn().mockReturnValue('ADULTO'),
  };

  const mockCategoriasSocioService = {
    findByNombre: jest.fn().mockResolvedValue({ id: 1, nombre: 'ADULTO' }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SociosService,
        {
          provide: SocioRepository,
          useValue: mockSocioRepository,
        },
        {
          provide: CloudinaryService,
          useValue: mockCloudinaryService,
        },
        {
          provide: AsociacionesRepository,
          useValue: mockAsociacionesRepository,
        },
        {
          provide: TemporadaPiletaRepository,
          useValue: mockTemporadaPiletaRepository,
        },
        {
          provide: DataSource,
          useValue: {
            createQueryRunner: jest.fn().mockReturnValue(mockQueryRunner),
          },
        },
        {
          provide: CategoriaRulesService,
          useValue: mockCategoriaRulesService,
        },
        {
          provide: CategoriasSocioService,
          useValue: mockCategoriasSocioService,
        },
      ],
    }).compile();

    service = module.get<SociosService>(SociosService);
    socioRepository = module.get(SocioRepository);
    cloudinaryService = module.get(CloudinaryService);
    dataSource = module.get(DataSource);
    categoriaRulesService = module.get(CategoriaRulesService);
    categoriasSocioService = module.get(CategoriasSocioService);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('create', () => {
    const createDtoBase: CreateSocioDto = {
      nombre: 'Juan',
      apellido: 'García',
      dni: '12345678',
      fechaNacimiento: '1990-01-01',
      estado: Estado.ACTIVO,
      genero: Genero.MASCULINO,
      categoriaId: 1,
      overrideManual: true,
    };

    it('debería crear el servicio correctamente', () => {
      expect(service).toBeDefined();
    });

    it('debería crear un socio correctamente sin foto', async () => {
      mockSocioRepository.findByDni.mockResolvedValue(null);
      mockSocioRepository.createSocio.mockResolvedValue({
        ...mockSocio,
        ...createDtoBase,
      });

      const result = await service.create(createDtoBase);

      expect(result.nombre).toBe(createDtoBase.nombre);
      expect(result.apellido).toBe(createDtoBase.apellido);
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
    });

    it('debería rechazar creación si el DNI ya existe', async () => {
      mockSocioRepository.findByDni.mockResolvedValue(mockSocio);

      await expect(service.create(createDtoBase)).rejects.toThrow(CustomError);
      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
    });

    it('debería subir foto a Cloudinary si se proporciona archivo', async () => {
      const mockFile = {
        fieldname: 'foto',
        originalname: 'test.jpg',
        buffer: Buffer.from('test'),
      } as Express.Multer.File;

      mockSocioRepository.findByDni.mockResolvedValue(null);
      mockCloudinaryService.uploadFile.mockResolvedValue({
        secure_url: 'https://cloudinary.com/test.jpg',
      });
      mockSocioRepository.createSocio.mockResolvedValue({
        ...mockSocio,
        ...createDtoBase,
        fotoUrl: 'https://cloudinary.com/test.jpg',
      });

      const result = await service.create(createDtoBase, mockFile);

      expect(mockCloudinaryService.uploadFile).toHaveBeenCalledWith(mockFile);
      expect(result.fotoUrl).toBe('https://cloudinary.com/test.jpg');
    });

    it('debería calcular categoría automáticamente si no hay override manual', async () => {
      const dtoNoOverride: CreateSocioDto = {
        ...createDtoBase,
        fechaNacimiento: '2010-01-01',
        overrideManual: false,
      };

      mockSocioRepository.findByDni.mockResolvedValue(null);
      mockCategoriaRulesService.calcularCategoria.mockReturnValue('MENOR');
      mockCategoriasSocioService.findByNombre.mockResolvedValue({
        id: 2,
        nombre: 'MENOR',
      });
      mockSocioRepository.createSocio.mockResolvedValue({
        ...mockSocio,
        categoriaId: 2,
      });

      await service.create(dtoNoOverride);

      expect(mockCategoriaRulesService.calcularCategoria).toHaveBeenCalled();
      expect(mockCategoriasSocioService.findByNombre).toHaveBeenCalledWith('MENOR');
    });

    it('debería hacer rollback y eliminar foto de Cloudinary si falla la creación', async () => {
      const mockFile = {
        fieldname: 'foto',
        originalname: 'test.jpg',
        buffer: Buffer.from('test'),
      } as Express.Multer.File;

      mockSocioRepository.findByDni.mockResolvedValue(null);
      mockCloudinaryService.uploadFile.mockResolvedValue({
        secure_url: 'https://cloudinary.com/test.jpg',
      });
      mockSocioRepository.createSocio.mockRejectedValue(new Error('DB Error'));

      await expect(service.create(createDtoBase, mockFile)).rejects.toThrow(CustomError);

      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
      expect(mockCloudinaryService.deleteFile).toHaveBeenCalledWith(
        'https://cloudinary.com/test.jpg',
      );
    });
  });

  describe('findAll', () => {
    it('debería retornar socios paginados', async () => {
      const paginationDto: PaginationDto = { page: 1, limit: 10 };
      const mockResult = {
        data: [mockSocio],
        total: 1,
        page: 1,
        limit: 10,
      };

      mockSocioRepository.findPaginatedAndFiltered.mockResolvedValue(mockResult);

      const result = await service.findAll(paginationDto);

      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('debería retornar arreglo vacío si no hay socios', async () => {
      const paginationDto: PaginationDto = { page: 1, limit: 10 };
      const mockResult = {
        data: [],
        total: 0,
        page: 1,
        limit: 10,
      };

      mockSocioRepository.findPaginatedAndFiltered.mockResolvedValue(mockResult);

      const result = await service.findAll(paginationDto);

      expect(result.data).toHaveLength(0);
      expect(result.total).toBe(0);
    });

    it('debería filtrar por término de búsqueda', async () => {
      const paginationDto: PaginationDto = { page: 1, limit: 10, search: 'Juan' };
      const mockResult = {
        data: [mockSocio],
        total: 1,
        page: 1,
        limit: 10,
      };

      mockSocioRepository.findPaginatedAndFiltered.mockResolvedValue(mockResult);

      const result = await service.findAll(paginationDto);

      expect(
        mockSocioRepository.findPaginatedAndFiltered,
      ).toHaveBeenCalledWith(1, 10, 'Juan');
      expect(result.data).toHaveLength(1);
    });
  });

  describe('findOne', () => {
    it('debería retornar un socio por ID', async () => {
      mockSocioRepository.findOne.mockResolvedValue(mockSocio);

      const result = await service.findOne(1);

      expect(result.id).toBe(1);
      expect(result.nombre).toBe('Juan');
    });

    it('debería lanzar error si el socio no existe', async () => {
      mockSocioRepository.findOne.mockResolvedValue(null);

      await expect(service.findOne(999)).rejects.toThrow(CustomError);
    });
  });

  describe('update', () => {
    const updateDtoBase: UpdateSocioDto = {
      nombre: 'Juan Carlos',
      apellido: 'García López',
      fechaNacimiento: '1990-01-01',
      estado: Estado.ACTIVO,
      genero: Genero.MASCULINO,
    };

    it('debería actualizar un socio correctamente', async () => {
      mockSocioRepository.findOne.mockResolvedValue(mockSocio);
      mockSocioRepository.save.mockResolvedValue({
        ...mockSocio,
        ...updateDtoBase,
      });

      const result = await service.update(1, updateDtoBase);

      expect(result.nombre).toBe('Juan Carlos');
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
    });

    it('debería lanzar error si el socio no existe', async () => {
      mockSocioRepository.findOne.mockResolvedValue(null);

      await expect(service.update(999, updateDtoBase)).rejects.toThrow(
        CustomError,
      );
    });

    it('debería actualizar foto si se proporciona archivo', async () => {
      const dto: UpdateSocioDto = { ...updateDtoBase, nombre: 'Juan' };
      const mockFile = {
        fieldname: 'foto',
        originalname: 'test.jpg',
        buffer: Buffer.from('test'),
      } as Express.Multer.File;

      mockSocioRepository.findOne.mockResolvedValue(mockSocio);
      mockCloudinaryService.uploadFile.mockResolvedValue({
        secure_url: 'https://cloudinary.com/new.jpg',
      });
      mockSocioRepository.save.mockResolvedValue({
        ...mockSocio,
        fotoUrl: 'https://cloudinary.com/new.jpg',
      });

      const result = await service.update(1, dto, mockFile);

      expect(mockCloudinaryService.uploadFile).toHaveBeenCalledWith(mockFile);
      expect(result.fotoUrl).toBe('https://cloudinary.com/new.jpg');
    });

    it('debería limpiar numeroTarjetaCentro al desactivar tarjetaCentro', async () => {
      const socioConTarjeta = {
        ...mockSocio,
        tarjetaCentro: true,
        numeroTarjetaCentro: '5400000012345678',
      };
      const dto: UpdateSocioDto = {
        ...updateDtoBase,
        tarjetaCentro: false,
      };

      mockSocioRepository.findOne.mockResolvedValue(socioConTarjeta);
      mockSocioRepository.save.mockImplementation(async (value) => value);

      const result = await service.update(1, dto);

      expect(mockSocioRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          tarjetaCentro: false,
          numeroTarjetaCentro: undefined,
        }),
      );
      expect(result.numeroTarjetaCentro).toBeUndefined();
    });

    it('debería eliminar foto vieja si se indica eliminarFotoVieja', async () => {
      const dto: UpdateSocioDto = {
        ...updateDtoBase,
        eliminarFotoVieja: true,
        fotoUrl: 'https://cloudinary.com/old.jpg',
      };

      const socioConFoto = { ...mockSocio, fotoUrl: 'https://cloudinary.com/old.jpg' };
      mockSocioRepository.findOne.mockResolvedValue(socioConFoto);
      mockSocioRepository.save.mockResolvedValue({ ...mockSocio, fotoUrl: '' });

      await service.update(1, dto);

      expect(mockCloudinaryService.deleteFile).toHaveBeenCalledWith(
        'https://cloudinary.com/old.jpg',
      );
    });

    it('debería hacer rollback si falla la actualización', async () => {
      mockSocioRepository.findOne.mockResolvedValue(mockSocio);
      mockSocioRepository.save.mockRejectedValue(new Error('DB Error'));

      await expect(service.update(1, updateDtoBase)).rejects.toThrow(CustomError);
      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('debería eliminar un socio correctamente', async () => {
      mockSocioRepository.findOne.mockResolvedValue(mockSocio);
      mockSocioRepository.delete.mockResolvedValue({ affected: 1, generatedMaps: [], raw: [] });

      const result = await service.remove(1);

      expect(result.message).toBe('Socio eliminado exitosamente');
    });

    it('debería eliminar foto de Cloudinary si el socio tiene foto', async () => {
      const socioConFoto = {
        ...mockSocio,
        fotoUrl: 'https://cloudinary.com/foto.jpg',
      };

      mockSocioRepository.findOne.mockResolvedValue(socioConFoto);
      mockSocioRepository.delete.mockResolvedValue({ affected: 1, generatedMaps: [], raw: [] });

      await service.remove(1);

      expect(mockCloudinaryService.deleteFile).toHaveBeenCalledWith(
        'https://cloudinary.com/foto.jpg',
      );
    });

    it('debería lanzar error si el socio no existe', async () => {
      mockSocioRepository.findOne.mockResolvedValue(null);

      await expect(service.remove(999)).rejects.toThrow(CustomError);
    });

    it('debería lanzar error si la eliminación no afecta registros', async () => {
      mockSocioRepository.findOne.mockResolvedValue(mockSocio);
      mockSocioRepository.delete.mockResolvedValue({ affected: 0, generatedMaps: [], raw: [] });

      await expect(service.remove(1)).rejects.toThrow(CustomError);
    });
  });

  describe('findByName', () => {
    it('debería retornar arreglo vacío si el query está vacío', async () => {
      const result = await service.findByName('');

      expect(result).toHaveLength(0);
    });

    it('debería retornar arreglo vacío si el query solo tiene espacios', async () => {
      const result = await service.findByName('   ');

      expect(result).toHaveLength(0);
    });

    it('debería buscar socios por nombre', async () => {
      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([{ ...mockSocio, nombre: 'Juan' }]),
      };

      mockSocioRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder as any);

      const result = await service.findByName('Juan');

      expect(result).toHaveLength(1);
      expect(result[0].nombre).toBe('Juan');
    });

    it('debería buscar socios por múltiples palabras', async () => {
      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([mockSocio]),
      };

      mockSocioRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder as any);

      await service.findByName('Juan García');

      // Debería llamar andWhere dos veces (una por cada palabra)
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledTimes(2);
    });

    it('debería limitar resultados a 10', async () => {
      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([mockSocio]),
      };

      mockSocioRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder as any);

      await service.findByName('Juan');

      expect(mockQueryBuilder.limit).toHaveBeenCalledWith(10);
    });
  });

  describe('findSocioConTipo', () => {
    it('debería retornar NOSOCIO si no encuentra el socio', async () => {
      mockSocioRepository.findOne.mockResolvedValue(null);

      const result = await service.findSocioConTipo('99999999');

      expect(result.socio).toBeNull();
      expect(result.tipoPersona).toBe('No Socio');
    });

    it('debería retornar SOCIO_CLUB si no hay temporada activa', async () => {
      mockSocioRepository.findOne.mockResolvedValue(mockSocio);
      mockTemporadaPiletaRepository.findOne.mockResolvedValue(null);

      const result = await service.findSocioConTipo('12345678');

      expect(result.socio).toBeDefined();
      expect(result.tipoPersona).toBe('Socio Club');
    });

    it('debería retornar SOCIO_PILETA si tiene inscripción en temporada actual', async () => {
      mockSocioRepository.findOne.mockResolvedValue(mockSocio);
      mockTemporadaPiletaRepository.findOne.mockResolvedValue({ id: 1 });
      mockAsociacionesRepository.findOne.mockResolvedValue({ id: 1 });

      const result = await service.findSocioConTipo('12345678');

      expect(result.socio).toBeDefined();
      expect(result.tipoPersona).toBe('Socio Pileta');
    });

    it('debería buscar por ID si el identificador es numérico corto', async () => {
      mockSocioRepository.findOne.mockResolvedValue(mockSocio);
      mockTemporadaPiletaRepository.findOne.mockResolvedValue(null);

      const result = await service.findSocioConTipo('1');

      expect(mockSocioRepository.findOne).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 1 },
        }),
      );
    });
  });

  describe('findOneByDniReserva', () => {
    it('debería retornar true si el socio existe', async () => {
      mockSocioRepository.findOne.mockResolvedValue(mockSocio);

      const result = await service.findOneByDniReserva('12345678');

      expect(result).toBe(true);
    });

    it('debería retornar false si el socio no existe', async () => {
      mockSocioRepository.findOne.mockResolvedValue(null);

      const result = await service.findOneByDniReserva('99999999');

      expect(result).toBe(false);
    });
  });
});
