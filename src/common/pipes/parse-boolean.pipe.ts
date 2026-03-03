import { PipeTransform, Injectable, ArgumentMetadata } from '@nestjs/common';

/**
 * Pipe personalizado para convertir strings a booleanos de forma segura.
 *
 * Resuelve el problema de FormData que envía booleanos como strings ("true"/"false")
 * y evita el error de JavaScript donde Boolean("false") = true.
 *
 * Valores que se convierten a TRUE: "true", "1", 1, true
 * Valores que se convierten a FALSE: "false", "0", 0, false, "", null, undefined
 */
@Injectable()
export class ParseBooleanPipe implements PipeTransform {
  transform(value: unknown, metadata: ArgumentMetadata): boolean | undefined {
    // Si es undefined o null, retornar undefined (campo opcional)
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

      // Valor no reconocido, retornar undefined
      return undefined;
    }

    // Si es número
    if (typeof value === 'number') {
      return value === 1;
    }

    // Cualquier otro tipo, retornar undefined
    return undefined;
  }
}
