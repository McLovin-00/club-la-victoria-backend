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
  ActualizarMovimientoCobradorDto,
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
      relations: ['lineas', 'lineas.cuota', 'socio', 'metodoPago'],
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


  async obtenerComisionVigente(cobradorId: number) {
    const configs = await this.comisionConfigRepository.find({
      where: { cobradorId },
      order: { vigenteDesde: 'DESC' },
    });

    const ahora = new Date();
    const configVigente = configs.find(
      (cfg) => cfg.vigenteDesde <= ahora,
    );

    return {
      cobradorId,
      porcentaje: configVigente
        ? normalizeComisionPorcentaje(Number(configVigente.porcentaje)) * 100
        : 0,
      vigenteDesde: configVigente?.vigenteDesde ?? null,
    };
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
        'cobroOperacion.socio.grupoFamiliar',
        'cobroOperacion.metodoPago',
        'cobroOperacion.lineas',
        'cobroOperacion.lineas.cuota',
        'cobroOperacion.pagos',
        'cobroOperacion.pagos.metodoPago',
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

        const lineasConcepto = (movimiento.cobroOperacion?.lineas ?? []).filter(
          (linea) => linea.tipoLinea === TipoLineaCobro.CONCEPTO,
        );

        // Agrupar metodos de pago desde los pagos individuales (PagoCuota)
        const metodosPagoMap = new Map<number, { id: number; nombre: string; monto: number }>();
        const pagosOperacion = movimiento.cobroOperacion?.pagos ?? [];
        
        for (const pago of pagosOperacion) {
          if (pago.metodoPago) {
            const existing = metodosPagoMap.get(pago.metodoPago.id);
            if (existing) {
              existing.monto += Number(pago.montoPagado);
            } else {
              metodosPagoMap.set(pago.metodoPago.id, {
                id: pago.metodoPago.id,
                nombre: pago.metodoPago.nombre,
                monto: Number(pago.montoPagado),
              });
            }
          }
        }
        
        // Si no hay pagos individuales, usar el metodoPago de la operacion como fallback
        const metodosPago = metodosPagoMap.size > 0 
          ? Array.from(metodosPagoMap.values())
          : movimiento.cobroOperacion?.metodoPago
            ? [{
                id: movimiento.cobroOperacion.metodoPago.id,
                nombre: movimiento.cobroOperacion.metodoPago.nombre,
                monto: Number(movimiento.cobroOperacion.total),
              }]
            : [];

        const detalleCobro = movimiento.cobroOperacion
          ? {
              fechaHoraCobro: movimiento.cobroOperacion.fechaHoraServidor,
              socio: movimiento.cobroOperacion.socio
                ? {
                    id: movimiento.cobroOperacion.socio.id,
                    nombre: movimiento.cobroOperacion.socio.nombre,
                    apellido: movimiento.cobroOperacion.socio.apellido,
                    grupoFamiliar: movimiento.cobroOperacion.socio.grupoFamiliar
                      ? {
                          id: movimiento.cobroOperacion.socio.grupoFamiliar.id,
                          nombre: movimiento.cobroOperacion.socio.grupoFamiliar.nombre,
                        }
                      : undefined,
                  }
                : undefined,
              cuotas: lineasCuota.map((linea) => ({
                cuotaId: linea.cuotaId,
                periodo: linea.cuota?.periodo,
                monto: Number(linea.monto),
              })),
              conceptos: lineasConcepto.map((linea) => ({
                concepto: linea.concepto,
                descripcion: linea.descripcion,
                monto: Number(linea.monto),
              })),
              metodosPago,
            }
          : undefined;

        return {
          id: movimiento.id,
          tipoMovimiento: movimiento.tipoMovimiento,
          monto: Number(movimiento.monto),
          createdAt: movimiento.createdAt,
          usuarioRegistra: movimiento.usuarioRegistra,
          observacion: movimiento.observacion,
          referencia: movimiento.referencia,
          detalleCobro,
        };
      }),
    };
  }

  async buscarSociosMobile(query: string, limit: number = 20) {
    const search = query?.trim();

    const qb = this.socioRepository
      .createQueryBuilder('socio')
      .leftJoin('socio.grupoFamiliar', 'grupoFamiliar')
      .leftJoin(
        'socio.cuotas',
        'cuotaPendiente',
        'cuotaPendiente.estado = :estadoPendiente',
        { estadoPendiente: EstadoCuota.PENDIENTE },
      )
      .where('socio.estado IN (:...estados)', { estados: ['ACTIVO', 'MOROSO'] })
      .select('socio.id', 'id')
      .addSelect('socio.nombre', 'nombre')
      .addSelect('socio.apellido', 'apellido')
      .addSelect('socio.dni', 'dni')
      .addSelect('socio.telefono', 'telefono')
      .addSelect('socio.estado', 'estado')
      .addSelect('grupoFamiliar.id', 'grupoFamiliarId')
      .addSelect('grupoFamiliar.nombre', 'grupoFamiliarNombre')
      .addSelect('COUNT(DISTINCT cuotaPendiente.id)', 'cantidadCuotasPendientes')
      .groupBy('socio.id')
      .addGroupBy('grupoFamiliar.id')
      .addGroupBy('grupoFamiliar.nombre')
      .orderBy('socio.apellido', 'ASC')
      .addOrderBy('socio.nombre', 'ASC')
      .limit(limit);

    if (search) {
      qb.andWhere(
        '(unaccent(socio.nombre) ILIKE unaccent(:term) OR unaccent(socio.apellido) ILIKE unaccent(:term) OR socio.dni LIKE :term)',
        { term: `%${search}%` },
      );
    }

    const rows = await qb.getRawMany();

    return rows.map((row) => ({
      id: Number(row.id),
      nombre: row.nombre,
      apellido: row.apellido,
      dni: row.dni,
      telefono: row.telefono ?? undefined,
      estado: row.estado,
      cantidadCuotasPendientes: Number(row.cantidadCuotasPendientes ?? 0),
      grupoFamiliar: row.grupoFamiliarId
        ? {
            id: Number(row.grupoFamiliarId),
            nombre: row.grupoFamiliarNombre,
          }
        : undefined,
    }));
  }

  async cuotasPendientesSocioMobile(socioId: number) {
    const cuotas = await this.cuotaRepository.find({
      where: { socioId, estado: EstadoCuota.PENDIENTE },
      order: { periodo: 'ASC' },
    });

    return cuotas.map((cuota) => ({
      id: cuota.id,
      periodo: cuota.periodo,
      monto: Number(cuota.monto),
      estado: cuota.estado,
    }));
  }

  async getGruposFamiliaresMobile() {
    const rows = await this.grupoFamiliarRepository
      .createQueryBuilder('grupo')
      .leftJoin('grupo.socios', 'socio')
      .leftJoin(
        'socio.cuotas',
        'cuotaPendiente',
        'cuotaPendiente.estado = :estadoPendiente',
        { estadoPendiente: EstadoCuota.PENDIENTE },
      )
      .select('grupo.id', 'id')
      .addSelect('grupo.nombre', 'nombre')
      .addSelect('grupo.descripcion', 'descripcion')
      .addSelect('grupo.orden', 'orden')
      .addSelect('COUNT(DISTINCT socio.id)', 'cantidadMiembros')
      .addSelect(
        'COUNT(DISTINCT CASE WHEN cuotaPendiente.id IS NOT NULL THEN socio.id END)',
        'miembrosConDeuda',
      )
      .addSelect('COALESCE(SUM(cuotaPendiente.monto), 0)', 'totalPendiente')
      .groupBy('grupo.id')
      .orderBy('grupo.orden', 'ASC')
      .addOrderBy('grupo.nombre', 'ASC')
      .getRawMany();

    return rows.map((row) => ({
      id: Number(row.id),
      nombre: row.nombre,
      descripcion: row.descripcion ?? undefined,
      orden: Number(row.orden ?? 0),
      cantidadMiembros: Number(row.cantidadMiembros ?? 0),
      miembrosConDeuda: Number(row.miembrosConDeuda ?? 0),
      totalPendiente: Number(row.totalPendiente ?? 0),
    }));
  }

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

    const miembrosRaw = await this.socioRepository
      .createQueryBuilder('socio')
      .leftJoin(
        'socio.cuotas',
        'cuotaPendiente',
        'cuotaPendiente.estado = :estadoPendiente',
        { estadoPendiente: EstadoCuota.PENDIENTE },
      )
      .select('socio.id', 'id')
      .addSelect('socio.nombre', 'nombre')
      .addSelect('socio.apellido', 'apellido')
      .addSelect('socio.dni', 'dni')
      .addSelect('socio.telefono', 'telefono')
      .addSelect('COUNT(DISTINCT cuotaPendiente.id)', 'cantidadCuotasPendientes')
      .addSelect('COALESCE(SUM(cuotaPendiente.monto), 0)', 'totalPendiente')
      .where('socio.id_grupo_familiar = :grupoId', { grupoId })
      .groupBy('socio.id')
      .orderBy('socio.apellido', 'ASC')
      .addOrderBy('socio.nombre', 'ASC')
      .getRawMany();

    const miembros = miembrosRaw.map((row) => ({
      id: Number(row.id),
      nombre: row.nombre,
      apellido: row.apellido,
      dni: row.dni,
      telefono: row.telefono ?? undefined,
      cantidadCuotasPendientes: Number(row.cantidadCuotasPendientes ?? 0),
      totalPendiente: Number(row.totalPendiente ?? 0),
    }));

    const miembrosConDeuda = miembros.filter(
      (miembro) => miembro.cantidadCuotasPendientes > 0,
    ).length;
    const totalPendiente = miembros.reduce(
      (acumulado, miembro) => acumulado + miembro.totalPendiente,
      0,
    );

    return {
      id: grupo.id,
      nombre: grupo.nombre,
      descripcion: grupo.descripcion,
      orden: grupo.orden,
      cantidadMiembros: miembros.length,
      miembrosConDeuda,
      totalPendiente,
      miembros,
    };
  }

  async registrarPagoACobrador(
    cobradorId: number,
    dto: RegistrarMovimientoCobradorDto,
  ) {
    if (!dto.monto || dto.monto <= 0) {
      throw new CustomError(
        'El monto debe ser mayor a cero',
        400,
        ERROR_CODES.VALIDATION_ERROR,
      );
    }

    const movimiento = this.movimientoRepository.create({
      cobradorId,
      tipoMovimiento: TipoMovimientoCobrador.PAGO_A_COBRADOR,
      monto: dto.monto,
      usuarioRegistra: dto.usuarioRegistra,
      observacion: dto.observacion,
      referencia: dto.referencia,
    });

    return this.movimientoRepository.save(movimiento);
  }

  async registrarAjuste(cobradorId: number, dto: RegistrarMovimientoCobradorDto) {
    if (!dto.monto || dto.monto === 0) {
      throw new CustomError(
        'El monto del ajuste no puede ser cero',
        400,
        ERROR_CODES.VALIDATION_ERROR,
      );
    }

    const movimiento = this.movimientoRepository.create({
      cobradorId,
      tipoMovimiento: TipoMovimientoCobrador.AJUSTE,
      monto: dto.monto,
      usuarioRegistra: dto.usuarioRegistra,
      observacion: dto.observacion,
      referencia: dto.referencia,
    });

    return this.movimientoRepository.save(movimiento);
  }

  async actualizarPago(
    cobradorId: number,
    movimientoId: number,
    dto: ActualizarMovimientoCobradorDto,
  ) {
    const movimiento = await this.movimientoRepository.findOne({
      where: {
        id: movimientoId,
        cobradorId,
        tipoMovimiento: TipoMovimientoCobrador.PAGO_A_COBRADOR,
      },
    });

    if (!movimiento) {
      throw new CustomError(
        'Pago no encontrado',
        404,
        ERROR_CODES.REGISTRO_NOT_FOUND,
      );
    }

    // Verificar que no tenga detalle de cobro asociado (solo pagos manuales)
    if (movimiento.cobroOperacionId) {
      throw new CustomError(
        'No se puede modificar un pago que tiene operaciones de cobro asociadas',
        400,
        ERROR_CODES.VALIDATION_ERROR,
      );
    }

    if (dto.monto !== undefined) {
      if (dto.monto <= 0) {
        throw new CustomError(
          'El monto debe ser mayor a cero',
          400,
          ERROR_CODES.VALIDATION_ERROR,
        );
      }
      movimiento.monto = dto.monto;
    }

    if (dto.referencia !== undefined) {
      movimiento.referencia = dto.referencia;
    }

    if (dto.usuarioRegistra) {
      movimiento.usuarioRegistra = dto.usuarioRegistra;
    }

    return this.movimientoRepository.save(movimiento);
  }
}
