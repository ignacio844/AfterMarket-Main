/**********************************************************************
 * SII - GESTIÓN DE COMPRAS
 * Sprint B.1.7-B
 * Versión 0.1.710
 *
 * Crea / sincroniza GESTION_COMPRAS desde PLAN_COMPRAS_V2.
 *
 * IMPORTANTE:
 * - No borra decisiones manuales.
 * - No borra históricos.
 * - Los SKU que dejan de estar en el plan quedan ACTIVO_EN_PLAN = NO.
 **********************************************************************/

function sincronizarGestionComprasB17B() {

  const inicio = Date.now();

  const ss =
    SpreadsheetApp.getActiveSpreadsheet();

  const shPlan =
    ss.getSheetByName(
      "PLAN_COMPRAS_V2"
    );

  if (!shPlan) {
    throw new Error(
      "No existe PLAN_COMPRAS_V2."
    );
  }


  const NOMBRE_GESTION =
    "GESTION_COMPRAS";


  const headersGestion = [

    "SKU",

    "ESTADO_GESTION",

    "CANTIDAD_DECIDIDA",

    "OBSERVACION",

    "RESPONSABLE",

    "FECHA_DECISION",

    "RIESGO_ACTUAL",

    "COMPRA_SUGERIDA_ACTUAL",

    "ACTIVO_EN_PLAN",

    "ULTIMA_ACTUALIZACION"

  ];


  // ==========================================================
  // 1. LEER PLAN ACTUAL
  // ==========================================================

  const datosPlan =
    shPlan.getDataRange()
      .getValues();


  if (datosPlan.length < 2) {
    throw new Error(
      "PLAN_COMPRAS_V2 no contiene registros."
    );
  }


  const hPlan =
    datosPlan[0].map(
      normalizarHeaderGestionB17_
    );


  const iSkuPlan =
    hPlan.indexOf("SKU");

  const iRiesgoPlan =
    hPlan.indexOf("RIESGO");

  const iCompraPlan =
    hPlan.indexOf(
      "COMPRA_SUGERIDA"
    );


  if (
    iSkuPlan === -1 ||
    iRiesgoPlan === -1 ||
    iCompraPlan === -1
  ) {

    throw new Error(
      "PLAN_COMPRAS_V2: faltan SKU, RIESGO o COMPRA_SUGERIDA."
    );
  }


  const planActual =
    new Map();


  for (
    let i = 1;
    i < datosPlan.length;
    i++
  ) {

    const sku =
      String(
        datosPlan[i][iSkuPlan] || ""
      )
        .trim()
        .toUpperCase();


    if (!sku) {
      continue;
    }


    planActual.set(
      sku,
      {

        riesgo:
          String(
            datosPlan[i][iRiesgoPlan] || ""
          ).trim(),

        compra:
          Number(
            datosPlan[i][iCompraPlan]
          ) || 0

      }
    );
  }


  // ==========================================================
  // 2. CREAR / LEER GESTION_COMPRAS
  // ==========================================================

  let shGestion =
    ss.getSheetByName(
      NOMBRE_GESTION
    );


  if (!shGestion) {

    shGestion =
      ss.insertSheet(
        NOMBRE_GESTION
      );


    shGestion.getRange(
      1,
      1,
      1,
      headersGestion.length
    ).setValues(
      [headersGestion]
    );
  }


  /*
   * Si la hoja existe pero está vacía,
   * recreamos encabezados.
   */
  if (
    shGestion.getLastRow() < 1
  ) {

    shGestion.getRange(
      1,
      1,
      1,
      headersGestion.length
    ).setValues(
      [headersGestion]
    );
  }


  const datosGestion =
    shGestion.getDataRange()
      .getValues();


  const hGestion =
    datosGestion[0].map(
      normalizarHeaderGestionB17_
    );


  const idx = {};

  headersGestion.forEach(
    function(header) {

      const normalizado =
        normalizarHeaderGestionB17_(
          header
        );

      idx[normalizado] =
        hGestion.indexOf(
          normalizado
        );

    }
  );


  const faltantes =
    Object.keys(idx)
      .filter(
        function(campo) {

          return (
            idx[campo] === -1
          );

        }
      );


  if (
    faltantes.length > 0
  ) {

    throw new Error(
      "GESTION_COMPRAS tiene una estructura incompatible.\n\n" +
      faltantes.join("\n")
    );
  }


  // ==========================================================
  // 3. MAPA DE GESTIONES EXISTENTES
  // ==========================================================

  const gestionPorSku =
    new Map();


  for (
    let i = 1;
    i < datosGestion.length;
    i++
  ) {

    const sku =
      String(
        datosGestion[i][
          idx.SKU
        ] || ""
      )
        .trim()
        .toUpperCase();


    if (!sku) {
      continue;
    }


    gestionPorSku.set(
      sku,
      i
    );
  }


  // ==========================================================
  // 4. MARCAR TODOS LOS EXISTENTES COMO FUERA DEL PLAN
  //
  // Después reactivamos los que siguen estando.
  // ==========================================================

  for (
    let i = 1;
    i < datosGestion.length;
    i++
  ) {

    if (
      String(
        datosGestion[i][
          idx.SKU
        ] || ""
      ).trim()
    ) {

      datosGestion[i][
        idx.ACTIVO_EN_PLAN
      ] = "NO";
    }
  }


  const ahora =
    new Date();


  let nuevos = 0;
  let actualizados = 0;


  // ==========================================================
  // 5. SINCRONIZAR PLAN ACTUAL
  // ==========================================================

  planActual.forEach(
    function(info, sku) {

      if (
        gestionPorSku.has(sku)
      ) {

        const posicion =
          gestionPorSku.get(sku);


        datosGestion[posicion][
          idx.RIESGO_ACTUAL
        ] =
          info.riesgo;


        datosGestion[posicion][
          idx.COMPRA_SUGERIDA_ACTUAL
        ] =
          info.compra;


        datosGestion[posicion][
          idx.ACTIVO_EN_PLAN
        ] =
          "SI";


        datosGestion[posicion][
          idx.ULTIMA_ACTUALIZACION
        ] =
          ahora;


        actualizados++;


      } else {

        /*
         * Nuevo SKU del plan.
         *
         * Arranca PENDIENTE.
         * CANTIDAD_DECIDIDA queda vacía:
         * no copiamos automáticamente
         * COMPRA_SUGERIDA porque una cosa
         * es recomendación y otra decisión.
         */

        datosGestion.push([

          sku,

          "PENDIENTE",

          "",

          "",

          "",

          "",

          info.riesgo,

          info.compra,

          "SI",

          ahora

        ]);


        nuevos++;
      }

    }
  );


  // ==========================================================
  // 6. ESCRITURA
  // ==========================================================

  /*
   * Conservamos todo el histórico.
   */

  shGestion.clearContents();


  shGestion.getRange(
    1,
    1,
    datosGestion.length,
    headersGestion.length
  ).setValues(
    datosGestion
  );


  // ==========================================================
  // 7. VALIDACIÓN DE ESTADO
  // ==========================================================

  const estadosPermitidos = [

    "PENDIENTE",

    "ANALIZAR",

    "COTIZAR",

    "APROBADO",

    "NO COMPRAR",

    "COMPRADO"

  ];


  if (
    datosGestion.length > 1
  ) {

    const reglaEstado =
      SpreadsheetApp
        .newDataValidation()
        .requireValueInList(
          estadosPermitidos,
          true
        )
        .setAllowInvalid(false)
        .build();


    shGestion.getRange(
      2,
      idx.ESTADO_GESTION + 1,
      datosGestion.length - 1,
      1
    ).setDataValidation(
      reglaEstado
    );


    shGestion.getRange(
      2,
      idx.CANTIDAD_DECIDIDA + 1,
      datosGestion.length - 1,
      1
    ).setNumberFormat(
      "#,##0"
    );


    shGestion.getRange(
      2,
      idx.COMPRA_SUGERIDA_ACTUAL + 1,
      datosGestion.length - 1,
      1
    ).setNumberFormat(
      "#,##0"
    );


    shGestion.getRange(
      2,
      idx.FECHA_DECISION + 1,
      datosGestion.length - 1,
      1
    ).setNumberFormat(
      "dd/MM/yyyy HH:mm"
    );


    shGestion.getRange(
      2,
      idx.ULTIMA_ACTUALIZACION + 1,
      datosGestion.length - 1,
      1
    ).setNumberFormat(
      "dd/MM/yyyy HH:mm"
    );
  }


  // ==========================================================
  // 8. FORMATO GENERAL
  // ==========================================================

  shGestion.setFrozenRows(1);

  shGestion.setHiddenGridlines(
    true
  );


  shGestion.getRange(
    1,
    1,
    1,
    headersGestion.length
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


  shGestion.autoResizeColumns(
    1,
    headersGestion.length
  );


  shGestion.setColumnWidth(
    1,
    170
  );


  shGestion.setColumnWidth(
    4,
    300
  );


  SpreadsheetApp.flush();


  // ==========================================================
  // 9. RESULTADO
  // ==========================================================

  let activos = 0;
  let historicos = 0;


  for (
    let i = 1;
    i < datosGestion.length;
    i++
  ) {

    if (
      datosGestion[i][
        idx.ACTIVO_EN_PLAN
      ] === "SI"
    ) {

      activos++;

    } else {

      historicos++;
    }
  }


  const resultado = {

    version:
      "0.1.710",

    planActual:
      planActual.size,

    nuevos:
      nuevos,

    actualizados:
      actualizados,

    activosEnPlan:
      activos,

    historicosFueraPlan:
      historicos,

    totalGestion:
      datosGestion.length - 1,

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
    "Gestión de compras sincronizada",
    "Sprint B.1.7",
    5
  );


  return resultado;
}


function normalizarHeaderGestionB17_(
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