function diagnosticoSinStockDashboardB17() {

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName("MODELO_COMPRAS");

  if (!sh) {
    throw new Error("No existe la hoja MODELO_COMPRAS");
  }

  const FILA_HEADER = 2;

  const ultimaFila = sh.getLastRow();
  const ultimaCol = sh.getLastColumn();

  const headers = sh
    .getRange(
      FILA_HEADER,
      1,
      1,
      ultimaCol
    )
    .getDisplayValues()[0]
    .map(h =>
      String(h)
        .trim()
        .toUpperCase()
    );

  const idx = {};

  headers.forEach(
    (h, i) => {
      idx[h] = i;
    }
  );

  const cSku = idx["SKU"];
  const cMarca = idx["MARCA"];
  const cRiesgo = idx["RIESGO"];

  if (
    cSku === undefined ||
    cMarca === undefined ||
    cRiesgo === undefined
  ) {

    throw new Error(
      "No se encontraron SKU, MARCA o RIESGO en MODELO_COMPRAS"
    );
  }

  const datos = sh
    .getRange(
      FILA_HEADER + 1,
      1,
      ultimaFila - FILA_HEADER,
      ultimaCol
    )
    .getValues();

  const porMarca = {};

  let totalSinStock = 0;
  let sinMarca = 0;

  datos.forEach(fila => {

    const sku =
      String(
        fila[cSku] || ""
      ).trim();

    if (!sku) {
      return;
    }

    const riesgo =
      String(
        fila[cRiesgo] || ""
      )
        .trim()
        .toUpperCase();

    if (
      riesgo !== "SIN STOCK"
    ) {
      return;
    }

    totalSinStock++;

    let marca =
      String(
        fila[cMarca] || ""
      ).trim();

    if (!marca) {

      marca = "(SIN MARCA)";
      sinMarca++;
    }

    if (!porMarca[marca]) {
      porMarca[marca] = 0;
    }

    porMarca[marca]++;
  });

  const ranking =
    Object.keys(porMarca)
      .map(marca => ({
        marca: marca,
        cantidad: porMarca[marca]
      }))
      .sort(
        (a, b) =>
          b.cantidad -
          a.cantidad
      );

  const top20 =
    ranking.slice(0, 20);

  const sumaTop20 =
    top20.reduce(
      (acc, x) =>
        acc + x.cantidad,
      0
    );

  const resto =
    totalSinStock -
    sumaTop20;

  const porcentaje =
    totalSinStock > 0
      ? (
          sumaTop20 /
          totalSinStock *
          100
        )
      : 0;

  Logger.log(
    "======================================"
  );

  Logger.log(
    "DIAGNÓSTICO SIN STOCK DASHBOARD"
  );

  Logger.log(
    "======================================"
  );

  Logger.log(
    "Total SIN STOCK MODELO: " +
    totalSinStock
  );

  Logger.log(
    "Marcas con SIN STOCK: " +
    ranking.length
  );

  Logger.log(
    "SIN STOCK sin marca: " +
    sinMarca
  );

  Logger.log("");

  Logger.log(
    "===== TOP 20 MARCAS ====="
  );

  top20.forEach(
    (x, i) => {

      Logger.log(
        (i + 1) +
        ". " +
        x.marca +
        " | SIN STOCK=" +
        x.cantidad
      );
    }
  );

  Logger.log("");

  Logger.log(
    "===== CONTROL ====="
  );

  Logger.log(
    "Suma TOP 20: " +
    sumaTop20
  );

  Logger.log(
    "Resto de marcas: " +
    resto
  );

  Logger.log(
    "TOP 20 + RESTO: " +
    (
      sumaTop20 +
      resto
    )
  );

  Logger.log(
    "Cobertura TOP 20: " +
    porcentaje.toFixed(2) +
    "%"
  );

  Logger.log(
    "======================================"
  );
}