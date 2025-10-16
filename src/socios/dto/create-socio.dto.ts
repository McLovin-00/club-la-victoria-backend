import { IsString, IsOptional, IsDateString, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export enum Genero {
  MASCULINO = 'MASCULINO',
  FEMENINO = 'FEMENINO',
}

export enum Estado {
  ACTIVO = 'ACTIVO',
  INACTIVO = 'INACTIVO',
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
    description: 'Foto del socio (archivo de imagen)',
    type: 'string',
    format: 'binary',
    required: false,
  })
  @IsOptional()
  foto?: any;
}
