import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { DataSource, Repository } from 'typeorm';

import { CategoriaSocio } from 'src/categorias-socio/entities/categoria-socio.entity';
import { TIMEZONE } from 'src/constants/time-zone';
import { Socio } from 'src/socios/entities/socio.entity';
import {
  CategoriaRulesService,
  CategoriaSocio as CategoriaCalculada,
} from 'src/socios/services/categoria-rules.service';

@Injectable()
export class CategoriaSocioJob {
  private readonly logger = new Logger(CategoriaSocioJob.name);
  private readonly batchSize = 1000;

  constructor(
    private readonly dataSource: DataSource,
    private readonly categoriaRulesService: CategoriaRulesService,
  ) {}

  @Cron('0 2 * * 0', {
    timeZone: TIMEZONE,
    name: 'categoria-socio-semanal',
  })
  async ejecutarActualizacionSemanalCategorias(): Promise<void> {
    const categoriaRepository = this.dataSource.getRepository(CategoriaSocio);
    const socioRepository = this.dataSource.getRepository(Socio);
    const categoriasPorNombre =
      await this.obtenerCategoriasPorNombre(categoriaRepository);

    let offset = 0;
    let totalProcesados = 0;
    let totalActualizados = 0;
    let totalSinCambios = 0;
    let totalSaltadosSinCategoria = 0;

    while (true) {
      const socios = await socioRepository.find({
        where: { overrideManual: false },
        relations: { categoria: true },
        order: { id: 'ASC' },
        skip: offset,
        take: this.batchSize,
      });

      if (socios.length === 0) {
        break;
      }

      for (const socio of socios) {
        totalProcesados += 1;

        const nombreCategoriaCalculada =
          this.categoriaRulesService.calcularCategoria(socio);
        const nombreCategoriaActual = socio.categoria?.nombre ?? null;

        if (nombreCategoriaCalculada === nombreCategoriaActual) {
          totalSinCambios += 1;
          continue;
        }

        const categoriaDestino = categoriasPorNombre.get(
          nombreCategoriaCalculada,
        );
        if (!categoriaDestino) {
          totalSaltadosSinCategoria += 1;
          this.logger.warn(
            `categoria_socio_no_encontrada ${JSON.stringify({
              socioId: socio.id,
              categoriaCalculada: nombreCategoriaCalculada,
            })}`,
          );
          continue;
        }

        const result = await socioRepository
          .createQueryBuilder()
          .update(Socio)
          .set({
            categoria: { id: categoriaDestino.id } as CategoriaSocio,
          })
          .where('id_socio = :socioId', { socioId: socio.id })
          .andWhere('override_manual = false')
          .andWhere('id_categoria IS DISTINCT FROM :categoriaId', {
            categoriaId: categoriaDestino.id,
          })
          .execute();

        if ((result.affected ?? 0) > 0) {
          totalActualizados += 1;
          this.logger.log(
            `categoria_socio_actualizada ${JSON.stringify({
              socioId: socio.id,
              categoriaAnterior: nombreCategoriaActual,
              categoriaNueva: nombreCategoriaCalculada,
            })}`,
          );
          continue;
        }

        totalSinCambios += 1;
      }

      offset += socios.length;
    }

    this.logger.log(
      `categoria_socio_job_resumen ${JSON.stringify({
        procesados: totalProcesados,
        actualizados: totalActualizados,
        sinCambios: totalSinCambios,
        saltadosSinCategoria: totalSaltadosSinCategoria,
        batchSize: this.batchSize,
      })}`,
    );
  }

  private async obtenerCategoriasPorNombre(
    categoriaRepository: Repository<CategoriaSocio>,
  ): Promise<Map<CategoriaCalculada, CategoriaSocio>> {
    const categorias = await categoriaRepository.find({
      select: ['id', 'nombre'],
    });
    const categoriasPorNombre = new Map<CategoriaCalculada, CategoriaSocio>();

    for (const categoria of categorias) {
      if (this.esCategoriaCalculada(categoria.nombre)) {
        categoriasPorNombre.set(categoria.nombre, categoria);
      }
    }

    return categoriasPorNombre;
  }

  private esCategoriaCalculada(nombre: string): nombre is CategoriaCalculada {
    return Object.values(CategoriaCalculada).includes(
      nombre as CategoriaCalculada,
    );
  }
}
