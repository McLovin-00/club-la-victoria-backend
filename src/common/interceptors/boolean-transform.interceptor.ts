import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';

/**
 * Interceptor que pre-procesa el body de requests multipart/form-data
 * para convertir strings de booleanos ("true"/"false") a valores booleanos reales.
 *
 * Esto debe ejecutarse ANTES del ValidationPipe para evitar que
 * enableImplicitConversion convierta incorrectamente "false" a true.
 *
 * PROBLEMA QUE RESUELVE:
 * - FormData envía booleanos como strings: "true" o "false"
 * - JavaScript: Boolean("false") = true (porque string no vacío es truthy)
 * - ValidationPipe con enableImplicitConversion convierte "false" a true
 *
 * SOLUCIÓN:
 * - Este interceptor convierte "true"/"false" strings a true/false boolean
 * - ANTES de que ValidationPipe toque los datos
 */
@Injectable()
export class BooleanTransformInterceptor implements NestInterceptor {
  // Campos que deben ser tratados como booleanos
  private readonly booleanFields = new Set([
    'overrideManual',
    'activo',
    'habilitado',
    'isPrincipal',
    'tarjetaCentro',
    'eliminarFotoVieja',
  ]);

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest();

    // Solo procesar si hay body y es un objeto
    if (request.body && typeof request.body === 'object') {
      this.transformBooleanFields(request.body);
    }

    return next.handle();
  }

  private transformBooleanFields(body: Record<string, unknown>): void {
    for (const key of Object.keys(body)) {
      if (this.booleanFields.has(key)) {
        body[key] = this.parseToBoolean(body[key]);
      }
    }
  }

  private parseToBoolean(value: unknown): boolean | undefined {
    // Si es undefined o null, mantenerlo así (campo opcional)
    if (value === undefined || value === null) {
      return undefined;
    }

    // Si ya es boolean, retornarlo tal cual
    if (typeof value === 'boolean') {
      return value;
    }

    // Si es string, convertir explícitamente
    if (typeof value === 'string') {
      const normalizedValue = value.toLowerCase().trim();

      if (normalizedValue === 'true' || normalizedValue === '1') {
        return true;
      }

      if (
        normalizedValue === 'false' ||
        normalizedValue === '0' ||
        normalizedValue === ''
      ) {
        return false;
      }

      return undefined;
    }

    // Si es número
    if (typeof value === 'number') {
      return value === 1;
    }

    return undefined;
  }
}
