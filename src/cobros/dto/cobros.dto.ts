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
  ArrayMaxSize,
  ValidateNested,
  IsPositive,
  IsDateString,
  Validate,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

import { ApiProperty } from '@nestjs/swagger';
import { Type, Transform } from 'class-transformer';
import { ActorCobro, OrigenCobro } from '../entities/cobro-operacion.entity';

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
    description: 'ID de la cuota a pagar',
    example: 123,
  })
  @IsInt()
  @Min(1)
  @Type(() => Number)
  cuotaId!: number;

  @ApiProperty({
    description: 'ID del método de pago utilizado',
    example: 1,
  })
  @IsInt()
  @Type(() => Number)
  metodoPagoId!: number;

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
    description: 'Lista de IDs de las cuotas a pagar',
    example: [123, 124, 125],
    type: [Number],
  })
  @IsArray()
  @ArrayMinSize(1, { message: 'Debe incluir al menos una cuota para pagar' })
  @Type(() => Number)
  @IsInt({ each: true })
  cuotaIds!: number[];

  @ApiProperty({
    description: 'ID del método de pago utilizado para todas las cuotas',
    example: 1,
  })
  @IsInt()
  @Type(() => Number)
  metodoPagoId!: number;

  @ApiProperty({
    description: 'Observaciones adicionales sobre el pago',
    example: 'Pago múltiple por transferencia bancaria',
    required: false,
  })
  @IsString()
  @IsOptional()
  observaciones?: string;
}

export class ConceptoCobroDto {
  @ApiProperty({
    description: 'Nombre del concepto no-cuota',
    example: 'RIFA',
  })
  @IsString()
  concepto!: string;

  @ApiProperty({
    description: 'Descripción opcional del concepto',
    required: false,
    example: 'Rifa mes de marzo',
  })
  @IsOptional()
  @IsString()
  descripcion?: string;

  @ApiProperty({
    description: 'Monto del concepto',
    example: 12000,
  })
  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  monto!: number;
}

export class PagoMetodoMontoDto {
  @ApiProperty({
    description: 'ID del método de pago utilizado',
    example: 1,
  })
  @IsInt()
  @Type(() => Number)
  metodoPagoId!: number;

  @ApiProperty({
    description: 'Importe asignado a este método de pago',
    example: 12000,
  })
  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  monto!: number;
}

export class RegistrarOperacionCobroDto {
  @ApiProperty({
    description: 'ID del socio titular del cobro',
    example: 12,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  socioId!: number;

  @ApiProperty({
    description: 'IDs de cuotas a cancelar dentro de la operación',
    example: [101, 102],
    type: [Number],
    required: false,
  })
  @IsOptional()
  @IsArray()
  @Type(() => Number)
  @IsInt({ each: true })
  cuotaIds?: number[];

  @ApiProperty({
    description: 'Conceptos no-cuota adicionales de la operación',
    type: [ConceptoCobroDto],
    required: false,
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ConceptoCobroDto)
  conceptos?: ConceptoCobroDto[];


  @Validate(function (object: RegistrarOperacionCobroDto) {
    const hasCuotas = object.cuotaIds && object.cuotaIds.length > 0;
    const hasConceptos = object.conceptos && object.conceptos.length > 0;
    
    if (!hasCuotas && !hasConceptos) {
      throw new Error('Debe incluir al menos una cuota o un concepto en la operación');
    }
    
    return true;
  })
  private readonly validateAtLeastOneItem?: any;

  @ApiProperty({
    description: 'ID del método de pago principal',
    example: 1,
    required: false,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  metodoPagoId!: number;

  @ApiProperty({
    description:
      'Distribución de importes por método de pago (1 o 2 métodos). Si se informa, reemplaza metodoPagoId.',
    type: [PagoMetodoMontoDto],
    required: false,
  })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1, { message: 'Debe indicar al menos un método de pago' })
  @ArrayMaxSize(2, { message: 'Solo se permiten hasta dos métodos de pago' })
  @ValidateNested({ each: true })
  @Type(() => PagoMetodoMontoDto)
  pagos?: PagoMetodoMontoDto[];

  @ApiProperty({
    description: 'Actor del cobro',
    enum: ActorCobro,
    example: ActorCobro.COBRADOR,
  })
  @IsEnum(ActorCobro)
  actorCobro!: ActorCobro;

  @ApiProperty({
    description: 'Origen del cobro',
    enum: OrigenCobro,
    example: OrigenCobro.MOBILE,
  })
  @IsEnum(OrigenCobro)
  origenCobro!: OrigenCobro;

  @ApiProperty({
    description: 'ID del cobrador (obligatorio si actor = COBRADOR)',
    required: false,
    example: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  cobradorId?: number;

  @ApiProperty({
    description:
      'Identificador de instalación móvil (opcional; se usa para trazabilidad/idempotencia en clientes móviles)',
    required: false,
    example: 'device-abc123',
  })
  @IsOptional()
  @IsString()
  installationId?: string;

  @ApiProperty({
    description: 'Total de la operación (debe coincidir con suma de líneas)',
    example: 24000,
  })
  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  total!: number;

  @ApiProperty({
    description: 'Clave de idempotencia para evitar dobles registros',
    required: false,
    example: 'device-abc-20260305-op-0001',
  })
  @IsOptional()
  @IsString()
  idempotencyKey?: string;

  @ApiProperty({
    description: 'Referencia externa',
    required: false,
  })
  @IsOptional()
  @IsString()
  referencia?: string;

  @ApiProperty({
    description: 'Observaciones generales',
    required: false,
  })
  @IsOptional()
  @IsString()
  observaciones?: string;
}

export class MisCobranzasRangoDto {
  @ApiProperty({
    description: 'Fecha/hora inicio (ISO 8601)',
    example: '2026-03-01T00:00:00.000Z',
  })
  @IsDateString()
  desde!: string;

  @ApiProperty({
    description: 'Fecha/hora fin (ISO 8601)',
    example: '2026-03-31T23:59:59.999Z',
  })
  @IsDateString()
  hasta!: string;
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
    description:
      'Período para generar archivo Tarjeta Centro (formato YYYY-MM)',
    example: '2026-02',
    pattern: '^\\d{4}-(0[1-9]|1[0-2])$',
  })
  @IsString()
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/, {
    message: 'El período debe tener el formato YYYY-MM (ej: 2026-02)',
  })
  periodo!: string;
}

export class TarjetaCentroResultadoDto {
  @ApiProperty({
    description: 'ID de la cuota a procesar',
    example: 123,
  })
  @IsInt()
  @Min(1)
  @Type(() => Number)
  cuotaId!: number;

  @ApiProperty({
    description: 'Indica si la tarjeta fue aprobada (true) o rechazada (false)',
    example: true,
  })
  @IsBoolean()
  aprobada!: boolean;

  @ApiProperty({
    description: 'Observación opcional del resultado de la tarjeta',
    example: 'Respuesta lote 15 del banco',
    required: false,
  })
  @IsOptional()
  @IsString()
  observaciones?: string;
}

export class RegistrarPagoCuotasSeleccionadasDto {
  @ApiProperty({
    description: 'ID del socio titular de las cuotas',
    example: 12,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  socioId!: number;

  @ApiProperty({
    description: 'IDs de las cuotas a pagar',
    example: [101, 102, 103],
    type: [Number],
  })
  @IsArray()
  @ArrayMinSize(1, { message: 'Debe seleccionar al menos una cuota' })
  @Type(() => Number)
  @IsInt({ each: true })
  cuotaIds!: number[];

  @ApiProperty({
    description: 'Distribución de importes por método de pago (1 o 2 métodos)',
    type: [PagoMetodoMontoDto],
  })
  @IsArray()
  @ArrayMinSize(1, { message: 'Debe indicar al menos un método de pago' })
  @ArrayMaxSize(2, { message: 'Solo se permiten hasta dos métodos de pago' })
  @ValidateNested({ each: true })
  @Type(() => PagoMetodoMontoDto)
  pagos!: PagoMetodoMontoDto[];

  @ApiProperty({
    description: 'Observaciones generales del pago',
    example: 'Regularización de deuda de 3 meses',
    required: false,
  })
  @IsOptional()
  @IsString()
  observaciones?: string;
}

export class ReciboMultipleCuotasDto {
  @ApiProperty({
    description: 'ID del socio titular de las cuotas',
    example: 12,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  socioId!: number;

  @ApiProperty({
    description: 'IDs de las cuotas a incluir en el recibo',
    example: [101, 102],
    type: [Number],
  })
  @IsArray()
  @ArrayMinSize(1, { message: 'Debe seleccionar al menos una cuota' })
  @Type(() => Number)
  @IsInt({ each: true })
  cuotaIds!: number[];
}

export class ProcesarResultadosTarjetaCentroDto {
  @ApiProperty({
    description: 'Resultados de procesamiento por cuota de tarjeta del centro',
    type: [TarjetaCentroResultadoDto],
  })
  @IsArray()
  @ArrayMinSize(1, {
    message: 'Debe incluir al menos un resultado de tarjeta del centro',
  })
  @ValidateNested({ each: true })
  @Type(() => TarjetaCentroResultadoDto)
  resultados!: TarjetaCentroResultadoDto[];
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
    enum: [
      'TODOS',
      'PAGADA',
      'PENDIENTE',
      'SIN_CUOTA',
      'CON_PAGO',
      'CON_DEUDA',
    ],
    required: false,
    example: 'TODOS',
  })
  @IsOptional()
  @IsEnum([
    'TODOS',
    'PAGADA',
    'PENDIENTE',
    'SIN_CUOTA',
    'CON_PAGO',
    'CON_DEUDA',
  ])
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

  @ApiProperty({
    description: 'Filtro por tarjeta del centro',
    required: false,
    example: true,
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (
      value === true ||
      value === 'true' ||
      value === 1 ||
      value === '1' ||
      value === 'si' ||
      value === 'sí'
    ) {
      return true;
    }
    if (
      value === false ||
      value === 'false' ||
      value === 0 ||
      value === '0' ||
      value === 'no'
    ) {
      return false;
    }
    return undefined;
  })
  @IsBoolean()
  tarjetaCentro?: boolean;
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

  @ApiProperty({
    description: 'DNI del socio',
    required: false,
    example: '30111222',
  })
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
    description: 'Indica si el socio tiene Tarjeta del Centro',
    example: true,
  })
  @IsBoolean()
  tarjetaCentro!: boolean;

  @ApiProperty({
    description:
      'Estado de pago por mes (01-12). Valor: "PAGADA", "PENDIENTE" o null (sin cuota)',
    example: { '01': 'PAGADA', '02': 'PENDIENTE', '03': null },
  })
  meses!: Record<string, string | null>;

  @ApiProperty({
    description:
      'Estado de Tarjeta del Centro por mes (01-12). Solo aplica a socios con tarjeta y cuota generada en ese mes.',
    required: false,
    example: {
      '01': 'TARJETA_APROBADA',
      '02': 'TARJETA_RECHAZADA_PENDIENTE',
      '03': 'TARJETA_RECHAZADA_PAGADA',
      '04': 'TARJETA_PENDIENTE_RESPUESTA',
      '05': null,
    },
  })
  @IsOptional()
  mesesTarjetaCentro?: Record<string, string | null>;
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
    description: 'Filtrar cuotas por socios con o sin tarjeta del centro',
    example: true,
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => {
    if (value === undefined || value === null || value === '') {
      return undefined;
    }

    if (value === true || value === 'true') {
      return true;
    }

    if (value === false || value === 'false') {
      return false;
    }

    return value;
  })
  tarjetaCentro?: boolean;

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

export class DesglosePorMetodoPagoDto {
  @ApiProperty({ description: 'Nombre del método de pago', example: 'Efectivo' })
  @IsString()
  metodoPago!: string;

  @ApiProperty({ description: 'Total cobrado con este método', example: 125000 })
  @IsNumber()
  totalCobrado!: number;

  @ApiProperty({ description: 'Cantidad de pagos con este método', example: 15 })
  @IsInt()
  cantidadPagos!: number;
}

export class ResumenTarjetaCentroDto {
  @ApiProperty({ description: 'Cantidad de socios con tarjeta del centro', example: 20 })
  @IsInt()
  sociosConTarjeta!: number;

  @ApiProperty({ description: 'Cuotas pagadas por tarjeta del centro', example: 18 })
  @IsInt()
  cuotasPagadasTarjeta!: number;

  @ApiProperty({ description: 'Total cobrado por tarjeta del centro', example: 90000 })
  @IsNumber()
  totalCobradoTarjeta!: number;

  @ApiProperty({ description: 'Cuotas pendientes de tarjeta del centro', example: 2 })
  @IsInt()
  cuotasPendientesTarjeta!: number;

  @ApiProperty({ description: 'Total pendiente de tarjeta del centro', example: 10000 })
  @IsNumber()
  totalPendienteTarjeta!: number;
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

  @ApiProperty({
    description: 'Desglose por método de pago consolidado',
    type: [DesglosePorMetodoPagoDto],
  })
  @IsArray()
  desglosePorMetodoPago!: DesglosePorMetodoPagoDto[];

  @ApiProperty({
    description: 'Resumen de Tarjeta del Centro consolidado',
    type: ResumenTarjetaCentroDto,
  })
  tarjetaCentro!: ResumenTarjetaCentroDto;
}
