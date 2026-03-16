import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  Repository,
  DataSource,
  In,
  Brackets,
  QueryFailedError,
} from 'typeorm';
import { Cuota, EstadoCuota } from './entities/cuota.entity';
import { PagoCuota } from './entities/pago-cuota.entity';
import {
  ActorCobro,
  CobroOperacion,
  OrigenCobro,
} from './entities/cobro-operacion.entity';
import { CobradorComisionConfig } from '../cobradores/entities/cobrador-comision-config.entity';
import { normalizeComisionPorcentaje } from '../cobradores/utils/comision.util';
import {
  CobradorCuentaCorrienteMovimiento,
  TipoMovimientoCobrador,
} from '../cobradores/entities/cobrador-cuenta-corriente-movimiento.entity';
import {
  CobroOperacionLinea,
  TipoLineaCobro,
} from './entities/cobro-operacion-linea.entity';
import { Socio } from '../socios/entities/socio.entity';
import { MetodoPago } from '../metodos-pago/entities/metodo-pago.entity';
import { NotificacionesService } from '../notificaciones/notificaciones.service';
import { TipoNotificacion } from '../notificaciones/entities/notificacion.entity';
import {
  GenerarCuotasDto,
  RegistrarPagoDto,
  RegistrarPagoMultipleDto,
  RegistrarOperacionCobroDto,
  RegistrarCobroGrupalDto,
  RegistrarPagoCuotasSeleccionadasDto,
  ReciboMultipleCuotasDto,
  PagoMetodoMontoDto,
  GenerarCuotasSeleccionDto,
  // Morosos detallados
  MorososQueryDto,
  SeveridadMoroso,
  MorosoDetalladoDto,
  MorososStatsDto,
  MorososDetalladosResponseDto,
  ProcesarResultadosTarjetaCentroDto,
  TarjetaCentroResultadoDto,
} from './dto';
import { CustomError } from 'src/constants/errors/custom-error';
import {
  ERROR_MESSAGES,
  ERROR_CODES,
} from 'src/constants/errors/error-messages';

export interface ResultadoGeneracionCuotas {
  creadas: number;
  omitidas: number;
  advertenciasMorosidad: number;
  inhabilitados: number;
  desactivados: number;
  advertencias: string[];
}

export interface CuentaCorriente {
  socioId: number;
  socioNombre: string;
  socioApellido: string;
  cuotas: {
    id: number;
    periodo: string;
    monto: number;
    estado: EstadoCuota;
    tarjetaCentroEstado: 'PENDIENTE_RESPUESTA' | 'APROBADA' | 'RECHAZADA' | 'NO_APLICA';
    tarjetaCentroDetalle: string;
    tarjetaCentroFechaEstado?: Date;
    fechaPago?: Date;
  }[];
  totalDeuda: number;
  totalPagado: number;
  mesesAdeudados: number;
}

export interface DesglosePorMetodoPago {
  metodoPago: string;
  totalCobrado: number;
  cantidadPagos: number;
}

export interface ResumenTarjetaCentro {
  sociosConTarjeta: number;
  cuotasPagadasTarjeta: number;
  totalCobradoTarjeta: number;
  cuotasPendientesTarjeta: number;
  totalPendienteTarjeta: number;
}

export interface ReporteCobranza {
  periodo: string;
  totalGenerado: number;
  totalCobrado: number;
  porcentajeCobranza: number;
  cuotasPendientes: number;
  cuotasPagadas: number;
  morosidad: number;
  desglosePorMetodoPago: DesglosePorMetodoPago[];
  tarjetaCentro: ResumenTarjetaCentro;
}

export interface ResultadoProcesamientoTarjetaCentro {
  procesados: number;
  aprobados: number;
  rechazados: number;
  errores: string[];
}

export interface ResultadoPagoCuotasSeleccionadas {
  cuotasPagadas: number;
  pagosGenerados: number;
  totalPagado: number;
}

export type EstadoTarjetaCentroMes =
  | 'TARJETA_APROBADA'
  | 'TARJETA_RECHAZADA_PENDIENTE'
  | 'TARJETA_RECHAZADA_PAGADA'
  | 'TARJETA_PENDIENTE_RESPUESTA';

@Injectable()
export class CobrosService {
  private readonly logger = new Logger(CobrosService.name);
  private static readonly UMBRAL_ADVERTENCIA_MOROSIDAD = 3;
  private static readonly UMBRAL_INHABILITACION_MOROSIDAD = 4;

  constructor(
    @InjectRepository(Cuota)
    private readonly cuotaRepository: Repository<Cuota>,
    @InjectRepository(PagoCuota)
    private readonly pagoCuotaRepository: Repository<PagoCuota>,
    @InjectRepository(CobroOperacion)
    private readonly cobroOperacionRepository: Repository<CobroOperacion>,
    @InjectRepository(CobroOperacionLinea)
    private readonly cobroOperacionLineaRepository: Repository<CobroOperacionLinea>,
    @InjectRepository(Socio)
    private readonly socioRepository: Repository<Socio>,
    private readonly dataSource: DataSource,
    private readonly notificacionesService: NotificacionesService,
  ) {}

  /**
   * Genera cuotas mensuales para todos los socios activos con categoría asignada
   * Incluye verificación de morosidad y desactivación automática
   */
  async generarCuotasMensuales(
    dto: GenerarCuotasDto,
  ): Promise<ResultadoGeneracionCuotas> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    const resultado: ResultadoGeneracionCuotas = {
      creadas: 0,
      omitidas: 0,
      advertenciasMorosidad: 0,
      inhabilitados: 0,
      desactivados: 0,
      advertencias: [],
    };

    try {
      // 1. Obtener socios activos con categoria asignada (se ejecuta antes de crear nuevas cuotas)
      const sociosActivos = await queryRunner.manager.find(Socio, {
        where: { estado: 'ACTIVO' },
        relations: ['categoria'],
      });

      // Filtrar socios con categoria NO exenta
      const sociosConCategoria = sociosActivos.filter(
        (s) => s.categoria && !s.categoria.exento,
      );

      // Contar socios exentos (para informacion)
      const sociosExentos = sociosActivos.filter(
        (s) => s.categoria && s.categoria.exento,
      );
      if (sociosExentos.length > 0) {
        resultado.advertencias.push(
          `${sociosExentos.length} socio(s) con categoria exenta (VITALICIO/HONORARIO) omitidos`,
        );
      }

      // 2. Verificar cuotas existentes para el periodo (idempotencia)
      const cuotasExistentes = await queryRunner.manager.find(Cuota, {
        where: { periodo: dto.periodo },
      });

      const sociosConCuotaExistente = new Set(
        cuotasExistentes.map((c) => c.socioId),
      );

      // 3. Crear cuotas para socios sin cuota en el periodo
      for (const socio of sociosConCategoria) {
        if (sociosConCuotaExistente.has(socio.id)) {
          resultado.omitidas++;
          continue;
        }

        const cuota = queryRunner.manager.create(Cuota, {
          socioId: socio.id,
          periodo: dto.periodo,
          monto: socio.categoria!.montoMensual,
          estado: EstadoCuota.PENDIENTE,
        });

        await queryRunner.manager.save(cuota);
        resultado.creadas++;
      }

      // 4. Fase 1: Inhabilitacion para socios con 4+ cuotas pendientes (despues de crear la nueva cuota)
      // Esto asegura que detectamos cuando un socio llega a 4 cuotas pendientes
      const sociosMorosos = await this.identificarSociosMorosos(queryRunner);

      for (const socio of sociosMorosos) {
        await queryRunner.manager.update(Socio, socio.id, {
          estado: 'MOROSO',
        });
        resultado.inhabilitados++;
        resultado.desactivados++;
        resultado.advertencias.push(
          `Socio ${socio.nombre} ${socio.apellido} (ID: ${socio.id}) marcado como MOROSO por morosidad (4+ meses)`,
        );
        await this.notificacionesService.crearNotificacion(
          TipoNotificacion.INHABILITACION_AUTOMATICA,
          socio.id,
          `Socio ${socio.nombre} ${socio.apellido} marcado automaticamente como MOROSO por morosidad.`,
        );
      }

      // 5. Fase 2: Advertencia para socios con EXACTAMENTE 3 cuotas pendientes
      // Esto asegura que enviamos la notificacion cuando tienen exactamente 3 cuotas pendientes
      const sociosConAdvertencia =
        await this.identificarSociosConAdvertenciaMorosidad(queryRunner);

      for (const socio of sociosConAdvertencia) {
        resultado.advertenciasMorosidad++;
        resultado.advertencias.push(
          `Socio ${socio.nombre} ${socio.apellido} (ID: ${socio.id}) adeuda 3 meses. Proximo mes sera inhabilitado.`,
        );
        await this.notificacionesService.crearNotificacion(
          TipoNotificacion.MOROSIDAD_3_MESES,
          socio.id,
          `Socio ${socio.nombre} ${socio.apellido} adeuda 3 meses. El proximo mes sera inhabilitado.`,
        );
      }
      await queryRunner.commitTransaction();
      return resultado;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(
        'Error generando cuotas mensuales',
        error instanceof Error ? error.stack : String(error),
      );
      if (error instanceof CustomError) {
        throw error;
      }
      throw new CustomError(
        ERROR_MESSAGES.ERROR_GENERANDO_CUOTAS,
        500,
        ERROR_CODES.INTERNAL_SERVER_ERROR,
      );
    } finally {
      await queryRunner.release();
    }
  }

  private resolverEstadoTarjetaCentroMes(
    tieneTarjetaCentro: boolean,
    cuota?: {
      estado: EstadoCuota;
      rechazadaTarjetaCentro: boolean;
    },
  ): EstadoTarjetaCentroMes | null {
    if (!tieneTarjetaCentro || !cuota) {
      return null;
    }

    if (cuota.rechazadaTarjetaCentro && cuota.estado === EstadoCuota.PAGADA) {
      return 'TARJETA_RECHAZADA_PAGADA';
    }

    if (cuota.rechazadaTarjetaCentro) {
      return 'TARJETA_RECHAZADA_PENDIENTE';
    }

    if (cuota.estado === EstadoCuota.PAGADA) {
      return 'TARJETA_APROBADA';
    }

    return 'TARJETA_PENDIENTE_RESPUESTA';
  }

  /**
   * Identifica socios con exactamente 3 cuotas pendientes
   */
  private async identificarSociosConAdvertenciaMorosidad(
    queryRunner: import('typeorm').QueryRunner,
  ): Promise<Socio[]> {
    return await queryRunner.manager
      .createQueryBuilder(Socio, 'socio')
      .innerJoin('socio.cuotas', 'cuota')
      .where('socio.estado = :estado', { estado: 'ACTIVO' })
      .andWhere('cuota.estado = :cuotaEstado', {
        cuotaEstado: EstadoCuota.PENDIENTE,
      })
      .groupBy('socio.id')
      .having('COUNT(cuota.id) = :exacto', {
        exacto: CobrosService.UMBRAL_ADVERTENCIA_MOROSIDAD,
      })
      .getMany();
  }

  /**
   * Identifica socios con 4 o mas cuotas pendientes
   */
  private async identificarSociosMorosos(
    queryRunner: import('typeorm').QueryRunner,
  ): Promise<Socio[]> {
    return await queryRunner.manager
      .createQueryBuilder(Socio, 'socio')
      .innerJoin('socio.cuotas', 'cuota')
      .where('cuota.estado = :cuotaEstado', {
        cuotaEstado: EstadoCuota.PENDIENTE,
      })
      .groupBy('socio.id')
      .having('COUNT(cuota.id) >= :umbral', {
        umbral: CobrosService.UMBRAL_INHABILITACION_MOROSIDAD,
      })
      .getMany();
  }

  private async recalcularEstadoSocioPorMorosidad(
    queryRunner: import('typeorm').QueryRunner,
    socioId: number,
  ): Promise<void> {
    const socio = await queryRunner.manager.findOne(Socio, {
      where: { id: socioId },
      select: ['id', 'estado'],
    });

    if (!socio || socio.estado === 'INACTIVO') {
      return;
    }

    const cuotasPendientes = await queryRunner.manager.count(Cuota, {
      where: { socioId, estado: EstadoCuota.PENDIENTE },
    });

    const estadoEsperado =
      cuotasPendientes >= CobrosService.UMBRAL_INHABILITACION_MOROSIDAD
        ? 'MOROSO'
        : 'ACTIVO';

    if (socio.estado !== estadoEsperado) {
      await queryRunner.manager.update(Socio, socioId, {
        estado: estadoEsperado,
      });
    }
  }

  /**
   * Registra el pago de una cuota por ID de cuota
   */
  async registrarPago(
    dto: RegistrarPagoDto,
  ): Promise<{ cuota: Cuota; pago: PagoCuota }> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      let cuota: Cuota | null = null;

      // 1. Buscar la cuota por ID
      cuota = await queryRunner.manager.findOne(Cuota, {
        where: { id: dto.cuotaId },
        relations: ['socio'],
      });

      if (!cuota) {
        throw new CustomError(
          ERROR_MESSAGES.CUOTA_NOT_FOUND,
          404,
          ERROR_CODES.CUOTA_NOT_FOUND,
        );
      }

      // 2. Verificar que la cuota no esté ya pagada
      if (cuota.estado === EstadoCuota.PAGADA) {
        throw new CustomError(
          ERROR_MESSAGES.CUOTA_YA_PAGADA,
          409,
          ERROR_CODES.CUOTA_YA_PAGADA,
        );
      }

      await this.validarMetodoPagoActivo(queryRunner, dto.metodoPagoId);

      const fechaPago = new Date();

      // 3. Crear el registro de pago
      const pago = queryRunner.manager.create(PagoCuota, {
        cuotaId: cuota.id,
        montoPagado: cuota.monto,
        metodoPagoId: dto.metodoPagoId,
        observaciones: dto.observaciones,
        fechaPago,
        fechaEmisionCuota: cuota.createdAt,
      });

      await queryRunner.manager.save(pago);

      // 4. Actualizar el estado de la cuota
      cuota.estado = EstadoCuota.PAGADA;
      cuota.fechaPago = fechaPago;
      await queryRunner.manager.save(cuota);

      await this.recalcularEstadoSocioPorMorosidad(
        queryRunner,
        cuota.socioId,
      );

      await queryRunner.commitTransaction();
      return { cuota, pago };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(
        'Error registrando pago',
        error instanceof Error ? error.stack : String(error),
      );
      const fkError = this.mapearErrorIntegridadReferencial(error);
      if (fkError) {
        throw fkError;
      }
      if (error instanceof CustomError) {
        throw error;
      }
      throw new CustomError(
        ERROR_MESSAGES.ERROR_REGISTRANDO_PAGO,
        500,
        ERROR_CODES.INTERNAL_SERVER_ERROR,
      );
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Registra el pago de múltiples cuotas en una sola transacción
   */
  async registrarPagoMultiple(
    dto: RegistrarPagoMultipleDto,
  ): Promise<{ pagosExitosos: number; errores: string[] }> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    const resultado = {
      pagosExitosos: 0,
      errores: [] as string[],
    };

    try {
      const cuotaIdsUnicos = Array.from(new Set(dto.cuotaIds));

      await this.validarMetodoPagoActivo(queryRunner, dto.metodoPagoId);

      // 1. Buscar todas las cuotas por ID
      const cuotas = await queryRunner.manager.find(Cuota, {
        where: { id: In(cuotaIdsUnicos) },
        relations: ['socio'],
      });

      const cuotasMap = new Map(cuotas.map((c) => [c.id, c]));
      const sociosConEstadoARecalcular = new Set<number>();

      // 2. Procesar cada cuota
      for (const cuotaId of cuotaIdsUnicos) {
        const cuota = cuotasMap.get(cuotaId);

        if (!cuota) {
          resultado.errores.push(`${cuotaId}: cuota no encontrada`);
          continue;
        }

        if (cuota.estado === EstadoCuota.PAGADA) {
          resultado.errores.push(`${cuotaId}: cuota ya pagada`);
          continue;
        }

        const fechaPago = new Date();

        // Crear el pago
        const pago = queryRunner.manager.create(PagoCuota, {
          cuotaId: cuota.id,
          montoPagado: cuota.monto,
          metodoPagoId: dto.metodoPagoId,
          observaciones: dto.observaciones,
          fechaPago,
          fechaEmisionCuota: cuota.createdAt,
        });

        await queryRunner.manager.save(pago);

        // Actualizar la cuota
        cuota.estado = EstadoCuota.PAGADA;
        cuota.fechaPago = fechaPago;
        await queryRunner.manager.save(cuota);
        sociosConEstadoARecalcular.add(cuota.socioId);

        resultado.pagosExitosos++;
      }

      for (const socioId of sociosConEstadoARecalcular) {
        await this.recalcularEstadoSocioPorMorosidad(queryRunner, socioId);
      }

      await queryRunner.commitTransaction();
      return resultado;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(
        'Error en pago múltiple',
        error instanceof Error ? error.stack : String(error),
      );
      const fkError = this.mapearErrorIntegridadReferencial(error);
      if (fkError) {
        throw fkError;
      }
      if (error instanceof CustomError) {
        throw error;
      }
      throw new CustomError(
        ERROR_MESSAGES.ERROR_REGISTRANDO_PAGO,
        500,
        ERROR_CODES.INTERNAL_SERVER_ERROR,
      );
    } finally {
      await queryRunner.release();
    }
  }

  async registrarOperacionCobro(dto: RegistrarOperacionCobroDto) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      if (dto.idempotencyKey) {
        const operacionExistente = await queryRunner.manager.findOne(
          CobroOperacion,
          {
            where: { idempotencyKey: dto.idempotencyKey },
            relations: ['lineas'],
          },
        );

        if (operacionExistente) {
          return operacionExistente;
        }
      }

      const cuotaIdsUnicos = dto.cuotaIds ? Array.from(new Set(dto.cuotaIds)) : [];
      const cuotas = cuotaIdsUnicos.length > 0 
        ? await queryRunner.manager.find(Cuota, {
            where: { id: In(cuotaIdsUnicos), socioId: dto.socioId },
          })
        : [];

      if (cuotaIdsUnicos.length > 0 && cuotas.length !== cuotaIdsUnicos.length) {
        throw new CustomError(
          'Una o más cuotas seleccionadas no existen o no pertenecen al socio',
          400,
          ERROR_CODES.CUOTA_NOT_FOUND,
        );
      }

      const cuotasPagadas = cuotas.filter(
        (c) => c.estado === EstadoCuota.PAGADA,
      );
      if (cuotasPagadas.length > 0) {
        throw new CustomError(
          ERROR_MESSAGES.CUOTA_YA_PAGADA,
          409,
          ERROR_CODES.CUOTA_YA_PAGADA,
        );
      }

      let cobradorIdOperacion = dto.cobradorId;

      if (dto.actorCobro === ActorCobro.COBRADOR) {
        if (!dto.cobradorId) {
          throw new CustomError(
            'El cobrador es obligatorio cuando actorCobro es COBRADOR',
            400,
            ERROR_CODES.VALIDATION_ERROR,
          );
        }
      }

      const totalCuotas = cuotas.reduce(
        (acc, cuota) => acc + Number(cuota.monto),
        0,
      );
      const totalConceptos = (dto.conceptos ?? []).reduce(
        (acc, concepto) => acc + Number(concepto.monto),
        0,
      );
      const totalCalculado = this.toCents(totalCuotas + totalConceptos);
      const totalInformado = this.toCents(Number(dto.total));

      if (totalCalculado !== totalInformado) {
        throw new CustomError(
          'El total informado no coincide con la suma de cuotas y conceptos',
          400,
          ERROR_CODES.VALIDATION_ERROR,
        );
      }

      const pagosOperacion =
        dto.pagos && dto.pagos.length > 0
          ? dto.pagos
          : dto.metodoPagoId
            ? [{ metodoPagoId: dto.metodoPagoId, monto: this.fromCents(totalInformado) }]
            : [];

      if (pagosOperacion.length === 0) {
        throw new CustomError(
          'Debe indicar al menos un método de pago',
          400,
          ERROR_CODES.VALIDATION_ERROR,
        );
      }

      if (pagosOperacion.length > 2) {
        throw new CustomError(
          'Solo se permiten hasta dos métodos de pago',
          400,
          ERROR_CODES.VALIDATION_ERROR,
        );
      }

      const metodosUnicos = new Set(pagosOperacion.map((pago) => pago.metodoPagoId));
      if (metodosUnicos.size !== pagosOperacion.length) {
        throw new CustomError(
          'No se puede repetir el mismo método de pago',
          400,
          ERROR_CODES.VALIDATION_ERROR,
        );
      }

      const totalPagosCents = this.toCents(
        pagosOperacion.reduce((acc, pago) => acc + Number(pago.monto), 0),
      );
      if (totalPagosCents !== totalInformado) {
        throw new CustomError(
          'La suma de importes por método debe coincidir con el total informado',
          400,
          ERROR_CODES.VALIDATION_ERROR,
        );
      }

      const operacion = queryRunner.manager.create(CobroOperacion, {
        socioId: dto.socioId,
        metodoPagoId: pagosOperacion[0].metodoPagoId,
        actorCobro: dto.actorCobro,
        origenCobro: dto.origenCobro,
        cobradorId:
          dto.actorCobro === ActorCobro.COBRADOR ? cobradorIdOperacion : undefined,
        idempotencyKey: dto.idempotencyKey,
        total: this.fromCents(totalInformado),
        referencia: dto.referencia,
        observaciones: dto.observaciones,
      });

      const operacionGuardada = await queryRunner.manager.save(operacion);

      if (
        dto.actorCobro === ActorCobro.COBRADOR &&
        typeof cobradorIdOperacion === 'number'
      ) {
        const fechaOperacion = operacionGuardada.fechaHoraServidor ?? new Date();
        const porcentajeComision = await this.obtenerPorcentajeComisionVigente(
          queryRunner,
          cobradorIdOperacion,
          fechaOperacion,
        );
        const montoComision = this.fromCents(
          this.toCents(this.fromCents(totalInformado) * porcentajeComision),
        );

        const movimientoComision = queryRunner.manager.create(
          CobradorCuentaCorrienteMovimiento,
          {
            cobradorId: cobradorIdOperacion,
            tipoMovimiento: TipoMovimientoCobrador.COMISION_GENERADA,
            monto: montoComision,
            cobroOperacionId: operacionGuardada.id,
            referencia: dto.referencia,
            observacion: `Comision ${Number(porcentajeComision * 100).toFixed(2)}% generada por operacion #${operacionGuardada.id}`,
          },
        );

        await queryRunner.manager.save(movimientoComision);
      }

      const fechaPago = new Date();
      const lineas: CobroOperacionLinea[] = [];
      const cuotasOrdenadas = [...cuotas].sort((a, b) =>
        a.periodo.localeCompare(b.periodo),
      );
      const pagosRestantes = pagosOperacion.map((pago) => ({
        metodoPagoId: pago.metodoPagoId,
        cents: this.toCents(Number(pago.monto)),
      }));

      for (const cuota of cuotasOrdenadas) {
        lineas.push(
          queryRunner.manager.create(CobroOperacionLinea, {
            operacionId: operacionGuardada.id,
            tipoLinea: TipoLineaCobro.CUOTA,
            cuotaId: cuota.id,
            monto: cuota.monto,
          }),
        );

        let restanteCuotaCents = this.toCents(Number(cuota.monto));

        for (const pagoMetodo of pagosRestantes) {
          if (restanteCuotaCents <= 0) {
            break;
          }

          if (pagoMetodo.cents <= 0) {
            continue;
          }

          const aplicadoCents = Math.min(restanteCuotaCents, pagoMetodo.cents);
          if (aplicadoCents <= 0) {
            continue;
          }

          const pago = queryRunner.manager.create(PagoCuota, {
            cuotaId: cuota.id,
            montoPagado: this.fromCents(aplicadoCents),
            metodoPagoId: pagoMetodo.metodoPagoId,
            observaciones: dto.observaciones,
            fechaPago,
            fechaEmisionCuota: cuota.createdAt,
            operacionCobroId: operacionGuardada.id,
            cobradorId:
              dto.actorCobro === ActorCobro.COBRADOR
                ? cobradorIdOperacion
                : undefined,
          });
          await queryRunner.manager.save(pago);

          restanteCuotaCents -= aplicadoCents;
          pagoMetodo.cents -= aplicadoCents;
        }

        if (restanteCuotaCents !== 0) {
          throw new CustomError(
            `No fue posible distribuir completamente el pago para la cuota ${cuota.id}`,
            400,
            ERROR_CODES.VALIDATION_ERROR,
          );
        }

        cuota.estado = EstadoCuota.PAGADA;
        cuota.fechaPago = fechaPago;
        await queryRunner.manager.save(cuota);
      }

      await this.recalcularEstadoSocioPorMorosidad(queryRunner, dto.socioId);

      const restantePagosCents = pagosRestantes.reduce(
        (acc, pago) => acc + pago.cents,
        0,
      );
      const totalConceptosCents = this.toCents(totalConceptos);
      if (restantePagosCents !== totalConceptosCents) {
        throw new CustomError(
          'La distribución por método no coincide con la composición de cuotas y conceptos',
          400,
          ERROR_CODES.VALIDATION_ERROR,
        );
      }

      for (const concepto of dto.conceptos ?? []) {
        lineas.push(
          queryRunner.manager.create(CobroOperacionLinea, {
            operacionId: operacionGuardada.id,
            tipoLinea: TipoLineaCobro.CONCEPTO,
            concepto: concepto.concepto,
            descripcion: concepto.descripcion,
            monto: concepto.monto,
          }),
        );
      }

      await queryRunner.manager.save(lineas);
      await queryRunner.commitTransaction();

      const operacionCompleta = await queryRunner.manager.findOne(CobroOperacion, {
        where: { id: operacionGuardada.id },
        relations: ['lineas', 'socio', 'metodoPago'],
      });

      return operacionCompleta;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      const fkError = this.mapearErrorIntegridadReferencial(error);
      if (fkError) {
        throw fkError;
      }
      if (error instanceof CustomError) {
        throw error;
      }
      this.logger.error(
        'Error registrando operación de cobro',
        error instanceof Error ? error.stack : String(error),
      );
      throw new CustomError(
        ERROR_MESSAGES.ERROR_REGISTRANDO_PAGO,
        500,
        ERROR_CODES.INTERNAL_SERVER_ERROR,
      );
    } finally {
      await queryRunner.release();
    }
  }

  async registrarCobroGrupal(dto: RegistrarCobroGrupalDto): Promise<CobroOperacion[]> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const cobrosConCuotas = dto.cobros.map((cobro) => ({
        ...cobro,
        cuotaIds: cobro.cuotaIds ? Array.from(new Set(cobro.cuotaIds)) : [],
      }));
      const socioIds = cobrosConCuotas.map((cobro) => cobro.socioId);
      const sociosUnicos = new Set(socioIds);

      if (sociosUnicos.size !== socioIds.length) {
        throw new CustomError(
          'No se puede repetir el mismo socio en un cobro grupal',
          400,
          ERROR_CODES.VALIDATION_ERROR,
        );
      }

      const pagosOperacion = dto.pagos;
      if (pagosOperacion.length === 0) {
        throw new CustomError(
          'Debe indicar al menos un metodo de pago',
          400,
          ERROR_CODES.VALIDATION_ERROR,
        );
      }

      if (pagosOperacion.length > 2) {
        throw new CustomError(
          'Solo se permiten hasta dos metodos de pago',
          400,
          ERROR_CODES.VALIDATION_ERROR,
        );
      }

      const metodosUnicos = new Set(pagosOperacion.map((pago) => pago.metodoPagoId));
      if (metodosUnicos.size !== pagosOperacion.length) {
        throw new CustomError(
          'No se puede repetir el mismo metodo de pago',
          400,
          ERROR_CODES.VALIDATION_ERROR,
        );
      }

      if (dto.actorCobro === ActorCobro.COBRADOR && !dto.cobradorId) {
        throw new CustomError(
          'El cobrador es obligatorio cuando actorCobro es COBRADOR',
          400,
          ERROR_CODES.VALIDATION_ERROR,
        );
      }

      const idempotencyKeysPorSocio = dto.idempotencyKey
        ? cobrosConCuotas.map((cobro) => `${dto.idempotencyKey}:${cobro.socioId}`)
        : [];

      if (idempotencyKeysPorSocio.length > 0) {
        const operacionesExistentes = await queryRunner.manager.find(CobroOperacion, {
          where: { idempotencyKey: In(idempotencyKeysPorSocio) },
          relations: ['lineas', 'socio', 'metodoPago'],
          order: { id: 'ASC' },
        });

        if (operacionesExistentes.length > 0) {
          if (operacionesExistentes.length !== idempotencyKeysPorSocio.length) {
            throw new CustomError(
              'La clave de idempotencia se encuentra en estado inconsistente',
              409,
              ERROR_CODES.VALIDATION_ERROR,
            );
          }

          const mapaPorKey = new Map(
            operacionesExistentes
              .filter((operacion) => Boolean(operacion.idempotencyKey))
              .map((operacion) => [operacion.idempotencyKey!, operacion]),
          );

          return idempotencyKeysPorSocio.map((key) => {
            const operacion = mapaPorKey.get(key);
            if (!operacion) {
              throw new CustomError(
                'La clave de idempotencia no coincide con el grupo informado',
                409,
                ERROR_CODES.VALIDATION_ERROR,
              );
            }
            return operacion;
          });
        }
      }

      const totalCuotasCentsPorSocio = new Map<number, number>();
      const totalConceptosCentsPorSocio = new Map<number, number>();
      const cuotasPorSocio = new Map<number, Cuota[]>();
      let totalCuotasCents = 0;
      let totalConceptosCents = 0;

      for (const cobro of cobrosConCuotas) {
        const cuotas =
          cobro.cuotaIds.length > 0
            ? await queryRunner.manager.find(Cuota, {
                where: { id: In(cobro.cuotaIds), socioId: cobro.socioId },
              })
            : [];

        if (cobro.cuotaIds.length > 0 && cuotas.length !== cobro.cuotaIds.length) {
          throw new CustomError(
            'Una o mas cuotas seleccionadas no existen o no pertenecen al socio',
            400,
            ERROR_CODES.CUOTA_NOT_FOUND,
          );
        }

        const cuotasNoPendientes = cuotas.filter(
          (cuota) => cuota.estado !== EstadoCuota.PENDIENTE,
        );
        if (cuotasNoPendientes.length > 0) {
          throw new CustomError(
            'No se puede registrar el cobro porque una o mas cuotas no estan pendientes',
            409,
            ERROR_CODES.CUOTA_YA_PAGADA,
          );
        }

        cuotas.sort((a, b) => a.periodo.localeCompare(b.periodo));
        cuotasPorSocio.set(cobro.socioId, cuotas);

        const totalCuotasSocioCents = this.toCents(
          cuotas.reduce((acc, cuota) => acc + Number(cuota.monto), 0),
        );
        const totalConceptosSocioCents = this.toCents(
          (cobro.conceptos ?? []).reduce(
            (acc, concepto) => acc + Number(concepto.monto),
            0,
          ),
        );

        totalCuotasCentsPorSocio.set(cobro.socioId, totalCuotasSocioCents);
        totalConceptosCentsPorSocio.set(cobro.socioId, totalConceptosSocioCents);
        totalCuotasCents += totalCuotasSocioCents;
        totalConceptosCents += totalConceptosSocioCents;
      }

      const totalCalculadoCents = totalCuotasCents + totalConceptosCents;
      const totalInformadoCents = this.toCents(Number(dto.total));
      if (totalCalculadoCents !== totalInformadoCents) {
        throw new CustomError(
          'El total informado no coincide con la suma de cuotas y conceptos',
          400,
          ERROR_CODES.VALIDATION_ERROR,
        );
      }

      const totalPagosCents = this.toCents(
        pagosOperacion.reduce((acc, pago) => acc + Number(pago.monto), 0),
      );
      if (totalPagosCents !== totalInformadoCents) {
        throw new CustomError(
          'La suma de importes por metodo debe coincidir con el total informado',
          400,
          ERROR_CODES.VALIDATION_ERROR,
        );
      }

      const pagosRestantes = pagosOperacion.map((pago) => ({
        metodoPagoId: pago.metodoPagoId,
        cents: this.toCents(Number(pago.monto)),
      }));

      const fechaPago = new Date();
      const operacionesCreadas: CobroOperacion[] = [];
      const lineasPendientes: CobroOperacionLinea[] = [];

      for (const cobro of cobrosConCuotas) {
        const totalSocioCents =
          (totalCuotasCentsPorSocio.get(cobro.socioId) ?? 0) +
          (totalConceptosCentsPorSocio.get(cobro.socioId) ?? 0);

        const operacion = queryRunner.manager.create(CobroOperacion, {
          socioId: cobro.socioId,
          metodoPagoId: pagosOperacion[0].metodoPagoId,
          actorCobro: dto.actorCobro,
          origenCobro: dto.origenCobro,
          cobradorId:
            dto.actorCobro === ActorCobro.COBRADOR ? dto.cobradorId : undefined,
          idempotencyKey: dto.idempotencyKey
            ? `${dto.idempotencyKey}:${cobro.socioId}`
            : undefined,
          total: this.fromCents(totalSocioCents),
          referencia: dto.installationId,
          observaciones: `Cobro grupal familiar`,
        });

        const operacionGuardada = await queryRunner.manager.save(operacion);
        operacionesCreadas.push(operacionGuardada);

        const cuotasSocio = cuotasPorSocio.get(cobro.socioId) ?? [];
        for (const cuota of cuotasSocio) {
          lineasPendientes.push(
            queryRunner.manager.create(CobroOperacionLinea, {
              operacionId: operacionGuardada.id,
              tipoLinea: TipoLineaCobro.CUOTA,
              cuotaId: cuota.id,
              monto: cuota.monto,
            }),
          );

          let restanteCuotaCents = this.toCents(Number(cuota.monto));
          for (const pagoMetodo of pagosRestantes) {
            if (restanteCuotaCents <= 0) {
              break;
            }

            if (pagoMetodo.cents <= 0) {
              continue;
            }

            const aplicadoCents = Math.min(restanteCuotaCents, pagoMetodo.cents);
            if (aplicadoCents <= 0) {
              continue;
            }

            const pago = queryRunner.manager.create(PagoCuota, {
              cuotaId: cuota.id,
              montoPagado: this.fromCents(aplicadoCents),
              metodoPagoId: pagoMetodo.metodoPagoId,
              observaciones: 'Cobro grupal familiar',
              fechaPago,
              fechaEmisionCuota: cuota.createdAt,
              operacionCobroId: operacionGuardada.id,
              cobradorId:
                dto.actorCobro === ActorCobro.COBRADOR ? dto.cobradorId : undefined,
            });
            await queryRunner.manager.save(pago);

            restanteCuotaCents -= aplicadoCents;
            pagoMetodo.cents -= aplicadoCents;
          }

          if (restanteCuotaCents !== 0) {
            throw new CustomError(
              `No fue posible distribuir completamente el pago para la cuota ${cuota.id}`,
              400,
              ERROR_CODES.VALIDATION_ERROR,
            );
          }

          cuota.estado = EstadoCuota.PAGADA;
          cuota.fechaPago = fechaPago;
          await queryRunner.manager.save(cuota);
        }

        for (const concepto of cobro.conceptos ?? []) {
          lineasPendientes.push(
            queryRunner.manager.create(CobroOperacionLinea, {
              operacionId: operacionGuardada.id,
              tipoLinea: TipoLineaCobro.CONCEPTO,
              concepto: concepto.concepto,
              descripcion: concepto.descripcion,
              monto: concepto.monto,
            }),
          );
        }

        await this.recalcularEstadoSocioPorMorosidad(queryRunner, cobro.socioId);
      }

      const restantePagosCents = pagosRestantes.reduce(
        (acc, pago) => acc + pago.cents,
        0,
      );
      if (restantePagosCents !== totalConceptosCents) {
        throw new CustomError(
          'La distribucion por metodo no coincide con la composicion de cuotas y conceptos',
          400,
          ERROR_CODES.VALIDATION_ERROR,
        );
      }

      if (
        dto.actorCobro === ActorCobro.COBRADOR &&
        typeof dto.cobradorId === 'number' &&
        operacionesCreadas.length > 0
      ) {
        const fechaOperacion = operacionesCreadas[0].fechaHoraServidor ?? new Date();
        const porcentajeComision = await this.obtenerPorcentajeComisionVigente(
          queryRunner,
          dto.cobradorId,
          fechaOperacion,
        );
        const montoComision = this.fromCents(
          this.toCents(this.fromCents(totalInformadoCents) * porcentajeComision),
        );

        const movimientoComision = queryRunner.manager.create(
          CobradorCuentaCorrienteMovimiento,
          {
            cobradorId: dto.cobradorId,
            tipoMovimiento: TipoMovimientoCobrador.COMISION_GENERADA,
            monto: montoComision,
            cobroOperacionId: operacionesCreadas[0].id,
            referencia: dto.installationId,
            observacion: `Comision ${Number(porcentajeComision * 100).toFixed(2)}% generada por cobro grupal`,
          },
        );

        await queryRunner.manager.save(movimientoComision);
      }

      if (lineasPendientes.length > 0) {
        await queryRunner.manager.save(lineasPendientes);
      }

      await queryRunner.commitTransaction();

      const operacionesCompletas = await queryRunner.manager.find(CobroOperacion, {
        where: { id: In(operacionesCreadas.map((operacion) => operacion.id)) },
        relations: ['lineas', 'socio', 'metodoPago'],
      });

      const mapaOperaciones = new Map(operacionesCompletas.map((op) => [op.id, op]));
      return operacionesCreadas.map((operacion) => mapaOperaciones.get(operacion.id) ?? operacion);
    } catch (error) {
      await queryRunner.rollbackTransaction();
      const fkError = this.mapearErrorIntegridadReferencial(error);
      if (fkError) {
        throw fkError;
      }
      if (error instanceof CustomError) {
        throw error;
      }
      this.logger.error(
        'Error registrando cobro grupal',
        error instanceof Error ? error.stack : String(error),
      );
      throw new CustomError(
        ERROR_MESSAGES.ERROR_REGISTRANDO_PAGO,
        500,
        ERROR_CODES.INTERNAL_SERVER_ERROR,
      );
    } finally {
      await queryRunner.release();
    }
  }

  async registrarPagoCuotasSeleccionadas(
    dto: RegistrarPagoCuotasSeleccionadasDto,
  ): Promise<ResultadoPagoCuotasSeleccionadas> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const cuotaIdsUnicos = Array.from(new Set(dto.cuotaIds));
      const cuotas = await queryRunner.manager.find(Cuota, {
        where: { id: In(cuotaIdsUnicos), socioId: dto.socioId },
        relations: ['socio'],
      });

      if (cuotas.length !== cuotaIdsUnicos.length) {
        throw new CustomError(
          'Una o mas cuotas seleccionadas no existen o no pertenecen al socio',
          400,
          ERROR_CODES.CUOTA_NOT_FOUND,
        );
      }

      const cuotasPagadas = cuotas.filter(
        (cuota) => cuota.estado === EstadoCuota.PAGADA,
      );
      if (cuotasPagadas.length > 0) {
        throw new CustomError(
          'No se puede registrar el pago porque una o mas cuotas ya estan pagadas',
          409,
          ERROR_CODES.CUOTA_YA_PAGADA,
        );
      }

      const metodosUnicos = new Set(dto.pagos.map((p) => p.metodoPagoId));
      if (metodosUnicos.size !== dto.pagos.length) {
        throw new CustomError(
          'No se puede repetir el mismo metodo de pago',
          400,
          ERROR_CODES.VALIDATION_ERROR,
        );
      }

      await this.validarMetodosPagoActivos(queryRunner, dto.pagos);

      const totalCuotasCents = this.toCents(
        cuotas.reduce((acc, cuota) => acc + Number(cuota.monto), 0),
      );
      const totalPagosCents = this.toCents(
        dto.pagos.reduce((acc, pago) => acc + Number(pago.monto), 0),
      );

      if (totalCuotasCents !== totalPagosCents) {
        throw new CustomError(
          'La suma de importes por metodo debe coincidir con el total de cuotas seleccionadas',
          400,
          ERROR_CODES.VALIDATION_ERROR,
        );
      }

      const fechaPago = new Date();
      const cuotasOrdenadas = [...cuotas].sort((a, b) =>
        a.periodo.localeCompare(b.periodo),
      );
      const pagosRestantes = dto.pagos.map((pago) => ({
        metodoPagoId: pago.metodoPagoId,
        cents: this.toCents(Number(pago.monto)),
      }));

      let pagosGenerados = 0;

      for (const cuota of cuotasOrdenadas) {
        let restanteCuotaCents = this.toCents(Number(cuota.monto));

        for (const pagoMetodo of pagosRestantes) {
          if (restanteCuotaCents <= 0) {
            break;
          }

          if (pagoMetodo.cents <= 0) {
            continue;
          }

          const aplicadoCents = Math.min(restanteCuotaCents, pagoMetodo.cents);
          if (aplicadoCents <= 0) {
            continue;
          }

          const pago = queryRunner.manager.create(PagoCuota, {
            cuotaId: cuota.id,
            montoPagado: this.fromCents(aplicadoCents),
            metodoPagoId: pagoMetodo.metodoPagoId,
            observaciones: dto.observaciones,
            fechaPago,
            fechaEmisionCuota: cuota.createdAt,
          });

          await queryRunner.manager.save(pago);
          pagosGenerados++;
          restanteCuotaCents -= aplicadoCents;
          pagoMetodo.cents -= aplicadoCents;
        }

        if (restanteCuotaCents !== 0) {
          throw new CustomError(
            `No fue posible distribuir completamente el pago para la cuota ${cuota.id}`,
            400,
            ERROR_CODES.VALIDATION_ERROR,
          );
        }

        cuota.estado = EstadoCuota.PAGADA;
        cuota.fechaPago = fechaPago;
        cuota.rechazadaTarjetaCentro = false;
        cuota.fechaRechazoTarjetaCentro = null;
        await queryRunner.manager.save(cuota);
      }

      await this.recalcularEstadoSocioPorMorosidad(queryRunner, dto.socioId);

      if (pagosRestantes.some((p) => p.cents !== 0)) {
        throw new CustomError(
          'La distribucion de importes quedo incompleta',
          400,
          ERROR_CODES.VALIDATION_ERROR,
        );
      }

      await queryRunner.commitTransaction();

      return {
        cuotasPagadas: cuotasOrdenadas.length,
        pagosGenerados,
        totalPagado: this.fromCents(totalCuotasCents),
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(
        'Error registrando pago de cuotas seleccionadas',
        error instanceof Error ? error.stack : String(error),
      );

      const fkError = this.mapearErrorIntegridadReferencial(error);
      if (fkError) {
        throw fkError;
      }

      if (error instanceof CustomError) {
        throw error;
      }

      throw new CustomError(
        ERROR_MESSAGES.ERROR_REGISTRANDO_PAGO,
        500,
        ERROR_CODES.INTERNAL_SERVER_ERROR,
      );
    } finally {
      await queryRunner.release();
    }
  }

  async obtenerCuotasParaReciboMultiple(
    dto: ReciboMultipleCuotasDto,
  ): Promise<Cuota[]> {
    const cuotaIdsUnicos = Array.from(new Set(dto.cuotaIds));
    const cuotas = await this.cuotaRepository.find({
      where: { id: In(cuotaIdsUnicos), socioId: dto.socioId },
      relations: ['socio', 'socio.grupoFamiliar'],
      order: { periodo: 'ASC' },
    });

    if (cuotas.length !== cuotaIdsUnicos.length) {
      throw new CustomError(
        'Una o mas cuotas seleccionadas no existen o no pertenecen al socio',
        404,
        ERROR_CODES.CUOTA_NOT_FOUND,
      );
    }

    return cuotas;
  }

  private toCents(value: number): number {
    return Math.round(value * 100);
  }

  private async validarMetodoPagoActivo(
    queryRunner: import('typeorm').QueryRunner,
    metodoPagoId: number,
  ): Promise<void> {
    const metodoPago = await queryRunner.manager.findOne(MetodoPago, {
      where: { id: metodoPagoId, activo: true },
      select: ['id'],
    });

    if (!metodoPago) {
      throw new CustomError(
        'El metodo de pago seleccionado no existe o esta inactivo',
        400,
        ERROR_CODES.VALIDATION_ERROR,
      );
    }
  }

  private async validarMetodosPagoActivos(
    queryRunner: import('typeorm').QueryRunner,
    pagos: Pick<PagoMetodoMontoDto, 'metodoPagoId'>[],
  ): Promise<void> {
    const metodoIds = Array.from(new Set(pagos.map((pago) => pago.metodoPagoId)));

    if (metodoIds.length === 0) {
      return;
    }

    const metodosActivos = await queryRunner.manager.find(MetodoPago, {
      where: { id: In(metodoIds), activo: true },
      select: ['id'],
    });

    if (metodosActivos.length !== metodoIds.length) {
      throw new CustomError(
        'Uno o mas metodos de pago no existen o estan inactivos',
        400,
        ERROR_CODES.VALIDATION_ERROR,
      );
    }
  }

  private mapearErrorIntegridadReferencial(error: unknown): CustomError | null {
    if (!(error instanceof QueryFailedError)) {
      return null;
    }

    const driverError = error.driverError as {
      code?: string;
      detail?: string;
      constraint?: string;
    };

    if (driverError?.code !== '23503') {
      return null;
    }

    const detail = (driverError.detail ?? '').toLowerCase();
    const constraint = driverError.constraint ?? '';
    const esMetodoPago =
      constraint === 'FK_9630b53650ed85fda8929f123ae' ||
      detail.includes('(id_metodo_pago)');

    if (esMetodoPago) {
      return new CustomError(
        'El metodo de pago seleccionado no existe o esta inactivo',
        400,
        ERROR_CODES.VALIDATION_ERROR,
      );
    }

    return new CustomError(
      'Error de integridad referencial al registrar el pago',
      400,
      ERROR_CODES.VALIDATION_ERROR,
    );
  }

  private fromCents(value: number): number {
    return Number((value / 100).toFixed(2));
  }

  private async obtenerPorcentajeComisionVigente(
    queryRunner: import('typeorm').QueryRunner,
    cobradorId: number,
    fechaOperacion: Date,
  ): Promise<number> {
    const configuraciones = await queryRunner.manager.find(CobradorComisionConfig, {
      where: { cobradorId },
      order: { vigenteDesde: 'ASC' },
    });

    const configVigente = [...configuraciones]
      .reverse()
      .find((config) => config.vigenteDesde <= fechaOperacion);

    return normalizeComisionPorcentaje(Number(configVigente?.porcentaje ?? 0));
  }

  async procesarResultadosTarjetaCentro(
    dto: ProcesarResultadosTarjetaCentroDto,
  ): Promise<ResultadoProcesamientoTarjetaCentro> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    const resultado: ResultadoProcesamientoTarjetaCentro = {
      procesados: 0,
      aprobados: 0,
      rechazados: 0,
      errores: [],
    };
    const sociosConEstadoARecalcular = new Set<number>();

    try {
      const cuotaIds = dto.resultados.map((item) => item.cuotaId);
      const cuotas = await queryRunner.manager.find(Cuota, {
        where: { id: In(cuotaIds) },
        relations: ['socio'],
      });

      const cuotasMap = new Map(cuotas.map((cuota) => [cuota.id, cuota]));

      for (const item of dto.resultados) {
        const cuota = cuotasMap.get(item.cuotaId);

        if (!cuota) {
          resultado.errores.push(`Cuota ${item.cuotaId}: no encontrada`);
          continue;
        }

        if (item.aprobada) {
          const aprobada = await this.procesarCuotaTarjetaCentroAprobada(
            queryRunner,
            cuota,
            item,
          );

          if (!aprobada) {
            resultado.errores.push(`Cuota ${item.cuotaId}: ya estaba pagada`);
            continue;
          }

          resultado.procesados++;
          resultado.aprobados++;
          sociosConEstadoARecalcular.add(cuota.socioId);
          continue;
        }

        const rechazada = await this.procesarCuotaTarjetaCentroRechazada(
          queryRunner,
          cuota,
        );
        if (!rechazada) {
          resultado.errores.push(
            `Cuota ${item.cuotaId}: no puede rechazarse porque ya está pagada`,
          );
          continue;
        }

        resultado.procesados++;
        resultado.rechazados++;
        sociosConEstadoARecalcular.add(cuota.socioId);
      }

      for (const socioId of sociosConEstadoARecalcular) {
        await this.recalcularEstadoSocioPorMorosidad(queryRunner, socioId);
      }

      await queryRunner.commitTransaction();
      return resultado;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(
        'Error procesando resultados de tarjeta del centro',
        error instanceof Error ? error.stack : String(error),
      );

      if (error instanceof CustomError) {
        throw error;
      }

      throw new CustomError(
        ERROR_MESSAGES.ERROR_REGISTRANDO_PAGO,
        500,
        ERROR_CODES.INTERNAL_SERVER_ERROR,
      );
    } finally {
      await queryRunner.release();
    }
  }

  private async procesarCuotaTarjetaCentroAprobada(
    queryRunner: import('typeorm').QueryRunner,
    cuota: Cuota,
    item: TarjetaCentroResultadoDto,
  ): Promise<boolean> {
    if (cuota.estado === EstadoCuota.PAGADA) {
      return false;
    }

    const metodoTransferencia = await queryRunner.manager.findOne(MetodoPago, {
      where: { nombre: 'TRANSFERENCIA' },
      select: ['id', 'activo'],
    });

    if (!metodoTransferencia) {
      throw new CustomError(
        'No se encontró el método de pago TRANSFERENCIA',
        400,
        ERROR_CODES.VALIDATION_ERROR,
      );
    }

    if (!metodoTransferencia.activo) {
      this.logger.warn(
        'El método de pago TRANSFERENCIA está inactivo, se utiliza igualmente para registrar pagos aprobados de Tarjeta del Centro.',
      );
    }

    const fechaPago = new Date();
    const pago = queryRunner.manager.create(PagoCuota, {
      cuotaId: cuota.id,
      montoPagado: cuota.monto,
      metodoPagoId: metodoTransferencia.id,
      observaciones:
        item.observaciones?.trim() || 'Aprobada por Tarjeta del Centro',
      fechaPago,
      fechaEmisionCuota: cuota.createdAt,
    });

    await queryRunner.manager.save(pago);

    cuota.estado = EstadoCuota.PAGADA;
    cuota.fechaPago = fechaPago;
    cuota.rechazadaTarjetaCentro = false;
    cuota.fechaRechazoTarjetaCentro = null;
    await queryRunner.manager.save(cuota);
    return true;
  }

  private async procesarCuotaTarjetaCentroRechazada(
    queryRunner: import('typeorm').QueryRunner,
    cuota: Cuota,
  ): Promise<boolean> {
    if (cuota.estado === EstadoCuota.PAGADA) {
      return false;
    }

    cuota.rechazadaTarjetaCentro = true;
    cuota.fechaRechazoTarjetaCentro = new Date();
    await queryRunner.manager.save(cuota);
    return true;
  }

  /**
   * Obtiene la cuenta corriente de un socio
   */
  async obtenerCuentaCorriente(
    socioId: number,
    anio?: number,
  ): Promise<CuentaCorriente> {
    const socio = await this.socioRepository.findOne({
      where: { id: socioId },
    });

    if (!socio) {
      throw new CustomError(
        ERROR_MESSAGES.SOCIO_NOT_FOUND,
        404,
        ERROR_CODES.SOCIO_NOT_FOUND,
      );
    }

    const cuotasQuery = this.cuotaRepository
      .createQueryBuilder('cuota')
      .where('cuota.socioId = :socioId', { socioId });

    if (typeof anio === 'number' && Number.isFinite(anio)) {
      cuotasQuery.andWhere('cuota.periodo LIKE :periodoAnio', {
        periodoAnio: `${anio}-%`,
      });
    }

    const cuotas = await cuotasQuery.orderBy('cuota.periodo', 'DESC').getMany();

    const totalDeuda = cuotas
      .filter((c) => c.estado === EstadoCuota.PENDIENTE)
      .reduce((sum, c) => sum + Number(c.monto), 0);

    const totalPagado = cuotas
      .filter((c) => c.estado === EstadoCuota.PAGADA)
      .reduce((sum, c) => sum + Number(c.monto), 0);

    const mesesAdeudados = cuotas.filter(
      (c) => c.estado === EstadoCuota.PENDIENTE,
    ).length;

    const resolverEstadoTarjetaCentro = (cuota: Cuota) => {
      if (!socio.tarjetaCentro) {
        return {
          tarjetaCentroEstado: 'NO_APLICA' as const,
          tarjetaCentroDetalle: 'Socio sin Tarjeta del Centro',
          tarjetaCentroFechaEstado: undefined,
        };
      }

      if (cuota.rechazadaTarjetaCentro) {
        return {
          tarjetaCentroEstado: 'RECHAZADA' as const,
          tarjetaCentroDetalle:
            'Tarjeta rechazada. Esta cuota debe abonarla el socio.',
          tarjetaCentroFechaEstado: cuota.fechaRechazoTarjetaCentro ?? undefined,
        };
      }

      if (cuota.estado === EstadoCuota.PAGADA) {
        return {
          tarjetaCentroEstado: 'APROBADA' as const,
          tarjetaCentroDetalle: 'Tarjeta aprobada. Cuota cubierta por convenio.',
          tarjetaCentroFechaEstado: cuota.fechaPago,
        };
      }

      return {
        tarjetaCentroEstado: 'PENDIENTE_RESPUESTA' as const,
        tarjetaCentroDetalle:
          'Enviada a Tarjeta del Centro. Pendiente de respuesta.',
        tarjetaCentroFechaEstado: cuota.createdAt,
      };
    };

    return {
      socioId: socio.id,
      socioNombre: socio.nombre,
      socioApellido: socio.apellido,
      cuotas: cuotas.map((c) => ({
        id: c.id,
        periodo: c.periodo,
        monto: Number(c.monto),
        estado: c.estado,
        ...resolverEstadoTarjetaCentro(c),
        fechaPago: c.fechaPago,
      })),
      totalDeuda,
      totalPagado,
      mesesAdeudados,
    };
  }

  /**
   * Genera el reporte de cobranza para un período
   */
  async obtenerReporteCobranza(periodo: string): Promise<ReporteCobranza> {
    const cuotas = await this.cuotaRepository.find({
      where: { periodo },
      relations: ['socio'],
    });

    if (cuotas.length === 0) {
      throw new CustomError(
        ERROR_MESSAGES.NO_CUOTAS_PENDIENTES,
        404,
        ERROR_CODES.NO_CUOTAS_PENDIENTES,
      );
    }

    const totalGenerado = cuotas.reduce((sum, c) => sum + Number(c.monto), 0);

    const cuotasPagadas = cuotas.filter((c) => c.estado === EstadoCuota.PAGADA);
    const totalCobrado = cuotasPagadas.reduce(
      (sum, c) => sum + Number(c.monto),
      0,
    );

    const cuotasPendientes = cuotas.filter(
      (c) => c.estado === EstadoCuota.PENDIENTE,
    );

    const porcentajeCobranza =
      totalGenerado > 0 ? (totalCobrado / totalGenerado) * 100 : 0;

    const morosidad =
      cuotas.length > 0 ? (cuotasPendientes.length / cuotas.length) * 100 : 0;

    // Desglose por método de pago: consultar pagos del período con su método
    const pagosDelPeriodo = await this.pagoCuotaRepository
      .createQueryBuilder('pago')
      .leftJoinAndSelect('pago.metodoPago', 'metodoPago')
      .innerJoin('pago.cuota', 'cuota')
      .where('cuota.periodo = :periodo', { periodo })
      .getMany();

    const desglosePorMetodoMap = new Map<string, { totalCobrado: number; cantidadPagos: number }>();
    for (const pago of pagosDelPeriodo) {
      const nombreMetodo = pago.metodoPago?.nombre ?? 'Sin especificar';
      const existing = desglosePorMetodoMap.get(nombreMetodo) ?? { totalCobrado: 0, cantidadPagos: 0 };
      existing.totalCobrado += Number(pago.montoPagado);
      existing.cantidadPagos += 1;
      desglosePorMetodoMap.set(nombreMetodo, existing);
    }

    const desglosePorMetodoPago: DesglosePorMetodoPago[] = Array.from(
      desglosePorMetodoMap.entries(),
    ).map(([metodoPago, data]) => ({
      metodoPago,
      totalCobrado: data.totalCobrado,
      cantidadPagos: data.cantidadPagos,
    }));

    // Resumen de Tarjeta del Centro
    const cuotasTarjeta = cuotas.filter(
      (c) => c.socio?.tarjetaCentro === true && c.socio?.numeroTarjetaCentro,
    );
    const sociosConTarjetaIds = new Set(
      cuotasTarjeta.map((c) => c.socioId),
    );
    const cuotasPagadasTarjeta = cuotasTarjeta.filter(
      (c) => c.estado === EstadoCuota.PAGADA,
    );
    const cuotasPendientesTarjeta = cuotasTarjeta.filter(
      (c) => c.estado === EstadoCuota.PENDIENTE,
    );

    const tarjetaCentro: ResumenTarjetaCentro = {
      sociosConTarjeta: sociosConTarjetaIds.size,
      cuotasPagadasTarjeta: cuotasPagadasTarjeta.length,
      totalCobradoTarjeta: cuotasPagadasTarjeta.reduce(
        (sum, c) => sum + Number(c.monto),
        0,
      ),
      cuotasPendientesTarjeta: cuotasPendientesTarjeta.length,
      totalPendienteTarjeta: cuotasPendientesTarjeta.reduce(
        (sum, c) => sum + Number(c.monto),
        0,
      ),
    };

    return {
      periodo,
      totalGenerado,
      totalCobrado,
      porcentajeCobranza: Math.round(porcentajeCobranza * 100) / 100,
      cuotasPendientes: cuotasPendientes.length,
      cuotasPagadas: cuotasPagadas.length,
      morosidad: Math.round(morosidad * 100) / 100,
      desglosePorMetodoPago,
      tarjetaCentro,
    };
  }

  /**
   * Obtiene las cuotas pendientes de un período para generar talonario
   * Ordena primero por grupo familiar (campo orden), luego alfabéticamente por apellido y nombre
   * Los socios sin grupo familiar aparecen al final
   */
  async obtenerCuotasParaTalonario(periodo: string): Promise<Cuota[]> {
    const cuotas = await this.cuotaRepository
      .createQueryBuilder('cuota')
      .leftJoinAndSelect('cuota.socio', 'socio')
      .leftJoinAndSelect('socio.grupoFamiliar', 'grupo')
      .where('cuota.periodo = :periodo', { periodo })
      .andWhere('cuota.estado = :estado', { estado: EstadoCuota.PENDIENTE })
      .orderBy('COALESCE(grupo.orden, 999999)', 'ASC')
      .addOrderBy('socio.apellido', 'ASC')
      .addOrderBy('socio.nombre', 'ASC')
      .getMany();

    return cuotas;
  }

  async obtenerCuotasTarjetaCentro(periodo: string): Promise<Cuota[]> {
    const cuotas = await this.cuotaRepository
      .createQueryBuilder('cuota')
      .leftJoinAndSelect('cuota.socio', 'socio')
      .where('cuota.periodo = :periodo', { periodo })
      .andWhere('cuota.estado = :estado', { estado: EstadoCuota.PENDIENTE })
      .andWhere(
        '(cuota.rechazadaTarjetaCentro = :rechazada OR cuota.rechazadaTarjetaCentro IS NULL)',
        {
          rechazada: false,
        },
      )
      .andWhere('socio.tarjetaCentro = :tarjetaCentro', { tarjetaCentro: true })
      .andWhere('socio.numeroTarjetaCentro IS NOT NULL')
      .andWhere("TRIM(socio.numeroTarjetaCentro) <> ''")
      .orderBy('socio.apellido', 'ASC')
      .addOrderBy('socio.nombre', 'ASC')
      .getMany();

    const cuotasValidas = cuotas.filter((cuota) => {
      const numeroTarjeta = cuota.socio?.numeroTarjetaCentro?.replace(/\D/g, '');
      return Boolean(numeroTarjeta && /^\d{16}$/.test(numeroTarjeta));
    });

    if (cuotasValidas.length !== cuotas.length) {
      const cuotasInvalidas = cuotas
        .filter((cuota) => !cuotasValidas.includes(cuota))
        .map((cuota) => {
          const socioId = cuota.socio?.id ?? cuota.socioId;
          const tarjeta = cuota.socio?.numeroTarjetaCentro ?? 'sin numero';
          return `cuota ${cuota.id} socio ${socioId} tarjeta ${tarjeta}`;
        });

      this.logger.warn(
        `Se excluyeron ${cuotasInvalidas.length} cuotas del archivo Tarjeta del Centro para ${periodo} por tarjetas invalidas: ${cuotasInvalidas.join('; ')}`,
      );
    }

    return cuotasValidas;
  }

  /**
   * Obtiene la cuota de un socio para un período específico
   */
  async obtenerCuotaPorSocioYPeriodo(
    socioId: number,
    periodo: string,
  ): Promise<Cuota | null> {
    const cuota = await this.cuotaRepository.findOne({
      where: { socioId, periodo },
      relations: ['socio', 'socio.grupoFamiliar'],
    });

    return cuota;
  }

  /**
   * Obtiene todas las cuotas con filtros opcionales y paginación
   */
  async findAllCuotas(filtros?: {
    periodo?: string;
    estado?: EstadoCuota;
    socioId?: number;
    tarjetaCentro?: boolean;
    busqueda?: string;
    page?: number;
    limit?: number;
  }): Promise<{
    cuotas: Cuota[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const page = filtros?.page || 1;
    const limit = filtros?.limit || 10;

    const query = this.cuotaRepository
      .createQueryBuilder('cuota')
      .leftJoinAndSelect('cuota.socio', 'socio');

    if (filtros?.periodo) {
      query.andWhere('cuota.periodo = :periodo', { periodo: filtros.periodo });
    }

    if (filtros?.estado) {
      query.andWhere('cuota.estado = :estado', { estado: filtros.estado });
    }

    if (filtros?.socioId) {
      query.andWhere('cuota.socioId = :socioId', { socioId: filtros.socioId });
    }

    if (typeof filtros?.tarjetaCentro === 'boolean') {
      query.andWhere('socio.tarjetaCentro = :tarjetaCentro', {
        tarjetaCentro: filtros.tarjetaCentro,
      });

      if (filtros.tarjetaCentro) {
        query.andWhere(
          '(cuota.rechazadaTarjetaCentro = :rechazada OR cuota.rechazadaTarjetaCentro IS NULL)',
          { rechazada: false },
        );
      }
    }

    // Búsqueda por nombre, apellido o DNI del socio
    if (filtros?.busqueda) {
      const terminoBusqueda = `%${filtros.busqueda}%`;
      query.andWhere(
        '(unaccent(socio.nombre) ILIKE unaccent(:busqueda) OR unaccent(socio.apellido) ILIKE unaccent(:busqueda) OR socio.dni LIKE :busqueda)',
        { busqueda: terminoBusqueda },
      );
    }

    query.orderBy('socio.apellido', 'ASC').addOrderBy('cuota.periodo', 'DESC');

    const total = await query.getCount();
    const totalPages = Math.ceil(total / limit);

    query.skip((page - 1) * limit).take(limit);

    const cuotas = await query.getMany();

    return {
      cuotas,
      total,
      page,
      limit,
      totalPages,
    };
  }

  /**
   * Obtiene socios elegibles para generacion de cuotas en un periodo
   */

  async getSociosElegibles(periodo: string, busqueda?: string) {
    const sociosQuery = this.socioRepository.createQueryBuilder('socio');

    if (busqueda && busqueda.trim()) {
      const terminoBusqueda = `%${busqueda.trim()}%`;
      sociosQuery.andWhere(
        '(unaccent(socio.nombre) ILIKE unaccent(:busqueda) OR unaccent(socio.apellido) ILIKE unaccent(:busqueda) OR socio.dni ILIKE :busqueda)',
        { busqueda: terminoBusqueda },
      );
    }

    const socios = await sociosQuery
      .leftJoinAndSelect('socio.categoria', 'categoria')
      .orderBy('socio.apellido', 'ASC')
      .addOrderBy('socio.nombre', 'ASC')
      .getMany();

    const cuotasExistentes = await this.cuotaRepository.find({
      where: { periodo },
      select: ['socioId', 'monto', 'createdAt'],
      order: { createdAt: 'DESC' },
    });

    const montoCuotaExistentePorSocio = new Map<number, number>();
    for (const cuota of cuotasExistentes) {
      if (!montoCuotaExistentePorSocio.has(cuota.socioId)) {
        montoCuotaExistentePorSocio.set(cuota.socioId, Number(cuota.monto));
      }
    }

    const sociosConCuota = new Set(montoCuotaExistentePorSocio.keys());

    const sociosElegibles = socios
      .filter((s) => s.categoria && !s.categoria.exento)
      .filter((s) => s.estado === 'ACTIVO' || sociosConCuota.has(s.id))
      .map((s) => ({
        id: s.id,
        nombre: s.nombre,
        apellido: s.apellido,
        dni: s.dni,
        categoriaNombre: s.categoria!.nombre,
        montoMensual:
          montoCuotaExistentePorSocio.get(s.id) ??
          Number(s.categoria!.montoMensual),
        cuotaExistente: sociosConCuota.has(s.id),
        tarjetaCentro: s.tarjetaCentro,
      }));

    return {
      socios: sociosElegibles,
      total: sociosElegibles.length,
    };
  }
  /**
   * Genera cuotas para socios seleccionados individualmente
   * Implementa morosidad en 2 fases: aviso a 3 meses, inhabilitacion a 4+
   */
  async generarCuotasSeleccion(dto: GenerarCuotasSeleccionDto) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    const resultado: ResultadoGeneracionCuotas = {
      creadas: 0,
      omitidas: 0,
      advertenciasMorosidad: 0,
      inhabilitados: 0,
      desactivados: 0,
      advertencias: [],
    };

    try {
      const socios = await queryRunner.manager.find(Socio, {
        where: { id: In(dto.socioIds) },
        relations: ['categoria'],
      });

      const cuotasExistentes = await queryRunner.manager.find(Cuota, {
        where: { periodo: dto.periodo },
      });
      const sociosConCuota = new Set(cuotasExistentes.map((c) => c.socioId));

      for (const socio of socios) {
        const cuotasPendientes = await queryRunner.manager.count(Cuota, {
          where: { socioId: socio.id, estado: EstadoCuota.PENDIENTE },
        });

        if (cuotasPendientes >= CobrosService.UMBRAL_INHABILITACION_MOROSIDAD) {
          await queryRunner.manager.update(Socio, socio.id, {
            estado: 'MOROSO',
          });
          resultado.inhabilitados++;
          resultado.desactivados++;
          resultado.advertencias.push(
            `Socio ${socio.nombre} ${socio.apellido} (ID: ${socio.id}) marcado como MOROSO por ${cuotasPendientes} meses de morosidad`,
          );
          await this.notificacionesService.crearNotificacion(
            TipoNotificacion.INHABILITACION_AUTOMATICA,
            socio.id,
            `Socio ${socio.nombre} ${socio.apellido} marcado automaticamente como MOROSO por ${cuotasPendientes} meses de morosidad`,
          );
          continue;
        }

        if (cuotasPendientes === CobrosService.UMBRAL_ADVERTENCIA_MOROSIDAD) {
          resultado.advertenciasMorosidad++;
          resultado.advertencias.push(
            `Socio ${socio.nombre} ${socio.apellido} (ID: ${socio.id}) adeuda 3 meses. Proximo mes sera inhabilitado.`,
          );
          await this.notificacionesService.crearNotificacion(
            TipoNotificacion.MOROSIDAD_3_MESES,
            socio.id,
            `Socio ${socio.nombre} ${socio.apellido} adeuda 3 meses. El proximo mes sera inhabilitado.`,
          );
        }

        if (sociosConCuota.has(socio.id)) {
          resultado.omitidas++;
          continue;
        }

        if (!socio.categoria || socio.categoria.exento) {
          resultado.omitidas++;
          resultado.advertencias.push(
            `Socio ${socio.nombre} ${socio.apellido} (ID: ${socio.id}) omitido: categoria no valida o exenta`,
          );
          continue;
        }

        const cuota = queryRunner.manager.create(Cuota, {
          socioId: socio.id,
          periodo: dto.periodo,
          monto: socio.categoria.montoMensual,
          estado: EstadoCuota.PENDIENTE,
        });

        await queryRunner.manager.save(cuota);
        resultado.creadas++;
      }

      await queryRunner.commitTransaction();
      return resultado;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(
        'Error generando cuotas por seleccion',
        error instanceof Error ? error.stack : String(error),
      );
      if (error instanceof CustomError) {
        throw error;
      }
      throw new CustomError(
        ERROR_MESSAGES.ERROR_GENERANDO_CUOTAS,
        500,
        ERROR_CODES.INTERNAL_SERVER_ERROR,
      );
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Obtiene el estado de pagos anual de todos los socios, paginado
   */
  async getEstadoPagos(
    anio: number,
    page = 1,
    limit = 10,
    filtros?: {
      busqueda?: string;
      mes?: number;
      estadoPago?:
        | 'TODOS'
        | 'PAGADA'
        | 'PENDIENTE'
        | 'SIN_CUOTA'
        | 'CON_PAGO'
        | 'CON_DEUDA';
      categoriaSocio?: 'TODOS' | 'ACTIVO' | 'ADHERENTE';
      tarjetaCentro?: boolean;
    },
  ) {
    const estadoPago = filtros?.estadoPago ?? 'TODOS';
    const categoriaSocio = filtros?.categoriaSocio ?? 'TODOS';
    const tarjetaCentro = filtros?.tarjetaCentro;
    const mesNormalizado =
      typeof filtros?.mes === 'number'
        ? String(filtros.mes).padStart(2, '0')
        : undefined;
    const estadosVisibles: Array<'ACTIVO' | 'MOROSO'> = ['ACTIVO', 'MOROSO'];

    const sociosQuery = this.socioRepository
      .createQueryBuilder('socio')
      .leftJoinAndSelect('socio.categoria', 'categoria')
      .where('socio.estado IN (:...estadosVisibles)', { estadosVisibles })
      .andWhere('categoria.id IS NOT NULL')
      .andWhere('COALESCE(categoria.exento, false) = false')
      .andWhere('UPPER(categoria.nombre) NOT IN (:...categoriasExentas)', {
        categoriasExentas: ['HONORARIO', 'VITALICIO'],
      })
      .orderBy('socio.apellido', 'ASC')
      .addOrderBy('socio.nombre', 'ASC');

    if (filtros?.busqueda) {
      const termino = `%${filtros.busqueda}%`;
      sociosQuery.andWhere(
        new Brackets((qb) => {
          qb.where('unaccent(socio.nombre) ILIKE unaccent(:busqueda)', {
            busqueda: termino,
          })
            .orWhere('unaccent(socio.apellido) ILIKE unaccent(:busqueda)', {
              busqueda: termino,
            })
            .orWhere('socio.dni LIKE :busqueda', { busqueda: termino });
        }),
      );
    }

    if (categoriaSocio !== 'TODOS') {
      sociosQuery.andWhere('UPPER(categoria.nombre) = :categoriaSocio', {
        categoriaSocio,
      });
    }

    if (typeof tarjetaCentro === 'boolean') {
      sociosQuery.andWhere('socio.tarjetaCentro = :tarjetaCentro', {
        tarjetaCentro,
      });
    }

    if (estadoPago !== 'TODOS') {
      if (estadoPago === 'CON_PAGO') {
        sociosQuery.andWhere(
          `EXISTS (
            SELECT 1 FROM cuota cuotaFiltro
            WHERE cuotaFiltro.id_socio = socio.id_socio
              AND cuotaFiltro.periodo LIKE :anioConPago
              AND cuotaFiltro.estado = :estadoPagadaConPago
          )`,
          {
            anioConPago: `${anio}-%`,
            estadoPagadaConPago: EstadoCuota.PAGADA,
          },
        );
      }

      if (estadoPago === 'CON_DEUDA') {
        sociosQuery.andWhere(
          `EXISTS (
            SELECT 1 FROM cuota cuotaFiltro
            WHERE cuotaFiltro.id_socio = socio.id_socio
              AND cuotaFiltro.periodo LIKE :anioConDeuda
              AND cuotaFiltro.estado = :estadoPendienteConDeuda
          )`,
          {
            anioConDeuda: `${anio}-%`,
            estadoPendienteConDeuda: EstadoCuota.PENDIENTE,
          },
        );
      }

      if (estadoPago === 'PAGADA') {
        if (mesNormalizado) {
          sociosQuery.andWhere(
            `EXISTS (
              SELECT 1 FROM cuota cuotaFiltro
              WHERE cuotaFiltro.id_socio = socio.id_socio
                AND cuotaFiltro.periodo = :periodoPagada
                AND cuotaFiltro.estado = :estadoPagada
            )`,
            {
              periodoPagada: `${anio}-${mesNormalizado}`,
              estadoPagada: EstadoCuota.PAGADA,
            },
          );
        } else {
          sociosQuery.andWhere(
            `EXISTS (
              SELECT 1 FROM cuota cuotaFiltro
              WHERE cuotaFiltro.id_socio = socio.id_socio
                AND cuotaFiltro.periodo LIKE :anioPagada
                AND cuotaFiltro.estado = :estadoPagadaSinMes
            )`,
            {
              anioPagada: `${anio}-%`,
              estadoPagadaSinMes: EstadoCuota.PAGADA,
            },
          );
        }
      }

      if (estadoPago === 'PENDIENTE') {
        if (mesNormalizado) {
          sociosQuery.andWhere(
            `EXISTS (
              SELECT 1 FROM cuota cuotaFiltro
              WHERE cuotaFiltro.id_socio = socio.id_socio
                AND cuotaFiltro.periodo = :periodoPendiente
                AND cuotaFiltro.estado = :estadoPendiente
            )`,
            {
              periodoPendiente: `${anio}-${mesNormalizado}`,
              estadoPendiente: EstadoCuota.PENDIENTE,
            },
          );
        } else {
          sociosQuery.andWhere(
            `EXISTS (
              SELECT 1 FROM cuota cuotaFiltro
              WHERE cuotaFiltro.id_socio = socio.id_socio
                AND cuotaFiltro.periodo LIKE :anioPendiente
                AND cuotaFiltro.estado = :estadoPendienteSinMes
            )`,
            {
              anioPendiente: `${anio}-%`,
              estadoPendienteSinMes: EstadoCuota.PENDIENTE,
            },
          );
        }
      }

      if (estadoPago === 'SIN_CUOTA') {
        if (mesNormalizado) {
          sociosQuery.andWhere(
            `NOT EXISTS (
              SELECT 1 FROM cuota cuotaFiltro
              WHERE cuotaFiltro.id_socio = socio.id_socio
                AND cuotaFiltro.periodo = :periodoSinCuota
            )`,
            {
              periodoSinCuota: `${anio}-${mesNormalizado}`,
            },
          );
        } else {
          sociosQuery.andWhere(
            `NOT EXISTS (
              SELECT 1 FROM cuota cuotaFiltro
              WHERE cuotaFiltro.id_socio = socio.id_socio
                AND cuotaFiltro.periodo LIKE :anioSinCuota
            )`,
            {
              anioSinCuota: `${anio}-%`,
            },
          );
        }
      }
    }

    const [socios, total] = await sociosQuery
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    const socioIds = socios.map((s) => s.id);

    let cuotasDelAnio: Cuota[] = [];
    if (socioIds.length > 0) {
      cuotasDelAnio = await this.cuotaRepository
        .createQueryBuilder('cuota')
        .where('cuota.socioId IN (:...socioIds)', { socioIds })
        .andWhere('cuota.periodo LIKE :anio', { anio: `${anio}-%` })
        .getMany();
    }

    const cuotasPorSocio = new Map<
      number,
      Map<
        string,
        {
          estado: EstadoCuota;
          rechazadaTarjetaCentro: boolean;
        }
      >
    >();

    for (const cuota of cuotasDelAnio) {
      if (!cuotasPorSocio.has(cuota.socioId)) {
        cuotasPorSocio.set(cuota.socioId, new Map());
      }

      const mes = cuota.periodo.split('-')[1];
      const cuotasMes = cuotasPorSocio.get(cuota.socioId)!;
      const cuotaActual = cuotasMes.get(mes);

      if (!cuotaActual) {
        cuotasMes.set(mes, {
          estado: cuota.estado,
          rechazadaTarjetaCentro: cuota.rechazadaTarjetaCentro,
        });
        continue;
      }

      if (cuotaActual.estado === EstadoCuota.PAGADA) {
        if (
          cuota.estado === EstadoCuota.PAGADA &&
          cuota.rechazadaTarjetaCentro &&
          !cuotaActual.rechazadaTarjetaCentro
        ) {
          cuotasMes.set(mes, {
            estado: cuota.estado,
            rechazadaTarjetaCentro: true,
          });
        }
        continue;
      }

      if (cuota.estado === EstadoCuota.PAGADA) {
        cuotasMes.set(mes, {
          estado: EstadoCuota.PAGADA,
          rechazadaTarjetaCentro: cuota.rechazadaTarjetaCentro,
        });
        continue;
      }

      if (cuota.rechazadaTarjetaCentro && !cuotaActual.rechazadaTarjetaCentro) {
        cuotasMes.set(mes, {
          estado: cuota.estado,
          rechazadaTarjetaCentro: true,
        });
      }
    }

    const sociosConPagos = socios.map((socio) => {
      const cuotasMes =
        cuotasPorSocio.get(socio.id) ||
        new Map<
          string,
          {
            estado: EstadoCuota;
            rechazadaTarjetaCentro: boolean;
          }
        >();
      const meses: Record<string, string | null> = {};
      const mesesTarjetaCentro: Record<string, EstadoTarjetaCentroMes | null> =
        {};

      for (let mes = 1; mes <= 12; mes++) {
        const mesKey = String(mes).padStart(2, '0');
        const cuotaMes = cuotasMes.get(mesKey);
        meses[mesKey] = cuotaMes?.estado ?? null;
        mesesTarjetaCentro[mesKey] = this.resolverEstadoTarjetaCentroMes(
          socio.tarjetaCentro ?? false,
          cuotaMes,
        );
      }

      return {
        socioId: socio.id,
        nombre: socio.nombre,
        apellido: socio.apellido,
        dni: socio.dni || undefined,
        estado: socio.estado,
        categoriaNombre: socio.categoria?.nombre ?? 'Sin categoria',
        tarjetaCentro: socio.tarjetaCentro ?? false,
        meses,
        mesesTarjetaCentro,
      };
    });

    return {
      socios: sociosConPagos,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Obtiene la lista detallada de socios morosos con filtros y paginacion
   */
  async getMorososDetallados(
    query: MorososQueryDto,
  ): Promise<MorososDetalladosResponseDto> {
    const page = query.page || 1;
    const limit = query.limit || 10;
    const severidad = query.severidad || SeveridadMoroso.TODOS;

    // Construir query base: socios con 3+ cuotas pendientes
    const queryBuilder = this.socioRepository
      .createQueryBuilder('socio')
      .leftJoin('socio.categoria', 'categoria')
      .innerJoin('socio.cuotas', 'cuota', 'cuota.estado = :estadoPendiente', {
        estadoPendiente: EstadoCuota.PENDIENTE,
      })
      .groupBy('socio.id')
      .addGroupBy('categoria.id')
      .addGroupBy('categoria.nombre')
      .addGroupBy('categoria.montoMensual')
      .addGroupBy('categoria.exento')
      .addGroupBy('categoria.exento')
      .having('COUNT(cuota.id) >= :minMeses', { minMeses: 3 });

    // Filtro por severidad
    if (severidad === SeveridadMoroso.TRES_MESES) {
      queryBuilder.andHaving('COUNT(cuota.id) = :exacto', { exacto: 3 });
    } else if (severidad === SeveridadMoroso.CUATRO_MAS) {
      queryBuilder.andHaving('COUNT(cuota.id) >= :minCuatro', { minCuatro: 4 });
    } else if (severidad === SeveridadMoroso.SEIS_MAS) {
      queryBuilder.andHaving('COUNT(cuota.id) >= :minSeis', { minSeis: 6 });
    }

    // Filtro por busqueda
    if (query.busqueda) {
      const termino = `%${query.busqueda}%`;
      queryBuilder.andWhere(
        '(unaccent(socio.nombre) ILIKE unaccent(:busqueda) OR unaccent(socio.apellido) ILIKE unaccent(:busqueda) OR socio.dni LIKE :busqueda)',
        { busqueda: termino },
      );
    }

    // Obtener total antes de paginar (getCount no funciona con GROUP BY/HAVING)
    const totalQueryBuilder = queryBuilder.clone();
    const totalMorososList = await totalQueryBuilder.getMany();
    const total = totalMorososList.length;

    // Ordenar y paginar
    queryBuilder
      .orderBy('socio.apellido', 'ASC')
      .addOrderBy('socio.nombre', 'ASC')
      .skip((page - 1) * limit)
      .take(limit);

    const sociosMorosos = await queryBuilder.getMany();
    const socioIds = sociosMorosos.map((s) => s.id);

    // Obtener cuotas pendientes y ultimo pago para cada socio
    let cuotasPendientes: Cuota[] = [];
    let cuotasPagadas: Cuota[] = [];

    if (socioIds.length > 0) {
      cuotasPendientes = await this.cuotaRepository
        .createQueryBuilder('cuota')
        .where('cuota.socioId IN (:...socioIds)', { socioIds })
        .andWhere('cuota.estado = :estado', { estado: EstadoCuota.PENDIENTE })
        .orderBy('cuota.periodo', 'ASC')
        .getMany();

      cuotasPagadas = await this.cuotaRepository
        .createQueryBuilder('cuota')
        .where('cuota.socioId IN (:...socioIds)', { socioIds })
        .andWhere('cuota.estado = :estado', { estado: EstadoCuota.PAGADA })
        .orderBy('cuota.fechaPago', 'DESC')
        .getMany();
    }

    // Agrupar cuotas por socio
    const cuotasPorSocio = new Map<number, Cuota[]>();
    for (const cuota of cuotasPendientes) {
      if (!cuotasPorSocio.has(cuota.socioId)) {
        cuotasPorSocio.set(cuota.socioId, []);
      }
      cuotasPorSocio.get(cuota.socioId)!.push(cuota);
    }

    const ultimoPagoPorSocio = new Map<number, Cuota>();
    for (const cuota of cuotasPagadas) {
      if (!ultimoPagoPorSocio.has(cuota.socioId)) {
        ultimoPagoPorSocio.set(cuota.socioId, cuota);
      }
    }

    // Construir respuesta
    const morosos: MorosoDetalladoDto[] = sociosMorosos.map((socio) => {
      const cuotasSocio = cuotasPorSocio.get(socio.id) || [];
      const ultimoPago = ultimoPagoPorSocio.get(socio.id);

      const montoTotalDeuda = cuotasSocio.reduce(
        (sum, c) => sum + Number(c.monto),
        0,
      );
      const periodosAdeudados = cuotasSocio.map((c) => c.periodo).sort();

      return {
        socioId: socio.id,
        nombre: socio.nombre,
        apellido: socio.apellido,
        dni: socio.dni || '',
        telefono: socio.telefono || undefined,
        email: socio.email || undefined,
        categoria: socio.categoria
          ? {
              nombre: socio.categoria.nombre,
              montoMensual: Number(socio.categoria.montoMensual),
            }
          : { nombre: 'Sin categoria', montoMensual: 0 },
        estado: socio.estado,
        mesesDeuda: cuotasSocio.length,
        montoTotalDeuda,
        periodosAdeudados,
        ultimoPago: ultimoPago
          ? {
              fecha: ultimoPago.fechaPago!,
              periodo: ultimoPago.periodo,
            }
          : undefined,
      };
    });

    // Calcular estadisticas
    const statsQueryBuilder = this.socioRepository
      .createQueryBuilder('socio')
      .innerJoin('socio.cuotas', 'cuota', 'cuota.estado = :estadoPendiente', {
        estadoPendiente: EstadoCuota.PENDIENTE,
      })
      .groupBy('socio.id')
      .having('COUNT(cuota.id) >= :minMeses', { minMeses: 3 });

    if (query.busqueda) {
      const termino = `%${query.busqueda}%`;
      statsQueryBuilder.andWhere(
        '(unaccent(socio.nombre) ILIKE unaccent(:busqueda) OR unaccent(socio.apellido) ILIKE unaccent(:busqueda) OR socio.dni LIKE :busqueda)',
        { busqueda: termino },
      );
    }

    const allMorosos = await statsQueryBuilder.getMany();
    const allSocioIds = allMorosos.map((s) => s.id);

    let allCuotasPendientes: Cuota[] = [];
    if (allSocioIds.length > 0) {
      allCuotasPendientes = await this.cuotaRepository
        .createQueryBuilder('cuota')
        .where('cuota.socioId IN (:...socioIds)', { socioIds: allSocioIds })
        .andWhere('cuota.estado = :estado', { estado: EstadoCuota.PENDIENTE })
        .getMany();
    }

    const cuotasPorSocioAll = new Map<number, Cuota[]>();
    for (const cuota of allCuotasPendientes) {
      if (!cuotasPorSocioAll.has(cuota.socioId)) {
        cuotasPorSocioAll.set(cuota.socioId, []);
      }
      cuotasPorSocioAll.get(cuota.socioId)!.push(cuota);
    }

    let tresMeses = 0;
    let cuatroMeses = 0;
    let seisMeses = 0;
    let montoTotalDeudaAll = 0;

    for (const socio of allMorosos) {
      const cuotas = cuotasPorSocioAll.get(socio.id) || [];
      const count = cuotas.length;
      const monto = cuotas.reduce((sum, c) => sum + Number(c.monto), 0);
      montoTotalDeudaAll += monto;

      if (count === 3) tresMeses++;
      else if (count >= 4 && count < 6) cuatroMeses++;
      else if (count >= 6) seisMeses++;
    }

    const estadisticas: MorososStatsDto = {
      totalMorosos: allMorosos.length,
      montoTotalDeuda: montoTotalDeudaAll,
      tresMeses,
      cuatroMeses,
      seisMeses,
    };

    return {
      morosos,
      estadisticas,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Genera el reporte de cobranza para un rango de meses
   * Incluye resumen consolidado y desglose por cada mes
   */
  async obtenerReporteCobranzaRango(
    periodoDesde: string,
    periodoHasta: string,
  ): Promise<import('./dto').ReporteCobranzaRangoResponseDto> {
    // Generar lista de períodos en el rango
    const periodos = this.generarPeriodosEnRango(periodoDesde, periodoHasta);

    if (periodos.length === 0) {
      throw new CustomError(
        ERROR_MESSAGES.NO_CUOTAS_PENDIENTES,
        404,
        ERROR_CODES.NO_CUOTAS_PENDIENTES,
      );
    }

    // Obtener reporte de cada mes
    const reportesPorMes: import('./dto').ReporteCobranzaMesDto[] = [];
    let totalGenerado = 0;
    let totalCobrado = 0;
    let totalCuotasPendientes = 0;
    let totalCuotasPagadas = 0;

    // Acumuladores de método de pago y tarjeta centro consolidado
    const desglosePorMetodoMapGlobal = new Map<string, { totalCobrado: number; cantidadPagos: number }>();
    let sociosConTarjetaIdsGlobal = new Set<number>();
    let totalCuotasPagadasTarjeta = 0;
    let totalCobradoTarjeta = 0;
    let totalCuotasPendientesTarjeta = 0;
    let totalPendienteTarjeta = 0;

    for (const periodo of periodos) {
      const cuotas = await this.cuotaRepository.find({
        where: { periodo },
        relations: ['socio'],
      });

      // Si no hay cuotas para este período, incluir con valores en 0
      if (cuotas.length === 0) {
        reportesPorMes.push({
          periodo,
          totalGenerado: 0,
          totalCobrado: 0,
          porcentajeCobranza: 0,
          cuotasPendientes: 0,
          cuotasPagadas: 0,
          morosidad: 0,
        });
        continue;
      }

      const generado = cuotas.reduce((sum, c) => sum + Number(c.monto), 0);
      const pagadas = cuotas.filter((c) => c.estado === EstadoCuota.PAGADA);
      const cobrado = pagadas.reduce((sum, c) => sum + Number(c.monto), 0);
      const pendientes = cuotas.filter(
        (c) => c.estado === EstadoCuota.PENDIENTE,
      );

      const porcentaje = generado > 0 ? (cobrado / generado) * 100 : 0;
      const morosidad =
        cuotas.length > 0 ? (pendientes.length / cuotas.length) * 100 : 0;

      reportesPorMes.push({
        periodo,
        totalGenerado: generado,
        totalCobrado: cobrado,
        porcentajeCobranza: Math.round(porcentaje * 100) / 100,
        cuotasPendientes: pendientes.length,
        cuotasPagadas: pagadas.length,
        morosidad: Math.round(morosidad * 100) / 100,
      });

      totalGenerado += generado;
      totalCobrado += cobrado;
      totalCuotasPendientes += pendientes.length;
      totalCuotasPagadas += pagadas.length;

      // Acumular desglose por método de pago del período
      const pagosDelPeriodo = await this.pagoCuotaRepository
        .createQueryBuilder('pago')
        .leftJoinAndSelect('pago.metodoPago', 'metodoPago')
        .innerJoin('pago.cuota', 'cuota')
        .where('cuota.periodo = :periodo', { periodo })
        .getMany();

      for (const pago of pagosDelPeriodo) {
        const nombreMetodo = pago.metodoPago?.nombre ?? 'Sin especificar';
        const existing = desglosePorMetodoMapGlobal.get(nombreMetodo) ?? { totalCobrado: 0, cantidadPagos: 0 };
        existing.totalCobrado += Number(pago.montoPagado);
        existing.cantidadPagos += 1;
        desglosePorMetodoMapGlobal.set(nombreMetodo, existing);
      }

      // Acumular tarjeta del centro del período
      const cuotasTarjeta = cuotas.filter(
        (c) => c.socio?.tarjetaCentro === true && c.socio?.numeroTarjetaCentro,
      );
      for (const c of cuotasTarjeta) {
        sociosConTarjetaIdsGlobal.add(c.socioId);
      }
      const pagadasTarjeta = cuotasTarjeta.filter((c) => c.estado === EstadoCuota.PAGADA);
      const pendientesTarjeta = cuotasTarjeta.filter((c) => c.estado === EstadoCuota.PENDIENTE);
      totalCuotasPagadasTarjeta += pagadasTarjeta.length;
      totalCobradoTarjeta += pagadasTarjeta.reduce((sum, c) => sum + Number(c.monto), 0);
      totalCuotasPendientesTarjeta += pendientesTarjeta.length;
      totalPendienteTarjeta += pendientesTarjeta.reduce((sum, c) => sum + Number(c.monto), 0);
    }

    // Calcular promedios del consolidado
    const porcentajeCobranza =
      totalGenerado > 0 ? (totalCobrado / totalGenerado) * 100 : 0;
    const morosidad =
      totalCuotasPendientes + totalCuotasPagadas > 0
        ? (totalCuotasPendientes /
            (totalCuotasPendientes + totalCuotasPagadas)) *
          100
        : 0;

    const desglosePorMetodoPago: DesglosePorMetodoPago[] = Array.from(
      desglosePorMetodoMapGlobal.entries(),
    ).map(([metodoPago, data]) => ({
      metodoPago,
      totalCobrado: data.totalCobrado,
      cantidadPagos: data.cantidadPagos,
    }));

    const tarjetaCentro: ResumenTarjetaCentro = {
      sociosConTarjeta: sociosConTarjetaIdsGlobal.size,
      cuotasPagadasTarjeta: totalCuotasPagadasTarjeta,
      totalCobradoTarjeta,
      cuotasPendientesTarjeta: totalCuotasPendientesTarjeta,
      totalPendienteTarjeta,
    };

    return {
      periodoDesde,
      periodoHasta,
      totalGenerado,
      totalCobrado,
      porcentajeCobranza: Math.round(porcentajeCobranza * 100) / 100,
      cuotasPendientes: totalCuotasPendientes,
      cuotasPagadas: totalCuotasPagadas,
      morosidad: Math.round(morosidad * 100) / 100,
      cantidadMeses: periodos.length,
      meses: reportesPorMes,
      desglosePorMetodoPago,
      tarjetaCentro,
    };
  }

  /**
   * Genera una lista de períodos (YYYY-MM) entre dos fechas
   */
  private generarPeriodosEnRango(
    periodoDesde: string,
    periodoHasta: string,
  ): string[] {
    const periodos: string[] = [];

    const [anioDesde, mesDesde] = periodoDesde.split('-').map(Number);
    const [anioHasta, mesHasta] = periodoHasta.split('-').map(Number);

    let anioActual = anioDesde;
    let mesActual = mesDesde;

    while (
      anioActual < anioHasta ||
      (anioActual === anioHasta && mesActual <= mesHasta)
    ) {
      periodos.push(`${anioActual}-${String(mesActual).padStart(2, '0')}`);

      mesActual++;
      if (mesActual > 12) {
        mesActual = 1;
        anioActual++;
      }
    }

    return periodos;
  }
}
