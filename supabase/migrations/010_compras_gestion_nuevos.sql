begin;

-- Admite SKU que aparezcan después del corte sin reimportar ni pisar
-- decisiones ya tomadas en Supabase. Cada lote es atómico.
create or replace function portal_aftermarket.compras_gestion_importar_nuevos(
  p_registros jsonb, p_lote_origen bigint
) returns integer language plpgsql set search_path = '' as $$
declare
  v_total integer;
  v_importados integer;
begin
  if jsonb_typeof(p_registros) <> 'array' then raise exception 'Importación inválida'; end if;
  v_total := jsonb_array_length(p_registros);
  if v_total < 1 or v_total > 4000 then raise exception 'Cantidad de SKU inesperada: %', v_total; end if;
  if (select count(distinct upper(btrim(value->>'sku'))) from jsonb_array_elements(p_registros)) <> v_total then
    raise exception 'SKU duplicados en la importación';
  end if;
  if not exists (select 1 from portal_aftermarket.compras_sheet_batches where id = p_lote_origen and estado = 'VALIDADO') then
    raise exception 'El lote de origen no está validado';
  end if;
  if not exists (select 1 from portal_aftermarket.compras_gestion_decisiones) then
    raise exception 'Primero debe completarse la importación inicial';
  end if;

  with imported as (
    insert into portal_aftermarket.compras_gestion_decisiones
      (sku, estado_gestion, cantidad_decidida, observacion, responsable, fecha_decision, requiere_revision, lote_origen)
    select upper(btrim(x.sku)),
      case when x.requiere_revision then null else x.estado_gestion end,
      x.cantidad_decidida, x.observacion, x.responsable, x.fecha_decision,
      x.requiere_revision, p_lote_origen
    from jsonb_to_recordset(p_registros) as x(
      sku text, estado_gestion text, cantidad_decidida numeric,
      observacion text, responsable text, fecha_decision timestamptz,
      requiere_revision boolean
    )
    on conflict (sku) do nothing
    returning sku, version, estado_gestion, cantidad_decidida, observacion
  )
  insert into portal_aftermarket.compras_gestion_eventos
    (sku, version, tipo, estado_gestion, cantidad_decidida, observacion, actor)
  select sku, version, 'MIGRACION', estado_gestion, cantidad_decidida, observacion,
    'GESTION_COMPRAS'
  from imported;
  get diagnostics v_importados = row_count;
  return v_importados;
end;
$$;

revoke all on function portal_aftermarket.compras_gestion_importar_nuevos(jsonb, bigint)
  from public, anon, authenticated;
grant execute on function portal_aftermarket.compras_gestion_importar_nuevos(jsonb, bigint)
  to service_role;

commit;
