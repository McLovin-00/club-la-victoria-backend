import { Test, TestingModule } from '@nestjs/testing';
import { JwtModule, JwtService } from '@nestjs/jwt';
import bcrypt from 'bcrypt';
import { AuthService } from '../auth.service';
import { UsuarioRepository } from '../repositories/usuario.repository';
import { LoginDto } from '../dto/login.dto';
import { Usuario } from '../entities/usuario.entity';
import { ERROR_CODES } from 'src/constants/errors/error-messages';
import { usuarioFixture } from '../../../test/fixtures/entities/usuario.fixture';
import { UsuarioBuilder } from '../../../test/builders/usuario.builder';

describe('AuthService', () => {
  let service: AuthService;
  let jwtService: JwtService;
  let usuarioRepository: jest.Mocked<Pick<UsuarioRepository, 'findByUsername'>>;

  beforeEach(async () => {
    usuarioRepository = {
      findByUsername: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      imports: [
        JwtModule.register({
          secret: 'test-secret',
          signOptions: { expiresIn: '1h' },
        }),
      ],
      providers: [
        AuthService,
        {
          provide: UsuarioRepository,
          useValue: usuarioRepository,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    jwtService = module.get<JwtService>(JwtService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('debería hacer login exitoso con credenciales válidas', async () => {
    const plainPassword = 'Password123!';
    const hashedPassword = await bcrypt.hash(plainPassword, 10);
    const usuarioValido = new UsuarioBuilder(usuarioFixture)
      .withPassword(hashedPassword)
      .build() as Usuario;

    usuarioRepository.findByUsername.mockResolvedValue(usuarioValido);

    const token = await service.login({
      usuario: usuarioValido.usuario,
      password: plainPassword,
    });

    const payload = await jwtService.verifyAsync<{ usuario: string }>(token);

    expect(token).toEqual(expect.any(String));
    expect(payload.usuario).toBe(usuarioValido.usuario);
  });

  it('debería fallar el login cuando el usuario no existe (404)', async () => {
    usuarioRepository.findByUsername.mockResolvedValue(null);

    await expect(
      service.login({ usuario: 'inexistente', password: 'Password123!' }),
    ).rejects.toMatchObject({
      statusCode: 404,
      errorCode: ERROR_CODES.USER_NOT_FOUND,
    });
  });

  it('debería fallar el login cuando la contraseña es incorrecta (401)', async () => {
    const hashedPassword = await bcrypt.hash('Password123!', 10);
    const usuarioValido = new UsuarioBuilder(usuarioFixture)
      .withPassword(hashedPassword)
      .build() as Usuario;

    usuarioRepository.findByUsername.mockResolvedValue(usuarioValido);

    await expect(
      service.login({ usuario: usuarioValido.usuario, password: 'otra-clave' }),
    ).rejects.toMatchObject({
      statusCode: 401,
      errorCode: ERROR_CODES.INVALID_PASSWORD,
    });
  });

  it('debería generar un token JWT válido', async () => {
    const hashedPassword = await bcrypt.hash('Password123!', 10);
    const usuarioValido = new UsuarioBuilder(usuarioFixture)
      .withPassword(hashedPassword)
      .build() as Usuario;

    usuarioRepository.findByUsername.mockResolvedValue(usuarioValido);

    const token = await service.login({
      usuario: usuarioValido.usuario,
      password: 'Password123!',
    });

    expect(token.split('.')).toHaveLength(3);
  });

  it('debería validar correctamente un token JWT emitido', async () => {
    const token = await jwtService.signAsync({ usuario: 'admin' });

    const payload = await jwtService.verifyAsync<{ usuario: string }>(token);

    expect(payload.usuario).toBe('admin');
  });

  it('debería manejar credenciales vacías o nulas', async () => {
    usuarioRepository.findByUsername.mockResolvedValue(null);

    await expect(
      service.login({ usuario: '', password: '' } as LoginDto),
    ).rejects.toMatchObject({
      statusCode: 404,
      errorCode: ERROR_CODES.USER_NOT_FOUND,
    });

    await expect(service.login(null as unknown as LoginDto)).rejects.toThrow(
      TypeError,
    );
  });
});
