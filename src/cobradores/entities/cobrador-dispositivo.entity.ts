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

@Entity('cobrador_dispositivo')
@Index('uq_cobrador_dispositivo_installation', ['installationId'], {
  unique: true,
})
export class CobradorDispositivo {
  @PrimaryGeneratedColumn({ name: 'id_cobrador_dispositivo' })
  id!: number;

  @Column({ name: 'id_cobrador' })
  cobradorId!: number;

  @ManyToOne(() => Cobrador, (cobrador) => cobrador.dispositivos)
  @JoinColumn({ name: 'id_cobrador' })
  cobrador!: Cobrador;

  @Column({ name: 'installation_id', length: 128 })
  installationId!: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
