import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Socio } from '../../socios/entities/socio.entity';

@Entity('grupo_familiar')
export class GrupoFamiliar {
  @PrimaryGeneratedColumn({ name: 'id_grupo_familiar' })
  id!: number;

  @Column({ length: 100, unique: true })
  @Index()
  nombre!: string;

  @Column({ length: 255, nullable: true })
  descripcion?: string;

  @Column({ type: 'int', default: 0 })
  orden!: number;

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

  @OneToMany(() => Socio, (socio) => socio.grupoFamiliar)
  socios!: Socio[];
}
