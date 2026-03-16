# Design: Búsqueda sensible a acentos en nombres y apellidos (accent-insensitive name search)

## Technical Approach

La solución utiliza el operador `ILIKE` combinado con la función `unaccent()` de PostgreSQL para implementar búsqueda accent-insensitive. PostgreSQL provee `unaccent()` como parte del extension `unaccent` que elimina diacríticos de caracteres (acentos, tildes, diéresis), permitiendo que "albónico" coincida con "Albónico", "albónico", "AlBÓNICO", etc.

**Estrategia:**
1. Habilitar el extension `unaccent` en la base de datos mediante migración
2. Modificar todos los query builders que realizan búsquedas de nombre/apellido para usar `unaccent(column) ILIKE %search%`
3. Crear índices funcionales opcionales para optimizar las búsquedas
4. Agregar tests unitarios que verifiquen el comportamiento accent-insensitive

El cambio no requiere migración de datos ya que expande las coincidencias existentes sin eliminar ninguna.

## Architecture Decisions

### Decision 1: Usar `unaccent()` extension de PostgreSQL

**Choice**: Habilitar el extension `unaccent` de PostgreSQL y usar la función `unaccent(column) ILIKE %search%` para las búsquedas.

**Alternatives considered:**
- A) Normalizar datos antes de insertar: Usar `trim(), toLowerCase(), unaccent()` en el lado del cliente o en cada insert/actualización.
  - **Rechazado**: Complejo de implementar, requiere cambios en múltiples repositorios, afecta rendimiento de escritura.
- B) Usar búsqueda de expresiones regulares con normalización: `REGEXP_LIKE(column, unaccent(:search), 'i')`.
  - **Rechazado**: `REGEXP_LIKE` es más lento que `ILIKE` y menos legible.
- C) Usar transcodificación PostgreSQL: `encode(unaccent(column::bytea), 'escape')`.
  - **Rechazado**: Complejo y menos eficiente que `unaccent()`.

**Rationale:**
- `unaccent()` es específica para normalización de acentos y está optimizada
- `ILIKE` es más rápido que `LIKE` con `LOWER()`
- El extension `unaccent` ya viene instalado en PostgreSQL (requiere solo `CREATE EXTENSION`)
- No requiere cambios en el schema de datos, solo en queries
- Los índices funcionales pueden ser creados para optimización

### Decision 2: Usar `unaccent()` en el lado del servidor (DB)

**Choice**: Aplicar `unaccent()` en las consultas SQL, no normalizar los datos en el ORM o en el cliente.

**Alternatives considered:**
- A) Normalizar en TypeORM: Usar `QueryBuilder.raw()` o `where('unaccent(nombre) ILIKE ...')`
  - **Seleccionado** (similar a esta opción pero explícito)
- B) Normalizar en el service: Convertir el término de búsqueda a una versión sin acentos antes de construir la query.
  - **Rechazado**: No cumple con el criterio "en todas las búsquedas", y añade lógica innecesaria.

**Rationale:**
- Centraliza la lógica de normalización en una sola capa (database queries)
- Facilita la creación de índices funcionales para optimización
- Si en el futuro se añaden nuevos endpoints de búsqueda, ya están usando la función correcta
- Los tests pueden verificar el comportamiento directamente en la query

### Decision 3: Crear índices funcionales para optimización

**Choice**: Crear índices funcionales `CREATE INDEX ... ON socio ((unaccent(nombre)), (unaccent(apellido)))` para optimizar búsquedas con prefijo o inicio de palabra.

**Alternatives considered:**
- A) No crear índices: Dejar que PostgreSQL use índices B-tree existentes.
  - **Rechazado**: Las búsquedas con `LIKE %search%` no pueden usar índices B-tree directamente; `unaccent()` crea overhead.
- B) Crear índices GIN para búsqueda de texto completo: `CREATE INDEX ... USING GIN (unaccent(nombre))`
  - **Rechazado**: Overhead innecesario para un uso específico; B-tree es más simple y eficiente para este caso.
- C) Crear múltiples índices individuales por campo: `CREATE INDEX ... ON socio ((unaccent(nombre)))`
  - **Seleccionado** (combinación de ambos): Un índice compuesto para búsquedas compuestas (nombre/apellido), e índices individuales para búsqueda por DNI/email.

**Rationale:**
- Los índices funcionales con `unaccent()` permiten búsquedas eficientes en columnas de texto
- Un índice compuesto en (unaccent(nombre), unaccent(apellido)) optimiza combinaciones de ambos campos
- Si es necesario, se pueden crear índices individuales por campo para casos especiales
- El overhead de actualizar los índices es mínimo (solo en writes)
- Mejora drásticamente el rendimiento de búsquedas con muchos registros

## Data Flow

```
[Client Search Request]
      ↓
[Service/Controller Layer]
      ↓
[Query Builder with unaccent()]
      ↓
[PostgreSQL unaccent() Extension]
      ↓
[unaccent(nombre) ILIKE '%search%']
      ↓
[Index Scan if functional index exists]
      ↓
[Query Results]
      ↓
[Response]
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `src/socios/repositories/socio.repository.ts` | Modify | Cambiar `LOWER(socio.nombre) LIKE` a `unaccent(socio.nombre) ILIKE` en método `findPaginatedAndFiltered` |
| `src/socios/socios.service.ts` | Modify | Cambiar `LOWER(socio.nombre) LIKE` a `unaccent(socio.nombre) ILIKE` en método `findByName` |
| `src/cobradores/cobradores.service.ts` | Verify | Verificar que `buscarSociosMobile` ya usa `ILIKE` (no requiere cambios) |
| `src/estadisticas/estadisticas.service.ts` | Verify | Verificar que ya usa `ILIKE` (no requiere cambios) |
| `migrations/2026-03-11-enable-unaccent-extension.sql` | Create | Habilitar el extension `unaccent` en PostgreSQL |
| `migrations/2026-03-11-create-unaccent-indexes.sql` | Create | Crear índices funcionales para optimización |
| `src/socios/__tests__/socios.service.spec.ts` | Add Tests | Agregar tests unitarios para verificar búsqueda accent-insensitive |

## Interfaces / Contracts

### DTOs existentes (sin cambios)

Los DTOs de búsqueda (`PaginationDto`, etc.) no requieren cambios ya que no contienen lógica de búsqueda:

```typescript
// src/common/dto/pagination.dto.ts
export class PaginationDto {
  page?: number;
  limit?: number;
  search?: string;
}

// Uso existente:
service.findAll({
  page: 1,
  limit: 10,
  search: 'agustin'  // Ahora encontrará "Agustín" también
});
```

### Service Methods (con cambios en queries)

**SocioRepository.findPaginatedAndFiltered**:

```typescript
// Antes:
if (search) {
  query.andWhere(
    '(LOWER(socio.nombre) LIKE :search OR LOWER(socio.apellido) LIKE :search OR socio.dni LIKE :search OR LOWER(socio.email) LIKE :search)',
    { search: `%${search.toLowerCase()}%` },
  );
}

// Después:
if (search) {
  const normalizedSearch = `%${search}%`;
  query.andWhere(
    '(unaccent(socio.nombre) ILIKE :search OR unaccent(socio.apellido) ILIKE :search OR socio.dni ILIKE :search OR unaccent(socio.email) ILIKE :search)',
    { search: normalizedSearch },
  );
}
```

**SociosService.findByName**:

```typescript
// Antes:
words.forEach((word, index) => {
  const paramName = `word${index}`;
  qb.andWhere(
    `(LOWER(socio.nombre) LIKE :${paramName} OR LOWER(socio.apellido) LIKE :${paramName})`,
    { [paramName]: `%${word}%` },
  );
});

// Después:
words.forEach((word, index) => {
  const paramName = `word${index}`;
  qb.andWhere(
    `(unaccent(socio.nombre) ILIKE :${paramName} OR unaccent(socio.apellido) ILIKE :${paramName})`,
    { [paramName]: `%${word}%` },
  );
});
```

**CobradoresService.buscarSociosMobile** (ya usa ILIKE):

```typescript
// Ya está usando ILIKE correctamente (sin cambios necesarios):
queryBuilder.andWhere(
  'socio.nombre ILIKE :term OR socio.apellido ILIKE :term OR socio.dni ILIKE :term',
  { term: `%${term}%` },
);
```

**EstadisticasService.getDailyStatistics** (ya usa ILIKE):

```typescript
// Ya está usando ILIKE correctamente (sin cambios necesarios):
queryBuilder.andWhere(
  '(socio.id IS NOT NULL AND (socio.nombre ILIKE :term OR socio.apellido ILIKE :term)) OR ' +
    '(socio.id IS NULL AND (registro.nombreNoSocio ILIKE :term OR registro.apellidoNoSocio ILIKE :term))',
  { term: `%${words[0]}%` },
);
```

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|-------
