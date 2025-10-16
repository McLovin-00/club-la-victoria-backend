import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, Repository } from 'typeorm';
import { RegistroIngreso } from '../registro-ingreso/entities/registro-ingreso.entity';
import { StatisticsResponseDto } from './dto/statistics-response.dto';
import { TipoIngreso } from '../registro-ingreso/entities/registro-ingreso.entity';
import { getDayStartEnd } from 'src/util/day-start-end-util';

@Injectable()
export class EstadisticasService {
  private readonly logger = new Logger(EstadisticasService.name);

  constructor(
    @InjectRepository(RegistroIngreso)
    private readonly registroIngresoRepository: Repository<RegistroIngreso>,
  ) {}

  async getDailyStatistics(date: string): Promise<StatisticsResponseDto> {
    // Ajustar la fecha para incluir todo el día
    const { inicioDia, finDia } = getDayStartEnd(date);

    // Obtener todos los registros del día
    const registros = await this.registroIngresoRepository.find({
      where: {
        fechaHoraIngreso: Between(inicioDia, finDia),
      },
      relations: ['socio'],
      order: {
        idIngreso: 'DESC',
      },
    });

    // Calcular estadísticas
    const totalIngresos = registros.length;
    const totalIngresosPileta = registros.filter(
      (r) => r.habilitaPileta,
    ).length;
    const totalIngresosClub = totalIngresos - totalIngresosPileta;

    const totalSocios = registros.filter(
      (r) =>
        r.tipoIngreso === TipoIngreso.SOCIO_CLUB ||
        r.tipoIngreso === TipoIngreso.SOCIO_PILETA,
    ).length;

    const totalNoSocios = totalIngresos - totalSocios;

    return {
      totalIngresos,
      totalIngresosPileta,
      totalIngresosClub,
      totalSocios,
      totalNoSocios,
      registros,
    };
  }
}
