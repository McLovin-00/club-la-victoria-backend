import {
  IsString,
  IsOptional,
  IsInt,
  Min,
  MaxLength,
  IsNotEmpty,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';

/**
 * DTO para crear un nuevo grupo familiar
 */
export class CreateGrupoFamiliarDto {
  @ApiProperty({
    description: 'Nombre del grupo familiar',
    example: 'Familia García',
    maxLength: 100,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  nombre!: string;

  @ApiProperty({
    description: 'Descripción opcional del grupo familiar',
    example: 'Familia del socio fundador Juan García',
    maxLength: 255,
    required: false,
  })
  @IsString()
  @IsOptional()
  @MaxLength(255)
  descripcion?: string;

  @ApiProperty({
    description: 'Orden de visualización del grupo en el talonario',
    example: 1,
    minimum: 0,
    default: 0,
  })
  @IsInt()
  @Min(0)
  @IsOptional()
  @Type(() => Number)
  orden?: number;
}
