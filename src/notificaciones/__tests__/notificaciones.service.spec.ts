import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotificacionesService } from '../notificaciones.service';
import { Notificacion, TipoNotificacion } from '../entities/notificacion.entity';
import { CustomError } from 'src/constants/errors/custom-error';
import { ERROR_MESSAGES, ERROR_CODES } from 'src/constants/errors/error-messages';
import { createMockRepositoryWithData } from '../../../test/mocks/repository.mock';
import { socioFixture } from '../../../test/fixtures/entities/socio.fixture';

describe('NotificacionesService', () => {
  let service: NotificacionesService;
  let notificacionRepository: jest.Mocked<Repository<Notificacion>> & { data: Notificacion[] };

  // Fixtures para notificaciones
  const notificacionFixture: Notificacion = {
    id: 1,
    tipo: TipoNotificacion.MOROSIDAD_3_MESES,
    socioId: 1,
    mensaje: 'Mora de 3 meses detectada',
    leida: false,
    createdAt: new Date('2024-01-15T10:00:00Z'),
    socio: socioFixture,
  };

  const notificacionLeidaFixture: Notificacion = {
    ...notificacionFixture,
    id: 2,
    leida: true,
    createdAt: new Date('2024-01-14T10:00:00Z'),
  };

  const notificacionNoLeidaFixture: Notificacion = {
    ...notificacionFixture,
    id: 3,
    socioId: 2,
    mensaje: 'Inhabilitación automática aplicada',
    tipo: TipoNotificacion.INHABILITACION_AUTOMATICA,
    createdAt: new Date('2024-01-13T10:00:00Z'),
  };

  beforeEach(async () => {
    // Crear el mock del repository con datos iniciales
    notificacionRepository = createMockRepositoryWithData<Notificacion>([
      notificacionFixture,
      notificacionLeidaFixture,
      notificacionNoLeidaFixture,
    ]);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificacionesService,
        {
          provide: getRepositoryToken(Notificacion),
          useValue: notificacionRepository,
        },
      ],
    }).compile();

    service = module.get<NotificacionesService>(NotificacionesService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('debería retornar todas las notificaciones no leídas con socio relacionado', async () => {
      // Arrange
      notificacionRepository.find.mockResolvedValueOnce([
        notificacionFixture,
        notificacionNoLeidaFixture,
      ]);

      // Act
      const result = await service.findAll();

      // Assert
      expect(result).toEqual({
        notificaciones: [
          {
            id: 1,
            tipo: TipoNotificacion.MOROSIDAD_3_MESES,
            socioId: 1,
            socioNombre: 'Juan Perez',
            mensaje: 'Mora de 3 meses detectada',
            leida: false,
            createdAt: notificacionFixture.createdAt,
          },
          {
            id: 3,
            tipo: TipoNotificacion.INHABILITACION_AUTOMATICA,
            socioId: 2,
            socioNombre: 'Juan Perez',
            mensaje: 'Inhabilitación automática aplicada',
            leida: false,
            createdAt: notificacionNoLeidaFixture.createdAt,
          },
        ],
        totalNoLeidas: 2,
      });

      expect(notificacionRepository.find).toHaveBeenCalledWith({
        where: { leida: false },
        relations: ['socio'],
        order: { createdAt: 'DESC' },
      });
    });

    it('debería construir socioNombre correctamente cuando socio existe', async () => {
      // Arrange
      const notificacionConSocio: Notificacion = {
        ...notificacionFixture,
        socio: {
          ...socioFixture,
          nombre: 'Carlos',
          apellido: 'López',
        },
      };

      notificacionRepository.find.mockResolvedValueOnce([notificacionConSocio]);

      // Act
      const result = await service.findAll();

      // Assert
      expect(result.notificaciones[0].socioNombre).toBe('Carlos López');
    });

    it('debería construir socioNombre vacío cuando socio no existe', async () => {
      // Arrange
      const notificacionSinSocio: Notificacion = {
        ...notificacionFixture,
        socio: null as any, // TypeORM puede no cargar relaciones opcionales
      };

      notificacionRepository.find.mockResolvedValueOnce([notificacionSinSocio]);

      // Act
      const result = await service.findAll();

      // Assert
      expect(result.notificaciones[0].socioNombre).toBe('');
    });

    it('debería retornar lista vacía cuando no hay notificaciones no leídas', async () => {
      // Arrange
      notificacionRepository.find.mockResolvedValueOnce([]);

      // Act
      const result = await service.findAll();

      // Assert
      expect(result).toEqual({
        notificaciones: [],
        totalNoLeidas: 0,
      });
    });

    it('debería ordenar notificaciones por fecha descendente', async () => {
      // Arrange
      const notificacionesOrdenadas = [
        notificacionNoLeidaFixture, // más reciente
        notificacionFixture, // más antigua
      ];
      notificacionRepository.find.mockResolvedValueOnce(notificacionesOrdenadas);

      // Act
      const result = await service.findAll();

      // Assert
      expect(result.notificaciones[0].id).toBe(3);
      expect(result.notificaciones[1].id).toBe(1);
    });

    it('debería filtrar solo notificaciones no leídas (leida: false)', async () => {
      // Arrange
      notificacionRepository.find.mockResolvedValueOnce([
        notificacionFixture,
        notificacionNoLeidaFixture,
      ]);

      // Act
      await service.findAll();

      // Assert
      expect(notificacionRepository.find).toHaveBeenCalledWith({
        where: { leida: false },
        relations: ['socio'],
        order: { createdAt: 'DESC' },
      });
    });
  });

  describe('contarNoLeidas', () => {
    it('debería retornar el conteo de notificaciones no leídas', async () => {
      // Arrange
      notificacionRepository.count.mockResolvedValueOnce(5);

      // Act
      const result = await service.contarNoLeidas();

      // Assert
      expect(result).toEqual({ totalNoLeidas: 5 });
      expect(notificacionRepository.count).toHaveBeenCalledWith({
        where: { leida: false },
      });
    });

    it('debería retornar 0 cuando no hay notificaciones no leídas', async () => {
      // Arrange
      notificacionRepository.count.mockResolvedValueOnce(0);

      // Act
      const result = await service.contarNoLeidas();

      // Assert
      expect(result).toEqual({ totalNoLeidas: 0 });
    });

    it('debería filtrar correctamente por leida: false', async () => {
      // Arrange
      notificacionRepository.count.mockResolvedValueOnce(3);

      // Act
      await service.contarNoLeidas();

      // Assert
      expect(notificacionRepository.count).toHaveBeenCalledWith({
        where: { leida: false },
      });
    });
  });

  describe('marcarLeida', () => {
    it('debería marcar una notificación como leída exitosamente', async () => {
      // Arrange
      const notificacionNoLeida = { ...notificacionFixture };
      notificacionRepository.findOne.mockResolvedValueOnce(notificacionNoLeida);
      notificacionRepository.save.mockResolvedValueOnce({
        ...notificacionNoLeida,
        leida: true,
      });

      // Act
      const result = await service.marcarLeida(1);

      // Assert
      expect(result).toEqual({ message: 'Notificación marcada como leída' });
      expect(notificacionRepository.findOne).toHaveBeenCalledWith({
        where: { id: 1 },
      });
      expect(notificacionRepository.save).toHaveBeenCalledWith({
        ...notificacionNoLeida,
        leida: true,
      });
    });

    it('debería lanzar error CustomError cuando notificación no existe (404)', async () => {
      // Arrange
      notificacionRepository.findOne.mockResolvedValueOnce(null);

      // Act & Assert
      await expect(service.marcarLeida(999)).rejects.toThrow(CustomError);
      await expect(service.marcarLeida(999)).rejects.toMatchObject({
        statusCode: 404,
        errorCode: ERROR_CODES.NOTIFICACION_NOT_FOUND,
        message: ERROR_MESSAGES.NOTIFICACION_NOT_FOUND,
      });
    });

    it('debería actualizar correctamente el campo leida a true', async () => {
      // Arrange
      const notificacionNoLeida: Notificacion = {
        ...notificacionFixture,
        leida: false,
      };

      notificacionRepository.findOne.mockResolvedValueOnce(notificacionNoLeida);
      notificacionRepository.save.mockImplementationOnce(async (entity: any) => {
        return { ...entity, leida: true } as Notificacion;
        return { ...entity, leida: true };
      });

      // Act
      await service.marcarLeida(1);

      // Assert
      const savedEntity = (notificacionRepository.save as jest.Mock).mock.calls[0][0];
      expect(savedEntity.leida).toBe(true);
      expect(savedEntity.id).toBe(1);
    });

    it('debería buscar por id específico', async () => {
      // Arrange
      notificacionRepository.findOne.mockResolvedValueOnce(notificacionFixture);
      notificacionRepository.save.mockResolvedValueOnce(notificacionFixture);

      // Act
      await service.marcarLeida(42);

      // Assert
      expect(notificacionRepository.findOne).toHaveBeenCalledWith({
        where: { id: 42 },
      });
    });
  });

  describe('marcarTodasLeidas', () => {
    it('debería marcar todas las notificaciones no leídas como leídas', async () => {
      // Arrange
      notificacionRepository.update.mockResolvedValueOnce({
        affected: 2,
        generatedMaps: [],
        raw: [],
      });

      // Act
      const result = await service.marcarTodasLeidas();

      // Assert
      expect(result).toEqual({
        message: 'Todas las notificaciones marcadas como leídas',
      });
      expect(notificacionRepository.update).toHaveBeenCalledWith(
        { leida: false },
        { leida: true },
      );
    });

    it('debería retornar mensaje incluso cuando no hay notificaciones para actualizar', async () => {
      // Arrange
      notificacionRepository.update.mockResolvedValueOnce({
        affected: 0,
        generatedMaps: [],
        raw: [],
      });

      // Act
      const result = await service.marcarTodasLeidas();

      // Assert
      expect(result).toEqual({
        message: 'Todas las notificaciones marcadas como leídas',
      });
    });

    it('debería actualizar solo notificaciones con leida: false', async () => {
      // Arrange
      notificacionRepository.update.mockResolvedValueOnce({
        affected: 3,
        generatedMaps: [],
        raw: [],
      });

      // Act
      await service.marcarTodasLeidas();

      // Assert
      expect(notificacionRepository.update).toHaveBeenCalledWith(
        { leida: false },
        { leida: true },
      );
    });

    it('debería ejecutar update con los criterios correctos', async () => {
      // Arrange
      notificacionRepository.update.mockResolvedValueOnce({
        affected: 5,
        generatedMaps: [],
        raw: [],
      });

      // Act
      await service.marcarTodasLeidas();

      // Assert
      const updateCalls = (notificacionRepository.update as jest.Mock).mock.calls;
      expect(updateCalls).toHaveLength(1);
      const [criteria, updateData] = updateCalls[0];
      expect(criteria).toEqual({ leida: false });
      expect(updateData).toEqual({ leida: true });
    });
  });

  describe('crearNotificacion', () => {
    it('debería crear una notificación correctamente', async () => {
      // Arrange
      const tipo = TipoNotificacion.MOROSIDAD_3_MESES;
      const socioId = 5;
      const mensaje = 'Nueva notificación de prueba';

      const notificacionCreada: Notificacion = {
        id: 4,
        tipo,
        socioId,
        mensaje,
        leida: false,
        createdAt: new Date(),
        socio: socioFixture,
      };

      notificacionRepository.create.mockReturnValueOnce(notificacionCreada);
      notificacionRepository.save.mockResolvedValueOnce(notificacionCreada);

      // Act
      const result = await service.crearNotificacion(tipo, socioId, mensaje);

      // Assert
      expect(result).toEqual(notificacionCreada);
      expect(notificacionRepository.create).toHaveBeenCalledWith({
        tipo,
        socioId,
        mensaje,
      });
      expect(notificacionRepository.save).toHaveBeenCalledWith(notificacionCreada);
    });

    it('debería crear notificación con tipo INHABILITACION_AUTOMATICA', async () => {
      // Arrange
      const tipo = TipoNotificacion.INHABILITACION_AUTOMATICA;
      const socioId = 10;
      const mensaje = 'Inhabilitación automática aplicada';

      const notificacionCreada: Notificacion = {
        id: 5,
        tipo,
        socioId,
        mensaje,
        leida: false,
        createdAt: new Date(),
        socio: socioFixture,
      };

      notificacionRepository.create.mockReturnValueOnce(notificacionCreada);
      notificacionRepository.save.mockResolvedValueOnce(notificacionCreada);

      // Act
      const result = await service.crearNotificacion(tipo, socioId, mensaje);

      // Assert
      expect(result.tipo).toBe(TipoNotificacion.INHABILITACION_AUTOMATICA);
      expect(result.socioId).toBe(10);
    });

    it('debería pasar los parámetros correctos a create', async () => {
      // Arrange
      const tipo = TipoNotificacion.MOROSIDAD_3_MESES;
      const socioId = 7;
      const mensaje = 'Test mensaje';

      const notificacionCreada: Notificacion = {
        id: 6,
        tipo,
        socioId,
        mensaje,
        leida: false,
        createdAt: new Date(),
        socio: socioFixture,
      };

      notificacionRepository.create.mockReturnValueOnce(notificacionCreada);
      notificacionRepository.save.mockResolvedValueOnce(notificacionCreada);

      // Act
      await service.crearNotificacion(tipo, socioId, mensaje);

      // Assert
      expect(notificacionRepository.create).toHaveBeenCalledWith({
        tipo,
        socioId,
        mensaje,
      });
    });

    it('debería retornar la notificación guardada desde el repository', async () => {
      // Arrange
      const notificacionGuardada: Notificacion = {
        id: 7,
        tipo: TipoNotificacion.MOROSIDAD_3_MESES,
        socioId: 8,
        mensaje: 'Notificación guardada',
        leida: false,
        createdAt: new Date('2024-01-20T12:00:00Z'),
        socio: socioFixture,
      };

      notificacionRepository.create.mockReturnValueOnce(notificacionGuardada);
      notificacionRepository.save.mockResolvedValueOnce(notificacionGuardada);

      // Act
      const result = await service.crearNotificacion(
        TipoNotificacion.MOROSIDAD_3_MESES,
        8,
        'Notificación guardada',
      );

      // Assert
      expect(result).toBe(notificacionGuardada);
      expect(result.id).toBe(7);
      expect(result.leida).toBe(false);
    });

    it('debería manejar mensajes largos correctamente', async () => {
      // Arrange
      const mensajeLargo =
        'Este es un mensaje muy largo que contiene información detallada sobre la notificación';
      const notificacionCreada: Notificacion = {
        id: 8,
        tipo: TipoNotificacion.MOROSIDAD_3_MESES,
        socioId: 9,
        mensaje: mensajeLargo,
        leida: false,
        createdAt: new Date(),
        socio: socioFixture,
      };

      notificacionRepository.create.mockReturnValueOnce(notificacionCreada);
      notificacionRepository.save.mockResolvedValueOnce(notificacionCreada);

      // Act
      const result = await service.crearNotificacion(
        TipoNotificacion.MOROSIDAD_3_MESES,
        9,
        mensajeLargo,
      );

      // Assert
      expect(result.mensaje).toBe(mensajeLargo);
      expect(notificacionRepository.create).toHaveBeenCalledWith({
        tipo: TipoNotificacion.MOROSIDAD_3_MESES,
        socioId: 9,
        mensaje: mensajeLargo,
      });
    });
  });

  describe('Integración entre métodos', () => {
    it('debería crear notificación y luego marcarla como leída', async () => {
      // Arrange
      const notificacionCreada: Notificacion = {
        id: 20,
        tipo: TipoNotificacion.MOROSIDAD_3_MESES,
        socioId: 1,
        mensaje: 'Test integración',
        leida: false,
        createdAt: new Date(),
        socio: socioFixture,
      };

      notificacionRepository.create.mockReturnValueOnce(notificacionCreada);
      notificacionRepository.save.mockResolvedValueOnce(notificacionCreada);
      notificacionRepository.findOne.mockResolvedValueOnce(notificacionCreada);
      notificacionRepository.save.mockResolvedValueOnce({
        ...notificacionCreada,
        leida: true,
      });

      // Act
      const creada = await service.crearNotificacion(
        TipoNotificacion.MOROSIDAD_3_MESES,
        1,
        'Test integración',
      );
      const marcada = await service.marcarLeida(creada.id);

      // Assert
      expect(marcada.message).toBe('Notificación marcada como leída');
    });

    it('debería contar correctamente después de marcar como leída', async () => {
      // Arrange
      notificacionRepository.count.mockResolvedValueOnce(3);

      // Act
      const conteo = await service.contarNoLeidas();

      // Assert
      expect(conteo.totalNoLeidas).toBe(3);
    });
  });
});
