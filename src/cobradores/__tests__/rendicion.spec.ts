import { armarRendicion, rangoRendicion } from '../utils/rendicion';
import { CobradoresService } from '../cobradores.service';
import { CobradoresController } from '../cobradores.controller';
import { CobroOperacion } from '../../cobros/entities/cobro-operacion.entity';

const operacion = (datos: Partial<CobroOperacion>): CobroOperacion =>
  Object.assign(new CobroOperacion(), {
    id: 1,
    fechaHoraServidor: new Date('2026-01-01T03:00:00Z'),
    lineas: [],
    pagos: [],
  }, datos);

describe('Rendición de cobranzas', () => {
  it('usa días del club y excluye el inicio del mes siguiente', () => {
    const rango = rangoRendicion(undefined, undefined, '2024-02');
    expect(rango).toMatchObject({
      desde: '2024-02-01',
      hasta: '2024-02-29',
      inicio: new Date('2024-02-01T03:00:00Z'),
      finInclusivo: new Date('2024-03-01T02:59:59.999Z'),
    });
    expect(rangoRendicion('2025-12-31', '2026-01-01')).toMatchObject({
      inicio: new Date('2025-12-31T03:00:00Z'),
      finInclusivo: new Date('2026-01-02T02:59:59.999Z'),
    });
    expect(() => rangoRendicion('2026-02-30', '2026-03-02')).toThrow();
    expect(() => rangoRendicion('2026-03-02', '2026-03-01')).toThrow();
    expect(() => rangoRendicion('2026-03-01', '2026-03-02', '2026-03')).toThrow();
  });

  it('rechaza parámetros de rango ambiguos en vez de devolver el mes completo', () => {
    const servicio = { obtenerRendicion: jest.fn() };
    const controlador = new CobradoresController(servicio as unknown as CobradoresService);
    const llamar = (consulta: Record<string, unknown>) => Reflect.apply(controlador.rendicion, controlador, [17, consulta]);
    expect(() => llamar({ periodo: '2024-02', 'desde[]': '2024-02-12' })).toThrow();
    expect(() => llamar({ periodo: ['2024-02', '2024-03'] })).toThrow();
    expect(servicio.obtenerRendicion).not.toHaveBeenCalled();
    llamar({ periodo: '2024-02' });
    expect(servicio.obtenerRendicion).toHaveBeenCalledWith(17, undefined, undefined, '2024-02');
  });

  it('separa métodos reales, exceso recibido, crédito aplicado y datos incompletos', () => {
    const pagos = [
      { id: 21, metodoPagoId: 1, metodoPago: { nombre: 'Efectivo' }, montoPagado: 6000.5 },
      { id: 22, metodoPagoId: 2, metodoPago: { nombre: 'Transferencia' }, montoPagado: 4000 },
    ] as CobroOperacion['pagos'];
    const cuotas = [{ tipoLinea: 'CUOTA', cuotaId: 10, cuota: { periodo: '2026-01' } }] as CobroOperacion['lineas'];
    const extras = [{ tipoLinea: 'CONCEPTO', concepto: 'Inscripción' }] as CobroOperacion['lineas'];
    const resultado = armarRendicion([
      operacion({ id: 1, lineas: cuotas, pagos: [...pagos, pagos[0]], totalCargos: 10000, creditoAplicado: 500, creditoGenerado: 500.5 }),
      operacion({ id: 2, lineas: extras, totalCargos: 3000, creditoAplicado: 1000, creditoGenerado: 100 }),
      operacion({ id: 3, lineas: extras, totalCargos: 1000, creditoAplicado: 1000, creditoGenerado: 0 }),
      operacion({ id: 4, lineas: extras }),
      operacion({ id: 5, lineas: extras, grupoFamiliarId: 7, totalCargos: 5000, creditoAplicado: 0, creditoGenerado: 500 }),
    ]);
    expect(resultado).toMatchObject({
      totalVerificadoCentavos: 1210050,
      cantidadImporteNoVerificable: 2,
      porMetodo: [
        { metodo: 'Efectivo', centavos: 600050 },
        { metodo: 'Método no registrado', centavos: 210000 },
        { metodo: 'Transferencia', centavos: 400000 },
      ],
      cobros: [
        { id: 1, conceptos: ['Cuota 2026-01'], recibidoCentavos: 1000050 },
        { id: 2, conceptos: ['Inscripción'], recibidoCentavos: 210000 },
        { id: 3, recibidoCentavos: 0 },
        { id: 4, recibidoCentavos: null },
        { id: 5, recibidoCentavos: null },
      ],
    });
  });

  it('no interpreta ceros de migración como prueba de que el cobro recaudó cero', () => {
    const historico = operacion({
      total: 75, totalCargos: 0, creditoAplicado: 0, creditoGenerado: 0,
      lineas: [{ tipoLinea: 'CONCEPTO', concepto: 'Inscripción', monto: 75 }] as CobroOperacion['lineas'],
    });
    expect(armarRendicion([historico])).toMatchObject({
      cantidadImporteNoVerificable: 1, cobros: [{ recibidoCentavos: null }], porMetodo: [],
    });
  });

  it('la app usa la cobradora vinculada al teléfono y rechaza un teléfono desconocido', async () => {
    const servicio = Object.create(CobradoresService.prototype) as any;
    servicio.dispositivoRepository = { findOne: jest.fn().mockResolvedValue({ cobradorId: 17 }) };
    servicio.obtenerRendicion = jest.fn().mockResolvedValue({ cobros: [] });

    await servicio.obtenerRendicionMobile('device-1', undefined, undefined, '2026-02');

    expect(servicio.dispositivoRepository.findOne).toHaveBeenCalledWith({ where: { installationId: 'device-1' } });
    expect(servicio.obtenerRendicion).toHaveBeenCalledWith(17, undefined, undefined, '2026-02');
    servicio.dispositivoRepository.findOne.mockResolvedValue(null);
    await expect(servicio.obtenerRendicionMobile('otro')).rejects.toThrow('No autorizado');
  });

  it('incluye el residual verificable de un grupo sin asignarle un método inventado', () => {
    const grupo = operacion({
      grupoFamiliarId: 7, total: 175, totalCargos: 175, creditoAplicado: 0, creditoGenerado: 0,
      pagos: [{ id: 21, metodoPago: { nombre: 'Efectivo' }, montoPagado: 100 }] as CobroOperacion['pagos'],
      lineas: [
        { tipoLinea: 'CUOTA', cuotaId: 10, monto: 100 },
        { tipoLinea: 'CONCEPTO', concepto: 'Inscripción', monto: 75 },
      ] as CobroOperacion['lineas'],
    });
    expect(armarRendicion([grupo])).toMatchObject({
      totalVerificadoCentavos: 17500, cantidadImporteNoVerificable: 0, cobros: [{ recibidoCentavos: 17500 }],
      porMetodo: [{ metodo: 'Efectivo', centavos: 10000 }, { metodo: 'Método no registrado', centavos: 7500 }],
    });
  });
});
