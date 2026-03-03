import { IsArray, IsInt, ArrayNotEmpty, ArrayMinSize } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';

/**
 * DTO para asignar socios a un grupo familiar
 */
export class AsignarSociosDto {
  @ApiProperty({
    description: 'Array de IDs de socios a asignar al grupo familiar',
    example: [1, 2, 3],
    type: [Number],
  })
  @IsArray()
  @ArrayMinSize(1, { message: 'Debe proporcionar al menos un ID de socio' })
  @IsInt({ each: true, message: 'Cada ID de socio debe ser un número entero' })
  @Type(() => Number)
  socioIds!: number[];
}
