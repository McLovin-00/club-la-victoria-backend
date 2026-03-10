import { INestApplication } from '@nestjs/common';
import request from 'supertest';

import { cerrarContextoE2e, crearContextoE2e } from './setup';

describe('Auth + Health contract (F01/F02/F39/F41)', () => {
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

  it('POST /api/v1/auth/login responde 201 con token valido', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ usuario: 'admin', password: 'admin' })
      .expect(201);

    const token =
      typeof response.body === 'string'
        ? response.body
        : typeof response.text === 'string'
          ? response.text.replace(/^"|"$/g, '')
          : '';

    expect(token.length).toBeGreaterThan(20);
  });

  it('POST /api/v1/auth/login responde 401 con password invalida', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ usuario: 'admin', password: 'admin-invalido' })
      .expect(401);
  });

  it('GET /api/v1/health responde estado consistente (200/503)', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/health')
      .expect((res) => {
        expect([200, 503]).toContain(res.status);
      });

    expect(response.body).toBeDefined();
    expect(Object.keys(response.body).length).toBeGreaterThan(0);
    expect(response.body.statusCode ?? response.status).toBeDefined();
    expect(response.body.message ?? response.body.info ?? response.body.details).toBeDefined();
  });

  it('GET /api/v1/cobros/socios-elegibles responde 401 sin token', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/cobros/socios-elegibles')
      .query({ periodo: '2025-11' })
      .expect(401);
  });

  it('GET /api/v1/cobros/socios-elegibles responde 200 con token', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/cobros/socios-elegibles')
      .query({ periodo: '2025-11' })
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    expect(Array.isArray(response.body.socios)).toBe(true);
    expect(typeof response.body.total).toBe('number');
  });
});
