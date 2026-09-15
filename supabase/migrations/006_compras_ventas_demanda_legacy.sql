begin;

-- Hito 2 / Compras - Ventas
-- Consolida la ventana fija del modelo legacy para que el Dashboard lea una
-- fila por SKU, sin transferir el detalle mensual completo en cada apertura.

create or replace view portal_aftermarket.compras_ventas_demanda_legacy as
select
  sku_key,
  max(sku) as sku,
  sum(unidades_netas)::numeric(24,3) as consumo_12_meses,
  (sum(unidades_netas) / 12)::numeric(24,6) as promedio_mensual,
  date '2025-08-01' as period_from,
  date '2026-07-01' as period_to,
  max(import_id) as import_id,
  max(fecha_importacion) as fecha_importacion
from portal_aftermarket.compras_ventas_actual_mensual
where periodo between date '2025-08-01' and date '2026-07-01'
group by sku_key;

revoke all on portal_aftermarket.compras_ventas_demanda_legacy
  from public, anon, authenticated;

grant select
  on portal_aftermarket.compras_ventas_demanda_legacy
  to service_role;

commit;
