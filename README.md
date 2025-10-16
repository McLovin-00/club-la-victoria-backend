# Club La Victoria - Backend API

API REST para el sistema de gestión de ingresos del Club La Victoria. Permite gestionar socios, temporadas de pileta, registros de ingreso y estadísticas.

## Tecnologías

- **NestJS** - Framework Node.js progresivo
- **TypeScript** - Lenguaje de programación tipado
- **TypeORM** - ORM para manejo de base de datos
- **MySQL** - Base de datos relacional
- **JWT** - Autenticación basada en tokens
- **Cloudinary** - Almacenamiento de imágenes en la nube
- **Socket.IO** - Comunicación en tiempo real vía WebSockets
- **Swagger** - Documentación de API

## Características de Seguridad

✅ **Autenticación JWT** con rate limiting específico (5 intentos cada 5 minutos)
✅ **Rate limiting global** (20 requests por minuto)
✅ **Validación de archivos** con Sharp (mimetype, tamaño, verificación de contenido real)
✅ **CORS configurado** con origen específico
✅ **WebSocket protegido** con autenticación JWT
✅ **Helmet** para headers de seguridad HTTP
✅ **Compresión gzip** habilitada
✅ **Request ID tracking** para trazabilidad
✅ **Retry logic** para uploads a Cloudinary (3 intentos)

## Prerequisitos

- Node.js >= 18.x
- MySQL >= 8.x
- npm o pnpm

## Instalación

1. Clonar el repositorio:
```bash
git clone <repository-url>
cd backend
```

2. Instalar dependencias:
```bash
npm install
```

3. Configurar variables de entorno (ver sección de Variables de Entorno):
```bash
cp .env.example .env
# Editar .env con tus credenciales
```

4. Crear la base de datos:
```bash
# Usar los scripts SQL en la carpeta "Diagramas y utiles/"
mysql -u root -p < "Diagramas y utiles/Estructura DB(MySql).sql"
mysql -u root -p < "Diagramas y utiles/Registros DB(MySql).sql"
```

## Ejecutar la aplicación

```bash
# Desarrollo con hot-reload
npm run dev

# Modo desarrollo
npm run start

# Modo producción
npm run start:prod
```

La API estará disponible en `http://localhost:3000/api`

## Documentación de API (Swagger)

Una vez iniciada la aplicación, accede a la documentación interactiva de Swagger:

```
http://localhost:3000/api/docs
```

Aquí encontrarás:
- Listado completo de todos los endpoints
- Descripción de cada endpoint
- Parámetros requeridos y opcionales
- Ejemplos de requests y responses
- Posibilidad de probar los endpoints directamente

## Variables de Entorno

Consulta el archivo `ENV_VARIABLES.md` para documentación completa de todas las variables de entorno.

### Variables Críticas para Producción

**IMPORTANTE:** Antes de desplegar a producción, DEBES cambiar estas variables:

```bash
# Generar nuevo JWT_SECRET (mínimo 32 caracteres)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Variables a actualizar:
NODE_ENV=production
JWT_SECRET=<tu-secret-generado>
DATABASE_PASSWORD=<tu-password-seguro>
CLOUDINARY_API_SECRET=<tu-api-secret-rotado>
CORS_ORIGIN=https://tudominio.com
```

## Estructura del Proyecto

```
src/
├── auth/                   # Módulo de autenticación
│   ├── guards/            # Guards de autenticación
│   ├── dto/               # DTOs de login
│   └── entities/          # Entidad Usuario
├── socios/                # Módulo de gestión de socios
├── temporadas/            # Módulo de temporadas de pileta
├── registro-ingreso/      # Módulo de registros de ingreso
│   └── registro-ingreso.gateway.ts  # WebSocket para tiempo real
├── estadisticas/          # Módulo de estadísticas
├── cloudinary/            # Servicio de almacenamiento de imágenes
├── common/                # Recursos compartidos
│   ├── decorators/        # Decoradores personalizados
│   ├── filters/           # Filtros de excepciones
│   ├── pipes/             # Pipes de validación
│   └── middleware/        # Middlewares (Request ID)
├── config/                # Configuración de la aplicación
└── constants/             # Constantes globales
```

## Endpoints Principales

### Autenticación
- `POST /api/v1/auth/login` - Iniciar sesión (rate limit: 5 intentos/5min)
- `POST /api/v1/auth/generarPasswordHash` - Generar hash de password (protegido, solo desarrollo)

### Socios
- `GET /api/v1/socios` - Listar socios (paginado, con búsqueda)
- `POST /api/v1/socios` - Crear socio (con upload de foto)
- `PUT /api/v1/socios/:id` - Actualizar socio
- `DELETE /api/v1/socios/:id` - Eliminar socio
- `GET /api/v1/socios/registro/:dni` - Buscar socio por DNI para registro

### Temporadas
- `GET /api/v1/temporadas` - Listar temporadas
- `POST /api/v1/temporadas` - Crear temporada
- `GET /api/v1/temporadas/:id/socios` - Obtener socios de una temporada
- `POST /api/v1/temporadas/:id/socios` - Agregar socio a temporada
- `GET /api/v1/temporadas/:id/socios-disponibles` - Socios disponibles para agregar

### Registro de Ingresos
- `POST /api/v1/registro-ingreso` - Crear registro de ingreso (protegido)
- `GET /api/v1/registro-ingreso` - Listar registros (paginado)
- `GET /api/v1/registro-ingreso/:id` - Obtener registro por ID
- `GET /api/v1/registro-ingreso/dni/:dni` - Registros por DNI
- `GET /api/v1/registro-ingreso/fecha/:inicio/:fin` - Registros por rango de fechas

### Estadísticas
- `GET /api/v1/statistics` - Obtener estadísticas generales

### WebSocket (Real-time)
- **Namespace:** `/registro-ingreso`
- **Autenticación:** JWT requerido en handshake
- **Eventos:**
  - `pileta:registros` - Recibe lista de registros de pileta del día
  - `pileta:nuevo` - Recibe notificación de nuevo registro
  - `getRegistrosPiletaHoy` - Solicitar registros actuales

## Deployment a Producción

### Checklist Pre-Deployment

- [ ] Rotar todas las credenciales (JWT_SECRET, Cloudinary, DB password)
- [ ] Configurar `NODE_ENV=production`
- [ ] Configurar `CORS_ORIGIN` con dominio de producción
- [ ] Verificar que `.env` NO esté en Git
- [ ] Configurar base de datos de producción
- [ ] Ejecutar `npm run build` y verificar que no haya errores
- [ ] Configurar SSL/TLS
- [ ] Configurar variables de entorno en el servidor
- [ ] Configurar proceso de monitoreo (PM2, Docker, etc.)

### Deployment con PM2

```bash
# Instalar PM2 globalmente
npm install -g pm2

# Compilar la aplicación
npm run build

# Iniciar con PM2
pm2 start dist/main.js --name "club-victoria-api"

# Configurar inicio automático
pm2 startup
pm2 save
```

### Deployment con Docker

```dockerfile
# Dockerfile de ejemplo
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY dist ./dist
EXPOSE 3000
CMD ["node", "dist/main.js"]
```

```bash
# Build y run
docker build -t club-victoria-api .
docker run -p 3000:3000 --env-file .env club-victoria-api
```

## Seguridad en Producción

1. **NUNCA** commits el archivo `.env` a Git
2. **Rotar credenciales** antes del deployment
3. **Usar HTTPS** en producción (SSL/TLS)
4. **Configurar firewall** para permitir solo puertos necesarios
5. **Mantener dependencias actualizadas**: `npm audit fix`
6. **Monitorear logs** para detectar actividad sospechosa
7. **Configurar backups** automáticos de la base de datos
8. **Implementar monitoring** (Sentry, New Relic, etc.)

## Troubleshooting

### Error: "Config validation error: JWT_SECRET length must be at least 32 characters"
Genera un nuevo JWT_SECRET con el comando:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Error: "EADDRINUSE: address already in use"
El puerto ya está en uso. Cambia el puerto en `.env` o mata el proceso:
```bash
# Windows
netstat -ano | findstr :3000
taskkill /PID <PID> /F

# Linux/Mac
lsof -ti:3000 | xargs kill
```

### Timezone warnings en MySQL
Estas advertencias son normales y no afectan el funcionamiento. TypeORM maneja internamente el timezone de Argentina/Buenos Aires.

## Soporte

Para reportar bugs o solicitar features, crea un issue en el repositorio.

## Licencia

Propietario - Club La Victoria
