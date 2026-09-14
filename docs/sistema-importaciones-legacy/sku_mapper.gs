/*******************************************************
 * SII V6.0 - MAPA CENTRAL DE EQUIVALENCIAS DE SKU
 *
 * Fuente oficial:
 *   Hoja MAPA_SKU
 *
 * Columnas esperadas:
 *   A Código_Nuevo
 *   B Código_Viejo
 *   C Descripción
 *   D Base_Octosis
 *   E Base_SisFactura
 *   F Base_MeliKobo
 *   G Base_Torettos
 *   H Base_Warnes
 *   I ACTIVO BAM
 *   J ACTIVO WEB
 *******************************************************/


const SII_SKU_MAP = {

  SHEET_NAME: 'MAPA_SKU',

  HEADERS: {
    CODIGO_NUEVO: 'CODIGO_NUEVO',
    CODIGO_VIEJO: 'CODIGO_VIEJO',
    DESCRIPCION: 'DESCRIPCION',
    BASE_OCTOSIS: 'BASE_OCTOSIS',
    BASE_SISFACTURA: 'BASE_SISFACTURA',
    BASE_MELIKOBO: 'BASE_MELIKOBO',
    BASE_TORETTOS: 'BASE_TORETTOS',
    BASE_WARNES: 'BASE_WARNES',
    ACTIVO_BAM: 'ACTIVO BAM',
    ACTIVO_WEB: 'ACTIVO WEB'
  }

};


/**
 * Construye todos los índices de equivalencia de SKU.
 *
 * Devuelve:
 *
 * {
 *   porCualquierCodigo: Map,
 *   porCodigoNuevo: Map,
 *   filas: []
 * }
 */
function construirMapaSku_() {
  const ss = SpreadsheetApp.getActive();

  const sh = ss.getSheetByName(
    SII_SKU_MAP.SHEET_NAME
  );

  if (!sh) {
    throw new Error(
      'No existe la hoja MAPA_SKU.'
    );
  }

  const datos = sh
    .getDataRange()
    .getDisplayValues();

  if (datos.length < 2) {
    return {
      porCualquierCodigo: new Map(),
      porCodigoNuevo: new Map(),
      filas: []
    };
  }

  const encabezados =
    construirIndiceEncabezadosSku_(
      datos[0]
    );

  const columnas = {
    codigoNuevo:
      requerirColumnaMapaSku_(
        encabezados,
        [
          'CODIGO_NUEVO',
          'CÓDIGO_NUEVO',
          'CODIGO NUEVO'
        ]
      ),

    codigoViejo:
      buscarColumnaMapaSku_(
        encabezados,
        [
          'CODIGO_VIEJO',
          'CÓDIGO_VIEJO',
          'CODIGO VIEJO'
        ]
      ),

    descripcion:
      buscarColumnaMapaSku_(
        encabezados,
        [
          'DESCRIPCION',
          'DESCRIPCIÓN'
        ]
      ),

    baseOctosis:
      buscarColumnaMapaSku_(
        encabezados,
        [
          'BASE_OCTOSIS',
          'BASE OCTOSIS'
        ]
      ),

    baseSisFactura:
      buscarColumnaMapaSku_(
        encabezados,
        [
          'BASE_SISFACTURA',
          'BASE SISFACTURA'
        ]
      ),

    baseMeliKobo:
      buscarColumnaMapaSku_(
        encabezados,
        [
          'BASE_MELIKOBO',
          'BASE MELIKOBO'
        ]
      ),

    baseTorettos:
      buscarColumnaMapaSku_(
        encabezados,
        [
          'BASE_TORETTOS',
          'BASE TORETTOS'
        ]
      ),

    baseWarnes:
      buscarColumnaMapaSku_(
        encabezados,
        [
          'BASE_WARNES',
          'BASE WARNES'
        ]
      ),

    activoBam:
      buscarColumnaMapaSku_(
        encabezados,
        [
          'ACTIVO BAM',
          'ACTIVO_BAM'
        ]
      ),

    activoWeb:
      buscarColumnaMapaSku_(
        encabezados,
        [
          'ACTIVO WEB',
          'ACTIVO_WEB'
        ]
      )
  };

  const porCualquierCodigo = new Map();
  const porCodigoNuevo = new Map();
  const filas = [];

  datos.slice(1).forEach((fila, indice) => {
    const codigoNuevo =
      obtenerValorFilaMapaSku_(
        fila,
        columnas.codigoNuevo
      );

    if (!codigoNuevo) {
      return;
    }

    const registro = {
      fila: indice + 2,

      codigoNuevo: codigoNuevo,

      codigoViejo:
        obtenerValorFilaMapaSku_(
          fila,
          columnas.codigoViejo
        ),

      descripcion:
        obtenerValorFilaMapaSku_(
          fila,
          columnas.descripcion
        ),

      baseOctosis:
        obtenerValorFilaMapaSku_(
          fila,
          columnas.baseOctosis
        ),

      baseSisFactura:
        obtenerValorFilaMapaSku_(
          fila,
          columnas.baseSisFactura
        ),

      baseMeliKobo:
        obtenerValorFilaMapaSku_(
          fila,
          columnas.baseMeliKobo
        ),

      baseTorettos:
        obtenerValorFilaMapaSku_(
          fila,
          columnas.baseTorettos
        ),

      baseWarnes:
        obtenerValorFilaMapaSku_(
          fila,
          columnas.baseWarnes
        ),

      activoBam:
        obtenerValorFilaMapaSku_(
          fila,
          columnas.activoBam
        ),

      activoWeb:
        obtenerValorFilaMapaSku_(
          fila,
          columnas.activoWeb
        )
    };

    registro.codigos = [
      registro.codigoNuevo,
      registro.codigoViejo,
      registro.baseOctosis,
      registro.baseSisFactura,
      registro.baseMeliKobo,
      registro.baseTorettos,
      registro.baseWarnes
    ].filter(Boolean);

    filas.push(registro);

    const claveNuevo =
      normalizarSkuMapa_(
        registro.codigoNuevo
      );

    if (claveNuevo) {
      porCodigoNuevo.set(
        claveNuevo,
        registro
      );
    }

    registro.codigos.forEach(codigo => {
      const clave =
        normalizarSkuMapa_(codigo);

      if (!clave) {
        return;
      }

      /*
       * Si un código está duplicado, no se pisa
       * silenciosamente una equivalencia anterior.
       */
      if (
        porCualquierCodigo.has(clave) &&
        porCualquierCodigo.get(clave)
          .codigoNuevo !== registro.codigoNuevo
      ) {
        console.warn(
          'Código duplicado en MAPA_SKU: ' +
          codigo +
          '. Filas ' +
          porCualquierCodigo.get(clave).fila +
          ' y ' +
          registro.fila
        );

        return;
      }

      porCualquierCodigo.set(
        clave,
        registro
      );
    });
  });

  return {
    porCualquierCodigo:
      porCualquierCodigo,

    porCodigoNuevo:
      porCodigoNuevo,

    filas:
      filas
  };
}


/**
 * Devuelve la equivalencia completa de un código.
 */
function obtenerEquivalenciaSku_(
  codigo,
  mapaSku
) {
  const mapa =
    mapaSku ||
    construirMapaSku_();

  const clave =
    normalizarSkuMapa_(codigo);

  if (!clave) {
    return null;
  }

  return (
    mapa.porCualquierCodigo.get(clave) ||
    null
  );
}


/**
 * Devuelve el Código_Nuevo correspondiente.
 *
 * Si el código no está en MAPA_SKU,
 * devuelve el código original.
 */
function obtenerCodigoNuevoSku_(
  codigo,
  mapaSku
) {
  const equivalencia =
    obtenerEquivalenciaSku_(
      codigo,
      mapaSku
    );

  return equivalencia
    ? equivalencia.codigoNuevo
    : limpiarSkuMapa_(codigo);
}


/**
 * Devuelve el código utilizado por Warnes/BAM.
 *
 * Prioridad:
 * 1. Base_Warnes
 * 2. Código_Nuevo
 * 3. Código original recibido
 */
function obtenerCodigoStockBam_(
  codigo,
  mapaSku
) {
  const equivalencia =
    obtenerEquivalenciaSku_(
      codigo,
      mapaSku
    );

  if (!equivalencia) {
    return limpiarSkuMapa_(codigo);
  }

  return (
    equivalencia.baseWarnes ||
    equivalencia.codigoNuevo ||
    limpiarSkuMapa_(codigo)
  );
}


/**
 * Devuelve todos los códigos equivalentes.
 */
function obtenerCodigosEquivalentesSku_(
  codigo,
  mapaSku
) {
  const equivalencia =
    obtenerEquivalenciaSku_(
      codigo,
      mapaSku
    );

  if (!equivalencia) {
    const original =
      limpiarSkuMapa_(codigo);

    return original
      ? [original]
      : [];
  }

  return [
    ...new Set(
      equivalencia.codigos
        .map(limpiarSkuMapa_)
        .filter(Boolean)
    )
  ];
}


/**
 * Determina si dos códigos corresponden
 * al mismo producto.
 */
function sonSkuEquivalentes_(
  codigoA,
  codigoB,
  mapaSku
) {
  const claveA =
    normalizarSkuMapa_(
      obtenerCodigoNuevoSku_(
        codigoA,
        mapaSku
      )
    );

  const claveB =
    normalizarSkuMapa_(
      obtenerCodigoNuevoSku_(
        codigoB,
        mapaSku
      )
    );

  return Boolean(
    claveA &&
    claveB &&
    claveA === claveB
  );
}


/**
 * Crea un mapa de stock usando Código_Nuevo
 * como clave universal.
 *
 * El mapaStockOriginal debe tener:
 *
 * clave SKU -> cantidad
 */
function convertirMapaStockAUniversal_(
  mapaStockOriginal,
  mapaSku
) {
  const mapa =
    mapaSku ||
    construirMapaSku_();

  const resultado = new Map();

  mapaStockOriginal.forEach(
    (cantidad, skuOriginal) => {
      const codigoNuevo =
        obtenerCodigoNuevoSku_(
          skuOriginal,
          mapa
        );

      const clave =
        normalizarSkuMapa_(
          codigoNuevo
        );

      if (!clave) {
        return;
      }

      const anterior =
        resultado.get(clave) || 0;

      resultado.set(
        clave,
        anterior +
        convertirNumeroMapaSku_(cantidad)
      );
    }
  );

  return resultado;
}


/**
 * Prueba manual de equivalencia.
 *
 * Cambiar el código para probar otros SKU.
 */
function probarMapaSkuV6_() {
  const codigo = 'KO12065PR';

  const mapa =
    construirMapaSku_();

  const equivalencia =
    obtenerEquivalenciaSku_(
      codigo,
      mapa
    );

  Logger.log({
    codigoBuscado: codigo,
    equivalencia: equivalencia,
    codigoNuevo:
      obtenerCodigoNuevoSku_(
        codigo,
        mapa
      ),
    codigoStock:
      obtenerCodigoStockBam_(
        codigo,
        mapa
      ),
    codigosEquivalentes:
      obtenerCodigosEquivalentesSku_(
        codigo,
        mapa
      )
  });
}


/*******************************************************
 * FUNCIONES INTERNAS
 *******************************************************/


function construirIndiceEncabezadosSku_(
  encabezados
) {
  const mapa = new Map();

  encabezados.forEach((valor, indice) => {
    const clave =
      normalizarEncabezadoMapaSku_(
        valor
      );

    if (clave) {
      mapa.set(clave, indice);
    }
  });

  return mapa;
}


function buscarColumnaMapaSku_(
  mapaEncabezados,
  alternativas
) {
  for (
    let i = 0;
    i < alternativas.length;
    i++
  ) {
    const clave =
      normalizarEncabezadoMapaSku_(
        alternativas[i]
      );

    if (mapaEncabezados.has(clave)) {
      return mapaEncabezados.get(clave);
    }
  }

  return -1;
}


function requerirColumnaMapaSku_(
  mapaEncabezados,
  alternativas
) {
  const indice =
    buscarColumnaMapaSku_(
      mapaEncabezados,
      alternativas
    );

  if (indice < 0) {
    throw new Error(
      'Falta una columna requerida en MAPA_SKU: ' +
      alternativas.join(' / ')
    );
  }

  return indice;
}


function obtenerValorFilaMapaSku_(
  fila,
  indice
) {
  if (
    indice === null ||
    indice === undefined ||
    indice < 0
  ) {
    return '';
  }

  return limpiarSkuMapa_(
    fila[indice]
  );
}


function limpiarSkuMapa_(valor) {
  return String(
    valor === null ||
    valor === undefined
      ? ''
      : valor
  ).trim();
}


function normalizarSkuMapa_(valor) {
  return limpiarSkuMapa_(valor)
    .normalize('NFD')
    .replace(
      /[\u0300-\u036f]/g,
      ''
    )
    .toUpperCase()
    .replace(/\s+/g, '')
    .trim();
}


function normalizarEncabezadoMapaSku_(
  valor
) {
  return limpiarSkuMapa_(valor)
    .normalize('NFD')
    .replace(
      /[\u0300-\u036f]/g,
      ''
    )
    .toUpperCase()
    .replace(/[\s\-]+/g, '_')
    .replace(/_+/g, '_')
    .trim();
}


function convertirNumeroMapaSku_(valor) {
  if (typeof valor === 'number') {
    return Number.isFinite(valor)
      ? valor
      : 0;
  }

  let texto = String(
    valor === null ||
    valor === undefined
      ? ''
      : valor
  )
    .trim()
    .replace(/\s/g, '');

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

  return Number.isFinite(numero)
    ? numero
    : 0;
}

function testMapaSku() {
  probarMapaSkuV6_();
}
