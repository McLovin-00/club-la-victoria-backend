import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, Repository } from 'typeorm';
import {
  Cobrador,
  CobradorComisionConfig,
  CobradorCuentaCorrienteMovimiento,
  CobradorDispositivo,
  TipoMovimientoCobrador,
} from './entities';
import {
  CobroOperacion,
  ActorCobro,
} from '../cobros/entities/cobro-operacion.entity';
import { TipoLineaCobro } from '../cobros/entities/cobro-operacion-linea.entity';
import { Socio } from '../socios/entities/socio.entity';
import { Cuota, EstadoCuota } from '../cobros/entities/cuota.entity';
import { GrupoFamiliar } from '../grupos-familiares/entities/grupo-familiar.entity';
import {
  ConfigurarComisionCobradorDto,
  RegistrarMovimientoCobradorDto,
  VincularCobradorDispositivoDto,
} from './dto';
import { CustomError } from '../constants/errors/custom-error';
import {
  ERROR_CODES,
  ERROR_MESSAGES,
} from '../constants/errors/error-messages';
import { normalizeComisionPorcentaje } from './utils/comision.util';

@Injectable()
export class CobradoresService {
  constructor(
    @InjectRepository(Cobrador)
    private readonly cobradorRepository: Repository<Cobrador>,
    @InjectRepository(CobradorDispositivo)
    private readonly dispositivoRepository: Repository<CobradorDispositivo>,
    @InjectRepository(CobroOperacion)
    private readonly operacionRepository: Repository<CobroOperacion>,
    @InjectRepository(CobradorComisionConfig)
    private readonly comisionConfigRepository: Repository<CobradorComisionConfig>,
    @InjectRepository(CobradorCuentaCorrienteMovimiento)
    private readonly movimientoRepository: Repository<CobradorCuentaCorrienteMovimiento>,
    @InjectRepository(Socio)
    private readonly socioRepository: Repository<Socio>,
    @InjectRepository(Cuota)
    private readonly cuotaRepository: Repository<Cuota>,
    @InjectRepository(GrupoFamiliar)
    private readonly grupoFamiliarRepository: Repository<GrupoFamiliar>,
  ) {}

  async findActivos(): Promise<Cobrador[]> {
    return this.cobradorRepository.find({
      where: { activo: true },
      order: { nombre: 'ASC' },
    });
  }

  async vincularDispositivo(
    dto: VincularCobradorDispositivoDto,
  ): Promise<CobradorDispositivo> {
    const existente = await this.dispositivoRepository.findOne({
      where: { installationId: dto.installationId },
      relations: ['cobrador'],
    });

    if (existente) {
      if (existente.cobradorId !== dto.cobradorId) {
        throw new CustomError(
          'Este dispositivo ya está vinculado a otro cobrador',
          409,
          ERROR_CODES.VALIDATION_ERROR,
        );
      }
      return existente;
    }

    const cobrador = await this.cobradorRepository.findOne({
      where: { id: dto.cobradorId, activo: true },
    });

    if (!cobrador) {
      throw new CustomError(
        'Cobrador no encontrado o inactivo',
        404,
        ERROR_CODES.SOCIO_NOT_FOUND,
      );
    }

    const vinculo = this.dispositivoRepository.create({
      installationId: dto.installationId,
      cobradorId: dto.cobradorId,
    });

    return this.dispositivoRepository.save(vinculo);
  }

  async obtenerCobranzasRango(cobradorId: number, desde: Date, hasta: Date) {
    const operaciones = await this.operacionRepository.find({
      where: {
        cobradorId,
        actorCobro: ActorCobro.COBRADOR,
        fechaHoraServidor: Between(desde, hasta),
      },
      relations: ['lineas', 'socio', 'metodoPago'],
      order: { fechaHoraServidor: 'DESC' },
    });

    const totalCobrado = operaciones.reduce(
      (acc, op) => acc + Number(op.total),
      0,
    );

    return {
      cobradorId,
      desde,
      hasta,
      totalCobrado,
      operaciones,
    };
  }

  async configurarComision(
    cobradorId: number,
    dto: ConfigurarComisionCobradorDto,
  ): Promise<CobradorComisionConfig> {
    const cobrador = await this.cobradorRepository.findOne({
      where: { id: cobradorId },
    });
    if (!cobrador) {
      throw new CustomError(
        'Cobrador no encontrado',
        404,
        ERROR_CODES.SOCIO_NOT_FOUND,
      );
    }

    const porcentajeNormalizado = normalizeComisionPorcentaje(dto.porcentaje);
    if (porcentajeNormalizado <= 0 || porcentajeNormalizado > 1) {
      throw new CustomError(
        'El porcentaje de comision debe estar entre 0 y 100',
        400,
        ERROR_CODES.VALIDATION_ERROR,
      );
    }

    const config = this.comisionConfigRepository.create({
      cobradorId,
      porcentaje: porcentajeNormalizado,
      vigenteDesde: new Date(dto.vigenteDesde),
    });

    return this.comisionConfigRepository.save(config);
  }

  async calcularComision(cobradorId: number, desde: Date, hasta: Date) {
    const operaciones = await this.operacionRepository.find({
      where: {
        cobradorId,
        actorCobro: ActorCobro.COBRADOR,
        fechaHoraServidor: Between(desde, hasta),
      },
      order: { fechaHoraServidor: 'ASC' },
    });

    const configs = await this.comisionConfigRepository.find({
      where: { cobradorId },
      order: { vigenteDesde: 'ASC' },
    });

    let base = 0;
    let comision = 0;

    for (const op of operaciones) {
      const monto = Number(op.total);
      base += monto;
      const configAplicable = [...configs]
        .reverse()
        .find((cfg) => cfg.vigenteDesde <= op.fechaHoraServidor);
      const porcentaje = normalizeComisionPorcentaje(
        Number(configAplicable?.porcentaje ?? 0),
      );
      comision += monto * porcentaje;
    }

    return {
      cobradorId,
      desde,
      hasta,
      base,
      comision,
      operaciones: operaciones.length,
    };
  }

  async listarCuentaCorriente(cobradorId: number) {
    const movimientos = await this.movimientoRepository.find({
      where: { cobradorId },
      relations: [
        'cobroOperacion',
        'cobroOperacion.socio',
        'cobroOperacion.lineas',
        'cobroOperacion.lineas.cuota',
      ],
      order: { createdAt: 'DESC' },
    });

    const saldo = movimientos.reduce((acc, mov) => {
      if (mov.tipoMovimiento === TipoMovimientoCobrador.COMISION_GENERADA) {
        return acc + Number(mov.monto);
      }
      if (mov.tipoMovimiento === TipoMovimientoCobrador.PAGO_A_COBRADOR) {
        return acc - Number(mov.monto);
      }
      return acc + Number(mov.monto);
    }, 0);

    return {
      cobradorId,
      saldo,
      movimientos: movimientos.map((movimiento) => {
        const lineasCuota = (movimiento.cobroOperacion?.lineas ?? []).filter(
          (linea) => linea.tipoLinea === TipoLineaCobro.CUOTA,
        );

        const detalleCobro = movimiento.cobroOperacion
          ? {
              fechaHoraCobro: movimiento.cobroOperacion.fechaHoraServidor,
              socio: movimiento.cobroOperacion.socio
                ? {
                    id: movimiento.cobroOperacion.socio.id,
                    nombre: movimiento.cobroOperacion.socio.nombre,
                    apellido: movimiento.cobroOperacion.socio.apellido,
                  }
                : undefined,
              cuotas: lineasCuota.map((linea) => ({
                cuotaId: linea.cuotaId,
                periodo: linea.cuota?.periodo,
                monto: Number(linea.monto),
              })),
            }
          : undefined;

        return {
          ...movimiento,
          detalleCobro,
        };
      }),
    };
  }

  async registrarPagoACobrador(
    cobradorId: number,
    dto: RegistrarMovimientoCobradorDto,
  ): Promise<CobradorCuentaCorrienteMovimiento> {
    if (dto.monto <= 0) {
      throw new CustomError(
        ERROR_MESSAGES.VALIDATION_ERROR,
        400,
        ERROR_CODES.VALIDATION_ERROR,
      );
    }

    const movimiento = this.movimientoRepository.create({
      cobradorId,
      tipoMovimiento: TipoMovimientoCobrador.PAGO_A_COBRADOR,
      monto: dto.monto,
      observacion: dto.observacion,
      referencia: dto.referencia,
      usuarioRegistra: dto.usuarioRegistra,
    });

    return this.movimientoRepository.save(movimiento);
  }

  async registrarAjuste(
    cobradorId: number,
    dto: RegistrarMovimientoCobradorDto,
  ): Promise<CobradorCuentaCorrienteMovimiento> {
    if (dto.monto === 0) {
      throw new CustomError(
        ERROR_MESSAGES.VALIDATION_ERROR,
        400,
        ERROR_CODES.VALIDATION_ERROR,
      );
    }

    const movimiento = this.movimientoRepository.create({
      cobradorId,
      tipoMovimiento: TipoMovimientoCobrador.AJUSTE,
      monto: dto.monto,
      observacion: dto.observacion,
      referencia: dto.referencia,
      usuarioRegistra: dto.usuarioRegistra,
    });

    return this.movimientoRepository.save(movimiento);
  }

  async buscarSociosMobile(query: string, limit: number = 50) {
    const term = (query || '').trim();
    const maxLimit = Math.min(limit, 100); // Cap at 100

    const queryBuilder = this.socioRepository
      .createQueryBuilder('socio')
      .leftJoin('socio.grupoFamiliar', 'grupo')
      .leftJoin('socio.cuotas', 'cuota', 'cuota.estado = :pendiente', {
        pendiente: EstadoCuota.PENDIENTE,
      })
      .where('socio.estado IN (:...estados)', {
        estados: ['ACTIVO', 'MOROSO'],
      })
      .select('socio.id', 'id')
      .addSelect('socio.nombre', 'nombre')
      .addSelect('socio.apellido', 'apellido')
      .addSelect('socio.dni', 'dni')
      .addSelect('socio.telefono', 'telefono')
      .addSelect('socio.estado', 'estado')
      .addSelect('grupo.id', 'grupoFamiliarId')
      .addSelect('grupo.nombre', 'grupoFamiliarNombre')
      .addSelect('COUNT(cuota.id)', 'cantidadCuotasPendientes')
      .groupBy('socio.id')
      .addGroupBy('socio.nombre')
      .addGroupBy('socio.apellido')
      .addGroupBy('socio.dni')
      .addGroupBy('socio.telefono')
      .addGroupBy('socio.estado')
      .addGroupBy('grupo.id')
      .addGroupBy('grupo.nombre')
      .orderBy('socio.apellido', 'ASC')
      .addOrderBy('socio.nombre', 'ASC')
      .limit(maxLimit);

    if (term) {
      queryBuilder.andWhere(
        'socio.nombre ILIKE :term OR socio.apellido ILIKE :term OR socio.dni ILIKE :term',
        {
          term: `%${term}%`,
        },
      );
    }

    const socios = await queryBuilder.getRawMany();

    return socios.map((socio) => ({
      id: Number(socio.id),
      nombre: socio.nombre,
      apellido: socio.apellido,
      dni: socio.dni ?? undefined,
      telefono: socio.telefono ?? undefined,
      estado: socio.estado,
      cantidadCuotasPendientes: Number(socio.cantidadCuotasPendientes),
      grupoFamiliar: socio.grupoFamiliarId
        ? {
            id: Number(socio.grupoFamiliarId),
            nombre: socio.grupoFamiliarNombre,
          }
        : undefined,
    }));
  }

  async cuotasPendientesSocioMobile(socioId: number) {
    return this.cuotaRepository.find({
      where: { socioId, estado: EstadoCuota.PENDIENTE },
      order: { periodo: 'ASC' },
    });
  }

  // ======================
  // GRUPOS FAMILIARES MOBILE
  // ======================

  /**
   * Obtiene todos los grupos familiares con resumen de miembros y deudas
   * para la app móvil de cobranzas
   */
  async getGruposFamiliaresMobile() {
    const grupos = await this.grupoFamiliarRepository
      .createQueryBuilder('grupo')
      .leftJoin('grupo.socios', 'socio')
      .leftJoin('socio.cuotas', 'cuota', 'cuota.estado = :pendiente', {
        pendiente: EstadoCuota.PENDIENTE,
      })
      .select('grupo.id', 'id')
      .addSelect('grupo.nombre', 'nombre')
      .addSelect('grupo.descripcion', 'descripcion')
      .addSelect('grupo.orden', 'orden')
      .addSelect('COUNT(DISTINCT socio.id)', 'cantidadMiembros')
      .addSelect(
        'COUNT(DISTINCT CASE WHEN cuota.id IS NOT NULL THEN socio.id END)',
        'miembrosConDeuda',
      )
      .addSelect('COALESCE(SUM(cuota.monto), 0)', 'totalPendiente')
      .groupBy('grupo.id')
      .orderBy('grupo.orden', 'ASC')
      .addOrderBy('grupo.nombre', 'ASC')
      .getRawMany();

    return grupos.map((g) => ({
      id: g.id,
      nombre: g.nombre,
      descripcion: g.descripcion,
      orden: g.orden,
      cantidadMiembros: Number(g.cantidadMiembros),
      miembrosConDeuda: Number(g.miembrosConDeuda),
      totalPendiente: Number(g.totalPendiente),
    }));
  }

  /**
   * Obtiene el detalle de un grupo familiar con todos sus miembros
   * y sus cuotas pendientes para la app móvil
   */
  async getGrupoFamiliarMobile(grupoId: number) {
    const grupo = await this.grupoFamiliarRepository.findOne({
      where: { id: grupoId },
    });

    if (!grupo) {
      throw new CustomError(
        ERROR_MESSAGES.GRUPO_FAMILIAR_NOT_FOUND,
        404,
        ERROR_CODES.GRUPO_FAMILIAR_NOT_FOUND,
      );
    }

    // Obtener miembros con sus cuotas pendientes
    const miembros = await this.socioRepository
      .createQueryBuilder('socio')
      .leftJoinAndSelect('socio.grupoFamiliar', 'grupo')
      .leftJoin('socio.cuotas', 'cuota', 'cuota.estado = :pendiente', {
        pendiente: EstadoCuota.PENDIENTE,
      })
      .where('socio.grupoFamiliar = :grupoId', { grupoId })
      .andWhere('socio.estado IN (:...estados)', {
        estados: ['ACTIVO', 'MOROSO'],
      })
      .select('socio.id', 'id')
      .addSelect('socio.nombre', 'nombre')
      .addSelect('socio.apellido', 'apellido')
      .addSelect('socio.dni', 'dni')
      .addSelect('socio.telefono', 'telefono')
      .addSelect('COUNT(cuota.id)', 'cantidadCuotasPendientes')
      .addSelect('COALESCE(SUM(cuota.monto), 0)', 'totalPendiente')
      .groupBy('socio.id')
      .orderBy('socio.apellido', 'ASC')
      .addOrderBy('socio.nombre', 'ASC')
      .getRawMany();

    // Para cada miembro con deuda, obtener el detalle de cuotas
    const miembrosConCuotas = await Promise.all(
      miembros.map(async (m) => {
        let cuotasPendientes: Array<{
          id: number;
          periodo: string;
          monto: number;
        }> = [];

        if (Number(m.cantidadCuotasPendientes) > 0) {
          cuotasPendientes = await this.cuotaRepository.find({
            where: { socioId: m.id, estado: EstadoCuota.PENDIENTE },
            select: ['id', 'periodo', 'monto'],
            order: { periodo: 'ASC' },
          });
        }

        return {
          id: m.id,
          nombre: m.nombre,
          apellido: m.apellido,
          dni: m.dni,
          telefono: m.telefono,
          cantidadCuotasPendientes: Number(m.cantidadCuotasPendientes),
          totalPendiente: Number(m.totalPendiente),
          cuotasPendientes,
        };
      }),
    );

    const totalPendienteGrupo = miembrosConCuotas.reduce(
      (acc, m) => acc + m.totalPendiente,
      0,
    );

    return {
      id: grupo.id,
      nombre: grupo.nombre,
      descripcion: grupo.descripcion,
      orden: grupo.orden,
      cantidadMiembros: miembros.length,
      miembrosConDeuda: miembros.filter((m) => m.cantidadCuotasPendientes > 0)
        .length,
      totalPendiente: totalPendienteGrupo,
      miembros: miembrosConCuotas,
    };
  }
}
