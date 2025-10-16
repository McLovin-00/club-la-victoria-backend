import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { SocioTemporada } from '../entities/socio-temporada.entity';

@Injectable()
export class AsociacionesRepository extends Repository<SocioTemporada> {
  constructor(private dataSource: DataSource) {
    super(SocioTemporada, dataSource.createEntityManager());
  }
}
