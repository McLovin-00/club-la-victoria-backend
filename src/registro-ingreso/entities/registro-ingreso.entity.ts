import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Socio } from '../../socios/entities/socio.entity';

export enum TipoIngreso {
  SOCIO_CLUB = 'SOCIO_CLUB',
  SOCIO_PILETA = 'SOCIO_PILETA',
  NO_SOCIO = 'NO_SOCIO',
}

export enum MetodoPago {
  EFECTIVO = 'EFECTIVO',
  TRANSFERENCIA = 'TRANSFERENCIA',
}

@Entity('registro_ingreso')
@Index(['fechaHoraIngreso'])
@Index(['dniNoSocio'])
@Index(['tipoIngreso'])
export class RegistroIngreso {
  @PrimaryGeneratedColumn({ name: 'id_ingreso' })
  idIngreso!: number;

  @Column({ type: 'int', nullable: true, name: 'id_socio' })
  idSocio?: number;

  @Column({ type: 'varchar', length: 20, nullable: true, name: 'dni_no_socio' })
  dniNoSocio?: string;

  @Column({
    type: 'enum',
    enum: TipoIngreso,
    nullable: false,
    name: 'tipo_ingreso',
  })
  tipoIngreso!: TipoIngreso;

  @Column({ type: 'tinyint', default: 0, name: 'habilita_pileta' })
  habilitaPileta!: boolean;

  @Column({
    type: 'enum',
    enum: MetodoPago,
    nullable: true,
    name: 'metodo_pago',
  })
  metodoPago!: MetodoPago;

  @Column({ type: 'int', nullable: false, name: 'importe' })
  importe!: number;

  @CreateDateColumn({
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP',
    name: 'fecha_hora_ingreso',
  })
  fechaHoraIngreso!: Date;

  // Relación opcional con Socio (solo si idSocio no es null)
  @ManyToOne(() => Socio, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'id_socio' })
  socio?: Socio;
}
