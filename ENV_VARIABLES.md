# Variables de Entorno - Club La Victoria API

Este documento describe todas las variables de entorno utilizadas en la aplicación.

## Formato

Todas las variables deben estar definidas en el archivo `.env` en la raíz del proyecto.

**IMPORTANTE:**
- El archivo `.env` NO debe ser commiteado a Git (ya está en `.gitignore`)
- Usa `.env.example` como template para nuevos deployments
- Rota todas las credenciales antes de deployar a producción

---

## Variables Requeridas

### 1. NODE_ENV
**Descripción:** Define el entorno de ejecución de la aplicación

**Tipo:** String

**Valores permitidos:** `development`, `production`, `test`

**Valor por defecto:** `development`

**Ejemplo:**
```bash
NODE_ENV=development
```

**Notas:**
- En `production`, el endpoint `/api/auth/generarPasswordHash` se deshabilita automáticamente por seguridad
- Afecta el nivel de logging y optimizaciones de NestJS

---

### 2. PORT
**Descripción:** Puerto en el que la aplicación escuchará las peticiones HTTP

**Tipo:** Number

**Rango:** 1-65535

**Valor por defecto:** `3000`

**Ejemplo:**
```bash
PORT=3000
```

**Notas:**
- Asegúrate de que el puerto no esté en uso por otra aplicación
- En producción, generalmente se usa un proxy inverso (nginx) que redirige desde puerto 80/443

---

## Base de Datos (MySQL)

### 3. DATABASE_HOST
**Descripción:** Dirección del servidor MySQL

**Tipo:** String

**Valor por defecto:** `localhost`

**Ejemplo:**
```bash
DATABASE_HOST=localhost
# o para servidor remoto
DATABASE_HOST=192.168.1.100
```

---

### 4. DATABASE_PORT
**Descripción:** Puerto del servidor MySQL

**Tipo:** Number

**Valor por defecto:** `3306`

**Ejemplo:**
```bash
DATABASE_PORT=3306
```

---

### 5. DATABASE_NAME
**Descripción:** Nombre de la base de datos

**Tipo:** String

**Requerido:** Sí

**Ejemplo:**
```bash
DATABASE_NAME=club_la_victoria
```

**Notas:**
- La base de datos debe existir previamente
- Usar los scripts SQL en `Diagramas y utiles/` para crear la estructura

---

### 6. DATABASE_USER
**Descripción:** Usuario de MySQL

**Tipo:** String

**Requerido:** Sí

**Ejemplo:**
```bash
DATABASE_USER=root
# En producción usar un usuario específico
DATABASE_USER=club_victoria_user
```

**Seguridad:**
- En producción, NO usar `root`
- Crear un usuario específico con permisos limitados a esta base de datos únicamente

---

### 7. DATABASE_PASSWORD
**Descripción:** Contraseña del usuario de MySQL

**Tipo:** String

**Requerido:** Sí

**Ejemplo:**
```bash
DATABASE_PASSWORD=root
# En producción usar password seguro
DATABASE_PASSWORD=MyS3cur3P@ssw0rd!2024
```

**Seguridad:**
- **NUNCA** usar contraseñas débiles en producción
- Mínimo 12 caracteres con mayúsculas, minúsculas, números y símbolos
- Rotar periódicamente

---

### 8. DATABASE_TIMEZONE
**Descripción:** Timezone de la base de datos

**Tipo:** String

**Valor por defecto:** `SYSTEM`

**Ejemplo:**
```bash
DATABASE_TIMEZONE=SYSTEM
```

**Notas:**
- El valor `SYSTEM` usa el timezone del sistema operativo
- Internamente, TypeORM usa `America/Argentina/Buenos_Aires`
- Las advertencias de timezone de MySQL2 son normales y no afectan el funcionamiento

---

## Autenticación JWT

### 9. JWT_SECRET
**Descripción:** Clave secreta para firmar los tokens JWT

**Tipo:** String

**Longitud mínima:** 32 caracteres

**Requerido:** Sí

**  CRÍTICO PARA SEGURIDAD  **

**Ejemplo:**
```bash
# Generar con:
# node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
JWT_SECRET=ae1b3b7da4d3556d28829affbc9d138ae533cb6dfcacc922a3964e072e1dda8f
```

**Seguridad:**
- **NUNCA** usar secretos predecibles o cortos
- **DEBE** ser generado aleatoriamente
- **ROTAR** antes de cada deployment a producción
- Si este secret se compromete, todos los tokens quedan comprometidos

---

### 10. JWT_EXPIRES_IN
**Descripción:** Tiempo de expiración de los tokens JWT (en segundos)

**Tipo:** Number

**Valor por defecto:** `604800` (7 días)

**Ejemplo:**
```bash
# 7 días
JWT_EXPIRES_IN=604800

# 1 día
JWT_EXPIRES_IN=86400

# 1 hora
JWT_EXPIRES_IN=3600
```

**Notas:**
- Valores más bajos = más seguro pero usuarios deben re-autenticarse más seguido
- Valores más altos = más conveniente pero mayor ventana si un token es robado
- Recomendado: 7-30 días para aplicaciones internas

---

## Cloudinary (Almacenamiento de Imágenes)

### 11. CLOUDINARY_NAME
**Descripción:** Nombre de la cuenta de Cloudinary (Cloud Name)

**Tipo:** String

**Requerido:** Sí

**Ejemplo:**
```bash
CLOUDINARY_NAME=duvoj0yeh
```

**Dónde encontrarlo:**
- Dashboard de Cloudinary > Settings > Account > Cloud name

---

### 12. CLOUDINARY_API_KEY
**Descripción:** API Key de Cloudinary

**Tipo:** String

**Requerido:** Sí

**Ejemplo:**
```bash
CLOUDINARY_API_KEY=854539271269485
```

**Dónde encontrarlo:**
- Dashboard de Cloudinary > Settings > Access Keys > API Key

---

### 13. CLOUDINARY_API_SECRET
**Descripción:** API Secret de Cloudinary

**Tipo:** String

**Requerido:** Sí

**  CRÍTICO PARA SEGURIDAD  **

**Ejemplo:**
```bash
CLOUDINARY_API_SECRET=1gPxfN8Kr9GN7YAI-wXnJAyLrM8
```

**Seguridad:**
- **ROTAR** antes de cada deployment a producción
- Se puede regenerar desde el dashboard de Cloudinary
- Si se compromete, regenerar inmediatamente en Cloudinary

**Dónde encontrarlo:**
- Dashboard de Cloudinary > Settings > Access Keys > API Secret

---

## CORS (Cross-Origin Resource Sharing)

### 14. CORS_ORIGIN
**Descripción:** Origen permitido para peticiones CORS

**Tipo:** String (URL)

**Requerido:** Sí

**  CRÍTICO PARA SEGURIDAD  **

**Ejemplo:**
```bash
# Desarrollo local
CORS_ORIGIN=http://localhost:3000

# Producción
CORS_ORIGIN=https://clublavictoria.com

# Múltiples orígenes (separados por coma)
CORS_ORIGIN=https://clublavictoria.com,https://app.clublavictoria.com
```

**Seguridad:**
- **NUNCA** usar `*` (wildcard) en producción
- Solo configurar los dominios exactos que necesitan acceso
- Incluir el protocolo (`http://` o `https://`)
- No incluir barra final (`/`)

---

## Configuración de Ejemplo

### .env para Desarrollo
```bash
NODE_ENV=development
PORT=3000

DATABASE_HOST=localhost
DATABASE_PORT=3306
DATABASE_NAME=club_la_victoria
DATABASE_USER=root
DATABASE_PASSWORD=root
DATABASE_TIMEZONE=SYSTEM

JWT_SECRET=ae1b3b7da4d3556d28829affbc9d138ae533cb6dfcacc922a3964e072e1dda8f
JWT_EXPIRES_IN=604800

CLOUDINARY_NAME=duvoj0yeh
CLOUDINARY_API_KEY=854539271269485
CLOUDINARY_API_SECRET=1gPxfN8Kr9GN7YAI-wXnJAyLrM8

CORS_ORIGIN=http://localhost:3000
```

### .env para Producción
```bash
NODE_ENV=production
PORT=3000

DATABASE_HOST=db.production.server.com
DATABASE_PORT=3306
DATABASE_NAME=club_la_victoria_prod
DATABASE_USER=club_victoria_prod_user
DATABASE_PASSWORD=<STRONG_PASSWORD_HERE>
DATABASE_TIMEZONE=SYSTEM

# GENERAR NUEVO SECRET
JWT_SECRET=<GENERATE_NEW_32_CHAR_SECRET>
JWT_EXPIRES_IN=604800

# ROTAR CREDENCIALES DE CLOUDINARY
CLOUDINARY_NAME=<YOUR_CLOUDINARY_NAME>
CLOUDINARY_API_KEY=<YOUR_API_KEY>
CLOUDINARY_API_SECRET=<NEW_ROTATED_SECRET>

# DOMINIO REAL DE PRODUCCIÓN
CORS_ORIGIN=https://tudominio.com
```

---

## Checklist de Seguridad

Antes de deployar a producción, verifica:

- [ ] `NODE_ENV=production`
- [ ] `JWT_SECRET` generado aleatoriamente (32+ caracteres)
- [ ] `DATABASE_PASSWORD` es fuerte y único
- [ ] `CLOUDINARY_API_SECRET` fue rotado
- [ ] `CORS_ORIGIN` configurado con dominio específico (NO `*`)
- [ ] Archivo `.env` NO está en Git
- [ ] Todas las credenciales son diferentes de desarrollo
- [ ] Variables de entorno configuradas en el servidor de producción

---

## Troubleshooting

### Error: "Config validation error"
Verifica que todas las variables requeridas estén presentes y con el formato correcto.

### Error: "JWT_SECRET must be at least 32 characters long"
Genera un nuevo secret:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Error: "Unable to connect to database"
Verifica:
- El servidor MySQL está corriendo
- Las credenciales son correctas
- El host y puerto son accesibles
- La base de datos existe

### Error: "Cloudinary upload failed"
Verifica:
- Las credenciales de Cloudinary son correctas
- La cuenta tiene espacio disponible
- La conexión a internet es estable
- El retry logic (3 intentos) se está ejecutando
