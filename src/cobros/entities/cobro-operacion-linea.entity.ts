import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { CobroOperacion } from './cobro-operacion.entity';
import { Cuota } from './cuota.entity';

export enum TipoLineaCobro {
  CUOTA = 'CUOTA',
  CONCEPTO = 'CONCEPTO',
}

@Entity('cobro_operacion_linea')
export class CobroOperacionLinea {
  @PrimaryGeneratedColumn({ name: 'id_cobro_operacion_linea' })
  id!: number;

  @Column({ name: 'id_cobro_operacion' })
  @Index()
  operacionId!: number;

  @ManyToOne(() => CobroOperacion, (operacion) => operacion.lineas, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'id_cobro_operacion' })
  operacion!: CobroOperacion;

  @Column({
    type: 'enum',
    enum: TipoLineaCobro,
    name: 'tipo_linea',
  })
  tipoLinea!: TipoLineaCobro;

  @Column({ name: 'id_cuota', nullable: true })
  cuotaId?: number;

  @ManyToOne(() => Cuota, { nullable: true })
  @JoinColumn({ name: 'id_cuota' })
  cuota?: Cuota;

  @Column({ length: 80, nullable: true })
  concepto?: string;

  @Column({ length: 255, nullable: true })
  descripcion?: string;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  monto!: number;
}
