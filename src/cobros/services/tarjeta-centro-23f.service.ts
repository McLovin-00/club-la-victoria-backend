import { Injectable } from '@nestjs/common';
import { AppConfigService } from '../../config/AppConfig/app-config.service';
import { Cuota } from '../entities/cuota.entity';

interface TarjetaCentro23fDetalle {
  tarjeta: string;
  referencia: string;
  codigoImporte: number;
}

@Injectable()
export class TarjetaCentro23fService {
  private static readonly LARGO_LINEA = 85;
  private static readonly BLOQUE_FIJO_43_55 = '0010010000000';

  constructor(private readonly appConfigService: AppConfigService) {}

  generarArchivo(periodo: string, cuotas: Cuota[]): { fileName: string; content: string } {
    const fechaProceso = this.formatearFechaDDMMAA(new Date());
    const emisor = this.appConfigService.getTarjetaCentroEmisor();
    const nombreComercio = this.appConfigService.getTarjetaCentroNombre();
    const prefijoArchivo = this.appConfigService.getTarjetaCentroPrefix();

    const detalles = cuotas
      .filter((cuota) => {
        const numeroTarjeta = cuota.socio?.numeroTarjetaCentro?.trim();
        return Boolean(cuota.socio?.tarjetaCentro && numeroTarjeta);
      })
      .map((cuota) => {
        const numeroTarjeta = (cuota.socio?.numeroTarjetaCentro ?? '').replace(/\D/g, '').padStart(16, '0').slice(-16);
        const referencia = String(cuota.id).padStart(12, '0');
        const codigoImporte = Math.round(Number(cuota.monto) / 100);

        return {
          tarjeta: numeroTarjeta,
          referencia,
          codigoImporte,
        } satisfies TarjetaCentro23fDetalle;
      });

    const header = this.ajustarALargo(
      `${emisor}41${fechaProceso}${this.padRight(nombreComercio, 30)}`,
      TarjetaCentro23fService.LARGO_LINEA,
      ' ',
    );

    const bloquePeriodo = this.generarBloquePeriodo(periodo);
    const lineasDetalle = detalles.map((detalle) =>
      this.ajustarALargo(
        `${emisor}42${detalle.tarjeta}${detalle.referencia}${TarjetaCentro23fService.BLOQUE_FIJO_43_55}${String(detalle.codigoImporte).padStart(2, '0')}${bloquePeriodo}`,
        TarjetaCentro23fService.LARGO_LINEA,
        ' ',
      ),
    );

    const totalControl = detalles.reduce((acc, detalle) => acc + detalle.codigoImporte, 0) * 10;
    const trailer = this.ajustarALargo(
      `${emisor}49${fechaProceso}${String(detalles.length).padStart(7, '0')}${String(totalControl).padStart(12, '0')}`,
      TarjetaCentro23fService.LARGO_LINEA,
      '0',
    );

    const content = [header, ...lineasDetalle, trailer].join('\n');
    const fileName = `${prefijoArchivo}.23f`;

    return { fileName, content };
  }

  private formatearFechaDDMMAA(fecha: Date): string {
    const dia = String(fecha.getDate()).padStart(2, '0');
    const mes = String(fecha.getMonth() + 1).padStart(2, '0');
    const anio = String(fecha.getFullYear()).slice(-2);
    return `${dia}${mes}${anio}`;
  }

  private generarBloquePeriodo(periodo: string): string {
    const [anio, mes] = periodo.split('-');
    const anioCorto = anio.slice(-2);
    return `00000${mes}/${anioCorto}1`;
  }

  private ajustarALargo(valor: string, largo: number, filler: string): string {
    if (valor.length >= largo) {
      return valor.slice(0, largo);
    }

    return valor.padEnd(largo, filler);
  }

  private padRight(valor: string, largo: number): string {
    if (valor.length >= largo) {
      return valor.slice(0, largo);
    }

    return valor.padEnd(largo, ' ');
  }
}
