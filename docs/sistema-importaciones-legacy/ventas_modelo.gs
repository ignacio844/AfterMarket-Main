/**************************************************************
 * SII V6.0.001
 * MÓDULO: MODELO DE DEMANDA / VENTAS
 *
 * Formato nuevo esperado en la hoja VENTAS:
 *
 * Código
 * Cod_BAM
 * Descripción
 * Jul_2025
 * Total_Jul_2025
 * Ago_2025
 * Total_Ago_2025
 * ...
 * Jul_2026
 * Total_Jul_2026
 * Total_Unidades_Netas
 * Total_Facturado_Neto_S_IVA
 * DTM
 * IMP
 * JNM
 * NLI
 * NLD
 *
 * Funciones públicas:
 *
 * - cargarHistoricoVentas(sku)
 * - cargarTodosLosModelosVentas()
 * - probarModeloVentas()
 *
 * El módulo detecta automáticamente los meses disponibles.
 * No depende de una cantidad fija de 12 o 13 meses.
 **************************************************************/

const SII_VENTAS_MODELO = {
  HOJA_DEFAULT: 'VENTAS',

  COLUMNAS_SKU: [
    'COD_BAM',
    'CODBAM',
    'SKU'
  ],

  COLUMNAS_CODIGO: [
    'CODIGO',
    'CÓDIGO'
  ],

  COLUMNAS_DESCRIPCION: [
    'DESCRIPCION',
    'DESCRIPCIÓN'
  ],

  EMPRESAS: [
    'DTM',
    'IMP',
    'JNM',
    'NLI',
    'NLD'
  ],

  MESES: {
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
  },

  CACHE_SEGUNDOS: 300
};


/**
 * Devuelve el modelo completo de demanda de un SKU.
 *
 * Ejemplo:
 *
 * const ventas = cargarHistoricoVentas('3M_42385');
 */
function cargarHistoricoVentas(sku) {
  const skuTexto =
    vmLimpiarTexto_(sku);

  if (!skuTexto) {
    throw new Error(
      'Debe informar un SKU.'
    );
  }

  const modelos =
    cargarTodosLosModelosVentas();

  const claveSku =
    vmNormalizarClaveSku_(
      skuTexto
    );

  if (
    !Object.prototype.hasOwnProperty.call(
      modelos,
      claveSku
    )
  ) {
    return vmModeloVacio_(
      skuTexto
    );
  }

  return modelos[claveSku];
}


/**
 * Lee la hoja VENTAS una sola vez y devuelve:
 *
 * {
 *   SKU_NORMALIZADO: modeloVentas,
 *   ...
 * }
 */
function cargarTodosLosModelosVentas() {
  const cache =
    CacheService.getDocumentCache();

  const cacheKey =
    'SII_VENTAS_MODELO_V6001';

  const cacheado =
    cache.get(cacheKey);

  if (cacheado) {
    try {
      return JSON.parse(cacheado);
    } catch (error) {
      // Continúa leyendo la hoja.
    }
  }

  const ss =
    SpreadsheetApp.getActive();

  const nombreHoja =
    (
      typeof SII_CFG !== 'undefined' &&
      SII_CFG.SHEETS &&
      SII_CFG.SHEETS.VENTAS
    )
      ? SII_CFG.SHEETS.VENTAS
      : SII_VENTAS_MODELO.HOJA_DEFAULT;

  const sh =
    ss.getSheetByName(
      nombreHoja
    );

  if (!sh) {
    throw new Error(
      'No existe la hoja "' +
      nombreHoja +
      '".'
    );
  }

  const datos =
    sh.getDataRange()
      .getDisplayValues();

  if (datos.length < 2) {
    return {};
  }

  const encabezados =
    datos[0];

  const mapa =
    vmConstruirMapaEncabezados_(
      encabezados
    );

  const colSku =
    vmBuscarColumna_(
      mapa,
      SII_VENTAS_MODELO
        .COLUMNAS_SKU
    );

  const colCodigo =
    vmBuscarColumna_(
      mapa,
      SII_VENTAS_MODELO
        .COLUMNAS_CODIGO
    );

  if (
    colSku === -1 &&
    colCodigo === -1
  ) {
    throw new Error(
      'No se encontró Cod_BAM, SKU ni Código en VENTAS.'
    );
  }

  const colDescripcion =
    vmBuscarColumna_(
      mapa,
      SII_VENTAS_MODELO
        .COLUMNAS_DESCRIPCION
    );

  const meses =
    vmDetectarColumnasMensuales_(
      encabezados
    );

  /*
   * Compatibilidad con el formato anterior:
   * SKU / CONSUMO_TOTAL / MESES / PROMEDIO_MENSUAL.
   */
  const formatoHistorico =
    meses.length > 0;

  const salida = {};

  for (
    let fila = 1;
    fila < datos.length;
    fila++
  ) {
    const registro =
      datos[fila];

    const skuBam =
      colSku === -1
        ? ''
        : vmLimpiarTexto_(
            registro[colSku]
          );

    const codigoProveedor =
      colCodigo === -1
        ? ''
        : vmLimpiarTexto_(
            registro[colCodigo]
          );

    const sku =
      skuBam ||
      codigoProveedor;

    if (!sku) {
      continue;
    }

    const descripcion =
      colDescripcion === -1
        ? ''
        : vmLimpiarTexto_(
            registro[
              colDescripcion
            ]
          );

    let modelo;

    if (formatoHistorico) {
      modelo =
        vmConstruirModeloHistorico_(
          registro,
          meses,
          encabezados,
          mapa,
          sku,
          codigoProveedor,
          descripcion
        );

    } else {
      modelo =
        vmConstruirModeloLegacy_(
          registro,
          mapa,
          sku,
          codigoProveedor,
          descripcion
        );
    }

    const clavesRegistro =
      vmClavesSkuRegistro_(
        skuBam,
        codigoProveedor
      );

    clavesRegistro.forEach(
      clave => {
        salida[clave] =
          vmCombinarModelos_(
            salida[clave],
            modelo
          );
      }
    );
  }

  /*
   * El cache se usa solo si el objeto cabe.
   */
  try {
    const json =
      JSON.stringify(salida);

    if (json.length < 95000) {
      cache.put(
        cacheKey,
        json,
        SII_VENTAS_MODELO
          .CACHE_SEGUNDOS
      );
    }
  } catch (error) {
    Logger.log(
      'No se pudo cachear ventas_modelo: ' +
      error.message
    );
  }

  return salida;
}


/**
 * Construye el modelo para el nuevo formato mensual.
 */
function vmConstruirModeloHistorico_(
  registro,
  meses,
  encabezados,
  mapa,
  sku,
  codigoProveedor,
  descripcion
) {
  const historicoMensual = [];

  meses.forEach(mes => {
    const unidades =
      vmNumero_(
        registro[
          mes.colUnidades
        ]
      );

    const facturacion =
      mes.colFacturacion === -1
        ? 0
        : vmNumero_(
            registro[
              mes.colFacturacion
            ]
          );

    historicoMensual.push({
      periodo:
        mes.periodo,

      anio:
        mes.anio,

      mes:
        mes.mes,

      mesNombre:
        mes.mesNombre,

      unidades:
        unidades,

      facturacion:
        facturacion
    });
  });

  historicoMensual.sort(
    (a, b) =>
      a.periodo.localeCompare(
        b.periodo
      )
  );

  const unidades =
    historicoMensual.map(
      reg => reg.unidades
    );

  const facturacion =
    historicoMensual.map(
      reg => reg.facturacion
    );

  const totalUnidadesCalculado =
    unidades.reduce(
      (acum, valor) =>
        acum + valor,
      0
    );

  const totalFacturadoCalculado =
    facturacion.reduce(
      (acum, valor) =>
        acum + valor,
      0
    );

  const totalUnidadesInformado =
    vmNumeroPorEncabezado_(
      registro,
      mapa,
      [
        'TOTAL_UNIDADES_NETAS',
        'CONSUMO_TOTAL'
      ]
    );

  const totalFacturadoInformado =
    vmNumeroPorEncabezado_(
      registro,
      mapa,
      [
        'TOTAL_FACTURADO_NETO_S_IVA',
        'TOTAL_FACTURADO_NETO_SIN_IVA',
        'TOTAL_FACTURADO'
      ]
    );

  const empresas = {};

  SII_VENTAS_MODELO
    .EMPRESAS
    .forEach(empresa => {
      empresas[empresa] =
        vmNumeroPorEncabezado_(
          registro,
          mapa,
          [empresa]
        );
    });

  return vmCompletarIndicadores_({
    sku:
      sku,

    codigoProveedor:
      codigoProveedor,

    descripcion:
      descripcion,

    historicoMensual:
      historicoMensual,

    cantidadMeses:
      historicoMensual.length,

    mesesConVenta:
      unidades.filter(
        valor => valor > 0
      ).length,

    totalUnidades:
      totalUnidadesInformado !== 0
        ? totalUnidadesInformado
        : totalUnidadesCalculado,

    totalFacturacion:
      totalFacturadoInformado !== 0
        ? totalFacturadoInformado
        : totalFacturadoCalculado,

    empresas:
      empresas,

    fuente:
      'FORMATO_MENSUAL'
  });
}


/**
 * Compatibilidad con el formato anterior.
 */
function vmConstruirModeloLegacy_(
  registro,
  mapa,
  sku,
  codigoProveedor,
  descripcion
) {
  const consumoTotal =
    vmNumeroPorEncabezado_(
      registro,
      mapa,
      [
        'CONSUMO_TOTAL',
        'CONSUMO_12_MESES',
        'TOTAL_UNIDADES_NETAS'
      ]
    );

  const meses =
    vmNumeroPorEncabezado_(
      registro,
      mapa,
      ['MESES']
    );

  let promedio =
    vmNumeroPorEncabezado_(
      registro,
      mapa,
      [
        'PROMEDIO_MENSUAL',
        'PROMEDIO_MENSUAL_3M'
      ]
    );

  if (
    promedio === 0 &&
    consumoTotal > 0 &&
    meses > 0
  ) {
    promedio =
      consumoTotal / meses;
  }

  return {
    sku:
      sku,

    codigoProveedor:
      codigoProveedor,

    descripcion:
      descripcion,

    historicoMensual:
      [],

    cantidadMeses:
      meses,

    mesesConVenta:
      meses,

    totalUnidades:
      consumoTotal,

    totalFacturacion:
      0,

    promedio3:
      promedio,

    promedio6:
      promedio,

    promedio12:
      promedio,

    promedioTotal:
      promedio,

    ultimoMes:
      0,

    mesAnterior:
      0,

    maximoMensual:
      0,

    minimoMensual:
      0,

    periodoMaximo:
      '',

    periodoMinimo:
      '',

    tendencia:
      'SIN HISTORICO',

    pendienteTendencia:
      0,

    variabilidad:
      0,

    nivelVariabilidad:
      'SIN HISTORICO',

    indiceAceleracion:
      promedio > 0
        ? 1
        : 0,

    aceleracionPorcentaje:
      0,

    clasificacionAceleracion:
      'SIN HISTORICO',

    crecimientoInteranual:
      null,

    estacionalidad:
      {},

    empresas:
      {},

    fuente:
      'FORMATO_LEGACY'
  };
}


/**
 * Calcula todos los indicadores de demanda.
 */
function vmCompletarIndicadores_(
  modelo
) {
  const historico =
    modelo.historicoMensual;

  const valores =
    historico.map(
      reg => reg.unidades
    );

  const promedio3 =
    vmPromedioUltimos_(
      valores,
      3
    );

  const promedio6 =
    vmPromedioUltimos_(
      valores,
      6
    );

  const promedio12 =
    vmPromedioUltimos_(
      valores,
      12
    );

  const promedioTotal =
    vmPromedio_(
      valores
    );

  const tendencia =
    vmCalcularTendencia_(
      valores
    );

  const variabilidad =
    vmCoeficienteVariacion_(
      valores
    );

  const indiceAceleracion =
    promedio12 > 0
      ? promedio3 /
        promedio12
      : (
          promedio3 > 0
            ? 999
            : 0
        );

  const aceleracionPorcentaje =
    promedio12 > 0
      ? (
          indiceAceleracion - 1
        ) * 100
      : null;

  const maximo =
    vmExtremoHistorico_(
      historico,
      'MAX'
    );

  const minimo =
    vmExtremoHistorico_(
      historico,
      'MIN'
    );

  modelo.promedio3 =
    promedio3;

  modelo.promedio6 =
    promedio6;

  modelo.promedio12 =
    promedio12;

  modelo.promedioTotal =
    promedioTotal;

  modelo.ultimoMes =
    valores.length
      ? valores[
          valores.length - 1
        ]
      : 0;

  modelo.mesAnterior =
    valores.length >= 2
      ? valores[
          valores.length - 2
        ]
      : 0;

  modelo.maximoMensual =
    maximo.valor;

  modelo.minimoMensual =
    minimo.valor;

  modelo.periodoMaximo =
    maximo.periodo;

  modelo.periodoMinimo =
    minimo.periodo;

  modelo.tendencia =
    tendencia.clasificacion;

  modelo.pendienteTendencia =
    tendencia.pendiente;

  modelo.variabilidad =
    variabilidad;

  modelo.nivelVariabilidad =
    vmClasificarVariabilidad_(
      variabilidad
    );

  modelo.indiceAceleracion =
    indiceAceleracion;

  modelo.aceleracionPorcentaje =
    aceleracionPorcentaje;

  modelo.clasificacionAceleracion =
    vmClasificarAceleracion_(
      indiceAceleracion
    );

  modelo.crecimientoInteranual =
    vmCrecimientoInteranual_(
      historico
    );

  modelo.estacionalidad =
    vmConstruirEstacionalidad_(
      historico
    );

  return modelo;
}


/**
 * Detecta automáticamente columnas:
 *
 * Jul_2025
 * Total_Jul_2025
 */
function vmDetectarColumnasMensuales_(
  encabezados
) {
  const meses = [];

  encabezados.forEach(
    (encabezado, indice) => {
      const normalizado =
        vmNormalizarEncabezado_(
          encabezado
        );

      if (
        normalizado.startsWith(
          'TOTAL_'
        )
      ) {
        return;
      }

      const coincidencia =
        normalizado.match(
          /^(ENE|FEB|MAR|ABR|MAY|JUN|JUL|AGO|SEP|OCT|NOV|DIC)_(\d{4})$/
        );

      if (!coincidencia) {
        return;
      }

      const mesNombre =
        coincidencia[1];

      const anio =
        Number(
          coincidencia[2]
        );

      const mes =
        SII_VENTAS_MODELO
          .MESES[mesNombre];

      const encabezadoTotal =
        'TOTAL_' +
        mesNombre +
        '_' +
        anio;

      const colFacturacion =
        encabezados.findIndex(
          valor =>
            vmNormalizarEncabezado_(
              valor
            ) === encabezadoTotal
        );

      meses.push({
        periodo:
          anio +
          '-' +
          String(mes)
            .padStart(2, '0'),

        anio:
          anio,

        mes:
          mes,

        mesNombre:
          mesNombre,

        colUnidades:
          indice,

        colFacturacion:
          colFacturacion
      });
    }
  );

  meses.sort(
    (a, b) =>
      a.periodo.localeCompare(
        b.periodo
      )
  );

  return meses;
}


/**
 * Combina registros duplicados del mismo Cod_BAM.
 */
function vmCombinarModelos_(
  actual,
  nuevo
) {
  if (!actual) {
    return nuevo;
  }

  if (
    actual.fuente !==
      'FORMATO_MENSUAL' ||
    nuevo.fuente !==
      'FORMATO_MENSUAL'
  ) {
    return nuevo;
  }

  const mapaMeses =
    new Map();

  actual.historicoMensual
    .concat(
      nuevo.historicoMensual
    )
    .forEach(reg => {
      const existente =
        mapaMeses.get(
          reg.periodo
        ) || {
          periodo:
            reg.periodo,
          anio:
            reg.anio,
          mes:
            reg.mes,
          mesNombre:
            reg.mesNombre,
          unidades:
            0,
          facturacion:
            0
        };

      existente.unidades +=
        reg.unidades;

      existente.facturacion +=
        reg.facturacion;

      mapaMeses.set(
        reg.periodo,
        existente
      );
    });

  const empresas =
    Object.assign(
      {},
      actual.empresas
    );

  Object.keys(
    nuevo.empresas || {}
  ).forEach(clave => {
    empresas[clave] =
      (empresas[clave] || 0) +
      (nuevo.empresas[clave] || 0);
  });

  const historicoMensual =
    Array.from(
      mapaMeses.values()
    ).sort(
      (a, b) =>
        a.periodo.localeCompare(
          b.periodo
        )
    );

  return vmCompletarIndicadores_({
    sku:
      actual.sku ||
      nuevo.sku,

    codigoProveedor:
      actual.codigoProveedor ||
      nuevo.codigoProveedor,

    descripcion:
      actual.descripcion ||
      nuevo.descripcion,

    historicoMensual:
      historicoMensual,

    cantidadMeses:
      historicoMensual.length,

    mesesConVenta:
      historicoMensual.filter(
        reg => reg.unidades > 0
      ).length,

    totalUnidades:
      historicoMensual.reduce(
        (acum, reg) =>
          acum + reg.unidades,
        0
      ),

    totalFacturacion:
      historicoMensual.reduce(
        (acum, reg) =>
          acum + reg.facturacion,
        0
      ),

    empresas:
      empresas,

    fuente:
      'FORMATO_MENSUAL'
  });
}


/**************************************************************
 * CÁLCULOS
 **************************************************************/

function vmPromedioUltimos_(
  valores,
  cantidad
) {
  if (!valores.length) {
    return 0;
  }

  const seleccion =
    valores.slice(
      -Math.min(
        cantidad,
        valores.length
      )
    );

  return vmPromedio_(
    seleccion
  );
}


function vmPromedio_(valores) {
  if (!valores.length) {
    return 0;
  }

  return valores.reduce(
    (acum, valor) =>
      acum + valor,
    0
  ) / valores.length;
}


function vmCalcularTendencia_(
  valores
) {
  if (valores.length < 2) {
    return {
      pendiente: 0,
      clasificacion:
        'SIN DATOS'
    };
  }

  /*
   * Regresión lineal simple.
   */
  const n =
    valores.length;

  const promedioX =
    (n - 1) / 2;

  const promedioY =
    vmPromedio_(valores);

  let numerador = 0;
  let denominador = 0;

  valores.forEach(
    (valor, indice) => {
      numerador +=
        (
          indice -
          promedioX
        ) *
        (
          valor -
          promedioY
        );

      denominador +=
        Math.pow(
          indice -
          promedioX,
          2
        );
    }
  );

  const pendiente =
    denominador === 0
      ? 0
      : numerador /
        denominador;

  const pendienteRelativa =
    promedioY > 0
      ? pendiente /
        promedioY
      : 0;

  let clasificacion =
    'ESTABLE';

  if (
    pendienteRelativa >= 0.05
  ) {
    clasificacion =
      'CRECIENTE';

  } else if (
    pendienteRelativa <= -0.05
  ) {
    clasificacion =
      'DECRECIENTE';
  }

  return {
    pendiente:
      pendiente,

    clasificacion:
      clasificacion
  };
}


function vmCoeficienteVariacion_(
  valores
) {
  if (!valores.length) {
    return 0;
  }

  const promedio =
    vmPromedio_(valores);

  if (promedio === 0) {
    return 0;
  }

  const varianza =
    valores.reduce(
      (acum, valor) =>
        acum +
        Math.pow(
          valor -
          promedio,
          2
        ),
      0
    ) / valores.length;

  const desviacion =
    Math.sqrt(varianza);

  return desviacion /
    promedio;
}


function vmClasificarVariabilidad_(
  coeficiente
) {
  if (coeficiente < 0.25) {
    return 'BAJA';
  }

  if (coeficiente < 0.60) {
    return 'MEDIA';
  }

  return 'ALTA';
}


function vmClasificarAceleracion_(
  indice
) {
  if (indice === 0) {
    return 'SIN CONSUMO';
  }

  if (indice === 999) {
    return 'NUEVA DEMANDA';
  }

  if (indice >= 1.20) {
    return 'ACELERANDO';
  }

  if (indice <= 0.80) {
    return 'DESACELERANDO';
  }

  return 'ESTABLE';
}


function vmCrecimientoInteranual_(
  historico
) {
  if (historico.length < 13) {
    return null;
  }

  const ultimo =
    historico[
      historico.length - 1
    ];

  const comparativo =
    historico.find(
      reg =>
        reg.mes ===
          ultimo.mes &&
        reg.anio ===
          ultimo.anio - 1
    );

  if (!comparativo) {
    return null;
  }

  if (
    comparativo.unidades === 0
  ) {
    return ultimo.unidades > 0
      ? null
      : 0;
  }

  return (
    (
      ultimo.unidades -
      comparativo.unidades
    ) /
    comparativo.unidades
  ) * 100;
}


function vmConstruirEstacionalidad_(
  historico
) {
  const acumulado = {};

  historico.forEach(reg => {
    const clave =
      String(reg.mes)
        .padStart(2, '0');

    if (!acumulado[clave]) {
      acumulado[clave] = {
        mes:
          reg.mes,

        mesNombre:
          reg.mesNombre,

        totalUnidades:
          0,

        cantidadPeriodos:
          0
      };
    }

    acumulado[clave]
      .totalUnidades +=
      reg.unidades;

    acumulado[clave]
      .cantidadPeriodos++;
  });

  const salida = {};

  Object.keys(
    acumulado
  ).forEach(clave => {
    const reg =
      acumulado[clave];

    salida[clave] = {
      mes:
        reg.mes,

      mesNombre:
        reg.mesNombre,

      promedioUnidades:
        reg.cantidadPeriodos > 0
          ? reg.totalUnidades /
            reg.cantidadPeriodos
          : 0
    };
  });

  return salida;
}


function vmExtremoHistorico_(
  historico,
  tipo
) {
  if (!historico.length) {
    return {
      valor: 0,
      periodo: ''
    };
  }

  let seleccionado =
    historico[0];

  historico.forEach(reg => {
    if (
      tipo === 'MAX' &&
      reg.unidades >
        seleccionado.unidades
    ) {
      seleccionado = reg;
    }

    if (
      tipo === 'MIN' &&
      reg.unidades <
        seleccionado.unidades
    ) {
      seleccionado = reg;
    }
  });

  return {
    valor:
      seleccionado.unidades,

    periodo:
      seleccionado.periodo
  };
}


/**************************************************************
 * UTILIDADES
 **************************************************************/

function vmModeloVacio_(sku) {
  return {
    sku:
      sku,

    codigoProveedor:
      '',

    descripcion:
      '',

    historicoMensual:
      [],

    cantidadMeses:
      0,

    mesesConVenta:
      0,

    totalUnidades:
      0,

    totalFacturacion:
      0,

    promedio3:
      0,

    promedio6:
      0,

    promedio12:
      0,

    promedioTotal:
      0,

    ultimoMes:
      0,

    mesAnterior:
      0,

    maximoMensual:
      0,

    minimoMensual:
      0,

    periodoMaximo:
      '',

    periodoMinimo:
      '',

    tendencia:
      'SIN DATOS',

    pendienteTendencia:
      0,

    variabilidad:
      0,

    nivelVariabilidad:
      'SIN DATOS',

    indiceAceleracion:
      0,

    aceleracionPorcentaje:
      null,

    clasificacionAceleracion:
      'SIN DATOS',

    crecimientoInteranual:
      null,

    estacionalidad:
      {},

    empresas:
      {},

    fuente:
      'SIN DATOS'
  };
}


/**
 * Devuelve las claves válidas para localizar una fila de VENTAS.
 * Permite consultar por Cod_BAM, SKU o Código del proveedor.
 */
function vmClavesSkuRegistro_(
  skuBam,
  codigoProveedor
) {
  const claves =
    new Set();

  [
    skuBam,
    codigoProveedor
  ].forEach(valor => {
    const clave =
      vmNormalizarClaveSku_(
        valor
      );

    if (clave) {
      claves.add(clave);
    }
  });

  return Array.from(claves);
}


function vmNumeroPorEncabezado_(
  registro,
  mapa,
  candidatos
) {
  const columna =
    vmBuscarColumna_(
      mapa,
      candidatos
    );

  if (columna === -1) {
    return 0;
  }

  return vmNumero_(
    registro[columna]
  );
}


function vmConstruirMapaEncabezados_(
  encabezados
) {
  const mapa = new Map();

  encabezados.forEach(
    (valor, indice) => {
      const clave =
        vmNormalizarEncabezado_(
          valor
        );

      if (clave) {
        mapa.set(
          clave,
          indice
        );
      }
    }
  );

  return mapa;
}


function vmBuscarColumna_(
  mapa,
  candidatos
) {
  for (
    let i = 0;
    i < candidatos.length;
    i++
  ) {
    const clave =
      vmNormalizarEncabezado_(
        candidatos[i]
      );

    if (mapa.has(clave)) {
      return mapa.get(clave);
    }
  }

  return -1;
}


function vmNormalizarEncabezado_(
  valor
) {
  return vmLimpiarTexto_(valor)
    .normalize('NFD')
    .replace(
      /[\u0300-\u036f]/g,
      ''
    )
    .toUpperCase()
    .replace(/\s+/g, '_');
}


function vmNormalizarClaveSku_(
  valor
) {
  return vmLimpiarTexto_(valor)
    .normalize('NFD')
    .replace(
      /[\u0300-\u036f]/g,
      ''
    )
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
}


function vmLimpiarTexto_(valor) {
  return String(
    valor === null ||
    valor === undefined
      ? ''
      : valor
  ).trim();
}


function vmNumero_(valor) {
  if (typeof valor === 'number') {
    return Number.isFinite(valor)
      ? valor
      : 0;
  }

  let texto =
    vmLimpiarTexto_(valor);

  if (!texto) {
    return 0;
  }

  texto =
    texto.replace(
      /[^\d,.-]/g,
      ''
    );

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

  } else if (
    texto.includes(',')
  ) {
    texto =
      texto.replace(',', '.');
  }

  const resultado =
    Number(texto);

  return Number.isFinite(resultado)
    ? resultado
    : 0;
}


/**
 * Limpia la cache del modelo de ventas.
 */
function limpiarCacheModeloVentas() {
  CacheService
    .getDocumentCache()
    .remove(
      'SII_VENTAS_MODELO_V6001'
    );

  SpreadsheetApp
    .getActive()
    .toast(
      'Cache del modelo de ventas limpiada.',
      'Ventas',
      4
    );
}


/**
 * Prueba rápida.
 *
 * Toma el primer SKU con datos y lo muestra en el log.
 */
function probarModeloVentas() {
  limpiarCacheModeloVentas();

  const modelos =
    cargarTodosLosModelosVentas();

  const claves =
    Object.keys(modelos);

  if (claves.length === 0) {
    throw new Error(
      'No se encontraron SKU en VENTAS.'
    );
  }

  const modelo =
    modelos[claves[0]];

  Logger.log(
    JSON.stringify(
      modelo,
      null,
      2
    )
  );

  SpreadsheetApp
    .getActive()
    .toast(
      'Modelo probado con SKU ' +
      modelo.sku,
      'Ventas',
      6
    );

  return modelo;
}

function probarSKU0300FA() {

  limpiarCacheModeloVentas();

  const modelos = cargarTodosLosModelosVentas();

  Logger.log("Cantidad de modelos: " + Object.keys(modelos).length);

  Logger.log("Existe 0300FA: " + modelos.hasOwnProperty("0300FA"));

  Logger.log(modelos["0300FA"]);

}

function diagnosticarSKU0300FA() {
  const ss = SpreadsheetApp.getActive();

  const nombreHoja =
    (
      typeof SII_CFG !== 'undefined' &&
      SII_CFG.SHEETS &&
      SII_CFG.SHEETS.VENTAS
    )
      ? SII_CFG.SHEETS.VENTAS
      : 'VENTAS';

  const sh = ss.getSheetByName(nombreHoja);

  if (!sh) {
    throw new Error(
      'No existe la hoja "' +
      nombreHoja +
      '".'
    );
  }

  const datos =
    sh.getDataRange()
      .getDisplayValues();

  if (datos.length < 2) {
    throw new Error(
      'La hoja VENTAS no tiene datos.'
    );
  }

  const encabezados = datos[0];

  Logger.log(
    'Encabezados: ' +
    JSON.stringify(encabezados)
  );

  const mapa =
    vmConstruirMapaEncabezados_(
      encabezados
    );

  const colCodigo =
    vmBuscarColumna_(
      mapa,
      [
        'CODIGO',
        'CÓDIGO'
      ]
    );

  const colSku =
    vmBuscarColumna_(
      mapa,
      [
        'COD_BAM',
        'CODBAM',
        'SKU'
      ]
    );

  const colDescripcion =
    vmBuscarColumna_(
      mapa,
      [
        'DESCRIPCION',
        'DESCRIPCIÓN'
      ]
    );

  Logger.log(
    JSON.stringify({
      colCodigo: colCodigo,
      encabezadoCodigo:
        colCodigo >= 0
          ? encabezados[colCodigo]
          : 'NO ENCONTRADA',

      colSku: colSku,
      encabezadoSku:
        colSku >= 0
          ? encabezados[colSku]
          : 'NO ENCONTRADA',

      colDescripcion:
        colDescripcion,
      encabezadoDescripcion:
        colDescripcion >= 0
          ? encabezados[
              colDescripcion
            ]
          : 'NO ENCONTRADA'
    }, null, 2)
  );

  const buscado =
    vmNormalizarClaveSku_(
      '0300FA'
    );

  let encontrados = 0;

  for (
    let fila = 1;
    fila < datos.length;
    fila++
  ) {
    const codigo =
      colCodigo >= 0
        ? datos[fila][colCodigo]
        : '';

    const skuBam =
      colSku >= 0
        ? datos[fila][colSku]
        : '';

    const codigoNormalizado =
      vmNormalizarClaveSku_(
        codigo
      );

    const skuNormalizado =
      vmNormalizarClaveSku_(
        skuBam
      );

    const contiene0300FA =
      codigoNormalizado === buscado ||
      skuNormalizado === buscado ||
      codigoNormalizado.includes(
        buscado
      ) ||
      skuNormalizado.includes(
        buscado
      );

    if (contiene0300FA) {
      encontrados++;

      Logger.log(
        JSON.stringify({
          filaHoja: fila + 1,

          codigoOriginal:
            codigo,

          codigoNormalizado:
            codigoNormalizado,

          skuBamOriginal:
            skuBam,

          skuBamNormalizado:
            skuNormalizado,

          descripcion:
            colDescripcion >= 0
              ? datos[fila][
                  colDescripcion
                ]
              : ''
        }, null, 2)
      );
    }
  }

  Logger.log(
    'Coincidencias encontradas: ' +
    encontrados
  );
}

function pruebaDirectaVentas() {

  limpiarCacheModeloVentas();

  const v = cargarHistoricoVentas("IROIR100-H1");

  Logger.log(JSON.stringify(v, null, 2));

}