/*******************************************************
 * SII V5.9.007
 * MÓDULO CENTRAL DE PARÁMETROS
 *
 * Hoja esperada:
 * PARAMETROS
 *
 * Estructura:
 * A = TIPO
 * B = CLAVE
 * C = VALOR
 * D = DESCRIPCION
 * E = ACTIVO
 *******************************************************/

const SII_PARAMETROS = {
  HOJA: 'PARAMETROS',
  CACHE_KEY: 'SII_PARAMETROS_V59007',
  CACHE_SECONDS: 300
};

function cargarParametros() {
  const cache = CacheService.getDocumentCache();
  const cacheado = cache.get(SII_PARAMETROS.CACHE_KEY);

  if (cacheado) {
    try {
      return JSON.parse(cacheado);
    } catch (error) {}
  }

  const ss = SpreadsheetApp.getActive();
  const sh = ss.getSheetByName(SII_PARAMETROS.HOJA);

  if (!sh) {
    throw new Error('No existe la hoja PARAMETROS.');
  }

  const datos = sh.getDataRange().getDisplayValues();

  if (datos.length < 2) {
    return {};
  }

  const encabezados = datos[0].map(normalizarEncabezadoParametro_);

  const colTipo = buscarColumnaParametro_(encabezados, ['TIPO', 'GRUPO']);
  const colClave = buscarColumnaParametro_(encabezados, ['CLAVE', 'PARAMETRO']);
  const colValor = buscarColumnaParametro_(encabezados, ['VALOR', 'VALUE']);
  const colActivo = buscarColumnaParametro_(encabezados, ['ACTIVO', 'HABILITADO']);

  if (colTipo === -1 || colClave === -1 || colValor === -1) {
    throw new Error(
      'PARAMETROS debe contener las columnas TIPO, CLAVE y VALOR.'
    );
  }

  const resultado = {};

  for (let fila = 1; fila < datos.length; fila++) {
    const registro = datos[fila];
    const tipo = normalizarClaveParametro_(registro[colTipo]);
    const clave = normalizarClaveParametro_(registro[colClave]);

    if (!tipo || !clave) continue;

    if (
      colActivo !== -1 &&
      !esParametroActivo_(registro[colActivo])
    ) {
      continue;
    }

    if (!resultado[tipo]) {
      resultado[tipo] = {};
    }

    resultado[tipo][clave] = convertirValorParametro_(registro[colValor]);
  }

  try {
    cache.put(
      SII_PARAMETROS.CACHE_KEY,
      JSON.stringify(resultado),
      SII_PARAMETROS.CACHE_SECONDS
    );
  } catch (error) {
    Logger.log('No se pudo cachear PARAMETROS: ' + error.message);
  }

  return resultado;
}

function obtenerParametro(tipo, clave, valorDefault) {
  const parametros = cargarParametros();
  const tipoNormalizado = normalizarClaveParametro_(tipo);
  const claveNormalizada = normalizarClaveParametro_(clave);

  if (
    parametros[tipoNormalizado] &&
    Object.prototype.hasOwnProperty.call(
      parametros[tipoNormalizado],
      claveNormalizada
    )
  ) {
    return parametros[tipoNormalizado][claveNormalizada];
  }

  return valorDefault;
}

function obtenerParametroNumero(tipo, clave, valorDefault) {
  const valor = obtenerParametro(tipo, clave, valorDefault);

  if (
    valor === null ||
    valor === undefined ||
    String(valor).trim() === ''
  ) {
    return valorDefault;
  }

  if (typeof valor === 'number') {
    return Number.isFinite(valor) ? valor : valorDefault;
  }

  let texto = String(valor).trim().replace(/[^\d,.-]/g, '');

  if (texto.includes(',') && texto.includes('.')) {
    if (texto.lastIndexOf(',') > texto.lastIndexOf('.')) {
      texto = texto.replace(/\./g, '').replace(',', '.');
    } else {
      texto = texto.replace(/,/g, '');
    }
  } else if (texto.includes(',')) {
    texto = texto.replace(',', '.');
  }

  const numero = Number(texto);
  return Number.isFinite(numero) ? numero : valorDefault;
}

function obtenerParametroTexto(tipo, clave, valorDefault) {
  const valor = obtenerParametro(tipo, clave, valorDefault);

  if (valor === null || valor === undefined) {
    return valorDefault || '';
  }

  return String(valor).trim();
}

function obtenerParametroBoolean(tipo, clave, valorDefault) {
  const valor = obtenerParametro(tipo, clave, valorDefault);

  if (typeof valor === 'boolean') {
    return valor;
  }

  const texto = normalizarClaveParametro_(valor);

  if (['SI', 'S', 'TRUE', 'VERDADERO', '1', 'ACTIVO'].includes(texto)) {
    return true;
  }

  if (['NO', 'N', 'FALSE', 'FALSO', '0', 'INACTIVO'].includes(texto)) {
    return false;
  }

  return Boolean(valorDefault);
}

function obtenerParametrosGrupo(tipo) {
  const parametros = cargarParametros();
  const tipoNormalizado = normalizarClaveParametro_(tipo);

  return parametros[tipoNormalizado]
    ? Object.assign({}, parametros[tipoNormalizado])
    : {};
}

function obtenerCoberturaMarca(marca, valorDefault) {
  const coberturaMarca = obtenerParametroNumero(
    'COBERTURA_MARCA',
    marca,
    null
  );

  if (coberturaMarca !== null) {
    return coberturaMarca;
  }

  const coberturaDefaultMarca = obtenerParametroNumero(
    'COBERTURA_MARCA',
    'DEFAULT',
    null
  );

  if (coberturaDefaultMarca !== null) {
    return coberturaDefaultMarca;
  }

  return obtenerParametroNumero(
    'COBERTURA',
    'DEFAULT_MESES',
    valorDefault === undefined ? 4 : valorDefault
  );
}

function obtenerDiasLogisticos() {
  return {
    aIngresar: obtenerParametroNumero(
      'LOGISTICA',
      'DIAS_A_INGRESAR',
      10
    ),
    embarcado: obtenerParametroNumero(
      'LOGISTICA',
      'DIAS_EMBARCADO',
      45
    ),
    aEmbarcar: obtenerParametroNumero(
      'LOGISTICA',
      'DIAS_A_EMBARCAR',
      90
    ),
    enFabrica: obtenerParametroNumero(
      'LOGISTICA',
      'DIAS_EN_FABRICA',
      120
    ),
    bufferRecepcion: obtenerParametroNumero(
      'LOGISTICA',
      'BUFFER_RECEPCION',
      0
    )
  };
}

function limpiarCacheParametros() {
  CacheService
    .getDocumentCache()
    .remove(SII_PARAMETROS.CACHE_KEY);

  SpreadsheetApp.getActive().toast(
    'Cache de parámetros limpiada.',
    'Parámetros',
    4
  );
}

function probarParametros() {
  limpiarCacheParametros();

  const parametros =
    cargarParametros();

  const diasLogisticos =
    obtenerDiasLogisticos();

  Logger.log(
    JSON.stringify(
      parametros,
      null,
      2
    )
  );

  Logger.log(
    JSON.stringify(
      diasLogisticos,
      null,
      2
    )
  );

  SpreadsheetApp
    .getActive()
    .toast(
      'Parámetros cargados correctamente.',
      'Parámetros',
      5
    );

  return {
    parametros: parametros,
    diasLogisticos:
      diasLogisticos
  };
}

function convertirValorParametro_(valor) {
  const texto = String(
    valor === null || valor === undefined ? '' : valor
  ).trim();

  if (!texto) {
    return '';
  }

  const normalizado = normalizarClaveParametro_(texto);

  if (['TRUE', 'VERDADERO'].includes(normalizado)) {
    return true;
  }

  if (['FALSE', 'FALSO'].includes(normalizado)) {
    return false;
  }

  let textoNumero = texto.replace(/[^\d,.-]/g, '');

  if (textoNumero && /^-?[\d.,]+$/.test(textoNumero)) {
    if (
      textoNumero.includes(',') &&
      textoNumero.includes('.')
    ) {
      if (
        textoNumero.lastIndexOf(',') >
        textoNumero.lastIndexOf('.')
      ) {
        textoNumero = textoNumero
          .replace(/\./g, '')
          .replace(',', '.');
      } else {
        textoNumero = textoNumero.replace(/,/g, '');
      }
    } else if (textoNumero.includes(',')) {
      textoNumero = textoNumero.replace(',', '.');
    }

    const numero = Number(textoNumero);

    if (Number.isFinite(numero)) {
      return numero;
    }
  }

  return texto;
}

function esParametroActivo_(valor) {
  const texto = normalizarClaveParametro_(valor);

  if (!texto) {
    return true;
  }

  return ![
    'NO',
    'N',
    'FALSE',
    'FALSO',
    '0',
    'INACTIVO'
  ].includes(texto);
}

function buscarColumnaParametro_(encabezados, candidatos) {
  for (let i = 0; i < candidatos.length; i++) {
    const clave = normalizarEncabezadoParametro_(candidatos[i]);
    const indice = encabezados.indexOf(clave);

    if (indice !== -1) {
      return indice;
    }
  }

  return -1;
}

function normalizarEncabezadoParametro_(valor) {
  return normalizarClaveParametro_(valor);
}

function normalizarClaveParametro_(valor) {
  return String(
    valor === null || valor === undefined ? '' : valor
  )
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/\s+/g, '_')
    .replace(/-+/g, '_');
}

