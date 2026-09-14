/******************************************************************
 * SII - DIAGNÓSTICO MARCAS SIN CONFIGURAR
 * Sprint B.1.9-A.1
 *
 * Objetivo:
 *   Identificar los SKU cuya MARCA no existe en CONFIG_MARCAS_COMPRA.
 *
 * Salida:
 *   Hoja DIAG_MARCAS_SIN_CONFIG
 *
 * Muestra por marca:
 *   - Cantidad de SKU
 *   - Promedio mensual total
 *   - Stock total
 *   - Pendiente total
 *   - Compra potencial si fuera NACIONAL (1,5 meses)
 *   - Compra potencial si fuera IMPORTADO (6 meses)
 *   - Hasta 5 SKU de ejemplo
 ******************************************************************/

const SII_DIAG_MARCAS_B19A1 = {
  VERSION: 'B.1.9-A.1',
  HOJA_MODELO: 'MODELO_COMPRAS',
  HOJA_CONFIG: 'CONFIG_MARCAS_COMPRA',
  HOJA_SALIDA: 'DIAG_MARCAS_SIN_CONFIG'
};


function crearDiagnosticoMarcasSinConfig() {

  const inicio =
    Date.now();

  const ss =
    SpreadsheetApp.getActiveSpreadsheet();

  const shModelo =
    ss.getSheetByName(
      SII_DIAG_MARCAS_B19A1.HOJA_MODELO
    );

  const shConfig =
    ss.getSheetByName(
      SII_DIAG_MARCAS_B19A1.HOJA_CONFIG
    );

  if (!shModelo) {
    throw new Error(
      'No existe la hoja MODELO_COMPRAS.'
    );
  }

  if (
    !shConfig ||
    shConfig.getLastRow() < 2
  ) {
    throw new Error(
      'CONFIG_MARCAS_COMPRA no existe o está vacía.'
    );
  }

  const marcasConfiguradas =
    leerMarcasConfiguradasDiag_(
      shConfig
    );

  const filaHeader =
    detectarFilaHeaderDiag_(
      shModelo
    );

  const ultimaFila =
    shModelo.getLastRow();

  const ultimaColumna =
    shModelo.getLastColumn();

  const headers =
    shModelo.getRange(
      filaHeader,
      1,
      1,
      ultimaColumna
    )
    .getDisplayValues()[0]
    .map(
      normalizarDiag_
    );

  const idx = {};

  headers.forEach(
    function(h, i) {
      idx[h] = i;
    }
  );

  const cSku =
    buscarDiag_(
      idx,
      ['SKU']
    );

  const cMarca =
    buscarDiag_(
      idx,
      ['MARCA']
    );

  const cPromedio =
    buscarDiag_(
      idx,
      ['PROMEDIO_MENSUAL']
    );

  const cStock =
    buscarDiag_(
      idx,
      ['STOCK_TOTAL']
    );

  const cPendiente =
    buscarDiag_(
      idx,
      [
        'PENDIENTE_TOTAL',
        'PENDIENTE_RECIBIR'
      ]
    );

  if (
    cSku < 0 ||
    cMarca < 0 ||
    cPromedio < 0 ||
    cStock < 0 ||
    cPendiente < 0
  ) {
    throw new Error(
      'MODELO_COMPRAS no contiene SKU, MARCA, PROMEDIO_MENSUAL, STOCK_TOTAL o PENDIENTE_TOTAL.'
    );
  }

  if (
    ultimaFila <=
    filaHeader
  ) {
    throw new Error(
      'MODELO_COMPRAS no contiene datos.'
    );
  }

  const datos =
    shModelo.getRange(
      filaHeader + 1,
      1,
      ultimaFila - filaHeader,
      ultimaColumna
    )
    .getValues();

  const grupos = {};

  let totalSkuSinConfig =
    0;

  datos.forEach(
    function(fila) {

      const sku =
        String(
          fila[cSku] || ''
        ).trim();

      if (!sku) {
        return;
      }

      const marcaOriginal =
        String(
          fila[cMarca] || ''
        ).trim();

      const marcaClave =
        claveDiag_(
          marcaOriginal
        );

      if (
        marcasConfiguradas.has(
          marcaClave
        )
      ) {
        return;
      }

      totalSkuSinConfig++;

      const promedio =
        numeroDiag_(
          fila[cPromedio]
        );

      const stock =
        numeroDiag_(
          fila[cStock]
        );

      const pendiente =
        numeroDiag_(
          fila[cPendiente]
        );

      if (
        !grupos[marcaClave]
      ) {

        grupos[marcaClave] = {
          marca:
            marcaOriginal ||
            'SIN MARCA',

          sku:
            0,

          promedio:
            0,

          stock:
            0,

          pendiente:
            0,

          compraNacional:
            0,

          compraImportado:
            0,

          ejemplos:
            []
        };
      }

      const g =
        grupos[marcaClave];

      g.sku++;

      g.promedio +=
        promedio;

      g.stock +=
        stock;

      g.pendiente +=
        pendiente;

      g.compraNacional +=
        Math.max(
          0,
          Math.ceil(
            promedio *
            1.5 -
            stock -
            pendiente
          )
        );

      g.compraImportado +=
        Math.max(
          0,
          Math.ceil(
            promedio *
            6 -
            stock -
            pendiente
          )
        );

      if (
        g.ejemplos.length <
        5
      ) {
        g.ejemplos.push(
          sku
        );
      }
    }
  );

  const salida =
    Object.values(
      grupos
    )
    .sort(
      function(a, b) {

        if (
          b.sku !==
          a.sku
        ) {
          return (
            b.sku -
            a.sku
          );
        }

        return a.marca.localeCompare(
          b.marca,
          'es'
        );
      }
    );

  let shSalida =
    ss.getSheetByName(
      SII_DIAG_MARCAS_B19A1.HOJA_SALIDA
    );

  if (!shSalida) {

    shSalida =
      ss.insertSheet(
        SII_DIAG_MARCAS_B19A1.HOJA_SALIDA
      );

  } else {

    shSalida.clear();
  }

  const encabezados = [[
    'MARCA SIN CONFIGURAR',
    'CANTIDAD SKU',
    'PROMEDIO MENSUAL TOTAL',
    'STOCK TOTAL',
    'PENDIENTE TOTAL',
    'COMPRA POTENCIAL NACIONAL 1,5 M',
    'COMPRA POTENCIAL IMPORTADO 6 M',
    'SKU EJEMPLO 1',
    'SKU EJEMPLO 2',
    'SKU EJEMPLO 3',
    'SKU EJEMPLO 4',
    'SKU EJEMPLO 5'
  ]];

  shSalida.getRange(
    1,
    1,
    1,
    encabezados[0].length
  )
  .setValues(
    encabezados
  )
  .setBackground(
    '#123d6a'
  )
  .setFontColor(
    'white'
  )
  .setFontWeight(
    'bold'
  );

  if (
    salida.length >
    0
  ) {

    const filas =
      salida.map(
        function(g) {

          return [
            g.marca,
            g.sku,
            Math.round(
              g.promedio
            ),
            Math.round(
              g.stock
            ),
            Math.round(
              g.pendiente
            ),
            Math.round(
              g.compraNacional
            ),
            Math.round(
              g.compraImportado
            ),
            g.ejemplos[0] || '',
            g.ejemplos[1] || '',
            g.ejemplos[2] || '',
            g.ejemplos[3] || '',
            g.ejemplos[4] || ''
          ];
        }
      );

    shSalida.getRange(
      2,
      1,
      filas.length,
      encabezados[0].length
    )
    .setValues(
      filas
    );

    shSalida.getRange(
      2,
      2,
      filas.length,
      6
    )
    .setNumberFormat(
      '#,##0'
    );
  }

  shSalida.setFrozenRows(
    1
  );

  shSalida.autoResizeColumns(
    1,
    encabezados[0].length
  );

  /*
   * Resumen arriba de la hoja mediante nota.
   */
  shSalida.getRange(
    'A1'
  ).setNote(
    'Versión ' +
    SII_DIAG_MARCAS_B19A1.VERSION +
    '\nSKU sin configurar: ' +
    totalSkuSinConfig +
    '\nMarcas sin configurar: ' +
    salida.length +
    '\nGenerado: ' +
    Utilities.formatDate(
      new Date(),
      Session.getScriptTimeZone(),
      'dd/MM/yyyy HH:mm'
    )
  );

  const resultado = {
    version:
      SII_DIAG_MARCAS_B19A1.VERSION,

    skuSinConfig:
      totalSkuSinConfig,

    marcasSinConfig:
      salida.length,

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
    totalSkuSinConfig +
      ' SKU agrupados en ' +
      salida.length +
      ' marcas sin configurar.',
    'Diagnóstico B.1.9-A.1',
    8
  );

  return resultado;
}


function leerMarcasConfiguradasDiag_(
  sh
) {

  const datos =
    sh.getDataRange()
      .getDisplayValues();

  const headers =
    datos[0]
      .map(
        normalizarDiag_
      );

  const idx = {};

  headers.forEach(
    function(h, i) {
      idx[h] = i;
    }
  );

  const cMarca =
    buscarDiag_(
      idx,
      ['MARCA']
    );

  if (
    cMarca < 0
  ) {
    throw new Error(
      'CONFIG_MARCAS_COMPRA no contiene la columna MARCA.'
    );
  }

  const marcas =
    new Set();

  for (
    let f = 1;
    f < datos.length;
    f++
  ) {

    const marca =
      claveDiag_(
        datos[f][
          cMarca
        ]
      );

    if (marca) {
      marcas.add(
        marca
      );
    }
  }

  return marcas;
}


function detectarFilaHeaderDiag_(
  sh
) {

  const maxFilas =
    Math.min(
      5,
      sh.getLastRow()
    );

  const datos =
    sh.getRange(
      1,
      1,
      maxFilas,
      sh.getLastColumn()
    )
    .getDisplayValues();

  for (
    let f = 0;
    f < datos.length;
    f++
  ) {

    const headers =
      datos[f]
        .map(
          normalizarDiag_
        );

    if (
      headers.includes(
        'SKU'
      ) &&
      headers.includes(
        'MARCA'
      )
    ) {
      return f + 1;
    }
  }

  throw new Error(
    'No se encontró la fila de encabezados en MODELO_COMPRAS.'
  );
}


function buscarDiag_(
  idx,
  nombres
) {

  for (
    const nombre
    of nombres
  ) {

    if (
      Object.prototype
        .hasOwnProperty
        .call(
          idx,
          nombre
        )
    ) {
      return idx[nombre];
    }
  }

  return -1;
}


function normalizarDiag_(
  valor
) {

  return String(
    valor || ''
  )
  .trim()
  .toUpperCase()
  .normalize(
    'NFD'
  )
  .replace(
    /[\u0300-\u036f]/g,
    ''
  )
  .replace(
    /[^A-Z0-9]+/g,
    '_'
  )
  .replace(
    /^_+|_+$/g,
    ''
  );
}


function claveDiag_(
  valor
) {

  return String(
    valor || ''
  )
  .trim()
  .toUpperCase();
}


function numeroDiag_(
  valor
) {

  if (
    typeof valor ===
    'number'
  ) {

    return isFinite(
      valor
    )
      ? valor
      : 0;
  }

  let texto =
    String(
      valor || ''
    )
    .trim()
    .replace(
      /\s/g,
      ''
    );

  if (!texto) {
    return 0;
  }

  if (
    texto.includes(',') &&
    texto.includes('.')
  ) {

    if (
      texto.lastIndexOf(',') >
      texto.lastIndexOf('.')
    ) {

      texto =
        texto
          .replace(
            /\./g,
            ''
          )
          .replace(
            ',',
            '.'
          );

    } else {

      texto =
        texto.replace(
          /,/g,
          ''
        );
    }

  } else if (
    texto.includes(',')
  ) {

    texto =
      texto.replace(
        ',',
        '.'
      );
  }

  const n =
    Number(
      texto
    );

  return isFinite(
    n
  )
    ? n
    : 0;
}
