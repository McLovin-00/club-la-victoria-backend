import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Private } from '../common/decorators/private.decorator';
import { CobradoresService } from './cobradores.service';
import {
  ConfigurarComisionCobradorDto,
  RangoFechasDto,
  RegistrarMovimientoCobradorDto,
  VincularCobradorDispositivoDto,
} from './dto';

@ApiTags('cobradores')
@ApiBearerAuth('JWT-auth')
@Controller('cobradores')
export class CobradoresController {
  constructor(private readonly cobradoresService: CobradoresService) {}

  @Get('activos')
  @ApiOperation({ summary: 'Listar cobradores activos' })
  @ApiResponse({ status: 200, description: 'Listado de cobradores activos' })
  findActivos() {
    return this.cobradoresService.findActivos();
  }

  @Post('vinculacion-inicial')
  @ApiOperation({
    summary: 'Vincular instalación móvil con cobrador (primera apertura)',
  })
  @ApiResponse({
    status: 201,
    description: 'Vinculación registrada o existente',
  })
  vincular(@Body() dto: VincularCobradorDispositivoDto) {
    return this.cobradoresService.vincularDispositivo(dto);
  }

  @Get(':id/mis-cobranzas')
  @ApiOperation({
    summary: 'Obtener cobranzas del cobrador por rango de fechas',
  })
  @ApiResponse({ status: 200, description: 'Resumen y detalle de cobranzas' })
  misCobranzas(
    @Param('id', ParseIntPipe) cobradorId: number,
    @Query() query: RangoFechasDto,
  ) {
    return this.cobradoresService.obtenerCobranzasRango(
      cobradorId,
      new Date(query.desde),
      new Date(query.hasta),
    );
  }

  @Get('mobile/socios')
  @ApiOperation({ summary: 'Buscar socios para flujo mobile de cobranzas' })
  buscarSocios(@Query('q') q: string) {
    return this.cobradoresService.buscarSociosMobile(q);
  }

  @Get('mobile/socios/:id/cuotas-pendientes')
  @ApiOperation({
    summary: 'Obtener cuotas pendientes de un socio para mobile',
  })
  cuotasPendientes(@Param('id', ParseIntPipe) socioId: number) {
    return this.cobradoresService.cuotasPendientesSocioMobile(socioId);
  }

  @Get('mobile/grupos-familiares')
  @ApiOperation({
    summary: 'Listar grupos familiares para mobile con resumen de deudas',
  })
  @ApiResponse({ status: 200, description: 'Lista de grupos familiares' })
  getGruposFamiliares() {
    return this.cobradoresService.getGruposFamiliaresMobile();
  }

  @Get('mobile/grupos-familiares/:id')
  @ApiOperation({
    summary: 'Obtener detalle de grupo familiar con miembros para mobile',
  })
  @ApiResponse({ status: 200, description: 'Detalle del grupo familiar' })
  @ApiResponse({ status: 404, description: 'Grupo familiar no encontrado' })
  getGrupoFamiliar(@Param('id', ParseIntPipe) grupoId: number) {
    return this.cobradoresService.getGrupoFamiliarMobile(grupoId);
  }

  @Post(':id/comision/config')
  @Private()
  @ApiOperation({ summary: 'Configurar porcentaje de comisión por cobrador' })
  configurarComision(
    @Param('id', ParseIntPipe) cobradorId: number,
    @Body() dto: ConfigurarComisionCobradorDto,
  ) {
    return this.cobradoresService.configurarComision(cobradorId, dto);
  }

  @Get(':id/comision/resumen')
  @Private()
  @ApiOperation({ summary: 'Calcular resumen de comisión por rango' })
  resumenComision(
    @Param('id', ParseIntPipe) cobradorId: number,
    @Query() query: RangoFechasDto,
  ) {
    return this.cobradoresService.calcularComision(
      cobradorId,
      new Date(query.desde),
      new Date(query.hasta),
    );
  }

  @Get(':id/cuenta-corriente')
  @Private()
  @ApiOperation({
    summary: 'Listar movimientos y saldo de cuenta corriente del cobrador',
  })
  cuentaCorriente(@Param('id', ParseIntPipe) cobradorId: number) {
    return this.cobradoresService.listarCuentaCorriente(cobradorId);
  }

  @Post(':id/cuenta-corriente/pagos')
  @Private()
  @ApiOperation({ summary: 'Registrar pago al cobrador' })
  registrarPago(
    @Param('id', ParseIntPipe) cobradorId: number,
    @Body() dto: RegistrarMovimientoCobradorDto,
  ) {
    return this.cobradoresService.registrarPagoACobrador(cobradorId, dto);
  }

  @Post(':id/cuenta-corriente/ajustes')
  @Private()
  @ApiOperation({ summary: 'Registrar ajuste manual al cobrador' })
  registrarAjuste(
    @Param('id', ParseIntPipe) cobradorId: number,
    @Body() dto: RegistrarMovimientoCobradorDto,
  ) {
    return this.cobradoresService.registrarAjuste(cobradorId, dto);
  }
}
