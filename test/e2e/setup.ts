import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { execSync } from 'node:child_process';
import path from 'node:path';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { GlobalHttpExceptionFilter } from '../../src/common/filters/exception.filter';

interface LoginResponseBody {
  token?: string;
}

export interface E2eContext {
  app: INestApplication;
  authToken: string;
}

let seedEjecutado = false;

const extraerToken = (body: LoginResponseBody | string, rawText: string): string => {
  if (typeof body === 'string' && body.length > 0) {
    return body;
  }

  if (typeof body === 'object' && body !== null && typeof body.token === 'string') {
    return body.token;
  }

  const tokenTextoPlano = rawText.trim().replace(/^"|"$/g, '');
  if (tokenTextoPlano.length > 0) {
    return tokenTextoPlano;
  }

  throw new Error('No se pudo extraer token de login para pruebas E2E.');
};

export const crearContextoE2e = async (): Promise<E2eContext> => {
  const modulo: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = modulo.createNestApplication();
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
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  app.useGlobalFilters(new GlobalHttpExceptionFilter());

  await app.init();

  if (!seedEjecutado) {
    const backendRoot = path.resolve(__dirname, '..', '..');
    execSync('npm run seed:e2e', {
      cwd: backendRoot,
      stdio: 'inherit',
    });
    seedEjecutado = true;
  }

  const httpServer = app.getHttpServer();
  const loginResponse = await request(httpServer)
    .post('/api/v1/auth/login')
    .send({ usuario: process.env.E2E_USER ?? 'admin', password: process.env.E2E_PASS ?? 'admin' })
    .expect(201);

  const authToken = extraerToken(
    loginResponse.body as LoginResponseBody | string,
    typeof loginResponse.text === 'string' ? loginResponse.text : '',
  );

  return { app, authToken };
};

export const cerrarContextoE2e = async (app: INestApplication): Promise<void> => {
  if (app) {
    await app.close();
  }
};
