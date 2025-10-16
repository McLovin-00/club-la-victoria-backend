import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import {
  RegistroIngreso,
  TipoIngreso,
} from './entities/registro-ingreso.entity';
import { CreateRegistroIngresoDto } from './dto/create-registro-ingreso.dto';
import { Socio } from '../socios/entities/socio.entity';
import { CustomError } from 'src/constants/errors/custom-error';
import { RegistroIngresoGateway } from './registro-ingreso.gateway';
import { getDayStartEnd } from 'src/util/day-start-end-util';
import { PAGINATION } from 'src/constants/pagination.constants';
import {
  ERROR_MESSAGES,
  ERROR_CODES,
} from 'src/constants/errors/error-messages';

@Injectable()
export class RegistroIngresoService {
  private readonly logger = new Logger(RegistroIngresoService.name);

  constructor(
    @InjectRepository(RegistroIngreso)
    private readonly registroIngresoRepository: Repository<RegistroIngreso>,
    @InjectRepository(Socio)
    private readonly socioRepository: Repository<Socio>,
    private readonly registroIngresoGateway: RegistroIngresoGateway,
  ) {}

  async create(
    createRegistroIngresoDto: CreateRegistroIngresoDto,
  ): Promise<RegistroIngreso> {
    // Verificar que la persona no tenga un registro de ingreso para el día de hoy
    await this.checkExistingRegistroToday(createRegistroIngresoDto);

    // Crear el registro de ingreso
    const registroIngreso = this.registroIngresoRepository.create({
      ...createRegistroIngresoDto,
    });

    const nuevoRegistro =
      await this.registroIngresoRepository.save(registroIngreso);

    // Si el registro habilita pileta, emitimos el evento al gateway
    if (nuevoRegistro.habilitaPileta) {
      try {
        this.registroIngresoGateway.emitNuevoRegistro(nuevoRegistro);
        await this.registroIngresoGateway.emitUpdatedList();
      } catch (err) {
        // No queremos que falle la creación por problemas en websocket
        // Solo logueamos el error
        this.logger.error(
          'Error emitiendo evento websocket',
          err instanceof Error ? err.stack : String(err),
        );
      }
    }

    return nuevoRegistro;
  }

  async findAll(
    page: number = PAGINATION.DEFAULT_PAGE,
    limit: number = PAGINATION.DEFAULT_LIMIT,
  ) {
    const [result, total] = await this.registroIngresoRepository.findAndCount({
      relations: ['socio'],
      order: { fechaHoraIngreso: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      data: result,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOne(id: number): Promise<RegistroIngreso> {
    const registro = await this.registroIngresoRepository.findOne({
      where: { idIngreso: id },
      relations: ['socio'],
    });

    if (!registro) {
      throw new CustomError(
        ERROR_MESSAGES.REGISTRO_NOT_FOUND,
        404,
        ERROR_CODES.REGISTRO_NOT_FOUND,
      );
    }

    return registro;
  }

  async findByDni(dni: string): Promise<RegistroIngreso[]> {
    return await this.registroIngresoRepository.find({
      where: { dniNoSocio: dni },
      relations: ['socio'],
      order: { fechaHoraIngreso: 'DESC' },
    });
  }

  // Método para verificar si ya existe un registro de ingreso para el día de hoy (teniendo en cuenta la zona horaria)
  private async checkExistingRegistroToday(
    createRegistroIngresoDto: CreateRegistroIngresoDto,
  ): Promise<void> {
    const { dniNoSocio, idSocio, tipoIngreso } = createRegistroIngresoDto;

    const { inicioDia, finDia } = getDayStartEnd();

    let existingIngreso: RegistroIngreso | null = null;

    //Checkeo ingreso para SOCIO_CLUB o SOCIO_PILETA
    if (
      (tipoIngreso === TipoIngreso.SOCIO_PILETA && idSocio) ||
      (tipoIngreso === TipoIngreso.SOCIO_CLUB && idSocio)
    ) {
      existingIngreso = await this.registroIngresoRepository.findOne({
        where: {
          fechaHoraIngreso: Between(inicioDia, finDia),
          idSocio: idSocio,
        },
      });
    } else if (tipoIngreso === TipoIngreso.NO_SOCIO && dniNoSocio) {
      //Checkeo ingreso para NO_SOCIO
      existingIngreso = await this.registroIngresoRepository.findOne({
        where: {
          fechaHoraIngreso: Between(inicioDia, finDia),
          dniNoSocio: dniNoSocio,
        },
      });
    }

    if (existingIngreso) {
      throw new CustomError(
        ERROR_MESSAGES.SOCIO_ALREADY_REGISTERED_TODAY,
        400,
        ERROR_CODES.SOCIO_ALREADY_REGISTERED_TODAY,
      );
    }
  }

  async findByDateRange(fechaInicio: string, fechaFin: string) {
    return await this.registroIngresoRepository.find({
      where: {
        fechaHoraIngreso: Between(new Date(fechaInicio), new Date(fechaFin)),
      },
      relations: ['socio'],
      order: { fechaHoraIngreso: 'DESC' },
    });
  }

  async getRegistrosHoy(): Promise<RegistroIngreso[]> {
    const { inicioDia, finDia } = getDayStartEnd();

    return this.registroIngresoRepository.find({
      where: {
        fechaHoraIngreso: Between(inicioDia, finDia),
        habilitaPileta: true,
      },
      relations: ['socio'],
      order: { fechaHoraIngreso: 'DESC' },
    });
  }
}
