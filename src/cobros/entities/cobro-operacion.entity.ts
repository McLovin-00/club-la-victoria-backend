import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
} from 'typeorm';
import { Socio } from '../../socios/entities/socio.entity';
import { MetodoPago } from '../../metodos-pago/entities/metodo-pago.entity';
import { PagoCuota } from './pago-cuota.entity';
import { CobroOperacionLinea } from './cobro-operacion-linea.entity';
import { Cobrador } from '../../cobradores/entities/cobrador.entity';

export enum ActorCobro {
  COBRADOR = 'COBRADOR',
  OPERADOR = 'OPERADOR',
}

export enum OrigenCobro {
  MOBILE = 'MOBILE',
  WEB = 'WEB',
}

@Entity('cobro_operacion')
@Index('uq_cobro_operacion_idempotency', ['idempotencyKey'], { unique: true })
export class CobroOperacion {
  @PrimaryGeneratedColumn({ name: 'id_cobro_operacion' })
  id!: number;

  @Column({ name: 'id_socio' })
  @Index()
  socioId!: number;

  @ManyToOne(() => Socio)
  @JoinColumn({ name: 'id_socio' })
  socio!: Socio;

  @Column({ name: 'id_metodo_pago' })
  metodoPagoId!: number;

  @ManyToOne(() => MetodoPago)
  @JoinColumn({ name: 'id_metodo_pago' })
  metodoPago!: MetodoPago;

  @Column({
    type: 'enum',
    enum: ActorCobro,
    name: 'actor_cobro',
  })
  actorCobro!: ActorCobro;

  @Column({
    type: 'enum',
    enum: OrigenCobro,
    name: 'origen_cobro',
  })
  origenCobro!: OrigenCobro;

  @Column({ name: 'id_cobrador', nullable: true })
  @Index()
  cobradorId?: number;

  @ManyToOne(() => Cobrador, { nullable: true })
  @JoinColumn({ name: 'id_cobrador' })
  cobrador?: Cobrador;

  @Column({
    type: 'varchar',
    length: 128,
    name: 'idempotency_key',
    nullable: true,
  })
  idempotencyKey?: string;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  total!: number;

  @Column({ length: 255, nullable: true })
  referencia?: string;

  @Column({ length: 255, nullable: true })
  observaciones?: string;

  @CreateDateColumn({ type: 'timestamp', name: 'fecha_hora_servidor' })
  fechaHoraServidor!: Date;

  @OneToMany(() => CobroOperacionLinea, (linea) => linea.operacion, {
    cascade: true,
  })
  lineas!: CobroOperacionLinea[];

  @OneToMany(() => PagoCuota, (pago) => pago.operacionCobro)
  pagos!: PagoCuota[];
}
