import { format } from 'date-fns-tz';

export const getDayStartEnd = (fecha?: string) => {
  let fechaArg: Date;

  if (fecha) {
    const fechaArray = fecha.split('-');
    fechaArg = new Date(
      Number(fechaArray[0]),
      Number(fechaArray[1]) - 1,
      Number(fechaArray[2]),
    );
  } else {
    fechaArg = new Date(
      format(new Date(), 'yyyy-MM-dd HH:mm:ss', {
        timeZone: 'America/Argentina/Buenos_Aires',
      }),
    );
  }

  // Crear fechas inicio y fin del día en Argentina
  const inicioDia = new Date(
    Date.UTC(
      fechaArg.getFullYear(),
      fechaArg.getMonth(),
      fechaArg.getDate(),
      0,
      0,
      0,
      0,
    ),
  );

  const finDia = new Date(
    Date.UTC(
      fechaArg.getFullYear(),
      fechaArg.getMonth(),
      fechaArg.getDate(),
      23,
      59,
      59,
      999,
    ),
  );

  return {
    inicioDia,
    finDia,
  };
};
