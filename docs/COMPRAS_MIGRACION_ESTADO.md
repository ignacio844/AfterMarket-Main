# Migración de Compras: contexto y estado

Última actualización: 15/09/2026.

## Objetivo y decisiones vigentes

Se está migrando el sistema de Compras de Google Apps Script + Google Sheets (fuentes en `docs/sistema-importaciones-legacy/`) al portal Grupo Aftermarket, construido con Next.js. La ruta canónica es `/areas/compras`; no debe crearse `/compras` ni una redirección.

Google Sheets continúa como fuente temporal **solo de lectura** para los datos todavía no migrados. Toda llamada a Google y el uso de credenciales ocurren del lado servidor. Se usa exclusivamente la autenticación del portal actual (NextAuth con Google y `isPortalUserAllowed`). No se escribe en Sheets ni se ejecuta o porta allí ningún proceso que recalcule `MODELO_COMPRAS`.

La migración de fuentes automatizadas ya comenzó. **Stock Warnes está migrado a Supabase y su sincronización automática fue validada por el usuario como efectiva al 100 %.** El worker escribe snapshots auditables en Supabase, no en Google Sheets. El siguiente objetivo acordado es **Ventas**.

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

La vista de Gestión muestra las columnas SKU, descripción, marca, origen, objetivo, cobertura actual, riesgo, política, compra sugerida, estado, cantidad decidida, responsable, observación, fecha de decisión y acción. La tabla tiene diseño compacto y la vista admite hasta 1920 px de ancho. Se comprobó en el navegador del portal a 1282 px de viewport que las 15 columnas entran sin desbordamiento horizontal; por debajo de aproximadamente 1250 px puede aparecer desplazamiento horizontal para conservar todas las columnas.

Los botones **Gestionar** e **Historial** son visibles en cada fila. **Gestionar** abre un panel prototipo con SKU, descripción, marca, riesgo y compra sugerida; permite cambiar localmente estado de gestión, cantidad decidida y observación (máximo 1000 caracteres). **Guardar** permanece deshabilitado: cerrar descarta el borrador y no modifica la tabla ni Google Sheets. **Historial** navega a la vista Historial SKU con el código precargado, como `irHistorialSku()` en Apps Script, y consulta los datos reales al abrirse. En la tabla, `Cantidad decidida` es texto, no un campo editable.

## Arquitectura actual del Dashboard

El Dashboard en `/areas/compras` conserva la lógica de `obtenerDashboardPortalCompras()` y presenta:

- estado de actualización de Stock Warnes, Stock Escobar, Ventas y Órdenes;
- KPIs de SKU sin stock, urgentes, comprar, revisar, stock físico, pendiente de recibir, cobertura ponderada y compra sugerida;
- tablas de marcas importadas y nacionales, con riesgo, compra sugerida, consumo trimestral promedio, cobertura actual y objetivo;
- cantidad de marcas excluidas de nuevas compras;
- actualización de la página y exportación XLSX. La exportación llama al mismo `getComprasDashboard()`, por lo que utiliza también el snapshot vigente de Warnes.

La fuente es actualmente **híbrida**:

1. `src/lib/compras-sheets.ts` lee en paralelo Google Sheets y el snapshot Warnes vigente de Supabase.
2. Desde Sheets obtiene `MODELO_COMPRAS`, configuración y alias de marcas, `CONTROL_IMPORTACIONES_STOCK`, sólo las filas 1 y 2 de `VENTAS`, y `LOG_IMPORTACIONES`.
3. `src/lib/compras-stock-supabase.ts` pagina la vista `compras_stock_actual_por_sku` de Supabase y obtiene `stock_warnes`, fecha e ID de importación.
4. Antes de calcular el Dashboard, `applyWarnesStockToDashboardModel()` reemplaza en memoria `STOCK_WARNES` por SKU. Si un SKU del modelo no existe en el snapshot completo, su Warnes actual se considera `0`. Luego recalcula únicamente `STOCK_TOTAL = WARNES Supabase + ESCOBAR Sheets`.
5. `applyWarnesImportDateToControlStock()` reemplaza en memoria la fecha de Warnes para que la tarjeta de frescura refleje la importación real de Supabase.
6. `calculateComprasDashboard()` calcula agrupaciones y KPIs sin modificar ninguna fuente.

**Límite importante del estado actual:** `RIESGO`, `PENDIENTE_TOTAL`, `PROMEDIO_MENSUAL`, `CONSUMO_12_MESES` y `COMPRA_SUGERIDA` todavía provienen de las columnas ya calculadas de `MODELO_COMPRAS` en Sheets. Sólo `STOCK_WARNES` y `STOCK_TOTAL` son sustituidos en memoria. Por lo tanto, aunque el KPI de stock y las coberturas agregadas usan el Warnes nuevo, la clasificación de riesgo y la compra sugerida no se recalculan automáticamente a partir de ese cambio. Este acoplamiento debe resolverse cuando todas las fuentes necesarias estén migradas; no alterar esa lógica accidentalmente durante la fase Ventas.

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
- La migración `004_compras_sync_requests.sql` sólo admite actualmente `sync_type = STOCK_WARNES`; Ventas necesitará una migración propia o una ampliación explícita, no reutilizar ese valor.
- `src/lib/compras-stock-import.ts` contiene un importador XLS del lado servidor de una etapa anterior, pero actualmente no está conectado a ninguna ruta. El camino productivo de Warnes es el worker Python.
- El botón consulta cada 3 segundos durante un máximo aproximado de 6 minutos. Si muestra “Sigue en proceso”, GitHub Actions puede continuar hasta su timeout de 20 minutos.

Configuración privada usada por este flujo (registrar sólo nombres, nunca valores):

- Portal: `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `GITHUB_ACTIONS_TOKEN`; opcionales `GITHUB_ACTIONS_OWNER`, `GITHUB_ACTIONS_REPO`, `GITHUB_ACTIONS_REF`, `GITHUB_ACTIONS_WARNES_WORKFLOW`.
- GitHub Actions: secrets `WMS_BASE_URL`, `WMS_USERNAME`, `WMS_PASSWORD`, `SUPABASE_URL`, `SUPABASE_SECRET_KEY`.
- Worker local: las variables documentadas en `workers/wms-stock/.env.example`.

## Datos y lógica de las vistas

- Dashboard: lee `MODELO_COMPRAS`, `CONFIG_MARCAS_COMPRA`, `ALIAS_MARCAS_COMPRA`, `CONTROL_IMPORTACIONES_STOCK`, `VENTAS` y `LOG_IMPORTACIONES`.
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
- Los métodos operativos de escritura legacy, como `guardarDecisionCompraPortal`, `guardarGestionMasivaPortal`, generación de OC, recepción e importación logística, no se han portado. La única escritura nueva habilitada en Compras es la ingesta técnica de Warnes y el seguimiento de su solicitud en Supabase.

El último control read-only de Google Sheets confirmó encabezados compatibles y una lectura completa de las tres hojas de Gestión. En ese momento, `GESTION_COMPRAS_ACTIVA` tenía 3.697 SKU; el número puede cambiar.

## Próximo objetivo: automatización de Ventas

Estado actual:

- No existe todavía una tabla, snapshot, worker ni endpoint de sincronización de Ventas para Compras en Supabase.
- El Dashboard consulta únicamente `VENTAS!1:2` para leer `FECHA_IMPORTACION` y pintar la frescura de la fuente.
- Los datos de demanda que realmente afectan el Dashboard (`PROMEDIO_MENSUAL` y `CONSUMO_12_MESES`) siguen llegando dentro de `MODELO_COMPRAS`.

El legacy relevante está en:

- `docs/sistema-importaciones-legacy/importador_ventas.gs`: busca el XLSX más reciente en una carpeta fija de Drive, lo valida, reemplaza completamente `VENTAS`, agrega `ARCHIVO_ORIGEN` y `FECHA_IMPORTACION` y registra el resultado en `LOG_IMPORTACIONES`.
- `importador_ventas_ui.html`: búsqueda, confirmación y resultado de la importación manual.
- `ventas_modelo.gs`: detecta automáticamente todos los pares mensuales y construye el modelo de demanda por SKU.
- `30_admin_ventas.gs`: consulta administrativa de la hoja `VENTAS` y cruce de marca mediante stock.

Formato legacy esperado: `Código`, `Cod_BAM`, `Descripción`; pares dinámicos `MES_AAAA` y `Total_MES_AAAA`; `Total_Unidades_Netas`, `Total_Facturado_Neto_S_IVA`; empresas `DTM`, `IMP`, `JNM`, `NLI`, `NLD`; más `ARCHIVO_ORIGEN` y `FECHA_IMPORTACION` agregados por el importador. Se descartan filas sin `Cod_BAM`, se contabilizan duplicados pero el legacy no los elimina, y la hoja se reemplaza completa.

Existe además una conexión SQL ya operativa para el área Ejecutiva: `bridge/server.mjs` consulta `VS_REPORTING.dbo.Vista_Ventas_origen_v2` cada dos horas y guarda una caché local. Esa consulta actual sólo conserva conteos diarios de renglones/pedidos y familias; **no contiene las unidades, importes ni series mensuales por SKU necesarias para reemplazar `VENTAS`**. Puede reutilizarse su patrón seguro de acceso, pero no su payload actual.

Antes de implementar Ventas hay que confirmar con el usuario:

1. fuente autoritativa nueva: SQL Server/`Vista_Ventas_origen_v2`, otro endpoint o continuar partiendo del XLSX;
2. significado y mapeo de `articulo` frente a `Cod_BAM` y `Código`, y de `Base_Origen` frente a las cinco empresas;
3. período histórico requerido, frecuencia y horario de sincronización;
4. si esta etapa sólo debe crear el snapshot auditable de Ventas y su indicador de frescura, o también sustituir en memoria `PROMEDIO_MENSUAL`/`CONSUMO_12_MESES`;
5. si el origen SQL es accesible desde GitHub Actions. Si es privado, usar un worker/bridge dentro de la red y no exponer credenciales SQL al portal ni al navegador.

Diseño esperado, sujeto a ese diagnóstico: snapshots inmutables de importación en Supabase, detalle normalizado por SKU y período, errores separados, hash o identificador idempotente, controles de volumen y variación, vista del último snapshot validado y trazabilidad de solicitudes. No reutilizar las tablas de stock: sus restricciones sólo aceptan WMS/OCTOSIS y Warnes/Escobar.

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
- `src/lib/compras-sheets.ts`: acceso a Sheets en servidor, con scope `spreadsheets.readonly`.
- `src/lib/compras-dashboard.ts`: cálculos puros del Dashboard y utilidades compartidas.
- `src/lib/compras-stock-supabase.ts`: lectura del snapshot Warnes e inyección en memoria sobre el modelo legacy.
- `src/lib/compras-sync.ts`: solicitudes de sincronización y dispatch del workflow de Warnes.
- `src/app/api/compras/sync-warnes/route.ts`: endpoint autenticado para iniciar y consultar la sincronización.
- `workers/wms-stock/wms_stock_sync.py`: automatización productiva WMS → Supabase.
- `.github/workflows/sync-warnes-stock.yml`: ejecución manual/programada del worker.
- `supabase/migrations/003_stock_compras.sql` y `004_compras_sync_requests.sql`: persistencia, vistas, seguridad y seguimiento de Warnes.
- `src/lib/compras-gestion.ts`: mapeo, filtros y resumen puros de Gestión.
- `src/app/api/compras/dashboard-export/route.ts`: XLSX del Dashboard, sin escrituras en Google.
- `tests/compras-dashboard.test.mjs`, `tests/compras-gestion.test.mjs`, `tests/compras-historial.test.mjs`, `tests/compras-envios.test.mjs`, `tests/compras-cotizaciones.test.mjs` y `tests/compras-bandeja.test.mjs`: pruebas de lógica.

Para la lectura temporal de Sheets se requieren `GOOGLE_SHEETS_SPREADSHEET_ID`, `GOOGLE_SERVICE_ACCOUNT_EMAIL` y `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY`. Para Supabase, `SUPABASE_URL` y `SUPABASE_SECRET_KEY`. Los nombres de configuración GitHub del portal están detallados en la sección Warnes. **No registrar valores secretos en este documento, no versionarlos y no enviarlos al navegador.**

## Verificación y pendientes

La lógica de Dashboard, Gestión e Historial pasó 11 pruebas unitarias en la etapa anterior. En la incorporación de Enviados pasaron 8 pruebas puntuales de Gestión, Historial y Enviados, además de la comprobación de tipos; no se hizo una compilación completa. El ajuste de la ventana emergente pasó una comprobación de tipos, ESLint focalizado y la prueba puntual de Enviados, sin compilación completa. La inspección visual previa se realizó en `/areas/compras?vista=gestion` con una sesión autorizada: se verificaron las 15 columnas y la ausencia de desborde horizontal a 1282 px. El panel **Gestionar** se probó con un SKU real: cambios locales de cantidad y observación no alteraron la tabla, y al reabrir se recuperaron los valores originales. **Guardar** está deshabilitado. Se verificó que **Historial** navega a la vista propia con el SKU precargado y que **Buscar** cambia el SKU consultado. Con `KLILED13961GELBL`, el portal mostró los mismos valores de la captura legacy (incluidos consumo mensual 2.819, cantidad decidida 100 y evento del 12/08/2026 11:15). En **Enviados a Compra**, se abrió `EC-20260828-0002` y se comprobaron sus 230 unidades, fecha 28/08/2026 11:11, proveedor disponible y SKU de detalle. Con `EC-20260828-0001` se comprobó que la OC existente aparece y el SKU asignado no se puede seleccionar. Conviene validar también el ancho final del monitor del usuario.

La diferencia de horas observada previamente en `FECHA_DECISION` de **Gestión** ya tiene causa: la planilla usa `America/Los_Angeles` y el proyecto Apps Script `America/Argentina/Buenos_Aires`. Gestión e Historial SKU ahora interpretan los seriales según la zona horaria real de la planilla. No se modificaron datos en Sheets.

Cotizaciones pasó una comprobación de tipos, ESLint focalizado y una prueba puntual que cubre elegibilidad, exclusión de CT abiertas, agrupación de ofertas y ranking; no se ejecutó una compilación completa. Aún falta comparar visualmente la nueva vista con datos reales del portal. La selección de pendientes, los códigos/precios y los datos del importador son borradores locales; **Crear cotización**, **Guardar oferta**, **Aprobar oferta**, **Plantilla** e **Importar ofertas** se muestran deshabilitados. Ninguno escribe en Google Sheets.

Bandeja de Compra quedó incorporada en la navegación antes de Enviados a Compra. Pasaron la comprobación de tipos, ESLint focalizado y una prueba puntual de elegibilidad, KPIs y cruce de la oferta seleccionada; no se ejecutó una compilación completa. Falta validar visualmente la vista con datos reales del portal. **Enviar a Compra** permanece deshabilitado y no existe una operación de escritura nueva.

La conexión automática completa de Warnes fue confirmada funcionalmente por el usuario el 15/09/2026. Este relevamiento documental no volvió a ejecutar el workflow ni una compilación completa. El árbol de trabajo estaba limpio antes de esta actualización del MD.

Pendiente de aprobación y definición funcional: conectar **Guardar** de Gestión, **Enviar a Compra** de Bandeja, **Generar OC** de Enviados y los flujos de escritura de Cotizaciones, Compras en Proceso, Packing List, Contenedores y Recepciones. Esas vistas ya existen en modo consulta; sus botones de escritura continúan deshabilitados. No habilitar operaciones remotas de escritura sin implementación real y validación específica.

Este proyecto usa Next.js 16.3.4. Antes de modificar código Next, consultar la guía pertinente en `node_modules/next/dist/docs/`, según `AGENTS.md`.

## Traspaso a otro chat

Para retomar, leer primero este archivo completo y `AGENTS.md`, verificar rama y `git status`, y leer las guías relevantes de `node_modules/next/dist/docs/` antes de tocar código Next.js. El estado base esperado incluye las migraciones `003` y `004`, el workflow `sync-warnes-stock.yml`, el worker `workers/wms-stock/` y el botón de Warnes en el Dashboard.

El siguiente trabajo no es una nueva vista: es la **conexión automática de Ventas**. Proteger la sincronización Warnes ya validada, no cambiar sus tablas o contratos salvo necesidad demostrada y no depender de rutas temporales de capturas. Las conexiones complejas se desarrollan fuente por fuente; después de Ventas quedarán Stock Escobar y Órdenes, y recién con las fuentes necesarias migradas deberá planificarse el reemplazo del cálculo heredado de `MODELO_COMPRAS`.

### Prompt sugerido para una conversación nueva

```text
Continuemos la migración del sistema de Compras en el proyecto Grupo Aftermarket. Trabajá en el estado actual del repositorio y leé primero AGENTS.md y docs/COMPRAS_MIGRACION_ESTADO.md completos.

La conexión automática de Stock Warnes ya funciona de punta a punta y fue validada al 100 %. No la reemplaces ni la rompas. Su flujo actual es Portal → solicitud en Supabase → GitHub Actions → worker Playwright/WMS → XLS validado → snapshot en Supabase → Dashboard. Google Sheets sigue siendo sólo lectura y las credenciales nunca deben llegar al navegador.

El próximo objetivo es automatizar la fuente VENTAS. Antes de programar, analizá:
- la dependencia actual del Dashboard respecto de VENTAS y MODELO_COMPRAS;
- docs/sistema-importaciones-legacy/importador_ventas.gs, importador_ventas_ui.html, ventas_modelo.gs y 30_admin_ventas.gs;
- el patrón implementado para Warnes en workers/wms-stock/, .github/workflows/sync-warnes-stock.yml, supabase/migrations/003_stock_compras.sql y 004_compras_sync_requests.sql, src/lib/compras-stock-supabase.ts, src/lib/compras-sync.ts y src/app/api/compras/sync-warnes/route.ts;
- la conexión SQL existente en bridge/server.mjs y docs/EXECUTIVE_SQL_BRIDGE.md. La consulta ejecutiva actual a VS_REPORTING.dbo.Vista_Ventas_origen_v2 sólo devuelve conteos agregados y no reemplaza la serie de unidades/facturación por SKU.

Necesito que determines cuál debe ser la fuente autoritativa y me pidas únicamente los datos que falten para confirmarla: SQL/Vista_Ventas_origen_v2, otro endpoint o el XLSX legacy. Verificá el mapeo articulo ↔ Cod_BAM/Código, Base_Origen ↔ DTM/IMP/JNM/NLI/NLD, período histórico, unidades netas, facturación neta sin IVA, frecuencia y accesibilidad desde el ejecutor.

Proponé primero un plan concreto para Ventas con esquema de snapshots auditables en Supabase, idempotencia, validaciones, actualización automática/manual, seguridad y estrategia de lectura desde el Dashboard. Diferenciá claramente dos hitos: (1) ingesta + frescura de Ventas; (2) sustitución en memoria de PROMEDIO_MENSUAL/CONSUMO_12_MESES y, más adelante, recálculo completo de riesgo/compra sugerida. No escribas Google Sheets, no expongas secretos y no mezcles Ventas con las tablas de stock. No programes hasta que yo confirme la fuente y apruebe el plan. Evitá compilaciones y pruebas innecesarias; hacé sólo verificaciones focalizadas cuando corresponda.
```
