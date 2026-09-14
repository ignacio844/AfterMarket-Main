/******************************************************************
 * SII - MODELO DE COMPRAS
 * Sprint B.1.2-A
 * Versión 0.1.200
 *
 * Consolida en MODELO_COMPRAS:
 *
 *   CONSUMO_12M
 *   PROMEDIO_MENSUAL
 *   CONSUMO_3M
 *   STOCK_WARNES
 *   STOCK_ESCOBAR
 *   STOCK_TOTAL
 *
 * Fuentes:
 *   STOCK
 *   VENTAS
 *   MAPA_SKU
 *
 * No modifica las hojas fuente.
 * No calcula todavía importaciones ni MRP.
 ******************************************************************/

const SII_B12A = {

  VERSION: "0.1.200",

  HOJA_MODELO: "MODELO_COMPRAS",
  HOJA_STOCK: "STOCK",
  HOJA_VENTAS: "VENTAS",
  HOJA_MAPA: "MAPA_SKU",

  FILA_HEADER_MODELO: 2,

  MESES_12M: [
    "AGO_2025",
    "SEP_2025",
    "OCT_2025",
    "NOV_2025",
    "DIC_2025",
    "ENE_2026",
    "FEB_2026",
    "MAR_2026",
    "ABR_2026",
    "MAY_2026",
    "JUN_2026",
    "JUL_2026"
  ],

  MESES_3M: [
    "MAY_2026",
    "JUN_2026",
    "JUL_2026"
  ]
};


/******************************************************************
 * FUNCIÓN PÚBLICA
 ******************************************************************/

function actualizarModeloComprasB12A() {

  const inicio = Date.now();

  const ss =
    SpreadsheetApp.getActiveSpreadsheet();

  const shModelo =
    ss.getSheetByName(
      SII_B12A.HOJA_MODELO
    );

  const shStock =
    ss.getSheetByName(
      SII_B12A.HOJA_STOCK
    );

  const shVentas =
    ss.getSheetByName(
      SII_B12A.HOJA_VENTAS
    );

  const shMapa =
    ss.getSheetByName(
      SII_B12A.HOJA_MAPA
    );


  validarHojasB12A_(
    shModelo,
    shStock,
    shVentas,
    shMapa
  );


  Logger.log(
    "B.1.2-A - Inicio"
  );


  // ============================================================
  // MAPA DE EQUIVALENCIAS
  // ============================================================

  const mapa =
    construirMapaEquivalenciasB12A_(
      shMapa
    );

  Logger.log(
    "Equivalencias cargadas: " +
    mapa.size
  );


  // ============================================================
  // STOCK
  // ============================================================

  const stock =
    construirStockB12A_(
      shStock,
      mapa
    );

  Logger.log(
    "SKU con stock: " +
    stock.size
  );


  // ============================================================
  // VENTAS
  // ============================================================

  const ventas =
    construirVentasB12A_(
      shVentas,
      mapa
    );

  Logger.log(
    "SKU con ventas: " +
    ventas.size
  );


  // ============================================================
  // ACTUALIZAR MODELO
  // ============================================================

  const resultado =
    escribirModeloB12A_(
      shModelo,
      stock,
      ventas
    );


  SpreadsheetApp.flush();


  const duracion =
    Date.now() - inicio;


  Logger.log(
    JSON.stringify(
      {
        version:
          SII_B12A.VERSION,

        filasModelo:
          resultado.filas,

        skuConStock:
          resultado.skuConStock,

        skuConVentas:
          resultado.skuConVentas,

        skuSinStock:
          resultado.skuSinStock,

        skuSinVentas:
          resultado.skuSinVentas,

        duracionMs:
          duracion
      },
      null,
      2
    )
  );


  ss.toast(
    "Stock y ventas actualizados",
    "Sprint B.1.2-A",
    5
  );
}


/******************************************************************
 * VALIDACIONES
 ******************************************************************/

function validarHojasB12A_(
  modelo,
  stock,
  ventas,
  mapa
) {

  const faltantes = [];

  if (!modelo) {
    faltantes.push(
      SII_B12A.HOJA_MODELO
    );
  }

  if (!stock) {
    faltantes.push(
      SII_B12A.HOJA_STOCK
    );
  }

  if (!ventas) {
    faltantes.push(
      SII_B12A.HOJA_VENTAS
    );
  }

  if (!mapa) {
    faltantes.push(
      SII_B12A.HOJA_MAPA
    );
  }

  if (faltantes.length) {

    throw new Error(
      "Faltan hojas requeridas: " +
      faltantes.join(", ")
    );
  }
}


/******************************************************************
 * MAPA DE EQUIVALENCIAS
 *
 * Cualquier código conocido apunta al Código_Nuevo.
 ******************************************************************/

function construirMapaEquivalenciasB12A_(sh) {

  const ultimaFila =
    sh.getLastRow();

  const ultimaCol =
    sh.getLastColumn();

  const datos =
    sh.getRange(
      1,
      1,
      ultimaFila,
      ultimaCol
    ).getDisplayValues();


  const headers =
    datos[0].map(
      normalizarHeaderB12A_
    );


  const columnas = [

    "CODIGO_NUEVO",
    "CODIGO_VIEJO",
    "BASE_OCTOSIS",
    "BASE_SISFACTURA",
    "BASE_MELIKOBO",
    "BASE_TORETTOS",
    "BASE_WARNES"

  ];


  const indices =
    columnas.map(function(nombre) {

      return headers.indexOf(
        nombre
      );

    });


  const idxNuevo =
    headers.indexOf(
      "CODIGO_NUEVO"
    );


  if (idxNuevo === -1) {

    throw new Error(
      "MAPA_SKU no contiene CODIGO_NUEVO."
    );
  }


  const mapa = new Map();


  for (
    let i = 1;
    i < datos.length;
    i++
  ) {

    const fila =
      datos[i];

    const skuNuevo =
      normalizarCodigoB12A_(
        fila[idxNuevo]
      );


    if (!skuNuevo) {
      continue;
    }


    // El propio SKU nuevo también
    // debe resolver contra sí mismo.

    mapa.set(
      skuNuevo,
      skuNuevo
    );


    indices.forEach(
      function(indice) {

        if (indice === -1) {
          return;
        }

        const codigo =
          normalizarCodigoB12A_(
            fila[indice]
          );

        if (!codigo) {
          return;
        }

        /*
         * No sobrescribimos una equivalencia
         * ya encontrada.
         *
         * Si existen códigos ambiguos,
         * los analizaremos posteriormente.
         */

        if (!mapa.has(codigo)) {

          mapa.set(
            codigo,
            skuNuevo
          );
        }
      }
    );
  }


  return mapa;
}


/******************************************************************
 * STOCK
 ******************************************************************/

function construirStockB12A_(
  sh,
  mapa
) {

  const datos =
    sh.getDataRange()
      .getValues();


  const headers =
    datos[0].map(
      normalizarHeaderB12A_
    );


  const idxSku =
    headers.indexOf("SKU");

  const idxStock =
    headers.indexOf("STOCK");

  const idxDeposito =
    headers.indexOf("DEPOSITO");


  if (
    idxSku === -1 ||
    idxStock === -1 ||
    idxDeposito === -1
  ) {

    throw new Error(
      "La hoja STOCK no tiene " +
      "SKU, STOCK y DEPOSITO."
    );
  }


  const resultado =
    new Map();


  for (
    let i = 1;
    i < datos.length;
    i++
  ) {

    const fila =
      datos[i];


    const codigoOrigen =
      normalizarCodigoB12A_(
        fila[idxSku]
      );


    if (!codigoOrigen) {
      continue;
    }


    const sku =
      mapa.get(codigoOrigen) ||
      codigoOrigen;


    const cantidad =
      numeroB12A_(
        fila[idxStock]
      );


    const deposito =
      normalizarTextoB12A_(
        fila[idxDeposito]
      );


    if (!resultado.has(sku)) {

      resultado.set(
        sku,
        {
          warnes: 0,
          escobar: 0
        }
      );
    }


    const item =
      resultado.get(sku);


    if (
      deposito === "WARNES"
    ) {

      item.warnes += cantidad;

    } else if (
      deposito === "ESCOBAR"
    ) {

      item.escobar += cantidad;
    }
  }


  return resultado;
}


/******************************************************************
 * VENTAS
 ******************************************************************/

function construirVentasB12A_(
  sh,
  mapa
) {

  const datos =
    sh.getDataRange()
      .getValues();


  const headers =
    datos[0].map(
      normalizarHeaderB12A_
    );


  const idxCodigo =
    headers.indexOf(
      "COD_BAM"
    );


  if (idxCodigo === -1) {

    throw new Error(
      "VENTAS no contiene COD_BAM."
    );
  }


  const indices12 =
    SII_B12A.MESES_12M.map(
      function(mes) {

        const indice =
          headers.indexOf(mes);

        if (indice === -1) {

          throw new Error(
            "VENTAS no contiene " +
            mes
          );
        }

        return indice;
      }
    );


  const indices3 =
    SII_B12A.MESES_3M.map(
      function(mes) {

        const indice =
          headers.indexOf(mes);

        if (indice === -1) {

          throw new Error(
            "VENTAS no contiene " +
            mes
          );
        }

        return indice;
      }
    );


  const resultado =
    new Map();


  for (
    let i = 1;
    i < datos.length;
    i++
  ) {

    const fila =
      datos[i];


    const codigoOrigen =
      normalizarCodigoB12A_(
        fila[idxCodigo]
      );


    if (!codigoOrigen) {
      continue;
    }


    const sku =
      mapa.get(codigoOrigen) ||
      codigoOrigen;


    let consumo12 = 0;
    let consumo3 = 0;


    indices12.forEach(
      function(indice) {

        consumo12 +=
          numeroB12A_(
            fila[indice]
          );
      }
    );


    indices3.forEach(
      function(indice) {

        consumo3 +=
          numeroB12A_(
            fila[indice]
          );
      }
    );


    /*
     * Puede haber más de una fila de VENTAS
     * que termine resolviendo al mismo SKU.
     */

    if (!resultado.has(sku)) {

      resultado.set(
        sku,
        {
          consumo12: 0,
          consumo3: 0
        }
      );
    }


    const item =
      resultado.get(sku);


    item.consumo12 += consumo12;
    item.consumo3 += consumo3;
  }


  return resultado;
}


/******************************************************************
 * ESCRITURA MODELO_COMPRAS
 ******************************************************************/

function escribirModeloB12A_(
  sh,
  stock,
  ventas
) {

  const filaHeader =
    SII_B12A.FILA_HEADER_MODELO;


  const ultimaFila =
    sh.getLastRow();

  const ultimaCol =
    sh.getLastColumn();


  if (
    ultimaFila <= filaHeader
  ) {

    throw new Error(
      "MODELO_COMPRAS todavía no contiene SKU."
    );
  }


  const headers =
    sh.getRange(
      filaHeader,
      1,
      1,
      ultimaCol
    )
      .getDisplayValues()[0]
      .map(
        normalizarHeaderB12A_
      );


  const idx = {

    sku:
      headers.indexOf("SKU"),

    consumo12:
      headers.indexOf("CONSUMO_12M"),

    promedio:
      headers.indexOf("PROMEDIO_MENSUAL"),

    consumo3:
      headers.indexOf("CONSUMO_3M"),

    warnes:
      headers.indexOf("STOCK_WARNES"),

    escobar:
      headers.indexOf("STOCK_ESCOBAR"),

    total:
      headers.indexOf("STOCK_TOTAL")
  };


  Object.keys(idx).forEach(
    function(campo) {

      if (idx[campo] === -1) {

        throw new Error(
          "MODELO_COMPRAS: falta columna " +
          campo
        );
      }
    }
  );


  const cantidadFilas =
    ultimaFila -
    filaHeader;


  const datos =
    sh.getRange(
      filaHeader + 1,
      1,
      cantidadFilas,
      ultimaCol
    ).getValues();


  let conStock = 0;
  let conVentas = 0;
  let sinStock = 0;
  let sinVentas = 0;


  datos.forEach(
    function(fila) {

      const sku =
        normalizarCodigoB12A_(
          fila[idx.sku]
        );


      if (!sku) {
        return;
      }


      // =============================
      // STOCK
      // =============================

      const datoStock =
        stock.get(sku);


      if (datoStock) {

        fila[idx.warnes] =
          datoStock.warnes;

        fila[idx.escobar] =
          datoStock.escobar;

        fila[idx.total] =
          datoStock.warnes +
          datoStock.escobar;

        conStock++;

      } else {

        fila[idx.warnes] = 0;
        fila[idx.escobar] = 0;
        fila[idx.total] = 0;

        sinStock++;
      }


      // =============================
      // VENTAS
      // =============================

      const datoVenta =
        ventas.get(sku);


      if (datoVenta) {

        fila[idx.consumo12] =
          datoVenta.consumo12;

        fila[idx.promedio] =
          datoVenta.consumo12 / 12;

        fila[idx.consumo3] =
          datoVenta.consumo3;

        conVentas++;

      } else {

        fila[idx.consumo12] = 0;
        fila[idx.promedio] = 0;
        fila[idx.consumo3] = 0;

        sinVentas++;
      }
    }
  );


  /*
   * Una sola escritura masiva.
   * Evitamos setValue() por SKU.
   */

  sh.getRange(
    filaHeader + 1,
    1,
    cantidadFilas,
    ultimaCol
  ).setValues(datos);


  /*
   * Formatos numéricos.
   */

  sh.getRange(
    filaHeader + 1,
    idx.consumo12 + 1,
    cantidadFilas,
    1
  ).setNumberFormat("#,##0");


  sh.getRange(
    filaHeader + 1,
    idx.promedio + 1,
    cantidadFilas,
    1
  ).setNumberFormat("#,##0.00");


  sh.getRange(
    filaHeader + 1,
    idx.consumo3 + 1,
    cantidadFilas,
    1
  ).setNumberFormat("#,##0");


  sh.getRange(
    filaHeader + 1,
    idx.warnes + 1,
    cantidadFilas,
    3
  ).setNumberFormat("#,##0.00");


  return {

    filas:
      cantidadFilas,

    skuConStock:
      conStock,

    skuConVentas:
      conVentas,

    skuSinStock:
      sinStock,

    skuSinVentas:
      sinVentas
  };
}


/******************************************************************
 * UTILIDADES
 ******************************************************************/

function normalizarHeaderB12A_(valor) {

  return String(valor || "")
    .trim()
    .toUpperCase()
    .normalize("NFD")
    .replace(
      /[\u0300-\u036f]/g,
      ""
    )
    .replace(
      /[^A-Z0-9]+/g,
      "_"
    )
    .replace(
      /^_+|_+$/g,
      ""
    );
}


function normalizarCodigoB12A_(valor) {

  return String(valor || "")
    .trim()
    .toUpperCase();
}


function normalizarTextoB12A_(valor) {

  return String(valor || "")
    .trim()
    .toUpperCase()
    .normalize("NFD")
    .replace(
      /[\u0300-\u036f]/g,
      ""
    );
}


function numeroB12A_(valor) {

  if (
    typeof valor === "number"
  ) {

    return isNaN(valor)
      ? 0
      : valor;
  }


  let texto =
    String(valor || "")
      .trim();


  if (!texto) {
    return 0;
  }


  /*
   * Soporta números que eventualmente
   * lleguen como texto.
   */

  texto =
    texto.replace(/\s/g, "");


  if (
    texto.indexOf(",") !== -1 &&
    texto.indexOf(".") !== -1
  ) {

    /*
     * 1.234,56
     */

    texto =
      texto
        .replace(/\./g, "")
        .replace(",", ".");

  } else if (
    texto.indexOf(",") !== -1
  ) {

    texto =
      texto.replace(",", ".");
  }


  const numero =
    Number(texto);


  return isNaN(numero)
    ? 0
    : numero;
}

function cargarBaseModeloComprasB12A() {

  const inicio = Date.now();

  const ss =
    SpreadsheetApp.getActiveSpreadsheet();

  const shMapa =
    ss.getSheetByName("MAPA_SKU");

  const shModelo =
    ss.getSheetByName("MODELO_COMPRAS");

  if (!shMapa) {
    throw new Error(
      "No existe MAPA_SKU."
    );
  }

  if (!shModelo) {
    throw new Error(
      "No existe MODELO_COMPRAS."
    );
  }

  Logger.log("B12A BASE - INICIO");


  // ==========================================================
  // DATOS DE ORIGEN
  // ==========================================================

  const ultimaFilaMapa =
    shMapa.getLastRow();

  if (ultimaFilaMapa < 2) {
    throw new Error(
      "MAPA_SKU no contiene registros."
    );
  }

  const cantidadOrigen =
    ultimaFilaMapa - 1;


  Logger.log(
    "MAPA_SKU registros: " +
    cantidadOrigen
  );


  // ==========================================================
  // LEEMOS SOLAMENTE A:J
  // ==========================================================

  const datos =
    shMapa.getRange(
      2,
      1,
      cantidadOrigen,
      10
    ).getDisplayValues();


  Logger.log(
    "Lectura MAPA_SKU OK"
  );


  // ==========================================================
  // VALIDAR SKU Y DUPLICADOS
  // ==========================================================

  const vistos =
    new Set();

  const filas = [];

  let sinSku = 0;
  let duplicados = 0;


  datos.forEach(function(fila) {

    const sku =
      String(
        fila[0] || ""
      ).trim();

    if (!sku) {

      sinSku++;

      return;
    }


    const clave =
      sku.toUpperCase();


    if (vistos.has(clave)) {

      duplicados++;

      return;
    }


    vistos.add(clave);

    filas.push(fila);

  });


  Logger.log(
    "SKU válidos: " +
    filas.length
  );

  Logger.log(
    "Duplicados: " +
    duplicados
  );


  // ==========================================================
  // CAPACIDAD DE MODELO_COMPRAS
  // ==========================================================

  const filaInicial = 3;

  const ultimaFilaNecesaria =
    filaInicial +
    filas.length -
    1;


  const maxRows =
    shModelo.getMaxRows();


  Logger.log(
    "MODELO maxRows actual: " +
    maxRows
  );


  if (
    maxRows <
    ultimaFilaNecesaria
  ) {

    const faltan =
      ultimaFilaNecesaria -
      maxRows;


    Logger.log(
      "Agregando filas: " +
      faltan
    );


    shModelo.insertRowsAfter(
      maxRows,
      faltan
    );


    Logger.log(
      "Filas agregadas OK"
    );
  }


  // ==========================================================
  // ESCRITURA POR BLOQUES
  // ==========================================================

  const TAMANO_BLOQUE = 3000;


  for (
    let desde = 0;
    desde < filas.length;
    desde += TAMANO_BLOQUE
  ) {

    const bloque =
      filas.slice(
        desde,
        desde + TAMANO_BLOQUE
      );


    shModelo.getRange(
      filaInicial + desde,
      1,
      bloque.length,
      10
    ).setValues(
      bloque
    );


    Logger.log(
      "Escritos " +
      Math.min(
        desde + bloque.length,
        filas.length
      ) +
      " / " +
      filas.length
    );
  }


  // ==========================================================
  // LIMPIAR SÓLO SOBRANTE ANTERIOR EN A:J
  // ==========================================================

  const ultimaFilaAnterior =
    shModelo.getLastRow();


  if (
    ultimaFilaAnterior >
    ultimaFilaNecesaria
  ) {

    shModelo.getRange(
      ultimaFilaNecesaria + 1,
      1,
      ultimaFilaAnterior -
        ultimaFilaNecesaria,
      10
    ).clearContent();
  }


  const resultado = {

    version:
      "0.1.201",

    filasMapaSku:
      cantidadOrigen,

    skuModelo:
      filas.length,

    filasSinSku:
      sinSku,

    duplicadosSku:
      duplicados,

    duracionMs:
      Date.now() - inicio
  };


  Logger.log(
    JSON.stringify(
      resultado,
      null,
      2
    )
  );


  ss.toast(
    "Base MODELO_COMPRAS cargada",
    "Sprint B.1.2-A",
    5
  );


  return resultado;
}

function valorMapaB12A_(
  fila,
  indice
) {

  if (
    indice === -1 ||
    indice === undefined
  ) {
    return "";
  }

  return fila[indice];
}

function testB12() {
  Logger.log("TEST B12 OK");
}

function auditarModeloComprasB12A() {

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName("MODELO_COMPRAS");

  if (!sh) {
    throw new Error("No existe MODELO_COMPRAS.");
  }

  const datos = sh.getDataRange().getDisplayValues();

  // Encabezados en fila 2
  const headers = datos[1].map(function(v) {
    return String(v || "")
      .trim()
      .toUpperCase();
  });

  const idxSku = headers.indexOf("SKU");
  const idxStockWarnes = headers.indexOf("STOCK_WARNES");
  const idxStockEscobar = headers.indexOf("STOCK_ESCOBAR");
  const idxStockTotal = headers.indexOf("STOCK_TOTAL");
  const idxConsumo12 = headers.indexOf("CONSUMO_12M");
  const idxPromedio = headers.indexOf("PROMEDIO_MENSUAL");
  const idxConsumo3 = headers.indexOf("CONSUMO_3M");

  if (idxSku === -1) {
    throw new Error("No encontré la columna SKU.");
  }

  const skusPrueba = [
    "166-175-65R14-82H",
    "ACCPOWJAN"
  ];

  Logger.log("===== SKU SOLICITADOS =====");

  skusPrueba.forEach(function(skuBuscado) {

    const fila = datos.slice(2).find(function(fila) {
      return String(fila[idxSku] || "")
        .trim()
        .toUpperCase() === skuBuscado.toUpperCase();
    });

    if (!fila) {
      Logger.log(skuBuscado + " -> NO ENCONTRADO");
      return;
    }

    Logger.log(
      skuBuscado +
      " | Warnes=" + fila[idxStockWarnes] +
      " | Escobar=" + fila[idxStockEscobar] +
      " | Total=" + fila[idxStockTotal] +
      " | Consumo12M=" + fila[idxConsumo12] +
      " | Promedio=" + fila[idxPromedio] +
      " | Consumo3M=" + fila[idxConsumo3]
    );
  });


  Logger.log("===== EJEMPLOS SIN STOCK =====");

  let encontrados = 0;

  for (let i = 2; i < datos.length; i++) {

    const fila = datos[i];

    const sku = String(fila[idxSku] || "").trim();

    if (!sku) {
      continue;
    }

    const warnes =
      Number(String(fila[idxStockWarnes] || "0").replace(",", ".")) || 0;

    const escobar =
      Number(String(fila[idxStockEscobar] || "0").replace(",", ".")) || 0;

    /*
     * Buscamos SKU que NO tuvieron coincidencia de stock.
     * Para esta primera auditoría mostramos candidatos con ambos depósitos en 0.
     */
    if (warnes === 0 && escobar === 0) {

      Logger.log(
        sku +
        " | Warnes=" + fila[idxStockWarnes] +
        " | Escobar=" + fila[idxStockEscobar] +
        " | Total=" + fila[idxStockTotal] +
        " | Consumo12M=" + fila[idxConsumo12] +
        " | Promedio=" + fila[idxPromedio] +
        " | Consumo3M=" + fila[idxConsumo3]
      );

      encontrados++;

      if (encontrados >= 10) {
        break;
      }
    }
  }

  Logger.log(
    "Ejemplos mostrados sin stock: " +
    encontrados
  );
}

function auditarSkuSinCruceStockB12A() {

  const ss =
    SpreadsheetApp.getActiveSpreadsheet();

  const shModelo =
    ss.getSheetByName("MODELO_COMPRAS");

  const shStock =
    ss.getSheetByName("STOCK");

  const shMapa =
    ss.getSheetByName("MAPA_SKU");

  if (!shModelo || !shStock || !shMapa) {
    throw new Error(
      "Falta MODELO_COMPRAS, STOCK o MAPA_SKU."
    );
  }

  Logger.log(
    "Construyendo equivalencias..."
  );

  const mapa =
    construirMapaEquivalenciasB12A_(
      shMapa
    );

  Logger.log(
    "Construyendo mapa de stock..."
  );

  const stock =
    construirStockB12A_(
      shStock,
      mapa
    );

  const ultimaFila =
    shModelo.getLastRow();

  const ultimaCol =
    shModelo.getLastColumn();

  const headers =
    shModelo.getRange(
      2,
      1,
      1,
      ultimaCol
    )
      .getDisplayValues()[0]
      .map(
        normalizarHeaderB12A_
      );

  const idxSku =
    headers.indexOf("SKU");

  if (idxSku === -1) {
    throw new Error(
      "MODELO_COMPRAS no contiene SKU."
    );
  }

  const skus =
    shModelo.getRange(
      3,
      idxSku + 1,
      ultimaFila - 2,
      1
    ).getDisplayValues();

  const sinCruce = [];

  skus.forEach(function(fila) {

    const sku =
      normalizarCodigoB12A_(
        fila[0]
      );

    if (!sku) {
      return;
    }

    if (!stock.has(sku)) {
      sinCruce.push(sku);
    }
  });

  Logger.log(
    "SKU SIN CRUCE STOCK: " +
    sinCruce.length
  );

  sinCruce
    .slice(0, 30)
    .forEach(function(sku, indice) {

      Logger.log(
        (indice + 1) +
        ". " +
        sku
      );

    });

  return sinCruce;
}