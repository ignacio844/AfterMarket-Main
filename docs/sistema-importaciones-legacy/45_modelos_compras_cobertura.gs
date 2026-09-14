/******************************************************************
 * SII - MODELO DE COMPRAS
 * Sprint B.1.3-A
 * DIAGNÓSTICO DE PARÁMETROS
 *
 * SOLO LECTURA.
 ******************************************************************/

function diagnosticoParametrosB13() {

  const ss =
    SpreadsheetApp.getActiveSpreadsheet();

  const hojas = [
    "PARAMETROS_COMPRAS",
    "PARAMETROS",
    "MARCAS",
    "PROVEEDORES",
    "MODELO_COMPRAS"
  ];

  Logger.log(
    "======================================"
  );

  Logger.log(
    "SII - SPRINT B.1.3"
  );

  Logger.log(
    "DIAGNÓSTICO DE PARÁMETROS"
  );

  Logger.log(
    "======================================"
  );


  hojas.forEach(function(nombre) {

    const sh =
      ss.getSheetByName(nombre);

    Logger.log("");
    Logger.log(
      "--------------------------------------"
    );

    Logger.log(
      "HOJA: " + nombre
    );

    Logger.log(
      "--------------------------------------"
    );


    if (!sh) {

      Logger.log(
        "NO EXISTE"
      );

      return;
    }


    const ultimaFila =
      sh.getLastRow();

    const ultimaCol =
      sh.getLastColumn();


    Logger.log(
      "Filas: " +
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

      Logger.log(
        "VACÍA"
      );

      return;
    }


    /*
     * MODELO_COMPRAS tiene dos filas
     * de encabezado.
     */
    const filaHeader =
      nombre === "MODELO_COMPRAS"
        ? 2
        : 1;


    const headers =
      sh.getRange(
        filaHeader,
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
          "C" +
          (indice + 1) +
          " = [" +
          valor +
          "]"
        );

      }
    );


    /*
     * Sólo unas pocas filas de muestra.
     */
    const filasDisponibles =
      ultimaFila -
      filaHeader;


    const cantidad =
      Math.min(
        Math.max(
          filasDisponibles,
          0
        ),
        5
      );


    if (cantidad > 0) {

      const muestra =
        sh.getRange(
          filaHeader + 1,
          1,
          cantidad,
          ultimaCol
        ).getDisplayValues();


      Logger.log(
        "MUESTRA:"
      );


      muestra.forEach(
        function(fila, indice) {

          Logger.log(
            "Fila " +
            (
              filaHeader +
              1 +
              indice
            ) +
            ": " +
            JSON.stringify(
              fila
            )
          );

        }
      );
    }
  });


  Logger.log("");
  Logger.log(
    "======================================"
  );

  Logger.log(
    "FIN DIAGNÓSTICO B.1.3"
  );

  Logger.log(
    "======================================"
  );
}

function listarParametrosComprasB13() {

  const ss =
    SpreadsheetApp.getActiveSpreadsheet();

  const sh =
    ss.getSheetByName(
      "PARAMETROS_COMPRAS"
    );

  if (!sh) {
    throw new Error(
      "No existe PARAMETROS_COMPRAS."
    );
  }

  const datos =
    sh.getDataRange()
      .getDisplayValues();

  Logger.log(
    "===== PARAMETROS_COMPRAS ====="
  );

  for (
    let i = 1;
    i < datos.length;
    i++
  ) {

    Logger.log(
      "TIPO=[" +
      datos[i][0] +
      "] | CLAVE=[" +
      datos[i][1] +
      "] | VALOR=[" +
      datos[i][2] +
      "] | ACTIVO=[" +
      datos[i][4] +
      "]"
    );
  }
}

/******************************************************************
 * SII - MODELO DE COMPRAS
 * Sprint B.1.3-B
 * Versión 0.1.301
 *
 * Completa:
 *
 *   MARCA
 *   PROVEEDOR (sólo si puede determinarse en forma unívoca)
 *   LEAD_TIME
 *   COBERTURA_OBJETIVO
 *   COBERTURA_ACTUAL
 *   COBERTURA_FUTURA
 *
 ******************************************************************/

function actualizarCoberturasModeloB13() {

  const inicio = Date.now();

  const ss =
    SpreadsheetApp.getActiveSpreadsheet();

  const shModelo =
    ss.getSheetByName("MODELO_COMPRAS");

  const shStock =
    ss.getSheetByName("STOCK");

  const shMapa =
    ss.getSheetByName("MAPA_SKU");

  const shMarcas =
    ss.getSheetByName("MARCAS");

  const shProveedores =
    ss.getSheetByName("PROVEEDORES");

  const shParametros =
    ss.getSheetByName("PARAMETROS_COMPRAS");

  const shDetalle =
    ss.getSheetByName("DETALLE_IMPORTACIONES");

  const shPend =
    ss.getSheetByName(
      "PENDIENTES_EQUIVALENCIA_IMPORT"
    );

  if (
    !shModelo ||
    !shStock ||
    !shMapa ||
    !shMarcas ||
    !shProveedores ||
    !shParametros
  ) {
    throw new Error(
      "Faltan hojas necesarias para B.1.3."
    );
  }

  Logger.log(
    "B.1.3-B - Inicio"
  );


  // ==========================================================
  // 1. EQUIVALENCIAS SKU
  // ==========================================================

  const equivalencias =
    construirMapaEquivalenciasB12A_(
      shMapa
    );


  /*
   * Incorporar equivalencias validadas
   * de importación.
   */
  if (shPend) {

    const datosPend =
      shPend.getDataRange()
        .getDisplayValues();

    if (datosPend.length > 1) {

      const h =
        datosPend[0].map(
          normalizarHeaderB13_
        );

      const iItem =
        h.indexOf("ITEM");

      const iSku =
        h.indexOf("SKU_CANONICO");

      if (
        iItem !== -1 &&
        iSku !== -1
      ) {

        for (
          let i = 1;
          i < datosPend.length;
          i++
        ) {

          const item =
            normalizarCodigoB13_(
              datosPend[i][iItem]
            );

          const sku =
            normalizarCodigoB13_(
              datosPend[i][iSku]
            );

          if (
            item &&
            sku &&
            !equivalencias.has(item)
          ) {
            equivalencias.set(
              item,
              sku
            );
          }
        }
      }
    }
  }


  // ==========================================================
  // 2. MARCA POR SKU DESDE STOCK
  // ==========================================================

  const marcaPorSku =
    new Map();

  const datosStock =
    shStock.getDataRange()
      .getDisplayValues();

  const hStock =
    datosStock[0].map(
      normalizarHeaderB13_
    );

  const iSkuStock =
    hStock.indexOf("SKU");

  const iMarcaStock =
    hStock.indexOf("MARCA");

  if (
    iSkuStock === -1 ||
    iMarcaStock === -1
  ) {
    throw new Error(
      "STOCK no contiene SKU/MARCA."
    );
  }


  for (
    let i = 1;
    i < datosStock.length;
    i++
  ) {

    const origen =
      normalizarCodigoB13_(
        datosStock[i][iSkuStock]
      );

    const marca =
      String(
        datosStock[i][iMarcaStock] || ""
      ).trim();

    if (
      !origen ||
      !marca
    ) {
      continue;
    }

    const sku =
      equivalencias.get(origen) ||
      origen;

    if (
      !marcaPorSku.has(sku)
    ) {
      marcaPorSku.set(
        sku,
        marca
      );
    }
  }


  Logger.log(
    "SKU con marca: " +
    marcaPorSku.size
  );


  // ==========================================================
  // 3. COBERTURA DEFAULT Y OVERRIDES PARAMETROS_COMPRAS
  // ==========================================================

  const datosParametros =
    shParametros.getDataRange()
      .getDisplayValues();

  const hParam =
    datosParametros[0].map(
      normalizarHeaderB13_
    );

  const pTipo =
    hParam.indexOf("TIPO");

  const pClave =
    hParam.indexOf("CLAVE");

  const pValor =
    hParam.indexOf("VALOR");

  const pActivo =
    hParam.indexOf("ACTIVO");


  let coberturaDefault = 4;

  const coberturaParametroMarca =
    new Map();


  for (
    let i = 1;
    i < datosParametros.length;
    i++
  ) {

    const activo =
      normalizarTextoB13_(
        datosParametros[i][pActivo]
      );

    if (activo !== "SI") {
      continue;
    }


    const tipo =
      normalizarTextoB13_(
        datosParametros[i][pTipo]
      );

    const clave =
      normalizarTextoB13_(
        datosParametros[i][pClave]
      );

    const valor =
      numeroB13_(
        datosParametros[i][pValor]
      );


    if (
      tipo === "GENERAL" &&
      clave ===
        "COBERTURA_DEFAULT_MESES"
    ) {

      if (valor > 0) {
        coberturaDefault =
          valor;
      }

    } else if (
      tipo === "MARCA" &&
      clave !== "DEFAULT" &&
      valor > 0
    ) {

      coberturaParametroMarca.set(
        clave,
        valor
      );
    }
  }


  Logger.log(
    "Cobertura default: " +
    coberturaDefault
  );


  // ==========================================================
  // 4. COBERTURA POR MARCA DESDE MARCAS
  // ==========================================================

  const coberturaMarca =
    new Map();

  const datosMarcas =
    shMarcas.getDataRange()
      .getDisplayValues();

  const hMarca =
    datosMarcas[0].map(
      normalizarHeaderB13_
    );

  const mMarca =
    hMarca.indexOf("MARCA");

  const mCobertura =
    hMarca.indexOf(
      "OBJETIVO_STOCK_MESES"
    );

  const mActiva =
    hMarca.indexOf("ACTIVA");


  for (
    let i = 1;
    i < datosMarcas.length;
    i++
  ) {

    const activa =
      normalizarTextoB13_(
        datosMarcas[i][mActiva]
      );

    if (activa !== "SI") {
      continue;
    }


    const marca =
      normalizarTextoB13_(
        datosMarcas[i][mMarca]
      );

    const cobertura =
      numeroB13_(
        datosMarcas[i][mCobertura]
      );


    if (
      marca &&
      cobertura > 0
    ) {

      coberturaMarca.set(
        marca,
        cobertura
      );
    }
  }


  // ==========================================================
  // 5. LEAD TIME POR PROVEEDOR
  // ==========================================================

  const leadTimeProveedor =
    new Map();

  const datosProv =
    shProveedores.getDataRange()
      .getDisplayValues();

  const hProv =
    datosProv[0].map(
      normalizarHeaderB13_
    );

  const prProveedor =
    hProv.indexOf("PROVEEDOR");

  const prFabricacion =
    hProv.indexOf(
      "DIAS_FABRICACION"
    );

  const prTransito =
    hProv.indexOf(
      "DIAS_TRANSITO"
    );

  const prNacionalizacion =
    hProv.indexOf(
      "DIAS_NACIONALIZACION"
    );

  const prActivo =
    hProv.indexOf("ACTIVO");


  for (
    let i = 1;
    i < datosProv.length;
    i++
  ) {

    const activo =
      normalizarTextoB13_(
        datosProv[i][prActivo]
      );

    if (activo !== "SI") {
      continue;
    }


    const proveedor =
      normalizarTextoB13_(
        datosProv[i][prProveedor]
      );

    if (!proveedor) {
      continue;
    }


    const lead =
      numeroB13_(
        datosProv[i][prFabricacion]
      ) +
      numeroB13_(
        datosProv[i][prTransito]
      ) +
      numeroB13_(
        datosProv[i][prNacionalizacion]
      );


    if (lead > 0) {

      leadTimeProveedor.set(
        proveedor,
        lead
      );
    }
  }


  // ==========================================================
  // 6. PROVEEDOR ÚNICO POR SKU DESDE DETALLE_IMPORTACIONES
  // ==========================================================

  const proveedoresSku =
    new Map();


  if (shDetalle) {

    const datosDetalle =
      shDetalle.getDataRange()
        .getValues();

    const hDetalle =
      datosDetalle[0].map(
        normalizarHeaderB13_
      );

    const dItem =
      hDetalle.indexOf("ITEM");

    const dProveedor =
      hDetalle.indexOf("PROVEEDOR");


    if (
      dItem !== -1 &&
      dProveedor !== -1
    ) {

      for (
        let i = 1;
        i < datosDetalle.length;
        i++
      ) {

        const item =
          normalizarCodigoB13_(
            datosDetalle[i][dItem]
          );

        const proveedor =
          String(
            datosDetalle[i][dProveedor] || ""
          ).trim();

        if (
          !item ||
          !proveedor
        ) {
          continue;
        }


        const sku =
          equivalencias.get(item);

        if (!sku) {
          continue;
        }


        if (
          !proveedoresSku.has(sku)
        ) {
          proveedoresSku.set(
            sku,
            new Set()
          );
        }


        proveedoresSku.get(sku)
          .add(proveedor);
      }
    }
  }


  const proveedorUnicoSku =
    new Map();


  proveedoresSku.forEach(
    function(lista, sku) {

      if (lista.size === 1) {

        proveedorUnicoSku.set(
          sku,
          Array.from(lista)[0]
        );
      }

    }
  );


  Logger.log(
    "SKU con proveedor único: " +
    proveedorUnicoSku.size
  );


  // ==========================================================
  // 7. MODELO_COMPRAS
  // ==========================================================

  const FILA_HEADER = 2;

  const ultimaFila =
    shModelo.getLastRow();

  const ultimaCol =
    shModelo.getLastColumn();

  const cantidadFilas =
    ultimaFila -
    FILA_HEADER;


  const headersModelo =
    shModelo.getRange(
      FILA_HEADER,
      1,
      1,
      ultimaCol
    )
      .getDisplayValues()[0]
      .map(
        normalizarHeaderB13_
      );


  const idx = {

    sku:
      headersModelo.indexOf("SKU"),

    marca:
      headersModelo.indexOf("MARCA"),

    proveedor:
      headersModelo.indexOf("PROVEEDOR"),

    promedio:
      headersModelo.indexOf(
        "PROMEDIO_MENSUAL"
      ),

    stock:
      headersModelo.indexOf(
        "STOCK_TOTAL"
      ),

    pendiente:
      headersModelo.indexOf(
        "PENDIENTE_TOTAL"
      ),

    lead:
      headersModelo.indexOf(
        "LEAD_TIME"
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
      )
  };


  Object.keys(idx)
    .forEach(function(campo) {

      if (idx[campo] === -1) {

        throw new Error(
          "MODELO_COMPRAS: falta " +
          campo
        );
      }

    });


  const datosModelo =
    shModelo.getRange(
      FILA_HEADER + 1,
      1,
      cantidadFilas,
      ultimaCol
    ).getValues();


  let conMarca = 0;
  let sinMarca = 0;

  let conProveedor = 0;
  let conLeadTime = 0;

  let conCobertura = 0;
  let sinConsumo = 0;


  datosModelo.forEach(
    function(fila) {

      const sku =
        normalizarCodigoB13_(
          fila[idx.sku]
        );

      if (!sku) {
        return;
      }


      // ======================================================
      // MARCA
      // ======================================================

      const marca =
        marcaPorSku.get(sku) ||
        String(
          fila[idx.marca] || ""
        ).trim();


      fila[idx.marca] =
        marca;


      if (marca) {
        conMarca++;
      } else {
        sinMarca++;
      }


      // ======================================================
      // PROVEEDOR
      // ======================================================

      const proveedor =
        proveedorUnicoSku.get(
          sku
        ) ||
        String(
          fila[idx.proveedor] || ""
        ).trim();


      fila[idx.proveedor] =
        proveedor;


      if (proveedor) {
        conProveedor++;
      }


      // ======================================================
      // LEAD TIME
      // ======================================================

      let lead = "";

      if (proveedor) {

        const claveProveedor =
          normalizarTextoB13_(
            proveedor
          );


        if (
          leadTimeProveedor.has(
            claveProveedor
          )
        ) {

          lead =
            leadTimeProveedor.get(
              claveProveedor
            );

          conLeadTime++;
        }
      }


      fila[idx.lead] =
        lead;


      // ======================================================
      // COBERTURA OBJETIVO
      // ======================================================

      const claveMarca =
        normalizarTextoB13_(
          marca
        );


      let objetivo =
        coberturaDefault;


      if (
        coberturaMarca.has(
          claveMarca
        )
      ) {

        objetivo =
          coberturaMarca.get(
            claveMarca
          );
      }


      /*
       * PARAMETROS_COMPRAS tiene prioridad
       * sobre MARCAS.
       */
      if (
        coberturaParametroMarca.has(
          claveMarca
        )
      ) {

        objetivo =
          coberturaParametroMarca.get(
            claveMarca
          );
      }


      fila[idx.objetivo] =
        objetivo;


      // ======================================================
      // COBERTURAS
      // ======================================================

      const promedio =
        numeroB13_(
          fila[idx.promedio]
        );


      const stock =
        numeroB13_(
          fila[idx.stock]
        );


      const pendiente =
        numeroB13_(
          fila[idx.pendiente]
        );


      if (
        promedio > 0
      ) {

        fila[idx.actual] =
          stock /
          promedio;


        fila[idx.futura] =
          (
            stock +
            pendiente
          ) /
          promedio;


        conCobertura++;

      } else {

        /*
         * Sin consumo:
         * no interpretamos como cobertura infinita.
         */

        fila[idx.actual] = "";
        fila[idx.futura] = "";

        sinConsumo++;
      }

    }
  );


  // ==========================================================
  // 8. ESCRITURA MASIVA
  // ==========================================================

  shModelo.getRange(
    FILA_HEADER + 1,
    1,
    cantidadFilas,
    ultimaCol
  ).setValues(
    datosModelo
  );


  /*
   * Formatos.
   */

  shModelo.getRange(
    FILA_HEADER + 1,
    idx.lead + 1,
    cantidadFilas,
    1
  ).setNumberFormat(
    "0"
  );


  shModelo.getRange(
    FILA_HEADER + 1,
    idx.objetivo + 1,
    cantidadFilas,
    1
  ).setNumberFormat(
    "0.00"
  );


  shModelo.getRange(
    FILA_HEADER + 1,
    idx.actual + 1,
    cantidadFilas,
    2
  ).setNumberFormat(
    "0.00"
  );


  SpreadsheetApp.flush();


  // ==========================================================
  // 9. RESULTADO
  // ==========================================================

  const resultado = {

    version:
      "0.1.300",

    filasModelo:
      cantidadFilas,

    skuConMarca:
      conMarca,

    skuSinMarca:
      sinMarca,

    skuConProveedor:
      conProveedor,

    skuConLeadTime:
      conLeadTime,

    skuConCobertura:
      conCobertura,

    skuSinConsumo:
      sinConsumo,

    coberturaDefault:
      coberturaDefault,

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
    "Coberturas actualizadas",
    "Sprint B.1.3",
    5
  );


  return resultado;
}


/******************************************************************
 * UTILIDADES B.1.3
 ******************************************************************/

function normalizarHeaderB13_(valor) {

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


function normalizarCodigoB13_(valor) {

  return String(valor || "")
    .trim()
    .toUpperCase();
}


function normalizarTextoB13_(valor) {

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


function numeroB13_(valor) {

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