# Finanzas Silva

App web de finanzas personales (en soles, PEN): gastos e ingresos, presupuestos por categoría, alertas de gasto alto por servicio, deudas con cuotas, sueldo recurrente y puntaje de riesgo. Sin build ni dependencias: HTML + JS + Chart.js por CDN.

Los datos se guardan en tu navegador y, opcionalmente, en **tu propia hoja de Google Sheets**. También puedes alimentar movimientos con un **Google Form**.

## Probarla ya
```bash
npm start        # sirve en http://localhost:8080
```
Entra a **Ajustes → Cargar datos de ejemplo**. Para publicarla gratis: GitHub Pages (Settings → Pages → rama, carpeta `/`).

## Conectar Google Sheets (≈5 min)
1. Crea una hoja de cálculo nueva en Google Sheets.
2. **Extensiones → Apps Script**, borra el contenido y pega `apps-script/Code.gs`.
3. **Configuración del proyecto (engranaje) → Propiedades del script → Agregar**: nombre `TOKEN`, valor una clave larga inventada por ti (es tu contraseña).
4. Selecciona la función `inicializar` y **Ejecutar** (acepta los permisos). Crea las pestañas.
5. **Implementar → Nueva implementación → Aplicación web**: ejecutar como *Yo*, acceso *Cualquier persona*. Copia la URL que termina en `/exec`.
6. En la app: **Ajustes → Conexión**, pega la URL y el token → *Guardar y sincronizar*.

Las altas/ediciones se envían solas; si no hay conexión quedan en cola y se sincronizan al volver. También puedes editar la hoja a mano y pulsar *Sincronizar ahora*.

> Seguridad: la URL es pública pero toda petición exige el token; sin él la hoja no se lee ni se escribe. No compartas el token. Si cambias de dispositivo, vuelve a pegar URL y token.

## Conectar un Google Form (opcional)
1. Crea un Form con estas preguntas (los nombres importan): **Fecha** (fecha), **Tipo** (opción: Gasto / Ingreso), **Monto** (respuesta corta), **Categoría** (lista), **Servicio** (respuesta corta), **Nota** (opcional).
2. En el Form: *Respuestas → Vincular con Hojas de cálculo → Seleccionar hoja existente* (tu hoja). Renombra la pestaña creada a **`Respuestas`**.
3. En Apps Script ejecuta una vez `crearTriggerFormulario` (acepta permisos): cada envío del Form se convierte al instante en un movimiento. Sin el trigger, usa el botón **Importar del Formulario** en Movimientos.
4. Agrega el Form a la pantalla de inicio de tu celular para registrar gastos en 10 segundos.

## Qué incluye
| Sección | Qué hace |
|---|---|
| Resumen | Ingresos/gastos/balance del mes, gráficos, alertas y próximos vencimientos |
| Movimientos | Alta/edición, filtros, importar CSV (`fecha,tipo,monto,categoria,servicio,nota`) |
| Presupuestos | Límite por categoría con aviso al 80% / 100%; servicios con gasto alto (+30% sobre su promedio de 3 meses o ≥25% del gasto) |
| Deudas | Saldo, TEA, cuota, próximo pago, registrar pago (descuenta saldo y lo anota como gasto), calendario de amortización, avalancha vs. bola de nieve |
| Ingresos | Sueldo recurrente, botón "Me pagaron", proyección de flujo del mes |
| Riesgos | Puntaje 0–100 (cuotas/ingreso, gasto/ingreso, colchón, tasas altas), recomendaciones y alertas |

Los umbrales se ajustan en **Ajustes**. Define allí tu **saldo disponible** para activar la alerta de saldo negativo proyectado.

## Desarrollo
`npm test` ejecuta las pruebas de la lógica pura (`js/risk.js`). Las columnas de cada pestaña están en `js/schema.js` y `apps-script/Code.gs` (deben coincidir).
