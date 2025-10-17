/**
 * Constantes de autenticación y seguridad
 */
export const AUTH = {
  /** Número de rondas de salt para bcrypt (más alto = más seguro pero más lento) */
  BCRYPT_SALT_ROUNDS: 10,

  /** Rate limiting global */
  RATE_LIMIT_TTL: 60000, // 1 minuto en ms
  RATE_LIMIT_MAX_REQUESTS: 200, // Máximo 20 requests por minuto

  /** Rate limiting específico para login */
  LOGIN_RATE_LIMIT_TTL: 60000, // 5 minutos en ms
  LOGIN_RATE_LIMIT_MAX_REQUESTS: 5, // Máximo 5 intentos de login por 5 minutos
} as const;
