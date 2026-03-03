import { TarjetaCentro23fService } from '../services/tarjeta-centro-23f.service';
import { Cuota, EstadoCuota } from '../entities/cuota.entity';
import { Socio } from '../../socios/entities/socio.entity';
import { AppConfigService } from '../../config/AppConfig/app-config.service';

describe('TarjetaCentro23fService', () => {
  const appConfigMock = {
    getTarjetaCentroPrefix: jest.fn(() => 'C0019094'),
    getTarjetaCentroEmisor: jest.fn(() => '431005001909'),
    getTarjetaCentroNombre: jest.fn(() => 'CLUB DE CAZADORES LA'),
  } as unknown as AppConfigService;

  const service = new TarjetaCentro23fService(appConfigMock);

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

  const crearCuota = (id: number, monto: number, socio: Socio): Cuota => ({
    id,
    socioId: socio.id,
    periodo: '2026-02',
    monto,
    estado: EstadoCuota.PENDIENTE,
    barcode: `02-2026-${id}`,
    createdAt: new Date('2026-02-01T00:00:00.000Z'),
    fechaPago: undefined,
    socio,
    pagos: [],
  });

  it('deberia generar archivo con cabecera, detalles y trailer de 85 caracteres', () => {
    const cuota1 = crearCuota(2844, 4500, crearSocio(1, '5047812020817021', true));
    const cuota2 = crearCuota(1950, 6000, crearSocio(2, '5047812021305125', true));

    const archivo = service.generarArchivo('2026-02', [cuota1, cuota2]);
    const lineas = archivo.content.split('\n');

    expect(archivo.fileName).toBe('C0019094.23f');
    expect(lineas).toHaveLength(4);
    expect(lineas.every((linea) => linea.length === 85)).toBe(true);

    expect(lineas[0].slice(0, 14)).toBe('43100500190941');
    expect(lineas[1].slice(0, 14)).toBe('43100500190942');
    expect(lineas[2].slice(0, 14)).toBe('43100500190942');
    expect(lineas[3].slice(0, 14)).toBe('43100500190949');

    expect(lineas[1].slice(14, 30)).toBe('5047812020817021');
    expect(lineas[1].slice(30, 42)).toBe('000000002844');
    expect(lineas[1].slice(55, 57)).toBe('45');

    expect(lineas[2].slice(14, 30)).toBe('5047812021305125');
    expect(lineas[2].slice(30, 42)).toBe('000000001950');
    expect(lineas[2].slice(55, 57)).toBe('60');

    expect(lineas[3].slice(20, 27)).toBe('0000002');
    expect(lineas[3].slice(27, 39)).toBe('000000001050');
  });

  it('deberia omitir cuotas de socios sin tarjeta del centro o sin numero de tarjeta', () => {
    const cuotaConTarjeta = crearCuota(4001, 4500, crearSocio(1, '5047812020817021', true));
    const cuotaSinNumero = crearCuota(4002, 4500, crearSocio(2, undefined, true));
    const cuotaSinTarjetaCentro = crearCuota(4003, 4500, crearSocio(3, '5047812020817000', false));

    const archivo = service.generarArchivo('2026-02', [
      cuotaConTarjeta,
      cuotaSinNumero,
      cuotaSinTarjetaCentro,
    ]);

    const lineas = archivo.content.split('\n');
    expect(lineas).toHaveLength(3);
    expect(lineas[2].slice(20, 27)).toBe('0000001');
  });
});
