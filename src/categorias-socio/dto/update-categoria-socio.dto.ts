import { IsNumber, IsOptional, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';

/**
 * DTO para actualizar el monto mensual de una categoría
 *
 * NOTA: Solo se permite actualizar el monto mensual.
 * El nombre y otros campos son fijos según el estatuto del club.
 */
export class UpdateCategoriaSocioDto {
  @ApiProperty({
    description: 'Monto mensual de la cuota',
    example: 10000,
    minimum: 0,
    required: false,
  })
  @IsNumber()
  @Min(0)
  @IsOptional()
  @Type(() => Number)
  montoMensual?: number;
}
