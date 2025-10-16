import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpStatus,
  HttpException,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { CustomError } from '../../constants/errors/custom-error';
import { QueryFailedError } from 'typeorm';
import {
  ERROR_MESSAGES,
  ERROR_CODES,
} from '../../constants/errors/error-messages';

@Catch()
export class GlobalHttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalHttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status: number = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | string[] = ERROR_MESSAGES.INTERNAL_SERVER_ERROR;
    let errorCode: string | undefined;
    const isProd = process.env.NODE_ENV === 'production';

    // Manejo de CustomError (nuestro error personalizado)
    if (exception instanceof CustomError) {
      status = exception.statusCode;
      message = exception.message;
      errorCode = exception.errorCode;
    }
    // Manejo de errores de TypeORM (base de datos)
    else if (exception instanceof QueryFailedError) {
      const error = exception as QueryFailedError & { code?: string };
      status = HttpStatus.BAD_REQUEST;

      // Códigos de error comunes de PostgreSQL/MySQL
      switch (error.code) {
        case '23505': // PostgreSQL - unique violation
        case 'ER_DUP_ENTRY': // MySQL - duplicate entry
          message = ERROR_MESSAGES.DB_UNIQUE_VIOLATION;
          errorCode = ERROR_CODES.DB_UNIQUE_VIOLATION;
          break;
        case '23503': // PostgreSQL - foreign key violation
        case 'ER_ROW_IS_REFERENCED': // MySQL - foreign key constraint
        case 'ER_ROW_IS_REFERENCED_2':
          message = ERROR_MESSAGES.DB_FOREIGN_KEY_VIOLATION;
          errorCode = ERROR_CODES.DB_FOREIGN_KEY_VIOLATION;
          break;
        default:
          message = isProd
            ? ERROR_MESSAGES.DB_CONSTRAINT_ERROR
            : `Error de base de datos: ${error.message}`;
          errorCode = ERROR_CODES.DB_CONSTRAINT_ERROR;
      }

      this.logger.error(
        `Error de base de datos: ${error.code}`,
        error.stack,
        'GlobalHttpExceptionFilter',
      );
    }
    // Manejo de HttpException (excepciones de NestJS)
    else if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();

      if (typeof res === 'string') {
        message = res;
      } else if (typeof res === 'object' && res !== null) {
        const exceptionResponse = res as {
          message?: string | string[];
          error?: string;
        };

        // Errores de validación (class-validator)
        if (Array.isArray(exceptionResponse.message)) {
          message = exceptionResponse.message;
          errorCode = ERROR_CODES.VALIDATION_ERROR;
        } else if (exceptionResponse.message) {
          message = exceptionResponse.message;
        } else if (exceptionResponse.error) {
          message = exceptionResponse.error;
        }
      }
    }
    // Manejo de errores genéricos
    else if (exception instanceof Error) {
      message = isProd ? ERROR_MESSAGES.UNEXPECTED_ERROR : exception.message;
      errorCode = ERROR_CODES.UNEXPECTED_ERROR;

      // Loguear el error completo para debugging
      this.logger.error(
        'Error no controlado capturado',
        exception.stack,
        'GlobalHttpExceptionFilter',
      );
    }

    // Construir la respuesta
    const errorResponse: {
      success: boolean;
      statusCode: number;
      timestamp: string;
      path: string;
      message: string | string[];
      errorCode?: string;
    } = {
      success: false,
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      message,
    };

    // Incluir errorCode solo si existe
    if (errorCode) {
      errorResponse.errorCode = errorCode;
    }

    response.status(status).json(errorResponse);
  }
}
