import { RegistroIngreso } from '../../registro-ingreso/entities/registro-ingreso.entity';

export class StatisticsResponseDto {
  totalIngresos!: number;
  totalIngresosPileta!: number;
  totalIngresosClub!: number;
  totalSocios!: number;
  totalNoSocios!: number;
  registros!: RegistroIngreso[];
}
