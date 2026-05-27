import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToOne,
  JoinColumn,
  Index,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { GrupoFamiliar } from '../../grupos-familiares/entities/grupo-familiar.entity';

@Entity('credito_grupal')
@Index('uq_credito_grupal_grupo', ['grupoFamiliarId'], { unique: true })
export class CreditoGrupal {
  @PrimaryGeneratedColumn({ name: 'id_credito_grupal' })
  id!: number;

  @Column({ name: 'id_grupo_familiar', unique: true })
  @Index()
  grupoFamiliarId!: number;

  @OneToOne(() => GrupoFamiliar)
  @JoinColumn({ name: 'id_grupo_familiar' })
  grupoFamiliar!: GrupoFamiliar;

  @Column({
    type: 'decimal',
    precision: 12,
    scale: 2,
    default: 0,
  })
  saldo!: number;

  @CreateDateColumn({
    type: 'timestamp',
    name: 'created_at',
    default: () => 'now()',
  })
  createdAt!: Date;

  @UpdateDateColumn({
    type: 'timestamp',
    name: 'updated_at',
    default: () => 'now()',
  })
  updatedAt!: Date;
}