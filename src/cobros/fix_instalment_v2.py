import re

file_path = 'club-la-victoria-backend/src/cobros/cobros.service.ts'

# Read the file
with open(file_path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Find the section to replace
start_marker = '// 1. Fase 1: Advertencia para socios con EXACTAMENTE 3 cuotas pendientes\n'
end_marker = '// 5. Crear cuotas para socios sin cuota en el periodo\n'

start_idx = None
end_idx = None

for i, line in enumerate(lines):
    if start_marker in line:
        start_idx = i
    if end_marker in line and start_idx is not None:
        end_idx = i
        break

if start_idx is not None and end_idx is not None:
    # New code structure
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
    
    # Replace the old code with new code
    new_lines = lines[:start_idx] + [new_code] + lines[end_idx+1:]
    
    # Write the modified content
    with open(file_path, 'w', encoding='utf-8') as f:
        f.writelines(new_lines)
    
    print("Fix applied successfully!")
else:
    print(f"Could not find the section to replace. start_idx={start_idx}, end_idx={end_idx}")
