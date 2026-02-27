import {
  IsString,
  IsOptional,
  IsDateString,
  IsEnum,
  IsBoolean,
  IsNumber,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Estado, Genero } from './create-socio.dto';

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
    description: 'Indica si el socio tiene manualmente una categoría (override)',
    example: false,
  })
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
  @IsNumber()
  @IsOptional()
  categoriaId?: number;

  @ApiPropertyOptional({
    description: 'Fecha de alta del socio (formato ISO)',
    example: '2024-01-15',
  })
  @IsDateString()
  @IsOptional()
  fechaAlta?: string;
}
