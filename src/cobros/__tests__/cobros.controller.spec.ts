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
  const registrarCobroPeriodosMobile = jest.fn();
  const obtenerPeriodosCobroMobile = jest.fn();

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CobrosController],
      providers: [
        {
          provide: CobrosService,
          useValue: { generarCuotasSeleccion, registrarCobroPeriodosMobile, obtenerPeriodosCobroMobile },
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
    registrarCobroPeriodosMobile.mockReset().mockResolvedValue({ id: 1 });
    obtenerPeriodosCobroMobile.mockReset().mockResolvedValue({ montoMensual: 10000, periodosPagados: [] });
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

  it('accepts multiple periods for one mobile member without JWT', async () => {
    const body = {
      periodos: ['2026-11', '2026-12'],
      pagos: [{ metodoPagoId: 1, monto: 10000 }],
      cobradorId: 3,
      installationId: 'device-test',
      total: 10000,
      idempotencyKey: 'device-test-1',
      totalCuotasEsperado: 20000,
      creditoEsperado: 7000,
    };
    await request(app.getHttpServer())
      .post('/api/v1/cobros/mobile/socios/42/cobro-periodos')
      .send(body)
      .expect(201);
    expect(registrarCobroPeriodosMobile).toHaveBeenCalledWith(42, body);
  });

  it('returns period information for exactly the requested mobile member', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/cobros/mobile/socios/42/periodos')
      .expect(200);
    expect(obtenerPeriodosCobroMobile).toHaveBeenCalledWith(42);
  });

  it('rejects an invalid period and extra member IDs in the mobile collection', async () => {
    const body = {
      periodos: ['2026-13'],
      pagos: [{ metodoPagoId: 1, monto: 10000 }],
      cobradorId: 3,
      installationId: 'device-test',
      total: 10000,
      idempotencyKey: 'device-test-1',
      totalCuotasEsperado: 20000,
      creditoEsperado: 7000,
    };
    await request(app.getHttpServer())
      .post('/api/v1/cobros/mobile/socios/42/cobro-periodos')
      .send(body)
      .expect(400);
    await request(app.getHttpServer())
      .post('/api/v1/cobros/mobile/socios/42/cobro-periodos')
      .send({ ...body, periodos: ['2026-11'], socioIds: [42, 43] })
      .expect(400);
    expect(registrarCobroPeriodosMobile).not.toHaveBeenCalled();
  });
});
