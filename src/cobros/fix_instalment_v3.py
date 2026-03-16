# Read the file
with open('club-la-victoria-backend/src/cobros/cobros.service.ts', 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Find the line numbers to replace
# The section to replace starts at "// 1. Fase 1" and ends at "// 5. Crear cuotas"
# We need to find these lines and replace everything between them

target_start = None
target_end = None

for i, line in enumerate(lines):
    if '// 1. Fase 1:' in line:
        target_start = i
    if '// 5. Crear cuotas' in line:
        target_end = i
        break

if target_start is None or target_end is None:
    print("Could not find target markers")
    exit(1)

print(f"Found target range: lines {target_start+1} to {target_end}")

# The new code that replaces the old code
new_code = '''      // 1. Obtener socios activos con categoria asignada (se ejecuta antes de crear nuevas cuotas)
      const sociosActivos = await queryRunner.manager.find(Socio, {
        where: { estado: 'ACTIVO' },
        relations: ['categoria'],
      });

      // Filtrar socios con categoria NO exenta
      const sociosConCategoria = sociosActivos.filter(
        (s) => s.categoria && !s.categoria.exento,
      );

      // Contar socios exentos (para informacion)
      const sociosExentos = sociosActivos.filter(
        (s) => s.categoria && s.categoria.exento,
      );
      if (sociosExentos.length > 0) {
        resultado.advertencias.push(
          `${sociosExentos.length} socio(s) con categoria exenta (VITALICIO/HONORARIO) omitidos`,
        );
      }

      // 2. Verificar cuotas existentes para el periodo (idempotencia)
      const cuotasExistentes = await queryRunner.manager.find(Cuota, {
        where: { periodo: dto.periodo },
      });

      const sociosConCuotaExistente = new Set(
        cuotasExistentes.map((c) => c.socioId),
      );

      // 3. Crear cuotas para socios sin cuota en el periodo
      for (const socio of sociosConCategoria) {
        if (sociosConCuotaExistente.has(socio.id)) {
          resultado.omitidas++;
          continue;
        }

        const cuota = queryRunner.manager.create(Cuota, {
          socioId: socio.id,
          periodo: dto.periodo,
          monto: socio.categoria!.montoMensual,
          estado: EstadoCuota.PENDIENTE,
        });

        await queryRunner.manager.save(cuota);
        resultado.creadas++;
      }

      // 4. Fase 1: Inhabilitacion para socios con 4+ cuotas pendientes (despues de crear la nueva cuota)
      // Esto asegura que detectamos cuando un socio llega a 4 cuotas pendientes
      const sociosMorosos = await this.identificarSociosMorosos(queryRunner);

      for (const socio of sociosMorosos) {
        await queryRunner.manager.update(Socio, socio.id, {
          estado: 'MOROSO',
        });
        resultado.inhabilitados++;
        resultado.desactivados++;
        resultado.advertencias.push(
          `Socio ${socio.nombre} ${socio.apellido} (ID: ${socio.id}) marcado como MOROSO por morosidad (4+ meses)`,
        );
        await this.notificacionesService.crearNotificacion(
          TipoNotificacion.INHABILITACION_AUTOMATICA,
          socio.id,
          `Socio ${socio.nombre} ${socio.apellido} marcado automaticamente como MOROSO por morosidad.`,
        );
      }

      // 5. Fase 2: Advertencia para socios con EXACTAMENTE 3 cuotas pendientes
      // Esto asegura que enviamos la notificacion cuando tienen exactamente 3 cuotas pendientes
      const sociosConAdvertencia =
        await this.identificarSociosConAdvertenciaMorosidad(queryRunner);

      for (const socio of sociosConAdvertencia) {
        resultado.advertenciasMorosidad++;
        resultado.advertencias.push(
          `Socio ${socio.nombre} ${socio.apellido} (ID: ${socio.id}) adeuda 3 meses. Proximo mes sera inhabilitado.`,
        );
        await this.notificacionesService.crearNotificacion(
          TipoNotificacion.MOROSIDAD_3_MESES,
          socio.id,
          `Socio ${socio.nombre} ${socio.apellido} adeuda 3 meses. El proximo mes sera inhabilitado.`,
        );
      }
'''

# Replace the lines
new_lines = lines[:target_start] + [new_code + '\n'] + lines[target_end+1:]

# Write back
with open('club-la-victoria-backend/src/cobros/cobros.service.ts', 'w', encoding='utf-8') as f:
    f.writelines(new_lines)

print("Fix applied successfully!")
