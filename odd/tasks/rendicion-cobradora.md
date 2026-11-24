# Rendición de cobranzas
Objetivo: exportar la recaudación por período en PDF. Verificación: Jest, TypeScript y datos ficticios. Entrega: `ask-on-risk`; primera unidad backend + web, sin publicación.

## Specs

**S1.** «seleccionar un rango de fecha, que sea más que nada seleccionar un mes en particular». Mes como opción principal; rango personalizado inclusivo como alternativa.

**S2.** «un listado de todos los cobros que se realizó en ese mes con un resumen» y «un total de lo cobrado y un total por método de pago». Solo dinero recaudado, no comisiones. Mostrar los datos históricos que no se pueden verificar como tales.

**S3.** «en la sección de... creo que se llama cuenta corriente del cobrador. Que se pueda bajar el mismo PDF, se selecciona a la cobradora y se pueda descargar el mismo PDF.» La administración descarga el informe desde la cuenta corriente y usa la sesión web existente.

**S4.** «generar el PDF y enviarlo, qué sé yo, a través de WhatsApp como para poder guardarlo». Compartir manualmente en móvil sin reinstalar ni agregar inicio de sesión o selección a la rutina de la cobradora. El identificador de dispositivo actual no autoriza acceso a datos de rendición.

## Tasks

- [ ] T1 · S1–S2 · inline · Fuente y contrato de recaudación protegidos; pruebas de fechas, métodos, datos incompletos, acceso. Riesgo: ítem 2 (informe con datos de socios).
- [ ] T2 · S1–S3 · inline · Descargar PDF en la web con la sesión actual. Depende de T1.
- [ ] T3 · S2–S4 · pendiente · Compartir el mismo PDF desde la app; requiere un acceso identificable sin publicar el informe.

## Log

L1 — «Bueno, ahora quiero que implementes lo del pdf que te comenté antes.»

L2 — Requerimiento consolidado de los mensajes anteriores: rendición con todos los cobros, dinero recibido y subtotales por método, descargable en la cuenta corriente web y compartible en móvil, sin calcular cuánto gana la cobradora. Se conserva la apertura directa de la app.

L3 — Primera unidad: `GET /cobradores/:id/rendicion` usa la sesión web existente; filtra cobros atribuidos, no movimientos de comisión, y conserva importes en centavos. La web genera el PDF con la librería ya instalada. Los pagos por método que no se pueden verificar quedan sin asignar. Para cobros que no guardan el importe completo se muestra `Importe no verificable` y el resumen pasa a `Total verificable (parcial)`. No se modificó la persistencia de cobros ni se abrió una ruta móvil nueva.

L4 — Jest específico 2/2; TypeScript web y backend de producción pasó. Playwright web 1/1 con datos ficticios y respuesta de rendición simulada; el proceso que se lanzó antes de cambiar la UI terminó después y dio GREEN, no se afirma RED de navegador. Dos fallas previas del módulo de cobradores siguen fuera de esta unidad. Revalidación independiente de acceso y datos pendiente.

L5 — La primera verificación confirmó GET y HEAD privados (401 sin sesión, 200 autenticado, `private, no-store`), filtrado por cobrador y actor y PDF sin comisión ni DNI. Detectó tres bloqueantes: parámetros de rango ambiguos aceptados, $0 como valor histórico sin evidencia y residual grupal verificable que faltaba. Se agregaron regresiones que dieron RED 3/3; aplicadas las correcciones acotadas, Jest 5/5 y TypeScript para producción aprobado. Pendiente la revalidación limitada a esos tres casos; la zona horaria no se comprobó aún contra PostgreSQL real.
