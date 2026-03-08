import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { CobradorDispositivo } from './cobrador-dispositivo.entity';
import { CobradorComisionConfig } from './cobrador-comision-config.entity';
import { CobradorCuentaCorrienteMovimiento } from './cobrador-cuenta-corriente-movimiento.entity';
import { CobroOperacion } from '../../cobros/entities/cobro-operacion.entity';

@Entity('cobrador')
export class Cobrador {
  @PrimaryGeneratedColumn({ name: 'id_cobrador' })
  id!: number;

  @Column({ length: 120 })
  nombre!: string;

  @Column({ default: true })
  activo!: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  @OneToMany(() => CobradorDispositivo, (binding) => binding.cobrador)
  dispositivos!: CobradorDispositivo[];

  @OneToMany(() => CobradorComisionConfig, (config) => config.cobrador)
  comisiones!: CobradorComisionConfig[];

  @OneToMany(() => CobradorCuentaCorrienteMovimiento, (mov) => mov.cobrador)
  movimientos!: CobradorCuentaCorrienteMovimiento[];

  @OneToMany(() => CobroOperacion, (operacion) => operacion.cobrador)
  operaciones!: CobroOperacion[];
}
