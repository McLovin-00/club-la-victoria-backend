import {
  CategoriaRulesService,
  CategoriaSocio,
} from '../services/categoria-rules.service';
import { Socio } from '../entities/socio.entity';

describe('CategoriaRulesService', () => {
  const fechaActualReferencia = new Date('2026-06-15T15:00:00.000Z');
  let service: CategoriaRulesService;

  const crearSocio = (overrides: Partial<Socio> = {}): Socio => ({
    id: 1,
    nombre: 'Nombre',
    apellido: 'Apellido',
    fechaAlta: '2020-01-01',
    fechaNacimiento: '1990-01-01',
    estado: 'ACTIVO',
    genero: 'MASCULINO',
    overrideManual: false,
    temporadas: [],
    ingresos: [],
  cuotas: [],
  tarjetaCentro: false,
    ...overrides,
  });

  beforeEach(() => {
    service = new CategoriaRulesService();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('asigna ADHERENTE cuando el socio es menor de 13', () => {
    jest.setSystemTime(fechaActualReferencia);

    const socio = crearSocio({
      fechaNacimiento: '2013-06-16',
      fechaAlta: '2025-01-01',
    });

    expect(service.calcularCategoria(socio)).toBe(CategoriaSocio.ADHERENTE);
  });

  it('asigna ACTIVO cuando el socio es mayor de 13', () => {
    jest.setSystemTime(fechaActualReferencia);

    const socio = crearSocio({
      fechaNacimiento: '2013-06-14',
      fechaAlta: '2025-01-01',
    });

    expect(service.calcularCategoria(socio)).toBe(CategoriaSocio.ACTIVO);
  });

  it('asigna VITALICIO con 45 años exactos de antiguedad', () => {
    jest.setSystemTime(fechaActualReferencia);

    const socio = crearSocio({
      fechaAlta: '1981-06-15',
      fechaNacimiento: '1970-01-01',
    });

    expect(service.calcularCategoria(socio)).toBe(CategoriaSocio.VITALICIO);
  });

  it('mantiene ACTIVO con 44 años y 364 dias de antiguedad', () => {
    jest.setSystemTime(fechaActualReferencia);

    const socio = crearSocio({
      fechaAlta: '1981-06-16',
      fechaNacimiento: '1970-01-01',
    });

    expect(service.calcularCategoria(socio)).toBe(CategoriaSocio.ACTIVO);
  });

  it('asigna ACTIVO cuando cumple 13 hoy', () => {
    jest.setSystemTime(fechaActualReferencia);

    const socio = crearSocio({
      fechaNacimiento: '2013-06-15',
      fechaAlta: '2025-01-01',
    });

    expect(service.calcularCategoria(socio)).toBe(CategoriaSocio.ACTIVO);
  });

  it('usa la fecha de Argentina para el calculo de edad', () => {
    jest.setSystemTime(new Date('2026-01-01T02:30:00.000Z'));

    const socio = crearSocio({
      fechaNacimiento: '2013-01-02',
      fechaAlta: '2025-01-01',
    });

    expect(service.calcularCategoria(socio)).toBe(CategoriaSocio.ADHERENTE);
  });
});
