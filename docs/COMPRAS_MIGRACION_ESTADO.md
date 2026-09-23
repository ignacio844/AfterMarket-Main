# Migración de Compras: contexto y estado

Última actualización: 18/09/2026.

## Objetivo y decisiones vigentes

Se está migrando el sistema de Compras de Google Apps Script + Google Sheets (fuentes en `docs/sistema-importaciones-legacy/`) al portal Grupo Aftermarket, construido con Next.js. La ruta canónica es `/areas/compras`; no debe crearse `/compras` ni una redirección.

Google Sheets continúa como fuente temporal **solo de lectura** para los datos todavía no migrados. Toda llamada a Google y el uso de credenciales ocurren del lado servidor. Se usa exclusivamente la autenticación del portal actual (NextAuth con Google y `isPortalUserAllowed`). No se escribe en Sheets ni se ejecuta o porta allí ningún proceso que recalcule `MODELO_COMPRAS`.

La migración de fuentes automatizadas ya comenzó. **Stock Warnes está migrado a Supabase y su sincronización automática fue validada por el usuario como efectiva al 100 %.** Ventas dispone de ingesta SQL automática/manual; Escobar y Órdenes, de ingestas diarias temporales desde Drive. Ninguno de los flujos escribe Google Sheets.

No modificar otras secciones del portal salvo lo estrictamente necesario para Compras. La UI debe seguir la estética de Grupo Aftermarket, sin copiar visualmente el sistema legacy.

## Estado implementado

| Vista | Ruta | Alcance |
| --- | --- | --- |
| Dashboard | `/areas/compras` | Port de `obtenerDashboardPortalCompras()` y representación adaptada de `cargarDashboard()` / `dibujarMarcasDashboard()`. KPIs, estado de fuentes y tablas por origen. Exportación XLSX del Dashboard. |
| Gestión de Compras | `/areas/compras?vista=gestion` | Port read-only de `obtenerGestionComprasPortal()`: registros, filtros por texto/riesgo/estado/marca/política, resumen sobre registros filtrados y tabla paginada de 50 filas. |
| Cotizaciones | `/areas/compras?vista=cotizaciones` | Port read-only de `obtenerBandejaCotizacionPortal()` y `obtenerCotizacionesPortal()`: pendientes importados, lotes CT, ofertas y ranking por SKU/moneda. |
| Bandeja de Compra | `/areas/compras?vista=bandeja` | Port read-only de `obtenerBandejaCompraPortal()`: SKU aprobados pendientes, KPIs, selección local y descarga CSV. |
| Enviados a Compra | `/areas/compras?vista=envios` | Port read-only de `obtenerEnviosCompraPortal()`: lotes, KPIs, filtros, OC asociadas y detalle de SKU por envío. |
| Compras en Proceso | `/areas/compras?vista=proceso` | Port read-only de `obtenerComprasEnProcesoPortal()`. La sincronización previa del legacy se reproduce sólo en memoria. |
| Packing List | `/areas/compras?vista=packing` | Lectura y representación de `PACKING_LIST` y `PACKING_LIST_DETALLE`; la importación permanece deshabilitada. |
| Contenedores | `/areas/compras?vista=contenedores` | Lectura de contenedores, asociaciones con Packing List y estado operativo; altas y asociaciones permanecen deshabilitadas. |
| Seguimiento | `/areas/compras?vista=seguimiento` | Seguimiento read-only desde `ORDENES`, historial logístico y detalle de Packing List. |
| Recepciones | `/areas/compras?vista=recepciones` | Lectura de órdenes y detalle de recepciones; registro manual y por Excel deshabilitados. |
| Historial SKU | `/areas/compras?vista=historial&sku=...` | Port read-only de `obtenerHistorialSkuPortal()`: situación actual, buscador y línea de tiempo cronológica con decisión, envíos y movimientos. |
| Transferencias | `/areas/compras?vista=transferencias` | Cálculo read-only de transferencias sugeridas a partir de `GESTION_COMPRAS_ACTIVA`. |

La navegación actual sigue el flujo: Dashboard → Gestión → Cotizaciones → Bandeja → Enviados → En proceso → Packing List → Contenedores → Seguimiento → Más (Recepciones, Historial SKU y Transferencias).

En las tablas de marcas importadas y nacionales del Dashboard, el nombre de cada marca enlaza a Gestión con el filtro de esa marca seleccionado. La URL conserva `vista=gestion&marca=...`; si la marca no tiene registros de Gestión, se muestra el filtro y cero resultados, no todas las marcas.

La vista de Gestión muestra las columnas SKU, descripción, marca, origen, objetivo, cobertura actual, riesgo, política, compra sugerida, estado, cantidad decidida, responsable, observación, fecha de decisión y acción. La tabla tiene diseño compacto y la vista admite hasta 1920 px de ancho. Se comprobó en el navegador del portal a 1282 px de viewport que las 15 columnas entran sin desbordamiento horizontal; por debajo de aproximadamente 1250 px puede aparecer desplazamiento horizontal para conservar todas las columnas.

Los botones **Gestionar** e **Historial** son visibles en cada fila. **Gestionar** abre un panel prototipo con SKU, descripción, marca, riesgo y compra sugerida; permite cambiar localmente estado de gestión, cantidad decidida y observación (máximo 1000 caracteres). **Guardar** permanece deshabilitado: cerrar descarta el borrador y no modifica la tabla ni Google Sheets. **Historial** navega a la vista Historial SKU con el código precargado, como `irHistorialSku()` en Apps Script, y consulta los datos reales al abrirse. En la tabla, `Cantidad decidida` es texto, no un campo editable.

## Arquitectura actual del Dashboard

El Dashboard en `/areas/compras` conserva la lógica de `obtenerDashboardPortalCompras()` y presenta:

- estado de actualización de Stock Warnes, Stock Escobar, Ventas y Órdenes, con actualización manual de Warnes, Ventas y Órdenes;
- KPIs de SKU sin stock, urgentes, comprar, revisar, stock físico, pendiente de recibir, cobertura ponderada y compra sugerida;
- tablas de marcas importadas y nacionales, con riesgo, compra sugerida, consumo trimestral promedio, cobertura actual y objetivo;
- cantidad de marcas excluidas de nuevas compras;
- actualización de la página y exportación XLSX. La exportación llama al mismo `getComprasDashboard()`, por lo que utiliza también el snapshot vigente de Warnes.

La fuente del Dashboard es **Supabase con un espejo temporal del legacy** (pendiente de despliegue del código de esta etapa):

1. `src/lib/compras-sheets.ts` lee en paralelo el espejo validado de Sheets en Supabase y los snapshots vigentes de Warnes, Escobar, Ventas y Órdenes. `COMPRAS_DASHBOARD_SHEET_SOURCE=SHEETS` permite volver temporalmente a la lectura original si se necesita recuperación.
2. El Dashboard consume del espejo `MODELO_COMPRAS`, configuración y alias de marcas, `MAPA_SKU`, `CONTROL_IMPORTACIONES_STOCK`, `PENDIENTES_EQUIVALENCIA_IMPORT`, `PARAMETROS_COMPRAS` y `MARCAS`. El espejo conserva `DETALLE_IMPORTACIONES` para diagnóstico y otras vistas; el pendiente del Dashboard se calcula desde el snapshot independiente de Órdenes.
3. `src/lib/compras-stock-supabase.ts` pagina la vista `compras_stock_actual_por_sku` de Supabase y obtiene `stock_warnes`, fecha e ID de importación.
4. Antes de calcular el Dashboard, `applyWarnesStockToDashboardModel()` reemplaza en memoria `STOCK_WARNES` y, cuando existe un snapshot Escobar validado, también `STOCK_ESCOBAR` por SKU. Un SKU ausente del snapshot completo de su depósito se considera `0`. Luego recalcula `STOCK_TOTAL` con ambos depósitos de Supabase; sin snapshot Escobar conserva el valor legacy.
5. Las fechas de importación de Warnes, Escobar y Órdenes se reemplazan en memoria para que las tarjetas de frescura reflejen los snapshots reales de Supabase. De Órdenes se leen también las líneas del último snapshot validado para calcular el pendiente por SKU.
6. `src/lib/compras-ventas-model.ts` aplica `MAPA_SKU` como el legacy y reemplaza en memoria sólo `CONSUMO_12_MESES` (agosto 2025 a julio 2026) y `PROMEDIO_MENSUAL` (suma / 12) desde Supabase.
7. `applyLegacyComprasMetricsToDashboardModel()` conserva en memoria la regla B12B de estados (`EN FABRICA` y `EMBARCADO`) y el cruce `ITEM → SKU`, ahora sobre el XLSX de seguimiento original. Después recalcula la cobertura objetivo de B13 y las fórmulas B14 de cobertura, riesgo, prioridad y compra sugerida. `calculateComprasDashboard()` agrupa los KPIs sin modificar ninguna fuente.

**Alcance de la fuente:** por confirmación del usuario, el XLSX original es autoritativo para el seguimiento de Órdenes: una orden ausente dejó de estar pendiente. No se mezclan sus líneas con `DETALLE_IMPORTACIONES` ni se conservan órdenes desaparecidas. Los campos de recepción (`CANTIDAD_RECIBIDA`, `CANTIDAD_PENDIENTE`, `ID_DETALLE`) siguen perteneciendo a `DETALLE_IMPORTACIONES`; la regla B12B del Dashboard continúa usando cantidad original, no saldo de recepción. El modelo base todavía aporta catálogo SKU y marca. Este cambio está implementado localmente, no desplegado.

### Dashboard — diagnóstico de conciliación (implementado)

`GET /api/compras/dashboard-reconciliation` ofrece a usuarios autorizados del portal un diagnóstico **de sólo lectura** sobre el modelo, el detalle y las equivalencias legacy. No se llama al cargar el Dashboard. Compara el pendiente persistido, la antigua fórmula B12B sobre `DETALLE_IMPORTACIONES` y una proyección alternativa con `CANTIDAD_PENDIENTE` en cuatro estados. Ninguna de esas dos proyecciones alimenta ya el KPI; éste lee el snapshot de Órdenes. El diagnóstico informa filas sin cruce, claves ambiguas, totales por estado y las mayores diferencias por SKU.

Se conserva por ahora la ventana legacy de Ventas (agosto 2025–julio 2026), conforme a la instrucción de replicar esa lógica. La fecha de importación no implica que esa ventana se haya desplazado. La proyección de cuatro estados y saldo pendiente queda como análisis para un cambio funcional posterior. El XLSX de `ORDENES` no reemplaza los campos de recepción de `DETALLE_IMPORTACIONES`.

### Dashboard — fase 2 de espejo Supabase (implementada localmente)

La migración `008_compras_sheet_mirror.sql` fue aplicada al Supabase vinculado. El worker `bridge/compras-sheets-sync.mjs` usa exclusivamente el scope `spreadsheets.readonly`, lee once pestañas relevantes para el Dashboard y publica filas JSONB en snapshots por hoja. Reutiliza contenidos idénticos por SHA-256 y publica el conjunto completo mediante un lote validado; un fallo no cambia el lote vigente. La primera carga terminó como `batch #1` con once importaciones validadas, entre ellas 30.638 filas de `MODELO_COMPRAS`, 30.904 de `MAPA_SKU` y 3.626 de `DETALLE_IMPORTACIONES`. El worker local quedó activo y su primera revisión sin cambios publicó `batch #2` reutilizando las once importaciones; el health check respondió `ok`.

El código del Dashboard y de la conciliación lee por defecto ese lote desde Supabase, pagina las filas y confirma que el ID del lote no cambió durante la lectura. El puente puede revisar el Sheet cada dos horas sin escribirle y el supervisor local lo arrancará en `127.0.0.1:8793` al tomar la nueva versión del script. **Aún no hay commit, push ni despliegue de este código**, y no se ha verificado la presentación en el portal desplegado. El resto de las vistas de Compras conserva sus lecturas directas de Sheets; esta etapa no migra Gestión, Cotizaciones, Seguimiento, Recepciones ni otras vistas.

### Gestión — regularización inicial (17/09/2026)

Por decisión del usuario, los parámetros y la configuración permanecen en Google Sheets; las decisiones operativas de Gestión se migrarán a Supabase. No se habilitaron escrituras de Gestión en el portal ni se modificaron celdas de Sheets.

`npm run bridge:compras-gestion:audit` lee con scope `spreadsheets.readonly` las hojas persistente y activa y cruza los SKU conflictivos con Envíos, Compras en Proceso, Movimientos y OC. Ambas hojas contienen 3.697 SKU únicos, sin encabezados faltantes, SKU duplicados, estados/cantidades inválidos ni observaciones de más de 1.000 caracteres. Hay una única discrepancia: `KLILED13961GELBL` está `APROBADO` en `GESTION_COMPRAS` y `ENVIADO A COMPRA` en `GESTION_COMPRAS_ACTIVA`, con distinta fecha de decisión. No figura en las cuatro hojas operativas consultadas. El estado correcto no pudo determinarse; debe quedar excluido o señalado como conflicto en la migración autoritativa, sin elegir un valor automáticamente.

El puente de solo lectura ahora incluye `GESTION_COMPRAS` y `GESTION_COMPRAS_ACTIVA`, verifica su estructura y datos antes de publicar el lote y conserva la discrepancia para conciliación. El `dry-run` de 13 pestañas pasó; la ejecución manual publicó el lote validado `#7`, que incluye 3.698 filas (encabezado incluido) por cada hoja de Gestión. Una lectura posterior de Supabase confirmó ambas importaciones en ese lote. El portal sigue leyendo Gestión directamente de Sheets; el espejo todavía no es la fuente autoritativa de decisiones. El proceso residente del puente debe reiniciarse/desplegarse con esta versión antes de depender de la sincronización periódica de esas dos hojas; una ejecución con la versión anterior puede volver a publicar un lote de 11 pestañas.

### Gestión — persistencia Supabase preparada (18/09/2026)

La migración `009_compras_gestion_decisiones.sql` crea decisiones por SKU, eventos y dos funciones transaccionales: importación inicial sin sobrescritura y guardado con versión esperada. `010_compras_gestion_nuevos.sql` añade una importación incremental que incorpora sólo SKU ausentes y nunca modifica decisiones existentes. RLS y privilegios impiden acceso directo desde el navegador; la API `/api/compras/gestion` comprueba sesión y permiso de editor antes de llamar con la clave privada del servidor. El portal conserva Sheets como entrada de plan/parámetros y superpone las decisiones de Supabase en Gestión, Cotizaciones, Bandeja, Transferencias e Historial cuando `COMPRAS_GESTION_SOURCE=SUPABASE`. El historial muestra la decisión legacy como línea de base y cada nueva decisión de Supabase sin duplicar el evento de migración. El SKU contradictorio queda marcado como no conciliado.

`npm run bridge:compras-gestion:import` es una simulación de solo lectura sobre el lote espejo vigente. La prueba del 17/09 leyó el lote `#7`, encontró 3.697 SKU y marcó sólo `KLILED13961GELBL` para revisión. Su estado migrado será nulo; ninguna de las dos versiones de Sheets gana automáticamente. `npm run bridge:compras-gestion:import -- --apply` escribirá la importación inicial **sólo después de aplicar la migración SQL**. La función SQL rechaza un segundo bootstrap sobre decisiones existentes. Antes de activar el portal, `npm run bridge:compras-gestion:import -- --verify` compara el snapshot vigente contra la importación y sale con error si falta un SKU o la decisión legacy cambió desde el bootstrap. Para SKU posteriores, `npm run bridge:compras-gestion:import -- --sync-new` informa los ausentes y `--sync-new --apply` los incorpora sin sobrescribir estados, cantidades ni versiones ya guardadas. Esta sincronización exige que ambas hojas de Gestión estén íntegras y tengan el mismo conjunto de SKU.

La activación sigue pendiente; no se modificó `.env.local` ni se ejecutó `--apply`. Orden de corte:

1. Acordar un corte que evite dos escritores. El usuario indicó expresamente no cambiar el Apps Script activo; por lo tanto, no cerrar allí las funciones ni activar escritura nueva mientras el legacy siga editando decisiones. Sheets continúa editable para parámetros.
2. Aplicar las migraciones `009` y `010` al esquema `portal_aftermarket` y reiniciar el puente con las 13 pestañas.
3. Correr el dry-run, revisar cantidad/conflictos, ejecutar `--apply` y confirmar 3.697 decisiones y un SKU en revisión.
4. Configurar `COMPRAS_GESTION_SOURCE=SUPABASE`, reiniciar/desplegar portal y probar guardado individual, cantidades y selección masiva con un editor y lectura con un usuario sin edición.
5. Verificar que los consumidores de decisiones muestran el estado nuevo y que la hoja legacy no recibió ninguna escritura.

Un SKU nuevo que aparezca después del bootstrap se muestra desde el plan pero queda sin versión y no puede guardarse hasta correr la importación incremental. Conviene programar ese paso junto a la revisión del espejo y alertar si las dos hojas de Gestión dejan de conciliar.

El 18/09 se identificó el worker residente antiguo que había vuelto a publicar lotes de 11 hojas. Se reinició únicamente ese proceso con el código de 13 hojas; el health check quedó `ok` y publicó el lote `#11` con las dos hojas de Gestión (3.698 filas cada una). El dry-run del importador sobre `#11` confirmó de nuevo 3.697 SKU y sólo el conflicto `KLILED13961GELBL`.

Las migraciones equivalentes a `009` y `010` se aplicaron manualmente desde el editor SQL del proyecto Supabase **Foro Grupo Aftermarket** (`gowqlnnyuhoplbymjlxl`) y se registraron como versiones `009` y `010` en `supabase_migrations.schema_migrations`. Una consulta posterior confirmó ambas tablas con RLS habilitado, las tres funciones presentes y **cero decisiones/eventos**. No se ejecutó la importación, no se activó `COMPRAS_GESTION_SOURCE` y el portal continúa sin escrituras de Gestión. El panel de Supabase mostraba `EXCEEDING USAGE LIMITS` y estado `Unhealthy` por tamaño de base superior a la cuota gratuita; las operaciones SQL indicadas sí terminaron correctamente, pero conviene resolver la cuota antes del corte final.

El usuario luego indicó expresamente **no cambiar nada del Apps Script actual**. Se localizó y leyó el proyecto activo `SISTEMA DE IMPORTACION`, pero no se guardó ni publicó ningún cambio. Se retiraron las guardas que se habían preparado en las copias locales de `portal_compras.gs` y `Sprint_B17D_DesicionCompra.gs`. Las funciones `guardarDecisionCompraPortal`, `guardarGestionMasivaPortal`, `aprobarOfertaCotizacionPortal`, `enviarACompraPortal` y `guardarDecisionCompraB17D` siguen siendo escritores de Sheets. La activación de escrituras en Supabase permanece detenida hasta definir con el usuario una estrategia de corte que no requiera modificar Apps Script y garantice un único escritor.

El worker de 13 hojas quedó activo manualmente y saludable en `127.0.0.1:8793`. La tarea supervisora registrada estaba en estado `Ready` (no corriendo). Su inicio fue rechazado por el control de seguridad porque el script también podría iniciar otros bridges, un gateway y un túnel público; no se reintentó ni se creó un mecanismo alternativo. Por tanto, la persistencia del worker después de reiniciar el equipo **no está garantizada**.

La conciliación alternativa incorpora `EQUIVALENCIAS_SKU` y `ORDENES` para estudiar proveedor+ITEM, SKU directo y otros cruces. La ruta productiva conserva deliberadamente la prioridad de mapeo y los dos estados de B12B, pero aplica la fuente original de Órdenes confirmada por el usuario.

### Dashboard — paso 1 de cierre: conciliación real de pendientes

El informe reproducible de sólo lectura `npm run bridge:compras-pending:report`
leyó el lote vigente `#2` del espejo Supabase el 16/09/2026. Se contrastaron
30.636 filas del modelo con 3.625 líneas de detalle; 3.613 líneas tenían un
estado y cantidad elegibles. Se resolvieron 3.180 líneas y quedaron 433 sin
asignación segura a un SKU único del modelo (325.613 unidades si se consideran
los cuatro estados). De estas, 414 líneas/310.153 unidades carecen de cruce,
14/13.120 apuntan fuera del modelo y 5/2.340 chocan con claves duplicadas.
Los ejemplos de mayor volumen incluyen `LXH6MPR` (20.000 unidades) y
`LXM5PR`, `LXM5-35`, `LXM5-18` (10.000 cada uno) en la orden `NT20251210A`.
No se imputan automáticamente a un SKU parecido.

El `PENDIENTE_TOTAL` persistido en `MODELO_COMPRAS` suma 2.731.541 unidades.
La reconstrucción de la fórmula B12B sobre el detalle actual (`CANTIDAD`, sólo
`EN FABRICA` y `EMBARCADO`) suma 3.906.477 unidades resueltas: diferencia
de 1.174.936 respecto del modelo. Incluso manteniendo esos dos estados y
usando `CANTIDAD_PENDIENTE`, el escenario actual resuelto suma 3.903.580
(+1.172.039). Por eso el desfase **no** se explica por añadir dos estados ni
por cambiar de cantidad original a saldo pendiente; el modelo y su detalle
actual no están conciliados. Entre los SKU del modelo, 744 tienen un valor
distinto del reconstruido con B12B y 42 tienen pendiente no cero sin líneas
actuales asignadas por esa fórmula.

Además, 65 líneas (424.276 unidades en los dos estados legacy) cambian de
SKU según se priorice el `SKU` explícito de `DETALLE_IMPORTACIONES` o la
canonización legacy de `ITEM` por `MAPA_SKU`. Por ejemplo, el detalle apunta
a `KLILED12961BLA5P` mientras B12B acumula `LED12961BLA5P`; ambos existen
en el modelo. No es una duplicación del total, sino una diferencia de
**asignación por SKU** que altera el riesgo y la sugerencia de compra. El
reporte separa estos casos (`allocationDisagreements`) y no elige cuál debe
ser el SKU definitivo. Las equivalencias proveedor+ITEM, ITEM único y
validación manual no resolvieron líneas adicionales en este lote.

Si se incluyen `A EMBARCAR` y `A INGRESAR`, el escenario resuelto de cuatro
estados sube a 4.447.545 unidades, 543.965 más que con dos estados. Es un
escenario distinto de Apps Script y no se aplica al Dashboard. Las 433 líneas
sin cruce seguro y las 65 divergentes se conservan en el informe para una
futura mejora de datos, pero **no bloquean** el port exacto de B12B: Apps
Script también asigna por `ITEM → MAPA_SKU` y omite lo que no cruza.

### Dashboard — recálculo legacy en memoria (implementado localmente)

El nuevo módulo `src/lib/compras-dashboard-model.ts` aplica sobre una copia
privada de `MODELO_COMPRAS` la misma secuencia B12B → B13 → B14 de Apps
Script para las columnas visibles en el Dashboard. B12B usa `CANTIDAD`
original y `STATUS_LINEA` sólo `EMBARCADO`/`EN FABRICA`; canoniza `ITEM` con
`MAPA_SKU` y luego con equivalencias validadas si aún no existía clave. No
prioriza el campo `SKU` del detalle ni suma `A EMBARCAR`/`A INGRESAR`. B13
obtiene cobertura objetivo de `MARCAS`, con prioridad de los overrides activos
de `PARAMETROS_COMPRAS` y default de cuatro meses. B14 recalcula cobertura
actual/futura, `COMPRA_SUGERIDA`, `RIESGO` y `PRIORIDAD` con los umbrales y
prioridades configurados. El Dashboard y su exportación consumen ese mismo
modelo en memoria; nunca se escribe sobre Google Sheets ni se persiste el
modelo recalculado.

Una ejecución read-only sobre el lote `#2` confirmó que existen todos los
encabezados y parámetros requeridos. La vista legacy de la captura fue abierta
el 16/09/2026, pero sus fuentes indicaban Warnes/Escobar del **01/09**, Ventas
del **31/08** y Órdenes del **03/09**. Por lo tanto, la verificación del port
se basa en reglas y fixtures; no se exige paridad de totales contra esa
captura usando snapshots automáticos más recientes. Además, la hoja
`MODELO_COMPRAS` fue recalculada manualmente en otro momento: el reporte
detectó 786 filas de pendiente, 3.880 de compra sugerida y 16.415 de riesgo
que cambiarían incluso al reaplicar las reglas al lote espejado. Esas cifras
son un diagnóstico de desfase de cargas, no métricas productivas del portal.

## Sincronización automática de Stock Warnes — completada

Flujo activo:

`Dashboard → POST /api/compras/sync-warnes → compras_sync_requests → GitHub Actions → Playwright/WMS → XLS → validación → Supabase → polling del portal → refresh del Dashboard`

- La tarjeta **Stock Warnes** incluye un botón activo `Actualizar`. El endpoint exige una sesión válida del portal y evita crear dos solicitudes simultáneas.
- `src/lib/compras-sync.ts` crea y consulta solicitudes en `portal_aftermarket.compras_sync_requests` y dispara `sync-warnes-stock.yml` mediante `workflow_dispatch`.
- `.github/workflows/sync-warnes-stock.yml` admite ejecución manual y automática todos los días a las 07:00 de Argentina (`10:00 UTC`). Marca la solicitud como `PROCESANDO`, `COMPLETADO` o `ERROR`.
- `workers/wms-stock/wms_stock_sync.py` inicia Playwright, ingresa al WMS, selecciona CD Warnes (`value=2`), genera “Stock de Contenedores por Artículo” sin detalle y descarga el XLS.
- El parser exige que el reporte identifique `CD WARNES`, encuentra `Artículo` y `Unidades Disponibles`, normaliza SKU en mayúsculas y sin espacios y consolida duplicados sumando stock.
- Controles previos a publicar: mínimo 4.000 SKU, variación máxima de 25 % en cantidad de SKU, variación máxima de 30 % en stock total y rechazo del mismo archivo mediante SHA-256. `--force` existe sólo para una variación extraordinaria verificada.
- Supabase conserva cabecera, ítems, errores y metadatos de cada importación. Sólo una importación `VALIDADO` puede convertirse en snapshot vigente.
- La migración `supabase/migrations/003_stock_compras.sql` crea `compras_stock_imports`, `compras_stock_import_items`, `compras_stock_import_errors`, `compras_stock_actual` y `compras_stock_actual_por_sku`. RLS está activo y el navegador no recibe la service role.
- La migración `005_compras_ventas.sql` amplía `compras_sync_requests` con el tipo y la FK independientes de Ventas, sin alterar la FK de Warnes.
- `src/lib/compras-stock-import.ts` contiene un importador XLS del lado servidor de una etapa anterior, pero actualmente no está conectado a ninguna ruta. El camino productivo de Warnes es el worker Python.
- El botón consulta cada 3 segundos durante un máximo aproximado de 6 minutos. Si muestra “Sigue en proceso”, GitHub Actions puede continuar hasta su timeout de 20 minutos.

Configuración privada usada por este flujo (registrar sólo nombres, nunca valores):

- Portal: `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `GITHUB_ACTIONS_TOKEN`; opcionales `GITHUB_ACTIONS_OWNER`, `GITHUB_ACTIONS_REPO`, `GITHUB_ACTIONS_REF`, `GITHUB_ACTIONS_WARNES_WORKFLOW`.
- GitHub Actions: secrets `WMS_BASE_URL`, `WMS_USERNAME`, `WMS_PASSWORD`, `SUPABASE_URL`, `SUPABASE_SECRET_KEY`.
- Worker local: las variables documentadas en `workers/wms-stock/.env.example`.

## Datos y lógica de las vistas

- Dashboard: lee el lote Supabase del espejo de `MODELO_COMPRAS`, `CONFIG_MARCAS_COMPRA`, `ALIAS_MARCAS_COMPRA`, `MAPA_SKU`, `CONTROL_IMPORTACIONES_STOCK`, `DETALLE_IMPORTACIONES`, `PENDIENTES_EQUIVALENCIA_IMPORT`, `PARAMETROS_COMPRAS` y `MARCAS`; Warnes, Escobar, Ventas y la frescura de Órdenes llegan desde sus snapshots independientes en Supabase.
- Gestión: lee `GESTION_COMPRAS_ACTIVA`, `CONFIG_MARCAS_COMPRA` y `ALIAS_MARCAS_COMPRA`. El origen y la política de compra se resuelven desde configuración y alias, como en el legacy; no se toman de columnas precalculadas de la hoja de Gestión.
- Cotizaciones: lee `GESTION_COMPRAS_ACTIVA`, `COTIZACIONES_COMPRA`, `COTIZACIONES_OFERTAS`, y sólo si falta `ORIGEN` en la hoja activa usa la configuración/alias de marcas. La bandeja incluye sólo SKU `IMPORTADO` con estado `COTIZAR` y `CANTIDAD_DECIDIDA > 0`, excluyendo los que figuran en una CT `ABIERTA`. Ordena por marca/SKU y calcula SKU, unidades y marcas. Los lotes CT agrupan sus ítems por `NRO_COTIZACION`; las ofertas se agrupan por proveedor (sin distinguir mayúsculas), con precio, cantidad, subtotal y total. El ranking compara precios unitarios positivos por SKU dentro de una misma moneda: empates en el mínimo son **MEJOR PRECIO** y el siguiente valor distinto es **2° PRECIO**. Para CT cerradas se muestra inicialmente la oferta seleccionada y se pueden expandir las demás.
- Bandeja de Compra: lee `GESTION_COMPRAS_ACTIVA`, `COTIZACIONES_COMPRA` y `COTIZACIONES_OFERTAS`. Incluye cualquier SKU con estado `APROBADO` y `CANTIDAD_DECIDIDA > 0`, sin filtrar por origen. Cuenta SKU, suma unidades, cuenta marcas y ordena por marca/SKU. El cruce con CT `APROBADA` y su oferta del proveedor seleccionado completa número de cotización, proveedor y código de proveedor cuando existen. La selección es local; **Enviar a Compra** está deshabilitado porque `enviarACompraPortal()` escribe en Sheets. La descarga CSV usa sólo los datos ya leídos en el navegador.
- Historial SKU: lee `GESTION_COMPRAS_ACTIVA`, `CONFIG_MARCAS_COMPRA`, `ALIAS_MARCAS_COMPRA`, `GESTION_COMPRAS`, `ENVIOS_COMPRA`, `COMPRAS_EN_PROCESO` y `MOVIMIENTOS_COMPRA`. `GESTION_COMPRAS_ACTIVA` aporta stock, consumo, cobertura, descripción y marca; `GESTION_COMPRAS` aporta la última decisión; `ENVIOS_COMPRA` y `MOVIMIENTOS_COMPRA` aportan todos los eventos respectivos; la última fila del SKU en `COMPRAS_EN_PROCESO` aporta estado y cantidades actuales. Si no hay eventos, se muestra el error legacy de SKU sin historial.
- Enviados a Compra: lee `ENVIOS_COMPRA`, `ORDENES_COMPRA_PORTAL` y `COMPRAS_EN_PROCESO`. Agrupa por `NRO_ENVIO`, cuenta filas/SKU, suma `CANTIDAD_DECIDIDA`, cuenta marcas distintas y ordena los lotes por número descendente. Las OC se deduplican por envío y número; el detalle indica la OC del SKU cuando existe. `COMPRAS_EN_PROCESO` y `ORDENES_COMPRA_PORTAL` aportan la lista única de proveedores, como `obtenerProveedoresOcPortal()`. Filtros locales por texto, fechas y marca; los KPIs superiores corresponden al total y el resumen inferior a los lotes visibles. No se portaron `generarOrdenCompraPortal()` ni la impresión de OC.
- Compras en Proceso: lee `COMPRAS_EN_PROCESO`, `ENVIOS_COMPRA` y `MOVIMIENTOS_COMPRA`. La sincronización que el legacy realizaba antes de leer se reproduce sólo en memoria.
- Packing List: lee `PACKING_LIST` y `PACKING_LIST_DETALLE`; no importa archivos ni cambia estados.
- Contenedores: lee `CONTENEDORES`, `CONTENEDOR_PACKING_LIST` y `PACKING_LIST`; no crea, edita ni asocia registros.
- Seguimiento: lee `ORDENES`, `HISTORIAL_ESTADOS_LOGISTICA` y `PACKING_LIST_DETALLE`; `ORDENES` conserva la verdad de `STATUS` y `SITUACION`.
- Recepciones: lee `ORDENES` y `DETALLE_IMPORTACIONES`; no porta `registrarRecepcion()` ni `registrarRecepcionesExcel()`.
- Transferencias: calcula sugerencias desde `GESTION_COMPRAS_ACTIVA` sin persistir movimientos.
- Las fechas seriales del Historial se interpretan con la zona horaria declarada por la planilla y se presentan en `America/Argentina/Buenos_Aires`, como el Apps Script. La planilla consultada declara `America/Los_Angeles`; por eso una celda visible como `07:15` allí aparece como `11:15` en el historial durante agosto. La conversión considera horario de verano.
- Gestión conserva los seis estados legacy: `PENDIENTE`, `COTIZAR`, `APROBADO`, `NO COMPRAR`, `POSTERGAR` y `ENVIADO A COMPRA`.
- El resumen de Gestión cuenta registros visibles, pendientes, estados distintos de pendiente y suma `COMPRA_SUGERIDA` de los registros filtrados.
- Los métodos operativos de escritura legacy, como `guardarDecisionCompraPortal`, `guardarGestionMasivaPortal`, generación de OC, recepción e importación logística, no se han portado. Las únicas escrituras nuevas habilitadas en Compras son las ingestas técnicas de Warnes, Ventas y Órdenes y el seguimiento de sus solicitudes en Supabase.

El último control read-only de Google Sheets confirmó encabezados compatibles y una lectura completa de las tres hojas de Gestión. En ese momento, `GESTION_COMPRAS_ACTIVA` tenía 3.697 SKU; el número puede cambiar.

## Automatización de Ventas — Hitos 1 y 2 completados

La fuente autoritativa es `VS_REPORTING.dbo.Vista_Ventas_origen_v2`. El worker
local `bridge/ventas-sync.mjs` replica la consulta legacy, netea unidades e
importe sin IVA, normaliza DTM/IMP/JNM/NLI/NLD y publica snapshots inmutables en
tablas exclusivas de Ventas. Se ejecuta cada dos horas y también procesa las
solicitudes manuales creadas desde el Dashboard.

El snapshot vigente contiene detalle mensual auditable por código, `COD_BAM`,
empresa y período. La migración `006_compras_ventas_demanda_legacy.sql` expone
una fila por SKU para la ventana fija agosto 2025–julio 2026. El portal pagina
esa vista, confirma que no cambió el ID de importación durante la lectura,
aplica `MAPA_SKU` y sustituye únicamente consumo de doce meses y promedio.

La validación del Hito 2 sobre el snapshot `import_id = 2` confirmó 11.879 SKU
antes del mapeo y 11.877 después de canonizar. Frente a la hoja `VENTAS`, sólo
6 SKU difirieron, con una diferencia neta total de 240 unidades. Frente a
`MODELO_COMPRAS`, 3.459 filas cambian porque el modelo persistido estaba
desactualizado; 27.177 ya coincidían. No se listaron datos por SKU ni secretos.

El recálculo integral B12B/B13/B14 ya está implementado localmente para el
Dashboard; la ventana de Ventas permanece fija. Queda desplegarlo y validar
en el portal con snapshots actuales, sin esperar paridad numérica con una
captura tomada con fechas de fuente distintas.

## Stock Escobar — integración temporal Octosis/Drive

El worker local `bridge/escobar-sync.mjs` lee una sola vez al día, a las 09:00 de
Argentina, el XLSX de inventario en una carpeta de Drive compartida en modo
lector con la cuenta de servicio. Filtra los depósitos que contienen `EXT`,
`REV`, `INV` o `TEP`, suma `Saldo` por `Código` (SKU BAM), valida volumen y
variación, y publica en las tablas de stock existentes con
`source_system=OCTOSIS` y `deposito=ESCOBAR`. No toca el snapshot Warnes.

El primer snapshot, importación #5, quedó `VALIDADO` el 16/09/2026 con 14.010
SKU y 7.515.104 unidades; se confirmó que Warnes #4 seguía validado. El
health check local respondió correctamente en `127.0.0.1:8791/health`.
La carpeta de septiembre está configurada; al crear la de octubre hay que
concederle lectura a la cuenta de servicio y actualizar
`ESCOBAR_DRIVE_FOLDER_ID`. Véase `docs/COMPRAS_ESCOBAR_SYNC.md`.

## Órdenes de compra — fuente temporal Excel/Drive

El archivo `STATUSIMPORTADO27101.xlsx` en Drive contiene varias pestañas. Para
el snapshot de órdenes se usa exclusivamente `STATUS ORDENES IMPORTADAS`, que
corresponde a la estructura legacy de `ORDENES`: número de orden, marca, ítem,
cantidad, `STATUS`, `SITUACION`, packing list, prueba/código auxiliar, precio
original y numérico, moneda, fecha y proveedor. La pestaña `STATUS REMANENTE`
es distinta y no se suma a esta extracción. `ITEM` no se presume SKU BAM.

`bridge/ordenes-sync.mjs` consulta este XLSX en modo sólo lectura una vez al
día a las 11:30 de Argentina (el archivo observado el 16/09 se modificó a las
11:05), y procesa solicitudes manuales de `/api/compras/sync-ordenes`. Los
snapshots independientes de `supabase/migrations/007_compras_ordenes.sql`
guardan cada línea, hash del contenido de la pestaña, conteos y errores de
validación. El Dashboard muestra la fecha del último snapshot validado.
La primera carga validada fue el snapshot #1 del 16/09/2026: 3.478 filas de
origen, 3.477 válidas, una sin `STATUS`, 223 órdenes y 4.305.489 unidades.
El worker local quedó activo en `127.0.0.1:8792/health`.
La primera ejecución programada de las 11:30 quedó `COMPLETADO` y reutilizó
el snapshot #1 sin duplicarlo; la próxima revisión quedó para el 17/09 a las
11:30. Cada intento automático genera una solicitud auditable.

**Estado de conexión con el Dashboard:** la ingesta, el botón manual, la
programación diaria, la migración SQL y la lectura de la fecha del último
snapshot validado están implementados. El Dashboard local también pagina las
líneas de ese snapshot, confirma que no cambió durante la lectura y recalcula
el pendiente. Este último cambio aún requiere despliegue y validación visual.

La vista de Seguimiento y Recepciones sigue leyendo la hoja `ORDENES` del
legacy. En el Dashboard, `PENDIENTE_TOTAL`, `EMBARCADO`, `EN_FABRICA`, `RIESGO`
y `COMPRA_SUGERIDA` se recalculan en memoria desde el snapshot original de
Órdenes. Una orden que desaparece del archivo deja de contar, sin rescatar
líneas antiguas del detalle espejado. El detalle de recepción logística
conserva `DETALLE_IMPORTACIONES.STATUS_LINEA`, `CANTIDAD_PENDIENTE` y
`CANTIDAD_RECIBIDA` para esa vista; no se reemplaza por el XLSX.

La regla B12B conservada usa `CANTIDAD` original y los dos estados legacy,
pero cambia de `DETALLE_IMPORTACIONES` al seguimiento autoritativo del XLSX.
Adoptar `CANTIDAD_PENDIENTE` y los cuatro estados logísticos sería una mejora
funcional posterior, distinta de la migración exacta; el informe de
conciliación conserva esa proyección sin aplicarla.

## Archivos principales

- `src/app/areas/compras/page.tsx`: selección de vista, auth y presentación del Dashboard.
- `src/components/compras-gestion-workspace.tsx`: filtros, resumen, tabla, panel prototipo de Gestión y enlace a Historial SKU.
- `src/components/compras-historial-workspace.tsx`: pantalla de Historial SKU y buscador de navegación, sin datos históricos simulados.
- `src/components/compras-envios-workspace.tsx`: filtros y ventana emergente de detalle read-only de Enviados a Compra.
- `src/components/compras-cotizaciones-workspace.tsx`: bandeja, lotes, ofertas y ranking de Cotizaciones.
- `src/components/compras-bandeja-workspace.tsx`: KPIs, tabla, selección y descarga de Bandeja de Compra.
- `src/lib/compras-cotizaciones.ts`: mapeo y cálculos puros de Cotizaciones.
- `src/lib/compras-bandeja.ts`: mapeo y cálculos puros de Bandeja de Compra.
- `src/lib/compras-envios.ts`: agrupación, KPIs y filtros puros de Enviados.
- `src/lib/compras-dates.ts`: conversión compartida de fechas seriales con la zona horaria de la planilla.
- `src/lib/compras-historial.ts`: mapeo puro de situación actual y eventos históricos.
- `src/components/compras-dashboard-actions.tsx`: actualizar y exportación del Dashboard.
- `src/components/compras-warnes-sync-button.tsx`: inicio y seguimiento visual de la actualización Warnes.
- `src/components/compras-ordenes-sync-button.tsx` y `src/app/api/compras/sync-ordenes/route.ts`: actualización manual autenticada de Órdenes.
- `src/lib/compras-sheets.ts`: acceso a Sheets en servidor para las vistas no migradas, con scope `spreadsheets.readonly`; el Dashboard usa el espejo Supabase.
- `src/lib/compras-sheet-supabase.ts`: lectura consistente y paginada del lote validado del espejo.
- `src/lib/compras-pending-reconciliation.ts` y `bridge/compras-pending-report.mjs`: diagnóstico por SKU de sólo lectura sobre el lote vigente, accesible también por la ruta autenticada de conciliación.
- `bridge/compras-sheets-sync.mjs`: copia periódica de sólo lectura del Sheet hacia Supabase.
- `supabase/migrations/008_compras_sheet_mirror.sql`: snapshots y publicación por lote para el espejo del Dashboard.
- `src/lib/compras-dashboard.ts` y `src/lib/compras-dashboard-model.ts`: agrupaciones puras del Dashboard y port en memoria de B12B/B13/B14.
- `src/lib/compras-stock-supabase.ts`: lectura del snapshot Warnes e inyección en memoria sobre el modelo legacy.
- `src/lib/compras-ventas-supabase.ts`: lectura paginada y consistente del snapshot vigente de Ventas.
- `src/lib/compras-ventas-model.ts`: canonización con `MAPA_SKU` e inyección pura de consumo/promedio.
- `src/lib/compras-sync.ts`: solicitudes de sincronización y dispatch del workflow de Warnes.
- `bridge/ventas-sync.mjs`: extracción SQL, validación, idempotencia y publicación automática/manual de Ventas.
- `bridge/escobar-sync.mjs` y `bridge/escobar-parse.mjs`: detección diaria en Drive, parser XLSX y publicación de Escobar.
- `bridge/ordenes-sync.mjs` y `bridge/ordenes-parse.mjs`: lectura diaria/manual del XLSX de Órdenes, validación y publicación.
- `src/lib/compras-ordenes-supabase.ts`: lectura de la frescura del snapshot de Órdenes para el Dashboard.
- `src/app/api/compras/sync-warnes/route.ts`: endpoint autenticado para iniciar y consultar la sincronización.
- `workers/wms-stock/wms_stock_sync.py`: automatización productiva WMS → Supabase.
- `.github/workflows/sync-warnes-stock.yml`: ejecución manual/programada del worker.
- `supabase/migrations/003_stock_compras.sql` a `007_compras_ordenes.sql`: persistencia, vistas, seguridad y seguimiento independiente de Warnes, Ventas y Órdenes.
- `src/lib/compras-gestion.ts`: mapeo, filtros y resumen puros de Gestión.
- `src/app/api/compras/dashboard-export/route.ts`: XLSX del Dashboard, sin escrituras en Google.
- `tests/compras-dashboard.test.mjs`, `tests/compras-gestion.test.mjs`, `tests/compras-historial.test.mjs`, `tests/compras-envios.test.mjs`, `tests/compras-cotizaciones.test.mjs` y `tests/compras-bandeja.test.mjs`: pruebas de lógica.

Para la lectura temporal de Sheets se requieren `GOOGLE_SHEETS_SPREADSHEET_ID`, `GOOGLE_SERVICE_ACCOUNT_EMAIL` y `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY`. Para Supabase, `SUPABASE_URL` y `SUPABASE_SECRET_KEY`. Los nombres de configuración GitHub del portal están detallados en la sección Warnes. **No registrar valores secretos en este documento, no versionarlos y no enviarlos al navegador.**

## Verificación y pendientes

La lógica de Dashboard, Gestión e Historial pasó 11 pruebas unitarias en la etapa anterior. En la incorporación de Enviados pasaron 8 pruebas puntuales de Gestión, Historial y Enviados, además de la comprobación de tipos; no se hizo una compilación completa. El ajuste de la ventana emergente pasó una comprobación de tipos, ESLint focalizado y la prueba puntual de Enviados, sin compilación completa. La inspección visual previa se realizó en `/areas/compras?vista=gestion` con una sesión autorizada: se verificaron las 15 columnas y la ausencia de desborde horizontal a 1282 px. El panel **Gestionar** se probó con un SKU real: cambios locales de cantidad y observación no alteraron la tabla, y al reabrir se recuperaron los valores originales. **Guardar** está deshabilitado. Se verificó que **Historial** navega a la vista propia con el SKU precargado y que **Buscar** cambia el SKU consultado. Con `KLILED13961GELBL`, el portal mostró los mismos valores de la captura legacy (incluidos consumo mensual 2.819, cantidad decidida 100 y evento del 12/08/2026 11:15). En **Enviados a Compra**, se abrió `EC-20260828-0002` y se comprobaron sus 230 unidades, fecha 28/08/2026 11:11, proveedor disponible y SKU de detalle. Con `EC-20260828-0001` se comprobó que la OC existente aparece y el SKU asignado no se puede seleccionar. Conviene validar también el ancho final del monitor del usuario.

La diferencia de horas observada previamente en `FECHA_DECISION` de **Gestión** ya tiene causa: la planilla usa `America/Los_Angeles` y el proyecto Apps Script `America/Argentina/Buenos_Aires`. Gestión e Historial SKU ahora interpretan los seriales según la zona horaria real de la planilla. No se modificaron datos en Sheets.

Cotizaciones pasó una comprobación de tipos, ESLint focalizado y una prueba puntual que cubre elegibilidad, exclusión de CT abiertas, agrupación de ofertas y ranking; no se ejecutó una compilación completa. Aún falta comparar visualmente la nueva vista con datos reales del portal. La selección de pendientes, los códigos/precios y los datos del importador son borradores locales; **Crear cotización**, **Guardar oferta**, **Aprobar oferta**, **Plantilla** e **Importar ofertas** se muestran deshabilitados. Ninguno escribe en Google Sheets.

Bandeja de Compra quedó incorporada en la navegación antes de Enviados a Compra. Pasaron la comprobación de tipos, ESLint focalizado y una prueba puntual de elegibilidad, KPIs y cruce de la oferta seleccionada; no se ejecutó una compilación completa. Falta validar visualmente la vista con datos reales del portal. **Enviar a Compra** permanece deshabilitado y no existe una operación de escritura nueva.

La conexión automática completa de Warnes fue confirmada funcionalmente por el usuario el 15/09/2026. Ventas Hito 2 pasó 7 pruebas focalizadas, TypeScript, ESLint focalizado y `git diff --check`; no se ejecutó una compilación completa. Escobar pasó una extracción de sólo lectura real desde Drive, validó y publicó el snapshot #5; el worker local quedó ejecutándose. No se hizo una compilación completa.

Órdenes pasó parsing del XLSX real, comprobación de tipos, ESLint focalizado,
chequeos sintácticos y `git diff --check`, sin compilación completa. La
migración `007` se aplicó en Supabase; se verificaron las 3.477 líneas del
snapshot #1 y una solicitud programada `COMPLETADO` que reutilizó ese snapshot.
El worker local siguió saludable y los demás bridges respondieron `ok`.
No se verificó aún la presentación ni el botón en el portal desplegado.

El recálculo local B12B/B13/B14 pasó dos pruebas focalizadas nuevas, las cuatro
pruebas existentes del Dashboard, comprobación de tipos y ESLint focalizado.
El informe read-only sobre el lote Supabase `#2` ejecutó el motor con los
encabezados reales sin error. No se hizo compilación completa ni se validó
visualmente el resultado desplegado.

Pendiente de aprobación y definición funcional: conectar **Guardar** de Gestión, **Enviar a Compra** de Bandeja, **Generar OC** de Enviados y los flujos de escritura de Cotizaciones, Compras en Proceso, Packing List, Contenedores y Recepciones. Esas vistas ya existen en modo consulta; sus botones de escritura continúan deshabilitados. No habilitar operaciones remotas de escritura sin implementación real y validación específica.

Este proyecto usa Next.js 16.3.4. Antes de modificar código Next, consultar la guía pertinente en `node_modules/next/dist/docs/`, según `AGENTS.md`.

## Traspaso a otro chat

Para retomar, leer primero este archivo completo y `AGENTS.md`, verificar rama y `git status`, y leer las guías relevantes de `node_modules/next/dist/docs/` antes de tocar código Next.js. El estado base esperado incluye las migraciones `003` y `004`, el workflow `sync-warnes-stock.yml`, el worker `workers/wms-stock/` y el botón de Warnes en el Dashboard.

Ventas Hitos 1 y 2, la ingesta temporal de Escobar y la ingesta/frescura de Órdenes están implementados. Proteger sus workers locales y la sincronización Warnes ya validada. El Dashboard dispone localmente del cálculo en memoria de B12B/B13/B14, ahora alimentado por el snapshot original de Órdenes, y de un informe de conciliación histórica con `DETALLE_IMPORTACIONES`; falta commit/push, despliegue y validación funcional en el portal. No interpretar el desacuerdo de totales con la captura del 16/09 como error por sí mismo: las fechas de carga de las cuatro fuentes difieren.

### Prompt sugerido para una conversación nueva

```text
Continuemos la migración del sistema de Compras en el proyecto Grupo Aftermarket. Trabajá en el estado actual del repositorio y leé primero AGENTS.md y docs/COMPRAS_MIGRACION_ESTADO.md completos.

Warnes funciona de punta a punta y fue validado al 100 %. Ventas Hitos 1 y 2,
Stock Escobar y la ingesta/frescura de Órdenes están implementados. No rompas
esas conexiones. Google Sheets sigue siendo sólo lectura y las credenciales
nunca deben llegar al navegador.

Verificá el cálculo local del Dashboard que aplica B12B/B13/B14 en memoria sobre
snapshots de Supabase; después desplegalo y validá KPI, exportación y frescura
en el portal. El pendiente usa el XLSX autoritativo de Órdenes, no el detalle
espejado, pero mantiene los dos estados de la regla B12B. Una orden ausente
del XLSX ya no está pendiente. El detalle sigue siendo fuente de recepción.
La captura legacy del 16/09 muestra fuentes más antiguas que los snapshots automáticos.
No escribas en Google Sheets, no expongas secretos y evitá pruebas innecesarias.
```
