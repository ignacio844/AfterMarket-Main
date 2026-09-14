/**
 * Lee la hoja PARAMETROS_IMPORTACION
 */
function leerParametrosImportacion_() {

  const sh = SpreadsheetApp
    .getActive()
    .getSheetByName(
      'PARAMETROS_IMPORTACION'
    );

  if (!sh) {
    throw new Error(
      'No existe la hoja PARAMETROS_IMPORTACION.'
    );
  }

  const datos = sh
    .getDataRange()
    .getValues();

  const resultado = {};

  for (let i = 1; i < datos.length; i++) {

    const fila = datos[i];

    const marca = String(fila[0]).trim();

    if (!marca) continue;

    resultado[marca.toUpperCase()] = {

      leadTime:
        Number(fila[1]) || 120,

      fabricacion:
        Number(fila[2]) || 45,

      transito:
        Number(fila[3]) || 55,

      aduana:
        Number(fila[4]) || 15,

      recepcion:
        Number(fila[5]) || 5,

      cobertura:
        Number(fila[6]) || 4

    };

  }

  return resultado;

}


/**
 * Prueba de lectura
 */
function probarParametrosImportacion() {

  const datos =
    leerParametrosImportacion_();

  Logger.log(
    JSON.stringify(
      datos,
      null,
      2
    )
  );

}