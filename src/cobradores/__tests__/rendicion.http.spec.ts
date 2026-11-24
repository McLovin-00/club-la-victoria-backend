import type { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { UsuarioRepository } from '../../auth/repositories/usuario.repository';
import { JwtStrategy } from '../../common/strategies/jwt-auth.strategy';
import { AppConfigService } from '../../config/AppConfig/app-config.service';
import { CobradoresController } from '../cobradores.controller';
import { CobradoresService } from '../cobradores.service';

const secreto = 'secreto-para-pruebas-de-rendicion';
const jwt = new JwtService({ secret: secreto });
const ruta = '/cobradores/17/rendicion';
const periodo = '?periodo=2024-02';
const sesion = `Bearer ${jwt.sign({ usuario: 'personal-de-prueba' })}`;
const rendicion = { cobrador: 'Cobradora de prueba', cobros: [{ socio: 'Socio ficticio' }] };

describe('Acceso HTTP a rendición', () => {
  let app: INestApplication;
  const obtenerRendicion = jest.fn(async () => rendicion);

  beforeAll(async () => {
    const modulo = await Test.createTestingModule({
      imports: [PassportModule],
      controllers: [CobradoresController],
      providers: [
        JwtStrategy,
        { provide: AppConfigService, useValue: { getJwtSecret: () => secreto } },
        { provide: UsuarioRepository, useValue: {
          findByUsername: (usuario: string) => usuario === 'personal-de-prueba' ? { id: 1 } : null,
        } },
        { provide: CobradoresService, useValue: { obtenerRendicion } },
      ],
    }).compile();
    app = modulo.createNestApplication({ logger: false });
    await app.init();
  });
  afterAll(async () => app?.close());

  it('no devuelve datos sin JWT ni con JWT de un usuario inexistente', async () => {
    const http = request(app.getHttpServer());
    await http.get(ruta + periodo).expect(401);
    await http.head(ruta + periodo).expect(401);
    await http.get(ruta + periodo)
      .set('Authorization', `Bearer ${jwt.sign({ usuario: 'inexistente' })}`).expect(401);
    expect(obtenerRendicion).not.toHaveBeenCalled();
  });

  it('acepta una sesión válida sin dejar cachear el informe', async () => {
    const http = request(app.getHttpServer());
    await http.get(`${ruta}${periodo}&desde%5B%5D=2024-02-12`).set('Authorization', sesion).expect(400);
    expect(obtenerRendicion).not.toHaveBeenCalled();
    await http.get(ruta + periodo).set('Authorization', sesion)
      .expect('Cache-Control', 'private, no-store').expect(200, rendicion);
    expect(obtenerRendicion).toHaveBeenCalledWith(17, undefined, undefined, '2024-02');
  });
});
