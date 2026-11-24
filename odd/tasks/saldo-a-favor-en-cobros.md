# Saldo a favor en cobros de socios
Objetivo: conservar el saldo sin asignar, aplicarlo en los cobros solicitados y confirmar en móvil el importe vigente. Backend y móvil: `feat/mobile-quota-generation`; web: `feat/saldo-a-favor-pago-anual`. Entrega: `ask-on-risk`. Verificación: Jest, Supertest y Playwright local, con datos ficticios.

## Specs

**S1.** «la cobradora va a cobrar una cuota de 10.000 pesos y el socio le entrega 12.000. Esos dos mil sobrantes se guarda como saldo a favor del socio». Preservar el excedente en los recorridos que ya lo reciben. Adelantar cuotas específicas no equivale a guardar crédito sin asignar.

**S2.** «que se aplique el cesaldo a favor en todos los lugares, al pagar el año completo, al pagar uno o varios meses». Comprobar los recorridos manuales de la web y de la app. Mostrar en el pago anual el bruto, el crédito utilizado y el importe a cobrar; el servidor debe registrarlos de forma coherente, sin volver a pagar meses ya saldados.

**S3.** «o incluso también al pagar las cosas extra que le puede cobrar la cobradora». Verificar que el saldo cubra los conceptos adicionales, solos o combinados con cuotas, incluso sin ingreso nuevo cuando el saldo alcanza.

**S4.** «para el punto 1 y 2 habría que solucionarlo». Punto 1: si el saldo vigente cambia el importe mostrado en el alta de un cobro móvil, actualizar el total y pedir otra confirmación antes de registrar. Punto 2: implementar S2 en el pago anual.

## Tasks

- [x] T1 · S1–S4 · inline, saldo en el anual y rechazo de importes netos desactualizados en el cobro individual. Jest 92/92; revalidación HTTP 4/4. Riesgo: ítem 4 (consumo concurrente del saldo). Backend `89d2b05`.
- [x] T2 · S2 · inline, web muestra el descuento y confirma el importe anual. Playwright: RED por resumen sin descuento, GREEN 2/2 con PostgreSQL ficticio. TypeScript OK. Web `c19546c`.
- [x] T3 · S1, S3–S4 · inline, la app actualiza el total y pide otra confirmación. Jest 17/17 y revalidación 2/2; se mantienen los cambios locales previos. Móvil `5c12997`.
- [x] T4 · S1–S4 · verificación independiente del alcance implementado, con datos ficticios. Revalidación de los cuatro bloqueantes aprobada sin publicación.
- [ ] T5 · S2 · pendiente de definición: determinar si el registro web por lote es un cobro en el momento o una carga posterior de dinero ya recibido.

## Log

L1 — Pedido original (verbatim):

> Claro, para el punto 1 y 2 habría que solucionarlo. Actualmente, no sé si se va a seguir usando, pero de que el socio puede tener un saldo a favor. Por ejemplo, la cobradora va a cobrar una cuota de 10.000 pesos y el socio le entrega 12.000. Esos dos mil sobrantes se guarda como saldo a favor del socio que sirve luego para.  descontárselo de las próximas eh cuotas o de lo que sea. ¿Qué pasa? Esto era incómodo porque muchas veces los socios directamente le pagan a la cobradora meses adelantados de la cuota.No sé si le dejan plata a favor, pero esta opción hay que dejarla en el sistema y hay que valer que se aplique el cesaldo a favor en todos los lugares, al pagar el año completo, al pagar uno o varios meses, o incluso también al pagar las cosas extra que le puede cobrar la cobradora. Porque recordá que en la aplicación mobile hay una opción que permite agregar cosas extra.  ya que muchas veces la cobradora va y cobra por distintas actividades que se hacen en el club. por eso está ese botón que permite esa opción

L2 — El mapeo inicial constató que el saldo del socio ya se aplica en cuenta corriente web y en el alta móvil individual (incluidos extras). No se aplica al pago anual ni al registro múltiple general de la web. El cobro grupal usa su propio saldo familiar; el pedido no autoriza fusionarlo con el saldo personal ni modificar conciliaciones de cargos externos. RDD está apagado.

L3 — El anual aplica crédito de forma transaccional y conserva `totalPagado` como bruto; agrega `creditoAplicado` y `montoCobrado`. La web envía el neto confirmado; el backend devuelve 409 si cambió. El alta móvil individual sin períodos nuevos envía `montoNetoEsperado`; la ruta de adelantos conserva su validación preexistente. Las nuevas confirmaciones no alteran edición ni cobro familiar. Backend primero cuando eventualmente se autorice entregar.

L4 — El Playwright focalizado pasó con Chromium ya instalado, configurado desde un directorio temporal. Suites completas: backend 11/19 suites, 211/216 pruebas ejecutadas; móvil 18/20 suites, 55/59 pruebas. Falta comparación de fallos con la base del backend. No se cambió el botón web «Registrar seleccionadas como pagadas»: su uso como toma de un nuevo cobro o registro posterior de dinero ya recibido tiene consecuencias distintas para el saldo.

L5 — La verificación independiente reprodujo dos carreras con un único consumo de saldo y validó la reversión exacta en PostgreSQL. En la primera revisión encontró cuatro bloqueantes: el pago anual redondeaba pesos en lugar de conservar centavos; el alta móvil pisaba el importe ingresado al reconfirmar, dejaba el neto viejo tras un conflicto `409` y aceptaba cambiar el neto con una clave ya usada. Confirmó los mismos cinco tests fallidos y ocho suites fallidas en backend base y candidato. El lote web sigue pendiente como diferencia de alcance, no como regresión.

L6 — Corrección acotada a esos cuatro hallazgos: conversión exacta en el anual, validación del neto registrado en el reintento y separación del importe manual del calculado en móvil, que ahora refresca el saldo tras un conflicto sin enviar otro POST. RED: dos casos en cada repositorio. GREEN: Jest cobros 92/92 y Jest flujo móvil 17/17, TypeScript móvil y `git diff --check` OK. TypeScript general del backend encuentra errores en fixtures idénticos a la base. Pendiente recheck independiente limitado a los cuatro bloqueantes.

L7 — Revalidación independiente: HTTP/PostgreSQL 4/4 y Jest móvil 2/2. El anual persistió $117.999,50 de $120.000 con $2.000,50 de saldo y conservó una cuota histórica de $10.000,50. Una discrepancia de un centavo devolvió `409` con estado intacto. El reintento con mismo neto devolvió el mismo registro; con neto distinto devolvió `409` sin cambios. En móvil se conservaron $12.000 ingresados y el total se actualizó de $8.000 a $9.000 tras conflicto sin reenviar automáticamente.

L8 — Commits locales sin cambios ajenos. El commit móvil se verificó sobre una copia de `6546dde` con solo esta unidad: flujo de cobro 17/17 y TypeScript OK. Conserva los cambios de interfaz y pruebas que ya estaban en el árbol de trabajo. La entrega futura debe instalar el backend antes que los clientes; no se publicó.
