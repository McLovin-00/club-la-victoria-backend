import {
  IsString,
  IsOptional,
  IsDateString,
  IsEnum,
  IsBoolean,
} from 'class-validator';
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

  @IsOptional()
  fotoUrl?: string;

  @IsBoolean()
  @IsOptional()
  eliminarFotoVieja?: boolean;
}
