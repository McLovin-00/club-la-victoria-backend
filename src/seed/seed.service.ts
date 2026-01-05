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

// Datos realistas para Argentina
const NOMBRES_MASCULINOS = [
  'Juan', 'Carlos', 'Miguel', 'José', 'Luis', 'Pedro', 'Ricardo', 'Fernando',
  'Diego', 'Martín', 'Pablo', 'Alejandro', 'Sebastián', 'Nicolás', 'Gonzalo',
  'Matías', 'Lucas', 'Tomás', 'Santiago', 'Agustín', 'Facundo', 'Ezequiel',
];

const NOMBRES_FEMENINOS = [
  'María', 'Ana', 'Laura', 'Florencia', 'Camila', 'Lucía', 'Sofía', 'Valentina',
  'Carolina', 'Julieta', 'Martina', 'Victoria', 'Romina', 'Paula', 'Daniela',
  'Gabriela', 'Andrea', 'Cecilia', 'Eugenia', 'Milagros', 'Agustina', 'Rocío',
];

const APELLIDOS = [
  'González', 'Rodríguez', 'García', 'Fernández', 'López', 'Martínez', 'Pérez',
  'Sánchez', 'Romero', 'Díaz', 'Torres', 'Ruiz', 'Álvarez', 'Acosta', 'Castro',
  'Moreno', 'Gómez', 'Flores', 'Benítez', 'Medina', 'Herrera', 'Núñez',
  'Cabrera', 'Molina', 'Silva', 'Ortiz', 'Aguirre', 'Suárez', 'Ríos', 'Vera',
];

const CALLES = [
  'San Martín', 'Belgrano', 'Rivadavia', 'Sarmiento', 'Mitre', 'Moreno',
  'Colón', '25 de Mayo', '9 de Julio', 'España', 'Italia', 'Francia',
  'Urquiza', 'Roca', 'Alem', 'Las Heras', 'Córdoba', 'Santa Fe', 'Mendoza',
];

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
  ) { }

  async run() {
    this.logger.log('🚀 Iniciando seed completo...');
    await this.createAdminUser();
    await this.createTemporadas();
    await this.createSocios();
    await this.asociarSociosATemporadas();
    await this.createRegistrosIngreso();
    this.logger.log('✅ Seed completo finalizado exitosamente.');
  }

  private getRandom<T>(arr: T[]): T {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  private getRandomInt(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  private generateDNI(): string {
    return this.getRandomInt(20000000, 45000000).toString();
  }

  private generatePhone(): string {
    const prefixes = ['11', '221', '351', '341', '261'];
    return this.getRandom(prefixes) + this.getRandomInt(1000000, 9999999).toString();
  }

  private generateBirthDate(): string {
    const year = this.getRandomInt(1960, 2010);
    const month = this.getRandomInt(1, 12).toString().padStart(2, '0');
    const day = this.getRandomInt(1, 28).toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private async createAdminUser() {
    const adminUser = 'admin';
    const adminPass = 'admin';

    const exists = await this.usuarioRepository.findOne({
      where: { usuario: adminUser },
    });

    if (exists) {
      this.logger.log('👤 El usuario admin ya existe. Omitiendo creación.');
      return;
    }

    const hashedPassword = await bcrypt.hash(adminPass, AUTH.BCRYPT_SALT_ROUNDS);

    const newUser = this.usuarioRepository.create({
      usuario: adminUser,
      password: hashedPassword,
    });

    await this.usuarioRepository.save(newUser);
    this.logger.log('👤 Usuario admin creado (usuario: admin, contraseña: admin)');
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
        descripcion: 'Temporada de verano anterior',
      },
      {
        nombre: 'Temporada 2025-2026',
        fechaInicio: '2025-12-01',
        fechaFin: '2026-03-31',
        descripcion: 'Temporada de verano actual',
      },
    ];

    for (const temp of temporadasData) {
      const exists = await this.temporadaRepository.findOne({
        where: { nombre: temp.nombre },
      });
      if (!exists) {
        await this.temporadaRepository.save(this.temporadaRepository.create(temp));
        this.logger.log(`📅 Temporada "${temp.nombre}" creada.`);
      }
    }
  }

  private async createSocios() {
    const sociosCount = await this.socioRepository.count();
    if (sociosCount > 0) {
      this.logger.log('👥 Ya existen socios. Omitiendo creación masiva.');
      return;
    }

    const socios = [];
    const dniUsados = new Set<string>();

    // Crear 50 socios con datos realistas
    for (let i = 0; i < 50; i++) {
      const esMasculino = i % 2 === 0;
      const nombre = esMasculino
        ? this.getRandom(NOMBRES_MASCULINOS)
        : this.getRandom(NOMBRES_FEMENINOS);
      const apellido = this.getRandom(APELLIDOS);

      // Generar DNI único
      let dni: string;
      do {
        dni = this.generateDNI();
      } while (dniUsados.has(dni));
      dniUsados.add(dni);

      socios.push({
        nombre,
        apellido,
        dni,
        telefono: this.generatePhone(),
        email: `${nombre.toLowerCase()}.${apellido.toLowerCase()}${i}@email.com`.normalize('NFD').replace(/[\u0300-\u036f]/g, ''),
        fechaNacimiento: this.generateBirthDate(),
        direccion: `${this.getRandom(CALLES)} ${this.getRandomInt(100, 3000)}`,
        estado: i < 45 ? 'ACTIVO' : 'INACTIVO', // 90% activos
        genero: esMasculino ? 'MASCULINO' : 'FEMENINO',
        fechaAlta: new Date().toISOString().split('T')[0],
      });
    }

    await this.socioRepository.save(this.socioRepository.create(socios));
    this.logger.log(`👥 ${socios.length} socios creados con datos realistas.`);
  }

  private async asociarSociosATemporadas() {
    const temporadaActual = await this.temporadaRepository.findOne({
      where: { nombre: 'Temporada 2025-2026' },
    });

    if (!temporadaActual) {
      this.logger.warn('⚠️ No se encontró la temporada actual para asociar socios.');
      return;
    }

    // Asociar los primeros 30 socios activos a la temporada actual (socios pileta)
    const socios = await this.socioRepository.find({
      where: { estado: 'ACTIVO' },
      take: 30,
    });

    let asociados = 0;
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
        asociados++;
      }
    }

    if (asociados > 0) {
      this.logger.log(`🏊 ${asociados} socios asociados a "${temporadaActual.nombre}" (Socios Pileta).`);
    }
  }

  private async createRegistrosIngreso() {
    const ingresosCount = await this.registroIngresoRepository.count();
    if (ingresosCount > 0) {
      this.logger.log('📋 Ya existen registros de ingreso. Omitiendo.');
      return;
    }

    const sociosClub = await this.socioRepository.find({
      where: { estado: 'ACTIVO' },
      take: 20,
    });

    const sociosPileta = await this.socioRepository
      .createQueryBuilder('socio')
      .innerJoin('socio.temporadas', 'st')
      .where('socio.estado = :estado', { estado: 'ACTIVO' })
      .take(15)
      .getMany();

    const ingresos = [];
    const hoy = new Date();

    // Función para generar fecha/hora del día de hoy
    const generarHoraHoy = () => {
      const hora = new Date(hoy);
      hora.setHours(this.getRandomInt(8, 20), this.getRandomInt(0, 59), 0, 0);
      return hora;
    };

    // Ingresos de socios club (solo acceso al club)
    for (const socio of sociosClub.slice(0, 10)) {
      ingresos.push({
        socio,
        tipoIngreso: TipoIngreso.SOCIO_CLUB,
        habilitaPileta: false,
        importe: 0,
        fechaHoraIngreso: generarHoraHoy(),
      });
    }

    // Ingresos de socios pileta (con acceso a pileta)
    for (const socio of sociosPileta.slice(0, 10)) {
      ingresos.push({
        socio,
        tipoIngreso: TipoIngreso.SOCIO_PILETA,
        habilitaPileta: true,
        importe: 0,
        fechaHoraIngreso: generarHoraHoy(),
      });
    }

    // Ingresos de no socios (con los nuevos campos de nombre y apellido)
    const noSociosData = [
      { nombre: 'Roberto', apellido: 'Méndez' },
      { nombre: 'Carla', apellido: 'Vega' },
      { nombre: 'Esteban', apellido: 'Quiroga' },
      { nombre: 'Luciana', apellido: 'Pereyra' },
      { nombre: 'Marcos', apellido: 'Ibáñez' },
      { nombre: 'Valeria', apellido: 'Ferreyra' },
      { nombre: 'Ramiro', apellido: 'Bustos' },
      { nombre: 'Natalia', apellido: 'Ledesma' },
    ];

    for (let i = 0; i < noSociosData.length; i++) {
      const noSocio = noSociosData[i];
      ingresos.push({
        dniNoSocio: this.generateDNI(),
        nombreNoSocio: noSocio.nombre,
        apellidoNoSocio: noSocio.apellido,
        tipoIngreso: TipoIngreso.NO_SOCIO,
        habilitaPileta: true,
        metodoPago: i % 2 === 0 ? MetodoPago.EFECTIVO : MetodoPago.TRANSFERENCIA,
        importe: this.getRandomInt(3, 8) * 1000, // Entre $3000 y $8000
        fechaHoraIngreso: generarHoraHoy(),
      });
    }

    await this.registroIngresoRepository.save(
      this.registroIngresoRepository.create(ingresos),
    );
    this.logger.log(`📋 ${ingresos.length} registros de ingreso creados para hoy.`);
  }
}
