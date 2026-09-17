# Sincronización temporal de Stock Escobar

## Origen y regla vigente

La fuente temporal es el XLSX diario `DD-MM INV GRAL.xlsx` guardado en la carpeta
de septiembre de Google Drive. El worker local usa una cuenta de servicio con
alcance `drive.readonly`; no convierte el XLSX en Google Sheets ni escribe en
Drive o en la planilla legacy. En aproximadamente dos meses está previsto
reemplazar Octosis por WMS; ese cambio requerirá adaptar sólo la extracción.

Cada fila aporta `Código` (SKU BAM), `Saldo` y `Deposito`. Se suman las filas por
SKU. Se excluye todo depósito cuyo nombre contenga `EXT`, `REV`, `INV` o `TEP`;
por lo tanto se incluyen `DISTRIMAR B`, `DISTRIMAR N`, `JUNIMAR B` y `ALEMAR B`.
La columna `Ranking` contiene fórmulas externas y no se lee ni ejecuta.

## Ejecución

`bridge/escobar-sync.mjs` revisa la carpeta una sola vez por día a las 09:00 de
`America/Argentina/Buenos_Aires`; al iniciar fuera de ese horario espera la
próxima revisión sin consultar Drive. Sólo toma un XLSX cuyo nombre y
fecha de creación en Drive correspondan al día local. Si aún no existe, espera
hasta el día siguiente sin sustituir el snapshot anterior. El hash evita
duplicar un archivo ya importado. `scripts/start-executive-bridge.ps1`
mantiene el worker activo junto con los otros bridges; el health check sólo
está disponible en `127.0.0.1:8791/health`.

Configuración en `.env.local`: `GOOGLE_SERVICE_ACCOUNT_EMAIL`,
`GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY`, `SUPABASE_URL`, `SUPABASE_SECRET_KEY` y,
opcionalmente, `ESCOBAR_DRIVE_FOLDER_ID` y `ESCOBAR_BRIDGE_PORT`. La cuenta de
servicio necesita acceso de lector a la carpeta.
Al cambiar de mes debe actualizarse `ESCOBAR_DRIVE_FOLDER_ID` y concederse
lectura a la carpeta nueva, o el worker no encontrará el archivo diario.

## Publicación y seguridad

El parser exige encabezados `Código`, `Saldo` y `Deposito`; sólo admite saldo
numérico no negativo y consolida SKU duplicados. Un archivo incompleto (menos
de 10.000 SKU, menos de 15.000 filas incluidas o stock total nulo) se rechaza.
Después de la primera carga, una variación superior al 25 % de SKU o al 30 %
del stock total frente al último snapshot validado impide publicar el nuevo.

Supabase conserva el XLSX identificado por nombre, hash y metadatos de Drive,
los conteos, categorías y cada SKU consolidado en `compras_stock_imports` e
`compras_stock_import_items`, con `source_system=OCTOSIS` y
`deposito=ESCOBAR`. La vista `compras_stock_actual_por_sku` toma sólo el último
snapshot `VALIDADO` de cada depósito. RLS y la service role mantienen el detalle
fuera del navegador. El Dashboard sustituye `STOCK_ESCOBAR` y recalcula
`STOCK_TOTAL` en memoria; `RIESGO`, `PENDIENTE_TOTAL` y `COMPRA_SUGERIDA`
siguen siendo los valores legacy hasta el recálculo integral futuro.

El primer snapshot validado fue `16-09 INV GRAL.xlsx`, importación #5 del
16/09/2026: 24.301 filas de origen, 18.406 incluidas, 5.895 excluidas,
14.010 SKU y 7.515.104 unidades. El modelo legacy tenía 8.894.569 unidades
Escobar; la diferencia se conserva como señal de que el modelo persistido no
equivale a la nueva regla/fecha, no como motivo para incluir categorías
explícitamente excluidas.

El archivo `17-09 INV GRAL.xlsx` contenía en la fila 9520 el SKU `MB_211`,
`Saldo = -24`, depósito `DISTRIMAR B`. Por indicación del usuario se omitió
**sólo esa fila** mediante una ejecución puntual con
`--once --skip-confirmed-row-9520`. El parser verifica archivo, fecha, fila y
valores exactos; todos los demás saldos negativos siguen siendo errores.
La importación #8 quedó `VALIDADO`, con 24.401 filas de origen, 18.506
incluidas, 5.894 excluidas por depósito y una rechazada explícitamente;
14.032 SKU y 7.473.709 unidades. La omisión está registrada en
`metadata.ignoredRows` y `filas_rechazadas`.
