/******************************************************************
 * SII - MODELO DE COMPRAS
 * Sprint B.1.4-A
 * Versión 0.1.400
 *
 * Calcula:
 *
 *   COMPRA_SUGERIDA
 *   RIESGO
 *   PRIORIDAD
 *
 * Utiliza:
 *
 *   PROMEDIO_MENSUAL
 *   STOCK_TOTAL
 *   PENDIENTE_TOTAL
 *   COBERTURA_OBJETIVO
 *   COBERTURA_ACTUAL
 *   COBERTURA_FUTURA
 *
 * Parámetros:
 *
 *   COBERTURA_URGENTE_MESES
 *   COBERTURA_COMPRAR_MESES
 *   PRIORIDAD_SIN_STOCK
 *   PRIORIDAD_URGENTE
 *   PRIORIDAD_COMPRAR
 *   PRIORIDAD_REVISAR
 *   PRIORIDAD_OK
 *
 ******************************************************************/

function actualizarRecomendacionesModeloB14() {

  const inicio = Date.now();

  const ss =
    SpreadsheetApp.getActiveSpreadsheet();

  const shModelo =
    ss.getSheetByName("MODELO_COMPRAS");

  const shParametros =
    ss.getSheetByName("PARAMETROS_COMPRAS");

  if (!shModelo) {
    throw new Error(
      "No existe MODELO_COMPRAS."
    );
  }

  if (!shParametros) {
    throw new Error(
      "No existe PARAMETROS_COMPRAS."
    );
  }

  Logger.log("B.1.4-A - Inicio");


  // ==========================================================
  // PARÁMETROS
  // ==========================================================

  const parametros =
    cargarParametrosB14_(
      shParametros
    );


  const coberturaUrgente =
    obtenerParametroB14_(
      parametros,
      "COBERTURA_URGENTE_MESES",
      1
    );

  const coberturaComprar =
    obtenerParametroB14_(
      parametros,
      "COBERTURA_COMPRAR_MESES",
      2
    );

  const prioridadSinStock =
    obtenerParametroB14_(
      parametros,
      "PRIORIDAD_SIN_STOCK",
      100
    );

  const prioridadUrgente =
    obtenerParametroB14_(
      parametros,
      "PRIORIDAD_URGENTE",
      90
    );

  const prioridadComprar =
    obtenerParametroB14_(
      parametros,
      "PRIORIDAD_COMPRAR",
      80
    );

  const prioridadRevisar =
    obtenerParametroB14_(
      parametros,
      "PRIORIDAD_REVISAR",
      40
    );

  const prioridadOk =
    obtenerParametroB14_(
      parametros,
      "PRIORIDAD_OK",
      0
    );


  Logger.log(
    "Cobertura urgente: " +
    coberturaUrgente
  );

  Logger.log(
    "Cobertura comprar: " +
    coberturaComprar
  );


  // ==========================================================
  // MODELO
  // ==========================================================

  const FILA_HEADER = 2;

  const ultimaFila =
    shModelo.getLastRow();

  const ultimaCol =
    shModelo.getLastColumn();

  if (ultimaFila <= FILA_HEADER) {
    throw new Error(
      "MODELO_COMPRAS no contiene datos."
    );
  }


  const cantidadFilas =
    ultimaFila - FILA_HEADER;


  const headers =
    shModelo.getRange(
      FILA_HEADER,
      1,
      1,
      ultimaCol
    )
      .getDisplayValues()[0]
      .map(normalizarHeaderB14_);


  const idx = {

    sku:
      headers.indexOf("SKU"),

    promedio:
      headers.indexOf(
        "PROMEDIO_MENSUAL"
      ),

    stock:
      headers.indexOf(
        "STOCK_TOTAL"
      ),

    pendiente:
      headers.indexOf(
        "PENDIENTE_TOTAL"
      ),

    objetivo:
      headers.indexOf(
        "COBERTURA_OBJETIVO"
      ),

    coberturaActual:
      headers.indexOf(
        "COBERTURA_ACTUAL"
      ),

    coberturaFutura:
      headers.indexOf(
        "COBERTURA_FUTURA"
      ),

    compra:
      headers.indexOf(
        "COMPRA_SUGERIDA"
      ),

    riesgo:
      headers.indexOf(
        "RIESGO"
      ),

    prioridad:
      headers.indexOf(
        "PRIORIDAD"
      )
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


  const datos =
    shModelo.getRange(
      FILA_HEADER + 1,
      1,
      cantidadFilas,
      ultimaCol
    ).getValues();


  // ==========================================================
  // CONTADORES
  // ==========================================================

  const contador = {

    sinConsumo: 0,

    sinStock: 0,

    urgente: 0,

    comprar: 0,

    revisar: 0,

    ok: 0,

    conCompra: 0,

    unidadesSugeridas: 0

  };


  // ==========================================================
  // CÁLCULO
  // ==========================================================

  datos.forEach(function(fila) {

    const sku =
      String(
        fila[idx.sku] || ""
      ).trim();


    if (!sku) {
      return;
    }


    const promedio =
      numeroB14_(
        fila[idx.promedio]
      );

    const stock =
      Math.max(
        0,
        numeroB14_(
          fila[idx.stock]
        )
      );

    const pendiente =
      Math.max(
        0,
        numeroB14_(
          fila[idx.pendiente]
        )
      );

    const objetivo =
      numeroB14_(
        fila[idx.objetivo]
      );


    // ========================================================
    // SIN CONSUMO
    // ========================================================

    if (promedio <= 0) {

      fila[idx.compra] = 0;

      fila[idx.riesgo] =
        "SIN CONSUMO";

      fila[idx.prioridad] =
        prioridadOk;

      contador.sinConsumo++;

      return;
    }


    // ========================================================
    // COBERTURAS
    // ========================================================

    const coberturaActual =
      stock / promedio;

    const coberturaFutura =
      (
        stock +
        pendiente
      ) / promedio;


    /*
     * Recalculamos para garantizar
     * consistencia del motor.
     */

    fila[idx.coberturaActual] =
      coberturaActual;

    fila[idx.coberturaFutura] =
      coberturaFutura;


    // ========================================================
    // COMPRA SUGERIDA
    // ========================================================

    const stockObjetivo =
      promedio *
      objetivo;


    let compra =
      stockObjetivo -
      stock -
      pendiente;


    if (compra < 0) {
      compra = 0;
    }


    /*
     * La cantidad de compra debe ser
     * una unidad entera.
     *
     * Se redondea hacia arriba para
     * no quedar por debajo del objetivo.
     */

    compra =
      Math.ceil(compra);


    fila[idx.compra] =
      compra;


    if (compra > 0) {

      contador.conCompra++;

      contador.unidadesSugeridas +=
        compra;
    }


    // ========================================================
    // RIESGO
    // ========================================================

    let riesgo = "";
    let prioridad = 0;


    /*
     * SIN STOCK sólo es crítico si
     * tampoco lo que viene permite
     * superar el umbral urgente.
     */

    if (
      stock <= 0 &&
      coberturaFutura <
        coberturaUrgente
    ) {

      riesgo =
        "SIN STOCK";

      prioridad =
        prioridadSinStock;

      contador.sinStock++;


    } else if (
      coberturaFutura <
        coberturaUrgente
    ) {

      riesgo =
        "URGENTE";

      prioridad =
        prioridadUrgente;

      contador.urgente++;


    } else if (
      coberturaFutura <
        coberturaComprar
    ) {

      riesgo =
        "COMPRAR";

      prioridad =
        prioridadComprar;

      contador.comprar++;


    } else if (
      coberturaFutura <
        objetivo
    ) {

      riesgo =
        "REVISAR";

      prioridad =
        prioridadRevisar;

      contador.revisar++;


    } else {

      riesgo =
        "OK";

      prioridad =
        prioridadOk;

      contador.ok++;

    }


    fila[idx.riesgo] =
      riesgo;

    fila[idx.prioridad] =
      prioridad;

  });


  // ==========================================================
  // ESCRITURA
  // ==========================================================

  shModelo.getRange(
    FILA_HEADER + 1,
    1,
    cantidadFilas,
    ultimaCol
  ).setValues(datos);


  // ==========================================================
  // FORMATOS
  // ==========================================================

  shModelo.getRange(
    FILA_HEADER + 1,
    idx.coberturaActual + 1,
    cantidadFilas,
    2
  ).setNumberFormat(
    "0.00"
  );


  shModelo.getRange(
    FILA_HEADER + 1,
    idx.compra + 1,
    cantidadFilas,
    1
  ).setNumberFormat(
    "0"
  );


  shModelo.getRange(
    FILA_HEADER + 1,
    idx.prioridad + 1,
    cantidadFilas,
    1
  ).setNumberFormat(
    "0"
  );


  SpreadsheetApp.flush();


  // ==========================================================
  // RESULTADO
  // ==========================================================

  const resultado = {

    version:
      "0.1.400",

    filasModelo:
      cantidadFilas,

    sinConsumo:
      contador.sinConsumo,

    sinStock:
      contador.sinStock,

    urgente:
      contador.urgente,

    comprar:
      contador.comprar,

    revisar:
      contador.revisar,

    ok:
      contador.ok,

    skuConCompraSugerida:
      contador.conCompra,

    unidadesCompraSugerida:
      contador.unidadesSugeridas,

    coberturaUrgente:
      coberturaUrgente,

    coberturaComprar:
      coberturaComprar,

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
    "Recomendaciones calculadas",
    "Sprint B.1.4",
    5
  );


  return resultado;
}


/******************************************************************
 * PARÁMETROS
 ******************************************************************/

function cargarParametrosB14_(
  sh
) {

  const datos =
    sh.getDataRange()
      .getDisplayValues();


  if (datos.length < 2) {
    return new Map();
  }


  const headers =
    datos[0].map(
      normalizarHeaderB14_
    );


  const iTipo =
    headers.indexOf("TIPO");

  const iClave =
    headers.indexOf("CLAVE");

  const iValor =
    headers.indexOf("VALOR");

  const iActivo =
    headers.indexOf("ACTIVO");


  if (
    iTipo === -1 ||
    iClave === -1 ||
    iValor === -1
  ) {

    throw new Error(
      "PARAMETROS_COMPRAS no tiene " +
      "TIPO/CLAVE/VALOR."
    );
  }


  const mapa =
    new Map();


  for (
    let i = 1;
    i < datos.length;
    i++
  ) {

    const tipo =
      normalizarTextoB14_(
        datos[i][iTipo]
      );


    if (tipo !== "GENERAL") {
      continue;
    }


    if (iActivo !== -1) {

      const activo =
        normalizarTextoB14_(
          datos[i][iActivo]
        );


      if (
        activo &&
        activo !== "SI"
      ) {
        continue;
      }
    }


    const clave =
      normalizarTextoB14_(
        datos[i][iClave]
      );


    if (!clave) {
      continue;
    }


    mapa.set(
      clave,
      numeroB14_(
        datos[i][iValor]
      )
    );

  }


  return mapa;
}


function obtenerParametroB14_(
  mapa,
  clave,
  valorDefault
) {

  if (mapa.has(clave)) {

    return mapa.get(clave);
  }


  return valorDefault;
}


/******************************************************************
 * UTILIDADES
 ******************************************************************/

function normalizarHeaderB14_(
  valor
) {

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


function normalizarTextoB14_(
  valor
) {

  return String(valor || "")
    .trim()
    .toUpperCase()
    .normalize("NFD")
    .replace(
      /[\u0300-\u036f]/g,
      ""
    )
    .replace(
      /\s+/g,
      " "
    );
}


function numeroB14_(
  valor
) {

  if (
    typeof valor === "number"
  ) {

    return Number.isFinite(valor)
      ? valor
      : 0;
  }


  let texto =
    String(valor || "")
      .trim()
      .replace(/\s/g, "");


  if (!texto) {
    return 0;
  }


  if (
    texto.includes(",") &&
    texto.includes(".")
  ) {

    const coma =
      texto.lastIndexOf(",");

    const punto =
      texto.lastIndexOf(".");


    if (punto > coma) {

      texto =
        texto.replace(
          /,/g,
          ""
        );

    } else {

      texto =
        texto
          .replace(/\./g, "")
          .replace(",", ".");
    }

  } else if (
    texto.includes(",")
  ) {

    texto =
      texto.replace(",", ".");
  }


  const numero =
    Number(texto);


  return Number.isFinite(numero)
    ? numero
    : 0;
}

function auditarRecomendacionesB14() {

  const ss =
    SpreadsheetApp.getActiveSpreadsheet();

  const sh =
    ss.getSheetByName(
      "MODELO_COMPRAS"
    );

  if (!sh) {
    throw new Error(
      "No existe MODELO_COMPRAS."
    );
  }

  const datos =
    sh.getDataRange()
      .getDisplayValues();

  const headers =
    datos[1].map(
      normalizarHeaderB14_
    );

  const idx = {

    sku:
      headers.indexOf("SKU"),

    promedio:
      headers.indexOf(
        "PROMEDIO_MENSUAL"
      ),

    stock:
      headers.indexOf(
        "STOCK_TOTAL"
      ),

    pendiente:
      headers.indexOf(
        "PENDIENTE_TOTAL"
      ),

    objetivo:
      headers.indexOf(
        "COBERTURA_OBJETIVO"
      ),

    actual:
      headers.indexOf(
        "COBERTURA_ACTUAL"
      ),

    futura:
      headers.indexOf(
        "COBERTURA_FUTURA"
      ),

    compra:
      headers.indexOf(
        "COMPRA_SUGERIDA"
      ),

    riesgo:
      headers.indexOf(
        "RIESGO"
      ),

    prioridad:
      headers.indexOf(
        "PRIORIDAD"
      )
  };


  const riesgos = [
    "SIN STOCK",
    "URGENTE",
    "COMPRAR",
    "REVISAR",
    "OK"
  ];


  riesgos.forEach(
    function(riesgoBuscado) {

      Logger.log(
        "=================================="
      );

      Logger.log(
        riesgoBuscado
      );

      Logger.log(
        "=================================="
      );


      let encontrados = 0;


      for (
        let i = 2;
        i < datos.length;
        i++
      ) {

        const fila =
          datos[i];


        const riesgo =
          String(
            fila[idx.riesgo] || ""
          ).trim();


        if (
          riesgo !==
          riesgoBuscado
        ) {
          continue;
        }


        Logger.log(
          "SKU=" +
          fila[idx.sku] +

          " | Prom=" +
          fila[idx.promedio] +

          " | Stock=" +
          fila[idx.stock] +

          " | Pend=" +
          fila[idx.pendiente] +

          " | Obj=" +
          fila[idx.objetivo] +

          " | Cob.Act=" +
          fila[idx.actual] +

          " | Cob.Fut=" +
          fila[idx.futura] +

          " | Compra=" +
          fila[idx.compra] +

          " | Prioridad=" +
          fila[idx.prioridad]
        );


        encontrados++;


        if (
          encontrados >= 3
        ) {
          break;
        }
      }

    }
  );
}