import { GrupoFamiliar } from '../../src/grupos-familiares/entities/grupo-familiar.entity';
import { Socio } from '../../src/socios/entities/socio.entity';

type GrupoFamiliarBuilderOptions = Partial<GrupoFamiliar> & { socios?: Socio[] };

/**
 * Builder para crear instancias de GrupoFamiliar para tests
 */
export class GrupoFamiliarBuilder {
  private grupo: Partial<GrupoFamiliar> & { socios?: Socio[] };

  constructor(options: GrupoFamiliarBuilderOptions = {}) {
    this.grupo = {
      id: 1,
      nombre: 'Familia Test',
      descripcion: 'Descripción de prueba',
      orden: 1,
      createdAt: new Date('2024-01-01T00:00:00Z'),
      updatedAt: new Date('2024-01-01T00:00:00Z'),
      socios: [],
      ...options,
    };
  }

  withId(id: number): this {
    this.grupo.id = id;
    return this;
  }

  withNombre(nombre: string): this {
    this.grupo.nombre = nombre;
    return this;
  }

  withDescripcion(descripcion: string | undefined): this {
    this.grupo.descripcion = descripcion;
    return this;
  }

  withOrden(orden: number): this {
    this.grupo.orden = orden;
    return this;
  }

  withSocios(socios: Socio[]): this {
    this.grupo.socios = socios;
    return this;
  }

  addSocio(socio: Socio): this {
    if (!this.grupo.socios) {
      this.grupo.socios = [];
    }
    this.grupo.socios.push(socio);
    return this;
  }

  build(): Partial<GrupoFamiliar> {
    return { ...this.grupo } as GrupoFamiliar;
  }
}
