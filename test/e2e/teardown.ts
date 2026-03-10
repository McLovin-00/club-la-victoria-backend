import { INestApplication } from '@nestjs/common';

export const teardownE2e = async (app: INestApplication): Promise<void> => {
  await app.close();
};
