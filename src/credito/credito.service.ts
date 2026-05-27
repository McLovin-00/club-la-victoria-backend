import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, QueryRunner, EntityManager } from 'typeorm';
import { CreditoIndividual } from './entities/credito-individual.entity';
import { CreditoGrupal } from './entities/credito-grupal.entity';

export interface CreditoAplicadoResult {
  creditoAplicado: number;
  nuevoSaldo: number;
  montoACobrar: number;
}

export interface CreditoAcumuladoResult {
  saldoAnterior: number;
  nuevoSaldo: number;
  creditoGenerado: number;
}

@Injectable()
export class CreditoService {
  constructor(
    @InjectRepository(CreditoIndividual)
    private readonly creditoIndividualRepository: Repository<CreditoIndividual>,
    @InjectRepository(CreditoGrupal)
    private readonly creditoGrupalRepository: Repository<CreditoGrupal>,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Aplica crédito individual a un conjunto de cargos.
   * @returns CreditoAplicadoResult con creditoAplicado, nuevoSaldo, montoACobrar
   */
  async aplicarCreditoIndividual(
    queryRunner: QueryRunner,
    socioId: number,
    totalCargos: number,
  ): Promise<CreditoAplicadoResult> {
    // Pessimistic write lock prevents concurrent transactions from reading the same
    // balance and both applying it (lost update). Lock is released on commit/rollback.
    const credito = await queryRunner.manager.findOne(CreditoIndividual, {
      where: { socioId },
      lock: { mode: 'pessimistic_write' },
    });

    if (!credito || Number(credito.saldo) <= 0) {
      return {
        creditoAplicado: 0,
        nuevoSaldo: 0,
        montoACobrar: totalCargos,
      };
    }

    const saldo = Number(credito.saldo);
    const creditoAplicado = Math.min(saldo, totalCargos);
    const nuevoSaldo = Math.max(0, saldo - totalCargos);
    const montoACobrar = Math.max(0, totalCargos - saldo);

    credito.saldo = nuevoSaldo;
    await queryRunner.manager.save(credito);

    return {
      creditoAplicado,
      nuevoSaldo,
      montoACobrar,
    };
  }

  /**
   * Acumula crédito individual por excedente de pago.
   * @returns CreditoAcumuladoResult con saldoAnterior, nuevoSaldo, creditoGenerado
   */
  async acumularCreditoIndividual(
    queryRunner: QueryRunner,
    socioId: number,
    montoExcedente: number,
  ): Promise<CreditoAcumuladoResult> {
    if (montoExcedente <= 0) {
      const existing = await queryRunner.manager.findOne(CreditoIndividual, {
        where: { socioId },
      });
      return {
        saldoAnterior: existing ? Number(existing.saldo) : 0,
        nuevoSaldo: existing ? Number(existing.saldo) : 0,
        creditoGenerado: 0,
      };
    }

    let credito = await queryRunner.manager.findOne(CreditoIndividual, {
      where: { socioId },
      lock: { mode: 'pessimistic_write' },
    });

    const saldoAnterior = credito ? Number(credito.saldo) : 0;
    const nuevoSaldo = saldoAnterior + montoExcedente;

    if (!credito) {
      credito = queryRunner.manager.create(CreditoIndividual, {
        socioId,
        saldo: nuevoSaldo,
      });
    } else {
      credito.saldo = nuevoSaldo;
    }

    await queryRunner.manager.save(credito);

    return {
      saldoAnterior,
      nuevoSaldo,
      creditoGenerado: montoExcedente,
    };
  }

  /**
   * Aplica crédito grupal a un conjunto de cargos.
   * @returns CreditoAplicadoResult con creditoAplicado, nuevoSaldo, montoACobrar
   */
  async aplicarCreditoGrupal(
    queryRunner: QueryRunner,
    grupoFamiliarId: number,
    totalCargos: number,
  ): Promise<CreditoAplicadoResult> {
    // Pessimistic write lock prevents concurrent transactions from reading the same
    // balance and both applying it (lost update). Lock is released on commit/rollback.
    const credito = await queryRunner.manager.findOne(CreditoGrupal, {
      where: { grupoFamiliarId },
      lock: { mode: 'pessimistic_write' },
    });

    if (!credito || Number(credito.saldo) <= 0) {
      return {
        creditoAplicado: 0,
        nuevoSaldo: 0,
        montoACobrar: totalCargos,
      };
    }

    const saldo = Number(credito.saldo);
    const creditoAplicado = Math.min(saldo, totalCargos);
    const nuevoSaldo = Math.max(0, saldo - totalCargos);
    const montoACobrar = Math.max(0, totalCargos - saldo);

    credito.saldo = nuevoSaldo;
    await queryRunner.manager.save(credito);

    return {
      creditoAplicado,
      nuevoSaldo,
      montoACobrar,
    };
  }

  /**
   * Acumula crédito grupal por excedente de pago.
   * @returns CreditoAcumuladoResult con saldoAnterior, nuevoSaldo, creditoGenerado
   */
  async acumularCreditoGrupal(
    queryRunner: QueryRunner,
    grupoFamiliarId: number,
    montoExcedente: number,
  ): Promise<CreditoAcumuladoResult> {
    if (montoExcedente <= 0) {
      const existing = await queryRunner.manager.findOne(CreditoGrupal, {
        where: { grupoFamiliarId },
      });
      return {
        saldoAnterior: existing ? Number(existing.saldo) : 0,
        nuevoSaldo: existing ? Number(existing.saldo) : 0,
        creditoGenerado: 0,
      };
    }

    let credito = await queryRunner.manager.findOne(CreditoGrupal, {
      where: { grupoFamiliarId },
      lock: { mode: 'pessimistic_write' },
    });

    const saldoAnterior = credito ? Number(credito.saldo) : 0;
    const nuevoSaldo = saldoAnterior + montoExcedente;

    if (!credito) {
      credito = queryRunner.manager.create(CreditoGrupal, {
        grupoFamiliarId,
        saldo: nuevoSaldo,
      });
    } else {
      credito.saldo = nuevoSaldo;
    }

    await queryRunner.manager.save(credito);

    return {
      saldoAnterior,
      nuevoSaldo,
      creditoGenerado: montoExcedente,
    };
  }
}