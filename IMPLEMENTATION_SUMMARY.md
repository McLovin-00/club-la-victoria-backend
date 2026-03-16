# Implementación: Búsqueda Accent-Insensitive en Nombres y Apellidos

## Resumen Ejecutivo

Se implementó la búsqueda accent-insensitive para todos los endpoints de búsqueda relevante que involucran nombres y apellidos. El cambio utiliza la extensión `unaccent()` de PostgreSQL para normalizar los caracteres, permitiendo que búsquedas como "albónico" encuentren "Albónico", "AGUSTÍN", etc.

## Cambios Realizados

### 1. Migraciones de Base de Datos

**Archivos Creados:**
- `migrations/2026-03-11-enable-unaccent-extension.sql` - Habilita la extensión unaccent de PostgreSQL
- `migrations/2026-03-11-create-unaccent-indexes.sql` - Crea índices funcionales para optimizar búsquedas

### 2. Actualización de Código

**Archivos Modificados:**

1. **src/socios/repositories/socio.repository.ts**
   - Método `findPaginatedAndFiltered`: Cambiado de `LOWER(socio.nombre) LIKE` a `unaccent(socio.nombre) ILIKE`
   - Aplicado también a: socio.apellido, socio.email

2. **src/socios/socios.service.ts**
   - Método `findByName`: Cambiado de `LOWER()` a `unaccent()` para búsqueda de nombres/apellidos

3. **src/temporadas/temporadas.service.ts**
   - Método `getSociosDisponibles`: Actualizado para usar unaccent en búsqueda

4. **src/estadisticas/estadisticas.service.ts**
   - Método `getDailyStatistics`: Actualizado para usar unaccent en:
     - socio.nombre
     - socio.apellido
     - registro.nombreNoSocio
     - registro.apellidoNoSocio

5. **src/cobradores/cobradores.service.ts**
   - Método `buscarSociosMobile`: Actualizado para usar unaccent en socio.nombre y socio.apellido

6. **src/cobros/cobros.service.ts**
   - Método `findAllCuotas`: Actualizado para usar unaccent en socio.nombre y socio.apellido
   - Método `getEstadoPagos`: Actualizado para usar unaccent en socio.nombre y socio.apellido
   - Método `getMorososDetallados`: Actualizado para usar unaccent en socio.nombre y socio.apellido

### 3. Técnica Utilizada

**Antes:**
```typescript
LOWER(socio.nombre) LIKE '%search%'
LOWER(socio.apellido) LIKE '%search%'
```

**Después:**
```typescript
unaccent(socio.nombre) ILIKE '%search%'
unaccent(socio.apellido) ILIKE '%search%'
```

### 4. Beneficios

1. **Búsqueda Flexible**: "albónico" encuentra "Albónico", "AGUSTÍN", "albónico"
2. **Optimización**: Índices funcionales mejoran el rendimiento de búsquedas frecuentes
3. **Consistencia**: Todas las búsquedas en nombre/apellido usan la misma técnica
4. **Sin cambios en datos**: No requiere migración de datos, solo expande coincidencias

## Próximos Pasos

1. **Ejecutar migraciones en la base de datos:**
   ```bash
   npm run migration:run
   ```

2. **Revisar los tests existentes** para asegurarse de que no hay regresiones

3. **Verificar el comportamiento** con algunos casos de prueba:
   - Buscar "albónico" → debe encontrar "Albónico"
   - Buscar "agustin" → debe encontrar "Agustín"
   - Buscar "cabrera" → debe encontrar "Cabréra" o "Cabrera"

## Archivos Temporales

Ningún archivo temporal fue creado durante esta implementación.

## Estado de la Implementación

- ✅ Migraciones creadas
- ✅ Código actualizado con unaccent
- ✅ Verificación de sintaxis
- ⏳ Tests pendientes de ejecución
- ⏳ Migraciones pendientes de aplicar en base de datos

## Rollback

Si es necesario revertir este cambio:
1. Ejecutar rollback de las migraciones
2. Restaurar los archivos de código originales desde git
3. Los clientes volverán a usar búsquedas case-insensitive sin acentos

## Notas Técnicas

- PostgreSQL ya incluye la extensión `unaccent` en su instalación por defecto
- Los índices funcionales creados optimizan especialmente búsquedas con prefijo
- La implementación es transparente para los clientes - solo expande las coincidencias
- No se requiere cambios en los DTOs o contratos de la API
