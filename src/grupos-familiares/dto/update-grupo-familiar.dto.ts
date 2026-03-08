import { IsString, IsOptional, IsInt, Min, MaxLength } from 'class-validator';
import { ApiProperty, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { CreateGrupoFamiliarDto } from './create-grupo-familiar.dto';

/**
 * DTO para actualizar un grupo familiar existente
 */
export class UpdateGrupoFamiliarDto extends PartialType(
  CreateGrupoFamiliarDto,
) {
  @ApiProperty({
    description: 'Nombre del grupo familiar',
    example: 'Familia García López',
    maxLength: 100,
    required: false,
  })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  nombre?: string;

  @ApiProperty({
    description: 'Descripción opcional del grupo familiar',
    example: 'Familia del socio fundador Juan García actualizada',
    maxLength: 255,
    required: false,
  })
  @IsString()
  @IsOptional()
  @MaxLength(255)
  descripcion?: string;

  @ApiProperty({
    description: 'Orden de visualización del grupo en el talonario',
    example: 2,
    minimum: 0,
    required: false,
  })
  @IsInt()
  @Min(0)
  @IsOptional()
  @Type(() => Number)
  orden?: number;
}
