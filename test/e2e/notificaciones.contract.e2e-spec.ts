import { INestApplication } from '@nestjs/common';
import request from 'supertest';

import { cerrarContextoE2e, crearContextoE2e } from './setup';

describe('Notificaciones contract (F26)', () => {
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

  it('GET /api/v1/notificaciones/contador responde 200 con totalNoLeidas', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/notificaciones/contador')
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    expect(typeof response.body.totalNoLeidas).toBe('number');
  });

  it('GET /api/v1/notificaciones responde 200 con lista', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/notificaciones')
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    expect(Array.isArray(response.body.notificaciones)).toBe(true);
    expect(typeof response.body.totalNoLeidas).toBe('number');
  });

  it('POST /api/v1/notificaciones/leer-todas responde 201/200 segun transport', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/notificaciones/leer-todas')
      .set('Authorization', `Bearer ${authToken}`);

    expect([200, 201]).toContain(response.status);
    expect(typeof response.body.message).toBe('string');
  });

  it('POST /api/v1/notificaciones/:id/leer responde 404 para id inexistente', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/notificaciones/999999/leer')
      .set('Authorization', `Bearer ${authToken}`)
      .expect(404);
  });
});
