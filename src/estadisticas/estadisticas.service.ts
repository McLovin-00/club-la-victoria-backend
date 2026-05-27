import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, Repository } from 'typeorm';
import { RegistroIngreso } from '../registro-ingreso/entities/registro-ingreso.entity';
import { StatisticsResponseDto } from './dto/statistics-response.dto';
import { TipoIngreso } from '../registro-ingreso/entities/registro-ingreso.entity';
import { getDayStartEnd } from 'src/util/day-start-end-util';
import { applyMultiWordSearch, SearchField } from '../common/utils/search.utils';

@Injectable()
export class EstadisticasService {
  private readonly logger = new Logger(EstadisticasService.name);

  constructor(
    @InjectRepository(RegistroIngreso)
    private readonly registroIngresoRepository: Repository<RegistroIngreso>,
  ) {}

  async getDailyStatistics(
    date: string,
    searchTerm?: string,
  ): Promise<StatisticsResponseDto> {
    // Ajustar la fecha para incluir todo el día
    const { inicioDia, finDia } = getDayStartEnd(date);

    // Construir query base con las condiciones de fecha
    const queryBuilder = this.registroIngresoRepository
      .createQueryBuilder('registro')
      .leftJoinAndSelect('registro.socio', 'socio')
      .where('registro.fechaHoraIngreso BETWEEN :inicio AND :fin', {
        inicio: inicioDia,
        fin: finDia,
      });

    // Aplicar filtro de búsqueda si se proporciona searchTerm
    if (searchTerm && searchTerm.trim() !== '') {
      const fields: SearchField[] = [
        { column: 'socio.nombre', useUnaccent: true },
        { column: 'socio.apellido', useUnaccent: true },
        { column: 'registro.nombreNoSocio', useUnaccent: true },
        { column: 'registro.apellidoNoSocio', useUnaccent: true },
      ];
      applyMultiWordSearch(queryBuilder, searchTerm, fields, 'word');
    }

    // Ordenar y ejecutar query
    const registros = await queryBuilder
      .orderBy('registro.idIngreso', 'DESC')
      .getMany();

    // Calcular estadísticas (se calculan sobre los registros ya filtrados)
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
