import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  Param,
  ParseIntPipe,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { CobrosService } from './cobros.service';
import {
  GenerarCuotasDto,
  RegistrarPagoDto,
  RegistrarPagoMultipleDto,
  RegistrarOperacionCobroDto,
  RegistrarPagoCuotasSeleccionadasDto,
  ReciboMultipleCuotasDto,
  ReporteCobranzaQueryDto,
  GenerarCuotasSeleccionDto,
  EstadoPagosQueryDto,
  CuotasQueryDto,
  ProcesarResultadosTarjetaCentroDto,
  // Morosos detallados
  MorososQueryDto,
  TarjetaCentroArchivoQueryDto,
} from './dto';
import { TalonarioPdfService } from './services/talonario-pdf.service';
import { TarjetaCentro23fService } from './services/tarjeta-centro-23f.service';
import { Private } from '../common/decorators/private.decorator';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { EstadoCuota } from './entities/cuota.entity';

@ApiTags('cobros')
@ApiBearerAuth('JWT-auth')
@Controller('cobros')
export class CobrosController {
  constructor(
    private readonly cobrosService: CobrosService,
    private readonly talonarioPdfService: TalonarioPdfService,
    private readonly tarjetaCentro23fService: TarjetaCentro23fService,
  ) {}

  // ==================== GENERACIÓN DE CUOTAS ====================

  @Post('generar')
  @Private()
  @ApiOperation({
    summary: 'Generar cuotas mensuales',
    description:
      'Genera cuotas para todos los socios activos con categoría. Incluye desactivación automática de socios morosos (3+ cuotas pendientes). Es idempotente: si ya existen cuotas para el período, no las duplica.',
  })
  @ApiResponse({
    status: 201,
    description: 'Cuotas generadas exitosamente',
    schema: {
      example: {
        creadas: 50,
        omitidas: 10,
        desactivados: 2,
        advertencias: ['Socio Juan Pérez (ID: 5) desactivado por morosidad'],
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Período con formato inválido' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  generarCuotas(@Body() dto: GenerarCuotasDto) {
    return this.cobrosService.generarCuotasMensuales(dto);
  }

  // ==================== REGISTRO DE PAGOS ====================

  @Post('pagos')
  @Private()
  @ApiOperation({
    summary: 'Registrar pago de cuota por ID',
    description:
      'Registra el pago de una cuota usando su ID. Valida que la cuota exista y no esté ya pagada.',
  })
  @ApiResponse({
    status: 201,
    description: 'Pago registrado exitosamente',
  })
  @ApiResponse({ status: 400, description: 'Datos de entrada inválidos' })
  @ApiResponse({
    status: 404,
    description: 'Cuota no encontrada',
  })
  @ApiResponse({
    status: 409,
    description: 'La cuota ya está pagada',
  })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  registrarPago(@Body() dto: RegistrarPagoDto) {
    return this.cobrosService.registrarPago(dto);
  }

  @Post('pagos/multiple')
  @Private()
  @ApiOperation({
    summary: 'Registrar pago de múltiples cuotas',
    description:
      'Registra el pago de varias cuotas en una sola transacción. No permite pagos parciales ni doble pago.',
  })
  @ApiResponse({
    status: 201,
    description: 'Pagos procesados',
    schema: {
      example: {
        pagosExitosos: 3,
        errores: ['123: cuota ya pagada'],
      },
    },
  })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  registrarPagoMultiple(@Body() dto: RegistrarPagoMultipleDto) {
    return this.cobrosService.registrarPagoMultiple(dto);
  }

  @Post('pagos/operacion')
  @ApiOperation({
    summary: 'Registrar operación de cobro multi-línea',
    description:
      'Registra una operación con cuotas y conceptos no-cuota, persistiendo actor, origen, total y trazabilidad de líneas.',
  })
  @ApiResponse({
    status: 201,
    description: 'Operación registrada exitosamente',
  })
  registrarOperacionCobro(@Body() dto: RegistrarOperacionCobroDto) {
    return this.cobrosService.registrarOperacionCobro(dto);
  }

  @Post('pagos/cuotas-seleccion')
  @Private()
  @ApiOperation({
    summary: 'Registrar pago de cuotas seleccionadas de un socio',
    description:
      'Permite pagar dos o mas cuotas seleccionadas del mismo socio, distribuyendo el total en uno o dos metodos de pago.',
  })
  @ApiResponse({
    status: 201,
    description: 'Pago de cuotas seleccionadas registrado exitosamente',
  })
  @ApiResponse({ status: 400, description: 'Datos de pago inválidos' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  @ApiResponse({
    status: 409,
    description: 'Una o mas cuotas ya están pagadas',
  })
  registrarPagoCuotasSeleccionadas(
    @Body() dto: RegistrarPagoCuotasSeleccionadasDto,
  ) {
    return this.cobrosService.registrarPagoCuotasSeleccionadas(dto);
  }

  // ==================== CUENTAS CORRIENTES ====================

  @Get('cuenta-corriente/:socioId')
  @Private()
  @ApiOperation({
    summary: 'Obtener cuenta corriente de un socio',
    description:
      'Devuelve el historial de cuotas de un socio, total de deuda, total pagado y meses adeudados',
  })
  @ApiResponse({
    status: 200,
    description: 'Cuenta corriente obtenida exitosamente',
  })
  @ApiResponse({ status: 404, description: 'Socio no encontrado' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  obtenerCuentaCorriente(
    @Param('socioId', ParseIntPipe) socioId: number,
    @Query('anio') anioRaw?: string,
  ) {
    const anio = anioRaw ? Number.parseInt(anioRaw, 10) : undefined;
    return this.cobrosService.obtenerCuentaCorriente(socioId, anio);
  }

  // ==================== REPORTES ====================

  @Get('reportes/cobranza')
  @Private()
  @ApiOperation({
    summary: 'Obtener reporte de cobranza por período',
    description:
      'Devuelve el total generado, total cobrado, porcentaje de cobranza y morosidad para un período específico',
  })
  @ApiResponse({
    status: 200,
    description: 'Reporte generado exitosamente',
    schema: {
      example: {
        periodo: '2026-02',
        totalGenerado: 250000,
        totalCobrado: 175000,
        porcentajeCobranza: 70,
        cuotasPendientes: 15,
        cuotasPagadas: 35,
        morosidad: 30,
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'No hay cuotas para el período especificado',
  })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  obtenerReporteCobranza(@Query() query: ReporteCobranzaQueryDto) {
    return this.cobrosService.obtenerReporteCobranza(query.periodo);
  }

  @Get('reportes/cobranza-rango')
  @Private()
  @ApiOperation({
    summary: 'Obtener reporte de cobranza por rango de meses',
    description:
      'Devuelve el total generado, total cobrado, porcentaje de cobranza y morosidad consolidados para un rango de meses, más desglose por cada mes',
  })
  @ApiResponse({
    status: 200,
    description: 'Reporte por rango generado exitosamente',
    schema: {
      example: {
        periodoDesde: '2026-01',
        periodoHasta: '2026-03',
        totalGenerado: 750000,
        totalCobrado: 525000,
        porcentajeCobranza: 70,
        cuotasPendientes: 45,
        cuotasPagadas: 105,
        morosidad: 30,
        cantidadMeses: 3,
        meses: [
          {
            periodo: '2026-01',
            totalGenerado: 250000,
            totalCobrado: 175000,
            porcentajeCobranza: 70,
            cuotasPendientes: 15,
            cuotasPagadas: 35,
            morosidad: 30,
          },
        ],
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Rango de períodos inválido',
  })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  obtenerReporteCobranzaRango(
    @Query() query: import('./dto').ReporteCobranzaRangoQueryDto,
  ) {
    return this.cobrosService.obtenerReporteCobranzaRango(
      query.periodoDesde,
      query.periodoHasta,
    );
  }

  // ==================== LISTADO DE CUOTAS ====================

  @Get('cuotas')
  @Private()
  @ApiOperation({
    summary: 'Listar cuotas con filtros y paginación',
    description:
      'Obtiene una lista paginada de cuotas con filtros opcionales por período, estado y socio',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de cuotas obtenida exitosamente',
    schema: {
      example: {
        cuotas: [],
        total: 100,
        page: 1,
        limit: 10,
        totalPages: 10,
      },
    },
  })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  findAllCuotas(
    @Query() query: CuotasQueryDto,
    @Query('tarjetaCentro') tarjetaCentroRaw?: string,
  ) {
    const tarjetaCentro = this.parseTarjetaCentroQueryParam(tarjetaCentroRaw);

    return this.cobrosService.findAllCuotas({
      periodo: query.periodo,
      estado: query.estado as EstadoCuota,
      socioId: query.socioId,
      tarjetaCentro,
      busqueda: query.busqueda,
      page: query.page,
      limit: query.limit,
    });
  }

  private parseTarjetaCentroQueryParam(value: unknown): boolean | undefined {
    if (typeof value === 'boolean') {
      return value;
    }

    if (typeof value !== 'string') {
      return undefined;
    }

    const normalized = value.trim().toLowerCase();
    if (normalized === 'true') {
      return true;
    }

    if (normalized === 'false') {
      return false;
    }

    return undefined;
  }

  // ==================== SOCIOS ELEGIBLES ====================

  @Get('socios-elegibles')
  @Private()
  @ApiOperation({
    summary: 'Obtener socios elegibles para generación de cuotas',
    description:
      'Devuelve socios activos con categoría válida, indicando si ya tienen cuota para el período',
  })
  @ApiQuery({
    name: 'periodo',
    required: true,
    type: String,
    description: 'Período (YYYY-MM)',
    example: '2026-02',
  })
  @ApiResponse({ status: 200, description: 'Lista de socios elegibles' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  obtenerSociosElegibles(@Query('periodo') periodo: string) {
    return this.cobrosService.getSociosElegibles(periodo);
  }

  // ==================== GENERACIÓN CON SELECCIÓN ====================

  @Post('generar-seleccion')
  @Private()
  @ApiOperation({
    summary: 'Generar cuotas para socios seleccionados',
    description:
      'Genera cuotas solo para los socios seleccionados. Verifica morosidad en 2 fases: aviso a 3 meses, inhabilitación a 4+.',
  })
  @ApiResponse({
    status: 201,
    description: 'Cuotas generadas para socios seleccionados',
  })
  @ApiResponse({ status: 400, description: 'Datos inválidos' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  generarCuotasSeleccion(@Body() dto: GenerarCuotasSeleccionDto) {
    return this.cobrosService.generarCuotasSeleccion(dto);
  }

  // ==================== ESTADO DE PAGOS ANUAL ====================

  @Get('estado-pagos')
  @Private()
  @ApiOperation({
    summary: 'Obtener estado de pagos anual de todos los socios',
    description:
      'Devuelve una grilla con el estado de pago de cada mes del año para cada socio, paginado',
  })
  @ApiResponse({ status: 200, description: 'Estado de pagos obtenido' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  obtenerEstadoPagos(@Query() query: EstadoPagosQueryDto) {
    return this.cobrosService.getEstadoPagos(
      query.anio,
      query.page || 1,
      query.limit || 10,
      {
        busqueda: query.busqueda,
        mes: query.mes,
        estadoPago: query.estadoPago || 'TODOS',
        categoriaSocio: query.categoriaSocio || 'TODOS',
      },
    );
  }

  // ==================== MOROSOS DETALLADOS ====================

  @Get('morosos')
  @Private()
  @ApiOperation({
    summary: 'Obtener lista detallada de socios morosos',
    description:
      'Devuelve la lista de socios con 3+ cuotas pendientes, con informacion de contacto, monto real de deuda, periodos adeudados y estadisticas.',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de morosos obtenida exitosamente',
  })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  getMorososDetallados(@Query() query: MorososQueryDto) {
    return this.cobrosService.getMorososDetallados(query);
  }

  // ==================== TALONARIO ====================

  @Get('talonario')
  @Private()
  @ApiOperation({
    summary: 'Obtener datos para talonario PDF',
    description:
      'Devuelve las cuotas pendientes de un período para generar el talonario PDF',
  })
  @ApiResponse({
    status: 200,
    description: 'Datos del talonario obtenidos exitosamente',
  })
  @ApiResponse({
    status: 404,
    description: 'No hay cuotas pendientes para el período',
  })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  obtenerTalonario(@Query('periodo') periodo: string) {
    return this.cobrosService.obtenerCuotasParaTalonario(periodo);
  }

  @Get('talonario/html')
  @Private()
  @ApiOperation({
    summary: 'Generar HTML del talonario para impresión',
    description:
      'Genera el HTML completo del talonario con los datos de las cuotas pendientes del período. Se puede imprimir directamente desde el navegador.',
  })
  @ApiResponse({
    status: 200,
    description: 'HTML del talonario generado exitosamente',
  })
  @ApiResponse({
    status: 404,
    description: 'No hay cuotas pendientes para el período',
  })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  async generarTalonarioHtml(
    @Query('periodo') periodo: string,
    @Res() res: Response,
  ) {
    const cuotas = await this.cobrosService.obtenerCuotasParaTalonario(periodo);

    if (cuotas.length === 0) {
      res
        .status(404)
        .json({ message: 'No hay cuotas pendientes para el período' });
      return;
    }

    const html: string = await this.talonarioPdfService.generarHtmlTalonario(
      cuotas,
      periodo,
    );

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  }

  @Get('tarjeta-centro/archivo')
  @Private()
  @ApiOperation({
    summary: 'Descargar archivo Tarjeta del Centro (.23f)',
    description:
      'Genera y descarga el archivo mensual de cobro para socios con tarjeta del centro en formato de ancho fijo.',
  })
  @ApiResponse({
    status: 200,
    description: 'Archivo .23f generado exitosamente',
  })
  @ApiResponse({
    status: 404,
    description:
      'No hay cuotas pendientes con tarjeta del centro para el período',
  })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  async descargarArchivoTarjetaCentro(
    @Query() query: TarjetaCentroArchivoQueryDto,
    @Res() res: Response,
  ) {
    const cuotas = await this.cobrosService.obtenerCuotasTarjetaCentro(
      query.periodo,
    );

    if (cuotas.length === 0) {
      res.status(404).json({
        message:
          'No hay cuotas pendientes para socios con tarjeta del centro en el período indicado',
      });
      return;
    }

    const archivo = this.tarjetaCentro23fService.generarArchivo(
      query.periodo,
      cuotas,
    );
    res.setHeader('Content-Type', 'text/plain; charset=ascii');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${archivo.fileName}"`,
    );
    res.send(Buffer.from(archivo.content, 'ascii'));
  }

  @Post('tarjeta-centro/resultados')
  @Private()
  @ApiOperation({
    summary: 'Procesar resultados de Tarjeta del Centro',
    description:
      'Permite marcar cuotas de socios con tarjeta del centro como aprobadas o rechazadas. Si se aprueba, la cuota queda PAGADA. Si se rechaza, la cuota permanece PENDIENTE.',
  })
  @ApiResponse({
    status: 201,
    description: 'Resultados de tarjeta del centro procesados exitosamente',
  })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  procesarResultadosTarjetaCentro(
    @Body() dto: ProcesarResultadosTarjetaCentroDto,
  ) {
    return this.cobrosService.procesarResultadosTarjetaCentro(dto);
  }

  @Post('recibo/multiple/html')
  @Private()
  @ApiOperation({
    summary: 'Generar HTML de recibo para múltiples cuotas seleccionadas',
    description:
      'Genera un recibo consolidado en HTML para las cuotas seleccionadas de un socio.',
  })
  @ApiResponse({
    status: 200,
    description: 'Recibo múltiple generado exitosamente',
  })
  @ApiResponse({ status: 400, description: 'Datos inválidos' })
  @ApiResponse({ status: 404, description: 'Cuotas no encontradas' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  async generarReciboMultipleHtml(
    @Body() dto: ReciboMultipleCuotasDto,
    @Res() res: Response,
  ) {
    const cuotas =
      await this.cobrosService.obtenerCuotasParaReciboMultiple(dto);
    const html =
      await this.talonarioPdfService.generarHtmlReciboMultiple(cuotas);

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  }

  @Get('recibo/html')
  @Private()
  @ApiOperation({ summary: 'Generar HTML de recibo individual para un socio' })
  @ApiQuery({
    name: 'socioId',
    required: true,
    type: Number,
    description: 'ID del socio',
    example: 12,
  })
  @ApiQuery({
    name: 'periodo',
    required: true,
    type: String,
    description: 'Periodo en formato YYYY-MM',
    example: '2026-02',
  })
  @ApiResponse({
    status: 200,
    description: 'HTML del recibo individual generado exitosamente',
  })
  @ApiResponse({ status: 400, description: 'Periodo con formato invalido' })
  @ApiResponse({
    status: 404,
    description: 'No existe cuota para el socio en el periodo indicado',
  })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  async generarReciboHtml(
    @Query('socioId', ParseIntPipe) socioId: number,
    @Query('periodo') periodo: string,
    @Res() res: Response,
  ) {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(periodo)) {
      res
        .status(400)
        .json({ message: 'El periodo debe tener formato YYYY-MM' });
      return;
    }

    const cuota = await this.cobrosService.obtenerCuotaPorSocioYPeriodo(
      socioId,
      periodo,
    );

    if (!cuota) {
      res.status(404).json({
        message: 'No existe cuota para el socio en el periodo indicado',
      });
      return;
    }

    const html =
      await this.talonarioPdfService.generarHtmlReciboIndividual(cuota);

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  }

  @Post('pagos/operacion-grupal')
  @Private()
  @ApiOperation({
    summary: 'Registrar operación de cobro grupal familiar',
    description:
      'Registra una operación con cuotas y conceptos no-cuota para un grupo familiar, persistiendo actor, origen, total y trazabilidad de líneas.',
  })
  @ApiResponse({
    status: 201,
    description: 'Operación registrada exitosamente',
    schema: {
      example: [
        {
          id: 123,
          socioId: 45,
          periodo: '2026-03',
          concepto: 'Cuota Mensual',
          monto: 5000,
          estado: 'PAGADO',
        },
        {
          id: 124,
          socioId: 46,
          periodo: '2026-03',
          concepto: 'Cuota Mensual',
          monto: 5000,
          estado: 'PAGADO',
        },
      ],
    },
  })
  @ApiResponse({ status: 400, description: 'Datos de entrada inválidos' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  @ApiResponse({
    status: 409,
    description: 'Una o más cuotas ya están pagadas',
  })
  registrarCobroGrupal(@Body() dto: import('./dto').RegistrarCobroGrupalDto) {
    return this.cobrosService.registrarCobroGrupal(dto);
  }
}