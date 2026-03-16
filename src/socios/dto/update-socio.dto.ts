import {
  IsString,
  IsOptional,
  IsDateString,
  IsEnum,
  IsBoolean,
  IsNumber,
  IsInt,
  IsNotEmpty,
  Matches,
  ValidateIf,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  Estado,
  Genero,
  NUMERO_TARJETA_CENTRO_ERROR,
  NUMERO_TARJETA_CENTRO_REGEX,
  normalizarNumeroTarjetaCentro,
} from './create-socio.dto';

export class UpdateSocioDto {
  @IsString()
  nombre!: string;

  @IsString()
  apellido!: string;

  @IsString()
  @IsOptional()
  dni?: string;

  @IsOptional()
  @IsString()
  telefono?: string;

  @IsOptional()
  email?: string;

  @IsDateString()
  fechaNacimiento!: string;

  @IsString()
  @IsOptional()
  direccion?: string;

  @IsEnum(Estado)
  estado!: Estado;

  @IsEnum(Genero)
  genero!: Genero;

  @ApiPropertyOptional({
    description:
      'Indica si el socio tiene manualmente una categoría (override)',
    example: false,
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
  @IsOptional()
  fotoUrl?: string;

  @IsBoolean()
  @IsOptional()
  eliminarFotoVieja?: boolean;

  @ApiProperty({
    description: 'Foto del socio (archivo de imagen)',
    type: 'string',
    format: 'binary',
    required: false,
  })
  @IsOptional()
  foto?: Express.Multer.File;

  @ApiPropertyOptional({
    description: 'ID de la categoría del socio',
    example: 1,
  })
  @Transform(({ value }) => {
    if (value === '' || value === null || value === undefined) return undefined;
    const parsed = parseInt(value, 10);
    return isNaN(parsed) ? undefined : parsed;
  })
  @IsInt()
  @IsOptional()
  categoriaId?: number;

  @ApiPropertyOptional({
    description: 'Fecha de alta del socio (formato ISO)',
    example: '2024-01-15',
  })
  @IsDateString()
  @IsOptional()
  fechaAlta?: string;

  @ApiPropertyOptional({
    description: 'Indica si el socio tiene tarjeta del centro',
    example: false,
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

  @ApiPropertyOptional({
    description: 'Número de tarjeta del centro (solo si tarjetaCentro es true)',
    example: '5400000012345678',
  })
  @Transform(({ value }) => normalizarNumeroTarjetaCentro(value), {
    toClassOnly: true,
  })
  @ValidateIf(
    (object: UpdateSocioDto) =>
      object.tarjetaCentro === true || object.numeroTarjetaCentro !== undefined,
  )
  @IsNotEmpty({ message: NUMERO_TARJETA_CENTRO_ERROR })
  @IsString()
  @Matches(NUMERO_TARJETA_CENTRO_REGEX, {
    message: NUMERO_TARJETA_CENTRO_ERROR,
  })
  numeroTarjetaCentro?: string;
}
