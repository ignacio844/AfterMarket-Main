/**************************************************************
 * SII V6.0.002
 * IMPORTADOR DE VENTAS - NUEVO FORMATO MENSUAL
 * Integración B.1.9-B.1.3 - lectura desde Google Drive
 *
 * Archivo esperado:
 * - Código
 * - Cod_BAM
 * - Descripción
 * - Meses: Jul_2025, Total_Jul_2025, ...
 * - Total_Unidades_Netas
 * - Total_Facturado_Neto_S_IVA
 * - DTM, IMP, JNM, NLI, NLD
 *
 * Hoja destino:
 * - VENTAS
 *
 * Requisito:
 * - Servicio avanzado de Drive activado.
 *
 * Funciones públicas:
 * - mostrarImportadorConsumo()
 * - importarVentasNuevoFormato(payload)
 **************************************************************/

const SII_IMPORTADOR_VENTAS_V6001 = {
  HOJA_DESTINO: 'VENTAS',
  HOJA_LOG: 'LOG_IMPORTACIONES',
  TAMANO_BLOQUE: 1000,

  CARPETA_DRIVE_ID:
    '1ywgNK9yTuq3z4sHCK19etJR2aO-wRHkz',

  ENCABEZADOS_OBLIGATORIOS: [
    'CODIGO',
    'COD_BAM',
    'DESCRIPCION',
    'TOTAL_UNIDADES_NETAS',
    'TOTAL_FACTURADO_NETO_S_IVA'
  ],

  EMPRESAS: [
    'DTM',
    'IMP',
    'JNM',
    'NLI',
    'NLD'
  ],

  MESES_VALIDOS: [
    'ENE',
    'FEB',
    'MAR',
    'ABR',
    'MAY',
    'JUN',
    'JUL',
    'AGO',
    'SEP',
    'OCT',
    'NOV',
    'DIC'
  ]
};


/**
 * Conserva el nombre usado por el menú actual:
 * Datos externos → Importar consumo facturador.
 */
function mostrarImportadorVentasNuevo() {
  const html = HtmlService
    .createHtmlOutputFromFile('importador_ventas_ui')
    .setWidth(650)
    .setHeight(520);

  SpreadsheetApp
    .getUi()
    .showModalDialog(
      html,
      'Importar ventas'
    );
}


/**
 * Recibe el archivo enviado desde el HTML.
 *
 * payload:
 * {
 *   nombreArchivo,
 *   mimeType,
 *   base64
 * }
 */
function obtenerArchivoVentasPendiente() {

  const carpeta =
    DriveApp.getFolderById(
      SII_IMPORTADOR_VENTAS_V6001.CARPETA_DRIVE_ID
    );

  const archivos =
    carpeta.getFiles();

  let elegido =
    null;

  while (archivos.hasNext()) {

    const archivo =
      archivos.next();

    const nombre =
      String(
        archivo.getName() || ''
      ).trim();

    if (!/\.xlsx$/i.test(nombre)) {
      continue;
    }

    const fecha =
      archivo.getLastUpdated();

    if (
      !elegido ||
      fecha.getTime() >
      elegido.fecha.getTime()
    ) {
      elegido = {
        id: archivo.getId(),
        nombre: nombre,
        fecha: fecha,
        bytes: archivo.getSize()
      };
    }
  }

  if (!elegido) {
    return {
      encontrado: false,
      mensaje:
        'No hay archivos .xlsx en la carpeta configurada.'
    };
  }

  return {
    encontrado: true,
    id: elegido.id,
    nombre: elegido.nombre,
    fecha:
      Utilities.formatDate(
        elegido.fecha,
        Session.getScriptTimeZone(),
        'dd/MM/yyyy HH:mm'
      ),
    bytes: elegido.bytes,
    mb:
      Math.round(
        elegido.bytes / 1024 / 1024 * 100
      ) / 100
  };
}


function importarVentasDesdeDrive(
  fileId
) {

  const inicio =
    Date.now();

  let idTemporal =
    '';

  let nombreArchivo =
    '';

  try {

    const archivo =
      validarArchivoVentasDrive_(
        fileId
      );

    nombreArchivo =
      archivo.getName();

    const blob =
      archivo.getBlob();

    const convertido =
      Drive.Files.create(
        {
          name:
            'TEMP_VENTAS_' +
            new Date().getTime(),
          mimeType:
            MimeType.GOOGLE_SHEETS
        },
        blob,
        {
          fields: 'id'
        }
      );

    idTemporal =
      convertido.id;

    const ssTemporal =
      SpreadsheetApp.openById(
        idTemporal
      );

    const shOrigen =
      ssTemporal.getSheets()[0];

    const datos =
      shOrigen
        .getDataRange()
        .getDisplayValues();

    if (datos.length < 2) {
      throw new Error(
        'El archivo no contiene registros.'
      );
    }

    const resultadoValidacion =
      validarFormatoVentas_(
        datos[0]
      );

    const preparado =
      prepararDatosVentas_(
        datos,
        nombreArchivo,
        resultadoValidacion
      );

    escribirVentas_(
      preparado.encabezados,
      preparado.filas
    );

    registrarLogImportacionVentas_({
      archivo: nombreArchivo,
      filasOrigen: datos.length - 1,
      filasImportadas: preparado.filas.length,
      sinCodBam: preparado.sinCodBam,
      duplicados: preparado.duplicados,
      meses:
        resultadoValidacion.columnasMeses.length,
      duracionMs:
        Date.now() - inicio,
      estado: 'OK',
      mensaje:
        'Importación completada desde Google Drive'
    });

    limpiarCachesVentas_();

    return {
      ok: true,
      archivo: nombreArchivo,
      filasOrigen: datos.length - 1,
      filasImportadas: preparado.filas.length,
      sinCodBam: preparado.sinCodBam,
      duplicados: preparado.duplicados,
      mesesDetectados:
        resultadoValidacion.columnasMeses.map(
          reg => reg.encabezado
        ),
      duracionMs:
        Date.now() - inicio
    };

  } catch (error) {

    registrarLogImportacionVentas_({
      archivo: nombreArchivo,
      filasOrigen: 0,
      filasImportadas: 0,
      sinCodBam: 0,
      duplicados: 0,
      meses: 0,
      duracionMs:
        Date.now() - inicio,
      estado: 'ERROR',
      mensaje:
        error && error.message
          ? error.message
          : String(error)
    });

    throw error;

  } finally {

    if (idTemporal) {
      try {
        Drive.Files.update(
          {trashed: true},
          idTemporal
        );
      } catch (error) {
        Logger.log(
          'No se pudo eliminar el temporal: ' +
          error.message
        );
      }
    }
  }
}


function validarArchivoVentasDrive_(
  fileId
) {

  const id =
    String(
      fileId || ''
    ).trim();

  if (!id) {
    throw new Error(
      'No se recibió el ID del archivo.'
    );
  }

  const carpeta =
    DriveApp.getFolderById(
      SII_IMPORTADOR_VENTAS_V6001.CARPETA_DRIVE_ID
    );

  const archivo =
    DriveApp.getFileById(
      id
    );

  const nombre =
    String(
      archivo.getName() || ''
    ).trim();

  if (!/\.xlsx$/i.test(nombre)) {
    throw new Error(
      'El archivo seleccionado no es .xlsx.'
    );
  }

  if (archivo.getSize() <= 0) {
    throw new Error(
      'El archivo está vacío.'
    );
  }

  let pertenece =
    false;

  const padres =
    archivo.getParents();

  while (padres.hasNext()) {
    if (
      padres.next().getId() ===
      carpeta.getId()
    ) {
      pertenece = true;
      break;
    }
  }

  if (!pertenece) {
    throw new Error(
      'El archivo ya no se encuentra en la carpeta configurada.'
    );
  }

  return archivo;
}


/**
 * Verifica encabezados y pares mensuales.
 */
function validarFormatoVentas_(
  encabezados
) {
  const normalizados =
    encabezados.map(
      normalizarEncabezadoImportadorVentas_
    );

  const mapa =
    new Map();

  normalizados.forEach(
    (valor, indice) => {
      if (valor) {
        mapa.set(
          valor,
          indice
        );
      }
    }
  );

  const faltantes =
    SII_IMPORTADOR_VENTAS_V6001
      .ENCABEZADOS_OBLIGATORIOS
      .filter(
        encabezado =>
          !mapa.has(encabezado)
      );

  if (faltantes.length > 0) {
    throw new Error(
      'Faltan encabezados obligatorios: ' +
      faltantes.join(', ')
    );
  }

  const empresasFaltantes =
    SII_IMPORTADOR_VENTAS_V6001
      .EMPRESAS
      .filter(
        encabezado =>
          !mapa.has(encabezado)
      );

  if (
    empresasFaltantes.length > 0
  ) {
    throw new Error(
      'Faltan columnas de empresa: ' +
      empresasFaltantes.join(', ')
    );
  }

  const columnasMeses = [];

  normalizados.forEach(
    (encabezado, indice) => {
      if (
        encabezado.startsWith(
          'TOTAL_'
        )
      ) {
        return;
      }

      const match =
        encabezado.match(
          /^(ENE|FEB|MAR|ABR|MAY|JUN|JUL|AGO|SEP|OCT|NOV|DIC)_(\d{4})$/
        );

      if (!match) {
        return;
      }

      const total =
        'TOTAL_' +
        encabezado;

      if (!mapa.has(total)) {
        throw new Error(
          'Falta la columna ' +
          total +
          ' correspondiente a ' +
          encabezado +
          '.'
        );
      }

      columnasMeses.push({
        encabezado:
          encabezado,

        columnaUnidades:
          indice,

        columnaFacturacion:
          mapa.get(total)
      });
    }
  );

  if (
    columnasMeses.length === 0
  ) {
    throw new Error(
      'No se detectaron columnas mensuales.'
    );
  }

  columnasMeses.sort(
    (a, b) =>
      periodoOrdenImportadorVentas_(
        a.encabezado
      ) -
      periodoOrdenImportadorVentas_(
        b.encabezado
      )
  );

  return {
    mapa:
      mapa,

    columnasMeses:
      columnasMeses
  };
}


/**
 * Prepara los datos que se escribirán en VENTAS.
 *
 * Mantiene el formato original y agrega:
 * - ARCHIVO_ORIGEN
 * - FECHA_IMPORTACION
 */
function prepararDatosVentas_(
  datos,
  nombreArchivo,
  validacion
) {
  const encabezados =
    datos[0]
      .map(valor =>
        String(valor || '').trim()
      )
      .concat([
        'ARCHIVO_ORIGEN',
        'FECHA_IMPORTACION'
      ]);

  const colCodBam =
    validacion.mapa.get(
      'COD_BAM'
    );

  const filas = [];
  const vistos = new Set();

  let sinCodBam = 0;
  let duplicados = 0;

  const fechaImportacion =
    new Date();

  for (
    let i = 1;
    i < datos.length;
    i++
  ) {
    const fila =
      datos[i];

    const codBam =
      String(
        fila[colCodBam] || ''
      ).trim();

    if (!codBam) {
      sinCodBam++;
      continue;
    }

    const clave =
      normalizarClaveImportadorVentas_(
        codBam
      );

    if (vistos.has(clave)) {
      duplicados++;
    } else {
      vistos.add(clave);
    }

    const salida =
      fila.slice(
        0,
        datos[0].length
      );

    /*
     * Normaliza el SKU principal sin modificar
     * el código de proveedor.
     */
    salida[colCodBam] =
      codBam;

    salida.push(
      nombreArchivo
    );

    salida.push(
      fechaImportacion
    );

    filas.push(salida);
  }

  if (filas.length === 0) {
    throw new Error(
      'No se encontraron filas con Cod_BAM.'
    );
  }

  return {
    encabezados:
      encabezados,

    filas:
      filas,

    sinCodBam:
      sinCodBam,

    duplicados:
      duplicados
  };
}


/**
 * Reemplaza completamente la hoja VENTAS.
 */
function escribirVentas_(
  encabezados,
  filas
) {
  const ss =
    SpreadsheetApp.getActive();

  const nombreHoja =
    (
      typeof SII_CFG !== 'undefined' &&
      SII_CFG.SHEETS &&
      SII_CFG.SHEETS.VENTAS
    )
      ? SII_CFG.SHEETS.VENTAS
      : SII_IMPORTADOR_VENTAS_V6001
          .HOJA_DESTINO;

  let sh =
    ss.getSheetByName(
      nombreHoja
    );

  if (!sh) {
    sh =
      ss.insertSheet(
        nombreHoja
      );
  }

  const filtro =
    sh.getFilter();

  if (filtro) {
    filtro.remove();
  }

  const cantidadColumnas =
    encabezados.length;

  const filasNecesarias =
    Math.max(
      filas.length + 1,
      2
    );

  if (
    sh.getMaxRows() <
    filasNecesarias
  ) {
    sh.insertRowsAfter(
      sh.getMaxRows(),
      filasNecesarias -
        sh.getMaxRows()
    );
  }

  if (
    sh.getMaxColumns() <
    cantidadColumnas
  ) {
    sh.insertColumnsAfter(
      sh.getMaxColumns(),
      cantidadColumnas -
        sh.getMaxColumns()
    );
  }

  const filasLimpiar =
    Math.max(
      sh.getLastRow(),
      filas.length + 1
    );

  const columnasLimpiar =
    Math.max(
      sh.getLastColumn(),
      cantidadColumnas
    );

  sh.getRange(
    1,
    1,
    filasLimpiar,
    columnasLimpiar
  ).clearContent();

  sh.getRange(
    1,
    1,
    1,
    cantidadColumnas
  ).setValues([
    encabezados
  ]);

  for (
    let inicio = 0;
    inicio < filas.length;
    inicio +=
      SII_IMPORTADOR_VENTAS_V6001
        .TAMANO_BLOQUE
  ) {
    const bloque =
      filas.slice(
        inicio,
        inicio +
        SII_IMPORTADOR_VENTAS_V6001
          .TAMANO_BLOQUE
      );

    sh.getRange(
      inicio + 2,
      1,
      bloque.length,
      cantidadColumnas
    ).setValues(
      bloque
    );
  }

  aplicarFormatoVentasImportadas_(
    sh,
    encabezados,
    filas.length
  );
}


/**
 * Formato básico y estable.
 */
function aplicarFormatoVentasImportadas_(
  sh,
  encabezados,
  cantidadFilas
) {
  sh.setFrozenRows(1);

  sh.getRange(
    1,
    1,
    1,
    encabezados.length
  )
    .setBackground(
      '#1F4E78'
    )
    .setFontColor(
      '#FFFFFF'
    )
    .setFontWeight(
      'bold'
    )
    .setHorizontalAlignment(
      'center'
    )
    .setVerticalAlignment(
      'middle'
    )
    .setWrap(true);

  sh.setRowHeight(
    1,
    38
  );

  const mapa =
    new Map();

  encabezados.forEach(
    (valor, indice) => {
      mapa.set(
        normalizarEncabezadoImportadorVentas_(
          valor
        ),
        indice + 1
      );
    }
  );

  const colFecha =
    mapa.get(
      'FECHA_IMPORTACION'
    );

  if (
    colFecha &&
    cantidadFilas > 0
  ) {
    sh.getRange(
      2,
      colFecha,
      cantidadFilas,
      1
    ).setNumberFormat(
      'dd/MM/yyyy HH:mm'
    );
  }

  [
    'CODIGO',
    'COD_BAM'
  ].forEach(clave => {
    const columna =
      mapa.get(clave);

    if (
      columna &&
      cantidadFilas > 0
    ) {
      sh.getRange(
        2,
        columna,
        cantidadFilas,
        1
      ).setNumberFormat('@');
    }
  });

  sh.setColumnWidth(1, 165);
  sh.setColumnWidth(2, 165);
  sh.setColumnWidth(3, 260);

  for (
    let col = 4;
    col <= encabezados.length;
    col++
  ) {
    sh.setColumnWidth(
      col,
      115
    );
  }

  if (cantidadFilas > 0) {
    sh.getRange(
      1,
      1,
      cantidadFilas + 1,
      encabezados.length
    ).createFilter();
  }
}


/**
 * Registra el resultado sin exigir una estructura previa.
 */
function registrarLogImportacionVentas_(
  datos
) {
  try {
    const ss =
      SpreadsheetApp.getActive();

    let sh =
      ss.getSheetByName(
        SII_IMPORTADOR_VENTAS_V6001
          .HOJA_LOG
      );

    if (!sh) {
      sh =
        ss.insertSheet(
          SII_IMPORTADOR_VENTAS_V6001
            .HOJA_LOG
        );
    }

    const encabezados = [
      'FECHA',
      'TIPO',
      'ARCHIVO',
      'FILAS_ORIGEN',
      'FILAS_IMPORTADAS',
      'SIN_COD_BAM',
      'DUPLICADOS',
      'MESES',
      'DURACION_MS',
      'ESTADO',
      'MENSAJE'
    ];

    if (sh.getLastRow() === 0) {
      sh.getRange(
        1,
        1,
        1,
        encabezados.length
      ).setValues([
        encabezados
      ]);
    }

    /*
     * Solo escribe si el log tiene la estructura
     * propia del importador. Si existe otro formato,
     * evita dañarlo.
     */
    const actuales =
      sh.getRange(
        1,
        1,
        1,
        Math.min(
          sh.getLastColumn(),
          encabezados.length
        )
      ).getDisplayValues()[0]
      .map(
        normalizarEncabezadoImportadorVentas_
      );

    if (
      actuales[0] !== 'FECHA' ||
      actuales[1] !== 'TIPO'
    ) {
      Logger.log(
        'LOG_IMPORTACIONES tiene otra estructura; no se agregó registro.'
      );

      return;
    }

    sh.appendRow([
      new Date(),
      'VENTAS',
      datos.archivo,
      datos.filasOrigen,
      datos.filasImportadas,
      datos.sinCodBam,
      datos.duplicados,
      datos.meses,
      datos.duracionMs,
      datos.estado,
      datos.mensaje
    ]);

  } catch (error) {
    Logger.log(
      'No se pudo registrar LOG_IMPORTACIONES: ' +
      error.message
    );
  }
}


/**
 * Limpia las caches relacionadas con ventas.
 */
function limpiarCachesVentas_() {
  try {
    CacheService
      .getDocumentCache()
      .remove(
        'SII_VENTAS_MODELO_V6000'
      );
  } catch (error) {}

  if (
    typeof limpiarCacheModeloVentas ===
    'function'
  ) {
    try {
      limpiarCacheModeloVentas();
    } catch (error) {}
  }
}


function periodoOrdenImportadorVentas_(
  encabezado
) {
  const match =
    encabezado.match(
      /^(ENE|FEB|MAR|ABR|MAY|JUN|JUL|AGO|SEP|OCT|NOV|DIC)_(\d{4})$/
    );

  if (!match) {
    return 999999;
  }

  const meses = {
    ENE: 1,
    FEB: 2,
    MAR: 3,
    ABR: 4,
    MAY: 5,
    JUN: 6,
    JUL: 7,
    AGO: 8,
    SEP: 9,
    OCT: 10,
    NOV: 11,
    DIC: 12
  };

  return (
    Number(match[2]) *
    100 +
    meses[match[1]]
  );
}


function normalizarEncabezadoImportadorVentas_(
  valor
) {
  return String(
    valor === null ||
    valor === undefined
      ? ''
      : valor
  )
    .trim()
    .normalize('NFD')
    .replace(
      /[\u0300-\u036f]/g,
      ''
    )
    .toUpperCase()
    .replace(/\s+/g, '_');
}


function normalizarClaveImportadorVentas_(
  valor
) {
  return String(
    valor === null ||
    valor === undefined
      ? ''
      : valor
  )
    .trim()
    .normalize('NFD')
    .replace(
      /[\u0300-\u036f]/g,
      ''
    )
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
}
