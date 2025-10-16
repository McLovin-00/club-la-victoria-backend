import { Socio } from '../entities/socio.entity';
import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { CreateSocioDto } from '../dto/create-socio.dto';
import { PAGINATION } from 'src/constants/pagination.constants';

@Injectable()
export class SocioRepository extends Repository<Socio> {
  constructor(private dataSource: DataSource) {
    super(Socio, dataSource.createEntityManager());
  }

  async findPaginatedAndFiltered(
    page: number = PAGINATION.DEFAULT_PAGE,
    limit: number = PAGINATION.DEFAULT_LIMIT,
    search?: string,
  ) {
    const query = this.createQueryBuilder('socio')
      .orderBy('socio.apellido', 'ASC')
      .addOrderBy('socio.nombre', 'ASC')
      .skip((page - 1) * limit)
      .take(limit);

    if (search) {
      query.andWhere(
        '(LOWER(socio.nombre) LIKE :search OR LOWER(socio.apellido) LIKE :search OR socio.dni LIKE :search OR LOWER(socio.email) LIKE :search)',
        { search: `%${search.toLowerCase()}%` },
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
    const socio = new Socio();

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

    // Handle photo fields if they exist
    if (createSocioDto.fotoUrl) {
      socio.fotoUrl = createSocioDto.fotoUrl;
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
