import { Socio } from '../../../src/socios/entities/socio.entity';
import { GrupoFamiliar } from '../../../src/grupos-familiares/entities/grupo-familiar.entity';

export const socioFixture: Socio = {
  id: 1,
  nombre: 'Juan',
  apellido: 'Perez',
  dni: '12345678',
  telefono: '1234567890',
  email: 'juan.perez@test.com',
  fechaAlta: '2024-01-15',
  fechaNacimiento: '1990-05-15',
  direccion: 'Calle Test 123',
  estado: 'ACTIVO',
  genero: 'MASCULINO',
  overrideManual: false,
  tarjetaCentro: false,
  temporadas: [],
  ingresos: [],
  cuotas: [],
};

export const grupoFamiliarFixture: GrupoFamiliar = {
  id: 1,
  nombre: 'Familia Garcia',
  descripcion: 'Grupo familiar de la familia Garcia',
  orden: 1,
  createdAt: new Date('2024-01-01T00:00:00Z'),
  updatedAt: new Date('2024-01-01T00:00:00Z'),
  socios: [],
};

export const socioWithGrupoFixture: Socio = {
  ...socioFixture,
  grupoFamiliar: grupoFamiliarFixture,
};

export const socioWithoutGrupoFixture: Socio = {
  ...socioFixture,
  grupoFamiliar: undefined,
};
