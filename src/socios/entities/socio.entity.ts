import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  OneToMany,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { SocioTemporada } from '../../asociaciones/entities/socio-temporada.entity';
import { RegistroIngreso } from '../../registro-ingreso/entities/registro-ingreso.entity';
import { CategoriaSocio } from '../../categorias-socio/entities/categoria-socio.entity';
import { Cuota } from '../../cobros/entities/cuota.entity';

@Entity('socio')
export class Socio {
  @PrimaryGeneratedColumn({ name: 'id_socio' })
  id!: number;

  @Column({ length: 100 })
  nombre!: string;

  @Column({ length: 100 })
  @Index()
  apellido!: string;

  @Column({ length: 20, unique: true, nullable: true })
  @Index()
  dni?: string;

  @Column({ length: 20, nullable: true })
  telefono?: string;

  @Column({ length: 150, nullable: true })
  email?: string;

  @Column({ type: 'date', default: () => 'CURRENT_DATE', name: 'fecha_alta' })
  fechaAlta!: string;

  @Column({ type: 'date', name: 'fecha_nacimiento' })
  fechaNacimiento!: string;

  @Column({ length: 255, nullable: true })
  direccion?: string;

  @Column({ type: 'enum', enum: ['ACTIVO', 'INACTIVO'], default: 'ACTIVO' })
  @Index()
  estado!: string;

@Column({ type: 'enum', enum: ['MASCULINO', 'FEMENINO'] })
  genero!: string;

  @Column({ type: 'boolean', default: false, name: 'override_manual' })
  overrideManual!: boolean;

  @Column({ length: 500, nullable: true, name: 'foto_url' })
  fotoUrl?: string;

  @ManyToOne(() => CategoriaSocio, { nullable: true })
  @JoinColumn({ name: 'id_categoria' })
  categoria?: CategoriaSocio;

  @OneToMany(() => SocioTemporada, (st) => st.socio)
  temporadas!: SocioTemporada[];

  @OneToMany(() => RegistroIngreso, (ingreso) => ingreso.socio)
  ingresos!: RegistroIngreso[];

  @OneToMany(() => Cuota, (cuota) => cuota.socio)
  cuotas!: Cuota[];
}
