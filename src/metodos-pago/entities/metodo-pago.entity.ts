import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { PagoCuota } from '../../cobros/entities/pago-cuota.entity';

@Entity('metodos_pago')
export class MetodoPago {
  @PrimaryGeneratedColumn({ name: 'id_metodo_pago' })
  id!: number;

  @Column({ length: 50, unique: true })
  nombre!: string;

  @Column({ length: 255, nullable: true })
  descripcion?: string;

  @Column({ default: true })
  activo!: boolean;

  @Column({ default: 0 })
  orden!: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  @OneToMany(() => PagoCuota, (pago) => pago.metodoPago)
  pagos!: PagoCuota[];
}
