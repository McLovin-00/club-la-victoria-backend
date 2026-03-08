import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  ManyToOne,
  OneToMany,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { Socio } from '../../socios/entities/socio.entity';
import { PagoCuota } from './pago-cuota.entity';

export enum EstadoCuota {
  PENDIENTE = 'PENDIENTE',
  PAGADA = 'PAGADA',
}

@Entity('cuota')
export class Cuota {
  @PrimaryGeneratedColumn({ name: 'id_cuota' })
  id!: number;

  @Column({ name: 'id_socio' })
  @Index()
  socioId!: number;

  @Column({ length: 7 })
  @Index()
  periodo!: string; // Formato YYYY-MM

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  monto!: number;

  @Column({
    type: 'enum',
    enum: EstadoCuota,
    default: EstadoCuota.PENDIENTE,
  })
  @Index()
  estado!: EstadoCuota;

  @Column({
    type: 'boolean',
    name: 'rechazada_tarjeta_centro',
    default: false,
  })
  rechazadaTarjetaCentro!: boolean;

  @CreateDateColumn({
    type: 'timestamp',
    name: 'created_at',
    default: () => 'now()',
  })
  createdAt!: Date;

  @Column({
    type: 'timestamp',
    name: 'fecha_pago',
    nullable: true,
  })
  fechaPago?: Date;

  @ManyToOne(() => Socio, (socio) => socio.cuotas)
  @JoinColumn({ name: 'id_socio' })
  socio!: Socio;

  @OneToMany(() => PagoCuota, (pago) => pago.cuota)
  pagos!: PagoCuota[];
}
