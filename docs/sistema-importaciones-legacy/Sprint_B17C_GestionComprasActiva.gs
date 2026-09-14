/**********************************************************************
 * SII - SPRINT B.1.7-C
 * VISTA OPERATIVA DE GESTIÓN DE COMPRAS
 *
 * Genera:
 *   GESTION_COMPRAS_ACTIVA
 *
 * Fuentes:
 *   PLAN_COMPRAS_V2
 *   GESTION_COMPRAS
 *
 * IMPORTANTE:
 * - La hoja generada es una VISTA.
 * - Las decisiones persistentes continúan en GESTION_COMPRAS.
 **********************************************************************/

function generarGestionComprasActivaB17C() {

  const VERSION = "0.1.720";

  const ss = SpreadsheetApp.getActiveSpreadsheet();

  const shPlan =
    ss.getSheetByName("PLAN_COMPRAS_V2");

  const shGestion =
    ss.getSheetByName("GESTION_COMPRAS");

  if (!shPlan) {
    throw new Error(
      "No existe la hoja PLAN_COMPRAS_V2"
    );
  }

  if (!shGestion) {
    throw new Error(
      "No existe la hoja GESTION_COMPRAS"
    );
  }

  const inicio = Date.now();

  Logger.log("B.1.7-C - Inicio");

  /************************************************************
   * LEER PLAN
   ************************************************************/

  const datosPlan =
    shPlan.getDataRange().getValues();

  const headersPlan =
    datosPlan.shift();

  const idxPlan = {};

  headersPlan.forEach(
    (h, i) => {
      idxPlan[
        String(h).trim().toUpperCase()
      ] = i;
    }
  );

  /************************************************************
   * LEER GESTIÓN
   ************************************************************/

  const datosGestion =
    shGestion.getDataRange().getValues();

  const headersGestion =
    datosGestion.shift();

  const idxGestion = {};

  headersGestion.forEach(
    (h, i) => {
      idxGestion[
        String(h).trim().toUpperCase()
      ] = i;
    }
  );

  /************************************************************
   * MAPA DE GESTIÓN POR SKU
   ************************************************************/

  const mapaGestion = new Map();

  datosGestion.forEach(f => {

    const sku =
      String(
        f[idxGestion["SKU"]] || ""
      ).trim();

    if (!sku) return;

    mapaGestion.set(
      sku,
      {
        estado:
          f[idxGestion["ESTADO_GESTION"]] || "",

        cantidad:
          f[idxGestion["CANTIDAD_DECIDIDA"]] || "",

        observacion:
          f[idxGestion["OBSERVACION"]] || "",

        responsable:
          f[idxGestion["RESPONSABLE"]] || "",

        fechaDecision:
          f[idxGestion["FECHA_DECISION"]] || "",

        activo:
          String(
            f[idxGestion["ACTIVO_EN_PLAN"]] || ""
          )
            .trim()
            .toUpperCase()
      }
    );

  });

  /************************************************************
   * ESTRUCTURA DE LA VISTA
   ************************************************************/

  const headersSalida = [

    "SKU",
    "DESCRIPCION",
    "MARCA",

    "RIESGO",
    "PRIORIDAD",

    "PROMEDIO_MENSUAL",

    "STOCK_WARNES",
    "STOCK_ESCOBAR",
    "STOCK_TOTAL",

    "PENDIENTE_TOTAL",

    "COBERTURA_ACTUAL",
    "COBERTURA_FUTURA",
    "COBERTURA_OBJETIVO",

    "COMPRA_SUGERIDA",

    "ESTADO_GESTION",
    "CANTIDAD_DECIDIDA",
    "RESPONSABLE",
    "OBSERVACION",
    "FECHA_DECISION"

  ];

  const salida = [];

  /************************************************************
   * CRUCE PLAN + GESTIÓN
   ************************************************************/

  datosPlan.forEach(f => {

    const sku =
      String(
        f[idxPlan["SKU"]] || ""
      ).trim();

    if (!sku) return;

    const gestion =
      mapaGestion.get(sku);

    /*
     * Sólo mostramos SKU que continúan
     * activos dentro del plan.
     */

    if (
      gestion &&
      gestion.activo !== "SI"
    ) {
      return;
    }

    salida.push([

      sku,

      f[idxPlan["DESCRIPCION"]] || "",

      f[idxPlan["MARCA"]] || "",

      f[idxPlan["RIESGO"]] || "",

      Number(
        f[idxPlan["PRIORIDAD"]]
      ) || 0,

      Number(
        f[idxPlan["PROMEDIO_MENSUAL"]]
      ) || 0,

      Number(
        f[idxPlan["STOCK_WARNES"]]
      ) || 0,

      Number(
        f[idxPlan["STOCK_ESCOBAR"]]
      ) || 0,

      Number(
        f[idxPlan["STOCK_TOTAL"]]
      ) || 0,

      Number(
        f[idxPlan["PENDIENTE_TOTAL"]]
      ) || 0,

      Number(
        f[idxPlan["COBERTURA_ACTUAL"]]
      ) || 0,

      Number(
        f[idxPlan["COBERTURA_FUTURA"]]
      ) || 0,

      Number(
        f[idxPlan["COBERTURA_OBJETIVO"]]
      ) || 0,

      Number(
        f[idxPlan["COMPRA_SUGERIDA"]]
      ) || 0,

      gestion
        ? gestion.estado
        : "PENDIENTE",

      gestion
        ? gestion.cantidad
        : "",

      gestion
        ? gestion.responsable
        : "",

      gestion
        ? gestion.observacion
        : "",

      gestion
        ? gestion.fechaDecision
        : ""

    ]);

  });

  /************************************************************
   * ORDEN
   *
   * 1. Prioridad descendente
   * 2. Compra sugerida descendente
   ************************************************************/

  salida.sort(
    (a, b) => {

      const prioridadA = Number(a[4]) || 0;
      const prioridadB = Number(b[4]) || 0;

      if (
        prioridadA !== prioridadB
      ) {
        return prioridadB - prioridadA;
      }

      const compraA = Number(a[13]) || 0;
      const compraB = Number(b[13]) || 0;

      return compraB - compraA;
    }
  );

  /************************************************************
   * CREAR / REGENERAR HOJA
   ************************************************************/

  let shSalida =
    ss.getSheetByName(
      "GESTION_COMPRAS_ACTIVA"
    );

  if (!shSalida) {

    shSalida =
      ss.insertSheet(
        "GESTION_COMPRAS_ACTIVA"
      );

  } else {

    shSalida.clear();

  }

  /************************************************************
   * ESCRITURA
   ************************************************************/

  shSalida
    .getRange(
      1,
      1,
      1,
      headersSalida.length
    )
    .setValues([
      headersSalida
    ]);

  if (salida.length > 0) {

    shSalida
      .getRange(
        2,
        1,
        salida.length,
        headersSalida.length
      )
      .setValues(
        salida
      );

  }

  /************************************************************
   * FORMATO
   ************************************************************/

  shSalida
    .getRange(
      1,
      1,
      1,
      headersSalida.length
    )
    .setFontWeight("bold")
    .setBackground("#1F4E78")
    .setFontColor("#FFFFFF")
    .setHorizontalAlignment("center");

  shSalida.setFrozenRows(1);

  if (salida.length > 0) {

    /*
     * Números
     */

    shSalida
      .getRange(
        2,
        6,
        salida.length,
        9
      )
      .setNumberFormat(
        '#,##0.00'
      );

    /*
     * Prioridad sin decimales
     */

    shSalida
      .getRange(
        2,
        5,
        salida.length,
        1
      )
      .setNumberFormat(
        '0'
      );

    /*
     * Compra sugerida sin decimales
     */

    shSalida
      .getRange(
        2,
        14,
        salida.length,
        1
      )
      .setNumberFormat(
        '#,##0'
      );

  }

  /*
   * Filtro
   */

  const filtroAnterior =
    shSalida.getFilter();

  if (filtroAnterior) {
    filtroAnterior.remove();
  }

  if (salida.length > 0) {

    shSalida
      .getRange(
        1,
        1,
        salida.length + 1,
        headersSalida.length
      )
      .createFilter();

  }

  /*
   * Ajustes visuales básicos
   */

  shSalida.setColumnWidth(1, 150);
  shSalida.setColumnWidth(2, 320);
  shSalida.setColumnWidth(3, 120);

  shSalida.setColumnWidth(15, 140);
  shSalida.setColumnWidth(16, 150);
  shSalida.setColumnWidth(17, 140);
  shSalida.setColumnWidth(18, 300);
  shSalida.setColumnWidth(19, 150);

  /************************************************************
   * ESTADÍSTICAS
   ************************************************************/

  let pendientes = 0;
  let conDecision = 0;
  let unidadesSugeridas = 0;

  salida.forEach(f => {

    const estado =
      String(f[14] || "")
        .trim()
        .toUpperCase();

    if (
      !estado ||
      estado === "PENDIENTE"
    ) {
      pendientes++;
    } else {
      conDecision++;
    }

    unidadesSugeridas +=
      Number(f[13]) || 0;

  });

  const resumen = {

    version: VERSION,

    hoja:
      "GESTION_COMPRAS_ACTIVA",

    skuVista:
      salida.length,

    pendientes:
      pendientes,

    conDecision:
      conDecision,

    unidadesSugeridas:
      unidadesSugeridas,

    duracionMs:
      Date.now() - inicio

  };

  Logger.log(
    JSON.stringify(
      resumen,
      null,
      2
    )
  );

  Logger.log(
    "B.1.7-C - Fin"
  );
} 