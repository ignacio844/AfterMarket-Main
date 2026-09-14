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
| Historial SKU (estructura de navegación) | `/areas/compras?vista=historial&sku=...` | Vista y buscador con SKU precargado desde Gestión. Todavía no consulta `obtenerHistorialSkuPortal()` ni presenta eventos. |

La vista de Gestión muestra las columnas SKU, descripción, marca, origen, objetivo, cobertura actual, riesgo, política, compra sugerida, estado, cantidad decidida, responsable, observación, fecha de decisión y acción. La tabla tiene diseño compacto y la vista admite hasta 1920 px de ancho. Se comprobó en el navegador del portal a 1282 px de viewport que las 15 columnas entran sin desbordamiento horizontal; por debajo de aproximadamente 1250 px puede aparecer desplazamiento horizontal para conservar todas las columnas.

Los botones **Gestionar** e **Historial** son visibles en cada fila. **Gestionar** abre un panel prototipo con SKU, descripción, marca, riesgo y compra sugerida; permite cambiar localmente estado de gestión, cantidad decidida y observación (máximo 1000 caracteres). **Guardar** permanece deshabilitado: cerrar descarta el borrador y no modifica la tabla ni Google Sheets. **Historial** navega a la vista Historial SKU con el código precargado, como `irHistorialSku()` en Apps Script; la búsqueda histórica real queda pendiente. En la tabla, `Cantidad decidida` es texto, no un campo editable.

## Datos y lógica

- Dashboard: lee `MODELO_COMPRAS`, `CONFIG_MARCAS_COMPRA`, `ALIAS_MARCAS_COMPRA`, `CONTROL_IMPORTACIONES_STOCK`, `VENTAS` y `LOG_IMPORTACIONES`.
- Gestión: lee `GESTION_COMPRAS_ACTIVA`, `CONFIG_MARCAS_COMPRA` y `ALIAS_MARCAS_COMPRA`. El origen y la política de compra se resuelven desde configuración y alias, como en el legacy; no se toman de columnas precalculadas de la hoja de Gestión.
- Gestión conserva los seis estados legacy: `PENDIENTE`, `COTIZAR`, `APROBADO`, `NO COMPRAR`, `POSTERGAR` y `ENVIADO A COMPRA`.
- El resumen de Gestión cuenta registros visibles, pendientes, estados distintos de pendiente y suma `COMPRA_SUGERIDA` de los registros filtrados.
- Los métodos de escritura legacy, como `guardarDecisionCompraPortal` y `guardarGestionMasivaPortal`, no se han portado.

El último control read-only de Google Sheets confirmó encabezados compatibles y una lectura completa de las tres hojas de Gestión. En ese momento, `GESTION_COMPRAS_ACTIVA` tenía 3.697 SKU; el número puede cambiar.

## Archivos principales

- `src/app/areas/compras/page.tsx`: selección de vista, auth y presentación del Dashboard.
- `src/components/compras-gestion-workspace.tsx`: filtros, resumen, tabla, panel prototipo de Gestión y enlace a Historial SKU.
- `src/components/compras-historial-workspace.tsx`: pantalla de Historial SKU y buscador de navegación, sin datos históricos simulados.
- `src/components/compras-dashboard-actions.tsx`: actualizar y exportación del Dashboard.
- `src/lib/compras-sheets.ts`: acceso a Sheets en servidor, con scope `spreadsheets.readonly`.
- `src/lib/compras-dashboard.ts`: cálculos puros del Dashboard y utilidades compartidas.
- `src/lib/compras-gestion.ts`: mapeo, filtros y resumen puros de Gestión.
- `src/app/api/compras/dashboard-export/route.ts`: XLSX del Dashboard, sin escrituras en Google.
- `tests/compras-dashboard.test.mjs` y `tests/compras-gestion.test.mjs`: pruebas de lógica.

Las variables requeridas en `.env.local` son `GOOGLE_SHEETS_SPREADSHEET_ID`, `GOOGLE_SERVICE_ACCOUNT_EMAIL` y `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY`. **No registrar sus valores en este documento ni enviarlos al navegador.**

## Verificación y pendientes

La lógica de Dashboard y Gestión pasó 7 pruebas unitarias; también pasaron TypeScript, ESLint y `next build` después del ajuste de densidad y botones. La inspección visual se realizó en `/areas/compras?vista=gestion` con una sesión autorizada: se verificaron las 15 columnas y la ausencia de desborde horizontal a 1282 px. El panel **Gestionar** se probó con un SKU real: cambios locales de cantidad y observación no alteraron la tabla, y al reabrir se recuperaron los valores originales. **Guardar** está deshabilitado. Se verificó que **Historial** navega a la vista propia con el SKU precargado y que **Buscar** cambia el SKU de la URL y del campo sin consultar todavía los eventos. Conviene validar también el ancho final del monitor del usuario.

La comparación visual con la captura legacy sugiere una posible diferencia de horas en `FECHA_DECISION` (por ejemplo, 15:04 en Apps Script frente a 11:04 en el portal para el primer SKU). **Pendiente de diagnóstico**: confirmar la zona horaria de la hoja y la del proyecto Apps Script antes de corregir la conversión de fechas; no modificar datos en Sheets para esto.

Pendiente de aprobación y definición funcional: conectar **Guardar** de Gestión (implicaría escritura y reglas de autorización/concurrencia) y la lectura de **Historial SKU** mediante `obtenerHistorialSkuPortal()`; el enlace y la vista ya existen. También siguen fuera de alcance Packing List, Contenedores, Seguimiento, Recepciones y Transferencias. No habilitar operaciones remotas sin implementación real y validación específica.

Este proyecto usa Next.js 16.3.4. Antes de modificar código Next, consultar la guía pertinente en `node_modules/next/dist/docs/`, según `AGENTS.md`.
