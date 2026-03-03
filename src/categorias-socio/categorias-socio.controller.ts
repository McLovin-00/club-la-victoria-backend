import {
  Controller,
  Get,
  Put,
  Body,
  Param,
  ParseIntPipe,
} from '@nestjs/common';
import { CategoriasSocioService } from './categorias-socio.service';
import { UpdateCategoriaSocioDto } from './dto';
import { Private } from '../common/decorators/private.decorator';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';

/**
 * Controlador para gestión de categorías de socio
 *
 * NOTA: Las categorías son FIJAS según el estatuto del club:
 * - ACTIVO: Socio mayor de edad, paga cuota completa
 * - ADHERENTE: Menores de edad, paga cuota reducida
 * - VITALICIO: 45+ años de antigüedad, NO paga cuota (exento)
 * - HONORARIO: Por méritos, NO paga cuota (exento)
 *
 * Solo se permite actualizar el monto mensual de cada categoría.
 * No se pueden crear ni eliminar categorías.
 */
@ApiTags('categorias-socio')
@ApiBearerAuth('JWT-auth')
@Controller('categorias-socio')
export class CategoriasSocioController {
  constructor(private readonly categoriasService: CategoriasSocioService) {}

  @Get()
  @Private()
  @ApiOperation({
    summary: 'Listar todas las categorías de socio',
    description:
      'Obtiene una lista de categorías de socio (fijas según estatuto). Las categorías exentas (VITALICIO, HONORARIO) tienen montoMensual en 0.',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de categorías obtenida exitosamente',
  })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  findAll() {
    return this.categoriasService.findAll();
  }

  @Get(':id')
  @Private()
  @ApiOperation({
    summary: 'Obtener categoría por ID',
    description: 'Obtiene los detalles de una categoría específica',
  })
  @ApiParam({
    name: 'id',
    description: 'ID de la categoría',
    type: Number,
  })
  @ApiResponse({
    status: 200,
    description: 'Categoría encontrada',
  })
  @ApiResponse({ status: 404, description: 'Categoría no encontrada' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.categoriasService.findOne(id);
  }

  @Put(':id')
  @Private()
  @ApiOperation({
    summary: 'Actualizar monto mensual de categoría',
    description:
      'Actualiza el monto mensual de una categoría. Solo se puede modificar el monto, el nombre y otros campos son fijos según estatuto.',
  })
  @ApiParam({
    name: 'id',
    description: 'ID de la categoría',
    type: Number,
  })
  @ApiResponse({
    status: 200,
    description: 'Monto de categoría actualizado exitosamente',
  })
  @ApiResponse({ status: 404, description: 'Categoría no encontrada' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateCategoriaDto: UpdateCategoriaSocioDto,
  ) {
    return this.categoriasService.update(id, updateCategoriaDto);
  }
}
