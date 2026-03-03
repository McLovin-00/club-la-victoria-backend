import {
  IsString,
  IsOptional,
  IsDateString,
  IsEnum,
  IsBoolean,
  IsInt,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export enum Genero {
  MASCULINO = 'MASCULINO',
  FEMENINO = 'FEMENINO',
}

export enum Estado {
  ACTIVO = 'ACTIVO',
  INACTIVO = 'INACTIVO',
  MOROSO = 'MOROSO',
}

export class CreateSocioDto {
  @ApiProperty({
    description: 'Nombre del socio',
    example: 'Juan',
  })
  @IsString()
  nombre!: string;

  @ApiProperty({
    description: 'Apellido del socio',
    example: 'Pérez',
  })
  @IsString()
  apellido!: string;

  @ApiProperty({
    description: 'DNI del socio (opcional)',
    example: '12345678',
    required: false,
  })
  @IsString()
  @IsOptional()
  dni?: string;

  @ApiProperty({
    description: 'Teléfono del socio (opcional)',
    example: '+5491112345678',
    required: false,
  })
  @IsOptional()
  @IsString()
  telefono?: string;

  @ApiProperty({
    description: 'Email del socio (opcional)',
    example: 'juan.perez@example.com',
    required: false,
  })
  @IsOptional()
  email?: string;

  @ApiProperty({
    description: 'Fecha de nacimiento del socio (formato ISO)',
    example: '1990-01-15',
  })
  @IsDateString()
  fechaNacimiento!: string;

  @ApiProperty({
    description: 'Dirección del socio (opcional)',
    example: 'Av. Siempre Viva 742',
    required: false,
  })
  @IsString()
  @IsOptional()
  direccion?: string;

  @ApiProperty({
    description: 'Estado del socio',
    enum: Estado,
    example: Estado.ACTIVO,
  })
  @IsEnum(Estado)
  estado!: Estado;

  @ApiProperty({
    description: 'Género del socio',
    enum: Genero,
    example: Genero.MASCULINO,
  })
  @IsEnum(Genero)
  genero!: Genero;

  @ApiProperty({
    description: 'Fecha de alta del socio (formato ISO, opcional)',
    example: '2024-01-15',
    required: false,
  })
  @IsDateString()
  @IsOptional()
  fechaAlta?: string;

  @ApiProperty({
    description: 'Override manual de categoría (impide recálculo automático)',
    example: false,
    required: false,
  })
  @Transform(
    ({ value }) => {
      // El interceptor BooleanTransformInterceptor ya convirtió el string a boolean
      // Este Transform es una segunda capa de seguridad
      if (value === true || value === 'true' || value === 1 || value === '1')
        return true;
      if (
        value === false ||
        value === 'false' ||
        value === 0 ||
        value === '0' ||
        value === ''
      )
        return false;
      return undefined;
    },
    { toClassOnly: true },
  )
  @IsBoolean()
  @IsOptional()
  overrideManual?: boolean;

  @ApiProperty({
    description: 'ID de categoría del socio (solo si overrideManual es true)',
    example: 1,
    required: false,
  })
  @Transform(({ value }) => {
    if (value === '' || value === null || value === undefined) return undefined;
    const parsed = parseInt(value, 10);
    return isNaN(parsed) ? undefined : parsed;
  })
  @IsInt()
  @IsOptional()
  categoriaId?: number;

  @ApiProperty({
    description: 'Indica si el socio tiene tarjeta del centro',
    example: false,
    required: false,
  })
  @Transform(
    ({ value }) => {
      if (value === true || value === 'true' || value === 1 || value === '1')
        return true;
      if (
        value === false ||
        value === 'false' ||
        value === 0 ||
        value === '0' ||
        value === ''
      )
        return false;
      return undefined;
    },
    { toClassOnly: true },
  )
  @IsBoolean()
  @IsOptional()
  tarjetaCentro?: boolean;

  @ApiProperty({
    description: 'Número de tarjeta del centro (solo si tarjetaCentro es true)',
    example: 'TC-12345',
    required: false,
  })
  @IsString()
  @IsOptional()
  numeroTarjetaCentro?: string;
}
