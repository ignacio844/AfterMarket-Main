/**************************************************************
 * SII V5.1.001 - STOCK UNIVERSAL POR DEPÓSITO
 * MÓDULO: DETALLE DE PROVEEDOR
 *
 * Hoja destino:
 * - DETALLE_PROVEEDOR
 *
 * Uso:
 * 1. Escribir el proveedor en B2.
 * 2. Ejecutar actualizarDetalleProveedor().
 *
 * También puede llamarse desde otro módulo:
 * - generarDetalleProveedorV5003_1_('PROVEEDOR')
 **************************************************************/

const SII_DETALLE_PROVEEDOR_V50031 = {
  HOJA: 'DETALLE_PROVEEDOR',

  ENCABEZADOS: [
    'PRIORIDAD',
    'SKU',
    'MARCA',
    'DESCRIPCION',
    'RIESGO_RUPTURA',
    'ESTADO_COMPRA',
    'ACCION',
    'STOCK_WARNES',
    'STOCK_ESCOBAR',
    'STOCK_TOTAL',
    'PENDIENTE_RECIBIR',
    'CONSUMO_MENSUAL',
    'COBERTURA_ACTUAL_MESES',
    'COBERTURA_PROYECTADA_MESES',
    'OBJETIVO_MESES',
    'CANTIDAD_SUGERIDA',
    'LEAD_TIME_DIAS',
    'PRIMERA_LLEGADA_ESTIMADA_DIAS',
    'DIAS_QUIEBRE_PROYECTADO',
    'PENDIENTE_QUE_LLEGA_TARDE',
    'COSTO_UNITARIO_USD',
    'COMPRA_ESTIMADA_USD',
    'MOTIVO'
  ]
};


/**
 * Lee el proveedor escrito en B2 y genera el detalle.
 */
function actualizarDetalleProveedor() {
  const ss = SpreadsheetApp.getActive();

  const shDetalle =
    dpObtenerHoja_(
      ss,
      SII_DETALLE_PROVEEDOR_V50031.HOJA
    );

  const proveedor =
    dpLimpiarTexto_(
      shDetalle
        .getRange('C2')
        .getDisplayValue()
    );

  if (!proveedor) {
    throw new Error(
      'Escribí el proveedor en la celda B2 de DETALLE_PROVEEDOR.'
    );
  }

  return generarDetalleProveedorV5003_1_(
    proveedor
  );
}


/**
 * Genera DETALLE_PROVEEDOR para el proveedor informado.
 */
function generarDetalleProveedorV5003_1_(
  proveedor
) {
  const inicio = Date.now();
  const ss = SpreadsheetApp.getActive();

  const shPlan =
    dpObtenerHoja_(
      ss,
      SII_CFG.SHEETS.PLAN_COMPRAS
    );

  const shProductos =
    dpObtenerHoja_(
      ss,
      SII_CFG.SHEETS.PRODUCTOS
    );

  const shStock =
    dpObtenerHoja_(
      ss,
      SII_CFG.SHEETS.STOCK
    );

  const shDetalle =
    dpObtenerHoja_(
      ss,
      SII_DETALLE_PROVEEDOR_V50031.HOJA
    );

  const plan =
    dpLeerFilasComoObjetos_(
      shPlan
    );

  const productos =
    dpLeerFilasComoObjetos_(
      shProductos
    );

  const stock =
    dpLeerFilasComoObjetos_(
      shStock
    );

  if (
    typeof construirIndiceStockUniversal !==
    'function'
  ) {
    throw new Error(
      'No está instalado stock_mapper.gs.'
    );
  }

  const indiceStockUniversal =
    construirIndiceStockUniversal(
      stock
    );

  const productoPorSku =
    dpConstruirProductoPorSku_(
      productos
    );

  const proveedorClave =
    dpNormalizarTexto_(
      proveedor
    );

  const registros =
    plan
      .filter(reg =>
        dpRegistroPerteneceProveedor_(
          reg,
          proveedorClave
        )
      )
      .map(reg =>
        dpConstruirFilaDetalle_(
          reg,
          productoPorSku,
          indiceStockUniversal
        )
      )
      .sort(
        dpOrdenarDetalleProveedor_
      );

  const resumen =
    dpCalcularResumenProveedor_(
      proveedor,
      registros
    );

  dpEscribirDetalleProveedor_(
    shDetalle,
    proveedor,
    resumen,
    registros
  );

  dpAplicarFormatoDetalleProveedor_(
    shDetalle,
    registros.length
  );

  shDetalle.activate();

  ss.toast(
    registros.length +
      ' SKU cargados para ' +
      proveedor +
      '.',
    'Detalle de proveedor',
    6
  );

  Logger.log(
    'DETALLE_PROVEEDOR V5.0.003.1: ' +
      (Date.now() - inicio) +
      ' ms'
  );

  return {
    proveedor: proveedor,
    sku: registros.length,
    duracionMs:
      Date.now() - inicio
  };
}


/**
 * Determina si una fila pertenece al proveedor.
 *
 * PLAN_COMPRAS puede contener varios proveedores:
 * PROVEEDOR A | PROVEEDOR B
 */
function dpRegistroPerteneceProveedor_(
  reg,
  proveedorClave
) {
  const texto =
    dpLimpiarTexto_(
      reg.PROVEEDOR
    );

  if (!texto) {
    return (
      proveedorClave ===
      dpNormalizarTexto_(
        'SIN PROVEEDOR ASIGNADO'
      )
    );
  }

  return String(texto)
    .split('|')
    .map(valor =>
      dpNormalizarTexto_(valor)
    )
    .includes(
      proveedorClave
    );
}


/**
 * Construye una fila del detalle.
 */
function dpConstruirFilaDetalle_(
  reg,
  productoPorSku,
  indiceStockUniversal
) {
  const skuTexto =
    dpLimpiarTexto_(
      reg.SKU
    );

  const skuClave =
    dpNormalizarTexto_(
      skuTexto
    );

  const producto =
    productoPorSku.get(
      skuClave
    ) || {};

  const cantidadSugerida =
    Math.max(
      0,
      dpNumero_(
        reg.CANTIDAD_SUGERIDA
      )
    );

  const costo =
    dpPrimerNumeroValido_(
      producto.COSTO_USD,
      producto['COSTO USD'],
      producto.COSTO_UNITARIO_USD,
      producto.COSTO_UNITARIO,
      producto.COSTO
    );

  const compraEstimada =
    costo !== null &&
    costo > 0
      ? cantidadSugerida * costo
      : '';

  const prioridad =
    dpObtenerPrioridadFila_(
      reg
    );

  const resumenStock =
    dpObtenerStockUniversalDetalle_(
      skuTexto,
      indiceStockUniversal,
      reg
    );

  return [
    prioridad,
    skuTexto,
    dpLimpiarTexto_(
      reg.MARCA
    ) ||
      dpLimpiarTexto_(
        producto.MARCA
      ),
    dpLimpiarTexto_(
      producto.DESCRIPCION
    ),
    dpNormalizarTexto_(
      reg.RIESGO_RUPTURA
    ),
    dpNormalizarTexto_(
      reg.ESTADO_COMPRA
    ),
    dpNormalizarTexto_(
      reg.ACCION
    ),
    resumenStock.stockWarnes,
    resumenStock.stockEscobar,
    resumenStock.stockTotal,
    dpNumero_(
      reg.PENDIENTE_RECIBIR
    ),
    dpNumero_(
      reg.PROMEDIO_MENSUAL
    ),
    dpNumeroNullable_(
      reg.COBERTURA_ACTUAL_MESES
    ),
    dpNumeroNullable_(
      reg.COBERTURA_PROYECTADA_MESES
    ),
    dpNumeroNullable_(
      reg.OBJETIVO_MESES
    ),
    cantidadSugerida,
    dpNumeroNullable_(
      reg.LEAD_TIME_DIAS
    ),
    dpNumeroNullable_(
      reg.PRIMERA_LLEGADA_ESTIMADA_DIAS
    ),
    dpNumeroNullable_(
      reg.DIAS_QUIEBRE_PROYECTADO
    ),
    dpNumero_(
      reg.PENDIENTE_QUE_LLEGA_TARDE
    ),
    costo === null
      ? ''
      : costo,
    compraEstimada,
    dpLimpiarTexto_(
      reg.MOTIVO
    ) ||
      dpLimpiarTexto_(
        reg.MOTIVO_MRP
      )
  ];
}


/**
 * Obtiene stock por SKU canónico usando el índice universal
 * construido una sola vez para toda la ejecución.
 */
function dpObtenerStockUniversalDetalle_(
  sku,
  indiceStockUniversal,
  filaPlan
) {
  const respaldoTotal =
    dpNumero_(
      filaPlan &&
      filaPlan.STOCK_TOTAL
    );

  if (
    !(indiceStockUniversal instanceof Map)
  ) {
    return {
      stockWarnes: 0,
      stockEscobar: 0,
      stockTotal: respaldoTotal,
      fuente: 'PLAN_COMPRAS_RESPALDO'
    };
  }

  let skuCanonico =
    dpLimpiarTexto_(sku);

  if (
    typeof skuIdentityResolver ===
    'function'
  ) {
    const identidad =
      skuIdentityResolver(
        sku
      );

    if (
      identidad &&
      !identidad.ambiguo &&
      identidad.skuCanonico
    ) {
      skuCanonico =
        identidad.skuCanonico;
    }
  }

  const claveCanonica =
    dpNormalizarClaveSku_(
      skuCanonico
    );

  const encontrado =
    indiceStockUniversal.get(
      claveCanonica
    );

  if (!encontrado) {
    return {
      stockWarnes: 0,
      stockEscobar: 0,
      stockTotal: respaldoTotal,
      fuente:
        respaldoTotal !== 0
          ? 'PLAN_COMPRAS_RESPALDO'
          : 'SIN_STOCK'
    };
  }

  return {
    stockWarnes:
      dpNumero_(
        encontrado.stockWarnes
      ),

    stockEscobar:
      dpNumero_(
        encontrado.stockEscobar
      ),

    stockTotal:
      dpNumero_(
        encontrado.stockDisponible
      ),

    fuente:
      'STOCK_MAPA_SKU'
  };
}


/**
 * Normalización exclusiva para claves SKU.
 * No distingue mayúsculas, minúsculas ni separadores.
 */
function dpNormalizarClaveSku_(
  valor
) {
  return dpLimpiarTexto_(valor)
    .normalize('NFD')
    .replace(
      /[\u0300-\u036f]/g,
      ''
    )
    .toUpperCase()
    .replace(
      /[^A-Z0-9]/g,
      ''
    );
}


/**
 * Resumen superior del proveedor.
 */
function dpCalcularResumenProveedor_(
  proveedor,
  registros
) {
  let skuCriticos = 0;
  let skuUrgentes = 0;
  let cantidadSugerida = 0;
  let compraEstimada = 0;
  let skuSinCosto = 0;
  let coberturaMinima = null;
  let sumaCobertura = 0;
  let cantidadCoberturas = 0;
  let primerQuiebreDias = null;
  let sumaLeadTime = 0;
  let cantidadLeadTime = 0;

  registros.forEach(fila => {
    const riesgo =
      dpNormalizarTexto_(
        fila[4]
      );

    const estado =
      dpNormalizarTexto_(
        fila[5]
      );

    if (riesgo === 'CRITICO') {
      skuCriticos++;
    }

    if (
      estado.startsWith(
        'URGENTE'
      )
    ) {
      skuUrgentes++;
    }

    cantidadSugerida +=
      dpNumero_(
        fila[13]
      );

    if (
      fila[21] === '' ||
      fila[21] === null
    ) {
      if (
        dpNumero_(
          fila[15]
        ) > 0
      ) {
        skuSinCosto++;
      }

    } else {
      compraEstimada +=
        dpNumero_(
          fila[21]
        );
    }

    const cobertura =
      dpNumeroNullable_(
        fila[13]
      );

    if (cobertura !== null) {
      sumaCobertura += cobertura;
      cantidadCoberturas++;

      if (
        coberturaMinima === null ||
        cobertura < coberturaMinima
      ) {
        coberturaMinima =
          cobertura;
      }
    }

    const diasQuiebre =
      dpNumeroNullable_(
        fila[18]
      );

    if (
      diasQuiebre !== null &&
      (
        primerQuiebreDias === null ||
        diasQuiebre <
          primerQuiebreDias
      )
    ) {
      primerQuiebreDias =
        diasQuiebre;
    }

    const leadTime =
      dpNumeroNullable_(
        fila[16]
      );

    if (
      leadTime !== null &&
      leadTime > 0
    ) {
      sumaLeadTime +=
        leadTime;

      cantidadLeadTime++;
    }
  });

  return {
    proveedor: proveedor,
    cantidadSku:
      registros.length,
    skuCriticos:
      skuCriticos,
    skuUrgentes:
      skuUrgentes,
    cantidadSugerida:
      cantidadSugerida,
    compraEstimadaUsd:
      compraEstimada,
    skuSinCosto:
      skuSinCosto,
    coberturaMinima:
      coberturaMinima,
    coberturaPromedio:
      cantidadCoberturas > 0
        ? sumaCobertura /
          cantidadCoberturas
        : null,
    primerQuiebreDias:
      primerQuiebreDias,
    leadTimePromedio:
      cantidadLeadTime > 0
        ? sumaLeadTime /
          cantidadLeadTime
        : ''
  };
}


/**
 * Escribe encabezado, resumen y tabla.
 */
function dpEscribirDetalleProveedor_(
  sh,
  proveedor,
  resumen,
  registros
) {
  const columnas =
    SII_DETALLE_PROVEEDOR_V50031
      .ENCABEZADOS.length;

  const filtro =
    sh.getFilter();

  if (filtro) {
    filtro.remove();
  }

  const proveedorSeleccionado =
    proveedor;

  const filasNecesarias =
    Math.max(
      11 + registros.length,
      25
    );

  if (
    sh.getMaxRows() <
    filasNecesarias
  ) {
    sh.insertRowsAfter(
      sh.getMaxRows(),
      filasNecesarias -
        sh.getMaxRows()
    );
  }

  if (
    sh.getMaxColumns() <
    columnas
  ) {
    sh.insertColumnsAfter(
      sh.getMaxColumns(),
      columnas -
        sh.getMaxColumns()
    );
  }

  sh.clear();

  /*
   * Título.
   */
  sh.getRange(
    1,
    1,
    1,
    12
  )
    .merge()
    .setValue(
      'DETALLE DEL PROVEEDOR'
    );

  /*
   * Datos generales.
   */
  sh.getRange('A2:B2')
    .merge()
    .setValue('PROVEEDOR');

  sh.getRange('C2:H2')
    .merge()
    .setValue(
      proveedorSeleccionado
    );

  sh.getRange('I2:J2')
    .merge()
    .setValue('MARCAS');

  const marcas = Array.from(
    new Set(
      registros
        .map(fila =>
          dpLimpiarTexto_(fila[2])
        )
        .filter(Boolean)
    )
  )
    .sort()
    .join(' | ');

  sh.getRange('K2:L2')
    .merge()
    .setValue(marcas);

  /*
   * Tarjetas KPI.
   */
  const tarjetas = [
    {
      rango: 'A4:B6',
      valor: resumen.cantidadSku,
      titulo: 'SKU',
      decimales: 0
    },
    {
      rango: 'C4:D6',
      valor: resumen.skuCriticos,
      titulo: 'CRÍTICOS',
      decimales: 0
    },
    {
      rango: 'E4:F6',
      valor: resumen.skuUrgentes,
      titulo: 'URGENTES',
      decimales: 0
    },
    {
      rango: 'G4:H6',
      valor:
        resumen.compraEstimadaUsd,
      titulo: 'COMPRA USD',
      prefijo: 'USD ',
      decimales: 2
    },
    {
      rango: 'I4:J6',
      valor:
        resumen.coberturaMinima,
      titulo: 'COBERTURA MÍN.',
      sufijo: ' meses',
      decimales: 2
    },
    {
      rango: 'K4:L6',
      valor:
        resumen.coberturaPromedio,
      titulo: 'COBERTURA PROM.',
      sufijo: ' meses',
      decimales: 2
    }
  ];

  tarjetas.forEach(tarjeta => {
    const rango =
      sh.getRange(tarjeta.rango);

    rango.merge();

    const valorFormateado =
      dpFormatearKpiV5005_(
        tarjeta.valor,
        tarjeta.decimales,
        tarjeta.prefijo || '',
        tarjeta.sufijo || ''
      );

    rango.setValue(
      valorFormateado +
      '\n' +
      tarjeta.titulo
    );
  });

  /*
   * Línea secundaria.
   */
  sh.getRange('A8:B8')
    .merge()
    .setValue('CANT. SUGERIDA');

  sh.getRange('C8:D8')
    .merge()
    .setValue(
      resumen.cantidadSugerida
    );

  sh.getRange('E8:F8')
    .merge()
    .setValue('LEAD TIME PROM.');

  sh.getRange('G8:H8')
    .merge()
    .setValue(
      resumen.leadTimePromedio === ''
        ? ''
        : dpFormatearKpiV5005_(
            resumen.leadTimePromedio,
            2,
            '',
            ' días'
          )
    );

  sh.getRange('I8:J8')
    .merge()
    .setValue('PRIMER QUIEBRE');

  sh.getRange('K8:L8')
    .merge()
    .setValue(
      resumen.primerQuiebreDias === null
        ? ''
        : resumen.primerQuiebreDias +
          ' días'
    );

  /*
   * Barra de acciones.
   * Los botones se ejecutan mediante onSelectionChange(e).
   */
  const botones = [
    ['A9:B9', '🏠 DASHBOARD'],
    ['C9:D9', '🛒 CENTRO COMPRAS'],
    ['E9:F9', '📦 FICHA SKU'],
    ['G9:H9', '📄 ÓRDENES'],
    ['I9:J9', '🚢 IMPORTACIONES'],
    ['K9:L9', '🔄 ACTUALIZAR']
  ];

  botones.forEach(boton => {
    sh.getRange(boton[0])
      .merge()
      .setValue(boton[1]);
  });

  /*
   * Datos auxiliares fuera de la vista principal.
   */
  sh.getRange('N2')
    .setValue('ULTIMA_ACTUALIZACION');

  sh.getRange('O2')
    .setValue(new Date());

  sh.getRange('N3')
    .setValue('SKU_SIN_COSTO');

  sh.getRange('O3')
    .setValue(resumen.skuSinCosto);

  /*
   * Tabla operativa.
   */
  const filaEncabezado = 11;

  sh.getRange(
    filaEncabezado,
    1,
    1,
    columnas
  ).setValues([
    SII_DETALLE_PROVEEDOR_V50031
      .ENCABEZADOS
  ]);

  if (registros.length > 0) {
    sh.getRange(
      filaEncabezado + 1,
      1,
      registros.length,
      columnas
    ).setValues(
      registros
    );

    sh.getRange(
      filaEncabezado,
      1,
      registros.length + 1,
      columnas
    ).createFilter();
  }
}

/**
 * Formato del detalle.
 */
function dpAplicarFormatoDetalleProveedor_(
  sh,
  cantidadFilas
) {
  sh.setHiddenGridlines(true);
  sh.setFrozenRows(11);
  sh.setFrozenColumns(0);

  /*
   * Título.
   */
  sh.getRange('A1:L1')
    .setBackground('#17365D')
    .setFontColor('#FFFFFF')
    .setFontSize(18)
    .setFontWeight('bold')
    .setHorizontalAlignment('center')
    .setVerticalAlignment('middle');

  sh.setRowHeight(1, 38);

  /*
   * Proveedor y marcas.
   */
  [
    'A2:B2',
    'I2:J2'
  ].forEach(rango => {
    sh.getRange(rango)
      .setBackground('#1F4E78')
      .setFontColor('#FFFFFF')
      .setFontWeight('bold')
      .setHorizontalAlignment('center');
  });

  [
    'C2:H2',
    'K2:L2'
  ].forEach(rango => {
    sh.getRange(rango)
      .setBackground('#D9EAF7')
      .setFontColor('#1F4E78')
      .setFontWeight('bold')
      .setWrap(true);
  });

  /*
   * Tarjetas KPI.
   */
  const tarjetas = [
    ['A4:B6', '#1F4E78'],
    ['C4:D6', '#990000'],
    ['E4:F6', '#CC0000'],
    ['G4:H6', '#38761D'],
    ['I4:J6', '#0B5394'],
    ['K4:L6', '#45818E']
  ];

  tarjetas.forEach(item => {
    sh.getRange(item[0])
      .setBackground(item[1])
      .setFontColor('#FFFFFF')
      .setFontWeight('bold')
      .setFontSize(13)
      .setHorizontalAlignment('center')
      .setVerticalAlignment('middle')
      .setWrap(true);
  });

  [4, 5, 6].forEach(fila => {
    sh.setRowHeight(fila, 28);
  });

  /*
   * Línea secundaria.
   */
  [
    'A8:B8',
    'E8:F8',
    'I8:J8'
  ].forEach(rango => {
    sh.getRange(rango)
      .setBackground('#1F4E78')
      .setFontColor('#FFFFFF')
      .setFontWeight('bold')
      .setHorizontalAlignment('center');
  });

  [
    'C8:D8',
    'G8:H8',
    'K8:L8'
  ].forEach(rango => {
    sh.getRange(rango)
      .setBackground('#EAF2F8')
      .setFontColor('#1F4E78')
      .setFontWeight('bold')
      .setHorizontalAlignment('center')
      .setWrap(true);
  });

  /*
   * Botones de navegación.
   */
  [
    'A9:B9',
    'C9:D9',
    'E9:F9',
    'G9:H9',
    'I9:J9',
    'K9:L9'
  ].forEach(rango => {
    sh.getRange(rango)
      .setBackground('#1F4E78')
      .setFontColor('#FFFFFF')
      .setFontWeight('bold')
      .setFontSize(10)
      .setHorizontalAlignment('center')
      .setVerticalAlignment('middle')
      .setBorder(
        true, true, true,
        true, true, true,
        '#FFFFFF',
        SpreadsheetApp.BorderStyle.SOLID_MEDIUM
      );
  });

  sh.setRowHeight(9, 34);

  sh.getRange('O2')
    .setNumberFormat(
      'dd/MM/yyyy HH:mm'
    );

  /*
   * Encabezado de tabla.
   */
  const columnas =
    SII_DETALLE_PROVEEDOR_V50031
      .ENCABEZADOS.length;

  sh.getRange(
    11,
    1,
    1,
    columnas
  )
    .setBackground('#1F4E78')
    .setFontColor('#FFFFFF')
    .setFontWeight('bold')
    .setHorizontalAlignment('center')
    .setVerticalAlignment('middle')
    .setWrap(true);

  sh.setRowHeight(11, 42);

  /*
   * Anchos operativos.
   */
  const anchos = [
    85, 150, 115, 300, 115,
    145, 170, 100, 100, 105,
    110, 110, 125, 135, 100,
    120, 105, 135, 135, 135,
    120, 140, 380
  ];

  anchos.forEach(
    (ancho, indice) => {
      sh.setColumnWidth(
        indice + 1,
        ancho
      );
    }
  );

  /*
   * Columnas visibles:
   * A Prioridad
   * B SKU
   * C Marca
   * D Descripción
   * E Riesgo
   * G Acción
   * H Stock Warnes
   * I Stock Escobar
   * J Stock Total
   * K Pendiente
   * L Consumo
   * N Cobertura proyectada
   * P Cantidad sugerida
   * V Compra estimada USD
   *
   * Columnas técnicas ocultas.
   */
  const columnasOcultar = [
    6, 13, 15, 17, 18,
    19, 20, 21, 23
  ];

  columnasOcultar.forEach(columna => {
    sh.hideColumns(columna);
  });

  if (cantidadFilas <= 0) {
    return;
  }

  const inicio = 12;

  /*
   * Formatos numéricos.
   */
  sh.getRange(
    inicio,
    8,
    cantidadFilas,
    5
  ).setNumberFormat(
    '#,##0.00'
  );

  sh.getRange(
    inicio,
    14,
    cantidadFilas,
    1
  ).setNumberFormat(
    '0.00'
  );

  sh.getRange(
    inicio,
    16,
    cantidadFilas,
    1
  ).setNumberFormat(
    '#,##0'
  );

  sh.getRange(
    inicio,
    22,
    cantidadFilas,
    1
  ).setNumberFormat(
    '$ #,##0.00'
  );

  sh.getRange(
    inicio,
    4,
    cantidadFilas,
    1
  ).setWrap(true);

  /*
   * Colores por prioridad, riesgo y acción.
   */
  const datos =
    sh.getRange(
      inicio,
      1,
      cantidadFilas,
      7
    ).getDisplayValues();

  const fondosPrioridad = [];
  const fuentesPrioridad = [];
  const fondosRiesgo = [];
  const fuentesRiesgo = [];
  const fondosAccion = [];
  const fuentesAccion = [];

  datos.forEach(fila => {
    const prioridad =
      dpNormalizarTexto_(fila[0]);

    const riesgo =
      dpNormalizarTexto_(fila[4]);

    const accion =
      dpNormalizarTexto_(fila[6]);

    const estiloPrioridad =
      dpEstiloTexto_(
        prioridad,
        {
          P1: ['#F4CCCC', '#9C0006'],
          P2: ['#FCE5CD', '#B45F06'],
          P3: ['#FFF2CC', '#7F6000'],
          P4: ['#D9EAD3', '#274E13']
        }
      );

    const estiloRiesgo =
      dpEstiloTexto_(
        riesgo,
        {
          CRITICO: ['#F4CCCC', '#9C0006'],
          ALTO: ['#FCE5CD', '#B45F06'],
          MEDIO: ['#FFF2CC', '#7F6000'],
          BAJO: ['#D9EAD3', '#274E13']
        }
      );

    const estiloAccion =
      dpEstiloAccionV5005_(accion);

    fondosPrioridad.push([
      estiloPrioridad[0]
    ]);

    fuentesPrioridad.push([
      estiloPrioridad[1]
    ]);

    fondosRiesgo.push([
      estiloRiesgo[0]
    ]);

    fuentesRiesgo.push([
      estiloRiesgo[1]
    ]);

    fondosAccion.push([
      estiloAccion[0]
    ]);

    fuentesAccion.push([
      estiloAccion[1]
    ]);
  });

  sh.getRange(
    inicio,
    1,
    cantidadFilas,
    1
  )
    .setBackgrounds(
      fondosPrioridad
    )
    .setFontColors(
      fuentesPrioridad
    )
    .setFontWeight('bold');

  sh.getRange(
    inicio,
    5,
    cantidadFilas,
    1
  )
    .setBackgrounds(
      fondosRiesgo
    )
    .setFontColors(
      fuentesRiesgo
    )
    .setFontWeight('bold');

  sh.getRange(
    inicio,
    7,
    cantidadFilas,
    1
  )
    .setBackgrounds(
      fondosAccion
    )
    .setFontColors(
      fuentesAccion
    )
    .setFontWeight('bold');
}



function dpFormatearKpiV5005_(
  valor,
  decimales,
  prefijo,
  sufijo
) {
  if (
    valor === null ||
    valor === undefined ||
    valor === ''
  ) {
    return '-';
  }

  const numero = Number(valor);

  if (!Number.isFinite(numero)) {
    return String(valor);
  }

  const texto =
    numero.toLocaleString(
      'es-AR',
      {
        minimumFractionDigits:
          decimales || 0,
        maximumFractionDigits:
          decimales || 0
      }
    );

  return (
    (prefijo || '') +
    texto +
    (sufijo || '')
  );
}

function dpEstiloAccionV5005_(
  accion
) {
  if (
    accion.includes('COMPRAR') ||
    accion.includes('EMITIR PI')
  ) {
    return [
      '#F4CCCC',
      '#9C0006'
    ];
  }

  if (
    accion.includes('REVISAR')
  ) {
    return [
      '#FCE5CD',
      '#B45F06'
    ];
  }

  if (
    accion.includes('ESPERAR')
  ) {
    return [
      '#D9EAF7',
      '#1F4E78'
    ];
  }

  if (
    accion === 'OK' ||
    accion.includes('NO COMPRAR')
  ) {
    return [
      '#D9EAD3',
      '#274E13'
    ];
  }

  return [
    '#FFFFFF',
    '#000000'
  ];
}

/**
 * Orden:
 * 1. Riesgo
 * 2. Días al quiebre
 * 3. Prioridad
 * 4. Cobertura
 */
function dpOrdenarDetalleProveedor_(
  a,
  b
) {
  const riesgoA =
    dpOrdenRiesgo_(
      a[4]
    );

  const riesgoB =
    dpOrdenRiesgo_(
      b[4]
    );

  if (riesgoA !== riesgoB) {
    return riesgoA - riesgoB;
  }

  const quiebreA =
    dpNumeroOrden_(
      a[18]
    );

  const quiebreB =
    dpNumeroOrden_(
      b[18]
    );

  if (quiebreA !== quiebreB) {
    return quiebreA - quiebreB;
  }

  const prioridadA =
    dpOrdenPrioridad_(
      a[0]
    );

  const prioridadB =
    dpOrdenPrioridad_(
      b[0]
    );

  if (
    prioridadA !== prioridadB
  ) {
    return prioridadA - prioridadB;
  }

  const coberturaA =
    dpNumeroOrden_(
      a[13]
    );

  const coberturaB =
    dpNumeroOrden_(
      b[13]
    );

  if (
    coberturaA !== coberturaB
  ) {
    return coberturaA -
      coberturaB;
  }

  return dpLimpiarTexto_(a[1])
    .localeCompare(
      dpLimpiarTexto_(b[1])
    );
}


function dpObtenerPrioridadFila_(
  reg
) {
  const prioridadNumerica =
    dpNumeroNullable_(
      reg.PRIORIDAD
    );

  const riesgo =
    dpNormalizarTexto_(
      reg.RIESGO_RUPTURA
    );

  const estado =
    dpNormalizarTexto_(
      reg.ESTADO_COMPRA
    );

  if (
    riesgo === 'CRITICO' ||
    estado.startsWith('URGENTE') ||
    (
      prioridadNumerica !== null &&
      prioridadNumerica <= 20
    )
  ) {
    return 'P1';
  }

  if (
    riesgo === 'ALTO' ||
    (
      prioridadNumerica !== null &&
      prioridadNumerica <= 50
    )
  ) {
    return 'P2';
  }

  if (
    prioridadNumerica !== null &&
    prioridadNumerica <= 70
  ) {
    return 'P3';
  }

  return 'P4';
}


function dpConstruirProductoPorSku_(
  productos
) {
  const mapa = new Map();

  productos.forEach(reg => {
    const sku =
      dpNormalizarTexto_(
        reg.SKU
      );

    if (sku) {
      mapa.set(
        sku,
        reg
      );
    }
  });

  return mapa;
}


function dpOrdenRiesgo_(valor) {
  const mapa = {
    CRITICO: 1,
    ALTO: 2,
    MEDIO: 3,
    BAJO: 4,
    INACTIVO: 9
  };

  return mapa[
    dpNormalizarTexto_(valor)
  ] || 8;
}


function dpOrdenPrioridad_(
  valor
) {
  const mapa = {
    P1: 1,
    P2: 2,
    P3: 3,
    P4: 4
  };

  return mapa[
    dpNormalizarTexto_(valor)
  ] || 9;
}


function dpNumeroOrden_(valor) {
  const numero =
    dpNumeroNullable_(valor);

  return numero === null
    ? Number.MAX_SAFE_INTEGER
    : numero;
}


function dpEstiloTexto_(
  valor,
  estilos
) {
  return estilos[valor] ||
    ['#FFFFFF', '#000000'];
}


function dpPrimerNumeroValido_() {
  for (
    let i = 0;
    i < arguments.length;
    i++
  ) {
    const valor =
      dpNumeroNullable_(
        arguments[i]
      );

    if (valor !== null) {
      return valor;
    }
  }

  return null;
}


/**************************************************************
 * FUNCIONES AUXILIARES AUTÓNOMAS
 **************************************************************/

function dpObtenerHoja_(ss, nombre) {
  const sh =
    ss.getSheetByName(nombre);

  if (!sh) {
    throw new Error(
      'No existe la hoja "' +
      nombre +
      '".'
    );
  }

  return sh;
}


function dpLeerFilasComoObjetos_(sh) {
  const datos =
    sh.getDataRange()
      .getValues();

  if (datos.length < 2) {
    return [];
  }

  const encabezados =
    datos[0].map(
      dpNormalizarEncabezado_
    );

  return datos
    .slice(1)
    .filter(fila =>
      fila.some(valor =>
        valor !== '' &&
        valor !== null
      )
    )
    .map(fila => {
      const obj = {};

      encabezados.forEach(
        (encabezado, indice) => {
          if (encabezado) {
            obj[encabezado] =
              fila[indice];
          }
        }
      );

      return obj;
    });
}


function dpNormalizarEncabezado_(valor) {
  return dpLimpiarTexto_(valor)
    .normalize('NFD')
    .replace(
      /[\u0300-\u036f]/g,
      ''
    )
    .toUpperCase()
    .replace(/\s+/g, '_');
}


function dpNormalizarTexto_(valor) {
  return dpLimpiarTexto_(valor)
    .normalize('NFD')
    .replace(
      /[\u0300-\u036f]/g,
      ''
    )
    .toUpperCase()
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ');
}


function dpLimpiarTexto_(valor) {
  return String(
    valor === null ||
    valor === undefined
      ? ''
      : valor
  ).trim();
}


function dpNumeroNullable_(valor) {
  if (
    valor === null ||
    valor === undefined ||
    dpLimpiarTexto_(valor) === ''
  ) {
    return null;
  }

  const numero =
    dpNumero_(valor);

  return Number.isFinite(numero)
    ? numero
    : null;
}


function dpNumero_(valor) {
  if (typeof valor === 'number') {
    return Number.isFinite(valor)
      ? valor
      : 0;
  }

  let texto =
    dpLimpiarTexto_(valor);

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


/**************************************************************
 * V5.0.006.001 - NAVEGACIÓN POR SELECCIÓN
 **************************************************************/

/**
 * La fila 9 funciona como barra de botones.
 *
 * Además, al seleccionar una fila de la tabla se memoriza
 * el SKU para utilizarlo luego desde "FICHA SKU".
 */
function onSelectionChange(e) {
  if (!e || !e.range) return;

  const sh = e.range.getSheet();

  if (
    sh.getName() !==
    SII_DETALLE_PROVEEDOR_V50031.HOJA
  ) {
    return;
  }

  const fila =
    e.range.getRow();

  const columna =
    e.range.getColumn();

  /*
   * Memoriza el último SKU seleccionado.
   */
  if (fila >= 12) {
    const sku =
      dpLimpiarTexto_(
        sh.getRange(
          fila,
          2
        ).getDisplayValue()
      );

    if (sku) {
      PropertiesService
        .getDocumentProperties()
        .setProperty(
          'SII_ULTIMO_SKU_DETALLE_PROVEEDOR',
          sku
        );
    }

    return;
  }

  if (fila !== 9) return;

  try {
    if (columna >= 1 && columna <= 2) {
      dpIrAHojaV5006_(
        SII_CFG.SHEETS.DASHBOARD ||
        'DASHBOARD'
      );

    } else if (
      columna >= 3 &&
      columna <= 4
    ) {
      dpIrAHojaV5006_(
        'CENTRO_COMPRAS'
      );

    } else if (
      columna >= 5 &&
      columna <= 6
    ) {
      dpAbrirFichaSkuV5006_();

    } else if (
      columna >= 7 &&
      columna <= 8
    ) {
      dpAbrirOrdenesProveedorV5006_();

    } else if (
      columna >= 9 &&
      columna <= 10
    ) {
      dpAbrirImportacionesV5006_();

    } else if (
      columna >= 11 &&
      columna <= 12
    ) {
      actualizarDetalleProveedor();
    }

  } catch (error) {
    SpreadsheetApp
      .getActive()
      .toast(
        error.message,
        'Navegación',
        6
      );
  }
}


function dpIrAHojaV5006_(
  nombreHoja
) {
  const ss =
    SpreadsheetApp.getActive();

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

  sh.activate();
  sh.setActiveSelection('A1');
}


/**
 * Abre la ficha o ubica el SKU seleccionado.
 */
function dpAbrirFichaSkuV5006_() {
  const ss =
    SpreadsheetApp.getActive();

  const sku =
    PropertiesService
      .getDocumentProperties()
      .getProperty(
        'SII_ULTIMO_SKU_DETALLE_PROVEEDOR'
      );

  if (!sku) {
    throw new Error(
      'Seleccioná primero una fila de SKU en la tabla.'
    );
  }

  /*
   * Si existe una función específica que recibe SKU,
   * se utiliza directamente.
   */
  if (
    typeof abrirFichaSkuPorCodigo ===
    'function'
  ) {
    abrirFichaSkuPorCodigo(sku);
    return;
  }

  /*
   * Respaldo: ubica el SKU en PLAN_COMPRAS.
   */
  const shPlan =
    ss.getSheetByName(
      SII_CFG.SHEETS.PLAN_COMPRAS
    );

  if (!shPlan) {
    throw new Error(
      'No existe PLAN_COMPRAS.'
    );
  }

  const encontrados =
    shPlan
      .createTextFinder(sku)
      .matchEntireCell(true)
      .findAll();

  if (encontrados.length === 0) {
    throw new Error(
      'No se encontró el SKU ' +
      sku +
      ' en PLAN_COMPRAS.'
    );
  }

  shPlan.activate();
  shPlan.setActiveRange(
    encontrados[0]
  );

  if (
    typeof abrirFichaSku ===
    'function'
  ) {
    abrirFichaSku();
  }
}


/**
 * Abre ORDENES. En una versión posterior se aplicará
 * automáticamente el filtro por proveedor.
 */
function dpAbrirOrdenesProveedorV5006_() {
  dpIrAHojaV5006_(
    SII_CFG.SHEETS.ORDENES ||
    'ORDENES'
  );
}


/**
 * Abre el detalle de importaciones.
 */
function dpAbrirImportacionesV5006_() {
  const ss =
    SpreadsheetApp.getActive();

  const candidatos = [
    SII_CFG.SHEETS.DETALLE,
    'DETALLE_IMPORTACIONES'
  ];

  for (
    let i = 0;
    i < candidatos.length;
    i++
  ) {
    const nombre =
      candidatos[i];

    if (!nombre) continue;

    const sh =
      ss.getSheetByName(nombre);

    if (sh) {
      sh.activate();
      sh.setActiveSelection('A1');
      return;
    }
  }

  throw new Error(
    'No se encontró la hoja de detalle de importaciones.'
  );
}
