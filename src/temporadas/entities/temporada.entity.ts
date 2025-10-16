import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
  Index,
} from 'typeorm';
import { SocioTemporada } from 'src/asociaciones/entities/socio-temporada.entity';

@Entity('temporada_pileta')
export class TemporadaPileta {
  @PrimaryGeneratedColumn({ name: 'id_temporada' })
  id!: number;

  @Column({ length: 100 })
  nombre!: string;

  @Column({ type: 'date', name: 'fecha_inicio' })
  @Index()
  fechaInicio!: string;

  @Column({ type: 'date', name: 'fecha_fin' })
  @Index()
  fechaFin!: string;

  @Column({ length: 100, nullable: true })
  descripcion!: string;

  @Column({
    type: 'timestamp',
    default: () => 'now()',
    name: 'created_at',
  })
  createdAt!: Date;

  @OneToMany(() => SocioTemporada, (st) => st.temporada)
  socios!: SocioTemporada[];
}
