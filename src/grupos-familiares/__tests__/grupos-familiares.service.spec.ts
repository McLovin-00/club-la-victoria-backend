import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { GruposFamiliaresService } from '../grupos-familiares.service';
import { GrupoFamiliar } from '../entities/grupo-familiar.entity';
import { Socio } from '../../socios/entities/socio.entity';
import { CustomError } from 'src/constants/errors/custom-error';

describe('GruposFamiliaresService', () => {
  let service: GruposFamiliaresService;
  let grupoRepository: Repository<GrupoFamiliar>;
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
      remove: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GruposFamiliaresService,
        {
          provide: getRepositoryToken(GrupoFamiliar),
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
            save: jest.fn(),
            createQueryBuilder: jest.fn(),
          },
        },
        {
          provide: DataSource,
          useValue: {
            createQueryRunner: jest.fn().mockReturnValue(mockQueryRunner),
          },
        },
      ],
    }).compile();

    service = module.get<GruposFamiliaresService>(GruposFamiliaresService);
    grupoRepository = module.get(getRepositoryToken(GrupoFamiliar));
    socioRepository = module.get(getRepositoryToken(Socio));
    dataSource = module.get(DataSource);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('debería crear el servicio correctamente', () => {
      expect(service).toBeDefined();
    });

    it('debería crear un grupo familiar correctamente', async () => {
      const dto = {
        nombre: 'Familia García',
        descripcion: 'Grupo de la familia García',
        orden: 1,
      };

      const mockGrupo = {
        id: 1,
        nombre: dto.nombre,
        descripcion: dto.descripcion,
        orden: dto.orden,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      jest.spyOn(grupoRepository, 'findOne').mockResolvedValue(null);
      jest.spyOn(grupoRepository, 'create').mockReturnValue(mockGrupo as GrupoFamiliar);
      jest.spyOn(grupoRepository, 'save').mockResolvedValue(mockGrupo as GrupoFamiliar);

      const result = await service.create(dto);

      expect(result.nombre).toBe(dto.nombre);
      expect(result.descripcion).toBe(dto.descripcion);
      expect(result.orden).toBe(dto.orden);
    });

    it('debería rechazar creación si ya existe grupo con el mismo nombre', async () => {
      const dto = {
        nombre: 'Familia García',
        descripcion: 'Grupo de la familia García',
      };

      const existingGroup = {
        id: 1,
        nombre: dto.nombre,
        orden: 0,
      };

      jest.spyOn(grupoRepository, 'findOne').mockResolvedValue(existingGroup as GrupoFamiliar);

      await expect(service.create(dto)).rejects.toThrow(CustomError);
    });

    it('debería asignar orden 0 por defecto si no se especifica', async () => {
      const dto = {
        nombre: 'Familia López',
      };

      const mockGrupo = {
        id: 1,
        nombre: dto.nombre,
        orden: 0,
      };

      jest.spyOn(grupoRepository, 'findOne').mockResolvedValue(null);
      jest.spyOn(grupoRepository, 'create').mockReturnValue(mockGrupo as GrupoFamiliar);
      jest.spyOn(grupoRepository, 'save').mockResolvedValue(mockGrupo as GrupoFamiliar);

      const result = await service.create(dto);

      expect(result.orden).toBe(0);
    });
  });

  describe('findAll', () => {
    it('debería retornar todos los grupos con cantidad de socios', async () => {
      const mockGrupos = [
        { id: 1, nombre: 'Familia García', orden: 1 },
        { id: 2, nombre: 'Familia López', orden: 2 },
      ];

      const mockRaw = [
        { cantidadSocios: '3' },
        { cantidadSocios: '2' },
      ];

      const mockQueryBuilder = {
        leftJoin: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
        getRawAndEntities: jest.fn().mockResolvedValue({
          entities: mockGrupos,
          raw: mockRaw,
        }),
      };

      jest.spyOn(grupoRepository, 'createQueryBuilder').mockReturnValue(mockQueryBuilder as any);

      const result = await service.findAll();

      expect(result).toHaveLength(2);
      expect(result[0].cantidadSocios).toBe(3);
      expect(result[1].cantidadSocios).toBe(2);
    });

    it('debería retornar arreglo vacío si no hay grupos', async () => {
      const mockQueryBuilder = {
        leftJoin: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
        getRawAndEntities: jest.fn().mockResolvedValue({
          entities: [],
          raw: [],
        }),
      };

      jest.spyOn(grupoRepository, 'createQueryBuilder').mockReturnValue(mockQueryBuilder as any);

      const result = await service.findAll();

      expect(result).toHaveLength(0);
    });
  });

  describe('findOne', () => {
    it('debería retornar un grupo con sus socios', async () => {
      const mockGrupo = {
        id: 1,
        nombre: 'Familia García',
        orden: 1,
        socios: [
          { id: 1, nombre: 'Juan', apellido: 'García' },
          { id: 2, nombre: 'María', apellido: 'García' },
        ],
      };

      jest.spyOn(grupoRepository, 'findOne').mockResolvedValue(mockGrupo as GrupoFamiliar);

      const result = await service.findOne(1);

      expect(result.id).toBe(1);
      expect(result.socios).toHaveLength(2);
    });

    it('debería lanzar error si el grupo no existe', async () => {
      jest.spyOn(grupoRepository, 'findOne').mockResolvedValue(null);

      await expect(service.findOne(999)).rejects.toThrow(CustomError);
    });
  });

  describe('update', () => {
    it('debería actualizar un grupo correctamente', async () => {
      const mockGrupo = {
        id: 1,
        nombre: 'Familia García',
        descripcion: 'Descripción original',
        orden: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const dto = {
        nombre: 'Familia García Actualizado',
        descripcion: 'Nueva descripción',
        orden: 2,
      };

      // Primera llamada: obtener el grupo existente
      // Segunda llamada: verificar que no existe grupo con el nuevo nombre (null)
      jest.spyOn(grupoRepository, 'findOne')
        .mockResolvedValueOnce(mockGrupo as GrupoFamiliar)
        .mockResolvedValueOnce(null);
      
      jest.spyOn(grupoRepository, 'save').mockResolvedValue({
        ...mockGrupo,
        ...dto,
      } as GrupoFamiliar);

      const result = await service.update(1, dto);

      expect(result.nombre).toBe(dto.nombre);
      expect(result.descripcion).toBe(dto.descripcion);
      expect(result.orden).toBe(dto.orden);
    });

    it('debería rechazar actualización si el nuevo nombre ya existe', async () => {
      const mockGrupo = {
        id: 1,
        nombre: 'Familia García',
        orden: 1,
      };

      const existingGroup = {
        id: 2,
        nombre: 'Familia López',
      };

      const dto = {
        nombre: 'Familia López',
      };

      jest.spyOn(grupoRepository, 'findOne')
        .mockResolvedValueOnce(mockGrupo as GrupoFamiliar)
        .mockResolvedValueOnce(existingGroup as GrupoFamiliar);

      await expect(service.update(1, dto)).rejects.toThrow(CustomError);
    });

    it('debería permitir actualizar sin cambiar el nombre', async () => {
      const mockGrupo = {
        id: 1,
        nombre: 'Familia García',
        descripcion: 'Original',
        orden: 1,
      };

      const dto = {
        descripcion: 'Nueva descripción',
      };

      jest.spyOn(grupoRepository, 'findOne').mockResolvedValue(mockGrupo as GrupoFamiliar);
      jest.spyOn(grupoRepository, 'save').mockResolvedValue({
        ...mockGrupo,
        descripcion: dto.descripcion,
      } as GrupoFamiliar);

      const result = await service.update(1, dto);

      expect(result.nombre).toBe('Familia García');
      expect(result.descripcion).toBe(dto.descripcion);
    });
  });

  describe('remove', () => {
    it('debería eliminar un grupo y desasignar sus socios', async () => {
      const mockGrupo = {
        id: 1,
        nombre: 'Familia García',
        orden: 1,
      };

      jest.spyOn(grupoRepository, 'findOne').mockResolvedValue(mockGrupo as GrupoFamiliar);
      mockQueryRunner.manager.update.mockResolvedValue({ affected: 2 });
      mockQueryRunner.manager.remove.mockResolvedValue(mockGrupo);

      await service.remove(1);

      expect(mockQueryRunner.manager.update).toHaveBeenCalledWith(
        Socio,
        { grupoFamiliar: { id: 1 } },
        { grupoFamiliar: undefined },
      );
      expect(mockQueryRunner.manager.remove).toHaveBeenCalled();
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
    });

    it('debería hacer rollback si ocurre un error', async () => {
      const mockGrupo = {
        id: 1,
        nombre: 'Familia García',
        orden: 1,
      };

      jest.spyOn(grupoRepository, 'findOne').mockResolvedValue(mockGrupo as GrupoFamiliar);
      mockQueryRunner.manager.update.mockRejectedValue(new Error('DB Error'));

      await expect(service.remove(1)).rejects.toThrow(CustomError);
      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
    });
  });

  describe('asignarSocios', () => {
    it('debería asignar socios a un grupo correctamente', async () => {
      const mockGrupo = {
        id: 1,
        nombre: 'Familia García',
        orden: 1,
        socios: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockSocios = [
        { id: 1, nombre: 'Juan', apellido: 'García' },
        { id: 2, nombre: 'María', apellido: 'García' },
      ];

      const dto = { socioIds: [1, 2] };

      jest.spyOn(grupoRepository, 'findOne')
        .mockResolvedValueOnce(mockGrupo as GrupoFamiliar)
        .mockResolvedValueOnce({ ...mockGrupo, socios: mockSocios } as GrupoFamiliar);
      
      mockQueryRunner.manager.find.mockResolvedValue(mockSocios);
      mockQueryRunner.manager.update.mockResolvedValue({ affected: 2 });

      const result = await service.asignarSocios(1, dto);

      expect(result.sociosAsignados).toBe(2);
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
    });

    it('debería rechazar si algún socio no existe', async () => {
      const mockGrupo = {
        id: 1,
        nombre: 'Familia García',
        orden: 1,
      };

      const mockSocios = [{ id: 1, nombre: 'Juan' }];

      const dto = { socioIds: [1, 999] }; // 999 no existe

      jest.spyOn(grupoRepository, 'findOne').mockResolvedValue(mockGrupo as GrupoFamiliar);
      mockQueryRunner.manager.find.mockResolvedValue(mockSocios);

      await expect(service.asignarSocios(1, dto)).rejects.toThrow(CustomError);
      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
    });
  });

  describe('desasignarSocio', () => {
    it('debería desasignar un socio de su grupo', async () => {
      const mockSocio = {
        id: 1,
        nombre: 'Juan',
        apellido: 'García',
        grupoFamiliar: { id: 1, nombre: 'Familia García' },
      };

      jest.spyOn(socioRepository, 'findOne').mockResolvedValue(mockSocio as Socio);
      jest.spyOn(socioRepository, 'save').mockResolvedValue({
        ...mockSocio,
        grupoFamiliar: undefined,
      } as Socio);

      await service.desasignarSocio(1);

      expect(socioRepository.save).toHaveBeenCalled();
    });

    it('debería lanzar error si el socio no existe', async () => {
      jest.spyOn(socioRepository, 'findOne').mockResolvedValue(null);

      await expect(service.desasignarSocio(999)).rejects.toThrow(CustomError);
    });
  });

  describe('findSociosSinGrupo', () => {
    it('debería retornar socios sin grupo ordenados alfabéticamente', async () => {
      const mockSocios = [
        { id: 1, nombre: 'Juan', apellido: 'García', dni: '12345678', telefono: '1234' },
        { id: 2, nombre: 'María', apellido: 'López', dni: '87654321', telefono: '5678' },
      ];

      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(mockSocios),
      };

      jest.spyOn(socioRepository, 'createQueryBuilder').mockReturnValue(mockQueryBuilder as any);

      const result = await service.findSociosSinGrupo();

      expect(result).toHaveLength(2);
      expect(result[0].apellido).toBe('García');
      expect(result[1].apellido).toBe('López');
    });

    it('debería retornar arreglo vacío si todos los socios tienen grupo', async () => {
      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      };

      jest.spyOn(socioRepository, 'createQueryBuilder').mockReturnValue(mockQueryBuilder as any);

      const result = await service.findSociosSinGrupo();

      expect(result).toHaveLength(0);
    });
  });
});
