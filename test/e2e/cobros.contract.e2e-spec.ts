import { INestApplication } from '@nestjs/common';
import request from 'supertest';

import { cerrarContextoE2e, crearContextoE2e } from './setup';

describe('Cobros contract (F16/F17)', () => {
  let app: INestApplication;
  let authToken = '';

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

  it('POST /api/v1/cobros/pagos/multiple valida payload y responde 400', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/cobros/pagos/multiple')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ cuotaIds: [], metodoPagoId: 1 })
      .expect(400);

    expect(response.body.message).toBeDefined();
  });
});
