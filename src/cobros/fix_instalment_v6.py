# Read the file
with open('club-la-victoria-backend/src/cobros/cobros.service.ts', 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Define the range to replace (replace lines 144 to 207, 0-indexed 143 to 206)
start_line = 143  # Line 144 (0-indexed 143)
end_line = 207    # Line 208 (0-indexed 207)

print(f"Replacing lines {start_line+1} to {end_line+1} (0-indexed: {start_line} to {end_line})")

# New code (starting with "// 2. Verificar cuotas existentes")
new_code = '''      // 2. Verificar cuotas existentes para el periodo (idempotencia)
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
new_lines = lines[:start_line] + [new_code + '\n'] + lines[end_line:]

# Write back
with open('club-la-victoria-backend/src/cobros/cobros.service.ts', 'w', encoding='utf-8') as f:
    f.writelines(new_lines)

print("Fix applied successfully!")
