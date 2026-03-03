import {
  Injectable,
  Logger,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

enum VariablesEntorno {
  NODE_ENV = 'NODE_ENV',
  PORT = 'PORT',
  HOST = 'HOST',
  DATABASE_HOST = 'DATABASE_HOST',
  DATABASE_PORT = 'DATABASE_PORT',
  DATABASE_NAME = 'DATABASE_NAME',
  DATABASE_USER = 'DATABASE_USER',
  DATABASE_PASSWORD = 'DATABASE_PASSWORD',
  DATABASE_TIMEZONE = 'DATABASE_TIMEZONE',
  JWT_SECRET = 'JWT_SECRET',
  JWT_EXPIRES_IN = 'JWT_EXPIRES_IN',
  CLOUDINARY_NAME = 'CLOUDINARY_NAME',
  CLOUDINARY_API_KEY = 'CLOUDINARY_API_KEY',
  CLOUDINARY_API_SECRET = 'CLOUDINARY_API_SECRET',
  CORS_ORIGIN = 'CORS_ORIGIN',
  TARJETA_CENTRO_PREFIX = 'TARJETA_CENTRO_PREFIX',
  TARJETA_CENTRO_EMISOR = 'TARJETA_CENTRO_EMISOR',
  TARJETA_CENTRO_NOMBRE = 'TARJETA_CENTRO_NOMBRE',
}

@Injectable()
export class AppConfigService {
  private readonly logger = new Logger(AppConfigService.name);

  constructor(private readonly configService: ConfigService) {}

  private getEnvironmentVariable<T>(key: string): T {
    try {
      return this.configService.getOrThrow<T>(key);
    } catch (error) {
      this.logger.error(
        `Missing environment variable: ${key}`,
        error instanceof Error ? error.stack : String(error),
      );
      throw new InternalServerErrorException(
        `Required environment variable ${key} is not set`,
      );
    }
  }

  //JWT
  getJwtSecret(): string {
    return this.getEnvironmentVariable<string>(VariablesEntorno.JWT_SECRET);
  }

  getJwtExpiresIn(): number {
    return this.getEnvironmentVariable<number>(VariablesEntorno.JWT_EXPIRES_IN);
  }

  //Variables globales
  getNodeEnv(): string {
    return this.configService.get<string>(
      VariablesEntorno.NODE_ENV,
      'development',
    );
  }

  isProduction(): boolean {
    return this.getNodeEnv() === 'production';
  }

  isDevelopment(): boolean {
    return this.getNodeEnv() === 'development';
  }

  getPort(): number {
    return this.getEnvironmentVariable<number>(VariablesEntorno.PORT);
  }

  getHost(): string {
    return this.configService.get<string>(VariablesEntorno.HOST, 'localhost');
  }

  //Variables de entorno DB
  getDatabaseHost(): string {
    return this.getEnvironmentVariable<string>(VariablesEntorno.DATABASE_HOST);
  }

  getDatabasePort(): number {
    return this.getEnvironmentVariable<number>(VariablesEntorno.DATABASE_PORT);
  }

  getDatabaseUser(): string {
    return this.getEnvironmentVariable<string>(VariablesEntorno.DATABASE_USER);
  }

  getDatabasePassword(): string {
    return this.getEnvironmentVariable<string>(
      VariablesEntorno.DATABASE_PASSWORD,
    );
  }

  getDatabaseName(): string {
    return this.getEnvironmentVariable<string>(VariablesEntorno.DATABASE_NAME);
  }

  getDatabaseTimezone(): string {
    return this.getEnvironmentVariable<string>(
      VariablesEntorno.DATABASE_TIMEZONE,
    );
  }

  //Variables de entorno Cloudinary
  getCloudinaryName(): string {
    return this.getEnvironmentVariable<string>(
      VariablesEntorno.CLOUDINARY_NAME,
    );
  }

  getCloudinaryApiKey(): string {
    return this.getEnvironmentVariable<string>(
      VariablesEntorno.CLOUDINARY_API_KEY,
    );
  }

  getCloudinaryApiSecret(): string {
    return this.getEnvironmentVariable<string>(
      VariablesEntorno.CLOUDINARY_API_SECRET,
    );
  }

  //CORS
  getCorsOrigin(): string | string[] {
    const origins = this.getEnvironmentVariable<string>(
      VariablesEntorno.CORS_ORIGIN,
    );
    // Soporta múltiples orígenes separados por coma
    if (origins.includes(',')) {
      return origins.split(',').map((origin) => origin.trim());
    }
    return origins;
  }

  getTarjetaCentroPrefix(): string {
    return this.configService.get<string>(
      VariablesEntorno.TARJETA_CENTRO_PREFIX,
      'C0019094',
    );
  }

  getTarjetaCentroEmisor(): string {
    return this.configService.get<string>(
      VariablesEntorno.TARJETA_CENTRO_EMISOR,
      '431005001909',
    );
  }

  getTarjetaCentroNombre(): string {
    return this.configService.get<string>(
      VariablesEntorno.TARJETA_CENTRO_NOMBRE,
      'CLUB DE CAZADORES LA',
    );
  }
}
