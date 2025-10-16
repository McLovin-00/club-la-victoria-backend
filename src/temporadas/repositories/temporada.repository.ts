import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { TemporadaPileta } from '../entities/temporada.entity';
import { Repository } from 'typeorm';

@Injectable()
export class TemporadaPiletaRepository extends Repository<TemporadaPileta> {
  constructor(private dataSource: DataSource) {
    super(TemporadaPileta, dataSource.createEntityManager());
  }
}
