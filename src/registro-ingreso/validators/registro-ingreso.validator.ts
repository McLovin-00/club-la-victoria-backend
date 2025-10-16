import {
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
} from 'class-validator';
import { TipoIngreso } from '../entities/registro-ingreso.entity';

interface RegistroIngresoValidation {
  tipoIngreso: TipoIngreso;
  idSocio?: number;
  dniNoSocio?: string;
}

@ValidatorConstraint({ name: 'isValidRegistroIngreso', async: false })
export class IsValidRegistroIngresoConstraint
  implements ValidatorConstraintInterface
{
  validate(_value: unknown, args: ValidationArguments) {
    const dto = args.object as RegistroIngresoValidation;

    // Si es NO_SOCIO, debe tener dniNoSocio
    if (dto.tipoIngreso === TipoIngreso.NO_SOCIO && !dto.dniNoSocio) {
      return false;
    }

    // Si es SOCIO_CLUB o SOCIO_PILETA, debe tener idSocio
    if (
      (dto.tipoIngreso === TipoIngreso.SOCIO_CLUB ||
        dto.tipoIngreso === TipoIngreso.SOCIO_PILETA) &&
      !dto.idSocio
    ) {
      return false;
    }

    return true;
  }

  defaultMessage(args: ValidationArguments) {
    const dto = args.object as RegistroIngresoValidation;
    if (dto.tipoIngreso === TipoIngreso.NO_SOCIO) {
      return 'dniNoSocio es requerido para ingresos de NO_SOCIO';
    }
    return 'idSocio es requerido para ingresos de SOCIO_CLUB o SOCIO_PILETA';
  }
}
