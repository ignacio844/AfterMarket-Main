/**************************************************************
 * SII V6.0.101
 * COMPATIBILIDAD DE FUNCIONES COMUNES
 *
 * Restablece auxiliares utilizados por los módulos refactorizados:
 * - ficha_sku.gs
 * - ficha_stock.gs
 * - ficha_consumo.gs
 * - ficha_importaciones.gs
 *
 * Funciones:
 * - limpiarTexto_()
 * - numero_()
 * - convertirFecha_()
 **************************************************************/


/**
 * Convierte cualquier valor en texto limpio.
 */
function limpiarTexto_(valor) {
  return String(
    valor === null ||
    valor === undefined
      ? ''
      : valor
  ).trim();
}


/**
 * Convierte números con formato local o internacional.
 *
 * Ejemplos admitidos:
 * - 1234.56
 * - 1.234,56
 * - 1,234.56
 * - $ 1.234,56
 */
function numero_(valor) {
  if (typeof valor === 'number') {
    return Number.isFinite(valor)
      ? valor
      : 0;
  }

  let texto =
    limpiarTexto_(valor);

  if (!texto) {
    return 0;
  }

  /*
   * Conserva dígitos, signo y separadores.
   */
  texto = texto.replace(
    /[^\d,.-]/g,
    ''
  );

  if (
    texto.includes(',') &&
    texto.includes('.')
  ) {
    /*
     * El último separador se interpreta
     * como separador decimal.
     */
    if (
      texto.lastIndexOf(',') >
      texto.lastIndexOf('.')
    ) {
      texto = texto
        .replace(/\./g, '')
        .replace(',', '.');

    } else {
      texto =
        texto.replace(/,/g, '');
    }

  } else if (
    texto.includes(',')
  ) {
    texto =
      texto.replace(',', '.');
  }

  const resultado =
    Number(texto);

  return Number.isFinite(resultado)
    ? resultado
    : 0;
}


/**
 * Convierte fechas provenientes de Sheets,
 * texto dd/MM/yyyy, yyyy-MM-dd o valores compatibles.
 */
function convertirFecha_(valor) {
  if (
    valor instanceof Date &&
    !isNaN(valor.getTime())
  ) {
    return new Date(valor);
  }

  const texto =
    limpiarTexto_(valor);

  if (!texto) {
    return null;
  }

  /*
   * dd/MM/yyyy o dd-MM-yyyy.
   */
  let match = texto.match(
    /^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/
  );

  if (match) {
    const fecha = new Date(
      Number(match[3]),
      Number(match[2]) - 1,
      Number(match[1])
    );

    return isNaN(fecha.getTime())
      ? null
      : fecha;
  }

  /*
   * yyyy-MM-dd o yyyy/MM/dd.
   */
  match = texto.match(
    /^(\d{4})[\/-](\d{1,2})[\/-](\d{1,2})$/
  );

  if (match) {
    const fecha = new Date(
      Number(match[1]),
      Number(match[2]) - 1,
      Number(match[3])
    );

    return isNaN(fecha.getTime())
      ? null
      : fecha;
  }

  const fecha =
    new Date(texto);

  return isNaN(fecha.getTime())
    ? null
    : fecha;
}


/**
 * Prueba rápida.
 */
function probarCompatibilidadV6() {
  const resultado = {
    texto:
      limpiarTexto_(
        '  PRUEBA  '
      ),

    numeroArgentino:
      numero_(
        '$ 1.234,56'
      ),

    numeroInternacional:
      numero_(
        '1,234.56'
      ),

    fecha:
      convertirFecha_(
        '28/07/2026'
      )
  };

  Logger.log(
    JSON.stringify(
      resultado,
      null,
      2
    )
  );

  SpreadsheetApp
    .getActive()
    .toast(
      'Funciones de compatibilidad disponibles.',
      'SII V6',
      4
    );

  return resultado;
}
