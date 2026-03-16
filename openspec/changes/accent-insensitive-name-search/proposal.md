# Proposal: Búsqueda sensible a acentos en nombres y apellidos

## Intent

Actualmente, la búsqueda de socios, no socios y otros registros en el sistema utiliza el operador `LOWER(column) LIKE %search%`, lo que hace la búsqueda **case-insensitive** pero **NO accent-insensitive**. Esto significa que:
- La búsqueda "albónico" NO encuentra "Albónico"
- La búsqueda "agustin" NO encuentra "Agustín"

El objetivo es implementar búsqueda accent-insensitive para todos los campos de nombre y apellido en todos los endpoints de búsqueda relevantes, utilizando el operador `ILIKE` de PostgreSQL que soporta búsquedas sin considerar acentos.

## Scope

### In Scope
- Modificar `socios.repository.ts` para usar `ILIKE` en la búsqueda de nombre y apellido en el método `findPaginatedAndFiltered`
- Modificar `socios.service.ts` para usar `ILIKE` en el método `findByName` 
- Verificar y, si es necesario, modificar `cobradores.service.ts` para asegurar que la búsqueda de socios en `buscarSociosMobile` usa `ILIKE`
- Verificar y, si es necesario, modificar `estadisticas.service.ts` para asegurar que la búsqueda de socio y no socio usa `ILIKE`
- Asegurar que la búsqueda de `nombreNoSocio` y `apellidoNoSocio` en registros de ingreso también sea accent-insensitive
- Crear tests unitarios para validar la nueva funcionalidad
- Documentar el cambio en la documentación de la API

### Out of Scope
- Cambios en la normalización de nombres en el lado del cliente
- Cambios en la base de datos schema (no se requiere alterar columnas)
- Cambios en búsquedas que no involucran nombres/apellidos (ej: búsqueda por DNI, email)
- Optimizaciones adicionales (índices o procedimientos almacenados) - se evaluarán en una fase posterior si son necesarios
- Migración de datos existentes (la búsqueda funciona igual, solo se expande la coincidencia)

## Approach

Utilizar el operador `ILIKE` de PostgreSQL que permite búsquedas case-insensitive y accent-insensitive. PostgreSQL ya soporta `ILIKE` de forma nativa.

**Antes:**
```typescript
'LOWER(socio.nombre) LIKE :search OR LOWER(socio.apellido) LIKE :search'
```

**Después:**
```typescript
'(socio.nombre ILIKE :search OR socio.apellido ILIKE :search)'
```

**Ejemplo de comportamiento:**
- Buscar "albónico" → encuentra "Albónico", "ALBÓNICO", "albónico"
- Buscar "agustin" → encuentra "Agustín", "AGUSTÍN", "agustin"

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `socios/repositories/socio.repository.ts` | Modified | Método `findPaginatedAndFiltered` - cambiar `LOWER()` por `ILIKE` en WHERE clause |
| `socios/services/socios.service.ts` | Modified | Método `findByName` - cambiar `LOWER()` por `ILIKE` |
| `cobradores/services/cobradores.service.ts` | Verify/Modified | Método `buscarSociosMobile` - verificar uso de `ILIKE` |
| `estadisticas/services/estadisticas.service.ts` | Verify/Modified | Método `getDailyStatistics` - verificar uso de `ILIKE` para nombre/apellido |
| `registro-ingreso/entities/registro-ingreso.entity.ts` | N/A | Entidad con campos `nombreNoSocio` y `apellidoNoSocio` - ya usa `ILIKE` |
| `common/dto/pagination.dto.ts` | N/A | DTO compartido - no requiere cambios |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Búsqueda excesivamente amplia que retorna demasiados resultados | Low | `ILIKE` con `%search%` mantiene el comportamiento de prefijo/jerárquico (coincide si el término está al inicio o dentro del texto), similar a `LOWER() LIKE %search%` |
| Incompatibilidad con el driver TypeORM | Low | TypeORM soporta `ILIKE` directamente en su query builder |
| Errores de rendimiento en tablas con muchos registros | Medium | Se mantienen los índices existentes; se puede evaluar la creación de índices funcionales de búsqueda accent-insensitive en futuras optimizaciones |
| Cambio de comportamiento inesperado en clientes existentes | Low | El cambio expande la búsqueda, no la reduce; cualquier resultado encontrado antes seguirá encontrándose, solo se agregan más coincidencias |

## Rollback Plan

1. Deshacer los cambios en los archivos fuente
2. Revertir los commits relacionados
3. Los clientes continuarán funcionando con el comportamiento anterior (menos preciso pero funcional)

## Dependencies

- PostgreSQL 14+ (ILIKE es soportado desde PostgreSQL 8.1)
- TypeORM 0.3.26 (soporta ILIKE en query builders)
- Ninguna dependencia externa adicional

## Success Criteria

- [ ] Los tests unitarios para `findPaginatedAndFiltered` pasan
- [ ] Los tests unitarios para `findByName` pasan
- [ ] Búsqueda "albónico" encuentra "Albónico" en el endpoint GET /socios
- [ ] Búsqueda "agustin" encuentra "Agustín" en el endpoint GET /socios/buscar/nombre
- [ ] Búsqueda "albónico" encuentra "Albónico" en el endpoint de cobradores (buscarSociosMobile)
- [ ] Búsqueda "agustin" encuentra "Agustín" en el endpoint de estadísticas con searchTerm
- [ ] Búsqueda "maria" encuentra "María" en registros de ingreso (no socios)
- [ ] Los cambios no rompen los tests existentes
- [ ] Los clientes existentes continúan funcionando sin necesidad de cambios
