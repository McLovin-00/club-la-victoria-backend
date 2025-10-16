import { Controller, Get, Query } from '@nestjs/common';
import { EstadisticasService } from './estadisticas.service';
import { StatisticsResponseDto } from './dto/statistics-response.dto';
import { Private } from 'src/common/decorators/private.decorator';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';

@ApiTags('statistics')
@ApiBearerAuth('JWT-auth')
@Controller('statistics')
export class EstadisticasController {
  constructor(private readonly estadisticasService: EstadisticasService) {}

  @Get()
  @Private()
  @ApiOperation({
    summary: 'Obtener estadísticas diarias',
    description:
      'Obtiene las estadísticas de ingresos para una fecha específica, incluyendo totales por tipo de ingreso, categoría y comparativas',
  })
  @ApiQuery({
    name: 'date',
    required: true,
    type: String,
    description: 'Fecha para obtener estadísticas (formato: YYYY-MM-DD)',
    example: '2024-01-15',
  })
  @ApiResponse({
    status: 200,
    description: 'Estadísticas obtenidas exitosamente',
    type: StatisticsResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Formato de fecha inválido',
  })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  async getStatistics(
    @Query('date') dateString: string,
  ): Promise<StatisticsResponseDto> {
    return this.estadisticasService.getDailyStatistics(dateString);
  }
}
