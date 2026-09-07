# Bridge SQL para indicadores ejecutivos

El portal no se conecta directamente a SQL Server. La comunicación sigue este recorrido:

`SQL Server -> actualización cada 2 horas -> caché local del bridge -> API /api/executive/daily-lines -> Portal`

El endpoint que consume el portal sólo lee la caché. No abre una conexión SQL por cada visita ni por cada cambio de mes.

## Dominio ngrok gratuito compartido

El dominio gratuito existente se mantiene como única entrada pública:

`https://surgical-dean-overtime.ngrok-free.dev -> gateway 8790`

El gateway no reemplaza ni modifica los bridges. Sólo reenvía rutas:

- `/wms-trace` hacia el bridge de Auditoría en `127.0.0.1:8787`.
- `/executive/daily-lines` hacia el bridge Ejecutivo en `127.0.0.1:8788`.

Cada bridge continúa validando su propio Bearer token. El supervisor compartido conserva ambos procesos, el gateway y ngrok sin abrir terminales visibles.

## Configuración local

1. Crear `.env.bridge` en la raíz del proyecto usando las variables documentadas en `.env.example`.
2. Usar el mismo valor aleatorio, de al menos 32 caracteres, en `BRIDGE_TOKEN` y `EXECUTIVE_BRIDGE_TOKEN`.
3. Completar `SQL_PASSWORD` únicamente en `.env.bridge`.
4. Ejecutar `npm run bridge:start`.
5. Verificar `http://127.0.0.1:8788/health`.

`EXECUTIVE_REFRESH_INTERVAL_MS` controla el intervalo de actualización y utiliza `7200000` milisegundos (2 horas) por defecto. `EXECUTIVE_CACHE_FROM` puede fijar la fecha inicial; vacío utiliza el 1 de enero del año actual.

## Inicio automático en Windows

Con `.env.bridge` ya configurado, ejecutar una sola vez:

`npm run bridge:install`

Esto registra la tarea `Grupo Aftermarket - Executive Bridge` para el usuario actual. La tarea se inicia al abrir sesión, corre oculta y vuelve a levantar el proceso si deja de responder. El control de salud no consulta SQL. Los datos agregados y los registros quedan en `.runtime`.

En desarrollo, `EXECUTIVE_BRIDGE_URL` puede ser `http://127.0.0.1:8788`. En un despliegue remoto debe ser una URL HTTPS del túnel; las credenciales SQL permanecen sólo en la computadora que ejecuta el bridge.

## Criterio del indicador

La consulta reproduce el agrupamiento de Facturador sobre `VS_REPORTING.dbo.Vista_Ventas_origen_v2`. Cada fila agrupada por pedido y artículo cuenta como un renglón; `cantidad` representa unidades y no se suma para este indicador.

El promedio mensual considera únicamente días con actividad:

- A, verde: 110% o más del promedio.
- B, amarillo: desde 80% y menos de 110%.
- C, rojo: menos de 80%.
