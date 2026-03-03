import { IsOptional, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class StatisticsQueryDto {
  @ApiProperty({
    required: false,
    description:
      'Término de búsqueda para filtrar registros por nombre y apellido',
    example: 'Perez',
  })
  @IsOptional()
  @IsString()
  searchTerm?: string;
}
