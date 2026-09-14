/** Migrado a DETALLE_IMPORTACIONES / STATUS_LINEA - 2026-09-02 */
/******************************************************************
 * SII - MODELO DE COMPRAS
 * Sprint B.1.2-B
 * DIAGNÓSTICO DE IMPORTACIONES
 *
 * SOLO LECTURA
 ******************************************************************/

function diagnosticoImportacionesB12B() {

  const ss =
    SpreadsheetApp.getActiveSpreadsheet();

  const sh =
    ss.getSheetByName("DETALLE_IMPORTACIONES");

  if (!sh) {
    throw new Error(
      "No existe DETALLE_IMPORTACIONES."
    );
  }

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
      normalizarHeaderB12B_
    );

  const idx = {
    item:
      headers.indexOf("ITEM"),

    cantidad:
      headers.indexOf("CANTIDAD"),

    situacion:
      headers.indexOf("SITUACION"),

    status:
      headers.indexOf("STATUS_LINEA")
  };

  Object.keys(idx).forEach(
    function(campo) {

      if (idx[campo] === -1) {
        throw new Error(
          "DETALLE_IMPORTACIONES: falta columna " +
          campo
        );
      }
    }
  );

  const situaciones =
    new Map();

  const status =
    new Map();

  let filasValidas = 0;
  let cantidadTotal = 0;

  for (
    let i = 1;
    i < datos.length;
    i++
  ) {

    const fila =
      datos[i];

    const item =
      String(
        fila[idx.item] || ""
      ).trim();

    if (!item) {
      continue;
    }

    filasValidas++;

    const cantidad =
      numeroB12B_(
        fila[idx.cantidad]
      );

    cantidadTotal += cantidad;

    const situacion =
      normalizarTextoB12B_(
        fila[idx.situacion]
      ) || "(VACIO)";

    const estado =
      normalizarTextoB12B_(
        fila[idx.status]
      ) || "(VACIO)";

    sumarDiagnosticoB12B_(
      situaciones,
      situacion,
      cantidad
    );

    sumarDiagnosticoB12B_(
      status,
      estado,
      cantidad
    );
  }

  Logger.log(
    "======================================"
  );

  Logger.log(
    "B.1.2-B - DIAGNÓSTICO IMPORTACIONES"
  );

  Logger.log(
    "======================================"
  );

  Logger.log(
    "Filas DETALLE_IMPORTACIONES: " +
    (datos.length - 1)
  );

  Logger.log(
    "Filas con ITEM: " +
    filasValidas
  );

  Logger.log(
    "Cantidad total: " +
    cantidadTotal
  );


  Logger.log(
    "===== SITUACION ====="
  );

  Array.from(
    situaciones.entries()
  )
    .sort(function(a, b) {
      return b[1].filas - a[1].filas;
    })
    .forEach(function(par) {

      Logger.log(
        par[0] +
        " | filas=" +
        par[1].filas +
        " | cantidad=" +
        par[1].cantidad
      );
    });


  Logger.log(
    "===== STATUS ====="
  );

  Array.from(
    status.entries()
  )
    .sort(function(a, b) {
      return b[1].filas - a[1].filas;
    })
    .forEach(function(par) {

      Logger.log(
        par[0] +
        " | filas=" +
        par[1].filas +
        " | cantidad=" +
        par[1].cantidad
      );
    });
}


function sumarDiagnosticoB12B_(
  mapa,
  clave,
  cantidad
) {

  if (!mapa.has(clave)) {

    mapa.set(
      clave,
      {
        filas: 0,
        cantidad: 0
      }
    );
  }

  const dato =
    mapa.get(clave);

  dato.filas++;

  dato.cantidad += cantidad;
}


function normalizarHeaderB12B_(valor) {

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


function normalizarTextoB12B_(valor) {

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


function numeroB12B_(valor) {

  if (
    valor === null ||
    valor === undefined ||
    valor === ""
  ) {
    return 0;
  }

  /*
   * Si Sheets ya devuelve un número real,
   * no hacemos ninguna conversión.
   */
  if (typeof valor === "number") {

    return Number.isFinite(valor)
      ? valor
      : 0;
  }

  let texto =
    String(valor)
      .trim()
      .replace(/\s/g, "")
      .replace(/[^\d,.-]/g, "");

  if (!texto) {
    return 0;
  }

  const tieneComa =
    texto.includes(",");

  const tienePunto =
    texto.includes(".");

  /*
   * Si tiene ambos separadores,
   * el último determina el decimal.
   *
   * 1,234.56 -> 1234.56
   * 1.234,56 -> 1234.56
   */
  if (
    tieneComa &&
    tienePunto
  ) {

    const ultimaComa =
      texto.lastIndexOf(",");

    const ultimoPunto =
      texto.lastIndexOf(".");

    if (
      ultimoPunto >
      ultimaComa
    ) {

      // Formato inglés: 1,234.56

      texto =
        texto.replace(
          /,/g,
          ""
        );

    } else {

      // Formato español: 1.234,56

      texto =
        texto
          .replace(/\./g, "")
          .replace(",", ".");
    }

  } else if (tieneComa) {

    /*
     * Si sólo tiene coma:
     *
     * 1234,56 -> decimal
     *
     * Para nuestro origen actual
     * éste es el comportamiento esperado.
     */

    texto =
      texto.replace(",", ".");
  }

  const numero =
    Number(texto);

  return Number.isFinite(numero)
    ? numero
    : 0;
}

function auditarCruceItemsImportacionesB12B() {

  const ss =
    SpreadsheetApp.getActiveSpreadsheet();

  const shDetalle =
    ss.getSheetByName("DETALLE_IMPORTACIONES");

  const shMapa =
    ss.getSheetByName("MAPA_SKU");

  if (!shDetalle || !shMapa) {
    throw new Error(
      "Falta DETALLE_IMPORTACIONES o MAPA_SKU."
    );
  }

  const mapa =
    construirMapaEquivalenciasB12A_(
      shMapa
    );

  const datos =
    shDetalle.getDataRange()
      .getValues();

  const headers =
    datos[0].map(
      normalizarHeaderB12B_
    );

  const idxItem =
    headers.indexOf("ITEM");

  const idxCantidad =
    headers.indexOf("CANTIDAD");

  if (
    idxItem === -1 ||
    idxCantidad === -1
  ) {
    throw new Error(
      "DETALLE_IMPORTACIONES no contiene ITEM/CANTIDAD."
    );
  }

  let filas = 0;
  let cruzadas = 0;
  let sinCruce = 0;

  let cantidadTotal = 0;
  let cantidadCruzada = 0;
  let cantidadSinCruce = 0;

  const ejemplosSinCruce = [];

  for (
    let i = 1;
    i < datos.length;
    i++
  ) {

    const fila = datos[i];

    const item =
      String(
        fila[idxItem] || ""
      )
        .trim()
        .toUpperCase();

    if (!item) {
      continue;
    }

    const cantidad =
      numeroB12B_(
        fila[idxCantidad]
      );

    filas++;
    cantidadTotal += cantidad;

    const sku =
      mapa.get(item);

    if (sku) {

      cruzadas++;
      cantidadCruzada += cantidad;

    } else {

      sinCruce++;
      cantidadSinCruce += cantidad;

      if (
        ejemplosSinCruce.length < 30
      ) {
        ejemplosSinCruce.push(
          item
        );
      }
    }
  }

  Logger.log(
    "===== CRUCE ITEM → SKU ====="
  );

  Logger.log(
    "Filas totales: " + filas
  );

  Logger.log(
    "Filas cruzadas: " + cruzadas
  );

  Logger.log(
    "Filas sin cruce: " + sinCruce
  );

  Logger.log(
    "Cantidad total: " +
    cantidadTotal
  );

  Logger.log(
    "Cantidad cruzada: " +
    cantidadCruzada
  );

  Logger.log(
    "Cantidad sin cruce: " +
    cantidadSinCruce
  );

  Logger.log(
    "===== EJEMPLOS SIN CRUCE ====="
  );

  ejemplosSinCruce.forEach(
    function(item, indice) {

      Logger.log(
        (indice + 1) +
        ". " +
        item
      );

    }
  );
}

function auditarCruceFlexibleItemsB12B() {

  const ss =
    SpreadsheetApp.getActiveSpreadsheet();

  const shDetalle =
    ss.getSheetByName("DETALLE_IMPORTACIONES");

  const shMapa =
    ss.getSheetByName("MAPA_SKU");

  if (!shDetalle || !shMapa) {
    throw new Error(
      "Falta DETALLE_IMPORTACIONES o MAPA_SKU."
    );
  }

  const datosMapa =
    shMapa.getDataRange()
      .getDisplayValues();

  const headersMapa =
    datosMapa[0].map(
      normalizarHeaderB12B_
    );

  const columnasMapa = [
    "CODIGO_NUEVO",
    "CODIGO_VIEJO",
    "BASE_OCTOSIS",
    "BASE_SISFACTURA",
    "BASE_MELIKOBO",
    "BASE_TORETTOS",
    "BASE_WARNES"
  ];

  const indicesMapa =
    columnasMapa.map(function(nombre) {
      return headersMapa.indexOf(nombre);
    });

  const idxNuevo =
    headersMapa.indexOf("CODIGO_NUEVO");

  if (idxNuevo === -1) {
    throw new Error(
      "MAPA_SKU no contiene CODIGO_NUEVO."
    );
  }

  const mapaExacto = new Map();
  const mapaFlexible = new Map();

  for (
    let i = 1;
    i < datosMapa.length;
    i++
  ) {

    const fila = datosMapa[i];

    const sku =
      String(
        fila[idxNuevo] || ""
      ).trim();

    if (!sku) {
      continue;
    }

    indicesMapa.forEach(function(idx) {

      if (idx === -1) {
        return;
      }

      const codigo =
        String(
          fila[idx] || ""
        ).trim();

      if (!codigo) {
        return;
      }

      const exacto =
        codigo.toUpperCase();

      const flexible =
        normalizarCodigoFlexibleB12B_(
          codigo
        );

      if (
        exacto &&
        !mapaExacto.has(exacto)
      ) {
        mapaExacto.set(
          exacto,
          sku
        );
      }

      if (
        flexible &&
        !mapaFlexible.has(flexible)
      ) {
        mapaFlexible.set(
          flexible,
          sku
        );
      }
    });
  }


  const datos =
    shDetalle.getDataRange()
      .getValues();

  const headersDetalle =
    datosDetalle[0].map(
      normalizarHeaderB12B_
    );

  const idxItem =
    headersDetalle.indexOf("ITEM");

  const idxCantidad =
    headersDetalle.indexOf("CANTIDAD");

  let total = 0;
  let exactos = 0;
  let flexibles = 0;
  let sinCruce = 0;

  let cantidadTotal = 0;
  let cantidadExacta = 0;
  let cantidadFlexible = 0;
  let cantidadSinCruce = 0;

  const ejemplosFlexibles = [];
  const ejemplosSinCruce = [];

  for (
    let i = 1;
    i < datosDetalle.length;
    i++
  ) {

    const fila =
      datosDetalle[i];

    const item =
      String(
        fila[idxItem] || ""
      ).trim();

    if (!item) {
      continue;
    }

    const cantidad =
      numeroB12B_(
        fila[idxCantidad]
      );

    total++;
    cantidadTotal += cantidad;

    const exacto =
      item.toUpperCase();

    const flexible =
      normalizarCodigoFlexibleB12B_(
        item
      );

    if (
      mapaExacto.has(exacto)
    ) {

      exactos++;
      cantidadExacta += cantidad;

      continue;
    }

    if (
      mapaFlexible.has(flexible)
    ) {

      flexibles++;
      cantidadFlexible += cantidad;

      if (
        ejemplosFlexibles.length < 30
      ) {
        ejemplosFlexibles.push(
          item +
          " -> " +
          mapaFlexible.get(
            flexible
          )
        );
      }

      continue;
    }

    sinCruce++;
    cantidadSinCruce += cantidad;

    if (
      ejemplosSinCruce.length < 30
    ) {
      ejemplosSinCruce.push(
        item
      );
    }
  }


  Logger.log(
    "===== CRUCE FLEXIBLE ====="
  );

  Logger.log(
    "Filas totales: " + total
  );

  Logger.log(
    "Cruce exacto: " + exactos
  );

  Logger.log(
    "Cruce flexible adicional: " +
    flexibles
  );

  Logger.log(
    "Sin cruce: " +
    sinCruce
  );

  Logger.log(
    "Cantidad total: " +
    cantidadTotal
  );

  Logger.log(
    "Cantidad cruce exacto: " +
    cantidadExacta
  );

  Logger.log(
    "Cantidad cruce flexible: " +
    cantidadFlexible
  );

  Logger.log(
    "Cantidad sin cruce: " +
    cantidadSinCruce
  );


  Logger.log(
    "===== EJEMPLOS CRUCE FLEXIBLE ====="
  );

  ejemplosFlexibles
    .forEach(function(valor, indice) {

      Logger.log(
        (indice + 1) +
        ". " +
        valor
      );

    });


  Logger.log(
    "===== EJEMPLOS SIN CRUCE ====="
  );

  ejemplosSinCruce
    .forEach(function(valor, indice) {

      Logger.log(
        (indice + 1) +
        ". " +
        valor
      );

    });
}


function normalizarCodigoFlexibleB12B_(
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
      /[^A-Z0-9]/g,
      ""
    );
}

function generarPendientesEquivalenciaB12B() {

  const ss =
    SpreadsheetApp.getActiveSpreadsheet();

  const shDetalle =
    ss.getSheetByName("DETALLE_IMPORTACIONES");

  const shMapa =
    ss.getSheetByName("MAPA_SKU");

  if (!shDetalle || !shMapa) {
    throw new Error(
      "Falta DETALLE_IMPORTACIONES o MAPA_SKU."
    );
  }

  const mapa =
    construirMapaEquivalenciasB12A_(
      shMapa
    );

  const datos =
    shDetalle.getDataRange()
      .getValues();

  const headers =
    datos[0].map(
      normalizarHeaderB12B_
    );

  const idx = {
    item:
      headers.indexOf("ITEM"),

    marca:
      headers.indexOf("MARCA"),

    cantidad:
      headers.indexOf("CANTIDAD"),

    status:
      headers.indexOf("STATUS_LINEA"),

    situacion:
      headers.indexOf("SITUACION")
  };

  Object.keys(idx).forEach(
    function(campo) {

      if (idx[campo] === -1) {
        throw new Error(
          "DETALLE_IMPORTACIONES: falta " +
          campo
        );
      }
    }
  );

  const pendientes =
    new Map();

  for (
    let i = 1;
    i < datos.length;
    i++
  ) {

    const fila =
      datos[i];

    const item =
      String(
        fila[idx.item] || ""
      ).trim();

    if (!item) {
      continue;
    }

    const clave =
      item.toUpperCase();

    if (
      mapa.has(clave)
    ) {
      continue;
    }

    const marca =
      String(
        fila[idx.marca] || ""
      ).trim();

    const status =
      String(
        fila[idx.status] || ""
      ).trim();

    const situacion =
      String(
        fila[idx.situacion] || ""
      ).trim();

    const cantidad =
      numeroB12B_(
        fila[idx.cantidad]
      );

    if (
      !pendientes.has(clave)
    ) {

      pendientes.set(
        clave,
        {
          item: item,
          marca: marca,
          lineas: 0,
          cantidad: 0,
          estados: new Set(),
          situaciones: new Set()
        }
      );
    }

    const p =
      pendientes.get(clave);

    p.lineas++;
    p.cantidad += cantidad;

    if (status) {
      p.estados.add(status);
    }

    if (situacion) {
      p.situaciones.add(situacion);
    }
  }


  let shOut =
    ss.getSheetByName(
      "PENDIENTES_EQUIVALENCIA_IMPORT"
    );

  if (!shOut) {

    shOut =
      ss.insertSheet(
        "PENDIENTES_EQUIVALENCIA_IMPORT"
      );

  } else {

    shOut.clear();
  }


  const cabeceras = [
    "ITEM",
    "MARCA",
    "LINEAS",
    "CANTIDAD_TOTAL",
    "STATUS_LINEA",
    "SITUACIONES",
    "SKU_CANONICO"
  ];


  const filas =
    Array.from(
      pendientes.values()
    )
      .sort(function(a, b) {
        return (
          b.cantidad -
          a.cantidad
        );
      })
      .map(function(p) {

        return [
          p.item,
          p.marca,
          p.lineas,
          p.cantidad,
          Array.from(
            p.estados
          ).join(" | "),
          Array.from(
            p.situaciones
          ).join(" | "),
          ""
        ];
      });


  shOut.getRange(
    1,
    1,
    1,
    cabeceras.length
  ).setValues(
    [cabeceras]
  );


  if (filas.length > 0) {

    shOut.getRange(
      2,
      1,
      filas.length,
      cabeceras.length
    ).setValues(
      filas
    );
  }


  shOut.setFrozenRows(1);

  shOut.getRange(
    1,
    1,
    1,
    cabeceras.length
  )
    .setBackground("#1F4E78")
    .setFontColor("#FFFFFF")
    .setFontWeight("bold");


  if (filas.length > 0) {

    shOut.getRange(
      2,
      3,
      filas.length,
      2
    ).setNumberFormat(
      "#,##0.00"
    );
  }


  Logger.log(
    "ITEM sin equivalencia únicos: " +
    filas.length
  );

  Logger.log(
    "Hoja generada: " +
    shOut.getName()
  );

  return filas.length;
}

function diagnosticoProductosB12B() {

  const ss =
    SpreadsheetApp.getActiveSpreadsheet();

  const sh =
    ss.getSheetByName("PRODUCTOS");

  if (!sh) {
    throw new Error(
      'No existe la hoja "PRODUCTOS".'
    );
  }

  const ultimaFila =
    sh.getLastRow();

  const ultimaCol =
    sh.getLastColumn();

  Logger.log(
    "===== DIAGNÓSTICO PRODUCTOS ====="
  );

  Logger.log(
    "Filas totales: " +
    ultimaFila
  );

  Logger.log(
    "Columnas: " +
    ultimaCol
  );

  if (
    ultimaFila < 1 ||
    ultimaCol < 1
  ) {
    return;
  }

  const headers =
    sh.getRange(
      1,
      1,
      1,
      ultimaCol
    ).getDisplayValues()[0];

  Logger.log(
    "ENCABEZADOS:"
  );

  headers.forEach(
    function(valor, indice) {

      Logger.log(
        (indice + 1) +
        " | " +
        String(valor || "")
      );

    }
  );


  // ==========================================================
  // MOSTRAR ALGUNAS FILAS
  // ==========================================================

  const cantidadMuestra =
    Math.min(
      5,
      Math.max(
        ultimaFila - 1,
        0
      )
    );

  if (cantidadMuestra > 0) {

    const muestra =
      sh.getRange(
        2,
        1,
        cantidadMuestra,
        ultimaCol
      ).getDisplayValues();

    Logger.log(
      "===== MUESTRA ====="
    );

    muestra.forEach(
      function(fila, indice) {

        Logger.log(
          "Fila " +
          (indice + 2) +
          ": " +
          JSON.stringify(fila)
        );

      }
    );
  }
}

function diagnosticoPendientesPorMarcaB12B() {

  const ss =
    SpreadsheetApp.getActiveSpreadsheet();

  const sh =
    ss.getSheetByName(
      "PENDIENTES_EQUIVALENCIA_IMPORT"
    );

  if (!sh) {
    throw new Error(
      "No existe PENDIENTES_EQUIVALENCIA_IMPORT."
    );
  }

  const datos =
    sh.getDataRange()
      .getValues();

  if (datos.length < 2) {
    throw new Error(
      "No hay pendientes de equivalencia."
    );
  }

  const headers =
    datos[0].map(
      normalizarHeaderB12B_
    );

  const idx = {
    item:
      headers.indexOf("ITEM"),

    marca:
      headers.indexOf("MARCA"),

    lineas:
      headers.indexOf("LINEAS"),

    cantidad:
      headers.indexOf("CANTIDAD_TOTAL")
  };

  Object.keys(idx).forEach(
    function(campo) {

      if (idx[campo] === -1) {
        throw new Error(
          "Falta columna " +
          campo +
          " en PENDIENTES_EQUIVALENCIA_IMPORT."
        );
      }
    }
  );


  const marcas =
    new Map();

  let totalItems = 0;
  let totalLineas = 0;
  let totalCantidad = 0;


  for (
    let i = 1;
    i < datos.length;
    i++
  ) {

    const fila =
      datos[i];

    const item =
      String(
        fila[idx.item] || ""
      ).trim();

    if (!item) {
      continue;
    }

    const marca =
      String(
        fila[idx.marca] || ""
      ).trim() || "(SIN MARCA)";

    const lineas =
      numeroB12B_(
        fila[idx.lineas]
      );

    const cantidad =
      numeroB12B_(
        fila[idx.cantidad]
      );


    if (!marcas.has(marca)) {

      marcas.set(
        marca,
        {
          items: 0,
          lineas: 0,
          cantidad: 0,
          ejemplos: []
        }
      );
    }


    const dato =
      marcas.get(marca);

    dato.items++;
    dato.lineas += lineas;
    dato.cantidad += cantidad;


    if (
      dato.ejemplos.length < 10
    ) {

      dato.ejemplos.push(
        item
      );
    }


    totalItems++;
    totalLineas += lineas;
    totalCantidad += cantidad;
  }


  const ranking =
    Array.from(
      marcas.entries()
    )
      .sort(function(a, b) {

        return (
          b[1].cantidad -
          a[1].cantidad
        );

      });


  Logger.log(
    "======================================"
  );

  Logger.log(
    "PENDIENTES DE EQUIVALENCIA POR MARCA"
  );

  Logger.log(
    "======================================"
  );

  Logger.log(
    "ITEM únicos pendientes: " +
    totalItems
  );

  Logger.log(
    "Líneas afectadas: " +
    totalLineas
  );

  Logger.log(
    "Cantidad pendiente: " +
    totalCantidad
  );

  Logger.log(
    "Marcas afectadas: " +
    ranking.length
  );


  ranking.forEach(
    function(par) {

      const marca =
        par[0];

      const dato =
        par[1];

      Logger.log(
        "--------------------------------------"
      );

      Logger.log(
        "MARCA: " +
        marca +
        " | ITEM=" +
        dato.items +
        " | líneas=" +
        dato.lineas +
        " | cantidad=" +
        dato.cantidad
      );

      Logger.log(
        "Ejemplos: " +
        dato.ejemplos.join(
          " | "
        )
      );

    }
  );
}

function auditarDiferenciaPendientesB12B() {

  const ss =
    SpreadsheetApp.getActiveSpreadsheet();

  const shDetalle =
    ss.getSheetByName("DETALLE_IMPORTACIONES");

  const shMapa =
    ss.getSheetByName("MAPA_SKU");

  if (!shDetalle || !shMapa) {
    throw new Error(
      "Falta DETALLE_IMPORTACIONES o MAPA_SKU."
    );
  }

  const mapa =
    construirMapaEquivalenciasB12A_(
      shMapa
    );

  const datos =
    shDetalle.getDataRange()
      .getValues();

  const headers =
    datos[0].map(
      normalizarHeaderB12B_
    );

  const idxItem =
    headers.indexOf("ITEM");

  const idxCantidad =
    headers.indexOf("CANTIDAD");

  if (
    idxItem === -1 ||
    idxCantidad === -1
  ) {
    throw new Error(
      "Falta ITEM o CANTIDAD."
    );
  }


  let filasSinCruce = 0;

  let totalNumeroActual = 0;

  let totalValorCrudo = 0;

  const ejemplos = [];


  for (
    let i = 1;
    i < datos.length;
    i++
  ) {

    const item =
      String(
        datos[i][idxItem] || ""
      ).trim();

    if (!item) {
      continue;
    }


    const clave =
      item.toUpperCase();


    if (mapa.has(clave)) {
      continue;
    }


    filasSinCruce++;


    const texto =
      String(
        datos[i][idxCantidad] || ""
      ).trim();


    const numeroActual =
      numeroB12B_(texto);


    totalNumeroActual +=
      numeroActual;


    /*
     * Segunda interpretación.
     *
     * Casos:
     * 1.234,56 -> 1234.56
     * 1,234.56 -> 1234.56
     * 1234,56  -> 1234.56
     * 1234.56  -> 1234.56
     */

    let limpio =
      texto.replace(
        /\s/g,
        ""
      );


    let numeroAlternativo = 0;


    if (
      limpio.includes(",") &&
      limpio.includes(".")
    ) {

      const posComa =
        limpio.lastIndexOf(",");

      const posPunto =
        limpio.lastIndexOf(".");


      if (posComa > posPunto) {

        // Formato 1.234,56

        limpio =
          limpio
            .replace(/\./g, "")
            .replace(",", ".");

      } else {

        // Formato 1,234.56

        limpio =
          limpio.replace(/,/g, "");
      }

    } else if (
      limpio.includes(",")
    ) {

      limpio =
        limpio.replace(",", ".");
    }


    numeroAlternativo =
      Number(limpio) || 0;


    totalValorCrudo +=
      numeroAlternativo;


    if (
      Math.abs(
        numeroActual -
        numeroAlternativo
      ) > 0.001 &&
      ejemplos.length < 30
    ) {

      ejemplos.push({
        fila: i + 1,
        item: item,
        original: texto,
        actual: numeroActual,
        alternativo:
          numeroAlternativo
      });
    }
  }


  Logger.log(
    "===== AUDITORIA CANTIDADES ====="
  );

  Logger.log(
    "Filas sin cruce: " +
    filasSinCruce
  );

  Logger.log(
    "Total numeroB12B_: " +
    totalNumeroActual
  );

  Logger.log(
    "Total interpretación alternativa: " +
    totalValorCrudo
  );

  Logger.log(
    "Diferencia: " +
    (
      totalValorCrudo -
      totalNumeroActual
    )
  );


  Logger.log(
    "===== VALORES CON DIFERENCIA ====="
  );


  ejemplos.forEach(
    function(e) {

      Logger.log(
        "Fila " +
        e.fila +
        " | " +
        e.item +
        " | original=[" +
        e.original +
        "] | actual=" +
        e.actual +
        " | alternativo=" +
        e.alternativo
      );

    }
  );
}

function sugerirEquivalenciasDesdeStockB12B() {

  const ss =
    SpreadsheetApp.getActiveSpreadsheet();

  const shPend =
    ss.getSheetByName(
      "PENDIENTES_EQUIVALENCIA_IMPORT"
    );

  const shStock =
    ss.getSheetByName("STOCK");

  if (!shPend || !shStock) {
    throw new Error(
      "Falta PENDIENTES_EQUIVALENCIA_IMPORT o STOCK."
    );
  }

  // ==========================================================
  // STOCK
  // ==========================================================

  const datosStock =
    shStock.getDataRange()
      .getDisplayValues();

  const headersStock =
    datosStock[0].map(
      normalizarHeaderB12B_
    );

  const iSkuStock =
    headersStock.indexOf("SKU");

  const iMarcaStock =
    headersStock.indexOf("MARCA");

  if (
    iSkuStock === -1 ||
    iMarcaStock === -1
  ) {
    throw new Error(
      "STOCK no contiene SKU/MARCA."
    );
  }

  /*
   * Evitamos duplicados Warnes/Escobar.
   */
  const stockPorMarca =
    new Map();

  const vistos =
    new Set();

  for (
    let i = 1;
    i < datosStock.length;
    i++
  ) {

    const sku =
      String(
        datosStock[i][iSkuStock] || ""
      ).trim();

    const marca =
      String(
        datosStock[i][iMarcaStock] || ""
      ).trim();

    if (!sku) {
      continue;
    }

    const claveSku =
      sku.toUpperCase();

    if (vistos.has(claveSku)) {
      continue;
    }

    vistos.add(claveSku);

    const claveMarca =
      normalizarTextoB12B_(marca);

    if (!stockPorMarca.has(claveMarca)) {
      stockPorMarca.set(
        claveMarca,
        []
      );
    }

    stockPorMarca.get(
      claveMarca
    ).push({
      sku: sku,
      flexible:
        normalizarCodigoFlexibleB12B_(
          sku
        )
    });
  }


  // ==========================================================
  // PENDIENTES
  // ==========================================================

  const datosPend =
    shPend.getDataRange()
      .getDisplayValues();

  const headersPend =
    datosPend[0].map(
      normalizarHeaderB12B_
    );

  const iItem =
    headersPend.indexOf("ITEM");

  const iMarca =
    headersPend.indexOf("MARCA");

  if (
    iItem === -1 ||
    iMarca === -1
  ) {
    throw new Error(
      "PENDIENTES no contiene ITEM/MARCA."
    );
  }


  // Agregamos columnas si todavía no existen.

  let iSugerido =
    headersPend.indexOf(
      "SKU_SUGERIDO"
    );

  let iMetodo =
    headersPend.indexOf(
      "METODO_SUGERENCIA"
    );

  let iCandidatos =
    headersPend.indexOf(
      "CANDIDATOS"
    );


  if (iSugerido === -1) {

    iSugerido =
      shPend.getLastColumn();

    shPend.getRange(
      1,
      iSugerido + 1
    ).setValue(
      "SKU_SUGERIDO"
    );

  }


  if (iMetodo === -1) {

    iMetodo =
      shPend.getLastColumn();

    shPend.getRange(
      1,
      iMetodo + 1
    ).setValue(
      "METODO_SUGERENCIA"
    );

  }


  if (iCandidatos === -1) {

    iCandidatos =
      shPend.getLastColumn();

    shPend.getRange(
      1,
      iCandidatos + 1
    ).setValue(
      "CANDIDATOS"
    );

  }


  const sugerencias = [];

  let unicos = 0;
  let multiples = 0;
  let sinCandidato = 0;


  for (
    let i = 1;
    i < datosPend.length;
    i++
  ) {

    const item =
      String(
        datosPend[i][iItem] || ""
      ).trim();

    const marca =
      String(
        datosPend[i][iMarca] || ""
      ).trim();

    const itemFlexible =
      normalizarCodigoFlexibleB12B_(
        item
      );

    const claveMarca =
      normalizarTextoB12B_(
        marca
      );

    const candidatosMarca =
      stockPorMarca.get(
        claveMarca
      ) || [];


    const candidatos =
      candidatosMarca.filter(
        function(c) {

          /*
           * Buscamos relaciones claras:
           *
           * SKU termina en ITEM
           * ITEM termina en SKU
           * uno contiene al otro
           */

          return (
            c.flexible.endsWith(
              itemFlexible
            ) ||
            itemFlexible.endsWith(
              c.flexible
            ) ||
            c.flexible.includes(
              itemFlexible
            ) ||
            itemFlexible.includes(
              c.flexible
            )
          );
        }
      );


    let sugerido = "";
    let metodo = "";


    if (candidatos.length === 1) {

      sugerido =
        candidatos[0].sku;

      metodo =
        "COINCIDENCIA_UNICA_MARCA";

      unicos++;

    } else if (
      candidatos.length > 1
    ) {

      metodo =
        "MULTIPLES_CANDIDATOS";

      multiples++;

    } else {

      metodo =
        "SIN_CANDIDATO";

      sinCandidato++;
    }


    sugerencias.push([
      sugerido,
      metodo,
      candidatos
        .slice(0, 10)
        .map(function(c) {
          return c.sku;
        })
        .join(" | ")
    ]);
  }


  if (sugerencias.length > 0) {

    /*
     * Las tres columnas fueron agregadas
     * consecutivamente al final.
     */

    const columnaInicial =
      shPend.getLastColumn() - 2;

    shPend.getRange(
      2,
      columnaInicial,
      sugerencias.length,
      3
    ).setValues(
      sugerencias
    );
  }


  Logger.log(
    "===== SUGERENCIAS STOCK ====="
  );

  Logger.log(
    "Pendientes analizados: " +
    sugerencias.length
  );

  Logger.log(
    "Coincidencia única: " +
    unicos
  );

  Logger.log(
    "Múltiples candidatos: " +
    multiples
  );

  Logger.log(
    "Sin candidato: " +
    sinCandidato
  );
}

function aplicarSugerenciasValidadasB12B() {

  const ss =
    SpreadsheetApp.getActiveSpreadsheet();

  const sh =
    ss.getSheetByName(
      "PENDIENTES_EQUIVALENCIA_IMPORT"
    );

  if (!sh) {
    throw new Error(
      "No existe PENDIENTES_EQUIVALENCIA_IMPORT."
    );
  }

  const datos =
    sh.getDataRange()
      .getDisplayValues();

  if (datos.length < 2) {
    return;
  }

  const headers =
    datos[0].map(
      normalizarHeaderB12B_
    );

  const iSkuCanonico =
    headers.indexOf(
      "SKU_CANONICO"
    );

  const iSkuSugerido =
    headers.indexOf(
      "SKU_SUGERIDO"
    );

  let iValidar =
    headers.indexOf(
      "VALIDAR"
    );

  if (
    iSkuCanonico === -1 ||
    iSkuSugerido === -1
  ) {
    throw new Error(
      "Faltan SKU_CANONICO o SKU_SUGERIDO."
    );
  }

  // Crear VALIDAR si todavía no existe
  if (iValidar === -1) {

    iValidar =
      sh.getLastColumn();

    sh.getRange(
      1,
      iValidar + 1
    ).setValue(
      "VALIDAR"
    );

    return;
  }

  const salida = [];

  let aplicadas = 0;

  for (
    let i = 1;
    i < datos.length;
    i++
  ) {

    const validar =
      String(
        datos[i][iValidar] || ""
      )
        .trim()
        .toUpperCase();

    const sugerido =
      String(
        datos[i][iSkuSugerido] || ""
      ).trim();

    const actual =
      String(
        datos[i][iSkuCanonico] || ""
      ).trim();

    let nuevo =
      actual;

    if (
      validar === "SI" &&
      sugerido
    ) {
      nuevo =
        sugerido;

      aplicadas++;
    }

    salida.push([
      nuevo
    ]);
  }

  sh.getRange(
    2,
    iSkuCanonico + 1,
    salida.length,
    1
  ).setValues(
    salida
  );

  Logger.log(
    "Sugerencias aplicadas: " +
    aplicadas
  );
}
 
function auditarCoberturaConValidadasB12B() {

  const ss =
    SpreadsheetApp.getActiveSpreadsheet();

  const shDetalle =
    ss.getSheetByName("DETALLE_IMPORTACIONES");

  const shMapa =
    ss.getSheetByName("MAPA_SKU");

  const shPend =
    ss.getSheetByName(
      "PENDIENTES_EQUIVALENCIA_IMPORT"
    );

  if (
    !shDetalle ||
    !shMapa ||
    !shPend
  ) {
    throw new Error(
      "Falta DETALLE_IMPORTACIONES, MAPA_SKU o " +
      "PENDIENTES_EQUIVALENCIA_IMPORT."
    );
  }


  // ==========================================================
  // 1. EQUIVALENCIAS ORIGINALES
  // ==========================================================

  const mapa =
    construirMapaEquivalenciasB12A_(
      shMapa
    );


  // ==========================================================
  // 2. EQUIVALENCIAS VALIDADAS
  // ==========================================================

  const datosPend =
    shPend.getDataRange()
      .getDisplayValues();

  const headersPend =
    datosPend[0].map(
      normalizarHeaderB12B_
    );

  const iItemPend =
    headersPend.indexOf("ITEM");

  const iCanonicoPend =
    headersPend.indexOf(
      "SKU_CANONICO"
    );

  if (
    iItemPend === -1 ||
    iCanonicoPend === -1
  ) {
    throw new Error(
      "Faltan ITEM o SKU_CANONICO en pendientes."
    );
  }


  const equivalenciasValidadas =
    new Map();


  for (
    let i = 1;
    i < datosPend.length;
    i++
  ) {

    const item =
      String(
        datosPend[i][iItemPend] || ""
      ).trim();

    const sku =
      String(
        datosPend[i][iCanonicoPend] || ""
      ).trim();

    if (
      !item ||
      !sku
    ) {
      continue;
    }

    equivalenciasValidadas.set(
      item.toUpperCase(),
      sku
    );
  }


  // ==========================================================
  // 3. DETALLE DE ÓRDENES
  // ==========================================================

  // getValues() para conservar CANTIDAD como número real.
  const datos =
    shDetalle.getDataRange()
      .getValues();

  const headers =
    datos[0].map(
      normalizarHeaderB12B_
    );

  const iItem =
    headers.indexOf("ITEM");

  const iCantidad =
    headers.indexOf("CANTIDAD");

  const iStatus =
    headers.indexOf("STATUS_LINEA");


  if (
    iItem === -1 ||
    iCantidad === -1 ||
    iStatus === -1
  ) {
    throw new Error(
      "DETALLE_IMPORTACIONES: faltan ITEM, CANTIDAD o STATUS."
    );
  }


  let totalLineas = 0;
  let totalCantidad = 0;

  let cruceOriginalLineas = 0;
  let cruceOriginalCantidad = 0;

  let cruceValidadoLineas = 0;
  let cruceValidadoCantidad = 0;

  let sinCruceLineas = 0;
  let sinCruceCantidad = 0;


  const pendientesStatus = {};

  const ejemplosSinCruce = [];


  // ==========================================================
  // 4. RECORRIDO
  // ==========================================================

  for (
    let i = 1;
    i < datos.length;
    i++
  ) {

    const fila =
      datos[i];

    const item =
      String(
        fila[iItem] || ""
      ).trim();

    if (!item) {
      continue;
    }


    const clave =
      item.toUpperCase();


    const cantidad =
      numeroB12B_(
        fila[iCantidad]
      );


    const status =
      normalizarTextoB12B_(
        fila[iStatus]
      ) || "(VACIO)";


    totalLineas++;
    totalCantidad += cantidad;


    // ----------------------------------------------------------
    // MAPA ORIGINAL
    // ----------------------------------------------------------

    if (
      mapa.has(clave)
    ) {

      cruceOriginalLineas++;

      cruceOriginalCantidad +=
        cantidad;

      continue;
    }


    // ----------------------------------------------------------
    // EQUIVALENCIA VALIDADA
    // ----------------------------------------------------------

    if (
      equivalenciasValidadas.has(
        clave
      )
    ) {

      cruceValidadoLineas++;

      cruceValidadoCantidad +=
        cantidad;

      continue;
    }


    // ----------------------------------------------------------
    // SIGUE SIN CRUCE
    // ----------------------------------------------------------

    sinCruceLineas++;

    sinCruceCantidad +=
      cantidad;


    if (
      !pendientesStatus[status]
    ) {

      pendientesStatus[status] = {
        lineas: 0,
        cantidad: 0
      };
    }


    pendientesStatus[status]
      .lineas++;

    pendientesStatus[status]
      .cantidad += cantidad;


    if (
      ejemplosSinCruce.length < 20
    ) {

      ejemplosSinCruce.push(
        item
      );
    }
  }


  // ==========================================================
  // 5. TOTALES
  // ==========================================================

  const lineasCubiertas =
    cruceOriginalLineas +
    cruceValidadoLineas;

  const cantidadCubierta =
    cruceOriginalCantidad +
    cruceValidadoCantidad;


  const porcentajeLineas =
    totalLineas
      ? (
          lineasCubiertas /
          totalLineas *
          100
        )
      : 0;


  const porcentajeCantidad =
    totalCantidad
      ? (
          cantidadCubierta /
          totalCantidad *
          100
        )
      : 0;


  Logger.log(
    "======================================"
  );

  Logger.log(
    "COBERTURA B.1.2-B CON VALIDADAS"
  );

  Logger.log(
    "======================================"
  );

  Logger.log(
    "Equivalencias validadas: " +
    equivalenciasValidadas.size
  );

  Logger.log(
    "Total líneas: " +
    totalLineas
  );

  Logger.log(
    "Total cantidad: " +
    totalCantidad
  );


  Logger.log(
    "===== MAPA ORIGINAL ====="
  );

  Logger.log(
    "Líneas: " +
    cruceOriginalLineas
  );

  Logger.log(
    "Cantidad: " +
    cruceOriginalCantidad
  );


  Logger.log(
    "===== VALIDADAS ADICIONALES ====="
  );

  Logger.log(
    "Líneas: " +
    cruceValidadoLineas
  );

  Logger.log(
    "Cantidad: " +
    cruceValidadoCantidad
  );


  Logger.log(
    "===== COBERTURA TOTAL ====="
  );

  Logger.log(
    "Líneas cubiertas: " +
    lineasCubiertas +
    " / " +
    totalLineas +
    " = " +
    porcentajeLineas.toFixed(2) +
    "%"
  );

  Logger.log(
    "Cantidad cubierta: " +
    cantidadCubierta +
    " / " +
    totalCantidad +
    " = " +
    porcentajeCantidad.toFixed(2) +
    "%"
  );


  Logger.log(
    "===== PENDIENTES ====="
  );

  Logger.log(
    "Líneas sin cruce: " +
    sinCruceLineas
  );

  Logger.log(
    "Cantidad sin cruce: " +
    sinCruceCantidad
  );


  Logger.log(
    "===== PENDIENTES POR STATUS ====="
  );

  Object.keys(
    pendientesStatus
  )
    .sort(function(a, b) {

      return (
        pendientesStatus[b].cantidad -
        pendientesStatus[a].cantidad
      );

    })
    .forEach(function(status) {

      const d =
        pendientesStatus[status];

      Logger.log(
        status +
        " | líneas=" +
        d.lineas +
        " | cantidad=" +
        d.cantidad
      );

    });


  Logger.log(
    "===== EJEMPLOS SIN CRUCE ====="
  );

  ejemplosSinCruce.forEach(
    function(item, indice) {

      Logger.log(
        (indice + 1) +
        ". " +
        item
      );

    }
  );
}

function diagnosticarFamiliaINDUB12B() {

  const ss =
    SpreadsheetApp.getActiveSpreadsheet();

  const sh =
    ss.getSheetByName("DETALLE_IMPORTACIONES");

  if (!sh) {
    throw new Error(
      "No existe DETALLE_IMPORTACIONES."
    );
  }

  const datos =
    sh.getDataRange()
      .getValues();

  const headers =
    datos[0].map(
      normalizarHeaderB12B_
    );

  const campos = [
    "ITEM",
    "MARCA",
    "PROVEEDOR",
    "CANTIDAD",
    "STATUS_LINEA",
    "SITUACION"
  ];

  const idx = {};

  campos.forEach(function(campo) {

    idx[campo] =
      headers.indexOf(campo);

  });


  Logger.log(
    "===== COLUMNAS DISPONIBLES ====="
  );

  campos.forEach(function(campo) {

    Logger.log(
      campo +
      " = " +
      idx[campo]
    );

  });


  if (idx.ITEM === -1) {
    throw new Error(
      "No existe ITEM."
    );
  }


  let lineas = 0;
  let cantidadTotal = 0;

  const proveedores =
    new Map();

  const marcas =
    new Map();

  const status =
    new Map();

  const ejemplos = [];


  for (
    let i = 1;
    i < datos.length;
    i++
  ) {

    const fila =
      datos[i];

    const item =
      String(
        fila[idx.ITEM] || ""
      ).trim();


    if (
      !item
        .toUpperCase()
        .startsWith("INDU")
    ) {
      continue;
    }


    const cantidad =
      idx.CANTIDAD !== -1
        ? numeroB12B_(
            fila[idx.CANTIDAD]
          )
        : 0;


    const marca =
      idx.MARCA !== -1
        ? String(
            fila[idx.MARCA] || ""
          ).trim()
        : "";


    const proveedor =
      idx.PROVEEDOR !== -1
        ? String(
            fila[idx.PROVEEDOR] || ""
          ).trim()
        : "";


    const estado =
      idx.STATUS !== -1
        ? String(
            fila[idx.STATUS] || ""
          ).trim()
        : "";


    const situacion =
      idx.SITUACION !== -1
        ? String(
            fila[idx.SITUACION] || ""
          ).trim()
        : "";


    lineas++;
    cantidadTotal += cantidad;


    sumarValorDiagnosticoB12B_(
      marcas,
      marca || "(VACIO)",
      cantidad
    );


    sumarValorDiagnosticoB12B_(
      proveedores,
      proveedor || "(VACIO)",
      cantidad
    );


    sumarValorDiagnosticoB12B_(
      status,
      estado || "(VACIO)",
      cantidad
    );


    if (
      ejemplos.length < 30
    ) {

      ejemplos.push(
        item +
        " | marca=" +
        marca +
        " | proveedor=" +
        proveedor +
        " | cantidad=" +
        cantidad +
        " | status=" +
        estado +
        " | situacion=" +
        situacion
      );
    }
  }


  Logger.log(
    "===== FAMILIA INDU ====="
  );

  Logger.log(
    "Líneas: " +
    lineas
  );

  Logger.log(
    "Cantidad: " +
    cantidadTotal
  );


  Logger.log(
    "===== MARCAS ====="
  );

  imprimirMapaDiagnosticoB12B_(
    marcas
  );


  Logger.log(
    "===== PROVEEDORES ====="
  );

  imprimirMapaDiagnosticoB12B_(
    proveedores
  );


  Logger.log(
    "===== STATUS ====="
  );

  imprimirMapaDiagnosticoB12B_(
    status
  );


  Logger.log(
    "===== EJEMPLOS ====="
  );

  ejemplos.forEach(
    function(valor, indice) {

      Logger.log(
        (indice + 1) +
        ". " +
        valor
      );

    }
  );
}


function sumarValorDiagnosticoB12B_(
  mapa,
  valor,
  cantidad
) {

  if (!mapa.has(valor)) {

    mapa.set(
      valor,
      {
        lineas: 0,
        cantidad: 0
      }
    );
  }

  const d =
    mapa.get(valor);

  d.lineas++;
  d.cantidad += cantidad;
}


function imprimirMapaDiagnosticoB12B_(
  mapa
) {

  Array.from(
    mapa.entries()
  )
    .sort(function(a, b) {

      return (
        b[1].cantidad -
        a[1].cantidad
      );

    })
    .forEach(function(par) {

      Logger.log(
        par[0] +
        " | líneas=" +
        par[1].lineas +
        " | cantidad=" +
        par[1].cantidad
      );

    });
}

function diagnosticarTopPendientesB12B() {

  const ss =
    SpreadsheetApp.getActiveSpreadsheet();

  const shDetalle =
    ss.getSheetByName(
      "DETALLE_IMPORTACIONES"
    );

  const shMapa =
    ss.getSheetByName(
      "MAPA_SKU"
    );

  const shPend =
    ss.getSheetByName(
      "PENDIENTES_EQUIVALENCIA_IMPORT"
    );

  if (
    !shDetalle ||
    !shMapa ||
    !shPend
  ) {
    throw new Error(
      "Falta DETALLE_IMPORTACIONES, MAPA_SKU " +
      "o PENDIENTES_EQUIVALENCIA_IMPORT."
    );
  }


  // ==========================================================
  // MAPA ORIGINAL
  // ==========================================================

  const mapaOriginal =
    construirMapaEquivalenciasB12A_(
      shMapa
    );


  // ==========================================================
  // EQUIVALENCIAS VALIDADAS
  // ==========================================================

  const datosPend =
    shPend.getDataRange()
      .getDisplayValues();

  const headersPend =
    datosPend[0].map(
      normalizarHeaderB12B_
    );

  const idxItemPend =
    headersPend.indexOf(
      "ITEM"
    );

  const idxCanonicoPend =
    headersPend.indexOf(
      "SKU_CANONICO"
    );

  const mapaValidadas =
    new Map();


  for (
    let i = 1;
    i < datosPend.length;
    i++
  ) {

    const item =
      String(
        datosPend[i][idxItemPend] || ""
      )
        .trim()
        .toUpperCase();

    const sku =
      String(
        datosPend[i][idxCanonicoPend] || ""
      ).trim();

    if (
      item &&
      sku
    ) {
      mapaValidadas.set(
        item,
        sku
      );
    }
  }


  // ==========================================================
  // DETALLE
  // ==========================================================

  const datos =
    shDetalle.getDataRange()
      .getValues();

  const headers =
    datos[0].map(
      normalizarHeaderB12B_
    );

  const idx = {

    item:
      headers.indexOf("ITEM"),

    marca:
      headers.indexOf("MARCA"),

    proveedor:
      headers.indexOf("PROVEEDOR"),

    cantidad:
      headers.indexOf("CANTIDAD"),

    status:
      headers.indexOf("STATUS_LINEA"),

    situacion:
      headers.indexOf("SITUACION")
  };


  const pendientes =
    new Map();


  for (
    let i = 1;
    i < datos.length;
    i++
  ) {

    const fila =
      datos[i];

    const item =
      String(
        fila[idx.item] || ""
      ).trim();

    if (!item) {
      continue;
    }


    const clave =
      item.toUpperCase();


    // Ya resuelto originalmente
    if (
      mapaOriginal.has(clave)
    ) {
      continue;
    }


    // Ya resuelto por validación
    if (
      mapaValidadas.has(clave)
    ) {
      continue;
    }


    const cantidad =
      numeroB12B_(
        fila[idx.cantidad]
      );


    const marca =
      idx.marca !== -1
        ? String(
            fila[idx.marca] || ""
          ).trim()
        : "";


    const proveedor =
      idx.proveedor !== -1
        ? String(
            fila[idx.proveedor] || ""
          ).trim()
        : "";


    const status =
      idx.status !== -1
        ? String(
            fila[idx.status] || ""
          ).trim()
        : "";


    const situacion =
      idx.situacion !== -1
        ? String(
            fila[idx.situacion] || ""
          ).trim()
        : "";


    if (
      !pendientes.has(clave)
    ) {

      pendientes.set(
        clave,
        {
          item: item,
          marca: marca,
          proveedor: proveedor,
          lineas: 0,
          cantidad: 0,
          estados: new Set(),
          situaciones: new Set()
        }
      );
    }


    const p =
      pendientes.get(clave);

    p.lineas++;

    p.cantidad +=
      cantidad;


    if (status) {
      p.estados.add(
        status
      );
    }


    if (situacion) {
      p.situaciones.add(
        situacion
      );
    }
  }


  // ==========================================================
  // RANKING
  // ==========================================================

  const ranking =
    Array.from(
      pendientes.values()
    )
      .sort(function(a, b) {

        return (
          b.cantidad -
          a.cantidad
        );

      });


  const totalCantidad =
    ranking.reduce(
      function(acum, p) {

        return (
          acum +
          p.cantidad
        );

      },
      0
    );


  Logger.log(
    "======================================"
  );

  Logger.log(
    "TOP PENDIENTES B.1.2-B"
  );

  Logger.log(
    "======================================"
  );

  Logger.log(
    "ITEM pendientes: " +
    ranking.length
  );

  Logger.log(
    "Cantidad pendiente total: " +
    totalCantidad
  );


  let acumulado = 0;


  ranking
    .slice(
      0,
      50
    )
    .forEach(
      function(p, indice) {

        acumulado +=
          p.cantidad;


        const porcentaje =
          totalCantidad
            ? (
                acumulado /
                totalCantidad *
                100
              )
            : 0;


        Logger.log(
          (indice + 1) +
          ". " +
          p.item +
          " | marca=" +
          (
            p.marca ||
            "(SIN MARCA)"
          ) +
          " | cantidad=" +
          p.cantidad +
          " | líneas=" +
          p.lineas +
          " | status=" +
          Array.from(
            p.estados
          ).join(" | ") +
          " | acumulado=" +
          porcentaje.toFixed(2) +
          "%"
        );
      }
    );
}

function sugerirTopPendientesB12B() {

  const ss =
    SpreadsheetApp.getActiveSpreadsheet();

  const shPend =
    ss.getSheetByName(
      "PENDIENTES_EQUIVALENCIA_IMPORT"
    );

  const shMapa =
    ss.getSheetByName(
      "MAPA_SKU"
    );

  const shStock =
    ss.getSheetByName(
      "STOCK"
    );

  if (
    !shPend ||
    !shMapa ||
    !shStock
  ) {
    throw new Error(
      "Falta PENDIENTES_EQUIVALENCIA_IMPORT, MAPA_SKU o STOCK."
    );
  }

  // ==========================================================
  // LEER PENDIENTES
  // ==========================================================

  const datosPend =
    shPend.getDataRange()
      .getDisplayValues();

  const headersPend =
    datosPend[0].map(
      normalizarHeaderB12B_
    );

  const idx = {
    item:
      headersPend.indexOf("ITEM"),

    marca:
      headersPend.indexOf("MARCA"),

    cantidad:
      headersPend.indexOf("CANTIDAD_TOTAL"),

    canonico:
      headersPend.indexOf("SKU_CANONICO"),

    sugerido:
      headersPend.indexOf("SKU_SUGERIDO"),

    metodo:
      headersPend.indexOf("METODO_SUGERENCIA"),

    candidatos:
      headersPend.indexOf("CANDIDATOS")
  };

  if (
    idx.item === -1 ||
    idx.cantidad === -1
  ) {
    throw new Error(
      "PENDIENTES: faltan ITEM o CANTIDAD_TOTAL."
    );
  }


  // ==========================================================
  // ASEGURAR COLUMNAS
  // ==========================================================

  let ultimaCol =
    shPend.getLastColumn();

  function asegurarColumna_(nombre) {

    const headersActuales =
      shPend.getRange(
        1,
        1,
        1,
        shPend.getLastColumn()
      )
        .getDisplayValues()[0]
        .map(
          normalizarHeaderB12B_
        );

    let indice =
      headersActuales.indexOf(
        nombre
      );

    if (indice === -1) {

      ultimaCol =
        shPend.getLastColumn() + 1;

      shPend.getRange(
        1,
        ultimaCol
      ).setValue(
        nombre
      );

      indice =
        ultimaCol - 1;
    }

    return indice;
  }


  idx.sugerido =
    asegurarColumna_(
      "SKU_SUGERIDO"
    );

  idx.metodo =
    asegurarColumna_(
      "METODO_SUGERENCIA"
    );

  idx.candidatos =
    asegurarColumna_(
      "CANDIDATOS"
    );

  const idxConfianza =
    asegurarColumna_(
      "CONFIANZA_TOP"
    );


  // ==========================================================
  // CONSTRUIR UNIVERSO DE SKU
  // ==========================================================

  const universo =
    new Map();


  function agregarSku_(
    sku,
    marca,
    origen
  ) {

    sku =
      String(
        sku || ""
      ).trim();

    if (!sku) {
      return;
    }

    const clave =
      sku.toUpperCase();

    if (!universo.has(clave)) {

      universo.set(
        clave,
        {
          sku: sku,
          marca:
            normalizarTextoB12B_(
              marca
            ),
          flexible:
            normalizarCodigoFlexibleB12B_(
              sku
            ),
          origen: origen
        }
      );
    }
  }


  // MAPA_SKU
  const datosMapa =
    shMapa.getDataRange()
      .getDisplayValues();

  const hMapa =
    datosMapa[0].map(
      normalizarHeaderB12B_
    );

  const iNuevo =
    hMapa.indexOf(
      "CODIGO_NUEVO"
    );

  for (
    let i = 1;
    i < datosMapa.length;
    i++
  ) {

    agregarSku_(
      datosMapa[i][iNuevo],
      "",
      "MAPA_SKU"
    );
  }


  // STOCK
  const datosStock =
    shStock.getDataRange()
      .getDisplayValues();

  const hStock =
    datosStock[0].map(
      normalizarHeaderB12B_
    );

  const iSkuStock =
    hStock.indexOf("SKU");

  const iMarcaStock =
    hStock.indexOf("MARCA");


  for (
    let i = 1;
    i < datosStock.length;
    i++
  ) {

    agregarSku_(
      datosStock[i][iSkuStock],
      datosStock[i][iMarcaStock],
      "STOCK"
    );
  }


  const listaUniverso =
    Array.from(
      universo.values()
    );


  // ==========================================================
  // TOP PENDIENTES
  // ==========================================================

  const pendientes = [];


  for (
    let i = 1;
    i < datosPend.length;
    i++
  ) {

    const canonico =
      idx.canonico !== -1
        ? String(
            datosPend[i][idx.canonico] || ""
          ).trim()
        : "";


    // Ya resuelto
    if (canonico) {
      continue;
    }


    const item =
      String(
        datosPend[i][idx.item] || ""
      ).trim();

    if (!item) {
      continue;
    }


    pendientes.push({
      fila: i + 1,
      item: item,
      marca:
        idx.marca !== -1
          ? String(
              datosPend[i][idx.marca] || ""
            ).trim()
          : "",
      cantidad:
        numeroB12B_(
          datosPend[i][idx.cantidad]
        )
    });
  }


  pendientes.sort(
    function(a, b) {
      return (
        b.cantidad -
        a.cantidad
      );
    }
  );


  const top =
    pendientes.slice(
      0,
      50
    );


  // ==========================================================
  // SCORING
  // ==========================================================

  let sugerenciasAltas = 0;
  let sugerenciasMedias = 0;
  let sinSugerencia = 0;


  top.forEach(
    function(p) {

      const itemFlex =
        normalizarCodigoFlexibleB12B_(
          p.item
        );

      const marcaFlex =
        normalizarTextoB12B_(
          p.marca
        );


      const candidatos =
        listaUniverso
          .map(function(c) {

            let score = 0;

            /*
             * Coincidencia exacta flexible.
             */
            if (
              c.flexible ===
              itemFlex
            ) {
              score += 100;
            }


            /*
             * Contención completa.
             */
            if (
              c.flexible.endsWith(
                itemFlex
              ) ||
              itemFlex.endsWith(
                c.flexible
              )
            ) {
              score += 70;
            }


            /*
             * Contiene.
             */
            else if (
              c.flexible.includes(
                itemFlex
              ) ||
              itemFlex.includes(
                c.flexible
              )
            ) {
              score += 50;
            }


            /*
             * Marca coincidente.
             */
            if (
              marcaFlex &&
              c.marca &&
              marcaFlex ===
              c.marca
            ) {
              score += 20;
            }


            /*
             * Prefijo común.
             */
            const prefijo =
              longitudPrefijoComunB12B_(
                itemFlex,
                c.flexible
              );

            if (prefijo >= 6) {
              score += 15;
            } else if (
              prefijo >= 4
            ) {
              score += 8;
            }


            return {
              sku: c.sku,
              score: score
            };

          })
          .filter(function(c) {
            return c.score > 0;
          })
          .sort(function(a, b) {
            return (
              b.score -
              a.score
            );
          });


      let sugerido = "";
      let confianza = "";
      let metodo = "";


      if (
        candidatos.length > 0
      ) {

        const primero =
          candidatos[0];

        const segundo =
          candidatos.length > 1
            ? candidatos[1]
            : null;


        if (
          primero.score >= 90 &&
          (
            !segundo ||
            primero.score -
              segundo.score >= 20
          )
        ) {

          sugerido =
            primero.sku;

          confianza =
            "ALTA";

          metodo =
            "TOP50_MATCH_ALTO";

          sugerenciasAltas++;

        } else if (
          primero.score >= 60 &&
          (
            !segundo ||
            primero.score >
              segundo.score
          )
        ) {

          sugerido =
            primero.sku;

          confianza =
            "MEDIA";

          metodo =
            "TOP50_MATCH_MEDIO";

          sugerenciasMedias++;

        } else {

          confianza =
            "REVISAR";

          metodo =
            "TOP50_MULTIPLE";
        }

      } else {

        confianza =
          "SIN_CANDIDATO";

        metodo =
          "TOP50_SIN_MATCH";

        sinSugerencia++;
      }


      shPend.getRange(
        p.fila,
        idx.sugerido + 1
      ).setValue(
        sugerido
      );


      shPend.getRange(
        p.fila,
        idx.metodo + 1
      ).setValue(
        metodo
      );


      shPend.getRange(
        p.fila,
        idx.candidatos + 1
      ).setValue(
        candidatos
          .slice(0, 5)
          .map(function(c) {
            return (
              c.sku +
              " (" +
              c.score +
              ")"
            );
          })
          .join(" | ")
      );


      shPend.getRange(
        p.fila,
        idxConfianza + 1
      ).setValue(
        confianza
      );
    }
  );


  Logger.log(
    "===== TOP 50 SUGERENCIAS ====="
  );

  Logger.log(
    "ALTA: " +
    sugerenciasAltas
  );

  Logger.log(
    "MEDIA: " +
    sugerenciasMedias
  );

  Logger.log(
    "SIN SUGERENCIA: " +
    sinSugerencia
  );

  Logger.log(
    "TOP analizados: " +
    top.length
  );
}


function longitudPrefijoComunB12B_(
  a,
  b
) {

  const limite =
    Math.min(
      a.length,
      b.length
    );

  let i = 0;

  while (
    i < limite &&
    a[i] === b[i]
  ) {
    i++;
  }

  return i;
}

/******************************************************************
 * SII - MODELO DE COMPRAS
 * Sprint B.1.2-B
 * Versión 0.1.210
 *
 * Completa en MODELO_COMPRAS:
 *
 *   PENDIENTE_TOTAL
 *   EMBARCADO
 *   EN_FABRICA
 *
 * Regla actual:
 *
 *   PENDIENTE_TOTAL = EMBARCADO + EN_FABRICA
 *
 * NO incluye todavía:
 *
 *   A EMBARCAR
 *   A INGRESAR
 *
 * Fuentes:
 *
 *   DETALLE_IMPORTACIONES
 *   MAPA_SKU
 *   PENDIENTES_EQUIVALENCIA_IMPORT
 ******************************************************************/

function actualizarImportacionesModeloB12B() {

  const inicio =
    Date.now();

  const ss =
    SpreadsheetApp.getActiveSpreadsheet();

  const shModelo =
    ss.getSheetByName(
      "MODELO_COMPRAS"
    );

  const shDetalle =
    ss.getSheetByName(
      "DETALLE_IMPORTACIONES"
    );

  const shMapa =
    ss.getSheetByName(
      "MAPA_SKU"
    );

  const shPendientes =
    ss.getSheetByName(
      "PENDIENTES_EQUIVALENCIA_IMPORT"
    );


  if (
    !shModelo ||
    !shDetalle ||
    !shMapa
  ) {

    throw new Error(
      "Falta MODELO_COMPRAS, DETALLE_IMPORTACIONES o MAPA_SKU."
    );
  }


  Logger.log(
    "B.1.2-B - Inicio"
  );


  // ==========================================================
  // 1. EQUIVALENCIAS BASE
  // ==========================================================

  const equivalencias =
    construirMapaEquivalenciasB12A_(
      shMapa
    );


  Logger.log(
    "Equivalencias base: " +
    equivalencias.size
  );


  // ==========================================================
  // 2. INCORPORAR EQUIVALENCIAS VALIDADAS
  // ==========================================================

  let equivalenciasValidadas = 0;


  if (shPendientes) {

    const datosPend =
      shPendientes
        .getDataRange()
        .getDisplayValues();


    if (datosPend.length > 1) {

      const headersPend =
        datosPend[0].map(
          normalizarHeaderB12B_
        );


      const idxItemPend =
        headersPend.indexOf(
          "ITEM"
        );


      const idxSkuPend =
        headersPend.indexOf(
          "SKU_CANONICO"
        );


      if (
        idxItemPend !== -1 &&
        idxSkuPend !== -1
      ) {

        for (
          let i = 1;
          i < datosPend.length;
          i++
        ) {

          const item =
            String(
              datosPend[i][idxItemPend] || ""
            )
              .trim()
              .toUpperCase();


          const sku =
            String(
              datosPend[i][idxSkuPend] || ""
            )
              .trim()
              .toUpperCase();


          if (
            !item ||
            !sku
          ) {
            continue;
          }


          /*
           * Solamente agregamos si no
           * existía ya una equivalencia.
           */

          if (
            !equivalencias.has(item)
          ) {

            equivalencias.set(
              item,
              sku
            );

            equivalenciasValidadas++;
          }
        }
      }
    }
  }


  Logger.log(
    "Equivalencias validadas agregadas: " +
    equivalenciasValidadas
  );


  // ==========================================================
  // 3. LEER DETALLE_IMPORTACIONES
  // ==========================================================

  /*
   * IMPORTANTE:
   *
   * getValues(), no getDisplayValues().
   *
   * Así una cantidad 20,000.00 llega
   * como número 20000.
   */

  const datosDetalle =
    shDetalle
      .getDataRange()
      .getValues();


  const headersDetalle =
    datosDetalle[0].map(
      normalizarHeaderB12B_
    );


  const idxDetalle = {

    item:
      headersDetalle.indexOf(
        "ITEM"
      ),

    cantidad:
      headersDetalle.indexOf(
        "CANTIDAD"
      ),

    status:
      headersDetalle.indexOf(
        "STATUS_LINEA"
      )
  };


  Object.keys(
    idxDetalle
  ).forEach(function(campo) {

    if (
      idxDetalle[campo] === -1
    ) {

      throw new Error(
        "DETALLE_IMPORTACIONES: falta columna " +
        campo
      );
    }

  });


  // ==========================================================
  // 4. CONSOLIDAR IMPORTACIONES POR SKU
  // ==========================================================

  const importaciones =
    new Map();


  let lineasProcesadas = 0;
  let lineasCruzadas = 0;
  let lineasSinCruce = 0;

  let cantidadProcesada = 0;
  let cantidadCruzada = 0;
  let cantidadSinCruce = 0;


  for (
    let i = 1;
    i < datosDetalle.length;
    i++
  ) {

    const fila =
      datosDetalle[i];


    const item =
      String(
        fila[idxDetalle.item] || ""
      )
        .trim()
        .toUpperCase();


    if (!item) {
      continue;
    }


    const cantidad =
      numeroB12B_(
        fila[idxDetalle.cantidad]
      );


    const status =
      normalizarTextoB12B_(
        fila[idxDetalle.status]
      );


    lineasProcesadas++;
    cantidadProcesada += cantidad;


    const sku =
      equivalencias.get(
        item
      );


    if (!sku) {

      lineasSinCruce++;

      cantidadSinCruce +=
        cantidad;

      continue;
    }


    lineasCruzadas++;
    cantidadCruzada +=
      cantidad;


    if (
      !importaciones.has(sku)
    ) {

      importaciones.set(
        sku,
        {
          embarcado: 0,
          enFabrica: 0
        }
      );
    }


    const dato =
      importaciones.get(sku);


    // ========================================================
    // REGLAS DE ESTADO
    // ========================================================

    if (
      status === "EMBARCADO"
    ) {

      dato.embarcado +=
        cantidad;

    } else if (
      status === "EN FABRICA"
    ) {

      dato.enFabrica +=
        cantidad;
    }

    /*
     * A EMBARCAR
     * A INGRESAR
     *
     * intencionalmente no se incorporan
     * en esta versión.
     */
  }


  Logger.log(
    "SKU con importaciones: " +
    importaciones.size
  );


  // ==========================================================
  // 5. LEER MODELO_COMPRAS
  // ==========================================================

  const FILA_HEADER = 2;


  const ultimaFilaModelo =
    shModelo.getLastRow();


  const ultimaColModelo =
    shModelo.getLastColumn();


  if (
    ultimaFilaModelo <=
    FILA_HEADER
  ) {

    throw new Error(
      "MODELO_COMPRAS no contiene SKU."
    );
  }


  const headersModelo =
    shModelo.getRange(
      FILA_HEADER,
      1,
      1,
      ultimaColModelo
    )
      .getDisplayValues()[0]
      .map(
        normalizarHeaderB12B_
      );


  const idxModelo = {

    sku:
      headersModelo.indexOf(
        "SKU"
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
      )
  };


  Object.keys(
    idxModelo
  ).forEach(function(campo) {

    if (
      idxModelo[campo] === -1
    ) {

      throw new Error(
        "MODELO_COMPRAS: falta columna " +
        campo
      );
    }

  });


  const cantidadFilas =
    ultimaFilaModelo -
    FILA_HEADER;


  /*
   * Leemos solamente SKU.
   *
   * No hace falta leer las 30 columnas
   * completas para este Sprint.
   */

  const skusModelo =
    shModelo.getRange(
      FILA_HEADER + 1,
      idxModelo.sku + 1,
      cantidadFilas,
      1
    )
      .getDisplayValues();


  // ==========================================================
  // 6. PREPARAR COLUMNAS DE SALIDA
  // ==========================================================

  const salidaPendiente = [];
  const salidaEmbarcado = [];
  const salidaFabrica = [];


  let skuConImportacion = 0;
  let skuSinImportacion = 0;


  let totalPendienteModelo = 0;
  let totalEmbarcadoModelo = 0;
  let totalFabricaModelo = 0;


  for (
    let i = 0;
    i < skusModelo.length;
    i++
  ) {

    const sku =
      String(
        skusModelo[i][0] || ""
      )
        .trim()
        .toUpperCase();


    if (!sku) {

      salidaPendiente.push([0]);
      salidaEmbarcado.push([0]);
      salidaFabrica.push([0]);

      continue;
    }


    const dato =
      importaciones.get(
        sku
      );


    if (!dato) {

      salidaPendiente.push([0]);
      salidaEmbarcado.push([0]);
      salidaFabrica.push([0]);

      skuSinImportacion++;

      continue;
    }


    const embarcado =
      dato.embarcado || 0;


    const fabrica =
      dato.enFabrica || 0;


    const pendiente =
      embarcado +
      fabrica;


    salidaPendiente.push([
      pendiente
    ]);


    salidaEmbarcado.push([
      embarcado
    ]);


    salidaFabrica.push([
      fabrica
    ]);


    totalPendienteModelo +=
      pendiente;


    totalEmbarcadoModelo +=
      embarcado;


    totalFabricaModelo +=
      fabrica;


    skuConImportacion++;
  }


  // ==========================================================
  // 7. ESCRITURA
  // ==========================================================

  /*
   * Tres escrituras masivas.
   *
   * No tocamos ninguna otra columna.
   */

  shModelo.getRange(
    FILA_HEADER + 1,
    idxModelo.pendiente + 1,
    cantidadFilas,
    1
  ).setValues(
    salidaPendiente
  );


  shModelo.getRange(
    FILA_HEADER + 1,
    idxModelo.embarcado + 1,
    cantidadFilas,
    1
  ).setValues(
    salidaEmbarcado
  );


  shModelo.getRange(
    FILA_HEADER + 1,
    idxModelo.fabrica + 1,
    cantidadFilas,
    1
  ).setValues(
    salidaFabrica
  );


  // ==========================================================
  // 8. FORMATO
  // ==========================================================

  shModelo.getRange(
    FILA_HEADER + 1,
    idxModelo.pendiente + 1,
    cantidadFilas,
    3
  ).setNumberFormat(
    "#,##0.00"
  );


  SpreadsheetApp.flush();


  // ==========================================================
  // 9. RESULTADO
  // ==========================================================

  const resultado = {

    version:
      "0.1.210",

    filasModelo:
      cantidadFilas,

    lineasDetalle:
      lineasProcesadas,

    lineasCruzadas:
      lineasCruzadas,

    lineasSinCruce:
      lineasSinCruce,

    cantidadDetalle:
      cantidadProcesada,

    cantidadCruzada:
      cantidadCruzada,

    cantidadSinCruce:
      cantidadSinCruce,

    skuConImportacion:
      skuConImportacion,

    skuSinImportacion:
      skuSinImportacion,

    totalPendienteModelo:
      totalPendienteModelo,

    totalEmbarcadoModelo:
      totalEmbarcadoModelo,

    totalEnFabricaModelo:
      totalFabricaModelo,

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
    "Importaciones actualizadas en MODELO_COMPRAS",
    "Sprint B.1.2",
    5
  );


  return resultado;
}