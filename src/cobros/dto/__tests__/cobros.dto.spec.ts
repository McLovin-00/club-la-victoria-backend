import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { PagoMetodoMontoDto, RegistrarPagoDto } from '../cobros.dto';

describe('PagoMetodoMontoDto', () => {
  it('permite monto 0 para cobros cubiertos completamente con saldo a favor', async () => {
    const dto = plainToInstance(PagoMetodoMontoDto, {
      metodoPagoId: 1,
      monto: 0,
    });

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
  });
});

describe('RegistrarPagoDto', () => {
  it('rechaza montoPagado null para evitar que se trate como monto omitido', async () => {
    const dto = plainToInstance(RegistrarPagoDto, {
      cuotaId: 1,
      metodoPagoId: 1,
      montoPagado: null,
    });

    const errors = await validate(dto);

    expect(errors.some((error) => error.property === 'montoPagado')).toBe(true);
  });
});
