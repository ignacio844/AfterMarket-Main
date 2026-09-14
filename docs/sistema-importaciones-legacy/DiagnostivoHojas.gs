function diagnosticarHojasSpreadsheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const hojas = ss.getSheets();

  const nombreHojaSalida = 'DIAGNOSTICO_HOJAS';

  let shOut = ss.getSheetByName(nombreHojaSalida);
  if (!shOut) {
    shOut = ss.insertSheet(nombreHojaSalida);
  } else {
    shOut.clearContents();
    shOut.clearFormats();
  }

  const encabezados = [
    'HOJA',
    'FILAS_USADAS',
    'COLUMNAS_USADAS',
    'CELDAS_USADAS',
    'ESTA_VACIA',
    'OCULTA',
    'FILA_MAXIMA',
    'COLUMNA_MAXIMA'
  ];

  const salida = [encabezados];

  hojas.forEach(function(sh) {
    if (sh.getName() === nombreHojaSalida) {
      return;
    }

    const lastRow = sh.getLastRow();
    const lastCol = sh.getLastColumn();

    let celdasUsadas = 0;
    let estaVacia = true;

    if (lastRow > 0 && lastCol > 0) {
      const valores = sh
        .getRange(1, 1, lastRow, lastCol)
        .getDisplayValues();

      valores.forEach(function(fila) {
        fila.forEach(function(valor) {
          if (String(valor || '').trim() !== '') {
            celdasUsadas++;
          }
        });
      });

      estaVacia = celdasUsadas === 0;
    }

    salida.push([
      sh.getName(),
      lastRow,
      lastCol,
      celdasUsadas,
      estaVacia ? 'SI' : 'NO',
      sh.isSheetHidden() ? 'SI' : 'NO',
      sh.getMaxRows(),
      sh.getMaxColumns()
    ]);
  });

  if (salida.length > 1) {
    shOut
      .getRange(
        1,
        1,
        salida.length,
        salida[0].length
      )
      .setValues(salida);
  }

  shOut
    .getRange(1, 1, 1, encabezados.length)
    .setFontWeight('bold')
    .setBackground('#123d6a')
    .setFontColor('white');

  shOut.setFrozenRows(1);
  shOut.autoResizeColumns(1, encabezados.length);

  if (shOut.getLastRow() > 1) {
    shOut
      .getRange(1, 1, shOut.getLastRow(), encabezados.length)
      .createFilter();
  }

  Logger.log(
    'Diagnóstico terminado. Se analizaron ' +
    (salida.length - 1) +
    ' hojas.'
  );

  return {
    ok: true,
    hojasAnalizadas: salida.length - 1,
    hojaResultado: nombreHojaSalida
  };
}

function clasificarHojasSII() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const nombreSalida = 'DIAGNOSTICO_HOJAS';

  const sh = ss.getSheetByName(nombreSalida);
  if (!sh) {
    throw new Error(
      'Primero ejecutá diagnosticarHojasSpreadsheet().'
    );
  }

  /*
   * Hojas que sabemos que forman parte del SII actual.
   * NO significa que las restantes puedan borrarse todavía.
   */
  const hojasSiiActual = new Set([
    'MODELO_COMPRAS',
    'GESTION_COMPRAS',
    'GESTION_COMPRAS_ACTIVA',
    'ENVIOS_COMPRA',
    'COMPRAS_EN_PROCESO',
    'MOVIMIENTOS_COMPRA',
    'CONFIG_MARCAS_COMPRA',
    'ALIAS_MARCAS_COMPRA',

    'COTIZACIONES_COMPRA',
    'COTIZACIONES_OFERTAS',
    'ORDENES_COMPRA_PORTAL',

    'PACKING_LIST',
    'PACKING_LIST_DETALLE',
    'CONTENEDORES',
    'CONTENEDOR_PACKING_LIST',

    /*
     * DETALLE_IMPORTACIONES es la tabla operativa
     * canónica del detalle de órdenes/importaciones.
     */
    'DETALLE_IMPORTACIONES'
  ]);

  const lastRow = sh.getLastRow();
  const lastCol = sh.getLastColumn();

  if (lastRow < 2) {
    throw new Error(
      'DIAGNOSTICO_HOJAS no contiene registros.'
    );
  }

  const headers = sh
    .getRange(1, 1, 1, lastCol)
    .getDisplayValues()[0];

  const colHoja =
    headers.indexOf('HOJA') + 1;

  if (!colHoja) {
    throw new Error(
      'No se encontró la columna HOJA.'
    );
  }

  /*
   * Agregamos columnas de clasificación.
   */
  const colEstado = lastCol + 1;
  const colAccion = lastCol + 2;
  const colObservacion = lastCol + 3;

  sh.getRange(
    1,
    colEstado,
    1,
    3
  ).setValues([[
    'CLASIFICACION',
    'ACCION_PROPUESTA',
    'OBSERVACION'
  ]]);

  sh.getRange(
    1,
    colEstado,
    1,
    3
  )
  .setFontWeight('bold')
  .setBackground('#123d6a')
  .setFontColor('white');

  const nombres = sh
    .getRange(
      2,
      colHoja,
      lastRow - 1,
      1
    )
    .getDisplayValues();

  const salida = nombres.map(function(fila) {

    const nombre =
      String(fila[0] || '').trim();

    if (!nombre) {
      return ['', '', ''];
    }

    if (hojasSiiActual.has(nombre)) {
      return [
        'SII ACTUAL',
        'MANTENER',
        'Utilizada por el circuito actual.'
      ];
    }

    /*
     * Casos que por nombre parecen ser
     * diagnósticos, auditorías o versiones anteriores.
     */
    if (
      nombre.indexOf('DIAG_') === 0 ||
      nombre.indexOf('AUDITORIA_') === 0 ||
      nombre.indexOf('CONTROL_MIGRACION') === 0
    ) {
      return [
        'AUXILIAR / DIAGNOSTICO',
        'REVISAR',
        'Posible hoja temporal o de diagnóstico.'
      ];
    }

    if (
      nombre === 'DASHBOARD_V5' ||
      nombre === 'DASHBOARD_V7' ||
      nombre === 'PLAN_COMPRAS_V2'
    ) {
      return [
        'VERSION ANTERIOR/PARALELA',
        'REVISAR',
        'Hay más de una versión del mismo concepto.'
      ];
    }

    return [
      'NO CLASIFICADA',
      'REVISAR',
      'No borrar hasta comprobar dependencias.'
    ];
  });

  sh.getRange(
    2,
    colEstado,
    salida.length,
    3
  ).setValues(salida);

  sh.autoResizeColumns(
    colEstado,
    3
  );

  SpreadsheetApp.flush();

  Logger.log(
    'Clasificación terminada. ' +
    salida.length +
    ' hojas analizadas.'
  );

  return {
    ok: true,
    hojas: salida.length
  };
}

/**
 * DEPURACIÓN SEGURA DE HOJAS
 *
 * 1. Crea una copia completa del Google Sheet.
 * 2. Elimina SOLAMENTE las hojas indicadas en hojasAEliminar.
 * 3. Registra lo realizado en DIAGNOSTICO_HOJAS.
 *
 * IMPORTANTE:
 * La primera vez ejecutalo con SOLO_SIMULAR = true.
 */
function depurarHojasSII() {

  const SOLO_SIMULAR = false; // <-- PRIMERO dejar en true

  /*
   * PRIMER GRUPO PROPUESTO.
   * Por ahora NO agregamos ninguna otra hoja.
   */
  const hojasAEliminar = [
    'DASHBOARD_V5',
    'DASHBOARD_V7',
    'DETALLE_MARCA_DASHBOARD',
    'HISTORIAL'
  ];

  const ss = SpreadsheetApp.getActiveSpreadsheet();

  // ==============================================
  // VALIDACIONES
  // ==============================================

  const existentes = hojasAEliminar.filter(function(nombre) {
    return ss.getSheetByName(nombre) !== null;
  });

  const inexistentes = hojasAEliminar.filter(function(nombre) {
    return ss.getSheetByName(nombre) === null;
  });

  Logger.log('======================================');
  Logger.log('DEPURACIÓN SII');
  Logger.log('======================================');

  Logger.log(
    'Hojas encontradas: ' +
    JSON.stringify(existentes)
  );

  if (inexistentes.length) {
    Logger.log(
      'Hojas no encontradas: ' +
      JSON.stringify(inexistentes)
    );
  }

  // ==============================================
  // MODO SIMULACIÓN
  // ==============================================

  if (SOLO_SIMULAR) {

    Logger.log('--------------------------------------');
    Logger.log('MODO SIMULACIÓN');
    Logger.log('NO SE ELIMINÓ NINGUNA HOJA.');
    Logger.log('--------------------------------------');

    existentes.forEach(function(nombre) {

      const sh = ss.getSheetByName(nombre);

      Logger.log(
        nombre +
        ' | filas=' + sh.getLastRow() +
        ' | columnas=' + sh.getLastColumn()
      );
    });

    Logger.log(
      'Si la lista es correcta, cambiar ' +
      'SOLO_SIMULAR a false.'
    );

    return {
      ok: true,
      simulacion: true,
      hojasCandidatas: existentes,
      hojasInexistentes: inexistentes
    };
  }

  // ==============================================
  // BACKUP COMPLETO
  // ==============================================

  const tz =
    ss.getSpreadsheetTimeZone() ||
    Session.getScriptTimeZone();

  const fecha =
    Utilities.formatDate(
      new Date(),
      tz,
      'yyyyMMdd_HHmmss'
    );

  const nombreBackup =
    ss.getName() +
    '_BACKUP_ANTES_DEPURACION_' +
    fecha;

  Logger.log(
    'Creando backup: ' + nombreBackup
  );

  const archivoOriginal =
    DriveApp.getFileById(ss.getId());

  const backup =
    archivoOriginal.makeCopy(nombreBackup);

  Logger.log(
    'Backup creado correctamente.'
  );

  Logger.log(
    'ID backup: ' + backup.getId()
  );

  Logger.log(
    'URL backup: ' + backup.getUrl()
  );

  // ==============================================
  // ELIMINACIÓN
  // ==============================================

  const eliminadas = [];

  existentes.forEach(function(nombre) {

    const sh = ss.getSheetByName(nombre);

    if (!sh) {
      return;
    }

    /*
     * Protección adicional:
     * Google Sheets debe conservar al menos
     * una hoja.
     */
    if (ss.getSheets().length <= 1) {
      throw new Error(
        'No se puede eliminar la última hoja.'
      );
    }

    Logger.log(
      'Eliminando hoja: ' + nombre
    );

    ss.deleteSheet(sh);

    eliminadas.push(nombre);
  });

  // ==============================================
  // REGISTRO EN DIAGNOSTICO_HOJAS
  // ==============================================

  registrarDepuracionHojas_(
    ss,
    eliminadas,
    nombreBackup,
    backup.getUrl()
  );

  Logger.log('======================================');
  Logger.log('DEPURACIÓN TERMINADA');
  Logger.log('======================================');

  Logger.log(
    'Hojas eliminadas: ' +
    JSON.stringify(eliminadas)
  );

  return {
    ok: true,
    simulacion: false,
    backup: nombreBackup,
    backupUrl: backup.getUrl(),
    eliminadas: eliminadas
  };
}


/**
 * Registra la operación al final de DIAGNOSTICO_HOJAS.
 */
function registrarDepuracionHojas_(
  ss,
  hojas,
  nombreBackup,
  urlBackup
) {

  let sh =
    ss.getSheetByName('DIAGNOSTICO_HOJAS');

  if (!sh) {
    sh = ss.insertSheet(
      'DIAGNOSTICO_HOJAS'
    );
  }

  const filaInicio =
    Math.max(sh.getLastRow() + 3, 2);

  const datos = [
    ['DEPURACION REALIZADA', new Date()],
    ['BACKUP', nombreBackup],
    ['URL BACKUP', urlBackup],
    ['HOJAS ELIMINADAS', hojas.join(', ')]
  ];

  sh.getRange(
    filaInicio,
    1,
    datos.length,
    2
  ).setValues(datos);

  sh.getRange(
    filaInicio,
    1,
    1,
    2
  ).setFontWeight('bold');

  SpreadsheetApp.flush();
}

function analizarDependenciasHojasSII() {

  const ss = SpreadsheetApp.getActiveSpreadsheet();

  // Segundo lote que queremos investigar
  const candidatas = [
    'DASHBOARD',
    'DASHBOARD_V5',
    'DASHBOARD_V7',
    'DETALLE_MARCA_DASHBOARD',
    'PLAN_COMPRAS_V2',
    'HISTORIAL'
  ];

  const nombreSalida = 'DEPENDENCIAS_HOJAS';

  let out = ss.getSheetByName(nombreSalida);

  if (!out) {
    out = ss.insertSheet(nombreSalida);
  } else {
    out.clear();
  }

  const resultado = [[
    'HOJA_CANDIDATA',
    'REFERENCIADA_DESDE',
    'CELDA',
    'FORMULA'
  ]];

  const hojas = ss.getSheets();

  candidatas.forEach(function(nombreBuscado) {

    hojas.forEach(function(sh) {

      // No analizamos la propia hoja de salida
      if (sh.getName() === nombreSalida) {
        return;
      }

      const lastRow = sh.getLastRow();
      const lastCol = sh.getLastColumn();

      if (!lastRow || !lastCol) {
        return;
      }

      const formulas = sh
        .getRange(1, 1, lastRow, lastCol)
        .getFormulas();

      formulas.forEach(function(fila, r) {

        fila.forEach(function(formula, c) {

          if (!formula) {
            return;
          }

          const formulaUpper =
            formula.toUpperCase();

          const nombreUpper =
            nombreBuscado.toUpperCase();

          /*
           * Detecta, por ejemplo:
           *
           * =DASHBOARD_V7!A1
           * ='DASHBOARD_V7'!A1
           * =QUERY(PLAN_COMPRAS_V2!A:Z,...)
           */
          if (
            formulaUpper.indexOf(
              nombreUpper + '!'
            ) !== -1 ||

            formulaUpper.indexOf(
              "'" + nombreUpper + "'!"
            ) !== -1
          ) {

            resultado.push([
              nombreBuscado,
              sh.getName(),
              sh.getRange(r + 1, c + 1).getA1Notation(),
              formula
            ]);
          }

        });

      });

    });

  });

  out.getRange(
    1,
    1,
    resultado.length,
    resultado[0].length
  ).setValues(resultado);

  out.getRange(
    1,
    1,
    1,
    resultado[0].length
  )
    .setFontWeight('bold')
    .setBackground('#123d6a')
    .setFontColor('white');

  out.setFrozenRows(1);

  out.autoResizeColumns(
    1,
    resultado[0].length
  );

  if (resultado.length > 1) {

    out.getRange(
      1,
      1,
      resultado.length,
      resultado[0].length
    ).createFilter();

  }

  // Resumen en Logger
  Logger.log('======================================');
  Logger.log('DEPENDENCIAS DE HOJAS');
  Logger.log('======================================');

  candidatas.forEach(function(nombre) {

    const cantidad =
      resultado.filter(function(r, index) {
        return index > 0 && r[0] === nombre;
      }).length;

    Logger.log(
      nombre +
      ' -> ' +
      cantidad +
      ' referencias'
    );

  });

  Logger.log('--------------------------------------');
  Logger.log(
    'Resultado guardado en: ' +
    nombreSalida
  );

  return {
    ok: true,
    referenciasEncontradas:
      resultado.length - 1,
    hojaResultado:
      nombreSalida
  };
}

function generarMapaDependenciasSII() {

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const NOMBRE_SALIDA = 'MAPA_DEPENDENCIAS_SII';

  // Hojas que sabemos que forman parte del SII actual
  const hojasSiiActual = new Set([
    'MODELO_COMPRAS',
    'GESTION_COMPRAS',
    'GESTION_COMPRAS_ACTIVA',
    'ENVIOS_COMPRA',
    'COMPRAS_EN_PROCESO',
    'MOVIMIENTOS_COMPRA',
    'CONFIG_MARCAS_COMPRA',
    'ALIAS_MARCAS_COMPRA',
    'COTIZACIONES_COMPRA',
    'COTIZACIONES_OFERTAS',
    'ORDENES_COMPRA_PORTAL',
    'PACKING_LIST',
    'PACKING_LIST_DETALLE',
    'CONTENEDORES',
    'CONTENEDOR_PACKING_LIST',
    'DETALLE_IMPORTACIONES'
  ]);

  let salida = ss.getSheetByName(NOMBRE_SALIDA);

  if (!salida) {
    salida = ss.insertSheet(NOMBRE_SALIDA);
  } else {
    salida.clear();
  }

  const hojas = ss.getSheets()
    .filter(sh => sh.getName() !== NOMBRE_SALIDA);

  const nombres = hojas.map(sh => sh.getName());

  const info = {};

  nombres.forEach(nombre => {
    info[nombre] = {
      referenciasSalientes: new Set(),
      referenciasEntrantes: new Set(),
      cantidadFormulas: 0
    };
  });

  Logger.log('======================================');
  Logger.log('GENERANDO MAPA DE DEPENDENCIAS SII');
  Logger.log('======================================');

  /*
   * --------------------------------------------------
   * UNA SOLA PASADA POR CADA HOJA
   * --------------------------------------------------
   */
  hojas.forEach(function(sh) {

    const nombreOrigen = sh.getName();

    Logger.log('Analizando: ' + nombreOrigen);

    const lastRow = sh.getLastRow();
    const lastCol = sh.getLastColumn();

    if (!lastRow || !lastCol) {
      return;
    }

    let formulas;

    try {

      formulas = sh
        .getRange(1, 1, lastRow, lastCol)
        .getFormulas();

    } catch (e) {

      Logger.log(
        'ERROR leyendo fórmulas de ' +
        nombreOrigen +
        ': ' +
        e.message
      );

      return;
    }

    formulas.forEach(function(fila) {

      fila.forEach(function(formula) {

        if (!formula) {
          return;
        }

        info[nombreOrigen].cantidadFormulas++;

        nombres.forEach(function(nombreDestino) {

          if (nombreDestino === nombreOrigen) {
            return;
          }

          const escaped =
            nombreDestino.replace(
              /[.*+?^${}()|[\]\\]/g,
              '\\$&'
            );

          /*
           * Detecta:
           *
           * =HOJA!A1
           * ='HOJA'!A1
           * =SUMA(HOJA!A:A)
           */

          const regex = new RegExp(
            "(?:'" + escaped + "'|" +
            escaped + ")!",
            'i'
          );

          if (regex.test(formula)) {

            info[nombreOrigen]
              .referenciasSalientes
              .add(nombreDestino);

            info[nombreDestino]
              .referenciasEntrantes
              .add(nombreOrigen);
          }

        });

      });

    });

  });


  /*
   * --------------------------------------------------
   * GENERAR RESULTADO
   * --------------------------------------------------
   */

  const datos = [[
    'HOJA',
    'FILAS',
    'COLUMNAS',
    'FORMULAS',
    'REFERENCIA_A',
    'REFERENCIADA_DESDE',
    'SII_ACTUAL',
    'CLASIFICACION'
  ]];


  hojas.forEach(function(sh) {

    const nombre = sh.getName();

    const salientes =
      Array.from(
        info[nombre].referenciasSalientes
      );

    const entrantes =
      Array.from(
        info[nombre].referenciasEntrantes
      );

    const esActual =
      hojasSiiActual.has(nombre);

    let clasificacion;


    /*
     * Regla conservadora.
     *
     * Una hoja nunca se marca automáticamente
     * para borrar si tiene dependencias.
     */

    if (esActual) {

      clasificacion = 'MANTENER';

    } else if (
      entrantes.length > 0 ||
      salientes.length > 0
    ) {

      clasificacion =
        'REVISAR - TIENE DEPENDENCIAS';

    } else {

      clasificacion =
        'CANDIDATA A REVISAR';

    }


    datos.push([
      nombre,
      sh.getLastRow(),
      sh.getLastColumn(),
      info[nombre].cantidadFormulas,
      salientes.join(', '),
      entrantes.join(', '),
      esActual ? 'SI' : 'NO',
      clasificacion
    ]);

  });


  /*
   * --------------------------------------------------
   * ESCRIBIR HOJA
   * --------------------------------------------------
   */

  salida.getRange(
    1,
    1,
    datos.length,
    datos[0].length
  ).setValues(datos);


  salida.getRange(
    1,
    1,
    1,
    datos[0].length
  )
    .setFontWeight('bold')
    .setBackground('#123d6a')
    .setFontColor('white');


  salida.setFrozenRows(1);


  salida.getRange(
    1,
    1,
    datos.length,
    datos[0].length
  ).createFilter();


  salida.autoResizeColumns(
    1,
    datos[0].length
  );


  /*
   * --------------------------------------------------
   * RESUMEN
   * --------------------------------------------------
   */

  let mantener = 0;
  let revisar = 0;
  let candidatas = 0;

  datos.slice(1).forEach(r => {

    if (r[7] === 'MANTENER') {
      mantener++;
    }

    else if (
      r[7] ===
      'REVISAR - TIENE DEPENDENCIAS'
    ) {
      revisar++;
    }

    else {
      candidatas++;
    }

  });


  Logger.log('======================================');
  Logger.log('MAPA TERMINADO');
  Logger.log('======================================');

  Logger.log(
    'MANTENER: ' + mantener
  );

  Logger.log(
    'REVISAR CON DEPENDENCIAS: ' +
    revisar
  );

  Logger.log(
    'CANDIDATAS A REVISAR: ' +
    candidatas
  );

  Logger.log(
    'Resultado: ' +
    NOMBRE_SALIDA
  );


  return {
    ok: true,
    mantener: mantener,
    revisar: revisar,
    candidatas: candidatas,
    hojaResultado: NOMBRE_SALIDA
  };
}