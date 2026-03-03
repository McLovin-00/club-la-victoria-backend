import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notificacion, TipoNotificacion } from './entities/notificacion.entity';
import { CustomError } from 'src/constants/errors/custom-error';
import {
  ERROR_MESSAGES,
  ERROR_CODES,
} from 'src/constants/errors/error-messages';

@Injectable()
export class NotificacionesService {
  private readonly logger = new Logger(NotificacionesService.name);

  constructor(
    @InjectRepository(Notificacion)
    private readonly notificacionRepository: Repository<Notificacion>,
  ) {}

  async findAll() {
    const notificaciones = await this.notificacionRepository.find({
      where: { leida: false },
      relations: ['socio'],
      order: { createdAt: 'DESC' },
    });

    const totalNoLeidas = notificaciones.length;

    return {
      notificaciones: notificaciones.map((n) => ({
        id: n.id,
        tipo: n.tipo,
        socioId: n.socioId,
        socioNombre:
          `${n.socio?.nombre || ''} ${n.socio?.apellido || ''}`.trim(),
        mensaje: n.mensaje,
        leida: n.leida,
        createdAt: n.createdAt,
      })),
      totalNoLeidas,
    };
  }

  async contarNoLeidas() {
    const totalNoLeidas = await this.notificacionRepository.count({
      where: { leida: false },
    });
    return { totalNoLeidas };
  }

  async marcarLeida(id: number) {
    const notificacion = await this.notificacionRepository.findOne({
      where: { id },
    });

    if (!notificacion) {
      throw new CustomError(
        ERROR_MESSAGES.NOTIFICACION_NOT_FOUND,
        404,
        ERROR_CODES.NOTIFICACION_NOT_FOUND,
      );
    }

    notificacion.leida = true;
    await this.notificacionRepository.save(notificacion);
    return { message: 'Notificación marcada como leída' };
  }

  async marcarTodasLeidas() {
    await this.notificacionRepository.update({ leida: false }, { leida: true });
    return { message: 'Todas las notificaciones marcadas como leídas' };
  }

  async crearNotificacion(
    tipo: TipoNotificacion,
    socioId: number,
    mensaje: string,
  ) {
    const notificacion = this.notificacionRepository.create({
      tipo,
      socioId,
      mensaje,
    });
    return await this.notificacionRepository.save(notificacion);
  }
}
