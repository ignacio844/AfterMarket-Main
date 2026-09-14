/**********************************************************************
 * DASHBOARD V5
 * ORQUESTADOR PRINCIPAL - FASE 1
 *
 * Lee exclusivamente la hoja PLAN_COMPRAS.
 * Genera exclusivamente la hoja DASHBOARD_V5.
 *
 * No modifica:
 * - PLAN_COMPRAS
 * - Motor MRP
 * - Cálculos de stock
 * - Dashboard V4.5
 **********************************************************************/

const DASHBOARD_V5_SHEET = "DASHBOARD_V5";
//const PLAN_COMPRAS_SHEET = "PLAN_COMPRAS";
const PLAN_COMPRAS_SHEET = "MODELO_COMPRAS";
const FILA_HEADER_DASHBOARD_V5 = 2;


/**
 * ============================================================
 * FUNCIÓN PÚBLICA
 * ============================================================
 *
 * Ejecutar manualmente desde Apps Script:
 *
 * generarDashboardV5
 */
function generarDashboardV5() {

  const inicio = new Date();

  try {

    const ss = SpreadsheetApp.getActiveSpreadsheet();

    // Lee exclusivamente PLAN_COMPRAS
    const plan = obtenerDatosPlanComprasV5_(ss);

    // Obtiene o crea DASHBOARD_V5
    const dashboard = obtenerHojaDashboardV5_(ss);

    // Limpia solamente DASHBOARD_V5
    prepararDashboardV5_(dashboard);

    // =========================================================
    // CÁLCULOS
    // =========================================================

    const indicadores =
      DashboardKPIs.calcular(plan);

    const marcas =
      DashboardMarcas.calcular(plan);

    const riesgos =
      DashboardRiesgos.calcular(plan);

    // =========================================================
    // DIBUJO DEL DASHBOARD
    // =========================================================

    dibujarEncabezadoDashboardV5_(
      dashboard,
      plan,
      indicadores
    );


    dibujarEstadoFuentesDashboardV5_(
      dashboard,
      ss
    );

    DashboardKPIs.dibujar(
      dashboard,
      indicadores
    );

    DashboardMarcas.dibujar(
      dashboard,
      marcas
    );

    DashboardRiesgos.dibujar(
      dashboard,
      riesgos
    );

    DashboardEventos.reservarEspacio(
      dashboard
    );

    // =========================================================
    // FORMATO GENERAL
    // =========================================================

    aplicarFormatoGeneralDashboardV5_(
      dashboard
    );

    SpreadsheetApp.flush();

    const duracionSegundos =
      (new Date().getTime() - inicio.getTime()) / 1000;

    Logger.log(
      "Dashboard V5 generado correctamente en " +
      duracionSegundos.toFixed(2) +
      " segundos."
    );

    ss.toast(
      "Dashboard V5 actualizado correctamente",
      "Plan de Compras",
      5
    );

    } catch (error) {

      Logger.log(error);

      SpreadsheetApp.getActiveSpreadsheet().toast(
        error.message,
        "Dashboard V5",
        10
      );

      throw error;

}
}


/**
 * ============================================================
 * LECTURA DE PLAN_COMPRAS
 * ============================================================
 */
function obtenerDatosPlanComprasV5_(ss) {

  const sh =
    ss.getSheetByName(
      PLAN_COMPRAS_SHEET
    );

  if (!sh) {
    throw new Error(
      'No existe la hoja "' +
      PLAN_COMPRAS_SHEET +
      '".'
    );
  }

  const ultimaFila =
    sh.getLastRow();

  const ultimaColumna =
    sh.getLastColumn();

  if (
    ultimaFila <=
    FILA_HEADER_DASHBOARD_V5
  ) {
    throw new Error(
      'La hoja "' +
      PLAN_COMPRAS_SHEET +
      '" no contiene registros.'
    );
  }

  const headers =
    sh.getRange(
      FILA_HEADER_DASHBOARD_V5,
      1,
      1,
      ultimaColumna
    )
      .getDisplayValues()[0]
      .map(
        normalizarEncabezadoV5_
      );

  validarEncabezadosPlanComprasV5_(
    headers
  );

  const rows =
    sh.getRange(
      FILA_HEADER_DASHBOARD_V5 + 1,
      1,
      ultimaFila -
        FILA_HEADER_DASHBOARD_V5,
      ultimaColumna
    )
      .getValues()
      .filter(function(fila) {

        return fila.some(
          function(valor) {
            return (
              valor !== "" &&
              valor !== null
            );
          }
        );

      });

  return {

    hoja: sh,

    headers: headers,

    rows: rows,

    cantidadRegistros:
      rows.length,

    ultimaFila:
      ultimaFila,

    ultimaColumna:
      ultimaColumna

  };
}


/**
 * Normaliza encabezados.
 *
 * Ejemplos:
 *
 * "Estado compra"  → ESTADO_COMPRA
 * "DESCRIPCIÓN"    → DESCRIPCION
 * " Stock Total "  → STOCK_TOTAL
 */
function normalizarEncabezadoV5_(valor) {

  return String(valor || "")
    .trim()
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "_")
    .replace(/[^A-Z0-9_]/g, "");
}


/**
 * Verifica las columnas imprescindibles para los KPI.
 */
function validarEncabezadosPlanComprasV5_(
  headers
) {

  const columnasObligatorias = [

    "SKU",
    "MARCA",

    "STOCK_TOTAL",
    "PENDIENTE_TOTAL",

    "PROMEDIO_MENSUAL",

    "COBERTURA_OBJETIVO",
    "COBERTURA_ACTUAL",
    "COBERTURA_FUTURA",

    "COMPRA_SUGERIDA",

    "RIESGO",
    "PRIORIDAD"

  ];

  const faltantes =
    columnasObligatorias.filter(
      function(columna) {

        return (
          headers.indexOf(
            columna
          ) === -1
        );

      }
    );

  if (
    faltantes.length > 0
  ) {

    throw new Error(
      "Faltan columnas requeridas en " +
      PLAN_COMPRAS_SHEET +
      ":\n\n" +
      faltantes.join("\n")
    );
  }
}


/**
 * ============================================================
 * CREACIÓN DE LA HOJA
 * ============================================================
 */
function obtenerHojaDashboardV5_(ss) {

  let sh = ss.getSheetByName(DASHBOARD_V5_SHEET);

  if (!sh) {

    sh = ss.insertSheet(DASHBOARD_V5_SHEET);

  }

  return sh;
}


/**
 * Limpia únicamente DASHBOARD_V5.
 */
function prepararDashboardV5_(sh) {

  sh.getCharts().forEach(function(grafico) {

    sh.removeChart(grafico);

  });

  sh.clearConditionalFormatRules();

  const filasNecesarias = Math.max(
    sh.getMaxRows(),
    100
  );

  const columnasNecesarias = Math.max(
    sh.getMaxColumns(),
    20
  );

  const rango = sh.getRange(
    1,
    1,
    filasNecesarias,
    columnasNecesarias
  );

  rango.breakApart();
  rango.clear();
  rango.clearFormat();

  sh.setHiddenGridlines(true);

  sh.setFrozenRows(2);

  sh.setTabColor("#0B5394");
}


/**
 * ============================================================
 * ENCABEZADO
 * ============================================================
 *
 * El módulo DashboardKPIs comienza sus tarjetas en la fila 4.
 */
function dibujarEncabezadoDashboardV5_(
  sh,
  plan,
  indicadores
) {

  const fecha = Utilities.formatDate(
    new Date(),
    Session.getScriptTimeZone(),
    "dd/MM/yyyy HH:mm"
  );

  sh.getRange("A1:N1")
    .merge()
    .setValue(
      "SII - CENTRO DE CONTROL DE COMPRAS"
    )
    .setBackground("#17365D")
    .setFontColor("#FFFFFF")
    .setFontWeight("bold")
    .setFontSize(20)
    .setHorizontalAlignment("center");

  sh.getRange("A2:C2")
    .merge()
    .setValue("Actualizado: " + fecha)
    .setBackground("#D9EAD3");

  sh.getRange("D2:E2")
    .merge()
    .setValue("Estado: 🟢 OK")
    .setBackground("#D9EAD3");

  sh.getRange("F2:G2")
    .merge()
    .setValue("SKU: " + formatearNumeroDashboardV5_(plan.cantidadRegistros))
    .setBackground("#D9EAD3");

sh.getRange("H2:I2")
  .merge()
  .setValue(
    "Sin stock: " +
    formatearNumeroDashboardV5_(
      indicadores.sinStock
    )
  )
  .setBackground("#F4CCCC");


sh.getRange("J2:K2")
  .merge()
  .setValue(
    "OK: " +
    formatearNumeroDashboardV5_(
      indicadores.ok
    )
  )
  .setBackground("#D9EAD3");

sh.getRange("L2:M2")
  .merge()
  .setValue(
    "Sin consumo: " +
    formatearNumeroDashboardV5_(
      indicadores.sinConsumo
    )
  )
  .setBackground("#E7E6E6");


sh.getRange("N2:O2")
  .merge()
  .setValue(
    "Compra: " +
    formatearNumeroDashboardV5_(
      indicadores.compraSugerida
    )
  )
  .setBackground("#FFF2CC");

}


/**
 * ============================================================
 * FORMATO GENERAL
 * ============================================================
 */
function aplicarFormatoGeneralDashboardV5_(sh) {

  sh.setRowHeight(1, 38);
  sh.setRowHeight(2, 28);
  sh.setRowHeight(3, 30);

  for (let columna = 1; columna <= 18; columna++) {

    sh.setColumnWidth(
      columna,
      105
    );

  }

  sh.setColumnWidth(1, 150);
  sh.setColumnWidth(2, 120);
  sh.setColumnWidth(3, 120);
  sh.setColumnWidth(4, 120);
  sh.setColumnWidth(5, 120);
  sh.setColumnWidth(6, 135);
  sh.setColumnWidth(7, 135);
  sh.setColumnWidth(8, 120);
  sh.setColumnWidth(9, 120);
  sh.setColumnWidth(10, 120);
  sh.setColumnWidth(11, 120);
  sh.setColumnWidth(12, 120);

  const ultimaFila = Math.max(
    sh.getLastRow(),
    30
  );

  sh.getRange(
    1,
    1,
    ultimaFila,
    18
  )
    .setVerticalAlignment("middle")
    .setFontFamily("Arial");

  sh.activate();
}

/**
 * =============================================================
 * ESTADO DE ACTUALIZACIÓN DE FUENTES
 * =============================================================
 *
 * Muestra:
 * - Stock Warnes
 * - Stock Escobar
 * - Ventas
 * - Órdenes de Compra
 */
function dibujarEstadoFuentesDashboardV5_(
  sh,
  ss
) {
  const fuentes =
    obtenerEstadoFuentesDashboardV5_(ss);

  const bloques = [
    {
      rango: 'A3:D3',
      titulo: 'STOCK WARNES',
      dato: fuentes.stockWarnes
    },
    {
      rango: 'E3:H3',
      titulo: 'STOCK ESCOBAR',
      dato: fuentes.stockEscobar
    },
    {
      rango: 'I3:L3',
      titulo: 'VENTAS',
      dato: fuentes.ventas
    },
    {
      rango: 'M3:P3',
      titulo: 'ÓRDENES DE COMPRA',
      dato: fuentes.ordenes
    }
  ];

  bloques.forEach(function(bloque) {

    const estado =
      estadoAntiguedadFuenteDashboardV5_(
        bloque.dato.fecha
      );

    const textoFecha =
      bloque.dato.fecha
        ? formatearFechaFuenteDashboardV5_(
            bloque.dato.fecha
          )
        : 'SIN INFORMACIÓN';

    sh.getRange(bloque.rango)
      .merge()
      .setValue(
        estado.icono +
        ' ' +
        bloque.titulo +
        ' · ' +
        textoFecha
      )
      .setBackground(
        estado.color
      )
      .setFontColor(
        estado.fontColor
      )
      .setFontWeight('bold')
      .setFontSize(9)
      .setHorizontalAlignment('center')
      .setVerticalAlignment('middle')
      .setWrap(true);
  });

  sh.setRowHeight(3, 30);
}


/**
 * Obtiene las cuatro fechas desde las fuentes ya existentes.
 */
function obtenerEstadoFuentesDashboardV5_(ss) {

  // ==========================================================
  // STOCK WARNES / ESCOBAR
  // ==========================================================

  let stockWarnes = {
    fecha: null
  };

  let stockEscobar = {
    fecha: null
  };

  if (
    typeof asObtenerControlImportaciones_ ===
    'function'
  ) {

    const controles =
      asObtenerControlImportaciones_(ss);

    if (
      controles &&
      controles.WARNES
    ) {
      stockWarnes = {
        fecha:
          convertirFechaFuenteDashboardV5_(
            controles.WARNES.fecha
          ),
        archivo:
          controles.WARNES.archivo || '',
        registros:
          controles.WARNES.registros || ''
      };
    }

    if (
      controles &&
      controles.ESCOBAR
    ) {
      stockEscobar = {
        fecha:
          convertirFechaFuenteDashboardV5_(
            controles.ESCOBAR.fecha
          ),
        archivo:
          controles.ESCOBAR.archivo || '',
        registros:
          controles.ESCOBAR.registros || ''
      };
    }
  }


  // ==========================================================
  // VENTAS
  // ==========================================================

  let ventas = {
    fecha: null
  };

  const shVentas =
    ss.getSheetByName('VENTAS');

  if (
    shVentas &&
    typeof avObtenerUltimaImportacion_ ===
      'function'
  ) {

    const ultimaVentas =
      avObtenerUltimaImportacion_(
        shVentas
      );

    if (ultimaVentas) {
      ventas = {
        fecha:
          convertirFechaFuenteDashboardV5_(
            ultimaVentas.fecha
          ),
        archivo:
          ultimaVentas.archivo || '',
        registros:
          ultimaVentas.registros || ''
      };
    }
  }


  // ==========================================================
  // ÓRDENES DE COMPRA
  // ==========================================================

  const ordenes =
    obtenerUltimaImportacionOrdenesDashboardV5_V2_(
      ss
    );


  return {
    stockWarnes: stockWarnes,
    stockEscobar: stockEscobar,
    ventas: ventas,
    ordenes: ordenes
  };
}


/**
 * Convierte Date o texto dd/MM/yyyy HH:mm[:ss]
 * a objeto Date.
 */
function convertirFechaFuenteDashboardV5_(
  valor
) {
  if (
    !valor
  ) {
    return null;
  }

  if (
    valor instanceof Date &&
    !isNaN(valor.getTime())
  ) {
    return valor;
  }

  const texto =
    String(valor)
      .trim();

  const partes =
    texto.match(
      /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/
    );

  if (partes) {
    const fecha =
      new Date(
        Number(partes[3]),
        Number(partes[2]) - 1,
        Number(partes[1]),
        Number(partes[4] || 0),
        Number(partes[5] || 0),
        Number(partes[6] || 0)
      );

    return isNaN(
      fecha.getTime()
    )
      ? null
      : fecha;
  }

  const fecha =
    new Date(texto);

  return isNaN(
    fecha.getTime()
  )
    ? null
    : fecha;
}


/**
 * Semáforo según antigüedad.
 */
function estadoAntiguedadFuenteDashboardV5_(
  fecha
) {
  if (
    !fecha ||
    !(fecha instanceof Date) ||
    isNaN(fecha.getTime())
  ) {
    return {
      icono: '⚪',
      color: '#E7E6E6',
      fontColor: '#666666'
    };
  }

  const ahora =
    new Date();

  const horas =
    (
      ahora.getTime() -
      fecha.getTime()
    ) /
    3600000;

  if (horas <= 24) {
    return {
      icono: '🟢',
      color: '#D9EAD3',
      fontColor: '#274E13'
    };
  }

  if (horas <= 72) {
    return {
      icono: '🟡',
      color: '#FFF2CC',
      fontColor: '#7F6000'
    };
  }

  return {
    icono: '🔴',
    color: '#F4CCCC',
    fontColor: '#990000'
  };
}


/**
 * Fecha presentada en el Dashboard.
 */
function formatearFechaFuenteDashboardV5_(
  fecha
) {
  return Utilities.formatDate(
    fecha,
    Session.getScriptTimeZone(),
    'dd/MM/yyyy HH:mm'
  );
}

function formatearNumeroDashboardV5_(valor) {

  return Number(valor || 0)
    .toLocaleString("es-AR");

}

/**
 * Busca la última importación satisfactoria de ÓRDENES.
 * Soporta las dos estructuras históricas detectadas en LOG_IMPORTACIONES:
 *
 * Formato antiguo:
 * FECHA | TIPO | ARCHIVO | ... | RESULTADO
 *
 * Formato nuevo:
 * FECHA | USUARIO | TIPO | ARCHIVO | ESTADO | ...
 */
function obtenerUltimaImportacionOrdenesDashboardV5_V2_(ss) {

  const sh =
    ss.getSheetByName(
      'LOG_IMPORTACIONES'
    );

  if (
    !sh ||
    sh.getLastRow() < 2
  ) {
    return {
      fecha: null
    };
  }

  const datos =
    sh.getDataRange()
      .getValues();

  for (
    let i = datos.length - 1;
    i >= 1;
    i--
  ) {

    const fila = datos[i];

    const tipoCol2 =
      String(
        fila[1] || ''
      )
        .trim()
        .toUpperCase();

    const tipoCol3 =
      String(
        fila[2] || ''
      )
        .trim()
        .toUpperCase();

    // Formato nuevo de Órdenes:
    // FECHA | USUARIO | TIPO | ARCHIVO | ESTADO | ...
    if (
      tipoCol3 === 'ORDENES'
    ) {

      const estado =
        String(
          fila[4] || ''
        )
          .trim()
          .toUpperCase();

      if (
        estado === 'COMPLETADA' ||
        estado === 'OK'
      ) {

        return {
          fecha:
            fila[0] instanceof Date
              ? fila[0]
              : convertirFechaFuenteDashboardV5_(
                  fila[0]
                ),

          archivo:
            String(
              fila[3] || ''
            ).trim()
        };
      }
    }

    // Formato viejo:
    // FECHA | TIPO | ARCHIVO | ... | RESULTADO
    if (
      tipoCol2 === 'ORDENES'
    ) {

      const resultado =
        String(
          fila[5] || ''
        )
          .trim()
          .toUpperCase();

      if (
        resultado === 'COMPLETADA' ||
        resultado === 'OK'
      ) {

        return {
          fecha:
            fila[0] instanceof Date
              ? fila[0]
              : convertirFechaFuenteDashboardV5_(
                  fila[0]
                ),

          archivo:
            String(
              fila[2] || ''
            ).trim()
        };
      }
    }
  }

  return {
    fecha: null
  };
}
