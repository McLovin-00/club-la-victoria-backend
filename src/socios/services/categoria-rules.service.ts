import { Injectable } from '@nestjs/common';
import { format, toZonedTime } from 'date-fns-tz';
import { TIMEZONE } from 'src/constants/time-zone';

import { Socio } from '../entities/socio.entity';

export enum CategoriaSocio {
  ACTIVO = 'ACTIVO',
  ADHERENTE = 'ADHERENTE',
  VITALICIO = 'VITALICIO',
  HONORARIO = 'HONORARIO',
}

@Injectable()
export class CategoriaRulesService {
  calcularCategoria(socio: Socio): CategoriaSocio {
    if (socio.categoria?.nombre === CategoriaSocio.HONORARIO) {
      return CategoriaSocio.HONORARIO;
    }

    const fechaActual = this.obtenerFechaActualEnArgentina();

    if (this.calcularAniosCumplidos(socio.fechaAlta, fechaActual) >= 45) {
      return CategoriaSocio.VITALICIO;
    }

    const edad = this.calcularAniosCumplidos(socio.fechaNacimiento, fechaActual);

    if (edad < 18) {
      return CategoriaSocio.ADHERENTE;
    }

    return CategoriaSocio.ACTIVO;
  }

  private obtenerFechaActualEnArgentina(): string {
    return format(toZonedTime(new Date(), TIMEZONE), 'yyyy-MM-dd');
  }

  private calcularAniosCumplidos(fechaInicio: string, fechaFin: string): number {
    const inicio = this.parsearFecha(fechaInicio, 'fechaInicio');
    const fin = this.parsearFecha(fechaFin, 'fechaFin');

    let anios = fin.anio - inicio.anio;
    const aunNoCumplio =
      fin.mes < inicio.mes ||
      (fin.mes === inicio.mes && fin.dia < inicio.dia);

    if (aunNoCumplio) {
      anios -= 1;
    }

    return anios;
  }

  private parsearFecha(
    fecha: string,
    nombreCampo: 'fechaInicio' | 'fechaFin',
  ): { anio: number; mes: number; dia: number } {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(fecha);

    if (!match) {
      throw new Error(`Formato de ${nombreCampo} invalido: ${fecha}`);
    }

    const anio = Number(match[1]);
    const mes = Number(match[2]);
    const dia = Number(match[3]);

    const fechaUtc = new Date(Date.UTC(anio, mes - 1, dia));
    const fechaValida =
      fechaUtc.getUTCFullYear() === anio &&
      fechaUtc.getUTCMonth() === mes - 1 &&
      fechaUtc.getUTCDate() === dia;

    if (!fechaValida) {
      throw new Error(`Valor de ${nombreCampo} invalido: ${fecha}`);
    }

    return { anio, mes, dia };
  }
}
