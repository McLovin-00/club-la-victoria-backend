# Guía: Conexión SSH a VPS y Backup de PostgreSQL

## Descripción
Guía para que la IA se conecte por SSH a una VPS con Ubuntu, realice un backup de la base de datos PostgreSQL, guarde una copia en la VPS y transfiera otra copia al escritorio de tu PC local.

## Requisitos Previos
- Conexión SSH configurada con la VPS
- Usuario con permisos de acceso a PostgreSQL
- Contraseña o clave SSH configurada
- `scp` disponible en tu sistema local (viene con OpenSSH)

---

## 1. Conexión por SSH a la VPS

### Comando básico de conexión:
```bash
ssh usuario@ip-de-la-vps
```

### Con clave SSH:
```bash
ssh -i /ruta/a/clave_privada usuario@ip-de-la-vps
```

### Con puerto específico (si no es el puerto 22):
```bash
ssh -p puerto usuario@ip-de-la-vps
```

**Ejemplo:**
```bash
ssh ubuntu@192.168.1.100
# o con clave
ssh -i ~/.ssh/vps-key.pem ubuntu@192.168.1.100
```

### Variables que necesitarás conocer:
- `USUARIO_VPS`: Usuario de la VPS (ej: ubuntu, root, tu-usuario)
- `IP_VPS`: Dirección IP o dominio de la VPS
- `PUERTO_SSH`: Puerto SSH (por defecto 22)
- `RUTA_CLAVE`: Ruta a tu clave privada SSH (si usas autenticación por clave)
- `PASSWORD_VPS`: Contraseña de la VPS (si usas autenticación por contraseña)

---

## 2. Backup de PostgreSQL

### 2.1 Variables de la base de datos
- `DB_NAME`: Nombre de la base de datos
- `DB_USER`: Usuario de PostgreSQL
- `DB_PASSWORD`: Contraseña del usuario de PostgreSQL
- `DB_HOST`: Host de PostgreSQL (por defecto localhost si está en la misma VPS)
- `DB_PORT`: Puerto de PostgreSQL (por defecto 5432)

### 2.2 Crear backup en la VPS

#### Opción A: Usar pg_dump (completo y recomendado)

```bash
# Crear directorio para backups si no existe
mkdir -p /backups/postgres

# Crear backup con fecha y hora
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="/backups/postgres/db_backup_${TIMESTAMP}.sql"

pg_dump -h ${DB_HOST} -U ${DB_USER} -d ${DB_NAME} > ${BACKUP_FILE}

# O en formato comprimido (más eficiente)
pg_dump -h ${DB_HOST} -U ${DB_USER} -d ${DB_NAME} | gzip > ${BACKUP_FILE}.gz
```

#### Opción B: Usar pg_dump con contraseña en línea de comando (no seguro)
```bash
PGPASSWORD=${DB_PASSWORD} pg_dump -h ${DB_HOST} -U ${DB_USER} -d ${DB_NAME} > ${BACKUP_FILE}
```

#### Opción C: Usar archivo de configuración de PostgreSQL (~/.pgpass)
```bash
# Crear archivo ~/.pgpass si no existe
echo "${DB_HOST}:${DB_PORT}:${DB_NAME}:${DB_USER}:${DB_PASSWORD}" > ~/.pgpass
chmod 600 ~/.pgpass

# Ahora puedes ejecutar pg_dump sin contraseña
pg_dump -h ${DB_HOST} -U ${DB_USER} -d ${DB_NAME} > ${BACKUP_FILE}
```

### 2.3 Verificar que el backup se creó correctamente
```bash
ls -lh /backups/postgres/
# Ver contenido del backup (primeras líneas)
head -n 50 /backups/postgres/db_backup_*.sql
```

---

## 3. Copiar el backup al escritorio de tu PC

### 3.1 Variables locales
- `USUARIO_LOCAL`: Tu nombre de usuario en tu PC
- `RUTA_ESCRITORIO`: Ruta al escritorio en tu PC
  - Windows: `C:/Users/${USUARIO_LOCAL}/Desktop`
  - Linux/Mac: `/home/${USUARIO_LOCAL}/Desktop` o `/Users/${USUARIO_LOCAL}/Desktop`

### 3.2 Copiar usando scp

#### Copiar archivo SQL:
```bash
scp usuario@ip-de-la-vps:/backups/postgres/db_backup_*.sql "${RUTA_ESCRITORIO}/"
```

#### Copiar archivo comprimido (.gz):
```bash
scp usuario@ip-de-la-vps:/backups/postgres/db_backup_*.sql.gz "${RUTA_ESCRITORIO}/"
```

#### Con puerto específico:
```bash
scp -P puerto usuario@ip-de-la-vps:/backups/postgres/db_backup_*.sql "${RUTA_ESCRITORIO}/"
```

#### Con clave SSH:
```bash
scp -i /ruta/a/clave_privada usuario@ip-de-la-vps:/backups/postgres/db_backup_*.sql "${RUTA_ESCRITORIO}/"
```

**Ejemplo completo:**
```bash
scp -i ~/.ssh/vps-key.pem ubuntu@192.168.1.100:/backups/postgres/db_backup_20250129_111200.sql "C:/Users/tu_usuario/Desktop/"
```

---

## 4. Script Completo Automatizado

### Opción A: Ejecutar todo desde tu PC local (recomendado)

```bash
#!/bin/bash

# ================== CONFIGURACIÓN ==================
# VPS
USUARIO_VPS="ubuntu"
IP_VPS="192.168.1.100"
PUERTO_SSH="22"
RUTA_CLAVE="/ruta/a/clave_privada"  # Opcional: usar si tienes clave SSH

# PostgreSQL en VPS
DB_NAME="nombre_base_datos"
DB_USER="usuario_postgres"
DB_PASSWORD="tu_password_postgres"
DB_HOST="localhost"
DB_PORT="5432"

# Local (tu PC)
USUARIO_LOCAL="tu_usuario"
SISTEMA="windows"  # "windows", "linux", o "mac"
# ================== FIN CONFIGURACIÓN ==================

# Determinar ruta del escritorio según sistema
if [ "$SISTEMA" == "windows" ]; then
    RUTA_ESCRITORIO="C:/Users/${USUARIO_LOCAL}/Desktop"
elif [ "$SISTEMA" == "linux" ]; then
    RUTA_ESCRITORIO="/home/${USUARIO_LOCAL}/Desktop"
elif [ "$SISTEMA" == "mac" ]; then
    RUTA_ESCRITORIO="/Users/${USUARIO_LOCAL}/Desktop"
else
    echo "Sistema no reconocido"
    exit 1
fi

echo "=== Iniciando proceso de backup ==="

# 1. Crear backup en la VPS
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="db_backup_${TIMESTAMP}.sql.gz"

echo "1. Creando backup en VPS..."

if [ -n "$RUTA_CLAVE" ]; then
    # Con clave SSH
    ssh -i "$RUTA_CLAVE" -p "$PUERTO_SSH" "${USUARIO_VPS}@${IP_VPS}" "
        mkdir -p /backups/postgres &&
        PGPASSWORD='${DB_PASSWORD}' pg_dump -h '${DB_HOST}' -U '${DB_USER}' -d '${DB_NAME}' | gzip > /backups/postgres/${BACKUP_FILE} &&
        echo 'Backup creado en VPS: /backups/postgres/${BACKUP_FILE}' &&
        ls -lh /backups/postgres/${BACKUP_FILE}
    "
else
    # Sin clave SSH (usará password)
    ssh -p "$PUERTO_SSH" "${USUARIO_VPS}@${IP_VPS}" "
        mkdir -p /backups/postgres &&
        PGPASSWORD='${DB_PASSWORD}' pg_dump -h '${DB_HOST}' -U '${DB_USER}' -d '${DB_NAME}' | gzip > /backups/postgres/${BACKUP_FILE} &&
        echo 'Backup creado en VPS: /backups/postgres/${BACKUP_FILE}' &&
        ls -lh /backups/postgres/${BACKUP_FILE}
    "
fi

# Verificar si el ssh fue exitoso
if [ $? -ne 0 ]; then
    echo "❌ Error al crear backup en VPS"
    exit 1
fi

echo "✓ Backup creado exitosamente en VPS"

# 2. Copiar al escritorio local
echo "2. Copiando backup al escritorio local..."

if [ -n "$RUTA_CLAVE" ]; then
    # Con clave SSH
    scp -i "$RUTA_CLAVE" -P "$PUERTO_SSH" "${USUARIO_VPS}@${IP_VPS}:/backups/postgres/${BACKUP_FILE}" "${RUTA_ESCRITORIO}/"
else
    # Sin clave SSH (usará password)
    scp -P "$PUERTO_SSH" "${USUARIO_VPS}@${IP_VPS}:/backups/postgres/${BACKUP_FILE}" "${RUTA_ESCRITORIO}/"
fi

# Verificar si el scp fue exitoso
if [ $? -ne 0 ]; then
    echo "❌ Error al copiar backup a PC local"
    exit 1
fi

echo "✓ Backup copiado exitosamente al escritorio: ${RUTA_ESCRITORIO}/${BACKUP_FILE}"

# 3. Mostrar resumen
echo ""
echo "=== Proceso completado exitosamente ==="
echo "Backup en VPS: /backups/postgres/${BACKUP_FILE}"
echo "Backup en PC:  ${RUTA_ESCRITORIO}/${BACKUP_FILE}"
echo ""
echo "Tamaño del backup:"
ls -lh "${RUTA_ESCRITORIO}/${BACKUP_FILE}"
```

### Opción B: Ejecutar desde dentro de la VPS (luego copiar manualmente)

```bash
#!/bin/bash

# ================== CONFIGURACIÓN ==================
DB_NAME="nombre_base_datos"
DB_USER="usuario_postgres"
DB_PASSWORD="tu_password_postgres"
DB_HOST="localhost"
DB_PORT="5432"
# ================== FIN CONFIGURACIÓN ==================

echo "=== Iniciando backup en VPS ==="

# Crear directorio si no existe
mkdir -p /backups/postgres

# Crear backup con timestamp
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="/backups/postgres/db_backup_${TIMESTAMP}.sql.gz"

# Realizar backup
PGPASSWORD=${DB_PASSWORD} pg_dump -h ${DB_HOST} -U ${DB_USER} -d ${DB_NAME} | gzip > ${BACKUP_FILE}

if [ $? -eq 0 ]; then
    echo "✓ Backup creado exitosamente: ${BACKUP_FILE}"
    ls -lh ${BACKUP_FILE}
else
    echo "❌ Error al crear backup"
    exit 1
fi

echo ""
echo "Para copiar al PC local, ejecutar:"
echo "scp usuario@tu-ip-vps:${BACKUP_FILE} ~/Desktop/"
```

---

## 5. Restaurar un Backup (opcional)

### Restaurar desde archivo SQL:
```bash
# En la VPS
gunzip < /backups/postgres/db_backup_20250129_111200.sql.gz | psql -h localhost -U postgres -d nombre_base_datos
```

### Restaurar desde archivo SQL sin compresión:
```bash
psql -h localhost -U postgres -d nombre_base_datos < /backups/postgres/db_backup_20250129_111200.sql
```

---

## 6. Consejos de Seguridad

1. **Nunca incluyas contraseñas en scripts que pueden ser compartidos**
   - Usa variables de entorno
   - Usa archivos de configuración con permisos restringidos (chmod 600)

2. **Limita el acceso SSH**
   - Usa autenticación por clave SSH en lugar de contraseñas
   - Deshabilita login con contraseña en producción si es posible

3. **Encripta los backups** (opcional)
   ```bash
   # Encriptar con GPG
   gpg --symmetric --cipher-algo AES256 backup.sql.gz

   # Desencriptar
   gpg --decrypt backup.sql.gz.gpg > backup.sql.gz
   ```

4. **Limpieza automática de backups antiguos**
   ```bash
   # Mantener solo los últimos 7 backups
   ls -t /backups/postgres/db_backup_*.sql.gz | tail -n +8 | xargs rm -f
   ```

---

## 7. Programación Automática (Cron)

### Agendar backup automático en la VPS:
```bash
# Editar crontab
crontab -e

# Agregar línea para backup diario a las 3 AM
0 3 * * * /ruta/a/script_backup.sh >> /var/log/postgres_backup.log 2>&1
```

### O ejecutar desde tu PC (crontab local):
```bash
# Editar crontab
crontab -e

# Backup diario a las 3 AM
0 3 * * * /ruta/a/script_backup_completo.sh >> ~/Desktop/backup_log.txt 2>&1
```

---

## 8. Solución de Problemas Comunes

### Error: "psql: FATAL: password authentication failed"
- Verifica que `DB_USER` y `DB_PASSWORD` sean correctos
- Verifica que el usuario tenga permisos en `pg_hba.conf`

### Error: "Permission denied" al crear directorio
- Ejecuta con `sudo` si no tienes permisos: `sudo mkdir -p /backups/postgres`
- O usa un directorio donde tu usuario sí tenga permisos: `~/backups`

### Error: "Connection refused" en SSH
- Verifica que el puerto SSH sea correcto (no siempre es 22)
- Verifica que el firewall de la VPS permita conexiones SSH

### Error: scp falla
- Verifica que puedas conectarte con `ssh` primero
- Verifica que el archivo exista en la VPS con la ruta correcta

---

## Resumen de Flujo

1. **Conectarse a la VPS** → `ssh usuario@ip-vps`
2. **Crear backup** → `pg_dump -h localhost -U usuario -d db | gzip > backup.sql.gz`
3. **Copiar a PC local** → `scp usuario@ip-vps:/backups/backup.sql.gz ~/Desktop/`

---

**Nota:** Reemplaza todas las variables de ejemplo con tus valores reales antes de ejecutar cualquier comando.
