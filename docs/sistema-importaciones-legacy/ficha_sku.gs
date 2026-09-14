/*******************************************************
 * SII V5.9.003
 * FICHA INTEGRAL DEL SKU
 *******************************************************/


/**
 * Abre la ficha integral del SKU.
 */
function abrirFichaSkuClasica() {
  const html = HtmlService
    .createHtmlOutputFromFile('ficha_sku_ui')
    .setWidth(1400)
    .setHeight(850);

  SpreadsheetApp.getUi().showModalDialog(
    html,
    'Ficha integral del SKU'
  );
}


/**
 * Devuelve los SKU disponibles.
 */
function obtenerSkuFicha() {
  const ss = SpreadsheetApp.getActive();

  const shPlan = obtenerHoja_(
    ss,
    SII_CFG.SHEETS.PLAN_COMPRAS
  );

  const filas = leerFilasComoObjetos_(shPlan);
  const skus = new Map();

  filas.forEach(reg => {
    const sku = limpiarTexto_(reg.SKU);

    if (!sku) {
      return;
    }

    const clave = normalizarClaveFichaSku_(sku);

    if (!skus.has(clave)) {
      skus.set(clave, {
        sku: sku,
        marca: limpiarTexto_(reg.MARCA),
        proveedor: limpiarTexto_(reg.PROVEEDOR),
        estadoCompra: limpiarTexto_(reg.ESTADO_COMPRA)
      });
    }
  });

  return [...skus.values()]
    .sort((a, b) => {
      return a.sku.localeCompare(
        b.sku,
        'es',
        {
          numeric: true,
          sensitivity: 'base'
        }
      );
    });
}


/**
 * Devuelve toda la información disponible de un SKU.
 */
function obtenerFichaSku(skuSeleccionado) {
  const ss = SpreadsheetApp.getActive();
  const skuBuscado = limpiarTexto_(skuSeleccionado);

  if (!skuBuscado) {
    throw new Error('Debe seleccionar un SKU.');
  }

  const claveSku =
    normalizarClaveFichaSku_(skuBuscado);

  const productos = leerFilasComoObjetos_(
    obtenerHoja_(
      ss,
      SII_CFG.SHEETS.PRODUCTOS
    )
  );

  const plan = leerFilasComoObjetos_(
    obtenerHoja_(
      ss,
      SII_CFG.SHEETS.PLAN_COMPRAS
    )
  );

  const stock = leerFilasComoObjetos_(
    obtenerHoja_(
      ss,
      SII_CFG.SHEETS.STOCK
    )
  );

  const ventas = leerFilasComoObjetos_(
    obtenerHoja_(
      ss,
      SII_CFG.SHEETS.VENTAS
    )
  );

  const detalle = leerFilasComoObjetos_(
    obtenerHoja_(
      ss,
      SII_CFG.SHEETS.DETALLE
    )
  );

  const ordenes = leerFilasComoObjetos_(
    obtenerHoja_(
      ss,
      SII_CFG.SHEETS.ORDENES
    )
  );

  const equivalencias = leerFilasComoObjetos_(
    obtenerHoja_(
      ss,
      SII_CFG.SHEETS.EQUIVALENCIAS_SKU
    )
  );

  const parametros = leerFilasComoObjetos_(
    obtenerHoja_(
      ss,
      SII_CFG.SHEETS.PARAMETROS
    )
  );


  /*****************************************************
   * IMPORTACIONES
   *
   * V5.9.003:
   * La lógica fue extraída a ficha_importaciones.gs.
   *****************************************************/


  /*****************************************************
   * DATOS MAESTROS
   *****************************************************/

  const producto = productos.find(reg => {
    return normalizarClaveFichaSku_(
      reg.SKU
    ) === claveSku;
  }) || {};

  const filaPlan = plan.find(reg => {
    return normalizarClaveFichaSku_(
      reg.SKU
    ) === claveSku;
  }) || {};


  /*****************************************************
   * STOCK POR DEPÓSITO
   *
   * V5.9.001:
   * La lógica fue extraída a ficha_stock.gs.
   *****************************************************/

  const resumenStock =
    obtenerResumenStockFichaSku_(
      stock,
      claveSku,
      filaPlan
    );


  /*****************************************************
   * CONSUMO
   *
   * V5.9.002:
   * La lógica fue extraída a ficha_consumo.gs.
   *****************************************************/

  const resumenConsumo =
    obtenerResumenConsumoFichaSku_(
      ventas,
      claveSku,
      filaPlan
    );


  /*****************************************************
   * IMPORTACIONES DEL SKU
   *****************************************************/

  const resumenImportaciones =
    obtenerResumenImportacionesFichaSku_(
      detalle,
      ordenes,
      equivalencias,
      parametros,
      claveSku,
      filaPlan
    );


  /*****************************************************
   * RESULTADO
   *****************************************************/

  return {
    producto: {
      sku: skuBuscado,

      descripcion: limpiarTexto_(
        producto.DESCRIPCION
      ),

      marca: limpiarTexto_(
        filaPlan.MARCA ||
        producto.MARCA
      ),

      proveedor: limpiarTexto_(
        filaPlan.PROVEEDOR ||
        producto.PROVEEDOR
      ),

      activo: limpiarTexto_(
        producto.ACTIVO
      ),

      estadoAlta: limpiarTexto_(
        producto.ESTADO_ALTA
      ),

      observaciones: limpiarTexto_(
        producto.OBSERVACIONES
      )
    },

    stock: {
      stockDisponible:
        resumenStock.stockDisponible,

      stockWarnes:
        resumenStock.stockWarnes,

      stockEscobar:
        resumenStock.stockEscobar,

      stockOtros:
        resumenStock.stockOtros
    },

    consumo: {
      consumoTotal:
        resumenConsumo.consumoTotal,

      meses:
        resumenConsumo.meses,

      promedioMensual:
        resumenConsumo.promedioMensual
    },

    compras: {
      pendienteRecibir: numero_(
        filaPlan.PENDIENTE_RECIBIR
      ),

      coberturaActual: numero_(
        filaPlan.COBERTURA_ACTUAL_MESES
      ),

      coberturaProyectada: numero_(
        filaPlan.COBERTURA_PROYECTADA_MESES
      ),

      objetivoMeses: numero_(
        filaPlan.OBJETIVO_MESES
      ),

      cantidadSugerida: numero_(
        filaPlan.CANTIDAD_SUGERIDA
      ),

      estadoCompra: limpiarTexto_(
        filaPlan.ESTADO_COMPRA
      ),

      ultimaActualizacion:
        formatearFechaHoraFichaSku_(
          filaPlan.ULTIMA_ACTUALIZACION
        )
    },

    importaciones:
      resumenImportaciones
  };
}


/**
 * Normaliza una clave para comparaciones.
 */
function normalizarClaveFichaSku_(valor) {
  return limpiarTexto_(valor)
    .normalize('NFD')
    .replace(
      /[\u0300-\u036f]/g,
      ''
    )
    .toUpperCase()
    .replace(/\s+/g, '')
    .trim();
}


/**
 * Formatea una fecha.
 */
function formatearFechaFichaSku_(valor) {
  if (!valor) {
    return '';
  }

  const fecha = convertirFecha_(valor);

  if (!fecha) {
    return limpiarTexto_(valor);
  }

  return Utilities.formatDate(
    fecha,
    Session.getScriptTimeZone(),
    'dd/MM/yyyy'
  );
}


/**
 * Formatea fecha y hora.
 */
function formatearFechaHoraFichaSku_(valor) {
  if (!valor) {
    return '';
  }

  const fecha = convertirFecha_(valor);

  if (!fecha) {
    return limpiarTexto_(valor);
  }

  return Utilities.formatDate(
    fecha,
    Session.getScriptTimeZone(),
    'dd/MM/yyyy HH:mm'
  );
} 