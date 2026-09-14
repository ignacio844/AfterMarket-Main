/**************************************************************
 * SII V6.4.000
 * CENTRO DE COMPRAS POR MARCA
 *
 * Objetivo:
 * - Consolidar PLAN_COMPRAS por marca.
 * - Priorizar marcas según SKU críticos, score y cobertura.
 * - Permitir abrir el detalle operativo de una marca.
 *
 * Dependencias:
 * - PARAMETROS
 * - PLAN_COMPRAS
 * - sku_identity.gs (recomendado)
 *
 * Archivo HTML requerido:
 * - centro_compras_marca_ui
 *
 * Funciones públicas:
 * - abrirCentroComprasPorMarca()
 * - obtenerCentroComprasPorMarca(filtros)
 * - obtenerDetalleCentroMarca(marca, filtros)
 * - abrirFichaSkuDesdeMarca(sku)
 **************************************************************/

const SII_CENTRO_MARCA_V64000 = {
  VERSION: '6.4.000',
  HTML: 'centro_compras_marca_ui',
  HOJA_PLAN: 'PLAN_COMPRAS',
  ANCHO: 1320,
  ALTO: 790,
  LIMITE_DETALLE: 1500
};


/**
 * Abre el Centro de Compras por Marca.
 */
function abrirCentroComprasPorMarca() {
  const template =
    HtmlService.createTemplateFromFile(
      SII_CENTRO_MARCA_V64000.HTML
    );

  template.version =
    SII_CENTRO_MARCA_V64000.VERSION;

  const html =
    template.evaluate()
      .setWidth(
        SII_CENTRO_MARCA_V64000.ANCHO
      )
      .setHeight(
        SII_CENTRO_MARCA_V64000.ALTO
      );

  SpreadsheetApp
    .getUi()
    .showModalDialog(
      html,
      'Centro de Compras por Marca'
    );
}


/**
 * Devuelve el resumen agregado por marca.
 */
function obtenerCentroComprasPorMarca(
  filtros
) {
  const inicio = Date.now();

  const registros =
    cmLeerPlanCompras_();

  const config =
    cmNormalizarFiltros_(
      filtros
    );

  const agrupado =
    new Map();

  registros.forEach(registro => {
    if (
      !cmCumpleFiltroMarca_(
        registro,
        config
      )
    ) {
      return;
    }

    const marca =
      registro.marca ||
      'SIN MARCA';

    if (!agrupado.has(marca)) {
      agrupado.set(
        marca,
        cmCrearResumenMarca_(
          marca
        )
      );
    }

    cmAcumularMarca_(
      agrupado.get(marca),
      registro
    );
  });

  const marcas =
    Array.from(
      agrupado.values()
    );

  marcas.forEach(
    cmFinalizarMarca_
  );

  marcas.sort(
    cmOrdenarMarcas_
  );

  return {
    version:
      SII_CENTRO_MARCA_V64000.VERSION,

    generadoEn:
      Utilities.formatDate(
        new Date(),
        Session.getScriptTimeZone(),
        'dd/MM/yyyy HH:mm'
      ),

    duracionMs:
      Date.now() - inicio,

    resumenGeneral:
      cmConstruirResumenGeneral_(
        marcas
      ),

    marcas:
      marcas
  };
}


/**
 * Devuelve el detalle de SKU de una marca.
 */
function obtenerDetalleCentroMarca(
  marca,
  filtros
) {
  const marcaTexto =
    cmTexto_(marca);

  if (!marcaTexto) {
    throw new Error(
      'Debe seleccionar una marca.'
    );
  }

  const config =
    cmNormalizarFiltros_(
      filtros
    );

  const registros =
    cmLeerPlanCompras_()
      .filter(registro =>
        (
          registro.marca ||
          'SIN MARCA'
        ) === marcaTexto
      )
      .filter(registro =>
        cmCumpleFiltroDetalle_(
          registro,
          config
        )
      )
      .sort(
        cmOrdenarDetalle_
      )
      .slice(
        0,
        SII_CENTRO_MARCA_V64000
          .LIMITE_DETALLE
      );

  return {
    version:
      SII_CENTRO_MARCA_V64000.VERSION,

    marca:
      marcaTexto,

    resumen:
      cmConstruirResumenDetalle_(
        registros
      ),

    filas:
      registros
  };
}


/**
 * Abre la Ficha SKU Ejecutiva desde la vista por marca.
 */
function abrirFichaSkuDesdeMarca(
  sku
) {
  const skuTexto =
    cmTexto_(sku);

  if (!skuTexto) {
    throw new Error(
      'No se recibió el SKU.'
    );
  }

  if (
    typeof abrirFichaDesdeCentroCompras ===
    'function'
  ) {
    return abrirFichaDesdeCentroCompras(
      skuTexto
    );
  }

  const template =
    HtmlService.createTemplateFromFile(
      'ficha_sku_ejecutiva_ui'
    );

  template.version =
    (
      typeof SII_FICHA_SKU_EJECUTIVA !==
      'undefined'
    )
      ? SII_FICHA_SKU_EJECUTIVA.VERSION
      : '';

  template.skuInicial =
    skuTexto;

  const html =
    template.evaluate()
      .setWidth(1220)
      .setHeight(760);

  SpreadsheetApp
    .getUi()
    .showModalDialog(
      html,
      'Ficha SKU Ejecutiva'
    );

  return true;
}


/**************************************************************
 * LECTURA Y NORMALIZACIÓN
 **************************************************************/

function cmLeerPlanCompras_() {
  const ss =
    SpreadsheetApp.getActive();

  const nombreHoja =
    cmNombreHoja_(
      'PLAN_COMPRAS',
      SII_CENTRO_MARCA_V64000
        .HOJA_PLAN
    );

  const sh =
    ss.getSheetByName(
      nombreHoja
    );

  if (!sh) {
    throw new Error(
      'No existe la hoja ' +
      nombreHoja +
      '.'
    );
  }

  const datos =
    sh.getDataRange()
      .getDisplayValues();

  if (datos.length < 2) {
    return [];
  }

  const encabezados =
    datos[0].map(
      cmNormalizarEncabezado_
    );

  const columnas =
    cmResolverColumnas_(
      encabezados
    );

  if (columnas.sku === -1) {
    throw new Error(
      'PLAN_COMPRAS no contiene la columna SKU.'
    );
  }

  const umbrales =
    cmObtenerUmbrales_();

  const consolidados =
    new Map();

  for (
    let i = 1;
    i < datos.length;
    i++
  ) {
    const fila =
      datos[i];

    const skuOriginal =
      cmValor_(
        fila,
        columnas.sku
      );

    if (!skuOriginal) {
      continue;
    }

    const sku =
      cmTexto_(skuOriginal)
        .toUpperCase();

    const score =
      cmNumero_(
        cmValor_(
          fila,
          columnas.score
        )
      );

    const accion =
      cmClasificarAccion_(
        cmPrimerTexto_(
          cmValor_(
            fila,
            columnas.accion
          ),
          cmValor_(
            fila,
            columnas.estadoCompra
          )
        ),
        score,
        umbrales
      );

    const registro = {
      sku:
        sku,

      skuOriginal:
        skuOriginal,

      descripcion:
        cmValor_(
          fila,
          columnas.descripcion
        ),

      marca:
        cmValor_(
          fila,
          columnas.marca
        ),

      proveedor:
        cmValor_(
          fila,
          columnas.proveedor
        ),

      score:
        score,

      accion:
        accion,

      nivel:
        cmNivelAccion_(
          accion
        ),

      stock:
        cmNumero_(
          cmValor_(
            fila,
            columnas.stock
          )
        ),

      pendiente:
        cmNumero_(
          cmValor_(
            fila,
            columnas.pendiente
          )
        ),

      consumoMensual:
        cmNumero_(
          cmValor_(
            fila,
            columnas.consumo
          )
        ),

      coberturaActual:
        cmNumeroNullable_(
          cmValor_(
            fila,
            columnas.coberturaActual
          )
        ),

      coberturaProyectada:
        cmNumeroNullable_(
          cmValor_(
            fila,
            columnas.coberturaProyectada
          )
        ),

      objetivoMeses:
        cmNumeroNullable_(
          cmValor_(
            fila,
            columnas.objetivoMeses
          )
        ),

      cantidadSugerida:
        cmNumero_(
          cmValor_(
            fila,
            columnas.cantidadSugerida
          )
        ),

      compraEstimadaUsd:
        cmNumeroNullable_(
          cmValor_(
            fila,
            columnas.compraEstimada
          )
        ),

      leadTimeDias:
        cmNumeroNullable_(
          cmValor_(
            fila,
            columnas.leadTime
          )
        ),

      diasQuiebre:
        cmNumeroNullable_(
          cmValor_(
            fila,
            columnas.diasQuiebre
          )
        ),

      motivo:
        cmValor_(
          fila,
          columnas.motivo
        )
    };

    const clave =
      cmClave_(sku);

    if (
      consolidados.has(
        clave
      )
    ) {
      consolidados.set(
        clave,
        cmConsolidarSku_(
          consolidados.get(
            clave
          ),
          registro
        )
      );

    } else {
      consolidados.set(
        clave,
        registro
      );
    }
  }

  const salida =
    Array.from(
      consolidados.values()
    );

  salida.forEach(
    cmRecalcularSku_
  );

  return salida;
}


/**************************************************************
 * AGRUPACIÓN POR MARCA
 **************************************************************/

function cmCrearResumenMarca_(
  marca
) {
  return {
    marca:
      marca,

    nivel:
      'VERDE',

    accion:
      'SIN ACCIÓN',

    skuTotal:
      0,

    skuComprar:
      0,

    skuPlanificar:
      0,

    skuRevisar:
      0,

    skuRevisarDatos:
      0,

    skuSinAccion:
      0,

    stockTotal:
      0,

    pendienteTotal:
      0,

    consumoMensual:
      0,

    cantidadSugerida:
      0,

    compraEstimadaUsd:
      0,

    skuSinCosto:
      0,

    scoreSuma:
      0,

    scorePromedio:
      0,

    scoreMaximo:
      0,

    coberturaPonderada:
      null,

    coberturaProyectada:
      null,

    proveedores:
      [],

    _proveedores:
      {},

    _pesoCobertura:
      0,

    _sumaCobertura:
      0,

    _sumaCoberturaProyectada:
      0
  };
}


function cmAcumularMarca_(
  marca,
  registro
) {
  marca.skuTotal++;

  marca.stockTotal +=
    registro.stock;

  marca.pendienteTotal +=
    registro.pendiente;

  marca.consumoMensual +=
    registro.consumoMensual;

  marca.cantidadSugerida +=
    registro.cantidadSugerida;

  marca.scoreSuma +=
    registro.score;

  marca.scoreMaximo =
    Math.max(
      marca.scoreMaximo,
      registro.score
    );

  if (
    registro.compraEstimadaUsd !==
    null
  ) {
    marca.compraEstimadaUsd +=
      registro.compraEstimadaUsd;

  } else if (
    registro.cantidadSugerida > 0
  ) {
    marca.skuSinCosto++;
  }

  if (
    registro.accion ===
    'COMPRAR'
  ) {
    marca.skuComprar++;

  } else if (
    registro.accion ===
    'PLANIFICAR'
  ) {
    marca.skuPlanificar++;

  } else if (
    registro.accion ===
    'REVISAR DATOS'
  ) {
    marca.skuRevisarDatos++;

  } else if (
    registro.accion ===
    'REVISAR'
  ) {
    marca.skuRevisar++;

  } else {
    marca.skuSinAccion++;
  }

  if (
    registro.consumoMensual > 0
  ) {
    marca._pesoCobertura +=
      registro.consumoMensual;

    marca._sumaCobertura +=
      registro.stock;

    marca._sumaCoberturaProyectada +=
      (
        registro.stock +
        registro.pendiente
      );
  }

  if (registro.proveedor) {
    marca._proveedores[
      registro.proveedor
    ] = true;
  }
}


function cmFinalizarMarca_(
  marca
) {
  marca.scorePromedio =
    marca.skuTotal > 0
      ? marca.scoreSuma /
        marca.skuTotal
      : 0;

  marca.coberturaPonderada =
    marca._pesoCobertura > 0
      ? marca._sumaCobertura /
        marca._pesoCobertura
      : null;

  marca.coberturaProyectada =
    marca._pesoCobertura > 0
      ? marca
          ._sumaCoberturaProyectada /
        marca._pesoCobertura
      : null;

  marca.proveedores =
    Object.keys(
      marca._proveedores
    ).sort();

  if (marca.skuComprar > 0) {
    marca.accion =
      'COMPRAR';
    marca.nivel =
      'ROJO';

  } else if (
    marca.skuPlanificar > 0
  ) {
    marca.accion =
      'PLANIFICAR';
    marca.nivel =
      'NARANJA';

  } else if (
    marca.skuRevisarDatos > 0
  ) {
    marca.accion =
      'REVISAR DATOS';
    marca.nivel =
      'GRIS';

  } else if (
    marca.skuRevisar > 0
  ) {
    marca.accion =
      'REVISAR';
    marca.nivel =
      'AMARILLO';
  }

  delete marca._proveedores;
  delete marca._pesoCobertura;
  delete marca._sumaCobertura;
  delete marca._sumaCoberturaProyectada;
  delete marca.scoreSuma;
}


function cmConstruirResumenGeneral_(
  marcas
) {
  const resumen = {
    marcasTotal:
      marcas.length,

    marcasComprar:
      0,

    marcasPlanificar:
      0,

    marcasRevisar:
      0,

    marcasRevisarDatos:
      0,

    skuTotal:
      0,

    skuComprar:
      0,

    cantidadSugerida:
      0,

    compraEstimadaUsd:
      0,

    stockTotal:
      0,

    pendienteTotal:
      0
  };

  marcas.forEach(marca => {
    resumen.skuTotal +=
      marca.skuTotal;

    resumen.skuComprar +=
      marca.skuComprar;

    resumen.cantidadSugerida +=
      marca.cantidadSugerida;

    resumen.compraEstimadaUsd +=
      marca.compraEstimadaUsd;

    resumen.stockTotal +=
      marca.stockTotal;

    resumen.pendienteTotal +=
      marca.pendienteTotal;

    if (
      marca.accion === 'COMPRAR'
    ) {
      resumen.marcasComprar++;

    } else if (
      marca.accion ===
      'PLANIFICAR'
    ) {
      resumen.marcasPlanificar++;

    } else if (
      marca.accion ===
      'REVISAR DATOS'
    ) {
      resumen.marcasRevisarDatos++;

    } else if (
      marca.accion ===
      'REVISAR'
    ) {
      resumen.marcasRevisar++;
    }
  });

  return resumen;
}


/**************************************************************
 * DETALLE
 **************************************************************/

function cmConstruirResumenDetalle_(
  registros
) {
  const resumen = {
    skuTotal:
      registros.length,

    comprar:
      0,

    planificar:
      0,

    revisar:
      0,

    revisarDatos:
      0,

    sinAccion:
      0,

    cantidadSugerida:
      0,

    compraEstimadaUsd:
      0,

    stock:
      0,

    pendiente:
      0
  };

  registros.forEach(reg => {
    resumen.cantidadSugerida +=
      reg.cantidadSugerida;

    resumen.stock +=
      reg.stock;

    resumen.pendiente +=
      reg.pendiente;

    if (
      reg.compraEstimadaUsd !==
      null
    ) {
      resumen.compraEstimadaUsd +=
        reg.compraEstimadaUsd;
    }

    if (
      reg.accion === 'COMPRAR'
    ) {
      resumen.comprar++;

    } else if (
      reg.accion ===
      'PLANIFICAR'
    ) {
      resumen.planificar++;

    } else if (
      reg.accion ===
      'REVISAR DATOS'
    ) {
      resumen.revisarDatos++;

    } else if (
      reg.accion ===
      'REVISAR'
    ) {
      resumen.revisar++;

    } else {
      resumen.sinAccion++;
    }
  });

  return resumen;
}


/**************************************************************
 * FILTROS Y ORDEN
 **************************************************************/

function cmNormalizarFiltros_(
  filtros
) {
  const f = filtros || {};

  return {
    texto:
      cmNormalizarTexto_(
        f.texto
      ),

    accion:
      cmTexto_(
        f.accion
      ).toUpperCase(),

    scoreMinimo:
      cmNumero_(
        f.scoreMinimo
      ),

    soloConCompra:
      Boolean(
        f.soloConCompra
      )
  };
}


function cmCumpleFiltroMarca_(
  registro,
  filtros
) {
  if (
    filtros.texto
  ) {
    const contenido =
      cmNormalizarTexto_(
        [
          registro.marca,
          registro.sku,
          registro.descripcion,
          registro.proveedor
        ].join(' ')
      );

    if (
      !contenido.includes(
        filtros.texto
      )
    ) {
      return false;
    }
  }

  if (
    filtros.accion &&
    registro.accion !==
      filtros.accion
  ) {
    return false;
  }

  if (
    registro.score <
    filtros.scoreMinimo
  ) {
    return false;
  }

  if (
    filtros.soloConCompra &&
    registro.cantidadSugerida <= 0
  ) {
    return false;
  }

  return true;
}


function cmCumpleFiltroDetalle_(
  registro,
  filtros
) {
  return cmCumpleFiltroMarca_(
    registro,
    filtros
  );
}


function cmOrdenarMarcas_(
  a,
  b
) {
  const nivelA =
    cmJerarquiaAccion_(
      a.accion
    );

  const nivelB =
    cmJerarquiaAccion_(
      b.accion
    );

  if (nivelA !== nivelB) {
    return nivelA - nivelB;
  }

  if (
    a.skuComprar !==
    b.skuComprar
  ) {
    return (
      b.skuComprar -
      a.skuComprar
    );
  }

  if (
    a.scoreMaximo !==
    b.scoreMaximo
  ) {
    return (
      b.scoreMaximo -
      a.scoreMaximo
    );
  }

  return a.marca.localeCompare(
    b.marca
  );
}


function cmOrdenarDetalle_(
  a,
  b
) {
  const nivelA =
    cmJerarquiaAccion_(
      a.accion
    );

  const nivelB =
    cmJerarquiaAccion_(
      b.accion
    );

  if (nivelA !== nivelB) {
    return nivelA - nivelB;
  }

  if (a.score !== b.score) {
    return b.score - a.score;
  }

  const coberturaA =
    a.coberturaActual === null
      ? 999999
      : a.coberturaActual;

  const coberturaB =
    b.coberturaActual === null
      ? 999999
      : b.coberturaActual;

  return coberturaA -
    coberturaB;
}


/**************************************************************
 * CONSOLIDACIÓN DE IDENTIDAD
 **************************************************************/

function cmResolverSku_(
  sku
) {
  const entrada =
    cmTexto_(sku);

  if (
    typeof resolverSkuCanonicoSII ===
    'function'
  ) {
    return resolverSkuCanonicoSII(
      entrada
    );
  }

  if (
    typeof skuIdentityResolver ===
    'function'
  ) {
    try {
      const resultado =
        skuIdentityResolver(
          entrada
        );

      if (
        resultado &&
        !resultado.ambiguo &&
        resultado.skuCanonico
      ) {
        return resultado.skuCanonico;
      }
    } catch (error) {}
  }

  return entrada;
}


function cmConsolidarSku_(
  base,
  nuevo
) {
  const resultado =
    Object.assign(
      {},
      base
    );

  resultado.descripcion =
    cmPrimerTexto_(
      base.descripcion,
      nuevo.descripcion
    );

  resultado.marca =
    cmPrimerTexto_(
      base.marca,
      nuevo.marca
    );

  resultado.proveedor =
    cmPrimerTexto_(
      base.proveedor,
      nuevo.proveedor
    );

  resultado.motivo =
    cmPrimerTexto_(
      base.motivo,
      nuevo.motivo
    );

  resultado.stock =
    Math.max(
      base.stock,
      nuevo.stock
    );

  resultado.pendiente =
    Math.max(
      base.pendiente,
      nuevo.pendiente
    );

  resultado.consumoMensual =
    Math.max(
      base.consumoMensual,
      nuevo.consumoMensual
    );

  resultado.objetivoMeses =
    cmPrimerNumeroNullable_(
      base.objetivoMeses,
      nuevo.objetivoMeses
    );

  resultado.compraEstimadaUsd =
    cmPrimerNumeroNullable_(
      base.compraEstimadaUsd,
      nuevo.compraEstimadaUsd
    );

  resultado.leadTimeDias =
    cmPrimerNumeroNullable_(
      base.leadTimeDias,
      nuevo.leadTimeDias
    );

  resultado.diasQuiebre =
    cmPrimerNumeroNullable_(
      base.diasQuiebre,
      nuevo.diasQuiebre
    );

  if (
    cmJerarquiaAccion_(
      nuevo.accion
    ) <
    cmJerarquiaAccion_(
      base.accion
    )
  ) {
    resultado.accion =
      nuevo.accion;

    resultado.nivel =
      nuevo.nivel;
  }

  resultado.score =
    Math.max(
      base.score,
      nuevo.score
    );

  return resultado;
}


function cmRecalcularSku_(
  registro
) {
  const consumo =
    registro.consumoMensual;

  registro.coberturaActual =
    consumo > 0
      ? registro.stock /
        consumo
      : null;

  registro.coberturaProyectada =
    consumo > 0
      ? (
          registro.stock +
          registro.pendiente
        ) /
        consumo
      : null;

  const objetivo =
    registro.objetivoMeses !==
      null
      ? registro.objetivoMeses
      : 4;

  registro.cantidadSugerida =
    consumo > 0
      ? Math.max(
          0,
          Math.ceil(
            objetivo *
            consumo -
            registro.stock -
            registro.pendiente
          )
        )
      : 0;
}


/**************************************************************
 * CLASIFICACIÓN
 **************************************************************/

function cmClasificarAccion_(
  accionOriginal,
  score,
  umbrales
) {
  const texto =
    cmNormalizarTexto_(
      accionOriginal
    );

  if (
    texto.includes(
      'REVISAR DATOS'
    ) ||
    texto.includes(
      'SIN HISTORIAL'
    )
  ) {
    return 'REVISAR DATOS';
  }

  if (
    texto.includes('COMPRAR')
  ) {
    return 'COMPRAR';
  }

  if (
    texto.includes(
      'PLANIFICAR'
    )
  ) {
    return 'PLANIFICAR';
  }

  if (
    texto.includes('REVISAR')
  ) {
    return 'REVISAR';
  }

  if (
    texto === 'OK' ||
    texto.includes(
      'SIN ACCION'
    )
  ) {
    return 'SIN ACCIÓN';
  }

  if (
    score >=
    umbrales.comprar
  ) {
    return 'COMPRAR';
  }

  if (
    score >=
    umbrales.planificar
  ) {
    return 'PLANIFICAR';
  }

  if (
    score >=
    umbrales.revisar
  ) {
    return 'REVISAR';
  }

  return 'SIN ACCIÓN';
}


function cmNivelAccion_(
  accion
) {
  if (accion === 'COMPRAR') {
    return 'ROJO';
  }

  if (
    accion === 'PLANIFICAR'
  ) {
    return 'NARANJA';
  }

  if (
    accion === 'REVISAR'
  ) {
    return 'AMARILLO';
  }

  if (
    accion === 'REVISAR DATOS'
  ) {
    return 'GRIS';
  }

  return 'VERDE';
}


function cmJerarquiaAccion_(
  accion
) {
  const orden = {
    COMPRAR: 1,
    PLANIFICAR: 2,
    'REVISAR DATOS': 3,
    REVISAR: 4,
    'SIN ACCIÓN': 5
  };

  return orden[accion] || 99;
}


function cmObtenerUmbrales_() {
  return {
    comprar:
      cmParametroNumero_(
        'IPC',
        'IPC_COMPRAR',
        80
      ),

    planificar:
      cmParametroNumero_(
        'IPC',
        'IPC_PLANIFICAR',
        60
      ),

    revisar:
      cmParametroNumero_(
        'IPC',
        'IPC_REVISAR',
        40
      )
  };
}


/**************************************************************
 * COLUMNAS
 **************************************************************/

function cmResolverColumnas_(
  encabezados
) {
  return {
    sku:
      cmBuscarColumna_(
        encabezados,
        ['SKU']
      ),

    descripcion:
      cmBuscarColumna_(
        encabezados,
        ['DESCRIPCION']
      ),

    marca:
      cmBuscarColumna_(
        encabezados,
        ['MARCA']
      ),

    proveedor:
      cmBuscarColumna_(
        encabezados,
        ['PROVEEDOR']
      ),

    score:
      cmBuscarColumna_(
        encabezados,
        [
          'SCORE',
          'IPC',
          'PRIORIDAD_NUMERICA',
          'PRIORIDAD'
        ]
      ),

    accion:
      cmBuscarColumna_(
        encabezados,
        ['ACCION']
      ),

    estadoCompra:
      cmBuscarColumna_(
        encabezados,
        ['ESTADO_COMPRA']
      ),

    stock:
      cmBuscarColumna_(
        encabezados,
        [
          'STOCK_TOTAL',
          'STOCK_DISPONIBLE'
        ]
      ),

    pendiente:
      cmBuscarColumna_(
        encabezados,
        ['PENDIENTE_RECIBIR']
      ),

    consumo:
      cmBuscarColumna_(
        encabezados,
        [
          'CONSUMO_MENSUAL',
          'PROMEDIO_MENSUAL'
        ]
      ),

    coberturaActual:
      cmBuscarColumna_(
        encabezados,
        ['COBERTURA_ACTUAL_MESES']
      ),

    coberturaProyectada:
      cmBuscarColumna_(
        encabezados,
        ['COBERTURA_PROYECTADA_MESES']
      ),

    objetivoMeses:
      cmBuscarColumna_(
        encabezados,
        ['OBJETIVO_MESES']
      ),

    cantidadSugerida:
      cmBuscarColumna_(
        encabezados,
        ['CANTIDAD_SUGERIDA']
      ),

    compraEstimada:
      cmBuscarColumna_(
        encabezados,
        [
          'COMPRA_ESTIMADA_USD',
          'COMPRA_USD'
        ]
      ),

    leadTime:
      cmBuscarColumna_(
        encabezados,
        ['LEAD_TIME_DIAS']
      ),

    diasQuiebre:
      cmBuscarColumna_(
        encabezados,
        [
          'DIAS_QUIEBRE_PROYECTADO',
          'DIAS_QUIEBRE'
        ]
      ),

    motivo:
      cmBuscarColumna_(
        encabezados,
        [
          'MOTIVO',
          'MOTIVO_MRP'
        ]
      )
  };
}


/**************************************************************
 * UTILIDADES
 **************************************************************/

function cmBuscarColumna_(
  encabezados,
  candidatos
) {
  for (
    let i = 0;
    i < candidatos.length;
    i++
  ) {
    const indice =
      encabezados.indexOf(
        candidatos[i]
      );

    if (indice !== -1) {
      return indice;
    }
  }

  return -1;
}


function cmValor_(
  fila,
  columna
) {
  if (
    columna === -1 ||
    columna === undefined
  ) {
    return '';
  }

  return fila[columna];
}


function cmNombreHoja_(
  clave,
  respaldo
) {
  if (
    typeof SII_CFG !==
      'undefined' &&
    SII_CFG.SHEETS &&
    SII_CFG.SHEETS[clave]
  ) {
    return SII_CFG.SHEETS[
      clave
    ];
  }

  return respaldo;
}


function cmParametroNumero_(
  tipo,
  clave,
  valorDefault
) {
  if (
    typeof obtenerParametroNumero ===
    'function'
  ) {
    return obtenerParametroNumero(
      tipo,
      clave,
      valorDefault
    );
  }

  return valorDefault;
}


function cmNormalizarEncabezado_(
  valor
) {
  return cmTexto_(valor)
    .normalize('NFD')
    .replace(
      /[\u0300-\u036f]/g,
      ''
    )
    .toUpperCase()
    .replace(/\s+/g, '_');
}


function cmNormalizarTexto_(
  valor
) {
  return cmTexto_(valor)
    .normalize('NFD')
    .replace(
      /[\u0300-\u036f]/g,
      ''
    )
    .toUpperCase()
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ');
}


function cmClave_(
  valor
) {
  return cmNormalizarTexto_(
    valor
  ).replace(
    /[^A-Z0-9]/g,
    ''
  );
}


function cmTexto_(
  valor
) {
  return String(
    valor === null ||
    valor === undefined
      ? ''
      : valor
  ).trim();
}


function cmPrimerTexto_() {
  for (
    let i = 0;
    i < arguments.length;
    i++
  ) {
    const valor =
      cmTexto_(
        arguments[i]
      );

    if (valor) {
      return valor;
    }
  }

  return '';
}


function cmNumeroNullable_(
  valor
) {
  if (
    valor === null ||
    valor === undefined ||
    cmTexto_(valor) === ''
  ) {
    return null;
  }

  return cmNumero_(valor);
}


function cmPrimerNumeroNullable_() {
  for (
    let i = 0;
    i < arguments.length;
    i++
  ) {
    const valor =
      cmNumeroNullable_(
        arguments[i]
      );

    if (valor !== null) {
      return valor;
    }
  }

  return null;
}


function cmNumero_(
  valor
) {
  if (typeof valor === 'number') {
    return Number.isFinite(valor)
      ? valor
      : 0;
  }

  if (
    typeof numero_ ===
    'function'
  ) {
    return numero_(valor);
  }

  let texto =
    cmTexto_(valor)
      .replace(
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

  const numero =
    Number(texto);

  return Number.isFinite(numero)
    ? numero
    : 0;
}

function probarMarca() {

  const datos = cmLeerPlanCompras_();

  Logger.log(datos[0]);

}
