import { Socio } from '../entities/socio.entity';
import { Injectable, Logger } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { CreateSocioDto } from '../dto/create-socio.dto';
import { PAGINATION } from 'src/constants/pagination.constants';

@Injectable()
export class SocioRepository extends Repository<Socio> {
  private readonly logger = new Logger(SocioRepository.name);
  constructor(private dataSource: DataSource) {
    super(Socio, dataSource.createEntityManager());
  }

  async findPaginatedAndFiltered(
    page: number = PAGINATION.DEFAULT_PAGE,
    limit: number = PAGINATION.DEFAULT_LIMIT,
    search?: string,
  ) {
    const query = this.createQueryBuilder('socio')
      .leftJoinAndSelect('socio.categoria', 'categoria')
      .orderBy('socio.apellido', 'ASC')
      .addOrderBy('socio.nombre', 'ASC')
      .skip((page - 1) * limit)
      .take(limit);

    if (search) {
      query.andWhere(
        '(unaccent(socio.nombre) ILIKE unaccent(:search) OR unaccent(socio.apellido) ILIKE unaccent(:search) OR socio.dni ILIKE :search OR unaccent(socio.email) ILIKE unaccent(:search))',
        { search: `%${search}%` },
      );
    }

    const [data, total] = await query.getManyAndCount();

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async createSocio(
    createSocioDto: CreateSocioDto & { fotoUrl?: string; fechaAlta: string },
  ) {
    this.logger.debug(
      `createSocio - overrideManual recibido: ${createSocioDto.overrideManual} (tipo: ${typeof createSocioDto.overrideManual})`,
    );
    const socio = new Socio();

    // Required fields

    // Required fields
    socio.nombre = createSocioDto.nombre;
    socio.apellido = createSocioDto.apellido;

    socio.dni = createSocioDto.dni;
    socio.telefono = createSocioDto.telefono;
    socio.email = createSocioDto.email;
    socio.fechaNacimiento = createSocioDto.fechaNacimiento;
    socio.fechaAlta = createSocioDto.fechaAlta;
    socio.genero = createSocioDto.genero;
    socio.estado = createSocioDto.estado;
    socio.direccion = createSocioDto.direccion;
    socio.tarjetaCentro = createSocioDto.tarjetaCentro ?? false;
    socio.numeroTarjetaCentro = createSocioDto.tarjetaCentro
      ? createSocioDto.numeroTarjetaCentro
      : undefined;

    // Handle photo fields if they exist
    if (createSocioDto.fotoUrl) {
      socio.fotoUrl = createSocioDto.fotoUrl;
    }

    // Handle override manual and categoria
    this.logger.debug(
      `Antes de asignar - socio.overrideManual: ${socio.overrideManual}`,
    );
    if (createSocioDto.overrideManual !== undefined) {
      socio.overrideManual = createSocioDto.overrideManual;
      this.logger.debug(`Asignado overrideManual: ${socio.overrideManual}`);
    } else {
      this.logger.debug(
        'overrideManual es undefined, NO se asigna (usará default de DB)',
      );
    }

    if (createSocioDto.categoriaId) {
      socio.categoria = { id: createSocioDto.categoriaId } as any;
    }

    return await this.save(socio);
  }

  async findByDni(dni: string) {
    return this.findOne({ where: { dni } });
  }

  async updateSocio(existingSocio: Socio, updateData: Partial<Socio>) {
    Object.assign(existingSocio, updateData);
    return await this.save(existingSocio);
  }
}
