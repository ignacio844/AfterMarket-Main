/**************************************************************
 * SII V6.3.005
 * INTEGRACIÓN DEL SERVICIO DE IDENTIDAD DE SKU
 *
 * Agregar este archivo después de sku_identity.gs.
 *
 * Funciones de compatibilidad:
 * - resolverSkuCanonicoSII(codigo)
 * - normalizarSkuSII(codigo)
 * - obtenerAliasesSkuSII(codigo)
 **************************************************************/


/**
 * Devuelve únicamente el SKU canónico.
 */
function resolverSkuCanonicoSII(
  codigo
) {
  if (
    typeof skuIdentityResolver !==
    'function'
  ) {
    return String(
      codigo || ''
    ).trim();
  }

  const resultado =
    skuIdentityResolver(
      codigo
    );

  if (
    resultado.ambiguo ||
    !resultado.skuCanonico
  ) {
    return String(
      codigo || ''
    ).trim();
  }

  return resultado.skuCanonico;
}


/**
 * Alias corto para uso interno.
 */
function normalizarSkuSII(
  codigo
) {
  return resolverSkuCanonicoSII(
    codigo
  );
}


/**
 * Devuelve todos los códigos conocidos del producto.
 */
function obtenerAliasesSkuSII(
  codigo
) {
  if (
    typeof skuIdentityResolver !==
    'function'
  ) {
    return [
      String(
        codigo || ''
      ).trim()
    ].filter(Boolean);
  }

  const resultado =
    skuIdentityResolver(
      codigo
    );

  return resultado.aliases || [];
}


/**
 * Limpia todos los caches relacionados.
 */
function limpiarCachesIdentidadSkuSII() {
  if (
    typeof skuIdentityLimpiarCache ===
    'function'
  ) {
    skuIdentityLimpiarCache();
  }

  try {
    CacheService
      .getDocumentCache()
      .remove(
        'SII_VENTAS_MODELO_V6000'
      );
  } catch (error) {}

  SpreadsheetApp
    .getActive()
    .toast(
      'Caches de identidad y ventas limpiados.',
      'SII',
      5
    );
}
