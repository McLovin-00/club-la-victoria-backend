import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  Query,
  UseInterceptors,
  UploadedFile,
  Put,
  ParseIntPipe,
} from '@nestjs/common';
import { SociosService } from './socios.service';
import { CreateSocioDto } from './dto/create-socio.dto';
import { Private } from '../common/decorators/private.decorator';
import { PaginationDto } from 'src/common/dto/pagination.dto';
import { FileInterceptor } from '@nestjs/platform-express';
import { UpdateSocioDto } from './dto/update-socio.dto';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiConsumes,
  ApiBody,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { ImageValidationPipe } from 'src/common/pipes/image-validation.pipe';

@ApiTags('socios')
@ApiBearerAuth('JWT-auth')
@Controller('socios')
export class SociosController {
  constructor(private readonly sociosService: SociosService) {}

  @Get()
  @Private()
  @ApiOperation({
    summary: 'Listar todos los socios',
    description:
      'Obtiene una lista paginada de socios con opción de búsqueda por nombre, apellido, DNI o email',
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
    description: 'Texto para búsqueda en nombre, apellido, DNI o email',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de socios obtenida exitosamente',
  })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  findAll(@Query() paginationDto: PaginationDto) {
    return this.sociosService.findAll(paginationDto);
  }

  @Post()
  @UseInterceptors(FileInterceptor('foto'))
  @Private()
  @ApiOperation({
    summary: 'Crear nuevo socio',
    description:
      'Crea un nuevo socio en el sistema. Opcionalmente puede incluir una foto que se sube a Cloudinary.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description: 'Datos del socio a crear',
    type: CreateSocioDto,
  })
  @ApiResponse({
    status: 201,
    description: 'Socio creado exitosamente',
  })
  @ApiResponse({
    status: 400,
    description: 'El DNI ya se encuentra registrado',
  })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  create(
    @Body() createSocioDto: CreateSocioDto,
    @UploadedFile(new ImageValidationPipe()) file?: Express.Multer.File,
  ) {
    return this.sociosService.create(createSocioDto, file);
  }

  @Put(':id')
  @UseInterceptors(FileInterceptor('foto'))
  @Private()
  @ApiOperation({
    summary: 'Actualizar socio',
    description: 'Actualiza los datos de un socio existente',
  })
  @ApiConsumes('multipart/form-data')
  @ApiParam({
    name: 'id',
    description: 'ID del socio',
    type: Number,
  })
  @ApiBody({
    description: 'Datos del socio a actualizar',
    type: UpdateSocioDto,
  })
  @ApiResponse({
    status: 200,
    description: 'Socio actualizado exitosamente',
  })
  @ApiResponse({ status: 404, description: 'Socio no encontrado' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateSocioDto: UpdateSocioDto,
    @UploadedFile(new ImageValidationPipe()) file?: Express.Multer.File,
  ) {
    console.log('updateSocioDto:', updateSocioDto);
    console.log(
      'file recibido:',
      file ? `${file.originalname} (${file.size} bytes)` : 'NO HAY ARCHIVO',
    );
    return this.sociosService.update(id, updateSocioDto, file);
  }

  @Get('/buscar/nombre')
  @ApiOperation({
    summary: 'Buscar socios por nombre o apellido',
    description:
      'Busca socios activos cuyo nombre o apellido coincida con la búsqueda (máximo 10 resultados)',
  })
  @ApiQuery({
    name: 'q',
    description: 'Texto a buscar en nombre o apellido',
    type: String,
    example: 'Juan',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de socios encontrados',
  })
  async findByName(@Query('q') query: string) {
    return this.sociosService.findByName(query);
  }

  @Get('/registro/:identifier')
  @ApiOperation({
    summary: 'Buscar socio por DNI o ID para registro',
    description:
      'Busca un socio por DNI o ID y devuelve sus datos junto con su tipo (SOCIO_CLUB, SOCIO_PILETA o NO_SOCIO)',
  })
  @ApiParam({
    name: 'identifier',
    description: 'DNI o ID del socio',
    type: String,
    example: '12345678',
  })
  @ApiResponse({
    status: 200,
    description: 'Información del socio y su tipo',
  })
  async findForRegistro(@Param('identifier') identifier: string) {
    const persona = await this.sociosService.findSocioConTipo(identifier);
    return persona;
  }

  @Get('/reserva/:dni')
  @ApiOperation({
    summary: 'Verificar existencia de socio por DNI para reserva',
    description: 'Obtiene con un booleano si el dni del socio existe',
  })
  @ApiParam({
    name: 'dni',
    description: 'DNI del socio',
    type: String,
  })
  @ApiResponse({
    status: 200,
    description: 'Socio encontrado',
  })
  @ApiResponse({ status: 404, description: 'Socio no encontrado' })
  findOneByDniReserva(@Param('dni') dni: string) {
    return this.sociosService.findOneByDniReserva(dni);
  }

  @Get(':id')
  @Private()
  @ApiOperation({
    summary: 'Obtener socio por ID',
    description: 'Obtiene los detalles de un socio específico',
  })
  @ApiParam({
    name: 'id',
    description: 'ID del socio',
    type: Number,
  })
  @ApiResponse({
    status: 200,
    description: 'Socio encontrado',
  })
  @ApiResponse({ status: 404, description: 'Socio no encontrado' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.sociosService.findOne(id);
  }

  @Delete(':id')
  @Private()
  @ApiOperation({
    summary: 'Eliminar socio',
    description:
      'Elimina un socio del sistema. También elimina su foto de Cloudinary si tiene.',
  })
  @ApiParam({
    name: 'id',
    description: 'ID del socio',
    type: Number,
  })
  @ApiResponse({
    status: 200,
    description: 'Socio eliminado exitosamente',
  })
  @ApiResponse({ status: 404, description: 'Socio no encontrado' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.sociosService.remove(id);
  }
}
