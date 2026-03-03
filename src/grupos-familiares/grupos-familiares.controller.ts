import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  ParseIntPipe,
} from '@nestjs/common';
import { GruposFamiliaresService } from './grupos-familiares.service';
import {
  CreateGrupoFamiliarDto,
  UpdateGrupoFamiliarDto,
  AsignarSociosDto,
} from './dto';
import { Private } from '../common/decorators/private.decorator';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';

@ApiTags('grupos-familiares')
@ApiBearerAuth('JWT-auth')
@Controller('grupos-familiares')
export class GruposFamiliaresController {
  constructor(private readonly gruposService: GruposFamiliaresService) {}

  @Post()
  @Private()
  @ApiOperation({
    summary: 'Crear grupo familiar',
    description:
      'Crea un nuevo grupo familiar con nombre, descripción opcional y orden de visualización.',
  })
  @ApiResponse({
    status: 201,
    description: 'Grupo familiar creado exitosamente',
  })
  @ApiResponse({
    status: 409,
    description: 'Ya existe un grupo familiar con ese nombre',
  })
  @ApiResponse({ status: 400, description: 'Datos de entrada inválidos' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  create(@Body() dto: CreateGrupoFamiliarDto) {
    return this.gruposService.create(dto);
  }

  @Get()
  @Private()
  @ApiOperation({
    summary: 'Listar grupos familiares',
    description:
      'Obtiene todos los grupos familiares ordenados por campo orden, incluyendo el conteo de socios asignados.',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de grupos familiares obtenida exitosamente',
  })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  findAll() {
    return this.gruposService.findAll();
  }

  @Get('socios-sin-grupo')
  @Private()
  @ApiOperation({
    summary: 'Listar socios sin grupo familiar',
    description:
      'Obtiene la lista de socios que no tienen grupo familiar asignado, ordenados alfabéticamente.',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de socios sin grupo obtenida exitosamente',
  })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  findSociosSinGrupo() {
    return this.gruposService.findSociosSinGrupo();
  }

  @Get(':id')
  @Private()
  @ApiOperation({
    summary: 'Obtener grupo familiar por ID',
    description:
      'Obtiene los detalles de un grupo familiar específico incluyendo la lista de socios asignados.',
  })
  @ApiParam({
    name: 'id',
    description: 'ID del grupo familiar',
    type: Number,
  })
  @ApiResponse({
    status: 200,
    description: 'Grupo familiar encontrado',
  })
  @ApiResponse({ status: 404, description: 'Grupo familiar no encontrado' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.gruposService.findOne(id);
  }

  @Patch(':id')
  @Private()
  @ApiOperation({
    summary: 'Actualizar grupo familiar',
    description:
      'Actualiza nombre, descripción u orden de un grupo familiar existente.',
  })
  @ApiParam({
    name: 'id',
    description: 'ID del grupo familiar',
    type: Number,
  })
  @ApiResponse({
    status: 200,
    description: 'Grupo familiar actualizado exitosamente',
  })
  @ApiResponse({ status: 404, description: 'Grupo familiar no encontrado' })
  @ApiResponse({
    status: 409,
    description: 'Ya existe un grupo familiar con ese nombre',
  })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateGrupoFamiliarDto,
  ) {
    return this.gruposService.update(id, dto);
  }

  @Delete(':id')
  @Private()
  @ApiOperation({
    summary: 'Eliminar grupo familiar',
    description:
      'Elimina un grupo familiar. Los socios asignados quedan sin grupo (SET NULL).',
  })
  @ApiParam({
    name: 'id',
    description: 'ID del grupo familiar',
    type: Number,
  })
  @ApiResponse({
    status: 204,
    description: 'Grupo familiar eliminado exitosamente',
  })
  @ApiResponse({ status: 404, description: 'Grupo familiar no encontrado' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  async remove(@Param('id', ParseIntPipe) id: number) {
    await this.gruposService.remove(id);
    return { message: 'Grupo familiar eliminado exitosamente' };
  }

  @Patch(':id/socios')
  @Private()
  @ApiOperation({
    summary: 'Asignar socios a grupo familiar',
    description:
      'Asigna múltiples socios a un grupo familiar. Si un socio ya pertenece a otro grupo, se mueve al nuevo.',
  })
  @ApiParam({
    name: 'id',
    description: 'ID del grupo familiar',
    type: Number,
  })
  @ApiResponse({
    status: 200,
    description: 'Socios asignados exitosamente',
  })
  @ApiResponse({ status: 404, description: 'Grupo familiar no encontrado' })
  @ApiResponse({
    status: 400,
    description: 'Uno o más IDs de socio no son válidos',
  })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  asignarSocios(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AsignarSociosDto,
  ) {
    return this.gruposService.asignarSocios(id, dto);
  }

  @Delete(':id/socios/:socioId')
  @Private()
  @ApiOperation({
    summary: 'Desasignar socio de grupo familiar',
    description: 'Quita un socio de su grupo familiar asignado.',
  })
  @ApiParam({
    name: 'id',
    description: 'ID del grupo familiar',
    type: Number,
  })
  @ApiParam({
    name: 'socioId',
    description: 'ID del socio',
    type: Number,
  })
  @ApiResponse({
    status: 200,
    description: 'Socio desasignado exitosamente',
  })
  @ApiResponse({ status: 404, description: 'Socio no encontrado' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  async desasignarSocio(
    @Param('socioId', ParseIntPipe) socioId: number,
  ) {
    await this.gruposService.desasignarSocio(socioId);
    return { message: 'Socio desasignado exitosamente' };
  }
}
