# Auditoría del calendario: 1 de septiembre de 2026

Revisión realizada el 7 de septiembre de 2026 mediante consultas de solo lectura a `dbo.Vista_Ventas_origen_v2` y comparación con la caché del portal. Período de detalle: 24/08/2026 a 04/09/2026. Se respetaron los filtros de cliente y pedido del bridge. No se modificaron SQL, el indicador ni su caché.

## Conclusión

Los 6.093 renglones y 305 pedidos se reproducen desde SQL con la agrupación actual del calendario. No es un error de presentación. Sin embargo, 6.093 no representa códigos únicos por pedido: 1.267 combinaciones de empresa, pedido y artículo aparecen en dos comprobantes diferentes. Al contar una sola vez cada código por pedido y empresa, el resultado es 4.826.

El pico persiste con esa definición: 4.826 frente a 2.326 códigos por día, en promedio, del 2 al 4 de septiembre (+107,5%). También hubo 305 pedidos frente a 162,7 por día (+87,5%). Por lo tanto, las repeticiones entre comprobantes explican una parte del total, pero no explican por sí solas el pico.

## Composición del 1 de septiembre

| Base de origen | Renglones actuales | Pedidos | Códigos únicos por pedido | Conteos adicionales entre comprobantes |
|---|---:|---:|---:|---:|
| IMPORT | 2.890 | 123 | 2.225 | 665 |
| DISTRIMAR | 2.584 | 169 | 2.055 | 529 |
| JUNIMAR | 619 | 13 | 546 | 73 |
| Total | 6.093 | 305 | 4.826 | 1.267 |

IMPORT aporta el 47,4% de los renglones y DISTRIMAR el 42,4%. El 31/08 IMPORT registraba 95 renglones y 6 pedidos; el 01/09 registra 2.890 y 123. Es compatible con una concentración de registraciones al comienzo del mes, pero no prueba diferimiento de pedidos ni un proceso de cierre.

## Comparación de días completos

| Fecha | Renglones actuales | Pedidos | Códigos únicos por pedido |
|---|---:|---:|---:|
| 24/08 | 3.299 | 173 | 2.678 |
| 25/08 | 2.928 | 169 | 2.496 |
| 26/08 | 3.117 | 198 | 2.647 |
| 27/08 | 2.577 | 185 | 2.240 |
| 28/08 | 2.721 | 125 | 2.205 |
| 31/08 | 2.402 | 127 | 1.975 |
| 01/09 | 6.093 | 305 | 4.826 |
| 02/09 | 2.644 | 137 | 2.147 |
| 03/09 | 2.836 | 159 | 2.155 |
| 04/09 | 3.292 | 192 | 2.676 |

Contra el promedio de los otros nueve días revisados: 6.093 versus 2.868,4 renglones; 305 versus 162,8 pedidos; 4.826 versus 2.357,7 códigos únicos por pedido. Contra el 2–4/09, los renglones por pedido pasan de 18,0 a 20,0: el salto proviene principalmente de una mayor cantidad de pedidos registrados.

Se excluye el 07/09 de estas comparaciones porque es un día en curso. La media del calendario sí incluye días en curso con datos positivos y el propio día extraordinario; con los números de la captura resulta 3.086 renglones.

## Controles de duplicación y cruces

- SQL devuelve 6.098 filas para el 01/09; existen 5 duplicados exactos. La agrupación actual los elimina y deja 6.093, por lo que esos cinco no inflan el calendario.
- Los 1.267 conteos adicionales corresponden a artículos del mismo pedido y empresa que aparecen en dos números de comprobante distintos. En todos esos pares, una fila tiene `fasiti = 1` y la otra `fasiti = 7`. En 1.101 pares también coinciden cantidad e importe sin IVA. Esto justifica revisar el significado comercial de ambas clases; no demuestra que los comprobantes sean duplicados erróneos.
- Ejemplo verificable: DISTRIMAR, pedido 160843, artículo ` EK     FIT15`: comprobantes 160466 (fasiti 1) y 335361 (fasiti 7), ambos con cantidad 5 e importe sin IVA 24.703,25. El indicador cuenta dos renglones; la combinación pedido-artículo es una.
- No se encontraron coincidencias entre bases para la clave pedido + comprobante + artículo + CUIT en ese día. Este control no descarta duplicación económica con identificadores diferentes.
- No se encontraron pedidos del 01/09 asociados a más de un CUIT dentro de su base.
- En la ventana analizada, ningún comprobante del 01/09 aparece con otra fecha, ni los pedidos de ese día tienen filas anteriores al 01/09.
- Todas las filas del día tienen `fecha = 2026-09-01 00:00:00`, tipo de comprobante FC y cantidades e importes sin IVA no negativos. No se observó un desplazamiento de fecha introducido por el calendario.

## Alcance y recomendación

La cuenta se basa en una vista de ventas y su campo `fecha`, no en eventos de preparación o consumo del depósito. No hay fecha de creación del pedido ni de preparación en las columnas expuestas. El usuario SQL no tiene permiso VIEW DEFINITION, y las tablas/vistas visibles de ventas no incluyen una fuente de pedidos o remitos para esta validación. No se pudo confirmar la definición interna de `fecha`, el significado de `fasiti` ni si hubo facturación acumulada de operaciones de agosto.

La recomendación es definir explícitamente el indicador: si se desea códigos únicos por pedido, la clave debe ser fecha + Base_Origen + num_pedido + articulo; bajo esa definición, el 01/09 muestra 4.826. Si se desean renglones por comprobante, el 6.093 reproduce el criterio actual, aunque la descripción “Cantidad de códigos procesados por pedido” no expresa esa diferencia. Para afirmar consumo o trabajo operativo de ese día hace falta contrastar las fechas del sistema de pedidos/preparación y validar con administración las clases fasiti 1 y 7.

## Evidencia local y reproducción

- Detalle consultado: `.runtime/audit-september/source.json` (31.942 filas del período; contiene información comercial, no credenciales).
- Scripts de lectura y análisis: `.runtime/audit-september/fetch.mjs`, `analyze.cjs`, `deep.cjs`, `metrics.cjs`.
- Resumen por fecha: `.runtime/audit-september/daily-summary.json`.
- Cálculo productivo revisado: `bridge/server.mjs`, función `queryDailyLines`.
- Media y clasificación: `src/lib/executive-lines.ts`, función `buildDailyLinesResponse`.
