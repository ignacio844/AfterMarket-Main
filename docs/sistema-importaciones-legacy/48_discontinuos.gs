function aplicarDiscontinuadosModeloB17() {

  const ss =
    SpreadsheetApp.getActiveSpreadsheet();

  const shModelo =
    ss.getSheetByName("MODELO_COMPRAS");

  const shDis =
    ss.getSheetByName("DISCONTINUOS");

  if (!shModelo) {
    throw new Error("No existe MODELO_COMPRAS.");
  }

  if (!shDis) {
    throw new Error("No existe DISCONTINUOS.");
  }

  const FILA_HEADER = 2;

  // ==========================================================
  // 1. LEER DISCONTINUOS
  // ==========================================================

  const datosDis =
    shDis.getDataRange()
      .getDisplayValues();

  const headersDis =
    datosDis[0].map(
      normalizarHeaderB17_
    );

  const iCodigo =
    headersDis.indexOf("CODIGO_UNICO");

  const iEstado =
    headersDis.indexOf("ESTADO");

  if (iCodigo === -1 || iEstado === -1) {

    throw new Error(
      "DISCONTINUOS: faltan CODIGO_UNICO o ESTADO."
    );
  }

  const discontinuados =
    new Set();


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


    const estado =
      String(
        datosDis[i][iEstado] || ""
      )
        .trim()
        .toUpperCase();


    if (!sku) {
      continue;
    }


    if (
      estado === "A DISCONTINUAR" ||
      estado === "DISCONTINUADOS"
    ) {

      discontinuados.add(sku);
    }
  }


  Logger.log(
    "Discontinuados válidos: " +
    discontinuados.size
  );


  // ==========================================================
  // 2. LEER MODELO
  // ==========================================================

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
        normalizarHeaderB17_
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

  const iPrioridad =
    headersModelo.indexOf(
      "PRIORIDAD"
    );


  if (
    iSku === -1 ||
    iCompra === -1 ||
    iRiesgo === -1 ||
    iPrioridad === -1
  ) {

    throw new Error(
      "MODELO_COMPRAS: faltan columnas requeridas."
    );
  }


  const cantidadFilas =
    ultimaFila -
    FILA_HEADER;


  const datosModelo =
    shModelo.getRange(
      FILA_HEADER + 1,
      1,
      cantidadFilas,
      ultimaCol
    ).getValues();


  // ==========================================================
  // 3. APLICAR REGLA
  // ==========================================================

  let encontrados = 0;

  let conCompraAnterior = 0;

  let unidadesEliminadas = 0;


  datosModelo.forEach(
    function(fila) {

      const sku =
        String(
          fila[iSku] || ""
        )
          .trim()
          .toUpperCase();


      if (
        !sku ||
        !discontinuados.has(sku)
      ) {

        return;
      }


      encontrados++;


      const compraAnterior =
        Number(
          fila[iCompra]
        ) || 0;


      if (
        compraAnterior > 0
      ) {

        conCompraAnterior++;

        unidadesEliminadas +=
          compraAnterior;
      }


      fila[iCompra] = 0;

      fila[iRiesgo] =
        "DISCONTINUADO";

      fila[iPrioridad] = 0;

    }
  );


  // ==========================================================
  // 4. ESCRITURA
  // ==========================================================

  shModelo.getRange(
    FILA_HEADER + 1,
    1,
    cantidadFilas,
    ultimaCol
  ).setValues(
    datosModelo
  );


  SpreadsheetApp.flush();


  // ==========================================================
  // 5. RESULTADO
  // ==========================================================

  const resultado = {

    version:
      "0.1.700",

    discontinuados:
      discontinuados.size,

    encontradosModelo:
      encontrados,

    skuConCompraEliminada:
      conCompraAnterior,

    unidadesCompraEliminadas:
      unidadesEliminadas

  };


  Logger.log(
    JSON.stringify(
      resultado,
      null,
      2
    )
  );


  ss.toast(
    "Discontinuados aplicados al modelo",
    "Sprint B.1.7",
    5
  );


  return resultado;
}


function normalizarHeaderB17_(
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