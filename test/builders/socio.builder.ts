import { Socio } from '../../src/socios/entities/socio.entity';

type SocioBuilderOptions = Partial<Socio>;

/**
 * Builder para crear instancias de Socio para tests
 * Permite sobrescribir propiedades específicas o generar datos dinámicamente
 */
export class SocioBuilder {
  private socio: Partial<Socio>;

  constructor(options: SocioBuilderOptions = {}) {
    this.socio = {
    id: 1,
    nombre: 'Juan',
    apellido: 'Pérez',
    dni: '12345678',
    telefono: '1234567890',
    email: 'test@test.com',
    fechaAlta: '2024-01-15',
    fechaNacimiento: '1990-05-15',
    direccion: 'Calle Test 123',
    estado: 'ACTIVO',
    genero: 'MASCULINO',
    overrideManual: false,
    tarjetaCentro: false,
    ...options,
  };

  withId(id: number): this {
    this.socio.id = id;
    return this;
  }

  withNombre(nombre: string): this {
    this.socio.nombre = nombre;
    return this;
  }

  withApellido(apellido: string): this {
    this.socio.apellido = apellido;
    return this;
  }

  withDni(dni: string | undefined): this {
    this.socio.dni = dni;
    return this;
  }

  withTelefono(telefono: string | undefined): this {
    this.socio.telefono = telefono;
    return this;
  }

  withEmail(email: string | undefined): this {
    this.socio.email = email;
    return this;
  }

  withEstado(estado: string): this {
    this.socio.estado = estado;
    return this;
  }

  withGenero(genero: string): this {
    this.socio.genero = genero;
    return this;
  }

  withGrupoFamiliar(grupoFamiliar: any): this {
    this.socio.grupoFamiliar = grupoFamiliar;
    return this;
  }

  withoutGrupoFamiliar(): this {
    this.socio.grupoFamiliar = undefined;
    return this;
  }

  inactivo(): this {
    this.socio.estado = 'INACTIVO';
    return this;
  }

  moroso(): this {
    this.socio.estado = 'MOROSO';
    return this;
  }

  build(): Partial<Socio> {
    return { ...this.socio } as Socio;
  }
}
