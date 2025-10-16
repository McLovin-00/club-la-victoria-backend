// Constantes para mensajes y códigos de error comunes
export const ERROR_MESSAGES = {
  // Errores generales
  INTERNAL_SERVER_ERROR: 'Error interno del servidor',
  UNEXPECTED_ERROR: 'Ocurrió un error inesperado',

  // Errores de autenticación
  USER_NOT_FOUND: 'Usuario no encontrado',
  INVALID_PASSWORD: 'La contraseña ingresada es incorrecta',
  UNAUTHORIZED: 'No autorizado',
  TOKEN_INVALID: 'Token inválido o expirado',

  // Errores de validación
  VALIDATION_ERROR: 'Error en la validación de datos',
  INVALID_DNI: 'El DNI ingresado no es válido',
  DNI_ALREADY_EXISTS: 'El DNI ya se encuentra registrado',

  // Errores de recursos no encontrados
  SOCIO_NOT_FOUND: 'Socio no encontrado',
  TEMPORADA_NOT_FOUND: 'Temporada no encontrada',
  REGISTRO_NOT_FOUND: 'Registro de ingreso no encontrado',
  ASOCIACION_NOT_FOUND: 'Asociación no encontrada',

  // Errores de negocio
  SOCIO_ALREADY_REGISTERED_TODAY: 'La persona ya ingresó hoy',
  OVERLAPPING_SEASONS: 'Las fechas se solapan con otra temporada existente',
  CANNOT_DELETE_SOCIO_WITH_REGISTROS:
    'No se puede eliminar el socio porque tiene registros asociados',

  // Errores de operaciones CRUD
  ERROR_CREATING_SOCIO: 'Error al crear el socio',
  ERROR_UPDATING_SOCIO: 'Error al actualizar el socio',
  ERROR_DELETING_SOCIO: 'Error al eliminar el socio',
  ERROR_FETCHING_SOCIOS: 'Error al obtener los socios',

  ERROR_CREATING_TEMPORADA: 'Error al crear la temporada',
  ERROR_UPDATING_TEMPORADA: 'Error al actualizar la temporada',
  ERROR_DELETING_TEMPORADA: 'Error al eliminar la temporada',
  ERROR_FETCHING_TEMPORADAS: 'Error al obtener las temporadas',

  ERROR_CREATING_REGISTRO: 'Error al crear el registro de ingreso',
  ERROR_FETCHING_REGISTROS: 'Error al obtener los registros de ingreso',
  ERROR_FETCHING_REGISTRO: 'Error al obtener el registro de ingreso',

  // Errores de servicios externos
  CLOUDINARY_UPLOAD_ERROR: 'Error al subir la imagen',
  CLOUDINARY_DELETE_ERROR: 'Error al eliminar la imagen',

  // Errores de base de datos
  DB_CONSTRAINT_ERROR: 'Error de restricción en la base de datos',
  DB_CONNECTION_ERROR: 'Error de conexión con la base de datos',
  DB_UNIQUE_VIOLATION: 'El valor ya existe en la base de datos',
  DB_FOREIGN_KEY_VIOLATION: 'Error de clave foránea en la base de datos',
};

// Códigos de error para facilitar el manejo en el frontend
export const ERROR_CODES = {
  // Generales
  INTERNAL_SERVER_ERROR: 'ERR_INTERNAL_SERVER',
  UNEXPECTED_ERROR: 'ERR_UNEXPECTED',

  // Autenticación
  USER_NOT_FOUND: 'ERR_USER_NOT_FOUND',
  INVALID_PASSWORD: 'ERR_INVALID_PASSWORD',
  UNAUTHORIZED: 'ERR_UNAUTHORIZED',
  TOKEN_INVALID: 'ERR_TOKEN_INVALID',

  // Validación
  VALIDATION_ERROR: 'ERR_VALIDATION',
  INVALID_DNI: 'ERR_INVALID_DNI',
  DNI_ALREADY_EXISTS: 'ERR_DNI_EXISTS',

  // Recursos no encontrados
  SOCIO_NOT_FOUND: 'ERR_SOCIO_NOT_FOUND',
  TEMPORADA_NOT_FOUND: 'ERR_TEMPORADA_NOT_FOUND',
  REGISTRO_NOT_FOUND: 'ERR_REGISTRO_NOT_FOUND',
  ASOCIACION_NOT_FOUND: 'ERR_ASOCIACION_NOT_FOUND',

  // Negocio
  SOCIO_ALREADY_REGISTERED_TODAY: 'ERR_ALREADY_REGISTERED_TODAY',
  OVERLAPPING_SEASONS: 'ERR_OVERLAPPING_SEASONS',
  CANNOT_DELETE_SOCIO: 'ERR_CANNOT_DELETE_SOCIO',

  // Base de datos
  DB_CONSTRAINT_ERROR: 'ERR_DB_CONSTRAINT',
  DB_CONNECTION_ERROR: 'ERR_DB_CONNECTION',
  DB_UNIQUE_VIOLATION: 'ERR_DB_UNIQUE',
  DB_FOREIGN_KEY_VIOLATION: 'ERR_DB_FOREIGN_KEY',
};
