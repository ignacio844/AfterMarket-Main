/**************************************************************
 * SII V6.4.001
 * MÓDULO: MAPEO UNIVERSAL DE STOCK
 *
 * Objetivo:
 * - Mantener la hoja STOCK tal como llega desde BAM.
 * - Resolver cada SKU mediante skuIdentityResolver().
 * - Agrupar Warnes, Escobar y otros depósitos por SKU canónico.
 *
 * Funciones públicas:
 * - construirIndiceStockUniversal(stockRegistros)
 * - obtenerResumenStockUniversal(sku, stockRegistros, filaPlan)
 * - obtenerResumenStockModelo_(stockRegistros, skuCanonico, filaPlan)
 * - probarStockUniversal()
 **************************************************************/

const SII_STOCK_MAPPER_V64001 = {
  VERSION: '6.4.001'
};

function construirIndiceStockUniversal(stockRegistros) {
  const registros =
    Array.isArray(stockRegistros)
      ? stockRegistros
      : [];

  const indiceStock = new Map();

  /*
   * Caché local de identidad:
   * cada SKU único se resuelve una sola vez,
   * aunque aparezca en Warnes y Escobar.
   */
  const identidadPorClave =
    new Map();

  /*
   * Cada ambigüedad se informa una sola vez.
   */
  const ambiguosInformados =
    new Set();

  /*
   * Se obtiene una sola vez el índice general de identidad.
   * La mayoría de los SKU de STOCK se resuelven por búsqueda
   * exacta O(1), sin ejecutar la búsqueda por sufijo.
   */
  const indiceIdentidad =
    (
      typeof skuIdentityConstruirIndice ===
      'function'
    )
      ? skuIdentityConstruirIndice(false)
      : null;

  registros.forEach((reg, posicion) => {
    reg = reg || {};

    const skuOrigen =
      stmPrimerTexto_(
        reg.SKU,
        reg.CODIGO,
        reg.CODIGO_STOCK,
        reg.COD_BAM
      );

    if (!skuOrigen) {
      return;
    }

    const claveOrigen =
      stmNormalizarClave_(
        skuOrigen
      );

    if (!claveOrigen) {
      return;
    }

    let identidad =
      identidadPorClave.get(
        claveOrigen
      );

    if (!identidad) {
      identidad =
        stmResolverIdentidadRapida_(
          skuOrigen,
          indiceIdentidad
        );

      if (identidad.ambiguo) {
        if (
          !ambiguosInformados.has(
            claveOrigen
          )
        ) {
          console.warn(
            'SKU ambiguo en STOCK: "' +
            skuOrigen +
            '". Se conserva con su código original. Candidatos: ' +
            (
              identidad.candidatos || []
            ).join(', ')
          );

          ambiguosInformados.add(
            claveOrigen
          );
        }

        /*
         * Una ambigüedad real no debe bloquear todo el proceso
         * ni mezclar productos sin evidencia suficiente.
         */
        identidad = {
          ambiguo: false,
          skuCanonico: skuOrigen,
          codigoNuevo: skuOrigen,
          codigoStock: skuOrigen,
          candidatos:
            identidad.candidatos || [],
          origen:
            'AMBIGUO_CONSERVADO_ORIGINAL'
        };
      }

      identidadPorClave.set(
        claveOrigen,
        identidad
      );
    }

    const skuCanonico =
      stmPrimerTexto_(
        identidad.codigoStock,
        identidad.codigoNuevo,
        identidad.skuCanonico,
        skuOrigen
      );

    const claveCanonica =
      stmNormalizarClave_(
        skuCanonico
      );

    if (!claveCanonica) {
      return;
    }

    const cantidad =
      stmPrimerNumero_(
        reg.STOCK_DISPONIBLE,
        reg.STOCK,
        reg.CANTIDAD,
        reg.EXISTENCIA
      );

    const deposito =
      stmNormalizarTexto_(
        reg.DEPOSITO
      );

    if (
      !indiceStock.has(
        claveCanonica
      )
    ) {
      indiceStock.set(
        claveCanonica,
        {
          skuCanonico:
            skuCanonico,

          stockDisponible:
            0,

          stockWarnes:
            0,

          stockEscobar:
            0,

          stockOtros:
            0,

          total:
            0,

          codigosOrigen:
            [],

          lineas:
            []
        }
      );
    }

    const resumen =
      indiceStock.get(
        claveCanonica
      );

    resumen.stockDisponible +=
      cantidad;

    resumen.total +=
      cantidad;

    if (
      deposito.includes('WARNES')
    ) {
      resumen.stockWarnes +=
        cantidad;

    } else if (
      deposito.includes('ESCOBAR')
    ) {
      resumen.stockEscobar +=
        cantidad;

    } else {
      resumen.stockOtros +=
        cantidad;
    }

    if (
      !resumen.codigosOrigen.some(
        codigo =>
          stmNormalizarClave_(codigo) ===
          claveOrigen
      )
    ) {
      resumen.codigosOrigen.push(
        skuOrigen
      );
    }

    resumen.lineas.push({
      fila:
        posicion + 2,

      skuOrigen:
        skuOrigen,

      skuCanonico:
        skuCanonico,

      deposito:
        deposito,

      cantidad:
        cantidad
    });
  });

  return indiceStock;
}

function obtenerResumenStockUniversal(sku, stockRegistros, filaPlan) {
  filaPlan = filaPlan || {};

  const identidad = stmResolverIdentidad_(sku);

  if (identidad.ambiguo) {
    throw new Error(
      'El código "' + sku + '" tiene más de una equivalencia posible: ' +
      (identidad.candidatos || []).join(', ')
    );
  }

  const skuCanonico = stmPrimerTexto_(
    identidad.codigoStock,
    identidad.codigoNuevo,
    identidad.skuCanonico,
    sku
  );

  const claveCanonica = stmNormalizarClave_(skuCanonico);
  const indice = construirIndiceStockUniversal(stockRegistros);
  const encontrado = indice.get(claveCanonica);

  if (encontrado) {
    return {
      skuConsultado: stmLimpiarTexto_(sku),
      skuCanonico: encontrado.skuCanonico,
      stockDisponible: encontrado.stockDisponible,
      stockWarnes: encontrado.stockWarnes,
      stockEscobar: encontrado.stockEscobar,
      stockOtros: encontrado.stockOtros,
      total: encontrado.total,
      codigosOrigen: encontrado.codigosOrigen.slice(),
      lineas: encontrado.lineas.slice(),
      fuente: 'STOCK_MAPA_SKU'
    };
  }

  const respaldo = stmPrimerNumero_(
    filaPlan.STOCK_DISPONIBLE,
    filaPlan.STOCK_TOTAL
  );

  return {
    skuConsultado: stmLimpiarTexto_(sku),
    skuCanonico: skuCanonico,
    stockDisponible: respaldo,
    stockWarnes: 0,
    stockEscobar: 0,
    stockOtros: 0,
    total: respaldo,
    codigosOrigen: [],
    lineas: [],
    fuente: respaldo !== 0 ? 'PLAN_COMPRAS_RESPALDO' : 'SIN_STOCK'
  };
}

function obtenerResumenStockModelo_(stockRegistros, skuCanonico, filaPlan) {
  return obtenerResumenStockUniversal(
    skuCanonico,
    stockRegistros,
    filaPlan
  );
}


/**
 * Resolución rápida para lotes grandes.
 *
 * Prioridad:
 * 1. Índice exacto ya construido por sku_identity.
 * 2. Resolver completo únicamente cuando no hay coincidencia exacta.
 */
function stmResolverIdentidadRapida_(
  codigo,
  indiceIdentidad
) {
  const original =
    stmLimpiarTexto_(
      codigo
    );

  const clave =
    stmNormalizarClave_(
      original
    );

  if (
    clave &&
    indiceIdentidad &&
    indiceIdentidad.aliasACanonico &&
    indiceIdentidad.aliasACanonico[
      clave
    ]
  ) {
    const canonicos =
      stmUnicosPorClave_(
        indiceIdentidad.aliasACanonico[
          clave
        ]
      );

    if (
      canonicos.length === 1
    ) {
      return {
        ambiguo: false,
        skuCanonico:
          canonicos[0],
        codigoNuevo:
          canonicos[0],
        codigoStock:
          canonicos[0],
        candidatos:
          canonicos,
        origen:
          'INDICE_EXACTO'
      };
    }

    if (
      canonicos.length > 1
    ) {
      /*
       * El resolver completo puede aplicar reglas de autoridad
       * y resolver algunos conflictos aparentes.
       */
      return stmResolverIdentidad_(
        original
      );
    }
  }

  return stmResolverIdentidad_(
    original
  );
}


/**
 * Elimina duplicados sin distinguir mayúsculas,
 * minúsculas, espacios ni separadores.
 */
function stmUnicosPorClave_(
  valores
) {
  const salida = [];
  const vistas = new Set();

  (
    Array.isArray(valores)
      ? valores
      : []
  ).forEach(valor => {
    const texto =
      stmLimpiarTexto_(valor);

    const clave =
      stmNormalizarClave_(texto);

    if (
      !clave ||
      vistas.has(clave)
    ) {
      return;
    }

    vistas.add(clave);
    salida.push(texto);
  });

  return salida;
}


function stmResolverIdentidad_(codigo) {
  const original = stmLimpiarTexto_(codigo);

  if (!original) {
    return {
      skuCanonico: '',
      codigoNuevo: '',
      codigoStock: '',
      aliases: []
    };
  }

  if (typeof skuIdentityResolver !== 'function') {
    return {
      skuCanonico: original,
      codigoNuevo: original,
      codigoStock: original,
      aliases: [original],
      origen: 'SIN_SKU_IDENTITY_RESOLVER'
    };
  }

  const resultado = skuIdentityResolver(original) || {};
  const equivalencia = resultado.equivalencia || {};
  const aliases = [];

  function agregarAlias(valor) {
    const texto = stmLimpiarTexto_(valor);
    if (!texto) return;

    const clave = stmNormalizarClave_(texto);
    if (!aliases.some(existente =>
      stmNormalizarClave_(existente) === clave
    )) {
      aliases.push(texto);
    }
  }

  agregarAlias(original);

  (
    resultado.codigosEquivalentes ||
    resultado.aliases ||
    equivalencia.codigos ||
    []
  ).forEach(agregarAlias);

  agregarAlias(resultado.codigoBuscado);
  agregarAlias(resultado.codigoNuevo);
  agregarAlias(resultado.codigoStock);
  agregarAlias(resultado.skuCanonico);
  agregarAlias(equivalencia.codigoNuevo);
  agregarAlias(equivalencia.codigoViejo);
  agregarAlias(equivalencia.baseWarnes);
  agregarAlias(equivalencia.baseOctosis);
  agregarAlias(equivalencia.baseSisFactura);
  agregarAlias(equivalencia.baseMeliKobo);
  agregarAlias(equivalencia.baseTorettos);

  const codigoNuevo = stmPrimerTexto_(
    resultado.codigoNuevo,
    equivalencia.codigoNuevo,
    resultado.skuCanonico,
    original
  );

  const codigoStock = stmPrimerTexto_(
    resultado.codigoStock,
    equivalencia.baseWarnes,
    equivalencia.baseOctosis,
    codigoNuevo,
    original
  );

  return {
    skuCanonico: codigoNuevo,
    codigoNuevo: codigoNuevo,
    codigoStock: codigoStock,
    aliases: aliases,
    candidatos: resultado.candidatos || [],
    ambiguo: Boolean(resultado.ambiguo),
    origen: resultado.origen || ''
  };
}

function probarStockUniversal() {
  const ss = SpreadsheetApp.getActive();

  const nombreHoja = (
    typeof SII_CFG !== 'undefined' &&
    SII_CFG.SHEETS &&
    SII_CFG.SHEETS.STOCK
  ) ? SII_CFG.SHEETS.STOCK : 'STOCK';

  const sh = ss.getSheetByName(nombreHoja);

  if (!sh) {
    throw new Error('No existe la hoja STOCK.');
  }

  const registros = (
    typeof leerFilasComoObjetos_ === 'function'
  ) ? leerFilasComoObjetos_(sh) : stmLeerHojaComoObjetos_(sh);

  const resumen = obtenerResumenStockUniversal(
    'KO12065PR',
    registros,
    {}
  );

  Logger.log(JSON.stringify(resumen, null, 2));

  SpreadsheetApp.getActive().toast(
    'Stock universal: ' + resumen.stockDisponible,
    resumen.skuCanonico,
    8
  );

  return resumen;
}

function stmLeerHojaComoObjetos_(sh) {
  const datos = sh.getDataRange().getValues();
  if (datos.length < 2) return [];

  const encabezados = datos[0].map(stmNormalizarEncabezado_);

  return datos.slice(1)
    .filter(fila => fila.some(valor => valor !== '' && valor !== null))
    .map(fila => {
      const obj = {};
      encabezados.forEach((encabezado, indice) => {
        if (encabezado) obj[encabezado] = fila[indice];
      });
      return obj;
    });
}

function stmNormalizarEncabezado_(valor) {
  return stmLimpiarTexto_(valor)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/\s+/g, '_');
}

function stmNormalizarClave_(valor) {
  return stmLimpiarTexto_(valor)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
}

function stmNormalizarTexto_(valor) {
  return stmLimpiarTexto_(valor)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function stmLimpiarTexto_(valor) {
  return String(
    valor === null || valor === undefined ? '' : valor
  ).trim();
}

function stmPrimerTexto_() {
  for (let i = 0; i < arguments.length; i++) {
    const texto = stmLimpiarTexto_(arguments[i]);
    if (texto) return texto;
  }
  return '';
}

function stmPrimerNumero_() {
  for (let i = 0; i < arguments.length; i++) {
    const valor = arguments[i];

    if (
      valor === null ||
      valor === undefined ||
      stmLimpiarTexto_(valor) === ''
    ) {
      continue;
    }

    const numero = stmNumero_(valor);
    if (Number.isFinite(numero)) return numero;
  }

  return 0;
}

function stmNumero_(valor) {
  if (typeof valor === 'number') {
    return Number.isFinite(valor) ? valor : 0;
  }

  let texto = stmLimpiarTexto_(valor);
  if (!texto) return 0;

  texto = texto.replace(/[^\d,.-]/g, '');

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
  return Number.isFinite(numero) ? numero : 0;
}
