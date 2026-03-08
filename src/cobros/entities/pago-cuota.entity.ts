import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { Cuota } from './cuota.entity';
import { MetodoPago } from '../../metodos-pago/entities/metodo-pago.entity';
import { CobroOperacion } from './cobro-operacion.entity';
import { Cobrador } from '../../cobradores/entities/cobrador.entity';

@Entity('pago_cuota')
export class PagoCuota {
  @PrimaryGeneratedColumn({ name: 'id_pago' })
  id!: number;

  @Column({ name: 'id_cuota' })
  @Index()
  cuotaId!: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, name: 'monto_pagado' })
  montoPagado!: number;

  @Column({ name: 'id_metodo_pago', nullable: true })
  metodoPagoId?: number;

  @Column({ name: 'id_cobro_operacion', nullable: true })
  operacionCobroId?: number;

  @ManyToOne(() => CobroOperacion, (operacion) => operacion.pagos, {
    nullable: true,
  })
  @JoinColumn({ name: 'id_cobro_operacion' })
  operacionCobro?: CobroOperacion;

  @Column({ name: 'id_cobrador', nullable: true })
  cobradorId?: number;

  @ManyToOne(() => Cobrador, { nullable: true })
  @JoinColumn({ name: 'id_cobrador' })
  cobrador?: Cobrador;

  @ManyToOne(() => MetodoPago, (metodo) => metodo.pagos, { nullable: true })
  @JoinColumn({ name: 'id_metodo_pago' })
  metodoPago?: MetodoPago;

  @Column({
    type: 'timestamp',
    name: 'fecha_pago',
    default: () => 'now()',
  })
  fechaPago!: Date;

  @Column({
    type: 'timestamp',
    name: 'fecha_emision_cuota',
    nullable: true,
  })
  fechaEmisionCuota?: Date;

  @CreateDateColumn({
    type: 'timestamp',
    name: 'created_at',
    default: () => 'now()',
  })
  createdAt!: Date;

  @Column({ length: 255, nullable: true })
  observaciones?: string;

  @ManyToOne(() => Cuota, (cuota) => cuota.pagos)
  @JoinColumn({ name: 'id_cuota' })
  cuota!: Cuota;
}
