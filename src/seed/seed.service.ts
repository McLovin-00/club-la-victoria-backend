import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Usuario } from '../auth/entities/usuario.entity';
import { Socio } from '../socios/entities/socio.entity';
import { TemporadaPileta } from '../temporadas/entities/temporada.entity';
import { SocioTemporada } from '../asociaciones/entities/socio-temporada.entity';
import {
  RegistroIngreso,
  TipoIngreso,
  MetodoPago,
} from '../registro-ingreso/entities/registro-ingreso.entity';
import * as bcrypt from 'bcrypt';
import { AUTH } from '../constants/auth.constants';

@Injectable()
export class SeedService {
  private readonly logger = new Logger(SeedService.name);

  constructor(
    @InjectRepository(Usuario)
    private readonly usuarioRepository: Repository<Usuario>,
    @InjectRepository(Socio)
    private readonly socioRepository: Repository<Socio>,
    @InjectRepository(TemporadaPileta)
    private readonly temporadaRepository: Repository<TemporadaPileta>,
    @InjectRepository(SocioTemporada)
    private readonly socioTemporadaRepository: Repository<SocioTemporada>,
    @InjectRepository(RegistroIngreso)
    private readonly registroIngresoRepository: Repository<RegistroIngreso>,
  ) {}

  async run() {
    this.logger.log('Iniciando seed completo...');
    await this.createAdminUser();
    await this.createTemporadas();
    await this.createSocios();
    await this.asociarSociosATemporadas();
    await this.createRegistrosIngreso();
    this.logger.log('Seed completo finalizado exitosamente.');
  }

  private async createAdminUser() {
    const adminUser = 'admin';
    const adminPass = 'admin';

    const exists = await this.usuarioRepository.findOne({
      where: { usuario: adminUser },
    });

    if (exists) {
      this.logger.log('El usuario admin ya existe. Omitiendo creación.');
      return;
    }

    const hashedPassword = await bcrypt.hash(
      adminPass,
      AUTH.BCRYPT_SALT_ROUNDS,
    );

    const newUser = this.usuarioRepository.create({
      usuario: adminUser,
      password: hashedPassword,
    });

    await this.usuarioRepository.save(newUser);
    this.logger.log('Usuario admin creado exitosamente.');
  }

  private async createTemporadas() {
    const temporadasData = [
      {
        nombre: 'Temporada 2023-2024',
        fechaInicio: '2023-12-01',
        fechaFin: '2024-03-31',
        descripcion: 'Temporada de verano pasada',
      },
      {
        nombre: 'Temporada 2024-2025',
        fechaInicio: '2024-12-01',
        fechaFin: '2025-03-31',
        descripcion: 'Temporada de verano actual',
      },
    ];

    for (const temp of temporadasData) {
      const exists = await this.temporadaRepository.findOne({
        where: { nombre: temp.nombre },
      });
      if (!exists) {
        await this.temporadaRepository.save(
          this.temporadaRepository.create(temp),
        );
        this.logger.log(`Temporada ${temp.nombre} creada.`);
      }
    }
  }

  private async createSocios() {
    const sociosCount = await this.socioRepository.count();
    if (sociosCount > 0) {
      this.logger.log('Ya existen socios. Omitiendo creación masiva.');
      return;
    }

    const socios = [];
    for (let i = 1; i <= 20; i++) {
      socios.push({
        nombre: `Socio${i}`,
        apellido: `Apellido${i}`,
        dni: `100000${i}`,
        telefono: `11111111${i}`,
        email: `socio${i}@example.com`,
        fechaNacimiento: '1990-01-01',
        direccion: `Calle Falsa ${i}`,
        estado: 'ACTIVO',
        genero: i % 2 === 0 ? 'MASCULINO' : 'FEMENINO',
        fechaAlta: new Date().toISOString().split('T')[0],
      });
    }

    await this.socioRepository.save(this.socioRepository.create(socios));
    this.logger.log(`${socios.length} socios creados.`);
  }

  private async asociarSociosATemporadas() {
    const temporadaActual = await this.temporadaRepository.findOne({
      where: { nombre: 'Temporada 2024-2025' },
    });

    if (!temporadaActual) {
      this.logger.warn(
        'No se encontró la temporada actual para asociar socios.',
      );
      return;
    }

    const socios = await this.socioRepository.find({ take: 10 }); // Tomar los primeros 10

    for (const socio of socios) {
      const exists = await this.socioTemporadaRepository.findOne({
        where: {
          socio: { id: socio.id },
          temporada: { id: temporadaActual.id },
        },
        relations: ['socio', 'temporada'],
      });

      if (!exists) {
        await this.socioTemporadaRepository.save(
          this.socioTemporadaRepository.create({
            socio,
            temporada: temporadaActual,
            fechaHoraInscripcion: new Date().toISOString(),
          }),
        );
      }
    }
    this.logger.log(
      `Socios asociados a la temporada ${temporadaActual.nombre}.`,
    );
  }

  private async createRegistrosIngreso() {
    const ingresosCount = await this.registroIngresoRepository.count();
    if (ingresosCount > 0) {
      this.logger.log('Ya existen registros de ingreso. Omitiendo.');
      return;
    }

    const socios = await this.socioRepository.find({ take: 5 });
    const ingresos = [];

    // Ingresos de socios
    for (const socio of socios) {
      ingresos.push({
        socio,
        tipoIngreso: TipoIngreso.SOCIO_CLUB,
        habilitaPileta: true,
        importe: 0,
        fechaHoraIngreso: new Date(),
      });
    }

    // Ingresos de no socios
    for (let i = 0; i < 5; i++) {
      ingresos.push({
        dniNoSocio: `9000000${i}`,
        tipoIngreso: TipoIngreso.NO_SOCIO,
        habilitaPileta: true,
        metodoPago: MetodoPago.EFECTIVO,
        importe: 5000,
        fechaHoraIngreso: new Date(),
      });
    }

    await this.registroIngresoRepository.save(
      this.registroIngresoRepository.create(ingresos),
    );
    this.logger.log(`${ingresos.length} registros de ingreso creados.`);
  }
}
