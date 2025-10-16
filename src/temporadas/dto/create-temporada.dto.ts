import { IsDateString, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateTemporadaDto {
  @ApiProperty({
    description: 'Nombre de la temporada',
    example: 'Temporada Verano 2024-2025',
  })
  @IsString()
  nombre!: string;

  @ApiProperty({
    description: 'Fecha de inicio de la temporada (formato ISO)',
    example: '2024-12-01',
  })
  @IsDateString()
  fechaInicio!: string;

  @ApiProperty({
    description: 'Fecha de fin de la temporada (formato ISO)',
    example: '2025-03-31',
  })
  @IsDateString()
  fechaFin!: string;

  @ApiPropertyOptional({
    description: 'Descripción adicional de la temporada (opcional)',
    example: 'Temporada de pileta para el verano',
  })
  @IsString()
  @IsOptional()
  descripcion?: string;
}
