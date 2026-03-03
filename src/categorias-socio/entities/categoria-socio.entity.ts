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

@Entity('categoria_socio')
export class CategoriaSocio {
  @PrimaryGeneratedColumn({ name: 'id_categoria' })
  id!: number;

  @Column({ length: 100, unique: true })
  @Index()
  nombre!: string;

  @Column({ type: 'int', name: 'monto_mensual' })
  montoMensual!: number;

  @Column({ type: 'boolean', default: false })
  exento!: boolean;

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

  @OneToMany(() => Socio, (socio) => socio.categoria)
  socios!: Socio[];
}
