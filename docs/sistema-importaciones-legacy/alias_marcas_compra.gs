const SII_ALIAS_MARCAS_B19A2 = {
  VERSION: 'B.1.9-A.2',
  HOJA_ALIAS: 'ALIAS_MARCAS_COMPRA'
};

function inicializarAliasMarcasCompra() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(SII_ALIAS_MARCAS_B19A2.HOJA_ALIAS);
  if (!sh) sh = ss.insertSheet(SII_ALIAS_MARCAS_B19A2.HOJA_ALIAS);

  const headers = ['ALIAS','MARCA CONFIGURADA','ACTIVO','OBSERVACION'];
  sh.getRange(1,1,1,headers.length).setValues([headers])
    .setBackground('#123d6a').setFontColor('white').setFontWeight('bold');

  const existentes = new Set();
  if (sh.getLastRow() >= 2) {
    sh.getRange(2,1,sh.getLastRow()-1,2).getDisplayValues().forEach(function(r) {
      existentes.add(normalizarMarcaAlias_(r[0]) + '|' + normalizarMarcaAlias_(r[1]));
    });
  }

  const base = [
    ['HID - XENON','HID   XENON','SI','Equivalencia confirmada'],
    ['AFA SELECCION','AFA  SELECCION','SI','Equivalencia confirmada'],
    ['DUCK','DUCK BRAZOS','SI','Equivalencia confirmada']
  ];

  const agregar = base.filter(function(r) {
    return !existentes.has(normalizarMarcaAlias_(r[0]) + '|' + normalizarMarcaAlias_(r[1]));
  });

  if (agregar.length) sh.getRange(sh.getLastRow()+1,1,agregar.length,4).setValues(agregar);
  sh.setFrozenRows(1);
  sh.autoResizeColumns(1,4);

  const res = {version:SII_ALIAS_MARCAS_B19A2.VERSION, aliasAgregados:agregar.length,
               totalAlias:Math.max(0,sh.getLastRow()-1)};
  Logger.log(JSON.stringify(res,null,2));
  return res;
}

function obtenerMapaAliasMarcasCompra_(ss) {
  ss = ss || SpreadsheetApp.getActiveSpreadsheet();
  const mapa = new Map();
  const sh = ss.getSheetByName(SII_ALIAS_MARCAS_B19A2.HOJA_ALIAS);
  if (!sh || sh.getLastRow() < 2) return mapa;

  const datos = sh.getDataRange().getDisplayValues();
  const headers = datos[0].map(normalizarHeaderAlias_);
  const cAlias = headers.indexOf('ALIAS');
  const cMarca = headers.indexOf('MARCA_CONFIGURADA');
  const cActivo = headers.indexOf('ACTIVO');

  if (cAlias < 0 || cMarca < 0) throw new Error('ALIAS_MARCAS_COMPRA debe contener ALIAS y MARCA CONFIGURADA.');

  for (let f=1; f<datos.length; f++) {
    const activo = cActivo < 0 ? 'SI' : String(datos[f][cActivo] || '').trim().toUpperCase();
    if (activo && activo !== 'SI') continue;
    const alias = normalizarMarcaAlias_(datos[f][cAlias]);
    const marca = String(datos[f][cMarca] || '').trim();
    if (alias && marca) mapa.set(alias,marca);
  }
  return mapa;
}

function resolverMarcaCompra_(marca,mapaAlias) {
  const original = String(marca || '').trim();
  if (!original) return original;
  mapaAlias = mapaAlias || obtenerMapaAliasMarcasCompra_();
  return mapaAlias.get(normalizarMarcaAlias_(original)) || original;
}

function normalizarMarcaAlias_(valor) {
  return String(valor || '').replace(/\u00A0/g,' ').trim().toUpperCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .replace(/[-–—_]+/g,' ').replace(/\s+/g,' ');
}

function normalizarHeaderAlias_(valor) {
  return String(valor || '').replace(/\u00A0/g,' ').trim().toUpperCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .replace(/[^A-Z0-9]+/g,'_').replace(/^_+|_+$/g,'');
}

function validarAliasMarcasCompra() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName('CONFIG_MARCAS_COMPRA');
  if (!sh || sh.getLastRow() < 2) throw new Error('CONFIG_MARCAS_COMPRA no existe o está vacía.');

  const datos = sh.getDataRange().getDisplayValues();
  const headers = datos[0].map(normalizarHeaderAlias_);
  const cMarca = headers.indexOf('MARCA');
  if (cMarca < 0) throw new Error('CONFIG_MARCAS_COMPRA no contiene MARCA.');

  const config = new Set();
  for (let f=1; f<datos.length; f++) {
    const m = normalizarMarcaAlias_(datos[f][cMarca]);
    if (m) config.add(m);
  }

  const mapa = obtenerMapaAliasMarcasCompra_(ss);
  const faltantes = [];
  mapa.forEach(function(destino,alias) {
    if (!config.has(normalizarMarcaAlias_(destino))) {
      faltantes.push({alias:alias, marcaConfigurada:destino});
    }
  });

  const res = {version:SII_ALIAS_MARCAS_B19A2.VERSION, aliasActivos:mapa.size,
               destinosNoEncontrados:faltantes.length, detalle:faltantes};
  Logger.log(JSON.stringify(res,null,2));
  return res;
}
