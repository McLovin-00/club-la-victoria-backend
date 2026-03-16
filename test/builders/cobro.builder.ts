import { CobroOperacionLinea } from '../../src/cobros/entities/cobro-operacion-linea.entity';

type CobroBuilderOptions = Partial<CobroOperacionLinea>;

/**
 * Builder para crear instancias de CobroOperacionLinea para tests
 */
export class CobroBuilder {
  private cobro: Partial<CobroOperacionLinea>;

  constructor(options: CobroBuilderOptions = {}) {
    this.cobro = {
    id: 1,
    fecha: new Date('2024-01-15'),
    monto: 1000 as number,
    concepto: 'Efectivo',
    descripcion: 'Cobro de test',
    nroCuota: 3,
    createdAt: new Date('2024-01-15'),
    updatedAt: new Date('2024-01-15'),
    ...options,
  };
  }

  withId(id: number): this {
    this.cobro.id = id;
    return this;
  }

  withFecha(fecha: Date): this {
    this.cobro.fecha = fecha;
    return this;
  }

  withMonto(monto: number): this {
    this.cobro.monto = monto;
    return this;
  }

  withConcepto(concepto: string): this {
    this.cobro.concepto = concepto;
    return this;
  }

  withDescripcion(descripcion: string | undefined): this {
    this.cobro.descripcion = descripcion;
    return this;
  }

  withNroCuota(nroCuota: number): this {
    this.cobro.nroCuota = nroCuota;
    return this;
  }

  build(): Partial<CobroOperacionLinea> {
    return { ...this.cobro } as CobroOperacionLinea;
  }
}
