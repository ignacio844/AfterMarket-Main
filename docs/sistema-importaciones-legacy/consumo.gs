/*******************************************************
 * SII V2 - IMPORTACIÓN DE CONSUMO
 *******************************************************/


/**
 * Abre el selector del archivo de consumo.
 */
function mostrarImportadorConsumo() {
  const html = HtmlService
    .createHtmlOutputFromFile('ImportarConsumo')
    .setWidth(500)
    .setHeight(330);

  SpreadsheetApp.getUi().showModalDialog(
    html,
    'Importar consumo del facturador'
  );
}


/**
 * Recibe los datos leídos desde el Excel y reemplaza VENTAS.
 *
 * registros:
 * [
 *   [SKU, CONSUMO_TOTAL, MESES, PROMEDIO_MENSUAL],
 *   ...
 * ]
 */
function guardarConsumoFacturador(registros, nombreArchivo) {
  if (!Array.isArray(registros) || registros.length === 0) {
    throw new Error('No se recibieron registros de consumo.');
  }

  const ss = SpreadsheetApp.getActive();

  let sh = ss.getSheetByName(SII_CFG.SHEETS.VENTAS);

  if (!sh) {
    sh = ss.insertSheet(SII_CFG.SHEETS.VENTAS);
  }

  const fechaImportacion = new Date();

  const salida = registros
    .filter(fila => fila && limpiarTexto_(fila[0]))
    .map(fila => {
      const sku = limpiarTexto_(fila[0]);
      const consumo = convertirNumeroConsumo_(fila[1]);
      const meses = convertirNumeroConsumo_(fila[2]);

      const promedio = meses > 0
        ? consumo / meses
        : 0;

      return [
        sku,
        consumo,
        meses,
        promedio,
        nombreArchivo || '',
        fechaImportacion
      ];
    });

  if (salida.length === 0) {
    throw new Error(
      'El archivo no contiene registros válidos de consumo.'
    );
  }

  const encabezados = [[
    'SKU',
    'CONSUMO_TOTAL',
    'MESES',
    'PROMEDIO_MENSUAL',
    'ARCHIVO_ORIGEN',
    'FECHA_IMPORTACION'
  ]];

  sh.clearContents();
  sh.clearFormats();

  sh.getRange(1, 1, 1, encabezados[0].length)
    .setValues(encabezados);

  const tamanoBloque = 5000;

  for (
    let inicio = 0;
    inicio < salida.length;
    inicio += tamanoBloque
  ) {
    const bloque = salida.slice(
      inicio,
      inicio + tamanoBloque
    );

    sh.getRange(
      inicio + 2,
      1,
      bloque.length,
      bloque[0].length
    ).setValues(bloque);
  }

  formatearEncabezado_(sh);
  sh.setFrozenRows(1);

  sh.getRange(2, 2, salida.length, 1)
    .setNumberFormat('#,##0.00');

  sh.getRange(2, 3, salida.length, 1)
    .setNumberFormat('0');

  sh.getRange(2, 4, salida.length, 1)
    .setNumberFormat('#,##0.00');

  sh.getRange(2, 6, salida.length, 1)
    .setNumberFormat('dd/MM/yyyy HH:mm');

  sh.autoResizeColumns(1, encabezados[0].length);

  return {
    registros: salida.length,
    archivo: nombreArchivo || '',
    fecha: Utilities.formatDate(
      fechaImportacion,
      Session.getScriptTimeZone(),
      'dd/MM/yyyy HH:mm'
    )
  };
}


function convertirNumeroConsumo_(valor) {
  if (typeof valor === 'number') {
    return isNaN(valor) ? 0 : valor;
  }

  let texto = String(
    valor === null || valor === undefined
      ? ''
      : valor
  ).trim();

  if (!texto) return 0;

  texto = texto.replace(/[^\d,.-]/g, '');

  if (texto.includes(',') && texto.includes('.')) {
    if (texto.lastIndexOf(',') > texto.lastIndexOf('.')) {
      texto = texto
        .replace(/\./g, '')
        .replace(',', '.');
    } else {
      texto = texto.replace(/,/g, '');
    }
  } else if (texto.includes(',')) {
    texto = texto.replace(',', '.');
  }

  const numero = Number(texto);

  return isNaN(numero) ? 0 : numero;
}