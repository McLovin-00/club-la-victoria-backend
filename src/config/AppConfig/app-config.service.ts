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
  TARJETA_CENTRO_EXTENSION_DEFAULT = 'TARJETA_CENTRO_EXTENSION_DEFAULT',
  TARJETA_CENTRO_PERIOD_CONFIG = 'TARJETA_CENTRO_PERIOD_CONFIG',
  TARJETA_CENTRO_FALLBACK_HEADER_DAY = 'TARJETA_CENTRO_FALLBACK_HEADER_DAY',
  TARJETA_CENTRO_FALLBACK_TRAILER_DAY = 'TARJETA_CENTRO_FALLBACK_TRAILER_DAY',
  TARJETA_CENTRO_FALLBACK_MONTH_LETTER_MAP =
    'TARJETA_CENTRO_FALLBACK_MONTH_LETTER_MAP',
}

export interface TarjetaCentroPeriodoConfig {
  fechaCabecera: string;
  fechaTrailer: string;
  extensionArchivo: string;
  codigoPeriodoDetalle?: string;
  nombreInstitucion?: string;
}

export type TarjetaCentroMonthLetterMap = Record<string, string>;

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
    return this.configService.get<string>(VariablesEntorno.HOST, '0.0.0.0');
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
      '4310050019094',
    );
  }

  getTarjetaCentroNombre(): string {
    return this.configService.get<string>(
      VariablesEntorno.TARJETA_CENTRO_NOMBRE,
      'CLUB DE CAZADORES LA',
    );
  }

  getTarjetaCentroExtensionDefault(): string {
    return this.configService.get<string>(
      VariablesEntorno.TARJETA_CENTRO_EXTENSION_DEFAULT,
      '23f',
    );
  }

  getTarjetaCentroPeriodConfig(): Record<string, TarjetaCentroPeriodoConfig> {
    const rawConfig = this.configService.get<string>(
      VariablesEntorno.TARJETA_CENTRO_PERIOD_CONFIG,
      '{}',
    );

    try {
      const parsedConfig: unknown = JSON.parse(rawConfig);

      if (
        parsedConfig === null ||
        Array.isArray(parsedConfig) ||
        typeof parsedConfig !== 'object'
      ) {
        throw new Error('La configuracion debe ser un objeto JSON.');
      }

      return parsedConfig as Record<string, TarjetaCentroPeriodoConfig>;
    } catch (error) {
      this.logger.error(
        'La variable TARJETA_CENTRO_PERIOD_CONFIG no contiene JSON valido.',
        error instanceof Error ? error.stack : String(error),
      );

      throw new InternalServerErrorException(
        'La configuracion operativa de Tarjeta del Centro es invalida.',
      );
    }
  }

  getTarjetaCentroFallbackHeaderDay(): number {
    return this.configService.get<number>(
      VariablesEntorno.TARJETA_CENTRO_FALLBACK_HEADER_DAY,
      22,
    );
  }

  getTarjetaCentroFallbackTrailerDay(): number {
    return this.configService.get<number>(
      VariablesEntorno.TARJETA_CENTRO_FALLBACK_TRAILER_DAY,
      23,
    );
  }

  getTarjetaCentroFallbackMonthLetterMap(): TarjetaCentroMonthLetterMap {
    const rawConfig = this.configService.get<string>(
      VariablesEntorno.TARJETA_CENTRO_FALLBACK_MONTH_LETTER_MAP,
      '{"01":"e","02":"f","03":"m","04":"b","05":"y","06":"j","07":"l","08":"a","09":"s","10":"o","11":"n","12":"d"}',
    );

    try {
      const parsedConfig: unknown = JSON.parse(rawConfig);

      if (
        parsedConfig === null ||
        Array.isArray(parsedConfig) ||
        typeof parsedConfig !== 'object'
      ) {
        throw new Error('El mapa de letras debe ser un objeto JSON.');
      }

      return parsedConfig as TarjetaCentroMonthLetterMap;
    } catch (error) {
      this.logger.error(
        'La variable TARJETA_CENTRO_FALLBACK_MONTH_LETTER_MAP no contiene JSON valido.',
        error instanceof Error ? error.stack : String(error),
      );

      throw new InternalServerErrorException(
        'La configuracion fallback de letras de Tarjeta del Centro es invalida.',
      );
    }
  }
}
