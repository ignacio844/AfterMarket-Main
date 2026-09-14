/*******************************************************
 * SII V5.9.002
 * MÓDULO: CONSUMO DE LA FICHA INTEGRAL DEL SKU
 *
 * Este archivo contiene exclusivamente la lógica de:
 * - filtrado de VENTAS por SKU;
 * - consumo total;
 * - cantidad de meses;
 * - promedio mensual;
 * - compatibilidad con PLAN_COMPRAS.
 *
 * Requiere funciones existentes:
 * - normalizarClaveFichaSku_()
 * - limpiarTexto_()
 * - numero_()
 *******************************************************/


/**
 * Devuelve el resumen de consumo requerido por ficha_sku.gs.
 *
 * Resultado:
 * {
 *   consumoTotal,
 *   meses,
 *   promedioMensual
 * }
 */
function obtenerResumenConsumoFichaSku_(
  ventas,
  claveSku,
  filaPlan
) {
  const resumen = {
    consumoTotal: 0,
    meses: 0,
    promedioMensual: 0
  };

  let cantidadFilasSku = 0;

  ventas.forEach(reg => {
    const claveRegistro =
      normalizarClaveFichaSku_(
        reg.SKU
      );

    if (claveRegistro !== claveSku) {
      return;
    }

    cantidadFilasSku++;

    resumen.consumoTotal +=
      numero_(
        primerValorConsumoFichaSku_(
          reg.CONSUMO_TOTAL,
          reg.CONSUMO_12_MESES,
          reg.CANTIDAD
        )
      );

    resumen.meses =
      Math.max(
        resumen.meses,
        numero_(reg.MESES)
      );

    resumen.promedioMensual =
      Math.max(
        resumen.promedioMensual,
        numero_(
          primerValorConsumoFichaSku_(
            reg.PROMEDIO_MENSUAL,
            reg.PROMEDIO_MENSUAL_3M
          )
        )
      );
  });

  /*
   * Compatibilidad con PLAN_COMPRAS.
   * Se utiliza cuando VENTAS no contiene el SKU
   * o cuando algún dato todavía no está informado.
   */
  if (
    cantidadFilasSku === 0 ||
    resumen.consumoTotal === 0
  ) {
    resumen.consumoTotal =
      numero_(
        primerValorConsumoFichaSku_(
          filaPlan.CONSUMO_12_MESES,
          filaPlan.CONSUMO_TOTAL
        )
      );
  }

  if (resumen.meses === 0) {
    resumen.meses =
      numero_(filaPlan.MESES);
  }

  if (
    resumen.promedioMensual === 0
  ) {
    resumen.promedioMensual =
      numero_(
        primerValorConsumoFichaSku_(
          filaPlan.PROMEDIO_MENSUAL,
          filaPlan.PROMEDIO_MENSUAL_3M
        )
      );
  }

  /*
   * Último respaldo:
   * si existe consumo y meses pero no promedio,
   * calcula CONSUMO_TOTAL / MESES.
   */
  if (
    resumen.promedioMensual === 0 &&
    resumen.consumoTotal > 0 &&
    resumen.meses > 0
  ) {
    resumen.promedioMensual =
      resumen.consumoTotal /
      resumen.meses;
  }

  return resumen;
}


/**
 * Devuelve el primer valor no vacío.
 *
 * Se define localmente para no depender de
 * primerValorNoVacio_() de otros módulos.
 */
function primerValorConsumoFichaSku_() {
  for (
    let i = 0;
    i < arguments.length;
    i++
  ) {
    const valor =
      arguments[i];

    if (
      valor !== null &&
      valor !== undefined &&
      limpiarTexto_(valor) !== ''
    ) {
      return valor;
    }
  }

  return 0;
}

