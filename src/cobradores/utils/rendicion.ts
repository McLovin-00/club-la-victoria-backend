import { BadRequestException } from '@nestjs/common';
import type { CobroOperacion } from '../../cobros/entities/cobro-operacion.entity';
import { TipoLineaCobro } from '../../cobros/entities/cobro-operacion-linea.entity';

const ZONA_CLUB = 'America/Argentina/Buenos_Aires';
const DIA_MS = 86_400_000;
const SIN_METODO = 'Método no registrado';
const isoDia = (fecha: Date) => fecha.toISOString().slice(0, 10);
const fechasInvalidas = () => new BadRequestException('Indicá un mes válido o un rango de fechas válido de hasta 366 días.');

export function leerConsultaRendicion(consulta: Record<string, unknown>) {
  if (Object.entries(consulta).some(([clave, valor]) =>
    !['desde', 'hasta', 'periodo'].includes(clave) || typeof valor !== 'string',
  )) {
    throw fechasInvalidas();
  }
  return consulta as { desde?: string; hasta?: string; periodo?: string };
}

export function rangoRendicion(desde?: string, hasta?: string, periodo?: string) {
  const fecha = (valor?: string) => {
    if (typeof valor !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(valor) || valor < '2000-01-01' || valor > '2100-12-31') {
      throw fechasInvalidas();
    }
    const dia = new Date(`${valor}T00:00:00.000Z`);
    if (!Number.isFinite(dia.getTime()) || isoDia(dia) !== valor) throw fechasInvalidas();
    return dia;
  };
  if (periodo !== undefined) {
    if (desde !== undefined || hasta !== undefined || typeof periodo !== 'string' || !/^\d{4}-\d{2}$/.test(periodo)) throw fechasInvalidas();
    desde = `${periodo}-01`;
    const dia = fecha(desde);
    dia.setUTCMonth(dia.getUTCMonth() + 1, 0);
    hasta = isoDia(dia);
  }
  const primero = fecha(desde);
  const ultimo = fecha(hasta);
  const dias = (ultimo.getTime() - primero.getTime()) / DIA_MS + 1;
  if (dias < 1 || dias > 366) throw fechasInvalidas();
  const medianocheClub = (dia: Date) => {
    const ymd = isoDia(dia);
    const zona = new Intl.DateTimeFormat('en', { timeZone: ZONA_CLUB, timeZoneName: 'longOffset' });
    const zonaTexto = zona.formatToParts(new Date(`${ymd}T06:00:00Z`))
      .find((parte) => parte.type === 'timeZoneName')!.value;
    return new Date(`${ymd}T00:00:00${zonaTexto.slice(3)}`);
  };
  return {
    desde: isoDia(primero),
    hasta: isoDia(ultimo),
    inicio: medianocheClub(primero),
    finInclusivo: new Date(medianocheClub(new Date(ultimo.getTime() + DIA_MS)).getTime() - 1),
  };
}

const aCentavos = (valor?: number | null) => {
  if (valor == null) return null;
  const monto = Number(valor);
  return Number.isFinite(monto) && monto >= 0 ? Math.round(monto * 100) : null;
};

export function armarRendicion(operaciones: CobroOperacion[]) {
  const porMetodo = new Map<string, number>();
  let cantidadImporteNoVerificable = 0;
  const cobros = operaciones.map((op) => {
    const metodos = new Map<string, number>();
    let pagosVerificados = 0;
    for (const pago of new Map(op.pagos.map((item) => [item.id, item])).values()) {
      const centavos = aCentavos(pago.montoPagado);
      if (!centavos) continue;
      const metodo = pago.metodoPago?.nombre?.trim() || SIN_METODO;
      metodos.set(metodo, (metodos.get(metodo) ?? 0) + centavos);
      pagosVerificados += centavos;
    }
    const cargos = aCentavos(op.totalCargos);
    const aplicado = aCentavos(op.creditoAplicado);
    const excedente = aCentavos(op.creditoGenerado);
    const totalRegistrado = aCentavos(op.total);
    const montosLineas = op.lineas.map((linea) => aCentavos(linea.monto));
    const sumaLineas = montosLineas.reduce<number>((suma, monto) => suma + (monto ?? 0), 0);
    const camposSinHistorico = cargos === 0 && aplicado === 0 && excedente === 0 &&
      (sumaLineas > 0 || (totalRegistrado ?? 0) > 0);
    const tieneCuotas = op.lineas.some((linea) => linea.tipoLinea === TipoLineaCobro.CUOTA);
    const tieneExtras = op.lineas.some((linea) => linea.tipoLinea === TipoLineaCobro.CONCEPTO);
    let recibidoCentavos: number | null = null;
    if (op.grupoFamiliarId != null) {
      if (cargos !== null && cargos > 0 && cargos === totalRegistrado && aplicado === 0 &&
        excedente === 0 && montosLineas.every((monto) => monto !== null) &&
        sumaLineas === cargos && pagosVerificados <= cargos) {
        recibidoCentavos = cargos;
      } else if (tieneCuotas && !tieneExtras && excedente === 0 && pagosVerificados > 0) {
        recibidoCentavos = pagosVerificados;
      }
    } else if (tieneCuotas && pagosVerificados > 0) {
      recibidoCentavos = pagosVerificados;
    } else if (!camposSinHistorico && cargos !== null && aplicado !== null && excedente !== null && aplicado <= cargos) {
      recibidoCentavos = cargos - aplicado + excedente;
    }
    if (recibidoCentavos === null) {
      cantidadImporteNoVerificable++;
    } else if (recibidoCentavos > pagosVerificados) {
      metodos.set(SIN_METODO, (metodos.get(SIN_METODO) ?? 0) + recibidoCentavos - pagosVerificados);
    }
    for (const [metodo, centavos] of metodos) {
      porMetodo.set(metodo, (porMetodo.get(metodo) ?? 0) + centavos);
    }
    return {
      id: op.id,
      fecha: op.fechaHoraServidor.toISOString(),
      socio: [op.socio?.apellido, op.socio?.nombre].filter(Boolean).join(', ') || 'Socio no informado',
      conceptos: op.lineas.map((linea) => linea.tipoLinea === TipoLineaCobro.CUOTA
        ? `Cuota${linea.cuota?.periodo ? ` ${linea.cuota.periodo}` : ''}`
        : linea.concepto?.trim() || 'Concepto adicional'),
      recibidoCentavos,
      metodos: [...metodos].map(([metodo, centavos]) => ({ metodo, centavos })),
    };
  });
  return {
    cobros,
    totalVerificadoCentavos: [...porMetodo.values()].reduce((suma, monto) => suma + monto, 0),
    cantidadImporteNoVerificable,
    porMetodo: [...porMetodo].sort(([a], [b]) => a.localeCompare(b, 'es-AR'))
      .map(([metodo, centavos]) => ({ metodo, centavos })),
  };
}
