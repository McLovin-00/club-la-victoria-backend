import { DataSource } from 'typeorm';

import { Estado, Genero } from '../dto/create-socio.dto';
import { SocioRepository } from './socio.repository';

describe('SocioRepository', () => {
  let repository: SocioRepository;

  beforeEach(() => {
    const mockDataSource = {
      createEntityManager: jest.fn(),
    } as unknown as DataSource;

    repository = new SocioRepository(mockDataSource);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('persiste tarjetaCentro y numeroTarjetaCentro al crear un socio', async () => {
    const saveSpy = jest.spyOn(repository, 'save').mockImplementation(async (socio) => socio as any);

    await repository.createSocio({
      nombre: 'Juan',
      apellido: 'Perez',
      dni: '12345678',
      telefono: '1122334455',
      email: 'juan@test.local',
      fechaNacimiento: '1990-01-01',
      fechaAlta: '2026-03-16',
      genero: Genero.MASCULINO,
      estado: Estado.ACTIVO,
      tarjetaCentro: true,
      numeroTarjetaCentro: '5400000012345678',
    });

    expect(saveSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        tarjetaCentro: true,
        numeroTarjetaCentro: '5400000012345678',
      }),
    );
  });

  it('no persiste numeroTarjetaCentro cuando tarjetaCentro es false', async () => {
    const saveSpy = jest.spyOn(repository, 'save').mockImplementation(async (socio) => socio as any);

    await repository.createSocio({
      nombre: 'Ana',
      apellido: 'Lopez',
      dni: '87654321',
      fechaNacimiento: '1992-05-10',
      fechaAlta: '2026-03-16',
      genero: Genero.FEMENINO,
      estado: Estado.ACTIVO,
      tarjetaCentro: false,
      numeroTarjetaCentro: '5400000099999999',
    });

    expect(saveSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        tarjetaCentro: false,
        numeroTarjetaCentro: undefined,
      }),
    );
  });
});
