import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, In, Brackets } from 'typeorm';
import { Cuota, EstadoCuota } from './entities/cuota.entity';
import { PagoCuota } from './entities/pago-cuota.entity';
import { Socio } from '../socios/entities/socio.entity';
import { NotificacionesService } from '../notificaciones/notificaciones.service';
import { TipoNotificacion } from '../notificaciones/entities/notificacion.entity';
import {
  GenerarCuotasDto,
  RegistrarPagoDto,
  RegistrarPagoMultipleDto,
  GenerarCuotasSeleccionDto,
  // Morosos detallados
  MorososQueryDto,
  SeveridadMoroso,
  MorosoDetalladoDto,
  MorososStatsDto,
  MorososDetalladosResponseDto,
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
    barcode?: string;
    periodo: string;
    monto: number;
    estado: EstadoCuota;
    fechaPago?: Date;
  }[];
  totalDeuda: number;
  totalPagado: number;
  mesesAdeudados: number;
}

export interface ReporteCobranza {
  periodo: string;
  totalGenerado: number;
  totalCobrado: number;
  porcentajeCobranza: number;
  cuotasPendientes: number;
  cuotasPagadas: number;
  morosidad: number;
}

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
      // 1. Fase 1: Advertencia para socios con EXACTAMENTE 3 cuotas pendientes
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

      // 2. Fase 2: Inhabilitacion para socios con 4+ cuotas pendientes
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

      // 3. Obtener socios activos con categoria asignada
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
      // 4. Verificar cuotas existentes para el periodo (idempotencia)
      const cuotasExistentes = await queryRunner.manager.find(Cuota, {
        where: { periodo: dto.periodo },
      });

      const sociosConCuotaExistente = new Set(
        cuotasExistentes.map((c) => c.socioId),
      );

      // 5. Crear cuotas para socios sin cuota en el periodo
      for (const socio of sociosConCategoria) {
        if (sociosConCuotaExistente.has(socio.id)) {
          resultado.omitidas++;
          continue;
        }

        const [anio, mes] = dto.periodo.split('-');
        const barcode = `${mes}-${anio}-${socio.id}`;
        const cuota = queryRunner.manager.create(Cuota, {
          socioId: socio.id,
          periodo: dto.periodo,
          monto: socio.categoria!.montoMensual,
          estado: EstadoCuota.PENDIENTE,
          barcode,
        });

        await queryRunner.manager.save(cuota);
        resultado.creadas++;
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
      .where('socio.estado = :estado', { estado: 'ACTIVO' })
      .andWhere('cuota.estado = :cuotaEstado', {
        cuotaEstado: EstadoCuota.PENDIENTE,
      })
      .groupBy('socio.id')
      .having('COUNT(cuota.id) >= :umbral', {
        umbral: CobrosService.UMBRAL_INHABILITACION_MOROSIDAD,
      })
      .getMany();
  }

  /**
   * Registra el pago de una cuota usando el código de barras o ID de cuota
   */
  async registrarPago(
    dto: RegistrarPagoDto,
  ): Promise<{ cuota: Cuota; pago: PagoCuota }> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      let cuota: Cuota | null = null;

      // 1. Buscar la cuota por ID o por barcode
      if (dto.cuotaId) {
        cuota = await queryRunner.manager.findOne(Cuota, {
          where: { id: dto.cuotaId },
          relations: ['socio'],
        });
      } else if (dto.barcode) {
        // Validar formato del barcode
        if (!/^\d{2}-\d{4}-\d+$/.test(dto.barcode)) {
          throw new CustomError(
            ERROR_MESSAGES.BARCODE_INVALID,
            400,
            ERROR_CODES.BARCODE_INVALID,
          );
        }
        cuota = await queryRunner.manager.findOne(Cuota, {
          where: { barcode: dto.barcode },
          relations: ['socio'],
        });
      } else {
        throw new CustomError(
          'Debe proporcionar barcode o cuotaId',
          400,
          ERROR_CODES.BARCODE_INVALID,
        );
      }

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

      const fechaPago = new Date();

      // 3. Crear el registro de pago
      const pago = queryRunner.manager.create(PagoCuota, {
        cuotaId: cuota.id,
        montoPagado: cuota.monto,
        metodoPago: dto.metodoPago,
        observaciones: dto.observaciones,
        fechaPago,
        fechaEmisionCuota: cuota.createdAt,
      });

      await queryRunner.manager.save(pago);

      // 4. Actualizar el estado de la cuota
      cuota.estado = EstadoCuota.PAGADA;
      cuota.fechaPago = fechaPago;
      await queryRunner.manager.save(cuota);

      await queryRunner.commitTransaction();
      return { cuota, pago };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(
        'Error registrando pago',
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
      // 1. Buscar todas las cuotas por barcode
      const cuotas = await queryRunner.manager.find(Cuota, {
        where: { barcode: In(dto.barcodes) },
        relations: ['socio'],
      });

      const cuotasMap = new Map(cuotas.map((c) => [c.barcode, c]));

      // 2. Procesar cada cuota
      for (const barcode of dto.barcodes) {
        // Validar formato
        if (!/^\d{2}-\d{4}-\d+$/.test(barcode)) {
          resultado.errores.push(`${barcode}: formato inválido`);
          continue;
        }

        const cuota = cuotasMap.get(barcode);

        if (!cuota) {
          resultado.errores.push(`${barcode}: cuota no encontrada`);
          continue;
        }

        if (cuota.estado === EstadoCuota.PAGADA) {
          resultado.errores.push(`${barcode}: cuota ya pagada`);
          continue;
        }

        const fechaPago = new Date();

        // Crear el pago
        const pago = queryRunner.manager.create(PagoCuota, {
          cuotaId: cuota.id,
          montoPagado: cuota.monto,
          metodoPago: dto.metodoPago,
          observaciones: dto.observaciones,
          fechaPago,
          fechaEmisionCuota: cuota.createdAt,
        });

        await queryRunner.manager.save(pago);

        // Actualizar la cuota
        cuota.estado = EstadoCuota.PAGADA;
        cuota.fechaPago = fechaPago;
        await queryRunner.manager.save(cuota);

        resultado.pagosExitosos++;
      }

      await queryRunner.commitTransaction();
      return resultado;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(
        'Error en pago múltiple',
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

  /**
   * Obtiene la cuenta corriente de un socio
   */
  async obtenerCuentaCorriente(socioId: number): Promise<CuentaCorriente> {
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

    const cuotas = await this.cuotaRepository.find({
      where: { socioId },
      order: { periodo: 'DESC' },
    });

    const totalDeuda = cuotas
      .filter((c) => c.estado === EstadoCuota.PENDIENTE)
      .reduce((sum, c) => sum + Number(c.monto), 0);

    const totalPagado = cuotas
      .filter((c) => c.estado === EstadoCuota.PAGADA)
      .reduce((sum, c) => sum + Number(c.monto), 0);

    const mesesAdeudados = cuotas.filter(
      (c) => c.estado === EstadoCuota.PENDIENTE,
    ).length;

    return {
      socioId: socio.id,
      socioNombre: socio.nombre,
      socioApellido: socio.apellido,
      cuotas: cuotas.map((c) => ({
        id: c.id,
        barcode: c.barcode,
        periodo: c.periodo,
        monto: Number(c.monto),
        estado: c.estado,
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

    return {
      periodo,
      totalGenerado,
      totalCobrado,
      porcentajeCobranza: Math.round(porcentajeCobranza * 100) / 100,
      cuotasPendientes: cuotasPendientes.length,
      cuotasPagadas: cuotasPagadas.length,
      morosidad: Math.round(morosidad * 100) / 100,
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
    return this.cuotaRepository
      .createQueryBuilder('cuota')
      .leftJoinAndSelect('cuota.socio', 'socio')
      .where('cuota.periodo = :periodo', { periodo })
      .andWhere('cuota.estado = :estado', { estado: EstadoCuota.PENDIENTE })
      .andWhere('socio.tarjetaCentro = :tarjetaCentro', { tarjetaCentro: true })
      .andWhere('socio.numeroTarjetaCentro IS NOT NULL')
      .andWhere("TRIM(socio.numeroTarjetaCentro) <> ''")
      .orderBy('socio.apellido', 'ASC')
      .addOrderBy('socio.nombre', 'ASC')
      .getMany();
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

    // Búsqueda por nombre, apellido o DNI del socio
    if (filtros?.busqueda) {
      const terminoBusqueda = `%${filtros.busqueda}%`;
      query.andWhere(
        '(socio.nombre LIKE :busqueda OR socio.apellido LIKE :busqueda OR socio.dni LIKE :busqueda)',
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
  async getSociosElegibles(periodo: string) {
    const socios = await this.socioRepository.find({
      relations: ['categoria'],
      order: { apellido: 'ASC', nombre: 'ASC' },
    });

    const cuotasExistentes = await this.cuotaRepository.find({
      where: { periodo },
      select: ['socioId'],
    });

    const sociosConCuota = new Set(cuotasExistentes.map((c) => c.socioId));

    const sociosElegibles = socios
      .filter((s) => s.categoria && !s.categoria.exento)
      .filter((s) => s.estado === 'ACTIVO' || sociosConCuota.has(s.id))
      .map((s) => ({
        id: s.id,
        nombre: s.nombre,
        apellido: s.apellido,
        dni: s.dni,
        categoriaNombre: s.categoria!.nombre,
        montoMensual: Number(s.categoria!.montoMensual),
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

        if (
          !socio.categoria ||
          socio.categoria.exento
        ) {
          resultado.omitidas++;
          resultado.advertencias.push(
            `Socio ${socio.nombre} ${socio.apellido} (ID: ${socio.id}) omitido: categoria no valida o exenta`,
          );
          continue;
        }

        const [anio, mes] = dto.periodo.split('-');
        const barcode = `${mes}-${anio}-${socio.id}`;
        const cuota = queryRunner.manager.create(Cuota, {
          socioId: socio.id,
          periodo: dto.periodo,
          monto: socio.categoria.montoMensual,
          estado: EstadoCuota.PENDIENTE,
          barcode,
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
    },
  ) {
    const estadoPago = filtros?.estadoPago ?? 'TODOS';
    const categoriaSocio = filtros?.categoriaSocio ?? 'TODOS';
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
          qb.where('socio.nombre LIKE :busqueda', { busqueda: termino })
            .orWhere('socio.apellido LIKE :busqueda', { busqueda: termino })
            .orWhere('socio.dni LIKE :busqueda', { busqueda: termino });
        }),
      );
    }

    if (categoriaSocio !== 'TODOS') {
      sociosQuery.andWhere('UPPER(categoria.nombre) = :categoriaSocio', {
        categoriaSocio,
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

    const cuotasPorSocio = new Map<number, Map<string, string>>();
    for (const cuota of cuotasDelAnio) {
      if (!cuotasPorSocio.has(cuota.socioId)) {
        cuotasPorSocio.set(cuota.socioId, new Map());
      }
      const mes = cuota.periodo.split('-')[1];
      const cuotasMes = cuotasPorSocio.get(cuota.socioId)!;
      const estadoActual = cuotasMes.get(mes);

      if (estadoActual === EstadoCuota.PAGADA) {
        continue;
      }

      if (cuota.estado === EstadoCuota.PAGADA) {
        cuotasMes.set(mes, EstadoCuota.PAGADA);
        continue;
      }

      cuotasMes.set(mes, cuota.estado);
    }

    const sociosConPagos = socios.map((socio) => {
      const cuotasMes = cuotasPorSocio.get(socio.id) || new Map();
      const meses: Record<string, string | null> = {};
      for (let mes = 1; mes <= 12; mes++) {
        const mesKey = String(mes).padStart(2, '0');
        meses[mesKey] = cuotasMes.get(mesKey) || null;
      }
      return {
        socioId: socio.id,
        nombre: socio.nombre,
        apellido: socio.apellido,
        dni: socio.dni || undefined,
        estado: socio.estado,
        categoriaNombre: socio.categoria?.nombre ?? 'Sin categoria',
        meses,
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
        '(socio.nombre LIKE :busqueda OR socio.apellido LIKE :busqueda OR socio.dni LIKE :busqueda)',
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
        '(socio.nombre LIKE :busqueda OR socio.apellido LIKE :busqueda OR socio.dni LIKE :busqueda)',
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

    for (const periodo of periodos) {
      const cuotas = await this.cuotaRepository.find({
        where: { periodo },
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
      const morosidad = cuotas.length > 0 ? (pendientes.length / cuotas.length) * 100 : 0;

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
    }

    // Calcular promedios del consolidado
    const porcentajeCobranza =
      totalGenerado > 0 ? (totalCobrado / totalGenerado) * 100 : 0;
    const morosidad =
      totalCuotasPendientes + totalCuotasPagadas > 0
        ? (totalCuotasPendientes / (totalCuotasPendientes + totalCuotasPagadas)) * 100
        : 0;

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
      periodos.push(
        `${anioActual}-${String(mesActual).padStart(2, '0')}`,
      );

      mesActual++;
      if (mesActual > 12) {
        mesActual = 1;
        anioActual++;
      }
    }

    return periodos;
  }
}
