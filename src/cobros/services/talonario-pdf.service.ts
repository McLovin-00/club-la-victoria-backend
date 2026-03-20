import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { Cuota } from '../entities/cuota.entity';

interface TalonarioData {
  socioNumero: number;
  socioNombre: string;
  socioApellido: string;
  socioDireccion: string;
  periodo: string;
  monto: number;
  grupoNombre?: string;
  grupoOrden?: number;
}

@Injectable()
export class TalonarioPdfService {
  private readonly logger = new Logger(TalonarioPdfService.name);

  /**
   * Genera el HTML del talonario con los datos de las cuotas
   * Incluye separadores visuales entre grupos familiares
   */
  async generarHtmlTalonario(
    cuotas: Cuota[],
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _periodo: string,
  ): Promise<string> {
    const template = this.getTemplateEmbebido();

    // Mapear cuotas a datos del talonario
    const talonarioData = this.mapearCuotasATalonarioData(cuotas);

    // Generar contenido con headers de grupo
    const contenidoHtml = this.generarContenidoConGrupos(talonarioData);

    // Reemplazar el marcador en el template
    const htmlFinal = template.replace(
      '<!-- PÁGINAS GENERADAS DINÁMICAMENTE -->',
      contenidoHtml,
    );

    return htmlFinal;
  }

  /**
   * Genera el HTML de un recibo individual para impresión
   */
  async generarHtmlReciboIndividual(cuota: Cuota): Promise<string> {
    const template = this.getTemplateEmbebido();
    const [dataRecibo] = this.mapearCuotasATalonarioData([cuota]);
    const filaHtml = this.generarFilaHtml(dataRecibo, 1);
    const contenidoHtml = `<div class="page" style="page-break-after: auto;">\n${filaHtml}\n</div>`;

    return template.replace(
      '<!-- PÁGINAS GENERADAS DINÁMICAMENTE -->',
      contenidoHtml,
    );
  }

  async generarHtmlReciboMultiple(cuotas: Cuota[]): Promise<string> {
    const template = this.getTemplateEmbebido();
    const cuotasOrdenadas = [...cuotas].sort((a, b) =>
      a.periodo.localeCompare(b.periodo),
    );
    const data = this.mapearCuotasATalonarioData(cuotasOrdenadas);
    const filasPorPagina = 7;
    const paginas: string[] = [];

    for (let i = 0; i < data.length; i += filasPorPagina) {
      const pagina = data.slice(i, i + filasPorPagina);
      paginas.push(
        this.generarPaginaHtml(pagina, Math.floor(i / filasPorPagina)),
      );
    }

    const contenidoHtml = paginas.join('\n');
    return template.replace(
      '<!-- PÁGINAS GENERADAS DINÁMICAMENTE -->',
      contenidoHtml,
    );
  }

  /**
   * Genera el contenido del talonario con headers de grupo y paginación
   */
  private generarContenidoConGrupos(cuotas: TalonarioData[]): string {
    const filasPorPagina = 7;
    let filasEnPaginaActual = 0;
    let grupoActual: string | undefined = undefined;
    let htmlPaginas = '';
    let filasHtmlActual = '';

    for (let i = 0; i < cuotas.length; i++) {
      const cuota = cuotas[i];
      const nombreGrupo = cuota.grupoNombre;

      // Detectar cambio de grupo
      if (nombreGrupo !== grupoActual) {
        // Insertar header de grupo
        filasHtmlActual += this.generarGrupoHeaderHtml(
          nombreGrupo || 'Sin Grupo',
        );
        filasEnPaginaActual++;
        grupoActual = nombreGrupo;
      }

      // Agregar fila de cuota
      filasHtmlActual += this.generarFilaHtml(cuota, i + 1);
      filasEnPaginaActual++;

      // Si la página está llena, cerrarla y comenzar una nueva
      if (filasEnPaginaActual >= filasPorPagina) {
        htmlPaginas += `<div class=\"page\">\n${filasHtmlActual}\n</div>\n`;
        filasHtmlActual = '';
        filasEnPaginaActual = 0;
      }
    }

    // Agregar última página si tiene contenido
    if (filasHtmlActual) {
      htmlPaginas += `<div class=\"page\">\n${filasHtmlActual}\n</div>`;
    }

    return htmlPaginas;
  }

  /**
   * Genera el HTML del header de un grupo familiar
   */
  private generarGrupoHeaderHtml(nombreGrupo: string): string {
    return `\n        <div class=\"grupo-header\">
            <span class=\"grupo-header-text\">${nombreGrupo}</span>
        </div>`;
  }
  private mapearCuotasATalonarioData(cuotas: Cuota[]): TalonarioData[] {
    return cuotas.map((cuota) => ({
      socioNumero: cuota.socioId,
      socioNombre: cuota.socio?.nombre || '',
      socioApellido: cuota.socio?.apellido || '',
      socioDireccion: cuota.socio?.direccion || '',
      periodo: cuota.periodo,
      monto: Number(cuota.monto),
      grupoNombre: cuota.socio?.grupoFamiliar?.nombre,
      grupoOrden: cuota.socio?.grupoFamiliar?.orden,
    }));
  }

  private generarPaginaHtml(
    cuotas: TalonarioData[],
    pageIndex: number,
  ): string {
    // No rellenar con filas vacías - solo generar filas con datos reales
    const filasHtml = cuotas
      .map((cuota, index) =>
        this.generarFilaHtml(cuota, pageIndex * 7 + index + 1),
      )
      .join('\n');

    return `
    <div class="page">
        ${filasHtml}
    </div>`;
  }
  private generarFilaHtml(cuota: TalonarioData, num: number): string {
    const nombreCompleto = `${cuota.socioApellido}, ${cuota.socioNombre}`.trim();
    const montoFormateado =
      cuota.monto > 0 ? `$${Math.round(cuota.monto)}` : '';

    return `
        <div class="row">
            <div class="talon talon-club">
                <div class="header">
                    <div class="logo-container">
                        <div class="logo">
                            <div class="logo-line1">Club de Cazadores</div>
                            <div class="logo-line2">LA VICTORIA</div>
                        </div>
                    </div>
                    <div class="titulo-container">
                        <h2 class="titulo">Cuota Social</h2>
                        <div class="subtitulo">Comprobante de Pago</div>
                    </div>
                </div>
                <div class="contenido">
                    <div class="datos">
                        <div class="campo">
                            <span class="campo-label">Socio Nº:</span>
                            <span class="campo-valor">${cuota.socioNumero || ''}</span>
                        </div>
                        <div class="campo">
                            <span class="campo-label">Nombre:</span>
                            <span class="campo-valor">${nombreCompleto}</span>
                        </div>
                        <div class="campo">
                            <span class="campo-label">Dirección:</span>
                            <span class="campo-valor">${cuota.socioDireccion}</span>
                        </div>
                        <div class="campo-row">
                            <div class="campo">
                                <span class="campo-label">Cuota:</span>
                                <span class="campo-valor">${cuota.periodo}</span>
                            </div>
                            <div class="campo">
                                <span class="campo-label">Importe:</span>
                                <span class="campo-valor">${montoFormateado}</span>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="footer footer-club">Talón para el Club</div>
            </div>
            <div class="talon talon-socio">
                <div class="header">
                    <div class="logo-container">
                        <div class="logo">
                            <div class="logo-line1">Club de Cazadores</div>
                            <div class="logo-line2">LA VICTORIA</div>
                        </div>
                    </div>
                    <div class="titulo-container">
                        <h2 class="titulo">Cuota Social</h2>
                        <div class="subtitulo">Comprobante de Pago</div>
                    </div>
                </div>
                <div class="contenido">
                    <div class="datos">
                        <div class="campo">
                            <span class="campo-label">Socio Nº:</span>
                            <span class="campo-valor">${cuota.socioNumero || ''}</span>
                        </div>
                        <div class="campo">
                            <span class="campo-label">Nombre:</span>
                            <span class="campo-valor">${nombreCompleto}</span>
                        </div>
                        <div class="campo">
                            <span class="campo-label">Dirección:</span>
                            <span class="campo-valor">${cuota.socioDireccion}</span>
                        </div>
                        <div class="campo-row">
                            <div class="campo">
                                <span class="campo-label">Cuota:</span>
                                <span class="campo-valor">${cuota.periodo}</span>
                            </div>
                        </div>
                    </div>
                    <div class="valor-section">
                        <div class="valor-label">Importe</div>
                        <div class="valor-monto">${montoFormateado || '$____'}</div>
                    </div>
                </div>
                <div class="footer footer-socio">Talón para el Socio</div>
            </div>
        </div>`;
  }

  private getTemplateEmbebido(): string {
    return `<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Talonario - Club de Cazadores La Victoria</title>
    <style>
        @page { size: A4; margin: 0; }
        * { box-sizing: border-box; }
        body { margin: 0; padding: 0; font-family: 'Segoe UI', Arial, sans-serif; background: #f5f5f5; }
        .page { width: 210mm; height: 297mm; padding: 8mm 10mm; box-sizing: border-box; page-break-after: always; background: white; }
        .row { display: flex; margin-bottom: 2mm; height: 38mm; }
        .talon { flex: 1; border: 2px solid #1a4d2e; padding: 3mm; position: relative; background: linear-gradient(135deg, #ffffff 0%, #f8faf8 100%); border-radius: 3px; display: flex; flex-direction: column; }
        .talon-club { margin-right: 2mm; border-left: 5px solid #c41e3a; }
        .talon-socio { margin-left: 2mm; border-left: 5px solid #1a4d2e; }
        .header { display: flex; align-items: center; padding-bottom: 1mm; border-bottom: 1px dashed #1a4d2e; margin-bottom: 1.5mm; }
        .logo-container { display: flex; align-items: center; gap: 2mm; }
        .logo { background: linear-gradient(180deg, #1a4d2e 0%, #1a4d2e 50%, #c41e3a 50%, #c41e3a 100%); color: white; padding: 1.5mm 2.5mm; font-weight: bold; font-size: 6px; line-height: 1.3; border-radius: 2px; min-width: 18mm; text-align: center; box-shadow: 0 1px 2px rgba(0, 0, 0, 0.2); }
        .logo-line1 { font-size: 6px; letter-spacing: 0.2px; }
        .logo-line2 { font-size: 8px; font-weight: 800; letter-spacing: 0.5px; }
        .titulo-container { flex: 1; text-align: center; }
        .titulo { color: #1a4d2e; font-size: 12px; font-weight: 700; letter-spacing: 2px; text-transform: uppercase; margin: 0; text-shadow: 1px 1px 0 rgba(26, 77, 46, 0.1); }
        .subtitulo { color: #666; font-size: 7px; letter-spacing: 0.5px; margin-top: 0; }
        .contenido { flex: 1; display: flex; gap: 2mm; }
        .datos { flex: 1; display: flex; flex-direction: column; justify-content: space-around; font-size: 9px; padding: 1mm 0; }
        .campo { display: flex; align-items: baseline; gap: 2mm; }
        .campo-label { color: #1a4d2e; font-weight: 600; font-size: 8px; text-transform: uppercase; white-space: nowrap; }
        .campo-valor { flex: 1; border-bottom: 1px solid #aaa; min-height: 12px; font-size: 10px; color: #333; }
        .campo-row { display: flex; gap: 4mm; }
        .campo-row .campo { flex: 1; }
        .valor-section { display: flex; flex-direction: column; align-items: center; justify-content: center; min-width: 20mm; padding-left: 2mm; border-left: 1px dashed #ddd; }
        .valor-label { font-size: 7px; color: #666; text-transform: uppercase; margin-bottom: 1mm; }
        .valor-monto { font-size: 14px; font-weight: 700; color: #1a4d2e; }
        .footer { font-size: 6px; color: #888; text-transform: uppercase; letter-spacing: 1px; text-align: right; margin-top: 1mm; padding-top: 1mm; border-top: 1px dotted #ddd; }
        .footer-club { color: #c41e3a; }
        .footer-socio { color: #1a4d2e; }
        .grupo-header { display: flex; align-items: center; margin: 3mm 0 2mm 0; padding: 2mm 4mm; border-bottom: 1px solid #1a4d2e; page-break-inside: avoid; }
        .grupo-header-text { color: #1a4d2e; font-size: 10px; font-weight: 600; letter-spacing: 1px; text-transform: uppercase; }
        @media print { body { margin: 0; background: white; } .page { margin: 0; box-shadow: none; } .grupo-header { page-break-inside: avoid; page-break-after: avoid; } }
    </style>
</head>
<body>
    <!-- PÁGINAS GENERADAS DINÁMICAMENTE -->
</body>
</html>`;
  }
}
