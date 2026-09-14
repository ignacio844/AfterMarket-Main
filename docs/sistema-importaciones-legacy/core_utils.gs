/*******************************************************
 * SII V6.4.002
 * UTILIDADES CENTRALES COMPARTIDAS
 *******************************************************/

function obtenerHoja_(ssONombre, nombreOpcional) {
  let ss;
  let nombre;

  if (ssONombre && typeof ssONombre.getSheetByName === 'function') {
    ss = ssONombre;
    nombre = nombreOpcional;
  } else {
    ss = SpreadsheetApp.getActiveSpreadsheet();
    nombre = ssONombre;
  }

  nombre = coreTexto_(nombre);

  if (!nombre) {
    throw new Error('Se intentó obtener una hoja sin indicar el nombre.');
  }

  const hoja = ss.getSheetByName(nombre);

  if (!hoja) {
    throw new Error('No existe la hoja "' + nombre + '".');
  }

  return hoja;
}

function leerFilasComoObjetos_(hoja) {
  if (!hoja) return [];

  const ultimaFila = hoja.getLastRow();
  const ultimaColumna = hoja.getLastColumn();

  if (ultimaFila < 2 || ultimaColumna < 1) return [];

  const datos = hoja
    .getRange(1, 1, ultimaFila, ultimaColumna)
    .getDisplayValues();

  const encabezados = datos[0].map(coreEncabezado_);

  return datos
    .slice(1)
    .filter(fila => fila.some(valor => coreTexto_(valor) !== ''))
    .map(fila => {
      const registro = {};
      encabezados.forEach((encabezado, indice) => {
        if (encabezado) registro[encabezado] = fila[indice];
      });
      return registro;
    });
}

function crearHojaSiNoExiste_(ss, nombre, encabezados) {
  ss = ss || SpreadsheetApp.getActiveSpreadsheet();
  nombre = coreTexto_(nombre);
  if (!nombre) throw new Error('Nombre de hoja inválido.');

  let hoja = ss.getSheetByName(nombre);
  if (!hoja) hoja = ss.insertSheet(nombre);

  if (Array.isArray(encabezados) && encabezados.length) {
    const actuales = hoja.getLastColumn() > 0
      ? hoja.getRange(1, 1, 1, hoja.getLastColumn()).getDisplayValues()[0]
      : [];
    const mapa = mapaEncabezados_(actuales);
    let columna = Math.max(1, hoja.getLastColumn() + 1);

    encabezados.forEach(encabezado => {
      const clave = normalizar_(encabezado);
      if (!mapa.has(clave)) {
        hoja.getRange(1, columna).setValue(encabezado);
        mapa.set(clave, columna - 1);
        columna++;
      }
    });

    formatearEncabezado_(hoja);
  }

  return hoja;
}

function mapaEncabezados_(encabezados) {
  const mapa = new Map();
  (encabezados || []).forEach((valor, indice) => {
    const clave = normalizar_(valor);
    if (clave && !mapa.has(clave)) mapa.set(clave, indice);
  });
  return mapa;
}

function requerirColumna_(mapa, nombre) {
  const clave = normalizar_(nombre);
  if (!mapa || !mapa.has(clave)) {
    throw new Error('No se encontró la columna obligatoria "' + nombre + '".');
  }
  return mapa.get(clave);
}

function normalizar_(valor) {
  return coreTexto_(valor)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function leerTablaPorClave_(hoja, nombreColumna) {
  const resultado = new Map();
  const campo = coreEncabezado_(nombreColumna);
  leerFilasComoObjetos_(hoja).forEach(registro => {
    const clave = normalizar_(registro[campo]);
    if (clave) resultado.set(clave, registro);
  });
  return resultado;
}

function escribirTabla_(hoja, filas) {
  if (!hoja) throw new Error('No se indicó la hoja de destino.');
  filas = Array.isArray(filas) ? filas : [];

  const columnas = Math.max(
    hoja.getLastColumn(),
    filas.length && filas[0] ? filas[0].length : 0
  );
  if (columnas < 1) return;

  if (hoja.getLastRow() > 1) {
    hoja.getRange(2, 1, hoja.getLastRow() - 1, columnas).clearContent();
  }

  const bloque = 3000;
  for (let inicio = 0; inicio < filas.length; inicio += bloque) {
    const datos = filas.slice(inicio, inicio + bloque).map(fila => {
      const copia = (fila || []).slice(0, columnas);
      while (copia.length < columnas) copia.push('');
      return copia;
    });
    hoja.getRange(inicio + 2, 1, datos.length, columnas).setValues(datos);
  }

  formatearEncabezado_(hoja);
}

function formatearEncabezado_(hoja) {
  if (!hoja || hoja.getLastColumn() < 1) return;
  hoja.getRange(1, 1, 1, hoja.getLastColumn())
    .setFontWeight('bold')
    .setHorizontalAlignment('center')
    .setVerticalAlignment('middle')
    .setWrap(true);
  hoja.setFrozenRows(1);
}

function generarId_(prefijo) {
  const zona = Session.getScriptTimeZone() || 'America/Argentina/Buenos_Aires';
  const fecha = Utilities.formatDate(new Date(), zona, 'yyyyMMddHHmmssSSS');
  const aleatorio = String(Math.floor(Math.random() * 10000)).padStart(4, '0');
  return [normalizar_(prefijo) || 'ID', fecha, aleatorio].join('-');
}

function quitarFiltroHoja_(hoja) {
  if (!hoja) return;
  const filtro = hoja.getFilter();
  if (filtro) filtro.remove();
}

function asegurarEncabezadosProductos_(hoja) {
  crearHojaSiNoExiste_(hoja.getParent(), hoja.getName(), [
    'SKU', 'MARCA', 'PROVEEDOR', 'DESCRIPCION',
    'ACTIVO', 'OBSERVACIONES', 'ESTADO_ALTA'
  ]);
}

function aplicarValidacionEstadoAlta_(hoja) {
  if (!hoja || hoja.getMaxRows() < 2) return;
  const encabezados = hoja.getRange(1, 1, 1, hoja.getLastColumn()).getDisplayValues()[0];
  const indice = mapaEncabezados_(encabezados).get('ESTADO_ALTA');
  if (indice === undefined) return;

  const validacion = SpreadsheetApp.newDataValidation()
    .requireValueInList(['PENDIENTE_BAM', 'ACTIVO', 'INACTIVO', 'REVISAR'], true)
    .setAllowInvalid(true)
    .build();
  hoja.getRange(2, indice + 1, hoja.getMaxRows() - 1, 1).setDataValidation(validacion);
}

function coreEncabezado_(valor) {
  return normalizar_(valor);
}

function coreTexto_(valor) {
  if (valor === null || valor === undefined) return '';
  return String(valor).replace(/\u00A0/g, ' ').trim();
}

function probarCoreV64002() {
  Logger.log('CORE_OK');
  Logger.log(typeof obtenerHoja_);
  Logger.log(typeof leerFilasComoObjetos_);
}
