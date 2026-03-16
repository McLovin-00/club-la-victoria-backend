import { TemporadaPileta } from '../../../src/temporadas/entities/temporada.entity';

export const temporadaFixture: TemporadaPileta = {
  id: 1,
  nombre: 'Temporada 2024',
  fechaInicio: '2024-01-01',
  fechaFin: '2024-12-31',
  descripcion: 'Temporada de prueba',
  createdAt: new Date('2024-01-01T00:00:00Z'),
  socios: [],
};
