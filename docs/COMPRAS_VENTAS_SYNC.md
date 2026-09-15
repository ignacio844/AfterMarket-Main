# Sincronización de Ventas para Compras

## Alcance

Este documento describe el Hito 1 de la migración de Ventas. La ingesta sólo
reemplaza la fuente de frescura del Dashboard. `PROMEDIO_MENSUAL`,
`CONSUMO_12_MESES`, `RIESGO`, `PENDIENTE_TOTAL` y `COMPRA_SUGERIDA` continúan
leyéndose desde `MODELO_COMPRAS` hasta el Hito 2.

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
- `compras_ventas_actual_por_sku`: consolidación futura para el Hito 2.

RLS está activo y `anon`/`authenticated` no tienen permisos. El navegador sólo
recibe el estado de la solicitud y el resumen de frescura preparado por el
servidor del portal.
