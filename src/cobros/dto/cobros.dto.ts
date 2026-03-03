import {
  IsString,
  Matches,
  IsNumber,
  IsInt,
  IsBoolean,
  Min,
  IsEnum,
  IsOptional,
  IsArray,
  ArrayMinSize,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type, Transform } from 'class-transformer';
import { MetodoPago } from '../entities/pago-cuota.entity';

export class GenerarCuotasDto {
  @ApiProperty({
    description: 'Período para el cual generar cuotas (formato YYYY-MM)',
    example: '2026-02',
    pattern: '^\\d{4}-(0[1-9]|1[0-2])$',
  })
  @IsString()
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/, {
    message: 'El período debe tener el formato YYYY-MM (ej: 2026-02)',
  })
  periodo!: string;
}

export class RegistrarPagoDto {
  @ApiProperty({
    description: 'Código de barras de la cuota (formato MM-socioId)',
    example: '01-123',
    required: false,
  })
  @IsString()
  @IsOptional()
  barcode?: string;

  @ApiProperty({
    description: 'ID de la cuota (alternativa al barcode)',
    example: 123,
    required: false,
  })
  @IsNumber()
  @IsOptional()
  cuotaId?: number;

  @ApiProperty({
    description: 'Método de pago utilizado',
    enum: MetodoPago,
    example: MetodoPago.EFECTIVO,
  })
  @IsEnum(MetodoPago)
  metodoPago!: MetodoPago;

  @ApiProperty({
    description: 'Observaciones adicionales sobre el pago',
    example: 'Pago realizado en efectivo en la sede',
    required: false,
  })
  @IsString()
  @IsOptional()
  observaciones?: string;
}

export class RegistrarPagoMultipleDto {
  @ApiProperty({
    description: 'Lista de códigos de barras de las cuotas a pagar',
    example: ['CUOTA-123', 'CUOTA-124', 'CUOTA-125'],
    type: [String],
  })
  @IsArray()
  @ArrayMinSize(1, { message: 'Debe incluir al menos una cuota para pagar' })
  @IsString({ each: true })
  barcodes!: string[];

  @ApiProperty({
    description: 'Método de pago utilizado para todas las cuotas',
    enum: MetodoPago,
    example: MetodoPago.TRANSFERENCIA,
  })
  @IsEnum(MetodoPago)
  metodoPago!: MetodoPago;

  @ApiProperty({
    description: 'Observaciones adicionales sobre el pago',
    example: 'Pago múltiple por transferencia bancaria',
    required: false,
  })
  @IsString()
  @IsOptional()
  observaciones?: string;
}

export class CuentaCorrienteQueryDto {
  @ApiProperty({
    description: 'ID del socio para consultar cuenta corriente',
    example: 1,
  })
  @IsNumber()
  @Min(1)
  @Type(() => Number)
  socioId!: number;
}

export class ReporteCobranzaQueryDto {
  @ApiProperty({
    description: 'Período para el reporte (formato YYYY-MM)',
    example: '2026-02',
    pattern: '^\\d{4}-(0[1-9]|1[0-2])$',
  })
  @IsString()
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/, {
    message: 'El período debe tener el formato YYYY-MM (ej: 2026-02)',
  })
  periodo!: string;
}

export class TalonarioQueryDto {
  @ApiProperty({
    description: 'Período para el talonario (formato YYYY-MM)',
    example: '2026-02',
    pattern: '^\\d{4}-(0[1-9]|1[0-2])$',
  })
  @IsString()
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/, {
    message: 'El período debe tener el formato YYYY-MM (ej: 2026-02)',
  })
  periodo!: string;
}

export class TarjetaCentroArchivoQueryDto {
  @ApiProperty({
    description: 'Período para generar archivo Tarjeta Centro (formato YYYY-MM)',
    example: '2026-02',
    pattern: '^\\d{4}-(0[1-9]|1[0-2])$',
  })
  @IsString()
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/, {
    message: 'El período debe tener el formato YYYY-MM (ej: 2026-02)',
  })
  periodo!: string;
}

export class SocioElegibleDto {
  @ApiProperty({ description: 'ID del socio', example: 1 })
  @IsInt()
  id!: number;

  @ApiProperty({ description: 'Nombre del socio', example: 'Juan' })
  @IsString()
  nombre!: string;

  @ApiProperty({ description: 'Apellido del socio', example: 'Perez' })
  @IsString()
  apellido!: string;

  @ApiProperty({ description: 'DNI del socio', example: '12345678' })
  @IsOptional()
  @IsString()
  dni?: string;

  @ApiProperty({
    description: 'Nombre de la categoria',
    example: 'Socio Activo',
  })
  @IsString()
  categoriaNombre!: string;

  @ApiProperty({ description: 'Monto mensual de la categoria', example: 5000 })
  @IsNumber()
  montoMensual!: number;

  @ApiProperty({
    description: 'Si ya tiene cuota generada para el periodo',
    example: false,
  })
  @IsBoolean()
  cuotaExistente!: boolean;

  @ApiProperty({
    description: 'Indica si el socio tiene tarjeta del centro',
    example: true,
  })
  @IsBoolean()
  tarjetaCentro!: boolean;
}

export class SociosElegiblesResponseDto {
  @ApiProperty({
    description: 'Lista de socios elegibles',
    type: [SocioElegibleDto],
  })
  socios!: SocioElegibleDto[];

  @ApiProperty({ description: 'Total de socios elegibles', example: 50 })
  @IsInt()
  total!: number;
}

export class GenerarCuotasSeleccionDto {
  @ApiProperty({
    description: 'Periodo para el cual generar cuotas (formato YYYY-MM)',
    example: '2026-02',
    pattern: '^\\d{4}-(0[1-9]|1[0-2])$',
  })
  @IsString()
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/, {
    message: 'El periodo debe tener el formato YYYY-MM (ej: 2026-02)',
  })
  periodo!: string;

  @ApiProperty({
    description: 'IDs de los socios para los que generar cuotas',
    example: [1, 2, 3],
    type: [Number],
  })
  @IsArray()
  @ArrayMinSize(1, { message: 'Debe seleccionar al menos un socio' })
  @IsNumber({}, { each: true })
  socioIds!: number[];
}

export class GenerarCuotasSeleccionResponseDto {
  @ApiProperty({ description: 'Cantidad de cuotas creadas', example: 10 })
  @IsInt()
  creadas!: number;

  @ApiProperty({
    description: 'Cantidad de cuotas omitidas (ya existian)',
    example: 2,
  })
  @IsInt()
  omitidas!: number;

  @ApiProperty({
    description: 'Cantidad de socios con advertencia de morosidad',
    example: 1,
  })
  @IsInt()
  advertenciasMorosidad!: number;

  @ApiProperty({ description: 'Cantidad de socios inhabilitados', example: 0 })
  @IsInt()
  inhabilitados!: number;

  @ApiProperty({ description: 'Advertencias generadas', type: [String] })
  @IsArray()
  @IsString({ each: true })
  advertencias!: string[];
}

export class EstadoPagosQueryDto {
  @ApiProperty({
    description: 'Ano para consultar estado de pagos',
    example: 2026,
  })
  @IsInt()
  @Min(2000)
  @Transform(({ value }) => Number(value))
  anio!: number;

  @ApiProperty({
    description: 'Pagina actual (1-indexed)',
    example: 1,
    required: false,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  page?: number;

  @ApiProperty({
    description: 'Cantidad de registros por pagina',
    example: 10,
    required: false,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  limit?: number;

  @ApiProperty({
    description: 'Busqueda por nombre, apellido o DNI del socio',
    example: 'Perez',
    required: false,
  })
  @IsString()
  @IsOptional()
  busqueda?: string;

  @ApiProperty({
    description: 'Mes de referencia para filtros mensuales (1-12)',
    example: 3,
    required: false,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  mes?: number;

  @ApiProperty({
    description:
      'Filtro de estado de pago. PAGADA/PENDIENTE/SIN_CUOTA usan el mes de referencia cuando se envía.',
    enum: ['TODOS', 'PAGADA', 'PENDIENTE', 'SIN_CUOTA', 'CON_PAGO', 'CON_DEUDA'],
    required: false,
    example: 'TODOS',
  })
  @IsOptional()
  @IsEnum(['TODOS', 'PAGADA', 'PENDIENTE', 'SIN_CUOTA', 'CON_PAGO', 'CON_DEUDA'])
  estadoPago?:
    | 'TODOS'
    | 'PAGADA'
    | 'PENDIENTE'
    | 'SIN_CUOTA'
    | 'CON_PAGO'
    | 'CON_DEUDA';

  @ApiProperty({
    description: 'Filtro por categoria de socio',
    enum: ['TODOS', 'ACTIVO', 'ADHERENTE'],
    required: false,
    example: 'TODOS',
  })
  @IsOptional()
  @IsEnum(['TODOS', 'ACTIVO', 'ADHERENTE'])
  categoriaSocio?: 'TODOS' | 'ACTIVO' | 'ADHERENTE';
}

export class SocioPagosAnualDto {
  @ApiProperty({ description: 'ID del socio' })
  @IsInt()
  socioId!: number;

  @ApiProperty({ description: 'Nombre del socio' })
  @IsString()
  nombre!: string;

  @ApiProperty({ description: 'Apellido del socio' })
  @IsString()
  apellido!: string;

  @ApiProperty({ description: 'DNI del socio', required: false, example: '30111222' })
  @IsOptional()
  @IsString()
  dni?: string;

  @ApiProperty({
    description: 'Categoria del socio (solo categorias que pagan cuota)',
    example: 'ACTIVO',
  })
  @IsString()
  categoriaNombre!: string;

  @ApiProperty({
    description: 'Estado del socio',
    enum: ['ACTIVO', 'INACTIVO', 'MOROSO'],
    example: 'ACTIVO',
  })
  @IsString()
  estado!: string;

  @ApiProperty({
    description:
      'Estado de pago por mes (01-12). Valor: "PAGADA", "PENDIENTE" o null (sin cuota)',
    example: { '01': 'PAGADA', '02': 'PENDIENTE', '03': null },
  })
  meses!: Record<string, string | null>;
}

export class EstadoPagosResponseDto {
  @ApiProperty({
    description: 'Lista de socios con su estado de pagos',
    type: [SocioPagosAnualDto],
  })
  socios!: SocioPagosAnualDto[];

  @ApiProperty({ description: 'Total de socios', example: 100 })
  @IsInt()
  total!: number;

  @ApiProperty({ description: 'Pagina actual', example: 1 })
  @IsInt()
  page!: number;

  @ApiProperty({ description: 'Registros por pagina', example: 10 })
  @IsInt()
  limit!: number;

  @ApiProperty({ description: 'Total de paginas', example: 10 })
  @IsInt()
  totalPages!: number;
}

export class CuotasQueryDto {
  @ApiProperty({
    description: 'Filtrar por período (YYYY-MM)',
    example: '2026-02',
    required: false,
  })
  @IsString()
  @IsOptional()
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/, {
    message: 'El período debe tener el formato YYYY-MM (ej: 2026-02)',
  })
  periodo?: string;

  @ApiProperty({
    description: 'Filtrar por estado de la cuota',
    enum: ['PENDIENTE', 'PAGADA'],
    required: false,
  })
  @IsString()
  @IsOptional()
  estado?: string;

  @ApiProperty({
    description: 'Filtrar por ID de socio',
    example: 1,
    required: false,
  })
  @IsInt()
  @IsOptional()
  @Min(1)
  @Type(() => Number)
  socioId?: number;

  @ApiProperty({
    description: 'Buscar por nombre, apellido o DNI del socio',
    example: 'Juan',
    required: false,
  })
  @IsString()
  @IsOptional()
  busqueda?: string;

  @ApiProperty({
    description: 'Página actual (1-indexed)',
    example: 1,
    required: false,
    default: 1,
  })
  @IsInt()
  @IsOptional()
  @Min(1)
  @Type(() => Number)
  page?: number;

  @ApiProperty({
    description: 'Cantidad de registros por página',
    example: 10,
    required: false,
    default: 10,
  })
  @IsInt()
  @IsOptional()
  @Min(1)
  @Type(() => Number)
  limit?: number;
}

// ==================== MOROSOS DETALLADOS ====================

export enum SeveridadMoroso {
  TODOS = 'todos',
  TRES_MESES = '3-meses',
  CUATRO_MAS = '4-meses',
  SEIS_MAS = '6-meses',
}

export class MorososQueryDto {
  @ApiProperty({
    description: 'Filtrar por severidad de morosidad',
    enum: SeveridadMoroso,
    example: SeveridadMoroso.TODOS,
    required: false,
    default: SeveridadMoroso.TODOS,
  })
  @IsEnum(SeveridadMoroso)
  @IsOptional()
  severidad?: SeveridadMoroso;

  @ApiProperty({
    description: 'Buscar por nombre, apellido o DNI del socio',
    example: 'Garcia',
    required: false,
  })
  @IsString()
  @IsOptional()
  busqueda?: string;

  @ApiProperty({
    description: 'Pagina actual (1-indexed)',
    example: 1,
    required: false,
    default: 1,
  })
  @IsInt()
  @IsOptional()
  @Min(1)
  @Type(() => Number)
  page?: number;

  @ApiProperty({
    description: 'Cantidad de registros por pagina',
    example: 10,
    required: false,
    default: 10,
  })
  @IsInt()
  @IsOptional()
  @Min(1)
  @Type(() => Number)
  limit?: number;
}

export class UltimoPagoDto {
  @ApiProperty({ description: 'Fecha del ultimo pago' })
  fecha!: Date;

  @ApiProperty({
    description: 'Periodo de la cuota pagada',
    example: '2025-11',
  })
  periodo!: string;
}

export class CategoriaMorosoDto {
  @ApiProperty({
    description: 'Nombre de la categoria',
    example: 'Socio Activo',
  })
  nombre!: string;

  @ApiProperty({ description: 'Monto mensual de la categoria', example: 5000 })
  montoMensual!: number;
}

export class MorosoDetalladoDto {
  @ApiProperty({ description: 'ID del socio' })
  @IsInt()
  socioId!: number;

  @ApiProperty({ description: 'Nombre del socio' })
  @IsString()
  nombre!: string;

  @ApiProperty({ description: 'Apellido del socio' })
  @IsString()
  apellido!: string;

  @ApiProperty({ description: 'DNI del socio' })
  @IsString()
  dni!: string;

  @ApiProperty({ description: 'Telefono del socio', required: false })
  @IsString()
  @IsOptional()
  telefono?: string;

  @ApiProperty({ description: 'Email del socio', required: false })
  @IsString()
  @IsOptional()
  email?: string;

  @ApiProperty({ description: 'Categoria del socio', type: CategoriaMorosoDto })
  categoria!: CategoriaMorosoDto;

  @ApiProperty({
    description: 'Estado del socio',
    enum: ['ACTIVO', 'MOROSO', 'INACTIVO'],
  })
  @IsString()
  estado!: string;

  @ApiProperty({ description: 'Cantidad de meses de deuda', example: 4 })
  @IsInt()
  mesesDeuda!: number;

  @ApiProperty({ description: 'Monto total de la deuda', example: 20000 })
  @IsNumber()
  montoTotalDeuda!: number;

  @ApiProperty({
    description: 'Lista de periodos adeudados',
    example: ['2025-11', '2025-12', '2026-01'],
  })
  @IsArray()
  @IsString({ each: true })
  periodosAdeudados!: string[];

  @ApiProperty({
    description: 'Informacion del ultimo pago realizado',
    required: false,
    type: UltimoPagoDto,
  })
  @IsOptional()
  ultimoPago?: UltimoPagoDto;
}

export class MorososStatsDto {
  @ApiProperty({ description: 'Total de morosos', example: 15 })
  @IsInt()
  totalMorosos!: number;

  @ApiProperty({ description: 'Monto total de deuda', example: 150000 })
  @IsNumber()
  montoTotalDeuda!: number;

  @ApiProperty({
    description: 'Morosos con exactamente 3 meses de deuda',
    example: 5,
  })
  @IsInt()
  tresMeses!: number;

  @ApiProperty({ description: 'Morosos con 4-5 meses de deuda', example: 7 })
  @IsInt()
  cuatroMeses!: number;

  @ApiProperty({
    description: 'Morosos con 6 o mas meses de deuda',
    example: 3,
  })
  @IsInt()
  seisMeses!: number;
}

export class MorososDetalladosResponseDto {
  @ApiProperty({
    description: 'Lista de morosos detallados',
    type: [MorosoDetalladoDto],
  })
  morosos!: MorosoDetalladoDto[];

  @ApiProperty({
    description: 'Estadisticas de morosidad',
    type: MorososStatsDto,
  })
  estadisticas!: MorososStatsDto;

  @ApiProperty({
    description: 'Total de morosos (sin paginacion)',
    example: 50,
  })
  @IsInt()
  total!: number;

  @ApiProperty({ description: 'Pagina actual', example: 1 })
  @IsInt()
  page!: number;

  @ApiProperty({ description: 'Registros por pagina', example: 10 })
  @IsInt()
  limit!: number;

  @ApiProperty({ description: 'Total de paginas', example: 5 })
  @IsInt()
  totalPages!: number;
}

// ==================== REPORTE DE COBRANZA POR RANGO ====================

export class ReporteCobranzaRangoQueryDto {
  @ApiProperty({
    description: 'Período inicial para el reporte (formato YYYY-MM)',
    example: '2026-01',
    pattern: '^\\d{4}-(0[1-9]|1[0-2])$',
  })
  @IsString()
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/, {
    message: 'El período desde debe tener el formato YYYY-MM (ej: 2026-01)',
  })
  periodoDesde!: string;

  @ApiProperty({
    description: 'Período final para el reporte (formato YYYY-MM)',
    example: '2026-03',
    pattern: '^\\d{4}-(0[1-9]|1[0-2])$',
  })
  @IsString()
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/, {
    message: 'El período hasta debe tener el formato YYYY-MM (ej: 2026-03)',
  })
  periodoHasta!: string;
}

export class ReporteCobranzaMesDto {
  @ApiProperty({ description: 'Período del mes', example: '2026-01' })
  @IsString()
  periodo!: string;

  @ApiProperty({ description: 'Total generado en el mes', example: 250000 })
  @IsNumber()
  totalGenerado!: number;

  @ApiProperty({ description: 'Total cobrado en el mes', example: 175000 })
  @IsNumber()
  totalCobrado!: number;

  @ApiProperty({ description: 'Porcentaje de cobranza', example: 70 })
  @IsNumber()
  porcentajeCobranza!: number;

  @ApiProperty({ description: 'Cantidad de cuotas pendientes', example: 15 })
  @IsInt()
  cuotasPendientes!: number;

  @ApiProperty({ description: 'Cantidad de cuotas pagadas', example: 35 })
  @IsInt()
  cuotasPagadas!: number;

  @ApiProperty({ description: 'Porcentaje de morosidad', example: 30 })
  @IsNumber()
  morosidad!: number;
}

export class ReporteCobranzaRangoResponseDto {
  @ApiProperty({ description: 'Período inicial', example: '2026-01' })
  @IsString()
  periodoDesde!: string;

  @ApiProperty({ description: 'Período final', example: '2026-03' })
  @IsString()
  periodoHasta!: string;

  @ApiProperty({ description: 'Total generado en el rango', example: 750000 })
  @IsNumber()
  totalGenerado!: number;

  @ApiProperty({ description: 'Total cobrado en el rango', example: 525000 })
  @IsNumber()
  totalCobrado!: number;

  @ApiProperty({ description: 'Porcentaje de cobranza promedio', example: 70 })
  @IsNumber()
  porcentajeCobranza!: number;

  @ApiProperty({ description: 'Total de cuotas pendientes', example: 45 })
  @IsInt()
  cuotasPendientes!: number;

  @ApiProperty({ description: 'Total de cuotas pagadas', example: 105 })
  @IsInt()
  cuotasPagadas!: number;

  @ApiProperty({ description: 'Porcentaje de morosidad promedio', example: 30 })
  @IsNumber()
  morosidad!: number;

  @ApiProperty({ description: 'Cantidad de meses en el rango', example: 3 })
  @IsInt()
  cantidadMeses!: number;

  @ApiProperty({
    description: 'Desglose por cada mes del rango',
    type: [ReporteCobranzaMesDto],
  })
  @IsArray()
  meses!: ReporteCobranzaMesDto[];
}
