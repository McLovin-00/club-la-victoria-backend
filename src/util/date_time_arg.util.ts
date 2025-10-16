import { format } from 'date-fns-tz';

export const getDateTimeArg = () => {
  return format(new Date(), 'yyyy-MM-dd HH:mm:ss', {
    timeZone: 'America/Argentina/Buenos_Aires',
  });
};
