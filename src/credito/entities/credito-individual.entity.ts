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
import { Socio } from '../../socios/entities/socio.entity';

@Entity('credito_individual')
@Index('uq_credito_individual_socio', ['socioId'], { unique: true })
export class CreditoIndividual {
  @PrimaryGeneratedColumn({ name: 'id_credito_individual' })
  id!: number;

  @Column({ name: 'id_socio' })
  socioId!: number;

  @OneToOne(() => Socio)
  @JoinColumn({ name: 'id_socio' })
  socio!: Socio;

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
