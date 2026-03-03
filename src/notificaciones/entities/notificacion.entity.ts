import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { Socio } from '../../socios/entities/socio.entity';

export enum TipoNotificacion {
  MOROSIDAD_3_MESES = 'MOROSIDAD_3_MESES',
  INHABILITACION_AUTOMATICA = 'INHABILITACION_AUTOMATICA',
}

@Entity('notificacion')
export class Notificacion {
  @PrimaryGeneratedColumn({ name: 'id_notificacion' })
  id!: number;

  @Column({
    type: 'enum',
    enum: TipoNotificacion,
  })
  @Index()
  tipo!: TipoNotificacion;

  @Column({ name: 'socio_id' })
  @Index()
  socioId!: number;

  @Column({ length: 255 })
  mensaje!: string;

  @Column({ type: 'boolean', default: false })
  @Index()
  leida!: boolean;

  @CreateDateColumn({
    type: 'timestamp',
    name: 'created_at',
    default: () => 'now()',
  })
  createdAt!: Date;

  @ManyToOne(() => Socio)
  @JoinColumn({ name: 'socio_id' })
  socio!: Socio;
}
