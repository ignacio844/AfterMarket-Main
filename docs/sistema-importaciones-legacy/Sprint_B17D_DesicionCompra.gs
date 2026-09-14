/**********************************************************************
 * SII - SPRINT B.1.7-D
 * GESTIÓN OPERATIVA DE DECISIONES DE COMPRA
 *
 * Hoja operativa:
 *   GESTION_COMPRAS_ACTIVA
 *
 * Persistencia:
 *   GESTION_COMPRAS
 *
 * Versión: 0.1.730
 **********************************************************************/

function onOpenB17D() {

  SpreadsheetApp
    .getUi()
    .createMenu("🛒 Gestión Compras")
    .addItem(
      "Gestionar SKU seleccionado",
      "gestionarSkuSeleccionadoB17D"
    )
    .addToUi();
}


/**********************************************************************
 * ABRIR GESTIÓN DEL SKU SELECCIONADO
 **********************************************************************/

function gestionarSkuSeleccionadoB17D() {

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getActiveSheet();

  if (
    sh.getName() !== "GESTION_COMPRAS_ACTIVA"
  ) {

    SpreadsheetApp
      .getUi()
      .alert(
        "Seleccioná una fila de GESTION_COMPRAS_ACTIVA."
      );

    return;
  }

  const fila = sh.getActiveRange().getRow();

  if (fila <= 1) {

    SpreadsheetApp
      .getUi()
      .alert(
        "Seleccioná un SKU de la tabla."
      );

    return;
  }

  const sku =
    String(
      sh.getRange(fila, 1).getDisplayValue()
    ).trim();

  if (!sku) {

    SpreadsheetApp
      .getUi()
      .alert(
        "La fila seleccionada no contiene SKU."
      );

    return;
  }

  const datos =
    obtenerDatosGestionB17D_(sku);

  if (!datos) {

    SpreadsheetApp
      .getUi()
      .alert(
        "No se encontró el SKU " +
        sku +
        " en GESTION_COMPRAS."
      );

    return;
  }

  const html =
    HtmlService
      .createHtmlOutput(
        construirFormularioB17D_(datos)
      )
      .setWidth(520)
      .setHeight(560);

  SpreadsheetApp
    .getUi()
    .showModalDialog(
      html,
      "Gestión de compra - " + sku
    );
}


/**********************************************************************
 * OBTENER DATOS ACTUALES
 **********************************************************************/

function obtenerDatosGestionB17D_(sku) {

  const ss =
    SpreadsheetApp.getActiveSpreadsheet();

  const sh =
    ss.getSheetByName("GESTION_COMPRAS");

  if (!sh) {
    throw new Error(
      "No existe GESTION_COMPRAS"
    );
  }

  const datos =
    sh.getDataRange().getValues();

  const headers =
    datos.shift();

  const idx = {};

  headers.forEach(
    (h, i) => {
      idx[
        String(h).trim().toUpperCase()
      ] = i;
    }
  );

  for (
    let i = 0;
    i < datos.length;
    i++
  ) {

    const skuFila =
      String(
        datos[i][idx["SKU"]] || ""
      ).trim();

    if (skuFila === sku) {

      return {

        sku: sku,

        estado:
          datos[i][
            idx["ESTADO_GESTION"]
          ] || "PENDIENTE",

        cantidad:
          datos[i][
            idx["CANTIDAD_DECIDIDA"]
          ] || "",

        observacion:
          datos[i][
            idx["OBSERVACION"]
          ] || "",

        responsable:
          datos[i][
            idx["RESPONSABLE"]
          ] || "",

        riesgo:
          datos[i][
            idx["RIESGO_ACTUAL"]
          ] || "",

        compraSugerida:
          datos[i][
            idx["COMPRA_SUGERIDA_ACTUAL"]
          ] || ""

      };
    }
  }

  return null;
}


/**********************************************************************
 * FORMULARIO HTML
 **********************************************************************/

function construirFormularioB17D_(d) {

  const esc =
    valor =>
      String(valor == null ? "" : valor)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");

  return `

  <html>

  <head>

    <style>

      body {
        font-family: Arial, sans-serif;
        padding: 18px;
        color: #333;
      }

      .titulo {
        font-size: 20px;
        font-weight: bold;
        margin-bottom: 15px;
      }

      .info {
        background: #f3f6f9;
        padding: 12px;
        margin-bottom: 18px;
        border-radius: 6px;
      }

      label {
        font-weight: bold;
        display: block;
        margin-top: 12px;
        margin-bottom: 4px;
      }

      select,
      input,
      textarea {
        width: 100%;
        box-sizing: border-box;
        padding: 8px;
      }

      textarea {
        height: 80px;
        resize: vertical;
      }

      .botones {
        margin-top: 20px;
        text-align: right;
      }

      button {
        padding: 9px 18px;
        cursor: pointer;
      }

      .guardar {
        background: #1F4E78;
        color: white;
        border: none;
        margin-left: 8px;
      }

    </style>

  </head>

  <body>

    <div class="titulo">
      ${esc(d.sku)}
    </div>

    <div class="info">

      <b>Riesgo:</b>
      ${esc(d.riesgo)}

      <br><br>

      <b>Compra sugerida:</b>
      ${esc(d.compraSugerida)}

    </div>

    <label>
      Estado de gestión
    </label>

    <select id="estado">

      ${opcionB17D_(
        "PENDIENTE",
        d.estado
      )}

      ${opcionB17D_(
        "COMPRAR",
        d.estado
      )}

      ${opcionB17D_(
        "NO COMPRAR",
        d.estado
      )}

      ${opcionB17D_(
        "COTIZAR",
        d.estado
      )}

      ${opcionB17D_(
        "POSTERGAR",
        d.estado
      )}

      ${opcionB17D_(
        "EN ANALISIS",
        d.estado
      )}

    </select>


    <label>
      Cantidad decidida
    </label>

    <input
      id="cantidad"
      type="number"
      min="0"
      step="1"
      value="${esc(d.cantidad)}"
    >


    <label>
      Responsable
    </label>

    <input
      id="responsable"
      type="text"
      value="${esc(d.responsable)}"
    >


    <label>
      Observación
    </label>

    <textarea
      id="observacion"
    >${esc(d.observacion)}</textarea>


    <div class="botones">

      <button
        onclick="google.script.host.close()"
      >
        Cancelar
      </button>

      <button
        class="guardar"
        onclick="guardar()"
      >
        Guardar
      </button>

    </div>


    <script>

      function guardar() {

        const datos = {

          sku:
            ${JSON.stringify(d.sku)},

          estado:
            document
              .getElementById("estado")
              .value,

          cantidad:
            document
              .getElementById("cantidad")
              .value,

          responsable:
            document
              .getElementById("responsable")
              .value,

          observacion:
            document
              .getElementById("observacion")
              .value

        };


        google.script.run

          .withSuccessHandler(
            function() {

              google.script.host.close();

            }
          )

          .withFailureHandler(
            function(error) {

              alert(
                "Error: " +
                error.message
              );

            }
          )

          .guardarDecisionCompraB17D(
            datos
          );

      }

    </script>

  </body>

  </html>

  `;
}


/**********************************************************************
 * OPTION HTML
 **********************************************************************/

function opcionB17D_(
  valor,
  seleccionado
) {

  const sel =
    String(valor).toUpperCase() ===
    String(seleccionado).toUpperCase()
      ? "selected"
      : "";

  return (
    '<option value="' +
    valor +
    '" ' +
    sel +
    '>' +
    valor +
    '</option>'
  );
}


/**********************************************************************
 * GUARDAR DECISIÓN
 **********************************************************************/

function guardarDecisionCompraB17D(datos) {

  const ss =
    SpreadsheetApp.getActiveSpreadsheet();

  const sh =
    ss.getSheetByName(
      "GESTION_COMPRAS"
    );

  if (!sh) {

    throw new Error(
      "No existe GESTION_COMPRAS"
    );

  }

  const valores =
    sh.getDataRange().getValues();

  const headers =
    valores[0];

  const idx = {};

  headers.forEach(
    (h, i) => {

      idx[
        String(h)
          .trim()
          .toUpperCase()
      ] = i;

    }
  );

  const sku =
    String(
      datos.sku || ""
    ).trim();

  if (!sku) {

    throw new Error(
      "SKU vacío."
    );

  }

  let filaEncontrada = 0;

  for (
    let i = 1;
    i < valores.length;
    i++
  ) {

    if (
      String(
        valores[i][idx["SKU"]] || ""
      ).trim() === sku
    ) {

      filaEncontrada =
        i + 1;

      break;
    }
  }

  if (!filaEncontrada) {

    throw new Error(
      "No se encontró el SKU " +
      sku +
      " en GESTION_COMPRAS."
    );

  }


  const estado =
    String(
      datos.estado || "PENDIENTE"
    )
      .trim()
      .toUpperCase();


  let cantidad = "";

  if (
    datos.cantidad !== "" &&
    datos.cantidad !== null &&
    datos.cantidad !== undefined
  ) {

    cantidad =
      Number(datos.cantidad);

    if (
      isNaN(cantidad) ||
      cantidad < 0
    ) {

      throw new Error(
        "Cantidad decidida inválida."
      );

    }

  }


  const ahora = new Date();


  sh.getRange(
    filaEncontrada,
    idx["ESTADO_GESTION"] + 1
  ).setValue(
    estado
  );


  sh.getRange(
    filaEncontrada,
    idx["CANTIDAD_DECIDIDA"] + 1
  ).setValue(
    cantidad
  );


  sh.getRange(
    filaEncontrada,
    idx["OBSERVACION"] + 1
  ).setValue(
    datos.observacion || ""
  );


  sh.getRange(
    filaEncontrada,
    idx["RESPONSABLE"] + 1
  ).setValue(
    datos.responsable || ""
  );


  sh.getRange(
    filaEncontrada,
    idx["FECHA_DECISION"] + 1
  ).setValue(
    ahora
  );


  sh.getRange(
    filaEncontrada,
    idx["ULTIMA_ACTUALIZACION"] + 1
  ).setValue(
    ahora
  );


  /*
   * Actualizamos también la fila visible.
   * Esto NO reemplaza la persistencia.
   * Sólo evita tener que regenerar la vista
   * después de cada decisión.
   */

  actualizarFilaVistaB17D_(
    sku,
    estado,
    cantidad,
    datos.responsable || "",
    datos.observacion || "",
    ahora
  );


  Logger.log(
    JSON.stringify(
      {
        version: "0.1.730",
        sku: sku,
        estado: estado,
        cantidadDecidida: cantidad,
        filaGestion: filaEncontrada
      },
      null,
      2
    )
  );

  return true;
}


/**********************************************************************
 * ACTUALIZAR FILA EN LA VISTA
 **********************************************************************/

function actualizarFilaVistaB17D_(
  sku,
  estado,
  cantidad,
  responsable,
  observacion,
  fecha
) {

  const ss =
    SpreadsheetApp.getActiveSpreadsheet();

  const sh =
    ss.getSheetByName(
      "GESTION_COMPRAS_ACTIVA"
    );

  if (!sh) return;

  const datos =
    sh.getDataRange().getValues();

  if (datos.length < 2) return;

  const headers =
    datos[0];

  const idx = {};

  headers.forEach(
    (h, i) => {

      idx[
        String(h)
          .trim()
          .toUpperCase()
      ] = i;

    }
  );


  for (
    let i = 1;
    i < datos.length;
    i++
  ) {

    if (
      String(
        datos[i][idx["SKU"]] || ""
      ).trim() === sku
    ) {

      const fila =
        i + 1;


      sh.getRange(
        fila,
        idx["ESTADO_GESTION"] + 1
      ).setValue(
        estado
      );


      sh.getRange(
        fila,
        idx["CANTIDAD_DECIDIDA"] + 1
      ).setValue(
        cantidad
      );


      sh.getRange(
        fila,
        idx["RESPONSABLE"] + 1
      ).setValue(
        responsable
      );


      sh.getRange(
        fila,
        idx["OBSERVACION"] + 1
      ).setValue(
        observacion
      );


      sh.getRange(
        fila,
        idx["FECHA_DECISION"] + 1
      ).setValue(
        fecha
      );

      return;
    }
  }
}