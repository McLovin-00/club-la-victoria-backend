import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository, DataSource, QueryRunner, EntityManager } from 'typeorm';
import { CreditoService } from '../credito.service';
import { CreditoIndividual } from '../entities/credito-individual.entity';
import { CreditoGrupal } from '../entities/credito-grupal.entity';
import { CustomError } from 'src/constants/errors/custom-error';

describe('CreditoService', () => {
  let service: CreditoService;
  let creditoIndividualRepository: Repository<CreditoIndividual>;
  let creditoGrupalRepository: Repository<CreditoGrupal>;

  const mockQueryRunner = {
    connect: jest.fn().mockResolvedValue(undefined),
    startTransaction: jest.fn().mockResolvedValue(undefined),
    commitTransaction: jest.fn().mockResolvedValue(undefined),
    rollbackTransaction: jest.fn().mockResolvedValue(undefined),
    release: jest.fn().mockResolvedValue(undefined),
    manager: {
      findOne: jest.fn(),
      find: jest.fn(),
      save: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      acquireLock: jest.fn().mockResolvedValue(undefined),
    } as unknown as EntityManager,
  } as unknown as QueryRunner;

  const mockDataSource = {
    createQueryRunner: jest.fn().mockReturnValue(mockQueryRunner),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CreditoService,
        {
          provide: getRepositoryToken(CreditoIndividual),
          useValue: {
            findOne: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(CreditoGrupal),
          useValue: {
            findOne: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
          },
        },
        {
          provide: DataSource,
          useValue: mockDataSource,
        },
      ],
    }).compile();

    service = module.get<CreditoService>(CreditoService);
    creditoIndividualRepository = module.get(getRepositoryToken(CreditoIndividual));
    creditoGrupalRepository = module.get(getRepositoryToken(CreditoGrupal));
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('aplicarCreditoIndividual', () => {
    it('should apply credit to charges and return correct summary', async () => {
      const saldoCredito = 2000;
      const totalCargos = 5000;
      const creditoIndividual = {
        id: 1,
        socioId: 10,
        saldo: saldoCredito,
      };

      (mockQueryRunner.manager.findOne as jest.Mock).mockResolvedValue(creditoIndividual);
      (mockQueryRunner.manager.save as jest.Mock).mockResolvedValue({
        ...creditoIndividual,
        saldo: 0,
      });

      const result = await service.aplicarCreditoIndividual(
        mockQueryRunner,
        10,
        totalCargos,
      );

      expect(result.creditoAplicado).toBe(2000);
      expect(result.nuevoSaldo).toBe(0);
      expect(result.montoACobrar).toBe(3000);
    });

    it('should floor saldo at 0 when credit exceeds charges', async () => {
      const saldoCredito = 10000;
      const totalCargos = 3000;
      const creditoIndividual = {
        id: 1,
        socioId: 10,
        saldo: saldoCredito,
      };

      (mockQueryRunner.manager.findOne as jest.Mock).mockResolvedValue(creditoIndividual);
      (mockQueryRunner.manager.save as jest.Mock).mockResolvedValue({
        ...creditoIndividual,
        saldo: 7000,
      });

      const result = await service.aplicarCreditoIndividual(
        mockQueryRunner,
        10,
        totalCargos,
      );

      expect(result.creditoAplicado).toBe(3000);
      expect(result.nuevoSaldo).toBe(7000);
      expect(result.montoACobrar).toBe(0);
    });

    it('should not apply credit when saldo is 0', async () => {
      const creditoIndividual = {
        id: 1,
        socioId: 10,
        saldo: 0,
      };

      (mockQueryRunner.manager.findOne as jest.Mock).mockResolvedValue(creditoIndividual);

      const result = await service.aplicarCreditoIndividual(
        mockQueryRunner,
        10,
        5000,
      );

      expect(result.creditoAplicado).toBe(0);
      expect(result.nuevoSaldo).toBe(0);
      expect(result.montoACobrar).toBe(5000);
    });

    it('should return zero credit applied when no credit record exists', async () => {
      (mockQueryRunner.manager.findOne as jest.Mock).mockResolvedValue(null);

      const result = await service.aplicarCreditoIndividual(
        mockQueryRunner,
        10,
        5000,
      );

      expect(result.creditoAplicado).toBe(0);
      expect(result.nuevoSaldo).toBe(0);
      expect(result.montoACobrar).toBe(5000);
    });
  });

  describe('acumularCreditoIndividual', () => {
    it('should increase saldo when payment exceeds charges', async () => {
      const saldoActual = 1000;
      const montoExcedente = 500;
      const creditoIndividual = {
        id: 1,
        socioId: 10,
        saldo: saldoActual,
      };

      (mockQueryRunner.manager.findOne as jest.Mock).mockResolvedValue(creditoIndividual);
      (mockQueryRunner.manager.save as jest.Mock).mockResolvedValue({
        ...creditoIndividual,
        saldo: 1500,
      });

      const result = await service.acumularCreditoIndividual(
        mockQueryRunner,
        10,
        montoExcedente,
      );

      expect(result.saldoAnterior).toBe(1000);
      expect(result.nuevoSaldo).toBe(1500);
      expect(result.creditoGenerado).toBe(500);
    });

    it('should floor saldo at 0 for negative excedente (should not happen but guard)', async () => {
      const saldoActual = 1000;
      const creditoIndividual = {
        id: 1,
        socioId: 10,
        saldo: saldoActual,
      };

      (mockQueryRunner.manager.findOne as jest.Mock).mockResolvedValue(creditoIndividual);
      (mockQueryRunner.manager.save as jest.Mock).mockResolvedValue(creditoIndividual);

      const result = await service.acumularCreditoIndividual(
        mockQueryRunner,
        10,
        0,
      );

      expect(result.nuevoSaldo).toBe(1000);
      expect(result.creditoGenerado).toBe(0);
    });
  });

  describe('aplicarCreditoGrupal', () => {
    it('should apply group credit to charges and return correct summary', async () => {
      const saldoCredito = 800;
      const totalCargos = 1200;
      const creditoGrupal = {
        id: 1,
        grupoFamiliarId: 5,
        saldo: saldoCredito,
      };

      (mockQueryRunner.manager.findOne as jest.Mock).mockResolvedValue(creditoGrupal);
      (mockQueryRunner.manager.save as jest.Mock).mockResolvedValue({
        ...creditoGrupal,
        saldo: 0,
      });

      const result = await service.aplicarCreditoGrupal(
        mockQueryRunner,
        5,
        totalCargos,
      );

      expect(result.creditoAplicado).toBe(800);
      expect(result.nuevoSaldo).toBe(0);
      expect(result.montoACobrar).toBe(400);
    });

    it('should floor group credit at 0 when exceeds charges', async () => {
      const saldoCredito = 2000;
      const totalCargos = 500;
      const creditoGrupal = {
        id: 1,
        grupoFamiliarId: 5,
        saldo: saldoCredito,
      };

      (mockQueryRunner.manager.findOne as jest.Mock).mockResolvedValue(creditoGrupal);
      (mockQueryRunner.manager.save as jest.Mock).mockResolvedValue({
        ...creditoGrupal,
        saldo: 1500,
      });

      const result = await service.aplicarCreditoGrupal(
        mockQueryRunner,
        5,
        totalCargos,
      );

      expect(result.creditoAplicado).toBe(500);
      expect(result.nuevoSaldo).toBe(1500);
      expect(result.montoACobrar).toBe(0);
    });

    it('should not apply group credit when saldo is 0', async () => {
      const creditoGrupal = {
        id: 1,
        grupoFamiliarId: 5,
        saldo: 0,
      };

      (mockQueryRunner.manager.findOne as jest.Mock).mockResolvedValue(creditoGrupal);

      const result = await service.aplicarCreditoGrupal(
        mockQueryRunner,
        5,
        1200,
      );

      expect(result.creditoAplicado).toBe(0);
      expect(result.nuevoSaldo).toBe(0);
      expect(result.montoACobrar).toBe(1200);
    });
  });

  describe('acumularCreditoGrupal', () => {
    it('should increase group saldo when payment exceeds charges', async () => {
      const saldoActual = 200;
      const montoExcedente = 600;
      const creditoGrupal = {
        id: 1,
        grupoFamiliarId: 5,
        saldo: saldoActual,
      };

      (mockQueryRunner.manager.findOne as jest.Mock).mockResolvedValue(creditoGrupal);
      (mockQueryRunner.manager.save as jest.Mock).mockResolvedValue({
        ...creditoGrupal,
        saldo: 800,
      });

      const result = await service.acumularCreditoGrupal(
        mockQueryRunner,
        5,
        montoExcedente,
      );

      expect(result.saldoAnterior).toBe(200);
      expect(result.nuevoSaldo).toBe(800);
      expect(result.creditoGenerado).toBe(600);
    });
  });

  describe('individual and group isolation', () => {
    it('should never mix individual credit with group credit', async () => {
      const socioId = 10;
      const grupoFamiliarId = 5;
      const individualCredit = { id: 1, socioId, saldo: 1000 };
      const groupCredit = { id: 2, grupoFamiliarId, saldo: 500 };

      (mockQueryRunner.manager.findOne as jest.Mock).mockImplementation((entity) => {
        if (entity === CreditoIndividual) return Promise.resolve(individualCredit);
        if (entity === CreditoGrupal) return Promise.resolve(groupCredit);
        return Promise.resolve(null);
      });

      const individualResult = await service.aplicarCreditoIndividual(
        mockQueryRunner,
        socioId,
        5000,
      );
      const groupResult = await service.aplicarCreditoGrupal(
        mockQueryRunner,
        grupoFamiliarId,
        5000,
      );

      expect(individualResult.creditoAplicado).toBe(1000);
      expect(groupResult.creditoAplicado).toBe(500);
      expect(individualResult.nuevoSaldo).toBe(0);
      expect(groupResult.nuevoSaldo).toBe(0);
    });

    it('should not apply group credit when querying individual context', async () => {
      const socioId = 10;
      const grupoFamiliarId = 5;
      const individualCredit = null;
      const groupCredit = { id: 2, grupoFamiliarId, saldo: 500 };

      (mockQueryRunner.manager.findOne as jest.Mock).mockImplementation((entity) => {
        if (entity === CreditoIndividual) return Promise.resolve(individualCredit);
        if (entity === CreditoGrupal) return Promise.resolve(groupCredit);
        return Promise.resolve(null);
      });

      const result = await service.aplicarCreditoIndividual(
        mockQueryRunner,
        socioId,
        5000,
      );

      expect(result.creditoAplicado).toBe(0);
      expect(result.montoACobrar).toBe(5000);
    });

    it('should not apply individual credit when querying group context', async () => {
      const socioId = 10;
      const grupoFamiliarId = 5;
      const individualCredit = { id: 1, socioId, saldo: 1000 };
      const groupCredit = null;

      (mockQueryRunner.manager.findOne as jest.Mock).mockImplementation((entity) => {
        if (entity === CreditoIndividual) return Promise.resolve(individualCredit);
        if (entity === CreditoGrupal) return Promise.resolve(groupCredit);
        return Promise.resolve(null);
      });

      const result = await service.aplicarCreditoGrupal(
        mockQueryRunner,
        grupoFamiliarId,
        5000,
      );

      expect(result.creditoAplicado).toBe(0);
      expect(result.montoACobrar).toBe(5000);
    });
  });
});