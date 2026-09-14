/*******************************************************
 * SII V2
 * PARÁMETROS DEL MOTOR DE COMPRAS
 *******************************************************/

const SII_PARAMETROS_COMPRAS = {
  HOJA: 'PARAMETROS_COMPRAS',

  GENERALES: {
    PORCENTAJE_ESCOBAR: 85,
    PORCENTAJE_WARNES: 15,
    COBERTURA_DEFAULT_MESES: 4,
    COBERTURA_URGENTE_MESES: 1,
    COBERTURA_COMPRAR_MESES: 2,

    PRIORIDAD_SIN_STOCK: 100,
    PRIORIDAD_URGENTE: 90,
    PRIORIDAD_COMPRAR: 80,
    PRIORIDAD_TRANSFERIR: 60,
    PRIORIDAD_REVISAR: 40,
    PRIORIDAD_OK: 0
  }
};


/**
 * Lee y valida todos los parámetros del motor de compras.
 *
 * Devuelve:
 *
 * {
 *   generales: {
 *     porcentajeEscobar: 85,
 *     porcentajeWarnes: 15,
 *     coberturaDefaultMeses: 4,
 *     coberturaUrgenteMeses: 1,
 *     coberturaComprarMeses: 2,
 *     prioridadSinStock: 100,
 *     prioridadUrgente: 90,
 *     prioridadComprar: 80,
 *     prioridadTransferir: 60,
 *     prioridadRevisar: 40,
 *     prioridadOk: 0
 *   },
 *
 *   coberturaPorMarca: Map()
 * }
 */
function cargarParametrosCompras_() {
  const ss = SpreadsheetApp.getActive();

  const sh = ss.getSheetByName(
    SII_PARAMETROS_COMPRAS.HOJA
  );

  if (!sh) {
    throw new Error(
      'No existe la hoja PARAMETROS_COMPRAS.'
    );
  }

  const filas = leerFilasComoObjetos_(sh);

  const generales = {
    porcentajeEscobar:
      SII_PARAMETROS_COMPRAS.GENERALES
        .PORCENTAJE_ESCOBAR,

    porcentajeWarnes:
      SII_PARAMETROS_COMPRAS.GENERALES
        .PORCENTAJE_WARNES,

    coberturaDefaultMeses:
      SII_PARAMETROS_COMPRAS.GENERALES
        .COBERTURA_DEFAULT_MESES,

    coberturaUrgenteMeses:
      SII_PARAMETROS_COMPRAS.GENERALES
        .COBERTURA_URGENTE_MESES,

    coberturaComprarMeses:
      SII_PARAMETROS_COMPRAS.GENERALES
        .COBERTURA_COMPRAR_MESES,

    prioridadSinStock:
      SII_PARAMETROS_COMPRAS.GENERALES
        .PRIORIDAD_SIN_STOCK,

    prioridadUrgente:
      SII_PARAMETROS_COMPRAS.GENERALES
        .PRIORIDAD_URGENTE,

    prioridadComprar:
      SII_PARAMETROS_COMPRAS.GENERALES
        .PRIORIDAD_COMPRAR,

    prioridadTransferir:
      SII_PARAMETROS_COMPRAS.GENERALES
        .PRIORIDAD_TRANSFERIR,

    prioridadRevisar:
      SII_PARAMETROS_COMPRAS.GENERALES
        .PRIORIDAD_REVISAR,

    prioridadOk:
      SII_PARAMETROS_COMPRAS.GENERALES
        .PRIORIDAD_OK
  };

  const coberturaPorMarca = new Map();

  filas.forEach(reg => {
    const activo = normalizarTextoCompras_(
      reg.ACTIVO
    );

    if (
      activo &&
      activo !== 'SI' &&
      activo !== 'S'
    ) {
      return;
    }

    const tipo = normalizarTextoCompras_(
      reg.TIPO
    );

    const clave = normalizarTextoCompras_(
      reg.CLAVE
    );

    const valor = numeroParametroCompras_(
      reg.VALOR
    );

    if (!tipo || !clave) {
      return;
    }

    if (tipo === 'GENERAL') {
      aplicarParametroGeneralCompras_(
        generales,
        clave,
        valor
      );

      return;
    }

    if (tipo === 'MARCA') {
      if (valor <= 0) {
        return;
      }

      coberturaPorMarca.set(
        clave,
        valor
      );
    }
  });


  /*****************************************************
   * VALIDACIONES
   *****************************************************/

  const sumaPorcentajes =
    generales.porcentajeEscobar +
    generales.porcentajeWarnes;

  if (
    Math.abs(sumaPorcentajes - 100) >
    0.0001
  ) {
    throw new Error(
      'Los porcentajes de Escobar y Warnes deben sumar 100. ' +
      'Actualmente suman ' +
      sumaPorcentajes +
      '.'
    );
  }

  if (
    generales.porcentajeEscobar < 0 ||
    generales.porcentajeWarnes < 0
  ) {
    throw new Error(
      'Los porcentajes de distribución no pueden ser negativos.'
    );
  }

  if (
    generales.coberturaDefaultMeses <= 0
  ) {
    throw new Error(
      'COBERTURA_DEFAULT_MESES debe ser mayor que cero.'
    );
  }

  if (
    generales.coberturaUrgenteMeses < 0
  ) {
    throw new Error(
      'COBERTURA_URGENTE_MESES no puede ser negativa.'
    );
  }

  if (
    generales.coberturaComprarMeses <
    generales.coberturaUrgenteMeses
  ) {
    throw new Error(
      'COBERTURA_COMPRAR_MESES no puede ser menor que ' +
      'COBERTURA_URGENTE_MESES.'
    );
  }

  /*
   * Si no se cargó MARCA / DEFAULT,
   * se utiliza la cobertura general.
   */
  if (!coberturaPorMarca.has('DEFAULT')) {
    coberturaPorMarca.set(
      'DEFAULT',
      generales.coberturaDefaultMeses
    );
  }

  return {
    generales: generales,
    coberturaPorMarca: coberturaPorMarca
  };
}


/**
 * Aplica un parámetro GENERAL leído desde la hoja.
 */
function aplicarParametroGeneralCompras_(
  generales,
  clave,
  valor
) {
  switch (clave) {
    case 'PORCENTAJE_ESCOBAR':
      generales.porcentajeEscobar = valor;
      break;

    case 'PORCENTAJE_WARNES':
      generales.porcentajeWarnes = valor;
      break;

    case 'COBERTURA_DEFAULT_MESES':
      generales.coberturaDefaultMeses = valor;
      break;

    case 'COBERTURA_URGENTE_MESES':
      generales.coberturaUrgenteMeses = valor;
      break;

    case 'COBERTURA_COMPRAR_MESES':
      generales.coberturaComprarMeses = valor;
      break;

    case 'PRIORIDAD_SIN_STOCK':
      generales.prioridadSinStock = valor;
      break;

    case 'PRIORIDAD_URGENTE':
      generales.prioridadUrgente = valor;
      break;

    case 'PRIORIDAD_COMPRAR':
      generales.prioridadComprar = valor;
      break;

    case 'PRIORIDAD_TRANSFERIR':
      generales.prioridadTransferir = valor;
      break;

    case 'PRIORIDAD_REVISAR':
      generales.prioridadRevisar = valor;
      break;

    case 'PRIORIDAD_OK':
      generales.prioridadOk = valor;
      break;

    default:
      /*
       * Se ignoran claves futuras o desconocidas.
       */
      break;
  }
}


/**
 * Devuelve la cobertura objetivo correspondiente a una marca.
 */
function obtenerCoberturaObjetivoCompras_(
  marca,
  parametros
) {
  const claveMarca =
    normalizarTextoCompras_(marca);

  if (
    claveMarca &&
    parametros.coberturaPorMarca.has(
      claveMarca
    )
  ) {
    return parametros.coberturaPorMarca.get(
      claveMarca
    );
  }

  return parametros.coberturaPorMarca.get(
    'DEFAULT'
  ) ||
  parametros.generales.coberturaDefaultMeses;
}


/**
 * Convierte el valor de PARAMETROS_COMPRAS a número.
 */
function numeroParametroCompras_(valor) {
  if (
    valor === null ||
    valor === undefined ||
    valor === ''
  ) {
    return 0;
  }

  if (typeof valor === 'number') {
    return Number.isFinite(valor)
      ? valor
      : 0;
  }

  let texto = String(valor)
    .trim()
    .replace(/\s/g, '');

  if (!texto) {
    return 0;
  }

  /*
   * Permite:
   * 85
   * 85%
   * 85,5
   * 85.5
   */
  texto = texto.replace('%', '');

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
      texto = texto.replace(/,/g, '');
    }

  } else if (texto.includes(',')) {
    texto = texto.replace(',', '.');
  }

  const numero = Number(texto);

  return Number.isFinite(numero)
    ? numero
    : 0;
}


/**
 * Normaliza claves, tipos y marcas.
 */
function normalizarTextoCompras_(valor) {
  return limpiarTexto_(valor)
    .normalize('NFD')
    .replace(
      /[\u0300-\u036f]/g,
      ''
    )
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim();
}


/**
 * Prueba manual para verificar los parámetros.
 */
function probarParametrosCompras() {
  const parametros =
    cargarParametrosCompras_();

  Logger.log(
    JSON.stringify(
      {
        generales:
          parametros.generales,

        marcas:
          [...parametros
            .coberturaPorMarca
            .entries()]
      },
      null,
      2
    )
  );

  SpreadsheetApp
    .getActive()
    .toast(
      'Parámetros de compras validados correctamente.',
      'SII V2',
      5
    );
}
