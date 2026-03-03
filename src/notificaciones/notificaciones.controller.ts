import { Controller, Get, Post, Param, ParseIntPipe } from '@nestjs/common';
import { NotificacionesService } from './notificaciones.service';
import { Private } from '../common/decorators/private.decorator';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';

@ApiTags('notificaciones')
@ApiBearerAuth('JWT-auth')
@Controller('notificaciones')
export class NotificacionesController {
  constructor(private readonly notificacionesService: NotificacionesService) {}

  @Get()
  @Private()
  @ApiOperation({
    summary: 'Listar notificaciones no leídas',
    description:
      'Devuelve todas las notificaciones no leídas del operador, ordenadas por fecha descendente',
  })
  @ApiResponse({ status: 200, description: 'Lista de notificaciones obtenida' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  findAll() {
    return this.notificacionesService.findAll();
  }

  @Get('contador')
  @Private()
  @ApiOperation({
    summary: 'Obtener cantidad de notificaciones no leídas',
    description: 'Devuelve el total de notificaciones sin leer',
  })
  @ApiResponse({ status: 200, description: 'Contador obtenido' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  contarNoLeidas() {
    return this.notificacionesService.contarNoLeidas();
  }

  @Post(':id/leer')
  @Private()
  @ApiOperation({
    summary: 'Marcar notificación como leída',
    description: 'Marca una notificación individual como leída por su ID',
  })
  @ApiResponse({ status: 200, description: 'Notificación marcada como leída' })
  @ApiResponse({ status: 404, description: 'Notificación no encontrada' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  marcarLeida(@Param('id', ParseIntPipe) id: number) {
    return this.notificacionesService.marcarLeida(id);
  }

  @Post('leer-todas')
  @Private()
  @ApiOperation({
    summary: 'Marcar todas las notificaciones como leídas',
    description: 'Marca todas las notificaciones no leídas como leídas',
  })
  @ApiResponse({ status: 200, description: 'Todas marcadas como leídas' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  marcarTodasLeidas() {
    return this.notificacionesService.marcarTodasLeidas();
  }
}
