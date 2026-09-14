/*******************************************************
 * SII V5.9.001
 * MÓDULO: STOCK DE LA FICHA INTEGRAL DEL SKU
 *
 * Este archivo contiene exclusivamente la lógica de:
 * - filtrado del stock por SKU;
 * - consolidación por depósito;
 * - compatibilidad con PLAN_COMPRAS.
 *
 * Requiere funciones existentes:
 * - normalizarClaveFichaSku_()
 * - limpiarTexto_()
 * - numero_()
 *******************************************************/


/**
 * Devuelve el resumen de stock requerido por ficha_sku.gs.
 *
 * Resultado:
 * {
 *   stockDisponible,
 *   stockWarnes,
 *   stockEscobar,
 *   stockOtros
 * }
 */
function obtenerResumenStockFichaSku_(
  stock,
  claveSku,
  filaPlan
) {
  const resumen = {
    stockDisponible: 0,
    stockWarnes: 0,
    stockEscobar: 0,
    stockOtros: 0
  };

  let cantidadFilasSku = 0;

  stock.forEach(reg => {
    const claveRegistro =
      normalizarClaveFichaSku_(
        reg.SKU
      );

    if (claveRegistro !== claveSku) {
      return;
    }

    cantidadFilasSku++;

    const deposito =
      normalizarDepositoFichaSku_(
        reg.DEPOSITO ||
        reg.ALMACEN ||
        reg.SUCURSAL
      );

    const cantidad =
      numero_(
        primerValorStockFichaSku_(
          reg.STOCK_DISPONIBLE,
          reg.STOCK_TOTAL,
          reg.STOCK,
          reg.CANTIDAD
        )
      );

    resumen.stockDisponible +=
      cantidad;

    if (deposito === 'WARNES') {
      resumen.stockWarnes +=
        cantidad;

    } else if (
      deposito === 'ESCOBAR'
    ) {
      resumen.stockEscobar +=
        cantidad;

    } else {
      resumen.stockOtros +=
        cantidad;
    }
  });

  /*
   * Compatibilidad con versiones anteriores:
   * si STOCK no contiene registros del SKU,
   * utiliza el total disponible informado
   * en PLAN_COMPRAS.
   */
  if (
    cantidadFilasSku === 0 &&
    filaPlan &&
    (
      filaPlan.STOCK_TOTAL !== undefined ||
      filaPlan.STOCK_DISPONIBLE !== undefined
    )
  ) {
    resumen.stockDisponible =
      numero_(
        primerValorStockFichaSku_(
          filaPlan.STOCK_TOTAL,
          filaPlan.STOCK_DISPONIBLE
        )
      );

    /*
     * Cuando PLAN_COMPRAS ya contiene desglose,
     * también lo utiliza.
     */
    resumen.stockWarnes =
      numero_(
        filaPlan.STOCK_WARNES
      );

    resumen.stockEscobar =
      numero_(
        filaPlan.STOCK_ESCOBAR
      );

    resumen.stockOtros =
      numero_(
        filaPlan.STOCK_OTROS
      );
  }

  return resumen;
}


/**
 * Normaliza las variantes del nombre del depósito.
 */
function normalizarDepositoFichaSku_(
  valor
) {
  const deposito =
    limpiarTexto_(valor)
      .normalize('NFD')
      .replace(
        /[\u0300-\u036f]/g,
        ''
      )
      .toUpperCase()
      .replace(/\s+/g, ' ')
      .trim();

  if (
    deposito.includes('WARNES')
  ) {
    return 'WARNES';
  }

  if (
    deposito.includes('ESCOBAR')
  ) {
    return 'ESCOBAR';
  }

  return deposito ||
    'SIN DEPOSITO';
}


/**
 * Devuelve el primer valor no vacío.
 *
 * Se define localmente para no depender de
 * primerValorNoVacio_() de otros módulos.
 */
function primerValorStockFichaSku_() {
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
