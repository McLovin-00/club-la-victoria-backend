import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  OneToMany,
} from 'typeorm';
import { SocioTemporada } from 'src/asociaciones/entities/socio-temporada.entity';
import { RegistroIngreso } from 'src/registro-ingreso/entities/registro-ingreso.entity';

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

  @Column({ length: 500, nullable: true, name: 'foto_url' })
  fotoUrl?: string;

  @OneToMany(() => SocioTemporada, (st) => st.socio)
  temporadas!: SocioTemporada[];

  @OneToMany(() => RegistroIngreso, (ingreso) => ingreso.socio)
  ingresos!: RegistroIngreso[];
}
