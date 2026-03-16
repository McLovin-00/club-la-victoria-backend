import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Like, Repository } from 'typeorm';
import { Usuario } from '../auth/entities/usuario.entity';
import { Socio } from '../socios/entities/socio.entity';
import { TemporadaPileta } from '../temporadas/entities/temporada.entity';
import { SocioTemporada } from '../asociaciones/entities/socio-temporada.entity';
import {
  RegistroIngreso,
  TipoIngreso,
  MetodoPago,
} from '../registro-ingreso/entities/registro-ingreso.entity';
import { MetodoPago as MetodoPagoEntity } from '../metodos-pago/entities/metodo-pago.entity';
import { CategoriaSocio } from '../categorias-socio/entities/categoria-socio.entity';
import { GrupoFamiliar } from '../grupos-familiares/entities/grupo-familiar.entity';
import { Cuota, EstadoCuota } from '../cobros/entities/cuota.entity';
import { PagoCuota } from '../cobros/entities/pago-cuota.entity';
import { Cobrador, CobradorComisionConfig } from '../cobradores/entities';
import * as bcrypt from 'bcrypt';
import { AUTH } from '../constants/auth.constants';

// Datos realistas para Argentina
const NOMBRES_MASCULINOS = [
  'Juan',
  'Carlos',
  'Miguel',
  'José',
  'Luis',
  'Pedro',
  'Ricardo',
  'Fernando',
  'Diego',
  'Martín',
  'Pablo',
  'Alejandro',
  'Sebastián',
  'Nicolás',
  'Gonzalo',
  'Matías',
  'Lucas',
  'Tomás',
  'Santiago',
  'Agustín',
  'Facundo',
  'Ezequiel',
];

const NOMBRES_FEMENINOS = [
  'María',
  'Ana',
  'Laura',
  'Florencia',
  'Camila',
  'Lucía',
  'Sofía',
  'Valentina',
  'Carolina',
  'Julieta',
  'Martina',
  'Victoria',
  'Romina',
  'Paula',
  'Daniela',
  'Gabriela',
  'Andrea',
  'Cecilia',
  'Eugenia',
  'Milagros',
  'Agustina',
  'Rocío',
];

const APELLIDOS = [
  'González',
  'Rodríguez',
  'García',
  'Fernández',
  'López',
  'Martínez',
  'Pérez',
  'Sánchez',
  'Romero',
  'Díaz',
  'Torres',
  'Ruiz',
  'Álvarez',
  'Acosta',
  'Castro',
  'Moreno',
  'Gómez',
  'Flores',
  'Benítez',
  'Medina',
  'Herrera',
  'Núñez',
  'Cabrera',
  'Molina',
  'Silva',
  'Ortiz',
  'Aguirre',
  'Suárez',
  'Ríos',
  'Vera',
];

const CALLES = [
  'San Martín',
  'Belgrano',
  'Rivadavia',
  'Sarmiento',
  'Mitre',
  'Moreno',
  'Colón',
  '25 de Mayo',
  '9 de Julio',
  'España',
  'Italia',
  'Francia',
  'Urquiza',
  'Roca',
  'Alem',
  'Las Heras',
  'Córdoba',
  'Santa Fe',
  'Mendoza',
];

// Estructura para definir una familia
interface EstructuraFamiliar {
  padre: { nombre: string; genero: 'MASCULINO' };
  madre: { nombre: string; genero: 'FEMENINO' };
  hijos: { nombre: string; genero: 'MASCULINO' | 'FEMENINO' }[];
}

// Familias predefinidas con estructuras realistas
const FAMILIAS_PREDEFINIDAS: EstructuraFamiliar[] = [
  {
    padre: { nombre: 'Roberto', genero: 'MASCULINO' },
    madre: { nombre: 'María', genero: 'FEMENINO' },
    hijos: [
      { nombre: 'Juan', genero: 'MASCULINO' },
      { nombre: 'Lucía', genero: 'FEMENINO' },
      { nombre: 'Pedro', genero: 'MASCULINO' },
    ],
  },
  {
    padre: { nombre: 'Carlos', genero: 'MASCULINO' },
    madre: { nombre: 'Ana', genero: 'FEMENINO' },
    hijos: [
      { nombre: 'Florencia', genero: 'FEMENINO' },
      { nombre: 'Diego', genero: 'MASCULINO' },
    ],
  },
  {
    padre: { nombre: 'Miguel', genero: 'MASCULINO' },
    madre: { nombre: 'Laura', genero: 'FEMENINO' },
    hijos: [
      { nombre: 'Camila', genero: 'FEMENINO' },
      { nombre: 'Santiago', genero: 'MASCULINO' },
      { nombre: 'Valentina', genero: 'FEMENINO' },
    ],
  },
  {
    padre: { nombre: 'José', genero: 'MASCULINO' },
    madre: { nombre: 'Cecilia', genero: 'FEMENINO' },
    hijos: [
      { nombre: 'Martín', genero: 'MASCULINO' },
      { nombre: 'Sofía', genero: 'FEMENINO' },
    ],
  },
  {
    padre: { nombre: 'Fernando', genero: 'MASCULINO' },
    madre: { nombre: 'Gabriela', genero: 'FEMENINO' },
    hijos: [
      { nombre: 'Nicolás', genero: 'MASCULINO' },
      { nombre: 'Agustina', genero: 'FEMENINO' },
      { nombre: 'Tomás', genero: 'MASCULINO' },
      { nombre: 'Martina', genero: 'FEMENINO' },
    ],
  },
  {
    padre: { nombre: 'Ricardo', genero: 'MASCULINO' },
    madre: { nombre: 'Andrea', genero: 'FEMENINO' },
    hijos: [{ nombre: 'Lucas', genero: 'MASCULINO' }],
  },
  {
    padre: { nombre: 'Luis', genero: 'MASCULINO' },
    madre: { nombre: 'Paula', genero: 'FEMENINO' },
    hijos: [
      { nombre: 'Gonzalo', genero: 'MASCULINO' },
      { nombre: 'Rocío', genero: 'FEMENINO' },
      { nombre: 'Ezequiel', genero: 'MASCULINO' },
    ],
  },
  {
    padre: { nombre: 'Pedro', genero: 'MASCULINO' },
    madre: { nombre: 'Romina', genero: 'FEMENINO' },
    hijos: [
      { nombre: 'Sebastián', genero: 'MASCULINO' },
      { nombre: 'Carolina', genero: 'FEMENINO' },
    ],
  },
  {
    padre: { nombre: 'Alejandro', genero: 'MASCULINO' },
    madre: { nombre: 'Daniela', genero: 'FEMENINO' },
    hijos: [
      { nombre: 'Facundo', genero: 'MASCULINO' },
      { nombre: 'Julieta', genero: 'FEMENINO' },
      { nombre: 'Agustín', genero: 'MASCULINO' },
    ],
  },
  {
    padre: { nombre: 'Pablo', genero: 'MASCULINO' },
    madre: { nombre: 'Eugenia', genero: 'FEMENINO' },
    hijos: [
      { nombre: 'Matías', genero: 'MASCULINO' },
      { nombre: 'Milagros', genero: 'FEMENINO' },
    ],
  },
];

const PERIODOS_2025 = Array.from(
  { length: 12 },
  (_, index) => `2025-${String(index + 1).padStart(2, '0')}`,
);

const NUMEROS_TARJETA_CENTRO_SEED = [
  '5047812020402030',
  '5047812020402030',
  '5047812020402030',
  '5047812020402030',
  '5047812020408037',
  '5047812020450021',
  '5047812020450021',
  '5047812020450021',
  '5047812020450021',
  '5047812020454122',
  '5047812020454122',
  '5047812020464121',
  '5047812020552123',
  '5047812020552123',
  '5047812020558021',
  '5047812020558021',
  '5047812020558021',
  '5047812020558021',
  '5047812020558021',
  '5047812020558021',
  '5047812020558021',
  '5047812020558021',
  '5047812020633030',
  '5047812020633030',
  '5047812020695021',
  '5047812020695021',
  '5047812020695021',
  '5047812020742021',
  '5047812020742021',
  '5047812020742021',
  '5047812020769024',
  '5047812020805026',
  '5047812020815030',
  '5047812020817021',
  '5047812020817021',
  '5047812020817021',
  '5047812020819027',
  '5047812020825024',
  '5047812020833028',
  '5047812020833028',
  '5047812021127024',
  '5047812021127024',
  '5047812021127024',
  '5047812021127024',
  '5047812021159027',
  '5047812021159027',
  '5047812021159027',
  '5047812021159027',
  '5047812021187036',
  '5047812021187036',
  '5047812021210028',
  '5047812021288024',
  '5047812021288024',
  '5047812021288024',
  '5047812021305125',
  '5047812021305125',
  '5047812021305125',
  '5047812021305125',
  '5047812021305125',
  '5047812021562022',
  '5047812021562022',
  '5047812021562022',
  '5047812021706025',
  '5047812022283115',
  '5047812022283115',
  '5047812022519013',
  '5047812022519013',
  '5047812022519013',
  '5047812022524013',
  '5047812022524013',
  '5047812023692017',
  '5047812023715016',
  '5047812023715016',
  '5047812023900014',
  '5047812023900022',
  '5047812023932116',
  '5047812023932116',
  '5047812023932116',
  '5047812023932116',
  '5047812023932116',
  '5047812023932116',
  '5047812023934112',
  '5047812024218010',
  '5047812024218010',
  '5047812024424022',
  '5047812024424022',
  '5047812024424022',
  '5047812024424022',
  '5047812024424022',
  '5047812024424022',
  '5047812024424022',
  '5047812024424022',
  '5047812025195019',
  '5047812025195019',
  '5047812025195019',
  '5047812026391112',
  '5047812026391112',
  '5047812026391112',
  '5047812026552010',
  '5047812026552010',
  '5047812026552010',
  '5047812026552010',
  '5047812026922106',
  '5047812026922106',
] as const;

type PerfilPagoSeed = 'AL_DIA' | 'DEUDA_PARCIAL' | 'MOROSO';

@Injectable()
export class SeedService {
  private readonly logger = new Logger(SeedService.name);
  private static readonly MAX_CUOTAS_IMPAGAS = 4;

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
    @InjectRepository(CategoriaSocio)
    private readonly categoriaSocioRepository: Repository<CategoriaSocio>,
    @InjectRepository(GrupoFamiliar)
    private readonly grupoFamiliarRepository: Repository<GrupoFamiliar>,
    @InjectRepository(Cuota)
    private readonly cuotaRepository: Repository<Cuota>,
    @InjectRepository(PagoCuota)
    private readonly pagoCuotaRepository: Repository<PagoCuota>,
    @InjectRepository(Cobrador)
    private readonly cobradorRepository: Repository<Cobrador>,
    @InjectRepository(CobradorComisionConfig)
    private readonly comisionConfigRepository: Repository<CobradorComisionConfig>,
    @InjectRepository(MetodoPagoEntity)
    private readonly metodoPagoRepository: Repository<MetodoPagoEntity>,
  ) {}

  /**
   * Ejecuta el seed de producción (solo categorías)
   * Este método SIEMPRE se ejecuta, incluso en producción
   */
  async run() {
    this.logger.log('🚀 Iniciando seed de producción...');
    await this.createCategoriasSocio();
    await this.createCobradoresBase();
    await this.createMetodosPago();
    this.logger.log('✅ Seed de producción finalizado.');
  }

  /**
   * Ejecuta el seed completo de desarrollo (usuarios, socios, etc.)
   * SOLO ejecutar en entornos de desarrollo/prueba
   */
  async runDevSeed() {
    this.logger.log('🚀 Iniciando seed de desarrollo...');
    await this.createCobradoresBase();
    await this.createMetodosPago();
    await this.createAdminUser();
    await this.createTemporadas();
    const seCrearonSocios = await this.createGruposFamiliares();

    if (!seCrearonSocios) {
      await this.createSociosNuevosConTarjetaCentro();
    }

    await this.asociarSociosATemporadas();
    await this.createCuotasSocios2025();
    await this.createRegistrosIngreso();
    this.logger.log('✅ Seed de desarrollo finalizado.');
  }

  /**
   * Ejecuta un seed reducido con los socios del seed de desarrollo
   * y solo la cobradora Ana Maria Rodriguez, sin cuotas generadas.
   */
  async runSeed2() {
    this.logger.log('🚀 Iniciando seed2...');
    await this.createCategoriasSocio();
    await this.createMetodosPago();
    await this.createAdminUser();
    await this.createCobradorAnaMariaRodriguez();
    await this.createGruposFamiliares();
    this.logger.log('✅ Seed2 finalizado.');
  }

  async runClearDatabase() {
    this.logger.warn('🧹 Iniciando vaciado de tablas de la base de datos...');
    await this.clearDatabaseData();
    this.logger.warn('🧹 Base de datos vaciada. Ya podés ejecutar el seed que necesites.');
  }

  private async createCobradoresBase() {
    const cobradoresBase = [
      'Cobradora Norte',
      'Cobradora Centro',
      'Cobradora Sur',
      'Ana María Rodríguez (chuli)',
    ];

    for (const nombre of cobradoresBase) {
      const existe = await this.cobradorRepository.findOne({
        where: { nombre },
      });
      if (!existe) {
        const cobrador = this.cobradorRepository.create({
          nombre,
          activo: true,
        });
        const cobradorGuardado = await this.cobradorRepository.save(cobrador);
        this.logger.log(`🧾 Cobrador "${nombre}" creado.`);

        // Crear configuración de comisión por defecto (15%)
        const comisionExistente = await this.comisionConfigRepository.findOne({
          where: { cobradorId: cobradorGuardado.id },
        });
        if (!comisionExistente) {
          const comisionConfig = this.comisionConfigRepository.create({
            cobradorId: cobradorGuardado.id,
            porcentaje: 0.15, // 15% en formato decimal
            vigenteDesde: new Date(),
          });
          await this.comisionConfigRepository.save(comisionConfig);
          this.logger.log(
            `💰 Comisión por defecto (15%) asignada a "${nombre}".`,
          );
        }
      } else {
        // Verificar si el cobrador existente tiene comisión configurada
        const comisionExistente = await this.comisionConfigRepository.findOne({
          where: { cobradorId: existe.id },
        });
        if (!comisionExistente) {
          const comisionConfig = this.comisionConfigRepository.create({
            cobradorId: existe.id,
            porcentaje: 0.15, // 15% en formato decimal
            vigenteDesde: new Date(),
          });
          await this.comisionConfigRepository.save(comisionConfig);
          this.logger.log(
            `💰 Comisión por defecto (15%) asignada a "${nombre}" (cobrador existente).`,
          );
        }
      }
    }
  }

  private async createCobradorAnaMariaRodriguez() {
    await this.ensureCobradorConComision('Ana María Rodríguez (chuli)');
  }

  private async ensureCobradorConComision(nombre: string) {
    const existe = await this.cobradorRepository.findOne({
      where: { nombre },
    });

    if (!existe) {
      const cobrador = this.cobradorRepository.create({
        nombre,
        activo: true,
      });
      const cobradorGuardado = await this.cobradorRepository.save(cobrador);
      this.logger.log(`🧾 Cobrador "${nombre}" creado.`);
      await this.ensureComisionConfig(cobradorGuardado.id, nombre, false);
      return;
    }

    await this.ensureComisionConfig(existe.id, nombre, true);
  }

  private async ensureComisionConfig(
    cobradorId: number,
    nombre: string,
    cobradorExistente: boolean,
  ) {
    const comisionExistente = await this.comisionConfigRepository.findOne({
      where: { cobradorId },
    });

    if (comisionExistente) {
      return;
    }

    const comisionConfig = this.comisionConfigRepository.create({
      cobradorId,
      porcentaje: 0.15,
      vigenteDesde: new Date(),
    });

    await this.comisionConfigRepository.save(comisionConfig);

    if (cobradorExistente) {
      this.logger.log(
        `💰 Comisión por defecto (15%) asignada a "${nombre}" (cobrador existente).`,
      );
      return;
    }

    this.logger.log(`💰 Comisión por defecto (15%) asignada a "${nombre}".`);
  }

  private async clearDatabaseData() {
    await this.usuarioRepository.query(
      `TRUNCATE TABLE
        cobro_operacion_linea,
        cobro_operacion,
        cobrador_cuenta_corriente_movimiento,
        cobrador_dispositivo,
        cobrador_comision_config,
        pago_cuota,
        cuota,
        registro_ingreso,
        socio_temporada,
        socio,
        grupo_familiar,
        usuario,
        temporada_pileta,
        metodos_pago,
        cobrador,
        categoria_socio
      RESTART IDENTITY CASCADE;`,
    );

    this.logger.warn('🧹 Datos eliminados de la base de datos.');
  }

  private async createMetodosPago() {
    const metodosPagoBase = [
      { nombre: 'EFECTIVO', descripcion: 'Pago en efectivo', orden: 1 },
      { nombre: 'TRANSFERENCIA', descripcion: 'Transferencia bancaria', orden: 2 },
    ];

    for (const metodo of metodosPagoBase) {
      const existe = await this.metodoPagoRepository.findOne({
        where: { nombre: metodo.nombre },
      });
      if (!existe) {
        await this.metodoPagoRepository.save(
          this.metodoPagoRepository.create({
            ...metodo,
            activo: true,
          }),
        );
        this.logger.log(`💳 Método de pago "${metodo.nombre}" creado.`);
        continue;
      }

      const necesitaActualizacion =
        !existe.activo ||
        existe.descripcion !== metodo.descripcion ||
        existe.orden !== metodo.orden;

      if (necesitaActualizacion) {
        await this.metodoPagoRepository.save({
          ...existe,
          descripcion: metodo.descripcion,
          orden: metodo.orden,
          activo: true,
        });
        this.logger.log(
          `💳 Método de pago "${metodo.nombre}" actualizado y activado.`,
        );
      }
    }
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
    return (
      this.getRandom(prefixes) + this.getRandomInt(1000000, 9999999).toString()
    );
  }

  private generateBirthDate(edadMinima: number, edadMaxima: number): string {
    const year =
      new Date().getFullYear() - this.getRandomInt(edadMinima, edadMaxima);
    const month = this.getRandomInt(1, 12).toString().padStart(2, '0');
    const day = this.getRandomInt(1, 28).toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private generateEmail(
    nombre: string,
    apellido: string,
    sufijo: string,
  ): string {
    return `${nombre.toLowerCase()}.${apellido.toLowerCase()}${sufijo}@email.com`
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }

  private generateNumeroTarjetaCentro(secuencia: number): string {
    const indiceNormalizado = secuencia % NUMEROS_TARJETA_CENTRO_SEED.length;
    return NUMEROS_TARJETA_CENTRO_SEED[indiceNormalizado];
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

    const hashedPassword = await bcrypt.hash(
      adminPass,
      AUTH.BCRYPT_SALT_ROUNDS,
    );

    const newUser = this.usuarioRepository.create({
      usuario: adminUser,
      password: hashedPassword,
    });

    await this.usuarioRepository.save(newUser);
    this.logger.log(
      '👤 Usuario admin creado (usuario: admin, contraseña: admin)',
    );
  }

  private async createCategoriasSocio() {
    const categoriasData = [
      {
        nombre: 'ACTIVO',
        montoMensual: 10000,
        exento: false,
      },
      {
        nombre: 'ADHERENTE',
        montoMensual: 5000,
        exento: false,
      },
      {
        nombre: 'VITALICIO',
        montoMensual: 0,
        exento: true,
      },
      {
        nombre: 'HONORARIO',
        montoMensual: 0,
        exento: true,
      },
    ];

    for (const categoria of categoriasData) {
      const exists = await this.categoriaSocioRepository.findOne({
        where: { nombre: categoria.nombre },
      });
      if (!exists) {
        await this.categoriaSocioRepository.save(
          this.categoriaSocioRepository.create(categoria),
        );
        this.logger.log(`📁 Categoría "${categoria.nombre}" creada.`);
      }
    }
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
        await this.temporadaRepository.save(
          this.temporadaRepository.create(temp),
        );
        this.logger.log(`📅 Temporada "${temp.nombre}" creada.`);
      }
    }
  }

  /**
   * Crea grupos familiares con múltiples miembros
   * Cada familia tiene un grupo familiar asociado con el apellido
   */
  private async createGruposFamiliares(): Promise<boolean> {
    const sociosCount = await this.socioRepository.count();
    if (sociosCount > 0) {
      this.logger.log('👥 Ya existen socios. Omitiendo creación masiva.');
      return false;
    }

    // Obtener categorías para asignar a los socios
    const categorias = await this.categoriaSocioRepository.find();
    const categoriaActivo = categorias.find((c) => c.nombre === 'ACTIVO');
    const categoriaAdherente = categorias.find((c) => c.nombre === 'ADHERENTE');
    const categoriaVitalicio = categorias.find((c) => c.nombre === 'VITALICIO');
    const categoriaHonorario = categorias.find((c) => c.nombre === 'HONORARIO');

    const dniUsados = new Set<string>();
    let totalSocios = 0;
    let totalSociosConTarjetaCentro = 0;
    let secuenciaTarjetaCentro = 0;

    // Seleccionar apellidos únicos para cada familia
    const apellidosSeleccionados = [...APELLIDOS]
      .sort(() => Math.random() - 0.5)
      .slice(0, FAMILIAS_PREDEFINIDAS.length);

    for (let i = 0; i < FAMILIAS_PREDEFINIDAS.length; i++) {
      const familia = FAMILIAS_PREDEFINIDAS[i];
      const apellido = apellidosSeleccionados[i];
      const direccionFam = `${this.getRandom(CALLES)} ${this.getRandomInt(100, 3000)}`;

      // Crear el grupo familiar
      const grupoFamiliar = this.grupoFamiliarRepository.create({
        nombre: `Familia ${apellido}`,
        descripcion: `Grupo familiar de la familia ${apellido}`,
        orden: i + 1,
      });
      const grupoGuardado =
        await this.grupoFamiliarRepository.save(grupoFamiliar);
      this.logger.log(`👨‍👩‍👧‍👦 Grupo familiar "${grupoFamiliar.nombre}" creado.`);

      const sociosFamilia: Socio[] = [];

      // Crear el padre (jefe de familia - mayormente ACTIVO, algunos VITALICIO u HONORARIO)
      let dniPadre: string;
      do {
        dniPadre = this.generateDNI();
      } while (dniUsados.has(dniPadre));
      dniUsados.add(dniPadre);

      // Asignar categoría al padre: 70% ACTIVO, 20% VITALICIO, 10% HONORARIO
      const categoriaPadre =
        i < 7
          ? categoriaActivo
          : i < 9
            ? categoriaVitalicio
            : categoriaHonorario;
      const padreTieneTarjetaCentro = i % 2 === 0;

      const socioPadre = this.socioRepository.create({
        nombre: familia.padre.nombre,
        apellido,
        dni: dniPadre,
        telefono: this.generatePhone(),
        email: this.generateEmail(
          familia.padre.nombre,
          apellido,
          `_padre_${i}`,
        ),
        fechaNacimiento: this.generateBirthDate(35, 55),
        direccion: direccionFam,
        estado: 'ACTIVO',
        genero: familia.padre.genero,
        fechaAlta: new Date().toISOString().split('T')[0],
        grupoFamiliar: grupoGuardado,
        categoria: categoriaPadre,
        tarjetaCentro: padreTieneTarjetaCentro,
        numeroTarjetaCentro: padreTieneTarjetaCentro
          ? this.generateNumeroTarjetaCentro(secuenciaTarjetaCentro++)
          : undefined,
      });
      sociosFamilia.push(socioPadre);
      if (padreTieneTarjetaCentro) {
        totalSociosConTarjetaCentro++;
      }

      // Crear la madre (mayormente ACTIVO o ADHERENTE)
      let dniMadre: string;
      do {
        dniMadre = this.generateDNI();
      } while (dniUsados.has(dniMadre));
      dniUsados.add(dniMadre);

      // Asignar categoría a la madre: 60% ACTIVO, 40% ADHERENTE
      const categoriaMadre = i < 6 ? categoriaActivo : categoriaAdherente;
      const madreTieneTarjetaCentro = i % 3 === 0;

      const socioMadre = this.socioRepository.create({
        nombre: familia.madre.nombre,
        apellido,
        dni: dniMadre,
        telefono: this.generatePhone(),
        email: this.generateEmail(
          familia.madre.nombre,
          apellido,
          `_madre_${i}`,
        ),
        fechaNacimiento: this.generateBirthDate(30, 50),
        direccion: direccionFam,
        estado: 'ACTIVO',
        genero: familia.madre.genero,
        fechaAlta: new Date().toISOString().split('T')[0],
        grupoFamiliar: grupoGuardado,
        categoria: categoriaMadre,
        tarjetaCentro: madreTieneTarjetaCentro,
        numeroTarjetaCentro: madreTieneTarjetaCentro
          ? this.generateNumeroTarjetaCentro(secuenciaTarjetaCentro++)
          : undefined,
      });
      sociosFamilia.push(socioMadre);
      if (madreTieneTarjetaCentro) {
        totalSociosConTarjetaCentro++;
      }

      // Crear los hijos (todos ADHERENTE - dependientes de los padres)
      for (let j = 0; j < familia.hijos.length; j++) {
        const hijo = familia.hijos[j];
        const hijoTieneTarjetaCentro = (i + j) % 4 === 0;
        let dniHijo: string;
        do {
          dniHijo = this.generateDNI();
        } while (dniUsados.has(dniHijo));
        dniUsados.add(dniHijo);

        const socioHijo = this.socioRepository.create({
          nombre: hijo.nombre,
          apellido,
          dni: dniHijo,
          telefono:
            this.getRandomInt(18, 25) > 20 ? this.generatePhone() : undefined, // Algunos hijos no tienen teléfono
          email: this.generateEmail(hijo.nombre, apellido, `_hijo${j}_${i}`),
          fechaNacimiento: this.generateBirthDate(5, 25),
          direccion: direccionFam,
          estado: 'ACTIVO',
          genero: hijo.genero,
          fechaAlta: new Date().toISOString().split('T')[0],
          grupoFamiliar: grupoGuardado,
          categoria: categoriaAdherente, // Los hijos siempre son ADHERENTE
          tarjetaCentro: hijoTieneTarjetaCentro,
          numeroTarjetaCentro: hijoTieneTarjetaCentro
            ? this.generateNumeroTarjetaCentro(secuenciaTarjetaCentro++)
            : undefined,
        });
        sociosFamilia.push(socioHijo);
        if (hijoTieneTarjetaCentro) {
          totalSociosConTarjetaCentro++;
        }
      }

      // Guardar todos los socios de la familia
      await this.socioRepository.save(sociosFamilia);
      totalSocios += sociosFamilia.length;
      this.logger.log(
        `   └─ ${sociosFamilia.length} miembros agregados a la familia ${apellido}`,
      );
    }

    // Crear algunos socios individuales (sin grupo familiar) para variedad
    const sociosIndividuales = 10;
    for (let i = 0; i < sociosIndividuales; i++) {
      const esMasculino = i % 2 === 0;
      const nombre = esMasculino
        ? this.getRandom(NOMBRES_MASCULINOS)
        : this.getRandom(NOMBRES_FEMENINOS);
      const apellido = APELLIDOS[FAMILIAS_PREDEFINIDAS.length + i];

      let dni: string;
      do {
        dni = this.generateDNI();
      } while (dniUsados.has(dni));
      dniUsados.add(dni);

      // Asignar categoría variada a socios individuales
      const categoriasIndividuales = [
        categoriaActivo,
        categoriaActivo,
        categoriaActivo,
        categoriaAdherente,
        categoriaAdherente,
        categoriaVitalicio,
        categoriaHonorario,
        categoriaActivo,
        categoriaActivo,
        categoriaAdherente,
      ];
      const categoriaIndividual = categoriasIndividuales[i];
      const tieneTarjetaCentro = i % 3 === 0 || i === sociosIndividuales - 1;

      const socio = this.socioRepository.create({
        nombre,
        apellido,
        dni,
        telefono: this.generatePhone(),
        email: this.generateEmail(nombre, apellido, `_ind${i}`),
        fechaNacimiento: this.generateBirthDate(25, 60),
        direccion: `${this.getRandom(CALLES)} ${this.getRandomInt(100, 3000)}`,
        estado: i < 8 ? 'ACTIVO' : 'INACTIVO',
        genero: esMasculino ? 'MASCULINO' : 'FEMENINO',
        fechaAlta: new Date().toISOString().split('T')[0],
        categoria: categoriaIndividual,
        tarjetaCentro: tieneTarjetaCentro,
        numeroTarjetaCentro: tieneTarjetaCentro
          ? this.generateNumeroTarjetaCentro(secuenciaTarjetaCentro++)
          : undefined,
      });
      await this.socioRepository.save(socio);
      totalSocios++;
      if (tieneTarjetaCentro) {
        totalSociosConTarjetaCentro++;
      }
    }

    this.logger.log(
      `👥 ${totalSocios} socios creados (${FAMILIAS_PREDEFINIDAS.length} familias con grupos familiares + ${sociosIndividuales} individuales).`,
    );
    this.logger.log(
      `💳 ${totalSociosConTarjetaCentro} socios creados con tarjeta del centro.`,
    );
    return true;
  }

  private async createSociosNuevosConTarjetaCentro() {
    const sociosSeedConTarjeta = await this.socioRepository.find({
      where: { email: Like('tarjeta.centro+%@seed.dev') },
      order: { id: 'ASC' },
    });

    if (sociosSeedConTarjeta.length >= NUMEROS_TARJETA_CENTRO_SEED.length) {
      this.logger.log(
        `💳 Ya existen ${sociosSeedConTarjeta.length} socios nuevos seed con tarjeta del centro. Omitiendo creación.`,
      );
      return;
    }

    const categorias = await this.categoriaSocioRepository.find();
    const categoriaActivo =
      categorias.find((c) => c.nombre === 'ACTIVO') ?? categorias[0];

    if (!categoriaActivo) {
      this.logger.warn(
        '⚠️ No se encontró categoría para crear socios nuevos con tarjeta del centro.',
      );
      return;
    }

    const sociosExistentes = await this.socioRepository.find();
    const dniUsados = new Set<string>(
      sociosExistentes
        .map((socio) => socio.dni)
        .filter(
          (dni): dni is string =>
            typeof dni === 'string' && dni.trim().length > 0,
        ),
    );

    const emailsSeedExistentes = new Set<string>(
      sociosSeedConTarjeta
        .map((socio) => socio.email)
        .filter(
          (email): email is string =>
            typeof email === 'string' && email.trim().length > 0,
        ),
    );

    const nuevosSociosConTarjeta: Socio[] = [];

    for (let index = 0; index < NUMEROS_TARJETA_CENTRO_SEED.length; index++) {
      const email = `tarjeta.centro+${String(index + 1).padStart(3, '0')}@seed.dev`;

      if (emailsSeedExistentes.has(email)) {
        continue;
      }

      let dni: string;
      do {
        dni = this.generateDNI();
      } while (dniUsados.has(dni));
      dniUsados.add(dni);

      const esMasculino = index % 2 === 0;
      const nombre = esMasculino
        ? NOMBRES_MASCULINOS[index % NOMBRES_MASCULINOS.length]
        : NOMBRES_FEMENINOS[index % NOMBRES_FEMENINOS.length];
      const apellido = `${APELLIDOS[index % APELLIDOS.length]} TC${Math.floor(index / APELLIDOS.length) + 1}`;

      const nuevoSocio = this.socioRepository.create({
        nombre,
        apellido,
        dni,
        telefono: this.generatePhone(),
        email,
        fechaNacimiento: this.generateBirthDate(18, 65),
        direccion: `${this.getRandom(CALLES)} ${this.getRandomInt(100, 3000)}`,
        estado: 'ACTIVO',
        genero: esMasculino ? 'MASCULINO' : 'FEMENINO',
        fechaAlta: new Date().toISOString().split('T')[0],
        categoria: categoriaActivo,
        tarjetaCentro: true,
        numeroTarjetaCentro: this.generateNumeroTarjetaCentro(index),
      });

      nuevosSociosConTarjeta.push(nuevoSocio);
    }

    if (nuevosSociosConTarjeta.length === 0) {
      this.logger.log(
        '💳 No hay nuevos socios pendientes para crear con tarjeta del centro.',
      );
      return;
    }

    await this.socioRepository.save(nuevosSociosConTarjeta);

    this.logger.log(
      `💳 Socios nuevos con tarjeta del centro creados en seed de desarrollo: ${nuevosSociosConTarjeta.length}.`,
    );
  }

  private async asociarSociosATemporadas() {
    const temporadaActual = await this.temporadaRepository.findOne({
      where: { nombre: 'Temporada 2025-2026' },
    });

    if (!temporadaActual) {
      this.logger.warn(
        '⚠️ No se encontró la temporada actual para asociar socios.',
      );
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
      this.logger.log(
        `🏊 ${asociados} socios asociados a "${temporadaActual.nombre}" (Socios Pileta).`,
      );
    }
  }

  private getPerfilPagoSeed(index: number): PerfilPagoSeed {
    const bucket = index % 10;

    if (bucket < 4) {
      return 'AL_DIA';
    }

    if (bucket < 8) {
      return 'DEUDA_PARCIAL';
    }

    return 'MOROSO';
  }

  private getCantidadCuotasPendientes(
    perfil: PerfilPagoSeed,
    socioIndex: number,
  ): number {
    if (perfil === 'AL_DIA') {
      return 0;
    }

    if (perfil === 'DEUDA_PARCIAL') {
      return (socioIndex % 3) + 1;
    }

    return SeedService.MAX_CUOTAS_IMPAGAS;
  }

  private buildFechaPago(periodo: string, socioIndex: number): Date {
    const [anio, mes] = periodo.split('-').map(Number);
    const dia = Math.min(28, 5 + (socioIndex % 20));

    return new Date(anio, mes - 1, dia, 10, 0, 0, 0);
  }

  private buildFechaEmision(periodo: string): Date {
    const [anio, mes] = periodo.split('-').map(Number);

    return new Date(anio, mes - 1, 1, 8, 0, 0, 0);
  }

  private async createCuotasSocios2025() {
    const sociosElegibles = await this.socioRepository.find({
      where: { estado: In(['ACTIVO', 'MOROSO']) },
      relations: ['categoria'],
      order: { id: 'ASC' },
    });

    const sociosConCategoriaNoExenta = sociosElegibles.filter(
      (socio) => socio.categoria && !socio.categoria.exento,
    );

    if (sociosConCategoriaNoExenta.length === 0) {
      this.logger.warn(
        '⚠️ No hay socios activos con categoría no exenta para generar cuotas 2025.',
      );
      return;
    }

    const cuotasExistentes2025 = await this.cuotaRepository.find({
      where: { periodo: Like('2025-%') },
      select: ['id', 'socioId', 'periodo', 'estado'],
    });

    const cuotasExistentesPorClave = new Set(
      cuotasExistentes2025.map((cuota) => `${cuota.socioId}-${cuota.periodo}`),
    );

    const cuotasNuevas: Cuota[] = [];
    const sociosMorososIds = new Set<number>();
    const sociosActivosIds = new Set<number>();
    let sociosAlDia = 0;
    let sociosConDeudaParcial = 0;
    let sociosMorosos = 0;
    let cuotasPagadas = 0;
    let cuotasPendientes = 0;

    for (const [index, socio] of sociosConCategoriaNoExenta.entries()) {
      const perfil = this.getPerfilPagoSeed(index);
      const cuotasExistentesSocio = cuotasExistentes2025.filter(
        (cuota) => cuota.socioId === socio.id,
      );
      let cuotasPendientesSocio = cuotasExistentesSocio.filter(
        (cuota) => cuota.estado === EstadoCuota.PENDIENTE,
      ).length;

      const cuotasPendientesObjetivo = this.getCantidadCuotasPendientes(
        perfil,
        index,
      );
      const cuotasPagadasSocio =
        PERIODOS_2025.length - cuotasPendientesObjetivo;

      if (perfil === 'AL_DIA') {
        sociosAlDia++;
      } else if (perfil === 'DEUDA_PARCIAL') {
        sociosConDeudaParcial++;
      } else {
        sociosMorosos++;
      }

      for (const [periodoIndex, periodo] of PERIODOS_2025.entries()) {
        if (cuotasPendientesSocio >= SeedService.MAX_CUOTAS_IMPAGAS) {
          sociosMorososIds.add(socio.id);
          break;
        }

        const claveCuota = `${socio.id}-${periodo}`;

        if (cuotasExistentesPorClave.has(claveCuota)) {
          continue;
        }

        const estaPagada = periodoIndex < cuotasPagadasSocio;
        const fechaPago = estaPagada
          ? this.buildFechaPago(periodo, index)
          : undefined;
        cuotasNuevas.push(
          this.cuotaRepository.create({
            socioId: socio.id,
            periodo,
            monto: Number(socio.categoria!.montoMensual),
            estado: estaPagada ? EstadoCuota.PAGADA : EstadoCuota.PENDIENTE,
            fechaPago,
          }),
        );

        if (estaPagada) {
          cuotasPagadas++;
        } else {
          cuotasPendientes++;
          cuotasPendientesSocio++;

          if (cuotasPendientesSocio >= SeedService.MAX_CUOTAS_IMPAGAS) {
            sociosMorososIds.add(socio.id);
          }
        }
      }

      if (cuotasPendientesSocio >= SeedService.MAX_CUOTAS_IMPAGAS) {
        sociosMorososIds.add(socio.id);
      } else {
        sociosActivosIds.add(socio.id);
      }
    }

    if (sociosMorososIds.size > 0) {
      await this.socioRepository.update(
        { id: In([...sociosMorososIds]), estado: 'ACTIVO' },
        { estado: 'MOROSO' },
      );
    }

    if (sociosActivosIds.size > 0) {
      await this.socioRepository.update(
        { id: In([...sociosActivosIds]), estado: 'MOROSO' },
        { estado: 'ACTIVO' },
      );
    }

    if (cuotasNuevas.length === 0) {
      this.logger.log(
        '💳 Las cuotas 2025 ya existen para los socios elegibles. Omitiendo creación.',
      );
      return;
    }

    const cuotasGuardadas = await this.cuotaRepository.save(cuotasNuevas);

    const pagosNuevos: PagoCuota[] = [];
    for (const [index, cuota] of cuotasGuardadas.entries()) {
      if (cuota.estado !== EstadoCuota.PAGADA || !cuota.fechaPago) {
        continue;
      }

      const metodoPagoId =
        index % 2 === 0
          ? 1 // EFECTIVO
          : 2; // TRANSFERENCIA

      pagosNuevos.push(
        this.pagoCuotaRepository.create({
          cuotaId: cuota.id,
          montoPagado: Number(cuota.monto),
          metodoPagoId,
          fechaPago: cuota.fechaPago,
          fechaEmisionCuota: this.buildFechaEmision(cuota.periodo),
          observaciones: 'Pago generado automáticamente por seed de desarrollo',
        }),
      );
    }

    if (pagosNuevos.length > 0) {
      await this.pagoCuotaRepository.save(pagosNuevos);
    }

    this.logger.log(
      `💳 Cuotas 2025 generadas: ${cuotasGuardadas.length} (${cuotasPagadas} pagadas / ${cuotasPendientes} pendientes).`,
    );
    this.logger.log(
      `📊 Perfiles de pago 2025: ${sociosAlDia} al día, ${sociosConDeudaParcial} con deuda parcial y ${sociosMorosos} morosos.`,
    );
    this.logger.log(
      `🧾 Pagos de cuotas creados automáticamente: ${pagosNuevos.length}.`,
    );
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
        metodoPago:
          i % 2 === 0 ? MetodoPago.EFECTIVO : MetodoPago.TRANSFERENCIA,
        importe: this.getRandomInt(3, 8) * 1000, // Entre $3000 y $8000
        fechaHoraIngreso: generarHoraHoy(),
      });
    }

    await this.registroIngresoRepository.save(
      this.registroIngresoRepository.create(ingresos),
    );
    this.logger.log(
      `📋 ${ingresos.length} registros de ingreso creados para hoy.`,
    );
  }
}
