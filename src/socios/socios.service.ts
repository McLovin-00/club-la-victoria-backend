import { Injectable, Logger } from '@nestjs/common';
import { SocioRepository } from './repositories/socio.repository';
import { PaginationDto } from 'src/common/dto/pagination.dto';
import { CreateSocioDto } from './dto/create-socio.dto';
import { CloudinaryService } from 'src/cloudinary/cloudinary.service';
import { CustomError } from 'src/constants/errors/custom-error';
import { UpdateSocioDto } from './dto/update-socio.dto';
import { AsociacionesRepository } from 'src/asociaciones/repositories/asociaciones.repository';
import { TemporadaPiletaRepository } from 'src/temporadas/repositories/temporada.repository';
import { LessThanOrEqual, MoreThanOrEqual, DataSource } from 'typeorm';
import { format, toZonedTime } from 'date-fns-tz';
import { TipoPersona } from './constants/tipo-persona';
import {
  ERROR_MESSAGES,
  ERROR_CODES,
} from 'src/constants/errors/error-messages';
import { CategoriaRulesService } from './services/categoria-rules.service';
import { CategoriasSocioService } from 'src/categorias-socio/categorias-socio.service';

@Injectable()
export class SociosService {
  private readonly logger = new Logger(SociosService.name);

  constructor(
    private readonly socioRepository: SocioRepository,
    private readonly cloudinaryService: CloudinaryService,
    private readonly asociacionesRepository: AsociacionesRepository,
    private readonly temporadaPiletaRepository: TemporadaPiletaRepository,
    private readonly dataSource: DataSource,
    private readonly categoriaRulesService: CategoriaRulesService,
    private readonly categoriasSocioService: CategoriasSocioService,
  ) {}

  async create(createSocioDto: CreateSocioDto, file?: Express.Multer.File) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    let fotoUrl: string | undefined;

    try {
      // Validar DNI único
      if (createSocioDto.dni) {
        const foundUser = await this.socioRepository.findByDni(
          createSocioDto.dni,
        );
        if (foundUser) {
          throw new CustomError(
            ERROR_MESSAGES.DNI_ALREADY_EXISTS,
            400,
            ERROR_CODES.DNI_ALREADY_EXISTS,
          );
        }
      }

      const fechaAlta = new Date().toLocaleDateString('en-CA', {
        timeZone: 'America/Argentina/Buenos_Aires',
      });

      // Upload foto a Cloudinary (fuera de transacción DB)
      if (file) {
        const uploadFile = await this.cloudinaryService.uploadFile(file);
        fotoUrl = uploadFile.secure_url as string;
      }

      const socioData = {
        ...createSocioDto,
        fotoUrl,
        fechaAlta,
      };

      // Calcular categoría automáticamente si no hay override manual
      let categoriaIdAuto = socioData.categoriaId;
      this.logger.debug(
        `Calculando categoría - overrideManual: ${socioData.overrideManual}, categoriaId inicial: ${categoriaIdAuto}`,
      );
      if (!socioData.overrideManual) {
        this.logger.debug(
          `fechaNacimiento: ${socioData.fechaNacimiento}, fechaAlta: ${fechaAlta}`,
        );
        const socioTemporal = {
          fechaNacimiento: socioData.fechaNacimiento,
          fechaAlta: fechaAlta,
          categoria: null,
        } as any;
        const categoriaNombre =
          this.categoriaRulesService.calcularCategoria(socioTemporal);
        this.logger.debug(`Categoría calculada: ${categoriaNombre}`);
        const categoria =
          await this.categoriasSocioService.findByNombre(categoriaNombre);
        this.logger.debug(
          `Categoría encontrada en DB: ${JSON.stringify(categoria)}`,
        );
        if (categoria) {
          categoriaIdAuto = categoria.id;
          this.logger.debug(
            `categoriaIdAuto actualizado a: ${categoriaIdAuto}`,
          );
        } else {
          this.logger.warn(
            `No se encontró la categoría ${categoriaNombre} en la base de datos`,
          );
        }
      }

      // Crear socio en transacción
      const socio = await this.socioRepository.createSocio({
        ...socioData,
        categoriaId: categoriaIdAuto,
      });

      await queryRunner.commitTransaction();
      return socio;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(
        'Error guardando el socio',
        error instanceof Error ? error.stack : String(error),
      );

      // Limpiar foto de Cloudinary si se subió
      if (fotoUrl) {
        this.logger.warn(`Eliminando foto de cloudinary por error: ${fotoUrl}`);
        try {
          await this.cloudinaryService.deleteFile(fotoUrl);
        } catch (deleteError) {
          this.logger.error(
            'Error eliminando foto de Cloudinary',
            deleteError instanceof Error
              ? deleteError.stack
              : String(deleteError),
          );
        }
      }

      if (error instanceof CustomError) {
        throw error;
      }
      throw new CustomError(
        ERROR_MESSAGES.ERROR_CREATING_SOCIO,
        500,
        ERROR_CODES.INTERNAL_SERVER_ERROR,
      );
    } finally {
      await queryRunner.release();
    }
  }

  async update(id: number, dto: UpdateSocioDto, file?: Express.Multer.File) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    let newFotoUrl: string | undefined;
    let oldFotoUrl: string | undefined;

    try {
      const socio = await this.socioRepository.findOne({
        where: { id },
        relations: ['categoria'],
      });
      if (!socio) {
        throw new CustomError(
          ERROR_MESSAGES.SOCIO_NOT_FOUND,
          404,
          ERROR_CODES.SOCIO_NOT_FOUND,
        );
      }

      this.logger.debug(`Actualizando socio ${id}`, { socio, dto });

      // Guardar foto vieja si se va a reemplazar
      if (dto.eliminarFotoVieja && dto.fotoUrl) {
        oldFotoUrl = dto.fotoUrl;
      }

      // Si llega archivo nuevo, lo subimos
      if (file) {
        const uploaded = await this.cloudinaryService.uploadFile(file);
        newFotoUrl = uploaded.secure_url as string;
        socio.fotoUrl = newFotoUrl;
      } else if (dto.eliminarFotoVieja && dto.fotoUrl) {
        socio.fotoUrl = '';
      }

      // Sacamos lo que no queremos pisar
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { fotoUrl, eliminarFotoVieja, categoriaId, ...rest } = dto;
      Object.assign(socio, rest);

      // Mapear categoriaId a la relación categoria si overrideManual es true
      if (dto.overrideManual && categoriaId) {
        socio.categoria = { id: categoriaId } as any;
      } else if (dto.overrideManual === false) {
        // Si overrideManual es false, el job manejará la categoría
        this.logger.debug(
          'overrideManual es false, el job manejará la categoría',
        );
      }

      const updated = await this.socioRepository.save(socio);

      await queryRunner.commitTransaction();

      // Solo después del commit exitoso, eliminar foto vieja de Cloudinary
      if (oldFotoUrl) {
        this.logger.log(`Eliminando foto vieja del socio ${id}: ${oldFotoUrl}`);
        try {
          await this.cloudinaryService.deleteFile(oldFotoUrl);
        } catch (deleteError) {
          this.logger.error(
            'Error eliminando foto vieja de Cloudinary',
            deleteError instanceof Error
              ? deleteError.stack
              : String(deleteError),
          );
        }
      }

      return updated;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(
        `Error actualizando socio ${id}`,
        error instanceof Error ? error.stack : String(error),
      );

      // Limpiar nueva foto si se subió pero falló la transacción
      if (newFotoUrl) {
        this.logger.warn(
          `Eliminando nueva foto de cloudinary por error: ${newFotoUrl}`,
        );
        try {
          await this.cloudinaryService.deleteFile(newFotoUrl);
        } catch (deleteError) {
          this.logger.error(
            'Error eliminando nueva foto de Cloudinary',
            deleteError instanceof Error
              ? deleteError.stack
              : String(deleteError),
          );
        }
      }

      if (error instanceof CustomError) {
        throw error;
      }
      throw new CustomError(
        ERROR_MESSAGES.ERROR_UPDATING_SOCIO,
        500,
        ERROR_CODES.INTERNAL_SERVER_ERROR,
      );
    } finally {
      await queryRunner.release();
    }
  }

  async findAll(paginationDto: PaginationDto) {
    return await this.socioRepository.findPaginatedAndFiltered(
      paginationDto.page,
      paginationDto.limit,
      paginationDto.search,
    );
  }

  async findOne(id: number) {
    const socio = await this.socioRepository.findOne({
      where: { id },
      relations: ['categoria'],
    });
    if (!socio) {
      throw new CustomError(
        ERROR_MESSAGES.SOCIO_NOT_FOUND,
        404,
        ERROR_CODES.SOCIO_NOT_FOUND,
      );
    }
    return socio;
  }

  async remove(id: number) {
    const socio = await this.findOne(id);
    if (socio.fotoUrl) {
      await this.cloudinaryService.deleteFile(socio.fotoUrl);
    }
    const result = await this.socioRepository.delete(id);
    if (result.affected === 0) {
      throw new CustomError(
        ERROR_MESSAGES.SOCIO_NOT_FOUND,
        404,
        ERROR_CODES.SOCIO_NOT_FOUND,
      );
    }
    return { message: 'Socio eliminado exitosamente' };
  }

  /**
   * Busca socios por nombre o apellido (case insensitive)
   * Soporta búsquedas con múltiples palabras (ej: "cabrera ale" encuentra "Alejandro Cabrera")
   * @param query - Texto a buscar en nombre o apellido (puede contener múltiples palabras)
   * @returns Lista de socios que coinciden con la búsqueda (máximo 10)
   */
  async findByName(query: string) {
    if (!query || query.trim().length === 0) {
      return [];
    }

    // Dividir el query en palabras y filtrar vacíos
    const words = query
      .trim()
      .toLowerCase()
      .split(/\s+/)
      .filter((word) => word.length > 0);

    if (words.length === 0) {
      return [];
    }

    const qb = this.socioRepository
      .createQueryBuilder('socio')
      .where('socio.estado = :estado', { estado: 'ACTIVO' });

    // Para cada palabra, agregar condición AND que busque en nombre O apellido
    words.forEach((word, index) => {
      const paramName = `word${index}`;
      qb.andWhere(
        `(LOWER(socio.nombre) LIKE :${paramName} OR LOWER(socio.apellido) LIKE :${paramName})`,
        { [paramName]: `%${word}%` },
      );
    });

    const socios = await qb
      .leftJoinAndSelect('socio.categoria', 'categoria')
      .orderBy('socio.apellido', 'ASC')
      .addOrderBy('socio.nombre', 'ASC')
      .limit(10)
      .getMany();

    return socios;
  }

  /**
   * Busca un socio por DNI o ID y determina su tipo (SOCIO_CLUB, SOCIO_PILETA o NO_SOCIO)
   * @param identifier - DNI (string) o ID (number convertido a string) del socio
   */
  async findSocioConTipo(identifier: string) {
    let socio;

    // Si el identificador es numérico y tiene menos de 6 dígitos, asumir que es un ID
    const isNumeric = /^\d+$/.test(identifier);
    if (isNumeric && identifier.length <= 6) {
      socio = await this.socioRepository.findOne({
        where: { id: parseInt(identifier, 10) },
        relations: ['categoria'],
      });
    } else {
      // Buscar por DNI
      socio = await this.socioRepository.findOne({
        where: { dni: identifier },
        relations: ['categoria'],
      });
    }

    if (!socio) {
      return { socio: null, tipoPersona: TipoPersona.NOSOCIO };
    }

    const hoy = format(
      toZonedTime(new Date(), 'America/Argentina/Buenos_Aires'),
      'yyyy-MM-dd',
    );
    const temporadaActual = await this.temporadaPiletaRepository.findOne({
      where: {
        fechaInicio: LessThanOrEqual(hoy),
        fechaFin: MoreThanOrEqual(hoy),
      },
    });

    let tipoPersona: TipoPersona.SOCIOCLUB | TipoPersona.SOCIOPILETA =
      TipoPersona.SOCIOCLUB;

    if (temporadaActual) {
      const inscripcion = await this.asociacionesRepository.findOne({
        where: {
          socio: { id: socio.id },
          temporada: { id: temporadaActual.id },
        },
      });

      if (inscripcion) {
        tipoPersona = TipoPersona.SOCIOPILETA;
      }
    }

    return { socio, tipoPersona };
  }

  async findOneByDniReserva(dni: string) {
    const socio = await this.socioRepository.findOne({
      where: { dni },
      relations: ['categoria'],
    });
    return !!socio;
  }
}
