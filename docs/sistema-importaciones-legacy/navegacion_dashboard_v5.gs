/**
 * Se ejecuta mediante un activador instalable "Al editar".
 * No debe llamarse onEdit para evitar que también se ejecute
 * como activador simple.
 */
function procesarDetalleDashboardV5(e) {
  if (!e || !e.range) {
    return;
  }

  const rango = e.range;
  const hoja = rango.getSheet();

  const HOJA_DASHBOARD = 'DASHBOARD_V5';
  const FILA_INICIO = 14;
  const COLUMNA_MARCA = 1;
  const COLUMNA_DETALLE = 13; // M

  if (
    hoja.getName() !== HOJA_DASHBOARD ||
    rango.getRow() < FILA_INICIO ||
    rango.getColumn() !== COLUMNA_DETALLE ||
    rango.getNumRows() !== 1 ||
    rango.getNumColumns() !== 1 ||
    String(e.value) !== 'TRUE'
  ) {
    return;
  }

  const marca = String(
    hoja
      .getRange(
        rango.getRow(),
        COLUMNA_MARCA
      )
      .getDisplayValue() || ''
  ).trim();

  if (!marca) {
    rango.setValue(false);
    return;
  }

  const lock = LockService.getDocumentLock();

  if (!lock.tryLock(5000)) {
    rango.setValue(false);

    SpreadsheetApp.getActive().toast(
      'Ya se está generando otro detalle.',
      'Detalle de marca',
      5
    );

    return;
  }

  try {
    // Se desmarca inmediatamente para evitar que quede activa.
    rango.setValue(false);
    SpreadsheetApp.flush();

    SpreadsheetApp.getActive().toast(
      'Generando detalle de ' + marca,
      'Detalle de marca',
      5
    );

    generarDetalleMarcaV52000_(marca);

  } catch (error) {
    console.error(error);
    throw error;

  } finally {
    lock.releaseLock();
  }
}


/**
 * Ejecutar una sola vez para crear el activador instalable.
 */
function instalarTriggerDetalleDashboardV5() {
  const ss = SpreadsheetApp.getActive();

  ScriptApp.getProjectTriggers()
    .forEach(function(trigger) {
      if (
        trigger.getHandlerFunction() ===
        'procesarDetalleDashboardV5'
      ) {
        ScriptApp.deleteTrigger(trigger);
      }
    });

  ScriptApp.newTrigger(
    'procesarDetalleDashboardV5'
  )
    .forSpreadsheet(ss)
    .onEdit()
    .create();

  Logger.log(
    'Activador instalable creado correctamente.'
  );

  ss.toast(
    'Activador de detalle instalado.',
    'Dashboard V5',
    5
  );
}


/**
 * Crea o reconstruye las casillas.
 */
function agregarCasillasDetalleDashboardV5() {
  const ss = SpreadsheetApp.getActive();
  const sh = ss.getSheetByName('DASHBOARD_V5');

  if (!sh) {
    throw new Error(
      'No existe DASHBOARD_V5.'
    );
  }

  const filaInicio = 14;
  const columnaDetalle = 13;
  const ultimaFila = 33;

  const encabezado = sh.getRange(
    12,
    columnaDetalle,
    2,
    1
  );

  encabezado.breakApart();

  encabezado
    .merge()
    .setValue('DETALLE')
    .setBackground('#1f4e78')
    .setFontColor('#ffffff')
    .setFontWeight('bold')
    .setHorizontalAlignment('center')
    .setVerticalAlignment('middle');

  sh.getRange(
    filaInicio,
    columnaDetalle,
    ultimaFila - filaInicio + 1,
    1
  )
    .clearDataValidations()
    .insertCheckboxes()
    .setValue(false)
    .setHorizontalAlignment('center');

  sh.setColumnWidth(
    columnaDetalle,
    85
  );
}

function irMarcaAnteriorDetalle() {
  const marcas = obtenerMarcasDashboardV5_();
  const actual = obtenerMarcaActualDetalle_();

  const indice = marcas.findIndex(
    marca => normalizarMarcaNav_(marca) ===
      normalizarMarcaNav_(actual)
  );

  if (indice === -1) {
    throw new Error(
      'La marca actual no está en la lista del Dashboard.'
    );
  }

  const indiceAnterior =
    indice === 0
      ? marcas.length - 1
      : indice - 1;

  generarDetalleMarcaV52000_(
    marcas[indiceAnterior]
  );
}


function irMarcaSiguienteDetalle() {
  const marcas = obtenerMarcasDashboardV5_();
  const actual = obtenerMarcaActualDetalle_();

  const indice = marcas.findIndex(
    marca => normalizarMarcaNav_(marca) ===
      normalizarMarcaNav_(actual)
  );

  if (indice === -1) {
    throw new Error(
      'La marca actual no está en la lista del Dashboard.'
    );
  }

  const indiceSiguiente =
    indice === marcas.length - 1
      ? 0
      : indice + 1;

  generarDetalleMarcaV52000_(
    marcas[indiceSiguiente]
  );
}


function volverDashboardV5() {
  const ss = SpreadsheetApp.getActive();
  const sh = ss.getSheetByName('DASHBOARD_V5');

  if (!sh) {
    throw new Error(
      'No existe la hoja DASHBOARD_V5.'
    );
  }

  sh.activate();
  sh.setActiveSelection('A1');
}


function obtenerMarcaActualDetalle_() {
  const ss = SpreadsheetApp.getActive();
  const sh = ss.getSheetByName(
    'DETALLE_MARCA_DASHBOARD'
  );

  if (!sh) {
    throw new Error(
      'No existe DETALLE_MARCA_DASHBOARD.'
    );
  }

  const marca = String(
    sh.getRange('C2').getDisplayValue() || ''
  ).trim();

  if (!marca) {
    throw new Error(
      'No hay una marca cargada en C2.'
    );
  }

  return marca;
}


function obtenerMarcasDashboardV5_() {
  const ss = SpreadsheetApp.getActive();
  const sh = ss.getSheetByName('DASHBOARD_V5');

  if (!sh) {
    throw new Error(
      'No existe DASHBOARD_V5.'
    );
  }

  const filaInicio = 14;
  const ultimaFila = sh.getLastRow();

  const valores = sh.getRange(
    filaInicio,
    1,
    ultimaFila - filaInicio + 1,
    1
  ).getDisplayValues();

  const marcas = valores
    .flat()
    .map(valor => String(valor || '').trim())
    .filter(valor =>
      valor &&
      valor.toUpperCase() !== 'MARCA'
    );

  return [...new Set(marcas)];
}


function normalizarMarcaNav_(valor) {
  return String(valor || '')
    .trim()
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');
}