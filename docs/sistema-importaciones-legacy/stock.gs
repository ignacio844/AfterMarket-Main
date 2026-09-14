/*******************************************************
 * SII V2.1 - IMPORTACIÓN DE STOCK BAM
 *
 * Cada archivo corresponde a un único depósito:
 * - WARNES
 * - ESCOBAR
 *
 * Al importar:
 * - reemplaza solamente el depósito importado;
 * - conserva intacto el otro depósito.
 *******************************************************/


/**
 * Abre la ventana para seleccionar el Excel de BAM.
 */
function mostrarImportadorStock() {
  const html = HtmlService
    .createHtmlOutputFromFile('ImportarStock')
    .setWidth(500)
    .setHeight(320);

  SpreadsheetApp.getUi()
    .showModalDialog(
      html,
      'Importar stock BAM'
    );
}


/**
 * Recibe los registros procesados desde el HTML.
 *
 * Estructura esperada:
 * [
 *   [SKU, MARCA, CODIGO_VIEJO, STOCK, DEPOSITO],
 *   ...
 * ]
 *
 * La importación reemplaza únicamente las filas
 * del depósito contenido en el archivo.
 */
function guardarStockBam(registros, nombreArchivo) {
  if (
    !Array.isArray(registros) ||
    registros.length === 0
  ) {
    throw new Error(
      'No se recibieron registros de stock.'
    );
  }

  const ss = SpreadsheetApp.getActive();

  let sh = ss.getSheetByName(
    SII_CFG.SHEETS.STOCK
  );

  if (!sh) {
    sh = ss.insertSheet(
      SII_CFG.SHEETS.STOCK
    );
  }

  const fechaImportacion = new Date();


  /*****************************************************
   * VALIDACIÓN DEL DEPÓSITO DEL ARCHIVO
   *****************************************************/

  const depositosArchivo = [
    ...new Set(
      registros
        .filter(fila => fila)
        .map(fila =>
          normalizarDepositoStock_(
            fila[4]
          )
        )
        .filter(Boolean)
    )
  ];

  if (depositosArchivo.length === 0) {
    throw new Error(
      'No se encontró el depósito en los registros recibidos.'
    );
  }

  if (depositosArchivo.length > 1) {
    throw new Error(
      'El archivo contiene más de un depósito: ' +
      depositosArchivo.join(', ')
    );
  }

  const depositoImportado =
    depositosArchivo[0];

  if (
    depositoImportado !== 'WARNES' &&
    depositoImportado !== 'ESCOBAR'
  ) {
    throw new Error(
      'Depósito no reconocido: ' +
      depositoImportado
    );
  }


  /*****************************************************
   * AGRUPAR NUEVOS REGISTROS POR SKU + DEPÓSITO
   *****************************************************/

  const nuevosAgrupados = new Map();

  registros.forEach(fila => {
    if (!fila) {
      return;
    }

    const sku = limpiarTexto_(
      fila[0]
    );

    if (!sku) {
      return;
    }

    const marca = limpiarTexto_(
      fila[1]
    );

    const codigoViejo = limpiarTexto_(
      fila[2]
    );

    const cantidad = convertirNumeroStock_(
      fila[3]
    );

    const deposito = normalizarDepositoStock_(
      fila[4]
    );

    if (deposito !== depositoImportado) {
      throw new Error(
        'Se encontró una fila de otro depósito para el SKU ' +
        sku +
        ': ' +
        deposito
      );
    }

    const clave =
      normalizarClaveStock_(sku) +
      '|' +
      deposito;

    if (!nuevosAgrupados.has(clave)) {
      nuevosAgrupados.set(clave, {
        sku: sku,
        marca: marca,
        codigoViejo: codigoViejo,
        stock: 0,
        deposito: deposito,
        fechaImportacion: fechaImportacion,
        archivoOrigen: nombreArchivo || ''
      });
    }

    const registro =
      nuevosAgrupados.get(clave);

    registro.stock += cantidad;

    if (!registro.marca && marca) {
      registro.marca = marca;
    }

    if (
      !registro.codigoViejo &&
      codigoViejo
    ) {
      registro.codigoViejo =
        codigoViejo;
    }
  });

  if (nuevosAgrupados.size === 0) {
    throw new Error(
      'El archivo no contiene SKU válidos.'
    );
  }


  /*****************************************************
   * LEER Y CONSERVAR EL OTRO DEPÓSITO
   *****************************************************/

  const registrosConservados = [];

  const ultimaFila = sh.getLastRow();
  const ultimaColumna = sh.getLastColumn();

  if (
    ultimaFila >= 2 &&
    ultimaColumna >= 5
  ) {
    const datosExistentes = sh
      .getRange(
        2,
        1,
        ultimaFila - 1,
        Math.max(ultimaColumna, 7)
      )
      .getValues();

    datosExistentes.forEach(fila => {
      const sku = limpiarTexto_(
        fila[0]
      );

      if (!sku) {
        return;
      }

      const depositoExistente =
        normalizarDepositoStock_(
          fila[4]
        );

      /*
       * Se eliminan únicamente las filas anteriores
       * del depósito que se está importando.
       */
      if (
        depositoExistente ===
        depositoImportado
      ) {
        return;
      }

      /*
       * Se conservan Warnes, Escobar u otros depósitos
       * que no correspondan al archivo actual.
       */
      registrosConservados.push({
        sku: sku,
        marca: limpiarTexto_(fila[1]),
        codigoViejo: limpiarTexto_(fila[2]),
        stock: convertirNumeroStock_(fila[3]),
        deposito: depositoExistente,
        fechaImportacion: fila[5] || '',
        archivoOrigen: limpiarTexto_(fila[6])
      });
    });
  }


  /*****************************************************
   * UNIR CONSERVADOS + NUEVO DEPÓSITO
   *****************************************************/

  const registrosFinales = [
    ...registrosConservados,
    ...nuevosAgrupados.values()
  ];

  registrosFinales.sort((a, b) => {
    const porSku = a.sku.localeCompare(
      b.sku,
      'es',
      {
        numeric: true,
        sensitivity: 'base'
      }
    );

    if (porSku !== 0) {
      return porSku;
    }

    return a.deposito.localeCompare(
      b.deposito,
      'es',
      {
        sensitivity: 'base'
      }
    );
  });

  const salida = registrosFinales.map(
    reg => [
      reg.sku,
      reg.marca,
      reg.codigoViejo,
      reg.stock,
      reg.deposito,
      reg.fechaImportacion,
      reg.archivoOrigen
    ]
  );


  /*****************************************************
   * RECONSTRUIR LA HOJA STOCK
   *****************************************************/

  const encabezados = [[
    'SKU',
    'MARCA',
    'CODIGO_VIEJO',
    'STOCK',
    'DEPOSITO',
    'FECHA_IMPORTACION',
    'ARCHIVO_ORIGEN'
  ]];

  const filtroAnterior = sh.getFilter();

  if (filtroAnterior) {
    filtroAnterior.remove();
  }

  /*
   * Se limpia para reconstruirla, pero la salida ya
   * contiene el depósito anterior conservado.
   */
  sh.clearContents();
  sh.clearFormats();

  sh.getRange(
    1,
    1,
    1,
    encabezados[0].length
  ).setValues(encabezados);

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

  sh.getRange(
    2,
    4,
    salida.length,
    1
  ).setNumberFormat('#,##0.00');

  sh.getRange(
    2,
    6,
    salida.length,
    1
  ).setNumberFormat(
    'dd/MM/yyyy HH:mm'
  );

  sh.getRange(
    1,
    1,
    salida.length + 1,
    encabezados[0].length
  ).createFilter();

  sh.autoResizeColumns(
    1,
    encabezados[0].length
  );


  /*****************************************************
   * CONTROL DE IMPORTACIÓN
   *****************************************************/

  registrarControlImportacionStock_(
    ss,
    {
      deposito: depositoImportado,
      fechaImportacion: fechaImportacion,
      archivo: nombreArchivo || '',
      registros: nuevosAgrupados.size,
      usuario:
        Session.getActiveUser().getEmail() ||
        'USUARIO_SIN_EMAIL'
    }
  );


  /*****************************************************
   * RESULTADO
   *****************************************************/

  return {
    deposito: depositoImportado,
    registros: nuevosAgrupados.size,
    registrosTotales: salida.length,
    archivo: nombreArchivo || '',
    fecha: Utilities.formatDate(
      fechaImportacion,
      Session.getScriptTimeZone(),
      'dd/MM/yyyy HH:mm'
    )
  };
}


/**
 * Registra o actualiza el control de importaciones.
 */
function registrarControlImportacionStock_(
  ss,
  datos
) {
  const nombreHoja =
    'CONTROL_IMPORTACIONES_STOCK';

  let sh = ss.getSheetByName(
    nombreHoja
  );

  if (!sh) {
    sh = ss.insertSheet(nombreHoja);

    sh.getRange(
      1,
      1,
      1,
      5
    ).setValues([[
      'DEPOSITO',
      'ULTIMA_IMPORTACION',
      'ARCHIVO',
      'REGISTROS',
      'USUARIO'
    ]]);

    formatearEncabezado_(sh);
    sh.setFrozenRows(1);
  }

  const ultimaFila = sh.getLastRow();

  let filaDeposito = 0;

  if (ultimaFila >= 2) {
    const depositos = sh
      .getRange(
        2,
        1,
        ultimaFila - 1,
        1
      )
      .getDisplayValues();

    for (
      let i = 0;
      i < depositos.length;
      i++
    ) {
      if (
        normalizarDepositoStock_(
          depositos[i][0]
        ) === datos.deposito
      ) {
        filaDeposito = i + 2;
        break;
      }
    }
  }

  const fila = [[
    datos.deposito,
    datos.fechaImportacion,
    datos.archivo,
    datos.registros,
    datos.usuario
  ]];

  if (filaDeposito > 0) {
    sh.getRange(
      filaDeposito,
      1,
      1,
      fila[0].length
    ).setValues(fila);

  } else {
    sh.getRange(
      sh.getLastRow() + 1,
      1,
      1,
      fila[0].length
    ).setValues(fila);
  }

  sh.getRange(
    2,
    2,
    Math.max(sh.getLastRow() - 1, 1),
    1
  ).setNumberFormat(
    'dd/MM/yyyy HH:mm'
  );

  sh.autoResizeColumns(1, 5);
}


/**
 * Normaliza los depósitos admitidos.
 */
function normalizarDepositoStock_(valor) {
  const deposito = limpiarTexto_(valor)
    .normalize('NFD')
    .replace(
      /[\u0300-\u036f]/g,
      ''
    )
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim();

  if (deposito.includes('WARNES')) {
    return 'WARNES';
  }

  if (deposito.includes('ESCOBAR')) {
    return 'ESCOBAR';
  }

  return deposito;
}


/**
 * Normaliza el SKU para crear claves.
 */
function normalizarClaveStock_(valor) {
  return limpiarTexto_(valor)
    .normalize('NFD')
    .replace(
      /[\u0300-\u036f]/g,
      ''
    )
    .toUpperCase()
    .replace(/\s+/g, '')
    .trim();
}


/**
 * Convierte la cantidad proveniente del Excel.
 */
function convertirNumeroStock_(valor) {
  if (typeof valor === 'number') {
    return isNaN(valor)
      ? 0
      : valor;
  }

  let texto = String(
    valor === null ||
    valor === undefined
      ? ''
      : valor
  ).trim();

  if (!texto) {
    return 0;
  }

  texto = texto.replace(
    /[^\d,.-]/g,
    ''
  );

  if (
    texto.includes(',') &&
    texto.includes('.')
  ) {
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

  } else if (texto.includes(',')) {
    texto = texto.replace(',', '.');
  }

  const numero = Number(texto);

  return isNaN(numero)
    ? 0
    : numero;
}