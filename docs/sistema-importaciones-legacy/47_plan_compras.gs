/**
 * ============================================================
 * SII - SPRINT B.1.5
 * PLAN DE COMPRAS
 * ============================================================
 *
 * FASE A
 * Diagnóstico de la estructura actual de PLAN_COMPRAS.
 *
 * No modifica ninguna hoja.
 * ============================================================
 */

function diagnosticarPlanComprasB15() {

  const ss = SpreadsheetApp.getActiveSpreadsheet();

  const nombreHoja = "PLAN_COMPRAS";

  const sh = ss.getSheetByName(nombreHoja);

  Logger.log("======================================");
  Logger.log("SII - SPRINT B.1.5");
  Logger.log("DIAGNÓSTICO PLAN_COMPRAS");
  Logger.log("======================================");

  if (!sh) {

    Logger.log("La hoja PLAN_COMPRAS no existe.");
    Logger.log("Será necesario crearla.");

    return;
  }

  const ultimaFila = sh.getLastRow();
  const ultimaColumna = sh.getLastColumn();

  Logger.log("Filas: " + ultimaFila);
  Logger.log("Columnas: " + ultimaColumna);

  if (
    ultimaFila === 0 ||
    ultimaColumna === 0
  ) {

    Logger.log("La hoja existe pero está vacía.");

    return;
  }

  const datos = sh
    .getRange(
      1,
      1,
      Math.min(ultimaFila, 10),
      ultimaColumna
    )
    .getDisplayValues();

  Logger.log("===== ENCABEZADOS FILA 1 =====");

  datos[0].forEach(
    function(valor, indice) {

      Logger.log(
        "C" +
        (indice + 1) +
        " = [" +
        valor +
        "]"
      );

    }
  );

  if (ultimaFila >= 2) {

    Logger.log("===== ENCABEZADOS FILA 2 =====");

    datos[1].forEach(
      function(valor, indice) {

        Logger.log(
          "C" +
          (indice + 1) +
          " = [" +
          valor +
          "]"
        );

      }
    );

  }

  Logger.log("===== MUESTRA =====");

  for (
    let i = 0;
    i < datos.length;
    i++
  ) {

    Logger.log(
      "Fila " +
      (i + 1) +
      ": " +
      JSON.stringify(datos[i])
    );

  }

  Logger.log("======================================");
  Logger.log("FIN DIAGNÓSTICO B.1.5");
  Logger.log("======================================");
}

/**
 * ============================================================
 * SII - B.1.5-A
 * COMPARACIÓN MODELO_COMPRAS vs PLAN_COMPRAS
 *
 * Solo diagnóstico.
 * No modifica hojas.
 * ============================================================
 */
function compararModeloVsPlanB15() {

  const ss = SpreadsheetApp.getActiveSpreadsheet();

  const modelo = ss.getSheetByName("MODELO_COMPRAS");
  const plan = ss.getSheetByName("PLAN_COMPRAS");

  if (!modelo) {
    throw new Error("No existe MODELO_COMPRAS.");
  }

  if (!plan) {
    throw new Error("No existe PLAN_COMPRAS.");
  }

  // MODELO_COMPRAS tiene encabezados en fila 2
  const headersModelo = modelo
    .getRange(2, 1, 1, modelo.getLastColumn())
    .getDisplayValues()[0]
    .map(normalizarHeaderB15_);

  // PLAN_COMPRAS tiene encabezados en fila 1
  const headersPlan = plan
    .getRange(1, 1, 1, plan.getLastColumn())
    .getDisplayValues()[0]
    .map(normalizarHeaderB15_);

  Logger.log("======================================");
  Logger.log("B.1.5-A - COMPARACIÓN DE ESTRUCTURAS");
  Logger.log("======================================");

  Logger.log(
    "MODELO_COMPRAS: " +
    headersModelo.length +
    " columnas"
  );

  Logger.log(
    "PLAN_COMPRAS: " +
    headersPlan.length +
    " columnas"
  );

  Logger.log("");
  Logger.log("===== COINCIDEN EXACTAMENTE =====");

  headersPlan.forEach(function(header) {

    if (headersModelo.indexOf(header) !== -1) {

      Logger.log(
        header +
        " | PLAN C" +
        (headersPlan.indexOf(header) + 1) +
        " | MODELO C" +
        (headersModelo.indexOf(header) + 1)
      );

    }

  });

  Logger.log("");
  Logger.log("===== SOLO EN PLAN_COMPRAS =====");

  headersPlan.forEach(function(header) {

    if (headersModelo.indexOf(header) === -1) {

      Logger.log(
        header +
        " | C" +
        (headersPlan.indexOf(header) + 1)
      );

    }

  });

  Logger.log("");
  Logger.log("===== SOLO EN MODELO_COMPRAS =====");

  headersModelo.forEach(function(header) {

    if (headersPlan.indexOf(header) === -1) {

      Logger.log(
        header +
        " | C" +
        (headersModelo.indexOf(header) + 1)
      );

    }

  });

  // ----------------------------------------------------------
  // POSIBLES EQUIVALENCIAS SEMÁNTICAS
  // ----------------------------------------------------------

  const equivalencias = [

    ["CONSUMO_12M", "CONSUMO_12_MESES"],

    ["PENDIENTE_TOTAL", "PENDIENTE_RECIBIR"],

    ["COBERTURA_OBJETIVO", "OBJETIVO_MESES"],

    ["COBERTURA_ACTUAL", "COBERTURA_ACTUAL_MESES"],

    ["COBERTURA_FUTURA", "COBERTURA_PROYECTADA_MESES"],

    ["COMPRA_SUGERIDA", "CANTIDAD_SUGERIDA"],

    ["LEAD_TIME", "LEAD_TIME_DIAS"],

    ["RIESGO", "RIESGO_RUPTURA"]

  ];

  Logger.log("");
  Logger.log("===== POSIBLES EQUIVALENCIAS =====");

  equivalencias.forEach(function(par) {

    const campoModelo = par[0];
    const campoPlan = par[1];

    const existeModelo =
      headersModelo.indexOf(campoModelo) !== -1;

    const existePlan =
      headersPlan.indexOf(campoPlan) !== -1;

    Logger.log(
      campoModelo +
      " -> " +
      campoPlan +
      " | MODELO=" +
      (existeModelo ? "SI" : "NO") +
      " | PLAN=" +
      (existePlan ? "SI" : "NO")
    );

  });

  Logger.log("");
  Logger.log("======================================");
  Logger.log("FIN B.1.5-A");
  Logger.log("======================================");
}


/**
 * Normalización de encabezados B.1.5
 */
function normalizarHeaderB15_(valor) {

  return String(valor || "")
    .trim()
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "_")
    .replace(/[^A-Z0-9_]/g, "");
}

/******************************************************************
 * SII - PLAN DE COMPRAS V2
 * Sprint B.1.5-B
 * Versión 0.1.500
 *
 * Fuente única:
 *   MODELO_COMPRAS
 *
 * Genera:
 *   PLAN_COMPRAS_V2
 *
 * NO modifica:
 *   PLAN_COMPRAS
 *   DASHBOARD_V5
 ******************************************************************/

function generarPlanComprasV2B15() {

  const inicio = Date.now();

  const ss =
    SpreadsheetApp.getActiveSpreadsheet();

  const shModelo =
    ss.getSheetByName(
      "MODELO_COMPRAS"
    );

  if (!shModelo) {
    throw new Error(
      "No existe MODELO_COMPRAS."
    );
  }

  const NOMBRE_SALIDA =
    "PLAN_COMPRAS_V2";


  Logger.log(
    "B.1.5-B - Inicio"
  );


  // ==========================================================
  // 1. LEER MODELO_COMPRAS
  // ==========================================================

  const FILA_HEADER = 2;

  const ultimaFila =
    shModelo.getLastRow();

  const ultimaCol =
    shModelo.getLastColumn();

  if (
    ultimaFila <=
    FILA_HEADER
  ) {
    throw new Error(
      "MODELO_COMPRAS no contiene registros."
    );
  }


  const headersModelo =
    shModelo.getRange(
      FILA_HEADER,
      1,
      1,
      ultimaCol
    )
      .getDisplayValues()[0]
      .map(
        normalizarHeaderB15_
      );


  const idx = {

    sku:
      headersModelo.indexOf("SKU"),

    descripcion:
      headersModelo.indexOf(
        "DESCRIPCION"
      ),

    marca:
      headersModelo.indexOf(
        "MARCA"
      ),

    proveedor:
      headersModelo.indexOf(
        "PROVEEDOR"
      ),

    consumo12:
      headersModelo.indexOf(
        "CONSUMO_12M"
      ),

    promedio:
      headersModelo.indexOf(
        "PROMEDIO_MENSUAL"
      ),

    consumo3:
      headersModelo.indexOf(
        "CONSUMO_3M"
      ),

    warnes:
      headersModelo.indexOf(
        "STOCK_WARNES"
      ),

    escobar:
      headersModelo.indexOf(
        "STOCK_ESCOBAR"
      ),

    total:
      headersModelo.indexOf(
        "STOCK_TOTAL"
      ),

    pendiente:
      headersModelo.indexOf(
        "PENDIENTE_TOTAL"
      ),

    embarcado:
      headersModelo.indexOf(
        "EMBARCADO"
      ),

    fabrica:
      headersModelo.indexOf(
        "EN_FABRICA"
      ),

    objetivo:
      headersModelo.indexOf(
        "COBERTURA_OBJETIVO"
      ),

    actual:
      headersModelo.indexOf(
        "COBERTURA_ACTUAL"
      ),

    futura:
      headersModelo.indexOf(
        "COBERTURA_FUTURA"
      ),

    compra:
      headersModelo.indexOf(
        "COMPRA_SUGERIDA"
      ),

    riesgo:
      headersModelo.indexOf(
        "RIESGO"
      ),

    prioridad:
      headersModelo.indexOf(
        "PRIORIDAD"
      )
  };


  Object.keys(idx)
    .forEach(function(campo) {

      if (
        idx[campo] === -1
      ) {

        throw new Error(
          "MODELO_COMPRAS: falta columna " +
          campo
        );
      }

    });


  const datos =
    shModelo.getRange(
      FILA_HEADER + 1,
      1,
      ultimaFila - FILA_HEADER,
      ultimaCol
    ).getValues();


  // ==========================================================
  // 2. ESTRUCTURA PLAN V2
  // ==========================================================

  const encabezados = [

    "SKU",
    "DESCRIPCION",
    "MARCA",
    "PROVEEDOR",

    "CONSUMO_12M",
    "PROMEDIO_MENSUAL",
    "CONSUMO_3M",

    "STOCK_WARNES",
    "STOCK_ESCOBAR",
    "STOCK_TOTAL",

    "EN_FABRICA",
    "EMBARCADO",
    "PENDIENTE_TOTAL",

    "COBERTURA_ACTUAL",
    "COBERTURA_FUTURA",
    "COBERTURA_OBJETIVO",

    "COMPRA_SUGERIDA",

    "RIESGO",
    "PRIORIDAD",

    "ULTIMA_ACTUALIZACION"
  ];


  const ahora =
    new Date();


  const filas = [];


  const contadores = {

    sinStock: 0,
    urgente: 0,
    comprar: 0,
    revisar: 0,

    unidades: 0
  };


  // ==========================================================
  // 3. SELECCIONAR SKU QUE REQUIEREN COMPRA
  // ==========================================================

  datos.forEach(function(fila) {

    const sku =
      String(
        fila[idx.sku] || ""
      ).trim();

    if (!sku) {
      return;
    }


    const compra =
      numeroPlanB15_(
        fila[idx.compra]
      );


    /*
     * PLAN_COMPRAS_V2 es operativo:
     * solamente incorpora SKU cuya
     * compra sugerida sea mayor a cero.
     */

    if (compra <= 0) {
      return;
    }


    const riesgo =
      String(
        fila[idx.riesgo] || ""
      ).trim();


    const prioridad =
      numeroPlanB15_(
        fila[idx.prioridad]
      );


    filas.push([

      sku,

      fila[idx.descripcion] || "",

      fila[idx.marca] || "",

      fila[idx.proveedor] || "",


      numeroPlanB15_(
        fila[idx.consumo12]
      ),

      numeroPlanB15_(
        fila[idx.promedio]
      ),

      numeroPlanB15_(
        fila[idx.consumo3]
      ),


      numeroPlanB15_(
        fila[idx.warnes]
      ),

      numeroPlanB15_(
        fila[idx.escobar]
      ),

      numeroPlanB15_(
        fila[idx.total]
      ),


      numeroPlanB15_(
        fila[idx.fabrica]
      ),

      numeroPlanB15_(
        fila[idx.embarcado]
      ),

      numeroPlanB15_(
        fila[idx.pendiente]
      ),


      numeroPlanB15_(
        fila[idx.actual]
      ),

      numeroPlanB15_(
        fila[idx.futura]
      ),

      numeroPlanB15_(
        fila[idx.objetivo]
      ),


      compra,

      riesgo,

      prioridad,

      ahora
    ]);


    contadores.unidades +=
      compra;


    if (
      riesgo === "SIN STOCK"
    ) {

      contadores.sinStock++;

    } else if (
      riesgo === "URGENTE"
    ) {

      contadores.urgente++;

    } else if (
      riesgo === "COMPRAR"
    ) {

      contadores.comprar++;

    } else if (
      riesgo === "REVISAR"
    ) {

      contadores.revisar++;
    }

  });


  // ==========================================================
  // 4. ORDENAR
  //
  // PRIORIDAD DESC
  // COMPRA_SUGERIDA DESC
  // ==========================================================

  const COL_COMPRA =
    16;

  const COL_PRIORIDAD =
    18;


  filas.sort(
    function(a, b) {

      const prioridadA =
        Number(
          a[COL_PRIORIDAD] || 0
        );

      const prioridadB =
        Number(
          b[COL_PRIORIDAD] || 0
        );


      if (
        prioridadA !==
        prioridadB
      ) {

        return (
          prioridadB -
          prioridadA
        );
      }


      return (
        Number(
          b[COL_COMPRA] || 0
        ) -
        Number(
          a[COL_COMPRA] || 0
        )
      );
    }
  );


  // ==========================================================
  // 5. CREAR / PREPARAR HOJA
  // ==========================================================

  let sh =
    ss.getSheetByName(
      NOMBRE_SALIDA
    );


  if (!sh) {

    sh =
      ss.insertSheet(
        NOMBRE_SALIDA
      );

  }


  /*
   * PLAN_COMPRAS_V2 es una salida
   * regenerable.
   */

  sh.clear();

  sh.clearConditionalFormatRules();


  const filasNecesarias =
    filas.length + 1;


  if (
    sh.getMaxRows() <
    filasNecesarias
  ) {

    sh.insertRowsAfter(
      sh.getMaxRows(),
      filasNecesarias -
      sh.getMaxRows()
    );
  }


  if (
    sh.getMaxColumns() <
    encabezados.length
  ) {

    sh.insertColumnsAfter(
      sh.getMaxColumns(),
      encabezados.length -
      sh.getMaxColumns()
    );
  }


  // ==========================================================
  // 6. ESCRIBIR
  // ==========================================================

  sh.getRange(
    1,
    1,
    1,
    encabezados.length
  ).setValues(
    [encabezados]
  );


  if (
    filas.length > 0
  ) {

    sh.getRange(
      2,
      1,
      filas.length,
      encabezados.length
    ).setValues(
      filas
    );
  }


  // ==========================================================
  // 7. FORMATO
  // ==========================================================

  sh.setFrozenRows(1);

  sh.setHiddenGridlines(
    true
  );


  sh.getRange(
    1,
    1,
    1,
    encabezados.length
  )
    .setBackground(
      "#17365D"
    )
    .setFontColor(
      "#FFFFFF"
    )
    .setFontWeight(
      "bold"
    );


  if (
    filas.length > 0
  ) {

    /*
     * Consumos / stocks / importaciones
     */
    sh.getRange(
      2,
      5,
      filas.length,
      12
    ).setNumberFormat(
      "#,##0.00"
    );


    /*
     * Compra sugerida
     */
    sh.getRange(
      2,
      17,
      filas.length,
      1
    ).setNumberFormat(
      "#,##0"
    );


    /*
     * Prioridad
     */
    sh.getRange(
      2,
      19,
      filas.length,
      1
    ).setNumberFormat(
      "0"
    );


    /*
     * Fecha actualización
     */
    sh.getRange(
      2,
      20,
      filas.length,
      1
    ).setNumberFormat(
      "dd/MM/yyyy HH:mm"
    );
  }


  sh.autoResizeColumns(
    1,
    encabezados.length
  );


  /*
   * Limitar columnas de texto excesivas.
   */

  sh.setColumnWidth(
    1,
    160
  );

  sh.setColumnWidth(
    2,
    360
  );

  sh.setColumnWidth(
    3,
    90
  );

  sh.setColumnWidth(
    4,
    260
  );


  sh.setTabColor(
    "#38761D"
  );


  SpreadsheetApp.flush();


  // ==========================================================
  // 8. RESULTADO
  // ==========================================================

  const resultado = {

    version:
      "0.1.500",

    hoja:
      NOMBRE_SALIDA,

    skuPlan:
      filas.length,

    sinStock:
      contadores.sinStock,

    urgente:
      contadores.urgente,

    comprar:
      contadores.comprar,

    revisar:
      contadores.revisar,

    unidadesSugeridas:
      contadores.unidades,

    duracionMs:
      Date.now() -
      inicio
  };


  Logger.log(
    JSON.stringify(
      resultado,
      null,
      2
    )
  );


  ss.toast(
    "PLAN_COMPRAS_V2 generado",
    "Sprint B.1.5",
    5
  );


  return resultado;
}


/**
 * Conversión numérica.
 */
function numeroPlanB15_(
  valor
) {

  if (
    typeof valor === "number"
  ) {

    return Number.isFinite(valor)
      ? valor
      : 0;
  }


  const texto =
    String(valor || "")
      .trim();


  if (!texto) {
    return 0;
  }


  const numero =
    Number(texto);


  return Number.isFinite(numero)
    ? numero
    : 0;
}