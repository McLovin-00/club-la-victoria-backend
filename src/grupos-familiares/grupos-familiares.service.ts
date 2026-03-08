import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, In } from 'typeorm';
import { GrupoFamiliar } from './entities/grupo-familiar.entity';
import { Socio } from '../socios/entities/socio.entity';
import {
  CreateGrupoFamiliarDto,
  UpdateGrupoFamiliarDto,
  AsignarSociosDto,
} from './dto';
import { CustomError } from 'src/constants/errors/custom-error';
import {
  ERROR_MESSAGES,
  ERROR_CODES,
} from 'src/constants/errors/error-messages';

export interface GrupoFamiliarConCantidad extends GrupoFamiliar {
  cantidadSocios: number;
}

export interface SocioSinGrupo {
  id: number;
  nombre: string;
  apellido: string;
  dni?: string;
  telefono?: string;
}

@Injectable()
export class GruposFamiliaresService {
  private readonly logger = new Logger(GruposFamiliaresService.name);

  constructor(
    @InjectRepository(GrupoFamiliar)
    private readonly grupoRepository: Repository<GrupoFamiliar>,
    @InjectRepository(Socio)
    private readonly socioRepository: Repository<Socio>,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Crea un nuevo grupo familiar
   */
  async create(dto: CreateGrupoFamiliarDto): Promise<GrupoFamiliar> {
    try {
      // Verificar si ya existe un grupo con el mismo nombre
      const existente = await this.grupoRepository.findOne({
        where: { nombre: dto.nombre },
      });

      if (existente) {
        throw new CustomError(
          ERROR_MESSAGES.GRUPO_FAMILIAR_NAME_EXISTS,
          409,
          ERROR_CODES.GRUPO_FAMILIAR_NAME_EXISTS,
        );
      }

      const grupo = this.grupoRepository.create({
        nombre: dto.nombre,
        descripcion: dto.descripcion,
        orden: dto.orden ?? 0,
      });

      return await this.grupoRepository.save(grupo);
    } catch (error) {
      this.logger.error(
        'Error creando grupo familiar',
        error instanceof Error ? error.stack : String(error),
      );
      if (error instanceof CustomError) {
        throw error;
      }
      throw new CustomError(
        ERROR_MESSAGES.ERROR_CREATING_GRUPO_FAMILIAR,
        500,
        ERROR_CODES.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Obtiene todos los grupos familiares ordenados por campo orden
   */
  async findAll(): Promise<GrupoFamiliarConCantidad[]> {
    const grupos = await this.grupoRepository
      .createQueryBuilder('grupo')
      .leftJoin('grupo.socios', 'socio')
      .select('grupo')
      .addSelect('COUNT(socio.id_socio)', 'cantidadSocios')
      .groupBy('grupo.id_grupo_familiar')
      .orderBy('grupo.orden', 'ASC')
      .addOrderBy('grupo.nombre', 'ASC')
      .getRawAndEntities();

    return grupos.entities.map((grupo, index) => ({
      ...grupo,
      cantidadSocios: Number(grupos.raw[index]?.cantidadSocios ?? 0),
    }));
  }

  /**
   * Obtiene un grupo familiar por ID con sus socios
   */
  async findOne(id: number): Promise<GrupoFamiliar> {
    const grupo = await this.grupoRepository.findOne({
      where: { id },
      relations: ['socios'],
    });

    if (!grupo) {
      throw new CustomError(
        ERROR_MESSAGES.GRUPO_FAMILIAR_NOT_FOUND,
        404,
        ERROR_CODES.GRUPO_FAMILIAR_NOT_FOUND,
      );
    }

    return grupo;
  }

  /**
   * Actualiza un grupo familiar
   */
  async update(
    id: number,
    dto: UpdateGrupoFamiliarDto,
  ): Promise<GrupoFamiliar> {
    try {
      const grupo = await this.findOne(id);

      // Si se está actualizando el nombre, verificar que no exista otro con el mismo nombre
      if (dto.nombre && dto.nombre !== grupo.nombre) {
        const existente = await this.grupoRepository.findOne({
          where: { nombre: dto.nombre },
        });

        if (existente) {
          throw new CustomError(
            ERROR_MESSAGES.GRUPO_FAMILIAR_NAME_EXISTS,
            409,
            ERROR_CODES.GRUPO_FAMILIAR_NAME_EXISTS,
          );
        }
      }

      if (dto.nombre !== undefined) grupo.nombre = dto.nombre;
      if (dto.descripcion !== undefined) grupo.descripcion = dto.descripcion;
      if (dto.orden !== undefined) grupo.orden = dto.orden;

      return await this.grupoRepository.save(grupo);
    } catch (error) {
      this.logger.error(
        `Error actualizando grupo familiar ${id}`,
        error instanceof Error ? error.stack : String(error),
      );
      if (error instanceof CustomError) {
        throw error;
      }
      throw new CustomError(
        ERROR_MESSAGES.ERROR_UPDATING_GRUPO_FAMILIAR,
        500,
        ERROR_CODES.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Elimina un grupo familiar (los socios quedan sin grupo - SET NULL)
   */
  async remove(id: number): Promise<void> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const grupo = await this.findOne(id);

      // Primero, desasignar todos los socios del grupo (SET NULL manual)
      await queryRunner.manager.update(
        Socio,
        { grupoFamiliar: { id: grupo.id } },
        { grupoFamiliar: undefined as unknown as GrupoFamiliar },
      );

      // Luego eliminar el grupo
      await queryRunner.manager.remove(grupo);

      await queryRunner.commitTransaction();
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(
        `Error eliminando grupo familiar ${id}`,
        error instanceof Error ? error.stack : String(error),
      );
      if (error instanceof CustomError) {
        throw error;
      }
      throw new CustomError(
        ERROR_MESSAGES.ERROR_DELETING_GRUPO_FAMILIAR,
        500,
        ERROR_CODES.INTERNAL_SERVER_ERROR,
      );
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Asigna múltiples socios a un grupo familiar
   */
  async asignarSocios(
    grupoId: number,
    dto: AsignarSociosDto,
  ): Promise<{ grupo: GrupoFamiliar; sociosAsignados: number }> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Verificar que el grupo existe
      const grupo = await this.findOne(grupoId);

      // Verificar que todos los socios existen
      const socios = await queryRunner.manager.find(Socio, {
        where: { id: In(dto.socioIds) },
      });

      if (socios.length !== dto.socioIds.length) {
        const idsEncontrados = socios.map((s) => s.id);
        const idsInvalidos = dto.socioIds.filter(
          (id) => !idsEncontrados.includes(id),
        );
        throw new CustomError(
          `${ERROR_MESSAGES.SOCIO_IDS_INVALIDOS}: ${idsInvalidos.join(', ')}`,
          400,
          ERROR_CODES.SOCIO_IDS_INVALIDOS,
        );
      }

      // Asignar los socios al grupo
      await queryRunner.manager.update(
        Socio,
        { id: In(dto.socioIds) },
        { grupoFamiliar: grupo },
      );

      await queryRunner.commitTransaction();

      // Retornar el grupo actualizado con los socios
      const grupoActualizado = await this.findOne(grupoId);
      return {
        grupo: grupoActualizado,
        sociosAsignados: dto.socioIds.length,
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(
        `Error asignando socios al grupo ${grupoId}`,
        error instanceof Error ? error.stack : String(error),
      );
      if (error instanceof CustomError) {
        throw error;
      }
      throw new CustomError(
        ERROR_MESSAGES.ERROR_UPDATING_GRUPO_FAMILIAR,
        500,
        ERROR_CODES.INTERNAL_SERVER_ERROR,
      );
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Desasigna un socio de su grupo familiar
   */
  async desasignarSocio(socioId: number): Promise<void> {
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

    // Usar update directo para setear la FK a null
    await this.socioRepository.update(
      { id: socioId },
      { grupoFamiliar: null as unknown as GrupoFamiliar },
    );
  }

  /**
   * Obtiene la lista de socios sin grupo familiar asignado
   */
  async findSociosSinGrupo(): Promise<SocioSinGrupo[]> {
    const socios = await this.socioRepository
      .createQueryBuilder('socio')
      .where('socio.grupoFamiliar IS NULL')
      .orderBy('socio.apellido', 'ASC')
      .addOrderBy('socio.nombre', 'ASC')
      .getMany();

    return socios.map((socio) => ({
      id: socio.id,
      nombre: socio.nombre,
      apellido: socio.apellido,
      dni: socio.dni,
      telefono: socio.telefono,
    }));
  }
}
