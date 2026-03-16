# Especificación: Búsqueda de Nombres Insensible a Acentos

## Propósito
Implementar búsqueda de nombres y apellidos insensible a acentos en todos los flujos de búsqueda del backend que consultan por nombre o apellido.

## Áreas Afectadas
- Socios
- Temporadas  
- Estadísticas
- Cobros
- Cobradores
- Registro de Ingreso

## Requisitos
### RQ-1: Búsqueda Insensible a Acentos
Debe/MUST: La búsqueda de socios por nombre o apellido debe ser insensible a acentos, permitiendo encontrar socios independientemente de la presencia o ausencia de acentos en las palabras.

#### Escenario 1: Búsqueda simple con acento vs sin acento
- GIVEN un socio con nombre "María González"
- WHEN se realiza una búsqueda con "Maria González"
- THEN el sistema debe encontrar al socio
- AND debe ignorar la diferencia en acentos

#### Escenario 2: Búsqueda con múltiples palabras y acentos
- GIVEN un socio con nombre "Alejandro Cabrera"
- WHEN se realiza una búsqueda con "ale cabrera"
- THEN el sistema debe encontrar al socio
- AND debe ser insensible a mayúsculas/minúsculas
- AND debe ser insensible a acentos

### RQ-2: Soporte de Búsqueda Multi-Word
Debe/MUST: La búsqueda debe soportar múltiples palabras (ej: "cabrera ale" debe encontrar "Alejandro Cabrera").

#### Escenario 5: Búsqueda de dos palabras
- GIVEN un socio con nombre "Alejandro Cabrera"
- WHEN se realiza una búsqueda con "cabrera ale"
- THEN el sistema debe encontrar al socio
- AND ambas palabras deben coincidir (OR logic)

### RQ-3: Búsqueda de No-Socios
Debe/MUST: Los registros de ingreso de personas externas deben ser buscables por nombre sin acentos.

#### Escenario 9: Búsqueda de no-socio sin acentos
- GIVEN un registro de ingreso con nombreNoSocio "Luciana Rossi"
- WHEN se realiza una búsqueda con "luciana rossi"
- THEN el sistema debe encontrar el registro
- AND debe ser insensible a acentos

## Flujos Específicos

### FLUJO-1: Listado de Socios con Búsqueda (GET /api/v1/socios)
Ubicación: socios.repository.ts:28
Consulta actual: `(LOWER(socio.nombre) LIKE :search OR LOWER(socio.apellido) LIKE :search OR socio.dni LIKE :search OR LOWER(socio.email) LIKE :search)`

Requerimientos adicionales:
- Soporte multi-word (separar por espacio, OR logic por palabra)
- Sin límite de resultados (paginación manejada por caller)
- Ordenar por apellido ASC, luego nombre ASC

### FLUJO-2: Búsqueda Rápida por Nombre (GET /api/v1/socios/buscar/nombre)
Ubicación: socios.service.ts:303-340
Consulta actual: ``(LOWER(socio.nombre) LIKE :${paramName} OR LOWER(socio.apellido) LIKE :${paramName})``

Requerimientos adicionales:
- Solo socios ACTIVOS
- Multi-word con OR logic
- Máximo 10 resultados
- Ordenar por apellido ASC, luego nombre ASC

### FLUJO-3: Temporadas - Socios Disponibles
Ubicación: temporadas.service.ts:220
Consulta actual: `(LOWER(socio.nombre) LIKE LOWER(:search) OR LOWER(socio.apellido) LIKE LOWER(:search) OR socio.dni LIKE :search OR LOWER(socio.email) LIKE LOWER(:search))`

Requerimientos adicionales:
- Multi-word con OR logic
- Sin límite (paginación manejada)
- Ordenar por apellido ASC, luego nombre ASC

### FLUJO-4: Estadísticas Diarias
Ubicación: estadisticas.service.ts:45
Consulta actual: `(socio.nombre ILIKE :term OR socio.apellido ILIKE :term) OR (socio.id IS NULL AND (registro.nombreNoSocio ILIKE :term OR registro.apellidoNoSocio ILIKE :term))`

Requerimientos adicionales:
- Multi-word con OR logic
- Insensible a mayúsculas/minúsculas (ILIKE ya es case-insensitive en PostgreSQL)
- Multi-word en nombreNoSocio y apellidoNoSocio
- Insensitive a acentos requerido

### FLUJO-5: Cobros - Morosos Detallados
Ubicación: cobros.service.ts:1714
Consulta actual: `(socio.nombre LIKE :busqueda OR socio.apellido LIKE :busqueda OR socio.dni LIKE :busqueda)`

Requerimientos adicionales:
- Multi-word con OR logic
- Insensible a mayúsculas (añadir LOWER())
- Insensitive a acentos

### FLUJO-6: Cobros - Listar por Periodo
Ubicación: cobros.service.ts:1935-1936
Requerimientos adicionales:
- Multi-word con OR logic
- Insensible a mayúsculas (añadir LOWER())
- Insensitive a acentos

### FLUJO-7: Cobros - Listar Pagables
Ubicación: cobros.service.ts:2168
Requerimientos adicionales:
- Multi-word con OR logic
- Insensible a mayúsculas (añadir LOWER())
- Insensitive a acentos

### FLUJO-8: Cobros - Chequear Socio Existente
Ubicación: cobros.service.ts:2273
Requerimientos adicionales:
- Multi-word con OR logic
- Insensible a mayúsculas (añadir LOWER())
- Insensitive a acentos
- Return solo booleano (exists)

### FLUJO-9: Cobradores - Búsqueda Mobile
Ubicación: cobradores.service.ts:373
Requerimientos adicionales:
- Multi-word con OR logic
- Límite de 50 resultados
- SOLO socios ACTIVO y MOROSO
- Insensitive a acentos (ILIKE ya es case-insensitive)

## No-Functional Requirements

### NFR-1: Rendimiento
Debe/MUST: La implementación debe mantener el rendimiento actual. No degradar el tiempo de respuesta por más de 20%.

Métricas:
- Búsqueda simple: < 100ms (sin índice)
- Búsqueda multi-word: < 150ms (sin índice)

### NFR-2: Compatibilidad Base de Datos
Debe/MUST: La solución debe ser compatible con MySQL (usado actualmente).

No usar PostgreSQL ILIKE. Usar LOWER() + LIKE para case-insensitive.

### NFR-3: Transversalidad
Debe/MUST: Una implementación centralizada debe ser reutilizable en todos los flujos.

Crear función SQL o utilidad en TypeScript para normalización de acentos.

### NFR-4: Backward Compatibility
Debe/MUST: La búsqueda debe seguir funcionando igual en casos que ya funcionan.

## Exclusiones

### EXC-1: Autocompletado Sencillo (Categorías Socio)
Excluido: categorias-socio.service.ts:63
Razón: Es una búsqueda exacta por nombre de categoría, no por nombre/apellido de socio.

### EXC-2: Asociaciones (Socio-Temporada)
Excluido: asociaciones.repository.ts
Razón: Sin queries de búsqueda por nombre/apellido.

### EXC-3: Registro Ingreso por DNI
Excluido: registro-ingreso.controller.ts:157
Razón: La búsqueda es por DNI, no por nombre/apellido.

## Estrategia de Implementación

Paso 1: Crear src/common/utils/normalization.util.ts



Paso 2-6: Actualizar 6 archivos con multi-word OR logic y normalización de acentos

Referencias:
- MySQL LOWER() para case-insensitive
- Unicode NFD Decomposition para acentos
- RFC 2119 keywords (MUST/SHALL/SHOULD/MAY)

**Versión**: 1.0
**Fecha**: 2026-03-11
**Autor**: SDD Sub-agent