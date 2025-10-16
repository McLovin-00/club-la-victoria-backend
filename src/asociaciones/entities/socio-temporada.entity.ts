import { Socio } from 'src/socios/entities/socio.entity';
import { TemporadaPileta } from 'src/temporadas/entities/temporada.entity';
import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('socio_temporada')
export class SocioTemporada {
  @PrimaryGeneratedColumn({ name: 'id_socio_temporada' })
  id!: number;

  @Column({
    type: 'timestamp',
    default: () => 'now()',
    name: 'fecha_hora_inscripcion',
  })
  fechaHoraInscripcion!: string;

  @ManyToOne(() => Socio, (socio) => socio.temporadas, {
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  })
  @JoinColumn({ name: 'id_socio' })
  socio!: Socio;

  @ManyToOne(() => TemporadaPileta, (temp) => temp.socios, {
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  })
  @JoinColumn({ name: 'id_temporada' })
  temporada!: TemporadaPileta;
}
