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

  // Errores de categorías y cobros
  CATEGORIA_NOT_FOUND: 'Categoría no encontrada',
  CATEGORIA_NAME_EXISTS: 'Ya existe una categoría con ese nombre',
  CATEGORIA_IN_USE:
    'No se puede eliminar la categoría porque tiene socios asociados',
  ERROR_CREATING_CATEGORIA: 'Error al crear la categoría',
  ERROR_UPDATING_CATEGORIA: 'Error al actualizar la categoría',

  // Errores de cobros
  CUOTA_NOT_FOUND: 'Cuota no encontrada',
  CUOTA_YA_PAGADA: 'La cuota ya está pagada',
  CUOTA_YA_EXISTE: 'Ya existe una cuota para este socio en el período',
  BARCODE_INVALID: 'Código de barras inválido',
  ERROR_CREATING_CUOTA: 'Error al crear la cuota',
  ERROR_REGISTRANDO_PAGO: 'Error al registrar el pago',
  ERROR_GENERANDO_CUOTAS: 'Error al generar las cuotas',
  NO_CUOTAS_PENDIENTES: 'No hay cuotas pendientes para el período',

  // Errores de notificaciones
  NOTIFICACION_NOT_FOUND: 'Notificación no encontrada',
  ERROR_CREATING_NOTIFICACION: 'Error al crear la notificación',

  // Errores de grupos familiares
  GRUPO_FAMILIAR_NOT_FOUND: 'Grupo familiar no encontrado',
  GRUPO_FAMILIAR_NAME_EXISTS: 'Ya existe un grupo familiar con ese nombre',
  ERROR_CREATING_GRUPO_FAMILIAR: 'Error al crear el grupo familiar',
  ERROR_UPDATING_GRUPO_FAMILIAR: 'Error al actualizar el grupo familiar',
  ERROR_DELETING_GRUPO_FAMILIAR: 'Error al eliminar el grupo familiar',
  SOCIO_IDS_INVALIDOS: 'Uno o más IDs de socio no son válidos',
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
  // Categorías y cobros
  CATEGORIA_NOT_FOUND: 'ERR_CATEGORIA_NOT_FOUND',
  CATEGORIA_NAME_EXISTS: 'ERR_CATEGORIA_NAME_EXISTS',
  CATEGORIA_IN_USE: 'ERR_CATEGORIA_IN_USE',
  ERROR_CREATING_CATEGORIA: 'ERR_CREATING_CATEGORIA',
  ERROR_UPDATING_CATEGORIA: 'ERR_UPDATING_CATEGORIA',

  CUOTA_NOT_FOUND: 'ERR_CUOTA_NOT_FOUND',
  CUOTA_YA_PAGADA: 'ERR_CUOTA_YA_PAGADA',
  CUOTA_YA_EXISTE: 'ERR_CUOTA_YA_EXISTE',
  BARCODE_INVALID: 'ERR_BARCODE_INVALID',
  ERROR_CREATING_CUOTA: 'ERR_CREATING_CUOTA',
  ERROR_REGISTRANDO_PAGO: 'ERR_REGISTRANDO_PAGO',
  ERROR_GENERANDO_CUOTAS: 'ERR_GENERANDO_CUOTAS',
  NO_CUOTAS_PENDIENTES: 'ERR_NO_CUOTAS_PENDIENTES',

  NOTIFICACION_NOT_FOUND: 'ERR_NOTIFICACION_NOT_FOUND',
  ERROR_CREATING_NOTIFICACION: 'ERR_CREATING_NOTIFICACION',

  // Grupos familiares
  GRUPO_FAMILIAR_NOT_FOUND: 'ERR_GRUPO_FAMILIAR_NOT_FOUND',
  GRUPO_FAMILIAR_NAME_EXISTS: 'ERR_GRUPO_FAMILIAR_NAME_EXISTS',
  ERROR_CREATING_GRUPO_FAMILIAR: 'ERR_CREATING_GRUPO_FAMILIAR',
  ERROR_UPDATING_GRUPO_FAMILIAR: 'ERR_UPDATING_GRUPO_FAMILIAR',
  ERROR_DELETING_GRUPO_FAMILIAR: 'ERR_DELETING_GRUPO_FAMILIAR',
  SOCIO_IDS_INVALIDOS: 'ERR_SOCIO_IDS_INVALIDOS',

  // Base de datos
  DB_CONSTRAINT_ERROR: 'ERR_DB_CONSTRAINT',
  DB_CONNECTION_ERROR: 'ERR_DB_CONNECTION',
  DB_UNIQUE_VIOLATION: 'ERR_DB_UNIQUE',
  DB_FOREIGN_KEY_VIOLATION: 'ERR_DB_FOREIGN_KEY',
};
