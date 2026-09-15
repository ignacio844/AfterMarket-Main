# Sincronización de Ventas para Compras

## Alcance

Este documento describe los Hitos 1 y 2 de la migración de Ventas. La ingesta
reemplaza la fuente de frescura del Dashboard y el servidor sustituye en memoria
`CONSUMO_12_MESES` y `PROMEDIO_MENSUAL` con el último snapshot validado.
`RIESGO`, `PENDIENTE_TOTAL` y `COMPRA_SUGERIDA` continúan leyéndose sin cambios
desde `MODELO_COMPRAS` hasta el futuro recálculo integral del modelo.

La fuente autoritativa es `VS_REPORTING.dbo.Vista_Ventas_origen_v2`. El worker
replica la transformación de `SQL_Bajada_Mensual_Facturaciónv2.sql`:

- período desde el 31/07/2025 hasta el día de ejecución, ambos incluidos;
- `articulo` recortado como `Código` y `cod_bam` como SKU BAM;
- neteo de cantidad según el signo de `Importe_sin_iva`;
- facturación neta desde `Importe_sin_iva`;
- agrupamiento por código, empresa y mes;
- mapeo `DISTRIMAR/IMPORT/JUNIMAR/NLI/NLD` a `DTM/IMP/JNM/NLI/NLD`;
- exclusión de `1E+21`, `999       XXX` y `999999999999999999999`.

La frescura de cada empresa corresponde al día en que fue consultada. La última
fecha transaccional disponible se conserva por separado en los metadatos: una
empresa puede no tener movimientos recientes sin que su fuente esté atrasada.

No se almacenan clientes, CUIT, vendedores, pedidos ni comprobantes. Las
credenciales SQL y la service role de Supabase permanecen en el proceso local.

## Flujo

Automático:

`worker local cada 2 h -> SQL Server -> validación -> snapshot Supabase`

Manual:

`Dashboard -> /api/compras/sync-ventas -> compras_sync_requests -> worker local -> SQL Server -> snapshot Supabase -> polling -> refresh`

El proceso de Ventas es `bridge/ventas-sync.mjs`, separado del bridge Ejecutivo
y sin rutas públicas en el gateway. El supervisor combina `.env.local` para
Supabase con `.env.bridge` para SQL y sólo inicia el worker cuando la
configuración privada de Supabase está disponible.

## Puesta en marcha

1. Aplicar `supabase/migrations/005_compras_ventas.sql`.
2. Mantener `SUPABASE_URL` y `SUPABASE_SECRET_KEY` en `.env.local`. Las variables
   SQL continúan en `.env.bridge`; las opciones `VENTAS_*` pueden definirse en
   cualquiera de los dos archivos privados.
3. Ejecutar `npm run bridge:ventas:dry-run` para validar la extracción sin
   escribir en Supabase.
4. Reiniciar la tarea del bridge o ejecutar el supervisor. El health check del
   worker queda disponible sólo localmente en `http://127.0.0.1:8789/health`.

## Persistencia y seguridad

- `compras_ventas_imports`: cabecera, hash, controles y metadatos.
- `compras_ventas_import_items`: detalle mensual por código, SKU y empresa.
- `compras_ventas_import_errors`: códigos descartados y errores técnicos.
- `compras_ventas_actual_import`: último snapshot validado.
- `compras_ventas_actual_mensual`: detalle vigente.
- `compras_ventas_actual_por_sku`: consolidación mensual vigente por SKU.
- `compras_ventas_demanda_legacy`: suma por SKU de agosto de 2025 a julio de
  2026 y promedio mensual dividido por 12, utilizada por el Hito 2.

## Lectura del Dashboard (Hito 2)

El servidor conserva `MODELO_COMPRAS` como estructura de filas, aplica primero
el stock WARNES vigente y luego reemplaza únicamente estas dos columnas:

- `CONSUMO_12_MESES`: suma de unidades netas entre agosto de 2025 y julio de
  2026, ambos inclusive;
- `PROMEDIO_MENSUAL`: esa suma dividida por 12.

El cruce usa la misma normalización y el mismo `MAPA_SKU` del legacy: cada
`COD_BAM` se resuelve primero contra `CODIGO_NUEVO`, `CODIGO_VIEJO` y las bases
de equivalencias, y las demandas que convergen al mismo SKU se suman. Un SKU del
modelo que no aparece en el snapshot completo recibe consumo y promedio cero.
La operación es de sólo lectura: no escribe Google Sheets ni expone
credenciales al navegador.

RLS está activo y `anon`/`authenticated` no tienen permisos. El navegador sólo
recibe el estado de la solicitud y el resumen de frescura preparado por el
servidor del portal.
