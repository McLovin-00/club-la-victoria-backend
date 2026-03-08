import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { Cobrador } from './cobrador.entity';
import { CobroOperacion } from '../../cobros/entities/cobro-operacion.entity';

export enum TipoMovimientoCobrador {
  COMISION_GENERADA = 'COMISION_GENERADA',
  PAGO_A_COBRADOR = 'PAGO_A_COBRADOR',
  AJUSTE = 'AJUSTE',
}

@Entity('cobrador_cuenta_corriente_movimiento')
@Index('idx_cobrador_mov_fecha', ['cobradorId', 'createdAt'])
export class CobradorCuentaCorrienteMovimiento {
  @PrimaryGeneratedColumn({ name: 'id_cobrador_movimiento' })
  id!: number;

  @Column({ name: 'id_cobrador' })
  cobradorId!: number;

  @ManyToOne(() => Cobrador, (cobrador) => cobrador.movimientos)
  @JoinColumn({ name: 'id_cobrador' })
  cobrador!: Cobrador;

  @Column({
    type: 'enum',
    enum: TipoMovimientoCobrador,
    name: 'tipo_movimiento',
  })
  tipoMovimiento!: TipoMovimientoCobrador;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  monto!: number;

  @Column({ name: 'id_cobro_operacion', nullable: true })
  cobroOperacionId?: number;

  @ManyToOne(() => CobroOperacion, { nullable: true })
  @JoinColumn({ name: 'id_cobro_operacion' })
  cobroOperacion?: CobroOperacion;

  @Column({ name: 'usuario_registra', length: 120, nullable: true })
  usuarioRegistra?: string;

  @Column({ length: 255, nullable: true })
  observacion?: string;

  @Column({ length: 120, nullable: true })
  referencia?: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
