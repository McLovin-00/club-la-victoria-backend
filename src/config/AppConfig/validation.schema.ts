import * as Joi from 'joi';

export const configValidationSchema = Joi.object({
  // Server
  PORT: Joi.number().default(3001).min(1).max(65535),
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('development'),

  // Database
  DATABASE_HOST: Joi.string().required(),
  DATABASE_PORT: Joi.number().default(3306).min(1).max(65535),
  DATABASE_NAME: Joi.string().required(),
  DATABASE_USER: Joi.string().required(),
  DATABASE_PASSWORD: Joi.string().required(),
  DATABASE_TIMEZONE: Joi.string().default('America/Argentina/Buenos_Aires'),

  // JWT
  JWT_SECRET: Joi.string().required().min(32),
  JWT_EXPIRES_IN: Joi.number().default(3600).min(300), // Mínimo 5 minutos

  // Cloudinary
  CLOUDINARY_NAME: Joi.string().required(),
  CLOUDINARY_API_KEY: Joi.string().required(),
  CLOUDINARY_API_SECRET: Joi.string().required(),

  // CORS
  CORS_ORIGIN: Joi.string().required(),
});
