import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  ParseIntPipe,
} from '@nestjs/common';
import { TemporadasService } from './temporadas.service';
import { CreateTemporadaDto } from './dto/create-temporada.dto';
import { Private } from 'src/common/decorators/private.decorator';
import { PAGINATION } from 'src/constants/pagination.constants';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
  ApiBody,
} from '@nestjs/swagger';

@ApiTags('temporadas')
@ApiBearerAuth('JWT-auth')
@Controller('temporadas')
export class TemporadasController {
  constructor(private readonly temporadasService: TemporadasService) {}

  @Post()
  @Private()
  @ApiOperation({
    summary: 'Crear nueva temporada',
    description:
      'Crea una nueva temporada en el sistema con fechas de inicio y fin',
  })
  @ApiBody({
    description: 'Datos de la temporada a crear',
    type: CreateTemporadaDto,
  })
  @ApiResponse({
    status: 201,
    description: 'Temporada creada exitosamente',
  })
  @ApiResponse({
    status: 400,
    description: 'Datos inválidos',
  })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  create(@Body() createTemporadaDto: CreateTemporadaDto) {
    return this.temporadasService.create(createTemporadaDto);
  }

  @Get()
  @Private()
  @ApiOperation({
    summary: 'Listar todas las temporadas',
    description:
      'Obtiene la lista completa de temporadas registradas en el sistema',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de temporadas obtenida exitosamente',
  })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  findAll() {
    return this.temporadasService.findAll();
  }

  @Get(':id')
  @Private()
  @ApiOperation({
    summary: 'Obtener temporada por ID',
    description: 'Obtiene los detalles de una temporada específica',
  })
  @ApiParam({
    name: 'id',
    description: 'ID de la temporada',
    type: Number,
  })
  @ApiResponse({
    status: 200,
    description: 'Temporada encontrada',
  })
  @ApiResponse({ status: 404, description: 'Temporada no encontrada' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  findOne(@Param('id') id: string) {
    return this.temporadasService.findOne(+id);
  }

  @Patch(':id')
  @Private()
  @ApiOperation({
    summary: 'Actualizar temporada',
    description: 'Actualiza los datos de una temporada existente',
  })
  @ApiParam({
    name: 'id',
    description: 'ID de la temporada',
    type: Number,
  })
  @ApiBody({
    description: 'Datos de la temporada a actualizar',
    type: CreateTemporadaDto,
  })
  @ApiResponse({
    status: 200,
    description: 'Temporada actualizada exitosamente',
  })
  @ApiResponse({ status: 404, description: 'Temporada no encontrada' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateTemporadaDto: CreateTemporadaDto,
  ) {
    return this.temporadasService.update(id, updateTemporadaDto);
  }

  @Delete(':id')
  @Private()
  @ApiOperation({
    summary: 'Eliminar temporada',
    description: 'Elimina una temporada del sistema',
  })
  @ApiParam({
    name: 'id',
    description: 'ID de la temporada',
    type: Number,
  })
  @ApiResponse({
    status: 200,
    description: 'Temporada eliminada exitosamente',
  })
  @ApiResponse({ status: 404, description: 'Temporada no encontrada' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.temporadasService.remove(id);
  }

  // Metodo para obtener los socios de una temporada
  @Get(':id/socios')
  @Private()
  @ApiOperation({
    summary: 'Obtener socios de una temporada',
    description:
      'Lista todos los socios registrados en una temporada específica',
  })
  @ApiParam({
    name: 'id',
    description: 'ID de la temporada',
    type: Number,
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de socios obtenida exitosamente',
  })
  @ApiResponse({ status: 404, description: 'Temporada no encontrada' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  getSocios(@Param('id', ParseIntPipe) id: number) {
    return this.temporadasService.getSocios(id);
  }

  // Metodo para agregar un socio a una temporada
  @Post(':id/socios')
  @Private()
  @ApiOperation({
    summary: 'Agregar socio a temporada',
    description: 'Registra un socio en una temporada específica',
  })
  @ApiParam({
    name: 'id',
    description: 'ID de la temporada',
    type: Number,
  })
  @ApiBody({
    description: 'ID del socio a agregar',
    schema: {
      type: 'object',
      properties: {
        socioId: {
          type: 'number',
          example: 1,
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Socio agregado a la temporada exitosamente',
  })
  @ApiResponse({
    status: 400,
    description: 'El socio ya está registrado en esta temporada',
  })
  @ApiResponse({ status: 404, description: 'Temporada o socio no encontrado' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  agregarSocioATemporada(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { socioId: number },
  ) {
    return this.temporadasService.agregarSocioATemporada(id, body.socioId);
  }

  // Metodo para eliminar un socio de una temporada
  @Delete(':id/socios/:socioId')
  @Private()
  @ApiOperation({
    summary: 'Eliminar socio de temporada',
    description: 'Elimina el registro de un socio de una temporada específica',
  })
  @ApiParam({
    name: 'id',
    description: 'ID de la temporada',
    type: Number,
  })
  @ApiParam({
    name: 'socioId',
    description: 'ID del socio a eliminar',
    type: Number,
  })
  @ApiResponse({
    status: 200,
    description: 'Socio eliminado de la temporada exitosamente',
  })
  @ApiResponse({ status: 404, description: 'Temporada o socio no encontrado' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  eliminarSocioDeTemporada(
    @Param('id', ParseIntPipe) id: number,
    @Param('socioId', ParseIntPipe) socioId: number,
  ) {
    return this.temporadasService.eliminarSocioDeTemporada(id, socioId);
  }

  // Metodo para obtener socios disponibles (no registrados en la temporada)
  @Get(':id/socios-disponibles')
  @Private()
  @ApiOperation({
    summary: 'Obtener socios disponibles para una temporada',
    description:
      'Lista los socios que aún no están registrados en la temporada especificada, con paginación y búsqueda',
  })
  @ApiParam({
    name: 'id',
    description: 'ID de la temporada',
    type: Number,
  })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: 'Número de página',
    example: 1,
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Cantidad de resultados por página',
    example: 10,
  })
  @ApiQuery({
    name: 'search',
    required: false,
    type: String,
    description: 'Texto para búsqueda en nombre, apellido o DNI',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de socios disponibles obtenida exitosamente',
  })
  @ApiResponse({ status: 404, description: 'Temporada no encontrada' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  getSociosDisponibles(
    @Param('id', ParseIntPipe) id: number,
    @Query('page') page: string = String(PAGINATION.DEFAULT_PAGE),
    @Query('limit') limit: string = String(PAGINATION.DEFAULT_LIMIT),
    @Query('search') search?: string,
  ) {
    const res = this.temporadasService.getSociosDisponibles(
      id,
      parseInt(page),
      parseInt(limit),
      search,
    );
    return res;
  }
}
