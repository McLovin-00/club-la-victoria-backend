# Docker Compose - PostgreSQL + Adminer

Este archivo docker-compose configura PostgreSQL y Adminer para desarrollo local.

## 🚀 Inicio Rápido

```bash
# Iniciar los servicios
docker-compose up -d

# Ver logs
docker-compose logs -f

# Detener los servicios
docker-compose down

# Detener y eliminar volúmenes (⚠️ borra la base de datos)
docker-compose down -v
```

## 📦 Servicios

### PostgreSQL
- **Puerto**: 5432 (configurable vía `DB_PORT` en .env)
- **Usuario**: postgres (configurable vía `DB_USERNAME` en .env)
- **Contraseña**: postgres (configurable vía `DB_PASSWORD` en .env)
- **Base de datos**: club_la_victoria (configurable vía `DB_DATABASE` en .env)
- **Volumen**: Datos persistentes en `club_la_victoria_postgres_data`

### Adminer
- **URL**: http://localhost:8080
- **Puerto**: 8080
- **Tema**: Dracula (oscuro)

## 🔐 Acceso a Adminer

1. Abre http://localhost:8080
2. Credenciales:
   - **Sistema**: PostgreSQL
   - **Servidor**: postgres (nombre del servicio)
   - **Usuario**: postgres (o el configurado en .env)
   - **Contraseña**: postgres (o la configurada en .env)
   - **Base de datos**: club_la_victoria (o la configurada en .env)

## ⚙️ Configuración

Las variables de entorno se toman del archivo `.env` del backend. Valores por defecto:

- `DB_USERNAME=postgres`
- `DB_PASSWORD=postgres`
- `DB_DATABASE=club_la_victoria`
- `DB_PORT=5432`

## 🔧 Comandos Útiles

```bash
# Ver estado de los contenedores
docker-compose ps

# Reiniciar un servicio específico
docker-compose restart postgres

# Ver logs de un servicio específico
docker-compose logs -f postgres

# Ejecutar comando en PostgreSQL
docker-compose exec postgres psql -U postgres -d club_la_victoria

# Backup de la base de datos
docker-compose exec postgres pg_dump -U postgres club_la_victoria > backup.sql

# Restaurar backup
docker-compose exec -T postgres psql -U postgres club_la_victoria < backup.sql

# Acceder a la consola de PostgreSQL
docker-compose exec postgres bash
```

## 🗄️ Persistencia de Datos

Los datos de PostgreSQL se guardan en un volumen Docker llamado `club_la_victoria_postgres_data`. Esto significa que los datos persisten incluso si detienes o eliminas los contenedores (a menos que uses `docker-compose down -v`).

## 🌐 Red

Los servicios están conectados en una red bridge llamada `club_la_victoria_network`, lo que permite la comunicación entre contenedores.

## ✅ Health Check

PostgreSQL incluye un health check que verifica que la base de datos esté lista antes de que Adminer intente conectarse.

## 📝 Actualizar .env para PostgreSQL

Si estás migrando de MySQL a PostgreSQL, actualiza tu `.env`:

```env
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=postgres
DB_DATABASE=club_la_victoria
```
