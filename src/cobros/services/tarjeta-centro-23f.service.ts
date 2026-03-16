import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import {
  AppConfigService,
  TarjetaCentroMonthLetterMap,
  TarjetaCentroPeriodoConfig,
} from '../../config/AppConfig/app-config.service';
import { Cuota } from '../entities/cuota.entity';

interface TarjetaCentro23fDetalle {
  tarjeta: string;
  numeroAfiliado: string;
  montoReal: number;
}

export interface TarjetaCentroArchivoOpciones {
  fechaCabecera: string;
  fechaTrailer: string;
  codigoPeriodoDetalle: string;
  nombreInstitucion: string;
  extensionArchivo: string;
}

interface TarjetaCentroArchivoOpcionesNormalizadas {
  fechaCabecera: string;
  fechaTrailer: string;
  codigoPeriodoDetalle: string;
  nombreInstitucion: string;
  extensionArchivo: string;
}

@Injectable()
export class TarjetaCentro23fService {
  private static readonly LARGO_LINEA = 85;
  private static readonly CODIGO_CONVENIO = '4310050019094';
  private static readonly CABECERA_FIJO = '000';
  private static readonly DETALLE_FIJO_1 = '001001';
  private static readonly TRAILER_FIJO = '00000';
  private static readonly REGEX_FECHA_DDMMAA =
    /^(0[1-9]|[12][0-9]|3[01])(0[1-9]|1[0-2])\d{2}$/;
  private static readonly REGEX_CODIGO_PERIODO_DETALLE = /^\d{6}\/\d{3}$/;
  private static readonly REGEX_EXTENSION = /^[A-Za-z0-9]{3}$/;
  private readonly logger = new Logger(TarjetaCentro23fService.name);

  constructor(private readonly appConfigService: AppConfigService) {}

  generarArchivo(
    periodo: string,
    cuotas: Cuota[],
  ): { fileName: string; content: string } {
    const opcionesNormalizadas = this.resolverOpcionesPorPeriodo(periodo);
    const content = this.generarArchivoCompleto(cuotas, opcionesNormalizadas);

    return {
      fileName: this.generarNombreArchivo(opcionesNormalizadas.extensionArchivo),
      content,
    };
  }

  generarNombreArchivo(extensionArchivo: string): string {
    const prefijoArchivo = this.appConfigService.getTarjetaCentroPrefix();
    return `${prefijoArchivo}.${this.normalizarExtensionArchivo(extensionArchivo)}`;
  }

  generarCabecera(fechaCabecera: string, nombreInstitucion: string): string {
    const cabecera = this.completarConEspaciosDerecha(
      `${TarjetaCentro23fService.CODIGO_CONVENIO}1${this.normalizarFechaArchivo(fechaCabecera, 'fechaCabecera')}${this.normalizarNombreInstitucion(nombreInstitucion)}${TarjetaCentro23fService.CABECERA_FIJO}`,
      TarjetaCentro23fService.LARGO_LINEA,
    );

    this.validarLinea(cabecera, 'cabecera');
    return cabecera;
  }

  generarDetalle(
    detalle: TarjetaCentro23fDetalle,
    codigoPeriodoDetalle: string,
  ): string {
    const tarjeta = this.normalizarTarjeta(detalle.tarjeta);
    const numeroAfiliado = this.normalizarNumeroAfiliado(detalle.numeroAfiliado);
    const importeDetalle = this.calcularImporteDetalle(detalle.montoReal);
    const codigoPeriodoNormalizado = this.normalizarCodigoPeriodoDetalle(
      codigoPeriodoDetalle,
    );

    const linea = this.completarConEspaciosDerecha(
      `${TarjetaCentro23fService.CODIGO_CONVENIO}2${tarjeta}${numeroAfiliado}${TarjetaCentro23fService.DETALLE_FIJO_1}${importeDetalle}${codigoPeriodoNormalizado}`,
      TarjetaCentro23fService.LARGO_LINEA,
    );

    this.validarLinea(linea, `detalle afiliado ${numeroAfiliado}`);
    return linea;
  }

  generarTrailer(
    fechaTrailer: string,
    cantidadDetalles: number,
    totalReal: number,
  ): string {
    this.validarNumeroEnteroNoNegativo(cantidadDetalles, 'cantidadDetalles');
    this.validarMontoReal(totalReal, 'totalReal');

    const trailer = this.completarConEspaciosDerecha(
      `${TarjetaCentro23fService.CODIGO_CONVENIO}9${this.normalizarFechaArchivo(fechaTrailer, 'fechaTrailer')}${String(cantidadDetalles).padStart(7, '0')}${String(totalReal).padStart(13, '0')}${TarjetaCentro23fService.TRAILER_FIJO}`,
      TarjetaCentro23fService.LARGO_LINEA,
    );

    this.validarLinea(trailer, 'trailer');
    return trailer;
  }

  generarArchivoCompleto(
    cuotas: Cuota[],
    opciones: TarjetaCentroArchivoOpciones,
  ): string {
    const opcionesNormalizadas = this.normalizarOpciones(opciones);

    const detalles = cuotas
      .filter((cuota) => {
        const numeroTarjeta = cuota.socio?.numeroTarjetaCentro?.trim();
        return Boolean(cuota.socio?.tarjetaCentro && numeroTarjeta);
      })
      .map((cuota) => this.mapearDetalleDesdeCuota(cuota));

    const lineasDetalle = detalles.map((detalle) =>
      this.generarDetalle(detalle, opcionesNormalizadas.codigoPeriodoDetalle),
    );
    const totalReal = detalles.reduce((acumulado, detalle) => {
      return acumulado + detalle.montoReal;
    }, 0);

    const lineas = [
      this.generarCabecera(
        opcionesNormalizadas.fechaCabecera,
        opcionesNormalizadas.nombreInstitucion,
      ),
      ...lineasDetalle,
      this.generarTrailer(
        opcionesNormalizadas.fechaTrailer,
        detalles.length,
        totalReal,
      ),
    ];

    this.validarArchivo(lineas, detalles.length, totalReal);
    return lineas.join('\n');
  }

  private resolverOpcionesPorPeriodo(
    periodo: string,
  ): TarjetaCentroArchivoOpcionesNormalizadas {
    this.validarPeriodo(periodo);

    const configuracionesPorPeriodo =
      this.appConfigService.getTarjetaCentroPeriodConfig();
    const configuracionPeriodo = configuracionesPorPeriodo[periodo];

    if (!configuracionPeriodo) {
      return this.generarOpcionesFallback(periodo);
    }

    return {
      fechaCabecera: this.normalizarFechaDelPeriodo(
        configuracionPeriodo.fechaCabecera,
        'fechaCabecera',
        periodo,
      ),
      fechaTrailer: this.normalizarFechaDelPeriodo(
        configuracionPeriodo.fechaTrailer,
        'fechaTrailer',
        periodo,
      ),
      codigoPeriodoDetalle: this.normalizarCodigoPeriodoDetalle(
        configuracionPeriodo.codigoPeriodoDetalle ??
          this.generarCodigoPeriodoDetalle(periodo),
      ),
      nombreInstitucion: this.normalizarNombreInstitucion(
        configuracionPeriodo.nombreInstitucion ??
          this.appConfigService.getTarjetaCentroNombre(),
      ).trimEnd(),
      extensionArchivo: this.normalizarExtensionRequerida(
        configuracionPeriodo,
        periodo,
      ),
    };
  }

  private generarOpcionesFallback(
    periodo: string,
  ): TarjetaCentroArchivoOpcionesNormalizadas {
    this.logger.warn(
      `No existe configuracion operativa de Tarjeta del Centro para ${periodo}. Se aplica fallback derivado.`,
    );

    const extensionArchivo = this.generarExtensionArchivoFallback(periodo);

    return {
      fechaCabecera: this.generarFechaFallback(
        periodo,
        this.appConfigService.getTarjetaCentroFallbackHeaderDay(),
        'fechaCabecera',
      ),
      fechaTrailer: this.generarFechaFallback(
        periodo,
        this.appConfigService.getTarjetaCentroFallbackTrailerDay(),
        'fechaTrailer',
      ),
      codigoPeriodoDetalle: this.generarCodigoPeriodoDetalle(periodo),
      nombreInstitucion: this.normalizarNombreInstitucion(
        this.appConfigService.getTarjetaCentroNombre(),
      ).trimEnd(),
      extensionArchivo,
    };
  }

  private normalizarOpciones(
    opciones: TarjetaCentroArchivoOpciones,
  ): TarjetaCentroArchivoOpcionesNormalizadas {
    return {
      fechaCabecera: this.normalizarFechaArchivo(
        opciones.fechaCabecera,
        'fechaCabecera',
      ),
      fechaTrailer: this.normalizarFechaArchivo(
        opciones.fechaTrailer,
        'fechaTrailer',
      ),
      codigoPeriodoDetalle: this.normalizarCodigoPeriodoDetalle(
        opciones.codigoPeriodoDetalle,
      ),
      nombreInstitucion: this.normalizarNombreInstitucion(
        opciones.nombreInstitucion,
      ).trimEnd(),
      extensionArchivo: this.normalizarExtensionArchivo(opciones.extensionArchivo),
    };
  }

  private mapearDetalleDesdeCuota(cuota: Cuota): TarjetaCentro23fDetalle {
    if (!cuota.socio) {
      throw new BadRequestException(
        `La cuota ${cuota.id} no tiene el socio cargado para exportar Tarjeta del Centro.`,
      );
    }

    const numeroAfiliado = cuota.socio.id ?? cuota.socioId;
    if (!Number.isInteger(numeroAfiliado) || numeroAfiliado <= 0) {
      throw new BadRequestException(
        `La cuota ${cuota.id} tiene un socio sin id valido para usar como numero de afiliado.`,
      );
    }

    const montoReal = Number(cuota.monto);
    this.validarMontoReal(montoReal, `monto de cuota ${cuota.id}`);

    return {
      tarjeta: cuota.socio.numeroTarjetaCentro ?? '',
      numeroAfiliado: String(numeroAfiliado),
      montoReal,
    } satisfies TarjetaCentro23fDetalle;
  }

  private validarPeriodo(periodo: string): void {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(periodo)) {
      throw new BadRequestException(
        `El periodo ${periodo} debe tener formato YYYY-MM.`,
      );
    }
  }

  private normalizarFechaDelPeriodo(
    fecha: string,
    etiqueta: string,
    periodo: string,
  ): string {
    const fechaNormalizada = this.normalizarFechaArchivo(fecha, etiqueta);
    const [, mesPeriodo] = periodo.split('-');
    const anioPeriodoCorto = periodo.slice(2, 4);
    const mesFecha = fechaNormalizada.slice(2, 4);
    const anioFecha = fechaNormalizada.slice(4, 6);

    if (mesFecha !== mesPeriodo || anioFecha !== anioPeriodoCorto) {
      throw new BadRequestException(
        `${etiqueta}=${fechaNormalizada} no coincide con el periodo ${periodo}.`,
      );
    }

    return fechaNormalizada;
  }

  private generarCodigoPeriodoDetalle(periodo: string): string {
    this.validarPeriodo(periodo);
    const [anio, mes] = periodo.split('-');
    return `0000${mes}/${anio.slice(-2)}1`;
  }

  private generarFechaFallback(
    periodo: string,
    dia: number,
    etiqueta: string,
  ): string {
    if (!Number.isInteger(dia) || dia < 1 || dia > 31) {
      throw new BadRequestException(
        `${etiqueta} fallback invalida: dia ${dia}.`,
      );
    }

    const [anio, mes] = periodo.split('-');
    const anioCorto = anio.slice(-2);
    return `${String(dia).padStart(2, '0')}${mes}${anioCorto}`;
  }

  private generarExtensionArchivoFallback(periodo: string): string {
    const trailerDay = this.appConfigService.getTarjetaCentroFallbackTrailerDay();
    const [, mes] = periodo.split('-');
    const monthLetterMap = this.appConfigService.getTarjetaCentroFallbackMonthLetterMap();
    const monthLetter = this.resolverLetraMesFallback(mes, monthLetterMap);

    return this.normalizarExtensionArchivo(
      `${String(trailerDay).padStart(2, '0')}${monthLetter}`,
    );
  }

  private resolverLetraMesFallback(
    mes: string,
    monthLetterMap: TarjetaCentroMonthLetterMap,
  ): string {
    const letter = monthLetterMap[mes];

    if (!letter || !/^[A-Za-z]$/.test(letter)) {
      throw new BadRequestException(
        `No existe una letra fallback valida para el mes ${mes} en Tarjeta del Centro.`,
      );
    }

    return letter.toLowerCase();
  }

  private normalizarExtensionRequerida(
    configuracionPeriodo: TarjetaCentroPeriodoConfig,
    periodo: string,
  ): string {
    if (!configuracionPeriodo.extensionArchivo?.trim()) {
      throw new BadRequestException(
        `La configuracion operativa de Tarjeta del Centro para ${periodo} no define extensionArchivo.`,
      );
    }

    return this.normalizarExtensionArchivo(configuracionPeriodo.extensionArchivo);
  }

  private normalizarFechaArchivo(fecha: string, etiqueta: string): string {
    if (!TarjetaCentro23fService.REGEX_FECHA_DDMMAA.test(fecha)) {
      throw new BadRequestException(
        `${etiqueta} debe tener formato DDMMAA valido. Valor recibido: ${fecha}.`,
      );
    }

    return fecha;
  }

  private normalizarCodigoPeriodoDetalle(codigoPeriodoDetalle: string): string {
    if (
      !TarjetaCentro23fService.REGEX_CODIGO_PERIODO_DETALLE.test(
        codigoPeriodoDetalle,
      )
    ) {
      throw new BadRequestException(
        `codigoPeriodoDetalle debe tener formato ######/###. Valor recibido: ${codigoPeriodoDetalle}.`,
      );
    }

    return codigoPeriodoDetalle;
  }

  private normalizarNombreInstitucion(nombreInstitucion: string): string {
    const nombre = nombreInstitucion.trim().toUpperCase();
    if (!nombre) {
      throw new BadRequestException(
        'El nombre de la institucion para Tarjeta del Centro es obligatorio.',
      );
    }

    if (nombre.length > 22) {
      throw new BadRequestException(
        `El nombre de la institucion excede los 22 caracteres permitidos: "${nombre}".`,
      );
    }

    return nombre.padEnd(22, ' ');
  }

  private normalizarExtensionArchivo(extensionArchivo: string): string {
    if (!TarjetaCentro23fService.REGEX_EXTENSION.test(extensionArchivo)) {
      throw new BadRequestException(
        `extensionArchivo debe tener exactamente 3 caracteres alfanumericos. Valor recibido: ${extensionArchivo}.`,
      );
    }

    return extensionArchivo.toLowerCase();
  }

  private normalizarTarjeta(tarjeta: string): string {
    const tarjetaNormalizada = tarjeta.replace(/\D/g, '');
    if (!/^\d{16}$/.test(tarjetaNormalizada)) {
      throw new BadRequestException(
        `La tarjeta "${tarjeta}" no tiene exactamente 16 digitos.`,
      );
    }

    return tarjetaNormalizada;
  }

  private normalizarNumeroAfiliado(numeroAfiliado: string): string {
    if (!/^\d+$/.test(numeroAfiliado)) {
      throw new BadRequestException(
        `El numero de afiliado "${numeroAfiliado}" debe ser numerico.`,
      );
    }

    if (numeroAfiliado.length > 12) {
      throw new BadRequestException(
        `El numero de afiliado "${numeroAfiliado}" excede las 12 posiciones.`,
      );
    }

    return numeroAfiliado.padStart(12, '0');
  }

  private calcularImporteDetalle(montoReal: number): string {
    this.validarMontoReal(montoReal, 'montoReal');
    if (montoReal % 100 !== 0) {
      throw new BadRequestException(
        `El monto ${montoReal} no puede codificarse porque no es divisible por 100.`,
      );
    }

    const importeCodificado = montoReal / 100;
    return String(importeCodificado).padStart(9, '0');
  }

  private completarConEspaciosDerecha(valor: string, largo: number): string {
    if (valor.length > largo) {
      throw new BadRequestException(
        `La linea excede el largo fijo de ${largo} caracteres.`,
      );
    }

    return valor.padEnd(largo, ' ');
  }

  private validarMontoReal(montoReal: number, etiqueta: string): void {
    if (
      !Number.isFinite(montoReal) ||
      !Number.isInteger(montoReal) ||
      montoReal < 0
    ) {
      throw new BadRequestException(
        `El ${etiqueta} debe ser un entero positivo o cero en pesos completos. Valor recibido: ${montoReal}.`,
      );
    }
  }

  private validarNumeroEnteroNoNegativo(valor: number, etiqueta: string): void {
    if (!Number.isInteger(valor) || valor < 0) {
      throw new BadRequestException(
        `${etiqueta} debe ser un entero no negativo. Valor recibido: ${valor}.`,
      );
    }
  }

  private validarLinea(linea: string, contexto: string): void {
    if (linea.length !== TarjetaCentro23fService.LARGO_LINEA) {
      throw new BadRequestException(
        `La ${contexto} no tiene ${TarjetaCentro23fService.LARGO_LINEA} caracteres exactos.`,
      );
    }

    if (!linea.startsWith(TarjetaCentro23fService.CODIGO_CONVENIO)) {
      throw new BadRequestException(
        `La ${contexto} no comienza con el convenio ${TarjetaCentro23fService.CODIGO_CONVENIO}.`,
      );
    }

    const tipo = linea.charAt(13);
    if (!['1', '2', '9'].includes(tipo)) {
      throw new BadRequestException(
        `La ${contexto} tiene un tipo de registro invalido: ${tipo}.`,
      );
    }

    if (tipo === '1') {
      this.validarCabeceraLinea(linea, contexto);
      return;
    }

    if (tipo === '2') {
      this.validarDetalleLinea(linea, contexto);
      return;
    }

    this.validarTrailerLinea(linea, contexto);
  }

  private validarCabeceraLinea(linea: string, contexto: string): void {
    this.normalizarFechaArchivo(linea.slice(14, 20), `${contexto}.fechaCabecera`);

    if (linea.slice(42, 45) !== TarjetaCentro23fService.CABECERA_FIJO) {
      throw new BadRequestException(
        `La ${contexto} no contiene el fijo de cabecera ${TarjetaCentro23fService.CABECERA_FIJO}.`,
      );
    }

    if (linea.slice(45).trim() !== '') {
      throw new BadRequestException(
        `La ${contexto} debe completar con espacios desde la posicion 46 hasta la 85.`,
      );
    }
  }

  private validarDetalleLinea(linea: string, contexto: string): void {
    if (!/^\d{16}$/.test(linea.slice(14, 30))) {
      throw new BadRequestException(
        `La ${contexto} no contiene una tarjeta valida de 16 digitos.`,
      );
    }

    if (!/^\d{12}$/.test(linea.slice(30, 42))) {
      throw new BadRequestException(
        `La ${contexto} no contiene un afiliado valido de 12 digitos.`,
      );
    }

    if (linea.slice(42, 48) !== TarjetaCentro23fService.DETALLE_FIJO_1) {
      throw new BadRequestException(
        `La ${contexto} no contiene el fijo de detalle ${TarjetaCentro23fService.DETALLE_FIJO_1}.`,
      );
    }

    if (!/^\d{9}$/.test(linea.slice(48, 57))) {
      throw new BadRequestException(
        `La ${contexto} no contiene un importe codificado valido de 9 digitos.`,
      );
    }

    this.normalizarCodigoPeriodoDetalle(linea.slice(57, 67));

    if (linea.slice(67).trim() !== '') {
      throw new BadRequestException(
        `La ${contexto} debe completar con espacios desde la posicion 68 hasta la 85.`,
      );
    }
  }

  private validarTrailerLinea(linea: string, contexto: string): void {
    this.normalizarFechaArchivo(linea.slice(14, 20), `${contexto}.fechaTrailer`);

    if (!/^\d{7}$/.test(linea.slice(20, 27))) {
      throw new BadRequestException(
        `La ${contexto} no contiene una cantidad valida de 7 digitos.`,
      );
    }

    if (!/^\d{13}$/.test(linea.slice(27, 40))) {
      throw new BadRequestException(
        `La ${contexto} no contiene un total valido de 13 digitos.`,
      );
    }

    if (linea.slice(40, 45) !== TarjetaCentro23fService.TRAILER_FIJO) {
      throw new BadRequestException(
        `La ${contexto} no contiene el fijo de trailer ${TarjetaCentro23fService.TRAILER_FIJO}.`,
      );
    }

    if (linea.slice(45).trim() !== '') {
      throw new BadRequestException(
        `La ${contexto} debe completar con espacios desde la posicion 46 hasta la 85.`,
      );
    }
  }

  private validarArchivo(
    lineas: string[],
    cantidadDetallesEsperada: number,
    totalRealEsperado: number,
  ): void {
    if (lineas.length < 2) {
      throw new BadRequestException(
        'El archivo Tarjeta del Centro debe tener al menos cabecera y trailer.',
      );
    }

    lineas.forEach((linea, index) => {
      this.validarLinea(linea, `linea ${index + 1}`);
    });

    if (lineas[0].charAt(13) !== '1') {
      throw new BadRequestException(
        'La primera linea del archivo debe ser cabecera tipo 1.',
      );
    }

    if (lineas[lineas.length - 1].charAt(13) !== '9') {
      throw new BadRequestException(
        'La ultima linea del archivo debe ser trailer tipo 9.',
      );
    }

    const detalles = lineas.slice(1, -1);
    if (!detalles.every((linea) => linea.charAt(13) === '2')) {
      throw new BadRequestException(
        'Todas las lineas intermedias del archivo deben ser detalles tipo 2.',
      );
    }

    const cantidadTrailer = Number.parseInt(
      lineas[lineas.length - 1].slice(20, 27),
      10,
    );
    if (
      cantidadTrailer !== cantidadDetallesEsperada ||
      cantidadTrailer !== detalles.length
    ) {
      throw new BadRequestException(
        `La cantidad del trailer (${cantidadTrailer}) no coincide con los detalles (${detalles.length}).`,
      );
    }

    const totalTrailer = Number.parseInt(
      lineas[lineas.length - 1].slice(27, 40),
      10,
    );
    if (totalTrailer !== totalRealEsperado) {
      throw new BadRequestException(
        `El total del trailer (${totalTrailer}) no coincide con el total real (${totalRealEsperado}).`,
      );
    }
  }
}
