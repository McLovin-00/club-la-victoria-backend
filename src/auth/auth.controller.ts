import { Body, Controller, Post, ForbiddenException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { Private } from '../common/decorators/private.decorator';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AUTH } from 'src/constants/auth.constants';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @Throttle({
    default: {
      limit: AUTH.LOGIN_RATE_LIMIT_MAX_REQUESTS,
      ttl: AUTH.LOGIN_RATE_LIMIT_TTL,
    },
  })
  @ApiOperation({
    summary: 'Iniciar sesión',
    description:
      'Autentica un usuario con sus credenciales y devuelve un token JWT. Limitado a 5 intentos cada 5 minutos.',
  })
  @ApiResponse({
    status: 201,
    description: 'Login exitoso. Devuelve el token JWT',
    schema: {
      type: 'string',
      example:
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c3VhcmlvIjoiYWRtaW4iLCJpYXQiOjE2MTYyMzkwMjJ9.4Adcj0MKzW5z1nN0jX9r8TQ8YqYx5Z4lX9r8TQ8YqYx',
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Usuario no encontrado',
  })
  @ApiResponse({
    status: 401,
    description: 'Contraseña incorrecta',
  })
  @ApiResponse({
    status: 429,
    description:
      'Demasiados intentos de login. Intenta nuevamente en 5 minutos.',
  })
  async login(@Body() input: LoginDto) {
    return await this.authService.login(input);
  }

  @Post('generarPasswordHash')
  @Private()
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Generar hash de contraseña',
    description:
      'Genera un hash bcrypt de una contraseña. Endpoint protegido solo para administradores.',
  })
  @ApiResponse({
    status: 201,
    description: 'Hash generado exitosamente',
    schema: {
      type: 'string',
      example: '$2b$10$abcdefghijklmnopqrstuvwxyz1234567890ABCDEFGH',
    },
  })
  @ApiResponse({
    status: 401,
    description: 'No autorizado - Token inválido o ausente',
  })
  async generarPasswordHash(@Body() input: { password: string }) {
    // SEGURIDAD: Deshabilitar este endpoint en producción
    if (process.env.NODE_ENV === 'production') {
      throw new ForbiddenException(
        'Este endpoint no está disponible en producción',
      );
    }
    return await this.authService.generarPasswordHash(input.password);
  }
}
