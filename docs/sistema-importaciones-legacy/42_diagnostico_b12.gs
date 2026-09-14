/******************************************************************
 * SII - MODELO DE COMPRAS
 * Sprint B.1.2
 * DIAGNÓSTICO DE FUENTES
 *
 * SOLO LECTURA.
 * No modifica ninguna hoja.
 ******************************************************************/

function diagnosticoSprintB12() {

  const ss = SpreadsheetApp.getActiveSpreadsheet();

  const hojas = [
    "STOCK",
    "VENTAS",
    "ORDENES",
    "DETALLE_IMPORTACIONES",
    "RECEPCIONES",
    "MODELO_COMPRAS",
    "MAPA_SKU"
  ];

  Logger.log("==========================================");
  Logger.log("SII - DIAGNÓSTICO SPRINT B.1.2");
  Logger.log("==========================================");

  hojas.forEach(function(nombreHoja) {

    diagnosticarHojaB12_(ss, nombreHoja);

  });

  Logger.log("==========================================");
  Logger.log("FIN DIAGNÓSTICO B.1.2");
  Logger.log("==========================================");
}


function diagnosticarHojaB12_(ss, nombreHoja) {

  Logger.log("");
  Logger.log("------------------------------------------");
  Logger.log("HOJA: " + nombreHoja);
  Logger.log("------------------------------------------");

  const sh = ss.getSheetByName(nombreHoja);

  if (!sh) {

    Logger.log("ESTADO: NO EXISTE");

    return;
  }

  const ultimaFila = sh.getLastRow();
  const ultimaColumna = sh.getLastColumn();

  Logger.log("ESTADO: EXISTE");
  Logger.log("FILAS: " + ultimaFila);
  Logger.log("COLUMNAS: " + ultimaColumna);

  if (
    ultimaFila < 1 ||
    ultimaColumna < 1
  ) {

    Logger.log("HOJA VACÍA");

    return;
  }

  /*
   * Leemos solamente una muestra.
   * Evitamos cargar hojas completas de decenas
   * de miles de registros.
   */
  const filasMuestra =
    Math.min(ultimaFila, 6);

  const datos = sh.getRange(
    1,
    1,
    filasMuestra,
    ultimaColumna
  ).getDisplayValues();

  Logger.log(
    "ENCABEZADOS:"
  );

  datos[0].forEach(
    function(valor, indice) {

      Logger.log(
        "  C" +
        (indice + 1) +
        " = [" +
        valor +
        "]"
      );

    }
  );

  /*
   * Muestra las primeras cinco filas
   * para entender la estructura real.
   */
  if (datos.length > 1) {

    Logger.log("MUESTRA:");

    for (
      let fila = 1;
      fila < datos.length;
      fila++
    ) {

      const valores = datos[fila]
        .map(function(valor, indice) {

          return (
            "C" +
            (indice + 1) +
            "=[" +
            valor +
            "]"
          );

        })
        .join(" | ");

      Logger.log(
        "FILA " +
        (fila + 1) +
        " | " +
        valores
      );
    }
  }

  /*
   * Busca columnas potencialmente importantes.
   */
  const encabezadosNormalizados =
    datos[0].map(
      normalizarEncabezadoDiagnosticoB12_
    );

  const palabrasClave = [
    "SKU",
    "CODIGO",
    "PRODUCTO",
    "MARCA",
    "DEPOSITO",
    "STOCK",
    "CANTIDAD",
    "FECHA",
    "ESTADO",
    "PENDIENTE",
    "RECIBIR",
    "EMBARCADO",
    "FABRICA",
    "VENTA",
    "CONSUMO"
  ];

  const candidatos = [];

  encabezadosNormalizados.forEach(
    function(encabezado, indice) {

      const coincide =
        palabrasClave.some(
          function(palabra) {

            return encabezado.indexOf(
              palabra
            ) !== -1;

          }
        );

      if (coincide) {

        candidatos.push(
          "C" +
          (indice + 1) +
          "=" +
          datos[0][indice]
        );

      }
    }
  );

  Logger.log(
    "COLUMNAS CANDIDATAS: " +
    (
      candidatos.length
        ? candidatos.join(" | ")
        : "NINGUNA"
    )
  );
}


function normalizarEncabezadoDiagnosticoB12_(valor) {

  return String(valor || "")
    .trim()
    .toUpperCase()
    .normalize("NFD")
    .replace(
      /[\u0300-\u036f]/g,
      ""
    )
    .replace(
      /[^A-Z0-9]/g,
      "_"
    )
    .replace(
      /_+/g,
      "_"
    );
}

function auditarStockModeloB16C() {

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

  const FILA_HEADER = 2;

  const ultimaFila =
    sh.getLastRow();

  const ultimaCol =
    sh.getLastColumn();

  const headers =
    sh.getRange(
      FILA_HEADER,
      1,
      1,
      ultimaCol
    )
      .getDisplayValues()[0]
      .map(
        normalizarEncabezadoDiagnosticoB12_
      );


  const iSku =
    headers.indexOf("SKU");

  const iWarnes =
    headers.indexOf(
      "STOCK_WARNES"
    );

  const iEscobar =
    headers.indexOf(
      "STOCK_ESCOBAR"
    );

  const iTotal =
    headers.indexOf(
      "STOCK_TOTAL"
    );


  if (
    iSku === -1 ||
    iWarnes === -1 ||
    iEscobar === -1 ||
    iTotal === -1
  ) {

    throw new Error(
      "MODELO_COMPRAS: faltan columnas de stock."
    );
  }


  const datos =
    sh.getRange(
      FILA_HEADER + 1,
      1,
      ultimaFila - FILA_HEADER,
      ultimaCol
    ).getValues();


  let totalWarnes = 0;
  let totalEscobar = 0;
  let totalCalculado = 0;
  let totalGuardado = 0;

  let diferencias = 0;
  let diferenciaNeta = 0;

  const ejemplos = [];


  datos.forEach(
    function(fila) {

      const sku =
        String(
          fila[iSku] || ""
        ).trim();

      if (!sku) {
        return;
      }


      const warnes =
        Number(
          fila[iWarnes]
        ) || 0;


      const escobar =
        Number(
          fila[iEscobar]
        ) || 0;


      const total =
        Number(
          fila[iTotal]
        ) || 0;


      const calculado =
        warnes +
        escobar;


      totalWarnes +=
        warnes;

      totalEscobar +=
        escobar;

      totalCalculado +=
        calculado;

      totalGuardado +=
        total;


      const diferencia =
        total -
        calculado;


      if (
        Math.abs(diferencia) >
        0.000001
      ) {

        diferencias++;

        diferenciaNeta +=
          diferencia;


        if (
          ejemplos.length < 30
        ) {

          ejemplos.push({
            sku: sku,
            warnes: warnes,
            escobar: escobar,
            calculado: calculado,
            total: total,
            diferencia: diferencia
          });

        }

      }

    }
  );


  Logger.log(
    "======================================"
  );

  Logger.log(
    "AUDITORÍA STOCK MODELO - B.1.6-C"
  );

  Logger.log(
    "======================================"
  );

  Logger.log(
    "TOTAL WARNES: " +
    totalWarnes
  );

  Logger.log(
    "TOTAL ESCOBAR: " +
    totalEscobar
  );

  Logger.log(
    "TOTAL CALCULADO W+E: " +
    totalCalculado
  );

  Logger.log(
    "TOTAL STOCK_TOTAL: " +
    totalGuardado
  );

  Logger.log(
    "DIFERENCIA TOTAL: " +
    (
      totalGuardado -
      totalCalculado
    )
  );

  Logger.log(
    "SKU CON DIFERENCIA: " +
    diferencias
  );

  Logger.log(
    "DIFERENCIA NETA SKU: " +
    diferenciaNeta
  );


  if (
    ejemplos.length > 0
  ) {

    Logger.log(
      "===== EJEMPLOS ====="
    );


    ejemplos.forEach(
      function(item, indice) {

        Logger.log(
          (indice + 1) +
          ". " +
          item.sku +
          " | W=" +
          item.warnes +
          " | E=" +
          item.escobar +
          " | W+E=" +
          item.calculado +
          " | TOTAL=" +
          item.total +
          " | DIF=" +
          item.diferencia
        );

      }
    );

  }


  Logger.log(
    "======================================"
  );
}

function diagnosticarDiscontinuosB17() {

  const ss =
    SpreadsheetApp.getActiveSpreadsheet();

  const shDis =
    ss.getSheetByName("DISCONTINUOS");

  const shModelo =
    ss.getSheetByName("MODELO_COMPRAS");

  if (!shDis) {
    throw new Error(
      "No existe la hoja DISCONTINUOS."
    );
  }

  if (!shModelo) {
    throw new Error(
      "No existe MODELO_COMPRAS."
    );
  }


  // ==========================================================
  // DISCONTINUOS
  // ==========================================================

  const datosDis =
    shDis.getDataRange()
      .getDisplayValues();

  const headersDis =
    datosDis[0].map(
      normalizarHeaderDiscontinuosB17_
    );


  const iCodigo =
    headersDis.indexOf(
      "CODIGO_UNICO"
    );

  const iMarca =
    headersDis.indexOf(
      "MARCA"
    );

  const iEstado =
    headersDis.indexOf(
      "ESTADO"
    );


  if (iCodigo === -1) {

    throw new Error(
      "DISCONTINUOS: no se encontró la columna Código Unico."
    );
  }


  const discontinuos =
    new Map();


  for (
    let i = 1;
    i < datosDis.length;
    i++
  ) {

    const sku =
      String(
        datosDis[i][iCodigo] || ""
      )
        .trim()
        .toUpperCase();


    if (!sku) {
      continue;
    }

    const estado =
      iEstado !== -1
        ? String(datosDis[i][iEstado] || "")
            .trim()
            .toUpperCase()
        : "";

    const esDiscontinuado =
      estado === "A DISCONTINUAR" ||
      estado === "DISCONTINUADOS";

    if (!esDiscontinuado) {
      continue;
    }

    discontinuos.set(
      sku,
      {
        marca:
          iMarca !== -1
            ? datosDis[i][iMarca]
            : "",

        estado: estado
      }
    );
  }


  // ==========================================================
  // MODELO_COMPRAS
  // ==========================================================

  const FILA_HEADER = 2;

  const ultimaFila =
    shModelo.getLastRow();

  const ultimaCol =
    shModelo.getLastColumn();


  const headersModelo =
    shModelo.getRange(
      FILA_HEADER,
      1,
      1,
      ultimaCol
    )
      .getDisplayValues()[0]
      .map(
        normalizarHeaderDiscontinuosB17_
      );


  const iSku =
    headersModelo.indexOf("SKU");

  const iCompra =
    headersModelo.indexOf(
      "COMPRA_SUGERIDA"
    );

  const iRiesgo =
    headersModelo.indexOf(
      "RIESGO"
    );


  if (iSku === -1) {

    throw new Error(
      "MODELO_COMPRAS: falta SKU."
    );
  }


  const datosModelo =
    shModelo.getRange(
      FILA_HEADER + 1,
      1,
      ultimaFila - FILA_HEADER,
      ultimaCol
    ).getValues();


  const skuModelo =
    new Map();


  datosModelo.forEach(
    function(fila) {

      const sku =
        String(
          fila[iSku] || ""
        )
          .trim()
          .toUpperCase();


      if (!sku) {
        return;
      }


      skuModelo.set(
        sku,
        {
          compra:
            iCompra !== -1
              ? Number(
                  fila[iCompra]
                ) || 0
              : 0,

          riesgo:
            iRiesgo !== -1
              ? String(
                  fila[iRiesgo] || ""
                )
              : ""
        }
      );

    }
  );


  // ==========================================================
  // AUDITORÍA
  // ==========================================================

  let encontrados = 0;

  let noEncontrados = 0;

  let conCompraSugerida = 0;

  let unidadesCompraEvitar = 0;

  const ejemplosNoEncontrados = [];

  const ejemplosConCompra = [];


  discontinuos.forEach(
    function(info, sku) {

      if (
        !skuModelo.has(sku)
      ) {

        noEncontrados++;


        if (
          ejemplosNoEncontrados.length <
          20
        ) {

          ejemplosNoEncontrados.push(
            sku
          );
        }


        return;
      }


      encontrados++;


      const dato =
        skuModelo.get(sku);


      if (
        dato.compra > 0
      ) {

        conCompraSugerida++;

        unidadesCompraEvitar +=
          dato.compra;


        if (
          ejemplosConCompra.length <
          20
        ) {

          ejemplosConCompra.push(
            sku +
            " | compra=" +
            dato.compra +
            " | riesgo=" +
            dato.riesgo
          );
        }
      }

    }
  );


  // ==========================================================
  // RESULTADO
  // ==========================================================

  Logger.log(
    "======================================"
  );

  Logger.log(
    "DIAGNÓSTICO DISCONTINUOS - B.1.7"
  );

  Logger.log(
    "======================================"
  );

  Logger.log(
    "SKU discontinuados únicos: " +
    discontinuos.size
  );

  Logger.log(
    "Encontrados en MODELO_COMPRAS: " +
    encontrados
  );

  Logger.log(
    "No encontrados: " +
    noEncontrados
  );

  Logger.log(
    "Discontinuados con compra sugerida: " +
    conCompraSugerida
  );

  Logger.log(
    "Unidades de compra sugerida a evitar: " +
    unidadesCompraEvitar
  );


  if (
    ejemplosConCompra.length > 0
  ) {

    Logger.log(
      "===== DISCONTINUADOS CON COMPRA ====="
    );


    ejemplosConCompra.forEach(
      function(valor, i) {

        Logger.log(
          (i + 1) +
          ". " +
          valor
        );

      }
    );
  }


  if (
    ejemplosNoEncontrados.length > 0
  ) {

    Logger.log(
      "===== NO ENCONTRADOS ====="
    );


    ejemplosNoEncontrados.forEach(
      function(valor, i) {

        Logger.log(
          (i + 1) +
          ". " +
          valor
        );

      }
    );
  }
}


function normalizarHeaderDiscontinuosB17_(
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

function diagnosticoGestionComprasB17C() {

  const ss = SpreadsheetApp.getActiveSpreadsheet();

  const hojas = [
    "GESTION_COMPRAS",
    "PLAN_COMPRAS_V2"
  ];

  Logger.log("======================================");
  Logger.log("B.1.7-C - DIAGNÓSTICO VISTA OPERATIVA");
  Logger.log("======================================");

  hojas.forEach(nombre => {

    const sh = ss.getSheetByName(nombre);

    Logger.log("");
    Logger.log("--------------------------------------");
    Logger.log("HOJA: " + nombre);
    Logger.log("--------------------------------------");

    if (!sh) {
      Logger.log("NO EXISTE");
      return;
    }

    const filas = sh.getLastRow();
    const columnas = sh.getLastColumn();

    Logger.log("Filas: " + filas);
    Logger.log("Columnas: " + columnas);

    if (filas === 0 || columnas === 0) {
      Logger.log("HOJA VACÍA");
      return;
    }

    const headers = sh
      .getRange(1, 1, 1, columnas)
      .getDisplayValues()[0];

    Logger.log("ENCABEZADOS:");

    headers.forEach((h, i) => {
      Logger.log(
        "C" + (i + 1) + " = [" + h + "]"
      );
    });

    // Muestra 3 registros para conocer los valores reales
    if (filas > 1) {

      const cantidadMuestra = Math.min(3, filas - 1);

      const muestra = sh
        .getRange(2, 1, cantidadMuestra, columnas)
        .getDisplayValues();

      Logger.log("MUESTRA:");

      muestra.forEach((fila, i) => {
        Logger.log(
          "Fila " + (i + 2) + ": " +
          JSON.stringify(fila)
        );
      });
    }
  });

  Logger.log("");
  Logger.log("======================================");
  Logger.log("FIN DIAGNÓSTICO B.1.7-C");
  Logger.log("======================================");
}