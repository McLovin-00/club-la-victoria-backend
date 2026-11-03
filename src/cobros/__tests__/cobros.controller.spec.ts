import { ValidationPipe, VersioningType } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { CobrosController } from '../cobros.controller';
import { CobrosService } from '../cobros.service';
import { TarjetaCentro23fService } from '../services/tarjeta-centro-23f.service';
import { TalonarioPdfService } from '../services/talonario-pdf.service';

describe('CobrosController mobile quota generation', () => {
  let app: Awaited<ReturnType<TestingModule['createNestApplication']>>;
  const generarCuotasSeleccion = jest.fn();

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CobrosController],
      providers: [
        {
          provide: CobrosService,
          useValue: { generarCuotasSeleccion },
        },
        { provide: TalonarioPdfService, useValue: {} },
        { provide: TarjetaCentro23fService, useValue: {} },
      ],
    }).compile();

    app = module.createNestApplication();
    app.setGlobalPrefix('api');
    app.enableVersioning({
      type: VersioningType.URI,
      defaultVersion: '1',
    });
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    generarCuotasSeleccion.mockReset();
    generarCuotasSeleccion.mockResolvedValue({
      creadas: 1,
      omitidas: 0,
      advertenciasMorosidad: 0,
      inhabilitados: 0,
      desactivados: 0,
      advertencias: [],
    });
  });

  it('generates for exactly the path member without requiring JWT', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/cobros/mobile/socios/42/cuotas')
      .send({ periodo: '2026-11' })
      .expect(201);

    expect(generarCuotasSeleccion).toHaveBeenCalledTimes(1);
    expect(generarCuotasSeleccion).toHaveBeenCalledWith({
      periodo: '2026-11',
      socioIds: [42],
    });
  });

  it('rejects an invalid monthly period before generation', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/cobros/mobile/socios/42/cuotas')
      .send({ periodo: '2026-13' })
      .expect(400);

    expect(generarCuotasSeleccion).not.toHaveBeenCalled();
  });

  it('rejects plural member IDs in the request body', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/cobros/mobile/socios/42/cuotas')
      .send({ periodo: '2026-11', socioIds: [42, 43] })
      .expect(400);

    expect(generarCuotasSeleccion).not.toHaveBeenCalled();
  });
});
