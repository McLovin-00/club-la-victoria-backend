import {
  Controller,
  Post,
  Body,
  Get,
  Param,
  Query,
  ParseIntPipe,
} from '@nestjs/common';
import { RegistroIngresoService } from './registro-ingreso.service';
import { CreateRegistroIngresoDto } from './dto/create-registro-ingreso.dto';
import { PAGINATION } from 'src/constants/pagination.constants';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiBody,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { Private } from 'src/common/decorators/private.decorator';

@ApiTags('registro-ingreso')
@ApiBearerAuth('JWT-auth')
@Controller('registro-ingreso')
export class RegistroIngresoController {
  constructor(
    private readonly registroIngresoService: RegistroIngresoService,
  ) {}

  @Post()
  @ApiOperation({
    summary: 'Crear registro de ingreso',
    description:
      'Registra un nuevo ingreso de una persona al club o pileta. Valida si es socio, invitado o persona externa.',
  })
  @ApiBody({
    description: 'Datos del registro de ingreso',
    type: CreateRegistroIngresoDto,
  })
  @ApiResponse({
    status: 201,
    description: 'Registro de ingreso creado exitosamente',
  })
  @ApiResponse({
    status: 400,
    description: 'Error en la validación o datos inválidos',
  })
  @ApiResponse({
    status: 404,
    description: 'Socio no encontrado',
  })
  async create(@Body() createRegistroIngresoDto: CreateRegistroIngresoDto) {
    return await this.registroIngresoService.create(createRegistroIngresoDto);
  }

  @Get()
  @Private()
  @ApiOperation({
    summary: 'Listar todos los registros de ingreso',
    description:
      'Obtiene una lista paginada de todos los registros de ingreso al club o pileta',
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
  @ApiResponse({
    status: 200,
    description: 'Lista de registros obtenida exitosamente',
  })
  @ApiResponse({
    status: 400,
    description: 'Error al obtener registros',
  })
  @ApiResponse({
    status: 401,
    description: 'No autorizado',
  })
  async findAll(
    @Query('page') page: string = String(PAGINATION.DEFAULT_PAGE),
    @Query('limit') limit: string = String(PAGINATION.DEFAULT_LIMIT),
  ) {
    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);

    return await this.registroIngresoService.findAll(pageNum, limitNum);
  }

  @Get(':id')
  @Private()
  @ApiOperation({
    summary: 'Obtener registro de ingreso por ID',
    description: 'Obtiene los detalles de un registro de ingreso específico',
  })
  @ApiParam({
    name: 'id',
    description: 'ID del registro de ingreso',
    type: Number,
  })
  @ApiResponse({
    status: 200,
    description: 'Registro encontrado',
  })
  @ApiResponse({
    status: 404,
    description: 'Registro no encontrado',
  })
  @ApiResponse({
    status: 400,
    description: 'Error al obtener el registro',
  })
  @ApiResponse({
    status: 401,
    description: 'No autorizado',
  })
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return await this.registroIngresoService.findOne(id);
  }

  @Get('dni/:dni')
  @Private()
  @ApiOperation({
    summary: 'Obtener registros de ingreso por DNI',
    description:
      'Obtiene todos los registros de ingreso asociados a un DNI específico',
  })
  @ApiParam({
    name: 'dni',
    description: 'DNI de la persona',
    type: String,
    example: '12345678',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de registros encontrados para el DNI',
  })
  @ApiResponse({
    status: 400,
    description: 'Error al obtener registros',
  })
  @ApiResponse({
    status: 401,
    description: 'No autorizado',
  })
  async findByDni(@Param('dni') dni: string) {
    return await this.registroIngresoService.findByDni(dni);
  }

  @Get('fecha/:fechaInicio/:fechaFin')
  @Private()
  @ApiOperation({
    summary: 'Obtener registros de ingreso por rango de fechas',
    description:
      'Obtiene todos los registros de ingreso dentro de un rango de fechas específico',
  })
  @ApiParam({
    name: 'fechaInicio',
    description: 'Fecha de inicio del rango (formato: YYYY-MM-DD)',
    type: String,
    example: '2024-01-01',
  })
  @ApiParam({
    name: 'fechaFin',
    description: 'Fecha de fin del rango (formato: YYYY-MM-DD)',
    type: String,
    example: '2024-12-31',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de registros en el rango de fechas',
  })
  @ApiResponse({
    status: 400,
    description: 'Error al obtener registros o formato de fecha inválido',
  })
  @ApiResponse({
    status: 401,
    description: 'No autorizado',
  })
  async findByDateRange(
    @Param('fechaInicio') fechaInicio: string,
    @Param('fechaFin') fechaFin: string,
  ) {
    return await this.registroIngresoService.findByDateRange(
      fechaInicio,
      fechaFin,
    );
  }
}
