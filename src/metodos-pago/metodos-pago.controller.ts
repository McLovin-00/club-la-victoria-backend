import { Controller, Get } from '@nestjs/common';
import { MetodosPagoService } from './metodos-pago.service';
import { Private } from '../common/decorators/private.decorator';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { MetodoPago } from './entities/metodo-pago.entity';

@ApiTags('metodos-pago')
@ApiBearerAuth('JWT-auth')
@Controller('metodos-pago')
export class MetodosPagoController {
  constructor(private readonly metodosPagoService: MetodosPagoService) {}

  @Get()
  @Private()
  @ApiOperation({
    summary: 'Obtener métodos de pago activos',
    description:
      'Devuelve todos los métodos de pago activos ordenados por orden',
  })
  @ApiResponse({
    status: 200,
    description: 'Métodos de pago obtenidos exitosamente',
    schema: {
      example: [
        {
          id: 1,
          nombre: 'EFECTIVO',
          descripcion: 'Efectivo en efectivo',
          activo: true,
          orden: 1,
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
          pagos: [],
        },
        {
          id: 2,
          nombre: 'TRANSFERENCIA',
          descripcion: 'Transferencia bancaria',
          activo: true,
          orden: 2,
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
          pagos: [],
        },
      ],
    },
  })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  findAll(): Promise<MetodoPago[]> {
    return this.metodosPagoService.findAll();
  }
}
