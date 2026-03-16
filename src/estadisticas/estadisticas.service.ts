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
      const term = searchTerm.trim();

      // Separar el término en palabras para búsqueda más inteligente
      // Ej: "Luciana P" -> ["Luciana", "P"]
      const words = term.split(/\s+/).filter((w) => w.length > 0);

      if (words.length === 1) {
        // Búsqueda simple con una sola palabra
        queryBuilder.andWhere(
          '(socio.id IS NOT NULL AND (unaccent(socio.nombre) ILIKE unaccent(:term) OR unaccent(socio.apellido) ILIKE unaccent(:term))) OR ' +
            '(socio.id IS NULL AND (unaccent(registro.nombreNoSocio) ILIKE unaccent(:term) OR unaccent(registro.apellidoNoSocio) ILIKE unaccent(:term)))',
          { term: `%${words[0]}%` },
        );
      } else {
        // Búsqueda con múltiples palabras - busca coincidencias en nombre y apellido
        // Para cada palabra, verificamos si coincide con nombre o apellido
        const conditions: string[] = [];
        const parameters: Record<string, string> = {};

        words.forEach((word, index) => {
          const paramKey = `word${index}`;
          parameters[paramKey] = `%${word}%`;
          conditions.push(`unaccent(socio.nombre) ILIKE unaccent(:${paramKey})`);
          conditions.push(`unaccent(socio.apellido) ILIKE unaccent(:${paramKey})`);
          conditions.push(
            `unaccent(registro.nombreNoSocio) ILIKE unaccent(:${paramKey})`,
          );
          conditions.push(
            `unaccent(registro.apellidoNoSocio) ILIKE unaccent(:${paramKey})`,
          );
        });

        // Usamos OR entre todas las condiciones - si alguna palabra coincide, retorna el registro
        queryBuilder.andWhere(`(${conditions.join(' OR ')})`, parameters);
      }
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
