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

export enum MetodoPago {
  EFECTIVO = 'EFECTIVO',
  TRANSFERENCIA = 'TRANSFERENCIA',
  TARJETA_DEBITO = 'TARJETA_DEBITO',
  TARJETA_CREDITO = 'TARJETA_CREDITO',
  OTRO = 'OTRO',
}

@Entity('pago_cuota')
export class PagoCuota {
  @PrimaryGeneratedColumn({ name: 'id_pago' })
  id!: number;

  @Column({ name: 'id_cuota' })
  @Index()
  cuotaId!: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, name: 'monto_pagado' })
  montoPagado!: number;

  @Column({
    type: 'enum',
    enum: MetodoPago,
    name: 'metodo_pago',
  })
  metodoPago!: MetodoPago;

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
