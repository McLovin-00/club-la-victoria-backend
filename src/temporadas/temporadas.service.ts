import { Injectable, Logger } from '@nestjs/common';
import { TemporadaPiletaRepository } from './repositories/temporada.repository';
import { CreateTemporadaDto } from './dto/create-temporada.dto';
import { SocioRepository } from 'src/socios/repositories/socio.repository';
import { AsociacionesRepository } from 'src/asociaciones/repositories/asociaciones.repository';
import { RegistroIngresoRepository } from 'src/registro-ingreso/repositories/registro-ingreso.repository';
import { TipoIngreso } from 'src/registro-ingreso/entities/registro-ingreso.entity';
import { CustomError } from 'src/constants/errors/custom-error';
import { PAGINATION } from 'src/constants/pagination.constants';
import {
  ERROR_MESSAGES,
  ERROR_CODES,
} from 'src/constants/errors/error-messages';

@Injectable()
export class TemporadasService {
  private readonly logger = new Logger(TemporadasService.name);

  constructor(
    private readonly temporadaRepository: TemporadaPiletaRepository,
    private readonly socioRepository: SocioRepository,
    private readonly asociacionesRepository: AsociacionesRepository,
    private readonly registroIngresoRepository: RegistroIngresoRepository,
  ) {}

  private async validarFechasNoSolapadas(
    fechaInicio: string,
    fechaFin: string,
    excluirId?: number,
  ) {
    const queryBuilder = this.temporadaRepository
      .createQueryBuilder('temporada')
      .where(
        '(temporada.fechaInicio <= :fechaFin AND temporada.fechaFin >= :fechaInicio)',
      )
      .setParameters({ fechaInicio, fechaFin });

    // Si estamos actualizando, excluir la temporada actual del chequeo
    if (excluirId) {
      queryBuilder.andWhere('temporada.id != :excluirId', { excluirId });
    }

    const temporadasSolapadas = await queryBuilder.getMany();

    if (temporadasSolapadas.length > 0) {
      const temporadaConflicto = temporadasSolapadas[0];
      throw new CustomError(
        `${ERROR_MESSAGES.OVERLAPPING_SEASONS}: ${temporadaConflicto.nombre} (${temporadaConflicto.fechaInicio} a ${temporadaConflicto.fechaFin})`,
        400,
        ERROR_CODES.OVERLAPPING_SEASONS,
      );
    }
  }

  async create(createTemporadaDto: CreateTemporadaDto) {
    // Validar que las fechas no se solapen con temporadas existentes
    await this.validarFechasNoSolapadas(
      createTemporadaDto.fechaInicio,
      createTemporadaDto.fechaFin,
    );

    return this.temporadaRepository.save({ ...createTemporadaDto });
  }

  findAll() {
    return this.temporadaRepository.find({ order: { fechaInicio: 'DESC' } });
  }

  findOne(id: number) {
    return this.temporadaRepository.findOne({ where: { id } });
  }

  async update(id: number, updateTemporadaDto: CreateTemporadaDto) {
    // Validar que las fechas no se solapen con temporadas existentes (excluyendo la actual)
    await this.validarFechasNoSolapadas(
      updateTemporadaDto.fechaInicio,
      updateTemporadaDto.fechaFin,
      id,
    );

    return this.temporadaRepository.update(id, updateTemporadaDto);
  }

  remove(id: number) {
    return this.temporadaRepository.delete(id);
  }

  async getTemporadaActual() {
    const hoy = new Date().toISOString().split('T')[0];

    return this.temporadaRepository
      .createQueryBuilder('temporada')
      .where('temporada.fechaInicio <= :hoy')
      .andWhere('temporada.fechaFin >= :hoy')
      .setParameters({ hoy })
      .getOne();
  }

  /**
   * Verifica si una temporada tiene registros de ingreso de pileta asociados
   * Un registro está asociado a una temporada si su fecha de ingreso está dentro del rango de la temporada
   */
  async tieneRegistrosPileta(
    id: number,
  ): Promise<{ tieneRegistros: boolean; cantidad: number }> {
    const temporada = await this.temporadaRepository.findOne({ where: { id } });

    if (!temporada) {
      throw new CustomError(
        ERROR_MESSAGES.TEMPORADA_NOT_FOUND,
        404,
        ERROR_CODES.TEMPORADA_NOT_FOUND,
      );
    }

    const cantidad = await this.registroIngresoRepository
      .createQueryBuilder('registro')
      .where('registro.tipoIngreso = :tipoIngreso', {
        tipoIngreso: TipoIngreso.SOCIO_PILETA,
      })
      .andWhere('registro.fechaHoraIngreso >= :fechaInicio', {
        fechaInicio: temporada.fechaInicio,
      })
      .andWhere('registro.fechaHoraIngreso <= :fechaFin', {
        fechaFin: `${temporada.fechaFin} 23:59:59`,
      })
      .getCount();

    return {
      tieneRegistros: cantidad > 0,
      cantidad,
    };
  }

  async getSocios(id: number) {
    // Optimizado: QueryBuilder en lugar de find + map
    const socios = await this.asociacionesRepository
      .createQueryBuilder('asociacion')
      .innerJoinAndSelect('asociacion.socio', 'socio')
      .where('asociacion.temporada.id = :id', { id })
      .select([
        'asociacion.id',
        'socio.id',
        'socio.nombre',
        'socio.apellido',
        'socio.dni',
        'socio.email',
        'socio.telefono',
        'socio.fechaNacimiento',
        'socio.direccion',
        'socio.estado',
        'socio.genero',
        'socio.fotoUrl',
        'socio.fechaAlta',
      ])
      .orderBy('socio.apellido', 'ASC')
      .addOrderBy('socio.nombre', 'ASC')
      .getMany();

    return socios.map((asociacion) => ({
      id: asociacion.socio.id,
      socio: asociacion.socio,
    }));
  }

  async agregarSocioATemporada(id: number, socioId: number) {
    const nuevaAsociacion = this.asociacionesRepository.create({
      socio: { id: socioId },
      temporada: { id: id },
    });

    return this.asociacionesRepository.save(nuevaAsociacion);
  }

  async eliminarSocioDeTemporada(id: number, socioId: number) {
    const asociacion = await this.asociacionesRepository.findOne({
      where: { temporada: { id }, socio: { id: socioId } },
    });

    if (!asociacion) {
      throw new CustomError(
        ERROR_MESSAGES.ASOCIACION_NOT_FOUND,
        404,
        ERROR_CODES.ASOCIACION_NOT_FOUND,
      );
    }

    return this.asociacionesRepository.remove(asociacion);
  }

  async getSociosDisponibles(
    temporadaId: number,
    page: number = PAGINATION.DEFAULT_PAGE,
    limit: number = PAGINATION.DEFAULT_LIMIT,
    search?: string,
  ) {
    // Get all members already in this season
    const asociaciones = await this.asociacionesRepository.find({
      where: { temporada: { id: temporadaId } },
      relations: { socio: true },
    });

    const sociosEnTemporada = asociaciones.map(
      (asociacion) => asociacion.socio.id,
    );

    // Build query for available members (not in current season)
    const queryBuilder = this.socioRepository.createQueryBuilder('socio');

    // Exclude members already in the season
    if (sociosEnTemporada.length > 0) {
      queryBuilder.andWhere('socio.id NOT IN (:...sociosEnTemporada)', {
        sociosEnTemporada,
      });
    }

    // Add search filter if provided
    if (search && search.trim()) {
      queryBuilder.andWhere(
        '(unaccent(socio.nombre) ILIKE unaccent(:search) OR unaccent(socio.apellido) ILIKE unaccent(:search) OR socio.dni ILIKE :search OR unaccent(socio.email) ILIKE unaccent(:search))',
        { search: `%${search.trim()}%` },
      );
    }

    // Add pagination
    const offset = (page - 1) * limit;
    queryBuilder
      .orderBy('socio.apellido', 'ASC')
      .addOrderBy('socio.nombre', 'ASC')
      .skip(offset)
      .take(limit);

    const [socios, total] = await queryBuilder.getManyAndCount();

    return {
      data: socios,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }
}
