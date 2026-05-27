import { INestApplication } from '@nestjs/common';
import request from 'supertest';

import { cerrarContextoE2e, crearContextoE2e } from './setup';

describe('Cobros contract (F16/F17)', () => {
  let app: INestApplication;
  let authToken = '';

  const construirPeriodoObjetivo = () => {
    const fecha = new Date();
    const anio = fecha.getFullYear() + 10;
    const mes = String(fecha.getMonth() + 1).padStart(2, '0');
    return `${anio}-${mes}`;
  };

  beforeAll(async () => {
    const contexto = await crearContextoE2e();
    app = contexto.app;
    authToken = contexto.authToken;
  });

  afterAll(async () => {
    await cerrarContextoE2e(app);
  });

  it('GET /api/v1/cobros/socios-elegibles devuelve socios para un periodo valido', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/cobros/socios-elegibles')
      .query({ periodo: '2025-11' })
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    expect(Array.isArray(response.body.socios)).toBe(true);
    expect(typeof response.body.total).toBe('number');
  });

  it('GET /api/v1/cobros/cuotas devuelve respuesta paginada', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/cobros/cuotas')
      .query({ periodo: '2025-11', page: 1, limit: 5 })
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    expect(Array.isArray(response.body.cuotas)).toBe(true);
    expect(typeof response.body.total).toBe('number');
    expect(typeof response.body.totalPages).toBe('number');
  });

  it('POST /api/v1/cobros/generar-seleccion genera cuotas para socios con y sin tarjeta del centro', async () => {
    const periodo = construirPeriodoObjetivo();

    const elegiblesResponse = await request(app.getHttpServer())
      .get('/api/v1/cobros/socios-elegibles')
      .query({ periodo })
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    const socios = elegiblesResponse.body.socios as Array<{
      id: number;
      tarjetaCentro: boolean;
    }>;

    const socioConTarjeta = socios.find((s) => s.tarjetaCentro === true);
    const socioSinTarjeta = socios.find((s) => s.tarjetaCentro === false);

    expect(socioConTarjeta).toBeDefined();
    expect(socioSinTarjeta).toBeDefined();

    const socioIds = [socioConTarjeta!.id, socioSinTarjeta!.id];

    const generarResponse = await request(app.getHttpServer())
      .post('/api/v1/cobros/generar-seleccion')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ periodo, socioIds })
      .expect(201);

    expect(typeof generarResponse.body.creadas).toBe('number');
    expect(typeof generarResponse.body.omitidas).toBe('number');

    const cuotasConTarjeta = await request(app.getHttpServer())
      .get('/api/v1/cobros/cuotas')
      .query({ periodo, tarjetaCentro: 'true', page: 1, limit: 200 })
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    const cuotasSinTarjeta = await request(app.getHttpServer())
      .get('/api/v1/cobros/cuotas')
      .query({ periodo, tarjetaCentro: 'false', page: 1, limit: 200 })
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    const contieneSocio = (
      cuotas: Array<{ socioId?: number; socio?: { id?: number } }>,
      socioId: number,
    ) => cuotas.some((c) => c.socioId === socioId || c.socio?.id === socioId);

    expect(
      contieneSocio(cuotasConTarjeta.body.cuotas, socioConTarjeta!.id),
    ).toBe(true);
    expect(
      contieneSocio(cuotasSinTarjeta.body.cuotas, socioSinTarjeta!.id),
    ).toBe(true);
  });

  it('GET /api/v1/cobros/reportes/cobranza devuelve métricas numéricas para un período con datos', async () => {
    const cuotasResponse = await request(app.getHttpServer())
      .get('/api/v1/cobros/cuotas')
      .query({ page: 1, limit: 1 })
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    expect(cuotasResponse.body.cuotas.length).toBeGreaterThan(0);
    const periodo = cuotasResponse.body.cuotas[0].periodo as string;

    const reporteResponse = await request(app.getHttpServer())
      .get('/api/v1/cobros/reportes/cobranza')
      .query({ periodo })
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    expect(reporteResponse.body.periodo).toBe(periodo);
    expect(typeof reporteResponse.body.totalGenerado).toBe('number');
    expect(typeof reporteResponse.body.totalCobrado).toBe('number');
    expect(typeof reporteResponse.body.cuotasPagadas).toBe('number');
    expect(typeof reporteResponse.body.cuotasPendientes).toBe('number');
    expect(Array.isArray(reporteResponse.body.desglosePorMetodoPago)).toBe(
      true,
    );
    expect(reporteResponse.body.totalCobrado).toBeLessThanOrEqual(
      reporteResponse.body.totalGenerado,
    );
  });

  it('GET /api/v1/cobros/reportes/cobranza-rango consolida correctamente el desglose mensual', async () => {
    const cuotasResponse = await request(app.getHttpServer())
      .get('/api/v1/cobros/cuotas')
      .query({ page: 1, limit: 1 })
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    expect(cuotasResponse.body.cuotas.length).toBeGreaterThan(0);
    const periodo = cuotasResponse.body.cuotas[0].periodo as string;

    const reporteRangoResponse = await request(app.getHttpServer())
      .get('/api/v1/cobros/reportes/cobranza-rango')
      .query({ periodoDesde: periodo, periodoHasta: periodo })
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    const meses = reporteRangoResponse.body.meses as Array<{
      totalGenerado: number;
      totalCobrado: number;
    }>;

    expect(Array.isArray(meses)).toBe(true);
    expect(meses.length).toBeGreaterThan(0);

    const sumaGenerado = meses.reduce(
      (acc, mes) => acc + Number(mes.totalGenerado),
      0,
    );
    const sumaCobrado = meses.reduce(
      (acc, mes) => acc + Number(mes.totalCobrado),
      0,
    );

    expect(reporteRangoResponse.body.totalGenerado).toBe(sumaGenerado);
    expect(reporteRangoResponse.body.totalCobrado).toBe(sumaCobrado);
    expect(reporteRangoResponse.body.cantidadMeses).toBe(meses.length);
  });

  it('POST /api/v1/cobros/pagos/multiple valida payload y responde 400', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/cobros/pagos/multiple')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ cuotaIds: [], metodoPagoId: 1 })
      .expect(400);

    expect(response.body.message).toBeDefined();
  });

  it('PATCH /api/v1/cobros/pagos/operacion/:id no requiere JWT porque lo usa mobile', async () => {
    const response = await request(app.getHttpServer())
      .patch('/api/v1/cobros/pagos/operacion/999999')
      .send({
        cuotaIds: [1],
        conceptos: [],
        total: 1,
        metodoPagoId: 1,
        cobradorId: 1,
        installationId: 'e2e-device',
      });

    expect(response.status).not.toBe(401);
  });

  describe('POST /api/v1/cobros/pago-anual', () => {
    it('responde 400 con payload inválido (sin socioId)', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/cobros/pago-anual')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ anio: 2026, metodoPagoId: 1 })
        .expect(400);

      expect(response.body.message).toBeDefined();
    });

    it('responde 400 con payload inválido (sin metodoPagoId)', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/cobros/pago-anual')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ socioId: 1, anio: 2026 })
        .expect(400);

      expect(response.body.message).toBeDefined();
    });

    it('responde 404 cuando el socio no existe', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/cobros/pago-anual')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ socioId: 999999, anio: 2026, metodoPagoId: 1 })
        .expect(404);

      expect(response.body.message).toBeDefined();
    });

    it('responde 401 sin token de autenticación', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/cobros/pago-anual')
        .send({ socioId: 1, anio: 2026, metodoPagoId: 1 })
        .expect(401);
    });

    it('registra pago anual correctamente para un socio activo con categoría', async () => {
      // Obtener un socio elegible del seed
      const elegiblesResponse = await request(app.getHttpServer())
        .get('/api/v1/cobros/socios-elegibles')
        .query({ periodo: `${new Date().getFullYear() + 5}-01` })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const socios = elegiblesResponse.body.socios as Array<{ id: number }>;
      expect(socios.length).toBeGreaterThan(0);

      const socioId = socios[0].id;
      const anio = new Date().getFullYear() + 5; // año futuro para no colisionar con datos del seed

      // Obtener un método de pago activo
      const metodosPagoResponse = await request(app.getHttpServer())
        .get('/api/v1/metodos-pago')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const metodosPago = metodosPagoResponse.body as Array<{ id: number; nombre: string }>;
      expect(metodosPago.length).toBeGreaterThan(0);
      const metodoPagoId = metodosPago[0].id;

      const response = await request(app.getHttpServer())
        .post('/api/v1/cobros/pago-anual')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ socioId, anio, metodoPagoId })
        .expect(201);

      expect(typeof response.body.cuotasGeneradas).toBe('number');
      expect(typeof response.body.cuotasPagadas).toBe('number');
      expect(typeof response.body.cuotasYaPagadas).toBe('number');
      expect(typeof response.body.totalPagado).toBe('number');
      expect(Array.isArray(response.body.periodosPagados)).toBe(true);

      expect(response.body.cuotasGeneradas).toBe(12);
      expect(response.body.cuotasPagadas).toBe(12);
      expect(response.body.cuotasYaPagadas).toBe(0);
      expect(response.body.periodosPagados).toHaveLength(12);
      expect(response.body.periodosPagados[0]).toBe(`${anio}-01`);
      expect(response.body.periodosPagados[11]).toBe(`${anio}-12`);
      expect(response.body.totalPagado).toBeGreaterThan(0);
    });

    it('es idempotente: un segundo pago anual del mismo año omite las cuotas ya pagadas', async () => {
      const elegiblesResponse = await request(app.getHttpServer())
        .get('/api/v1/cobros/socios-elegibles')
        .query({ periodo: `${new Date().getFullYear() + 6}-01` })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const socios = elegiblesResponse.body.socios as Array<{ id: number }>;
      expect(socios.length).toBeGreaterThan(0);
      const socioId = socios[0].id;
      const anio = new Date().getFullYear() + 6;

      const metodosPagoResponse = await request(app.getHttpServer())
        .get('/api/v1/metodos-pago')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);
      const metodoPagoId = (metodosPagoResponse.body as Array<{ id: number }>)[0].id;

      // Primer pago
      await request(app.getHttpServer())
        .post('/api/v1/cobros/pago-anual')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ socioId, anio, metodoPagoId })
        .expect(201);

      // Segundo pago del mismo año
      const segundoResponse = await request(app.getHttpServer())
        .post('/api/v1/cobros/pago-anual')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ socioId, anio, metodoPagoId })
        .expect(201);

      expect(segundoResponse.body.cuotasPagadas).toBe(0);
      expect(segundoResponse.body.cuotasYaPagadas).toBe(12);
      expect(segundoResponse.body.cuotasGeneradas).toBe(0);
      expect(segundoResponse.body.periodosPagados).toHaveLength(0);
    });
  });
});
