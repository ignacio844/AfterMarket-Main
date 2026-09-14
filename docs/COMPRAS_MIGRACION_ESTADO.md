# Migración de Compras: contexto y estado

Última actualización: 14/09/2026.

## Objetivo y decisiones vigentes

Se está migrando el sistema de Compras de Google Apps Script + Google Sheets (fuentes en `docs/sistema-importaciones-legacy/`) al portal Grupo Aftermarket, construido con Next.js. La ruta canónica es `/areas/compras`; no debe crearse `/compras` ni una redirección.

Google Sheets es una fuente temporal **solo de lectura**. Toda llamada a Google y el uso de credenciales ocurren del lado servidor. Se usa exclusivamente la autenticación del portal actual (NextAuth con Google y `isPortalUserAllowed`). No se escribe en Sheets ni se ejecuta o porta ningún proceso que recalcule `MODELO_COMPRAS`.

No modificar otras secciones del portal salvo lo estrictamente necesario para Compras. La UI debe seguir la estética de Grupo Aftermarket, sin copiar visualmente el sistema legacy.

## Estado implementado

| Vista | Ruta | Alcance |
| --- | --- | --- |
| Dashboard | `/areas/compras` | Port de `obtenerDashboardPortalCompras()` y representación adaptada de `cargarDashboard()` / `dibujarMarcasDashboard()`. KPIs, estado de fuentes y tablas por origen. Exportación XLSX del Dashboard. |
| Gestión de Compras | `/areas/compras?vista=gestion` | Port read-only de `obtenerGestionComprasPortal()`: registros, filtros por texto/riesgo/estado/marca/política, resumen sobre registros filtrados y tabla paginada de 50 filas. |
| Cotizaciones | `/areas/compras?vista=cotizaciones` | Port read-only de `obtenerBandejaCotizacionPortal()` y `obtenerCotizacionesPortal()`: pendientes importados, lotes CT, ofertas y ranking por SKU/moneda. |
| Bandeja de Compra | `/areas/compras?vista=bandeja` | Port read-only de `obtenerBandejaCompraPortal()`: SKU aprobados pendientes, KPIs, selección local y descarga CSV. |
| Enviados a Compra | `/areas/compras?vista=envios` | Port read-only de `obtenerEnviosCompraPortal()`: lotes, KPIs, filtros, OC asociadas y detalle de SKU por envío. |
| Historial SKU | `/areas/compras?vista=historial&sku=...` | Port read-only de `obtenerHistorialSkuPortal()`: situación actual, buscador y línea de tiempo cronológica con decisión, envíos y movimientos. |

La navegación de vistas implementadas sigue el flujo del legacy: Dashboard → Gestión → Cotizaciones → Bandeja de Compra → Enviados a Compra → Historial SKU. Las secciones intermedias aún no implementadas no se añadieron como pestañas vacías.

La vista de Gestión muestra las columnas SKU, descripción, marca, origen, objetivo, cobertura actual, riesgo, política, compra sugerida, estado, cantidad decidida, responsable, observación, fecha de decisión y acción. La tabla tiene diseño compacto y la vista admite hasta 1920 px de ancho. Se comprobó en el navegador del portal a 1282 px de viewport que las 15 columnas entran sin desbordamiento horizontal; por debajo de aproximadamente 1250 px puede aparecer desplazamiento horizontal para conservar todas las columnas.

Los botones **Gestionar** e **Historial** son visibles en cada fila. **Gestionar** abre un panel prototipo con SKU, descripción, marca, riesgo y compra sugerida; permite cambiar localmente estado de gestión, cantidad decidida y observación (máximo 1000 caracteres). **Guardar** permanece deshabilitado: cerrar descarta el borrador y no modifica la tabla ni Google Sheets. **Historial** navega a la vista Historial SKU con el código precargado, como `irHistorialSku()` en Apps Script, y consulta los datos reales al abrirse. En la tabla, `Cantidad decidida` es texto, no un campo editable.

## Datos y lógica

- Dashboard: lee `MODELO_COMPRAS`, `CONFIG_MARCAS_COMPRA`, `ALIAS_MARCAS_COMPRA`, `CONTROL_IMPORTACIONES_STOCK`, `VENTAS` y `LOG_IMPORTACIONES`.
- Gestión: lee `GESTION_COMPRAS_ACTIVA`, `CONFIG_MARCAS_COMPRA` y `ALIAS_MARCAS_COMPRA`. El origen y la política de compra se resuelven desde configuración y alias, como en el legacy; no se toman de columnas precalculadas de la hoja de Gestión.
- Cotizaciones: lee `GESTION_COMPRAS_ACTIVA`, `COTIZACIONES_COMPRA`, `COTIZACIONES_OFERTAS`, y sólo si falta `ORIGEN` en la hoja activa usa la configuración/alias de marcas. La bandeja incluye sólo SKU `IMPORTADO` con estado `COTIZAR` y `CANTIDAD_DECIDIDA > 0`, excluyendo los que figuran en una CT `ABIERTA`. Ordena por marca/SKU y calcula SKU, unidades y marcas. Los lotes CT agrupan sus ítems por `NRO_COTIZACION`; las ofertas se agrupan por proveedor (sin distinguir mayúsculas), con precio, cantidad, subtotal y total. El ranking compara precios unitarios positivos por SKU dentro de una misma moneda: empates en el mínimo son **MEJOR PRECIO** y el siguiente valor distinto es **2° PRECIO**. Para CT cerradas se muestra inicialmente la oferta seleccionada y se pueden expandir las demás.
- Bandeja de Compra: lee `GESTION_COMPRAS_ACTIVA`, `COTIZACIONES_COMPRA` y `COTIZACIONES_OFERTAS`. Incluye cualquier SKU con estado `APROBADO` y `CANTIDAD_DECIDIDA > 0`, sin filtrar por origen. Cuenta SKU, suma unidades, cuenta marcas y ordena por marca/SKU. El cruce con CT `APROBADA` y su oferta del proveedor seleccionado completa número de cotización, proveedor y código de proveedor cuando existen. La selección es local; **Enviar a Compra** está deshabilitado porque `enviarACompraPortal()` escribe en Sheets. La descarga CSV usa sólo los datos ya leídos en el navegador.
- Historial SKU: lee `GESTION_COMPRAS_ACTIVA`, `CONFIG_MARCAS_COMPRA`, `ALIAS_MARCAS_COMPRA`, `GESTION_COMPRAS`, `ENVIOS_COMPRA`, `COMPRAS_EN_PROCESO` y `MOVIMIENTOS_COMPRA`. `GESTION_COMPRAS_ACTIVA` aporta stock, consumo, cobertura, descripción y marca; `GESTION_COMPRAS` aporta la última decisión; `ENVIOS_COMPRA` y `MOVIMIENTOS_COMPRA` aportan todos los eventos respectivos; la última fila del SKU en `COMPRAS_EN_PROCESO` aporta estado y cantidades actuales. Si no hay eventos, se muestra el error legacy de SKU sin historial.
- Enviados a Compra: lee `ENVIOS_COMPRA`, `ORDENES_COMPRA_PORTAL` y `COMPRAS_EN_PROCESO`. Agrupa por `NRO_ENVIO`, cuenta filas/SKU, suma `CANTIDAD_DECIDIDA`, cuenta marcas distintas y ordena los lotes por número descendente. Las OC se deduplican por envío y número; el detalle indica la OC del SKU cuando existe. `COMPRAS_EN_PROCESO` y `ORDENES_COMPRA_PORTAL` aportan la lista única de proveedores, como `obtenerProveedoresOcPortal()`. Filtros locales por texto, fechas y marca; los KPIs superiores corresponden al total y el resumen inferior a los lotes visibles. No se portaron `generarOrdenCompraPortal()` ni la impresión de OC.
- Las fechas seriales del Historial se interpretan con la zona horaria declarada por la planilla y se presentan en `America/Argentina/Buenos_Aires`, como el Apps Script. La planilla consultada declara `America/Los_Angeles`; por eso una celda visible como `07:15` allí aparece como `11:15` en el historial durante agosto. La conversión considera horario de verano.
- Gestión conserva los seis estados legacy: `PENDIENTE`, `COTIZAR`, `APROBADO`, `NO COMPRAR`, `POSTERGAR` y `ENVIADO A COMPRA`.
- El resumen de Gestión cuenta registros visibles, pendientes, estados distintos de pendiente y suma `COMPRA_SUGERIDA` de los registros filtrados.
- Los métodos de escritura legacy, como `guardarDecisionCompraPortal` y `guardarGestionMasivaPortal`, no se han portado.

El último control read-only de Google Sheets confirmó encabezados compatibles y una lectura completa de las tres hojas de Gestión. En ese momento, `GESTION_COMPRAS_ACTIVA` tenía 3.697 SKU; el número puede cambiar.

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
- `src/lib/compras-sheets.ts`: acceso a Sheets en servidor, con scope `spreadsheets.readonly`.
- `src/lib/compras-dashboard.ts`: cálculos puros del Dashboard y utilidades compartidas.
- `src/lib/compras-gestion.ts`: mapeo, filtros y resumen puros de Gestión.
- `src/app/api/compras/dashboard-export/route.ts`: XLSX del Dashboard, sin escrituras en Google.
- `tests/compras-dashboard.test.mjs`, `tests/compras-gestion.test.mjs`, `tests/compras-historial.test.mjs`, `tests/compras-envios.test.mjs`, `tests/compras-cotizaciones.test.mjs` y `tests/compras-bandeja.test.mjs`: pruebas de lógica.

Las variables requeridas en `.env.local` son `GOOGLE_SHEETS_SPREADSHEET_ID`, `GOOGLE_SERVICE_ACCOUNT_EMAIL` y `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY`. **No registrar sus valores en este documento ni enviarlos al navegador.**

## Verificación y pendientes

La lógica de Dashboard, Gestión e Historial pasó 11 pruebas unitarias en la etapa anterior. En la incorporación de Enviados pasaron 8 pruebas puntuales de Gestión, Historial y Enviados, además de la comprobación de tipos; no se hizo una compilación completa. El ajuste de la ventana emergente pasó una comprobación de tipos, ESLint focalizado y la prueba puntual de Enviados, sin compilación completa. La inspección visual previa se realizó en `/areas/compras?vista=gestion` con una sesión autorizada: se verificaron las 15 columnas y la ausencia de desborde horizontal a 1282 px. El panel **Gestionar** se probó con un SKU real: cambios locales de cantidad y observación no alteraron la tabla, y al reabrir se recuperaron los valores originales. **Guardar** está deshabilitado. Se verificó que **Historial** navega a la vista propia con el SKU precargado y que **Buscar** cambia el SKU consultado. Con `KLILED13961GELBL`, el portal mostró los mismos valores de la captura legacy (incluidos consumo mensual 2.819, cantidad decidida 100 y evento del 12/08/2026 11:15). En **Enviados a Compra**, se abrió `EC-20260828-0002` y se comprobaron sus 230 unidades, fecha 28/08/2026 11:11, proveedor disponible y SKU de detalle. Con `EC-20260828-0001` se comprobó que la OC existente aparece y el SKU asignado no se puede seleccionar. Conviene validar también el ancho final del monitor del usuario.

La diferencia de horas observada previamente en `FECHA_DECISION` de **Gestión** ya tiene causa: la planilla usa `America/Los_Angeles` y el proyecto Apps Script `America/Argentina/Buenos_Aires`. Gestión e Historial SKU ahora interpretan los seriales según la zona horaria real de la planilla. No se modificaron datos en Sheets.

Cotizaciones pasó una comprobación de tipos, ESLint focalizado y una prueba puntual que cubre elegibilidad, exclusión de CT abiertas, agrupación de ofertas y ranking; no se ejecutó una compilación completa. Aún falta comparar visualmente la nueva vista con datos reales del portal. La selección de pendientes, los códigos/precios y los datos del importador son borradores locales; **Crear cotización**, **Guardar oferta**, **Aprobar oferta**, **Plantilla** e **Importar ofertas** se muestran deshabilitados. Ninguno escribe en Google Sheets.

Bandeja de Compra quedó incorporada en la navegación antes de Enviados a Compra. Pasaron la comprobación de tipos, ESLint focalizado y una prueba puntual de elegibilidad, KPIs y cruce de la oferta seleccionada; no se ejecutó una compilación completa. Falta validar visualmente la vista con datos reales del portal. **Enviar a Compra** permanece deshabilitado y no existe una operación de escritura nueva.

Pendiente de aprobación y definición funcional: conectar **Guardar** de Gestión, **Enviar a Compra** de Bandeja, **Generar OC** de Enviados y los flujos de escritura de Cotizaciones (creación de CT, guardado/importación y aprobación de ofertas). En el modal de Enviados, la selección, el proveedor y el nuevo proveedor son borradores locales; **Generar OC** está visible pero deshabilitado y cerrar descarta el borrador. La plantilla XLSX y la impresión de OC también quedan para etapas posteriores. Siguen fuera de alcance Packing List, Contenedores, Seguimiento, Recepciones y Transferencias. No habilitar operaciones remotas de escritura sin implementación real y validación específica.

Este proyecto usa Next.js 16.3.4. Antes de modificar código Next, consultar la guía pertinente en `node_modules/next/dist/docs/`, según `AGENTS.md`.

## Traspaso a otro chat

Para retomar, leer primero este archivo y `AGENTS.md`, verificar la rama y `git status`, y después consultar sólo los archivos del legacy y del portal pertinentes a la siguiente vista. Al actualizar código Next.js, leer antes la guía relevante en `node_modules/next/dist/docs/`. La implementación de Bandeja de Compra ya estaba en una revisión con el árbol limpio antes de actualizar este MD; esta edición del documento queda como cambio local hasta que se confirme. Si el nuevo chat usa otro worktree, comprobar que incluya tanto Bandeja como este traspaso.

El último desarrollo fue **Bandeja de Compra**. La referencia funcional estable está en `docs/sistema-importaciones-legacy/portal_compras.gs`: `obtenerMapaCotizacionAprobadaPortal_()` y `obtenerBandejaCompraPortal()`; la representación y selección están en `portal_compras.html`: `cargarBandejaCompra()` y `dibujarBandejaCompra()`. `enviarSeleccionBandeja()` llama a `enviarACompraPortal()` y **no** se portó porque escribe en Sheets. Para Cotizaciones, revisar `obtenerBandejaCotizacionPortal()` y `obtenerCotizacionesPortal()` en el `.gs`, y `cargarCotizaciones()` / `dibujarCotizaciones()` en el `.html`. Las capturas aportadas durante la conversación estaban en una carpeta temporal del sistema: no depender de esas rutas en otro chat; solicitar que se adjunten nuevamente si hace falta una comparación visual precisa.

**Próximo paso sugerido:** contrastar Cotizaciones y Bandeja de Compra con datos reales en `/areas/compras`, corregir sólo diferencias verificadas y luego abordar **Compras en Proceso** en modo consulta. En el legacy, esa siguiente vista usa `obtenerComprasEnProcesoPortal()` (`portal_compras.gs`) y `cargarComprasEnProceso()` (`portal_compras.html`); analizar sus dependencias antes de implementarla. La pestaña futura debería quedar entre Enviados a Compra e Historial SKU, siguiendo el flujo operativo. No conectar acciones de escritura ni procesos de recálculo hasta que el usuario apruebe específicamente esa etapa; las conexiones complejas quedan para el final.
