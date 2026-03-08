import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Cobrador } from './cobrador.entity';

@Entity('cobrador_comision_config')
@Index('idx_cobrador_comision_vigencia', ['cobradorId', 'vigenteDesde'])
export class CobradorComisionConfig {
  @PrimaryGeneratedColumn({ name: 'id_cobrador_comision_config' })
  id!: number;

  @Column({ name: 'id_cobrador' })
  cobradorId!: number;

  @ManyToOne(() => Cobrador, (cobrador) => cobrador.comisiones)
  @JoinColumn({ name: 'id_cobrador' })
  cobrador!: Cobrador;

  @Column({ type: 'decimal', precision: 7, scale: 4, name: 'porcentaje' })
  porcentaje!: number;

  @Column({ type: 'timestamp', name: 'vigente_desde' })
  vigenteDesde!: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
