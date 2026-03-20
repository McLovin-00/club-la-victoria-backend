import { TarjetaCentro23fService } from '../services/tarjeta-centro-23f.service';
import { Cuota, EstadoCuota } from '../entities/cuota.entity';
import { Socio } from '../../socios/entities/socio.entity';
import {
  AppConfigService,
  TarjetaCentroPeriodoConfig,
} from '../../config/AppConfig/app-config.service';

describe('TarjetaCentro23fService', () => {
  const configuracionPorPeriodo: Record<string, TarjetaCentroPeriodoConfig> = {
    '2026-02': {
      fechaCabecera: '220226',
      fechaTrailer: '230226',
      extensionArchivo: '23f',
    },
    '2025-11': {
      fechaCabecera: '201125',
      fechaTrailer: '201125',
      extensionArchivo: '20n',
      codigoPeriodoDetalle: '000011/251',
    },
    '2025-08': {
      fechaCabecera: '220825',
      fechaTrailer: '220825',
      extensionArchivo: '22a',
      codigoPeriodoDetalle: '000008/251',
    },
  };

  const appConfigMock = {
    getTarjetaCentroPrefix: jest.fn(() => 'C0019094'),
    getTarjetaCentroNombre: jest.fn(() => 'CLUB DE CAZADORES LA'),
    getTarjetaCentroPeriodConfig: jest.fn(() => configuracionPorPeriodo),
    getTarjetaCentroFallbackHeaderDay: jest.fn(() => 22),
    getTarjetaCentroFallbackTrailerDay: jest.fn(() => 23),
    getTarjetaCentroFallbackMonthLetterMap: jest.fn(() => ({
      '01': 'e',
      '02': 'f',
      '03': 'm',
      '04': 'b',
      '05': 'y',
      '06': 'j',
      '07': 'l',
      '08': 'a',
      '09': 's',
      '10': 'o',
      '11': 'n',
      '12': 'd',
    })),
  } as unknown as AppConfigService;

  const service = new TarjetaCentro23fService(appConfigMock);

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-03-13T15:00:00.000Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  const crearSocio = (
    id: number,
    numeroTarjetaCentro: string | undefined,
    tarjetaCentro: boolean,
  ): Socio => ({
    id,
    nombre: `Nombre ${id}`,
    apellido: `Apellido ${id}`,
    dni: undefined,
    telefono: undefined,
    email: undefined,
    fechaAlta: '2026-01-01',
    fechaNacimiento: '1990-01-01',
    direccion: undefined,
    estado: 'ACTIVO',
    genero: 'MASCULINO',
    overrideManual: false,
    fotoUrl: undefined,
    tarjetaCentro,
    numeroTarjetaCentro,
    categoria: undefined,
    grupoFamiliar: undefined,
    temporadas: [],
    ingresos: [],
    cuotas: [],
  });

  const crearCuota = (
    id: number,
    monto: number,
    socio: Socio,
    periodo = '2026-02',
  ): Cuota => ({
    id,
    socioId: socio.id,
    periodo,
    monto,
    estado: EstadoCuota.PENDIENTE,
    rechazadaTarjetaCentro: false,
    createdAt: new Date('2026-02-01T00:00:00.000Z'),
    fechaPago: undefined,
    socio,
    pagos: [],
  });

  it('deberia generar archivo usando metadata operativa del periodo sin ingreso manual', () => {
    const cuota1 = crearCuota(
      2844,
      4500,
      crearSocio(2844, '5047812020817021', true),
    );
    const cuota2 = crearCuota(
      1950,
      6000,
      crearSocio(1950, '5047812021305125', true),
    );

    const archivo = service.generarArchivo('2026-02', [cuota1, cuota2]);
    const lineas = archivo.content.split('\n');

    expect(archivo.fileName).toBe('C0019094.13m');
    expect(lineas).toHaveLength(4);
    expect(lineas.every((linea) => linea.length === 85)).toBe(true);
    expect(lineas[0]).toBe(
      '43100500190941220226CLUB DE CAZADORES LA  000                                        ',
    );
    expect(lineas[1]).toBe(
      '431005001909425047812020817021000000002844001001000000045000002/261                  ',
    );
    expect(lineas[2]).toBe(
      '431005001909425047812021305125000000001950001001000000060000002/261                  ',
    );
    expect(lineas[3]).toBe(
      '431005001909492302260000002000000001050000000                                        ',
    );
  });

  it('deberia respetar un codigoPeriodoDetalle configurado explicitamente', () => {
    const cuota = crearCuota(
      1950,
      6000,
      crearSocio(1950, '5047812020817021', true),
      '2025-11',
    );

    const archivo = service.generarArchivo('2025-11', [cuota]);
    const lineas = archivo.content.split('\n');

    expect(archivo.fileName).toBe('C0019094.13m');
    expect(lineas[0].slice(14, 20)).toBe('201125');
    expect(lineas[1].slice(57, 67)).toBe('000011/251');
    expect(lineas[2].slice(14, 20)).toBe('201125');
  });

  it('deberia omitir cuotas de socios sin tarjeta del centro o sin numero de tarjeta', () => {
    const cuotaConTarjeta = crearCuota(
      4001,
      4500,
      crearSocio(4001, '5047812020817021', true),
    );
    const cuotaSinNumero = crearCuota(
      4002,
      4500,
      crearSocio(2, undefined, true),
    );
    const cuotaSinTarjetaCentro = crearCuota(
      4003,
      4500,
      crearSocio(3, '5047812020817000', false),
    );

    const archivo = service.generarArchivo('2026-02', [
      cuotaConTarjeta,
      cuotaSinNumero,
      cuotaSinTarjetaCentro,
    ]);

    const lineas = archivo.content.split('\n');
    expect(lineas).toHaveLength(3);
    expect(lineas[2].slice(20, 27)).toBe('0000001');
    expect(lineas[1].slice(30, 42)).toBe('000000004001');
  });

  it('deberia fallar si la tarjeta no tiene 16 digitos', () => {
    const cuota = crearCuota(2844, 4500, crearSocio(2844, '12345', true));

    expect(() => service.generarArchivo('2026-02', [cuota])).toThrow(
      'no tiene exactamente 16 digitos',
    );
  });

  it('deberia fallar si el monto no es divisible por 100', () => {
    const cuota = crearCuota(
      2844,
      4550,
      crearSocio(2844, '5047812020817021', true),
    );

    expect(() => service.generarArchivo('2026-02', [cuota])).toThrow(
      'no puede codificarse porque no es divisible por 100',
    );
  });

  it('deberia derivar metadata fallback si no existe configuracion operativa para el periodo', () => {
    const cuota = crearCuota(
      2844,
      4500,
      crearSocio(2844, '5047812020817021', true),
      '2026-01',
    );

    const archivo = service.generarArchivo('2026-01', [cuota]);
    const lineas = archivo.content.split('\n');

    expect(archivo.fileName).toBe('C0019094.13m');
    expect(lineas[0].slice(14, 20)).toBe('220126');
    expect(lineas[1].slice(57, 67)).toBe('000001/261');
    expect(lineas[2].slice(14, 20)).toBe('230126');
  });

  it('deberia generar el nombre de archivo segun la fecha actual de Argentina', () => {
    expect(service.generarNombreArchivo(new Date('2026-03-01T02:30:00.000Z'))).toBe(
      'C0019094.28f',
    );
  });

  it('deberia fallar si la fecha configurada no coincide con el periodo', () => {
    appConfigMock.getTarjetaCentroPeriodConfig = jest.fn(() => ({
      '2026-02': {
        fechaCabecera: '220326',
        fechaTrailer: '230226',
        extensionArchivo: '23f',
      },
    })) as unknown as AppConfigService['getTarjetaCentroPeriodConfig'];

    const serviceConConfigInvalida = new TarjetaCentro23fService(appConfigMock);
    const cuota = crearCuota(
      2844,
      4500,
      crearSocio(2844, '5047812020817021', true),
    );

    expect(() => serviceConConfigInvalida.generarArchivo('2026-02', [cuota])).toThrow(
      'fechaCabecera=220326 no coincide con el periodo 2026-02',
    );

    appConfigMock.getTarjetaCentroPeriodConfig = jest.fn(
      () => configuracionPorPeriodo,
    ) as unknown as AppConfigService['getTarjetaCentroPeriodConfig'];
  });
});
