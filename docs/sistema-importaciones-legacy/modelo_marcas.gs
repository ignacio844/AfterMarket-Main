/**************************************************************
 * SII V6.1.003
 * MODELO_MARCAS RÁPIDO
 *
 * Fuente: PLAN_COMPRAS
 * Destino: MODELO_MARCAS
 *
 * No usa:
 * - sku_modelo
 * - lotes
 * - triggers
 * - _MODELO_MARCAS_BASE
 *
 * Funciones públicas:
 * - actualizarModeloMarcas()
 * - abrirModeloMarcas()
 * - limpiarProcesoAnteriorModeloMarcas()
 * - probarModeloMarcasV61003()
 **************************************************************/

const SII_MODELO_MARCAS_V61003 = {
  VERSION: '6.1.003',
  ORIGEN: 'PLAN_COMPRAS',
  DESTINO: 'MODELO_MARCAS',
  TRIGGER_ANTERIOR: 'procesarLoteModeloMarcas',
  ESTADO_ANTERIOR: 'SII_MODELO_MARCAS_V61002_ESTADO',

  ENCABEZADOS: [
    'MARCA',
    'RANKING_FACTURACION',
    'ABC',
    'CANT_SKU',
    'SKU_CON_VENTAS',
    'SKU_CRITICOS',
    'SKU_URGENTES',
    'UNIDADES_12_MESES',
    'FACTURACION_12_MESES',
    'FACTURACION_PROMEDIO_MENSUAL',
    'PARTICIPACION_FACTURACION',
    'STOCK_TOTAL',
    'PENDIENTE_RECIBIR',
    'COBERTURA_MINIMA_MESES',
    'COBERTURA_PROMEDIO_MESES',
    'CANTIDAD_SUGERIDA',
    'COMPRA_SUGERIDA_USD',
    'LEAD_TIME_PROMEDIO_DIAS',
    'PRIMER_QUIEBRE_DIAS',
    'FACTURACION_LEAD_TIME',
    'RIESGO_ECONOMICO_ESTIMADO',
    'RIESGO_MAXIMO',
    'PRIORIDAD_SISTEMA',
    'ACCION_RECOMENDADA',
    'CALIDAD_DATOS_PROMEDIO',
    'SKU_CON_ALERTAS_DATOS',
    'ULTIMA_ACTUALIZACION',
    'RESPONSABLE',
    'PRIORIDAD_COMERCIAL',
    'ESTRATEGIA',
    'OBSERVACIONES',
    'ULTIMA_REVISION'
  ],

  MANUALES: [
    'RESPONSABLE',
    'PRIORIDAD_COMERCIAL',
    'ESTRATEGIA',
    'OBSERVACIONES',
    'ULTIMA_REVISION'
  ],

  RIESGO_ORDEN: {
    'INACTIVO': 0,
    'SIN CONSUMO': 1,
    'BAJO': 2,
    'MEDIO': 3,
    'ALTO': 4,
    'CRITICO': 5
  }
};


function actualizarModeloMarcas() {
  const inicio = Date.now();
  const ss = SpreadsheetApp.getActive();
  const shOrigen = ss.getSheetByName(
    SII_MODELO_MARCAS_V61003.ORIGEN
  );

  if (!shOrigen) {
    throw new Error(
      'No existe la hoja PLAN_COMPRAS.'
    );
  }

  const datos = shOrigen
    .getDataRange()
    .getValues();

  if (datos.length < 2) {
    throw new Error(
      'PLAN_COMPRAS no contiene datos.'
    );
  }

  const encabezados = datos[0].map(
    mm3Encabezado_
  );

  const c = mm3Columnas_(encabezados);

  if (c.sku === -1) {
    throw new Error(
      'PLAN_COMPRAS no contiene la columna SKU.'
    );
  }

  if (c.marca === -1) {
    throw new Error(
      'PLAN_COMPRAS no contiene la columna MARCA.'
    );
  }

  const shDestino =
    mm3ObtenerHoja_(
      ss,
      SII_MODELO_MARCAS_V61003.DESTINO
    );

  const manuales =
    mm3LeerManuales_(shDestino);

  const grupos =
    mm3Agrupar_(datos.slice(1), c);

  const salida =
    mm3Salida_(
      Array.from(grupos.values()),
      manuales
    );

  mm3Escribir_(shDestino, salida);

  const resultado = {
    version:
      SII_MODELO_MARCAS_V61003.VERSION,
    filasPlanCompras:
      datos.length - 1,
    marcas:
      salida.length,
    duracionMs:
      Date.now() - inicio
  };

  Logger.log(
    JSON.stringify(resultado, null, 2)
  );

  ss.toast(
    salida.length +
      ' marcas generadas en ' +
      Math.round(
        resultado.duracionMs / 1000
      ) +
      ' segundos.',
    'MODELO_MARCAS V6.1.003',
    10
  );

  return resultado;
}


function abrirModeloMarcas() {
  const ss = SpreadsheetApp.getActive();
  const sh = ss.getSheetByName(
    SII_MODELO_MARCAS_V61003.DESTINO
  );

  if (!sh) {
    throw new Error(
      'No existe MODELO_MARCAS.'
    );
  }

  sh.showSheet();
  sh.activate();
  sh.setActiveSelection('A1');
}


function probarModeloMarcasV61003() {
  return actualizarModeloMarcas();
}


/**
 * Elimina triggers de V6.1.002 y marca ese proceso como cancelado.
 * No borra _MODELO_MARCAS_BASE.
 */
function limpiarProcesoAnteriorModeloMarcas() {
  let eliminados = 0;

  ScriptApp.getProjectTriggers()
    .forEach(trigger => {
      if (
        trigger.getHandlerFunction() ===
        SII_MODELO_MARCAS_V61003
          .TRIGGER_ANTERIOR
      ) {
        ScriptApp.deleteTrigger(trigger);
        eliminados++;
      }
    });

  const props =
    PropertiesService.getDocumentProperties();

  const texto = props.getProperty(
    SII_MODELO_MARCAS_V61003
      .ESTADO_ANTERIOR
  );

  if (texto) {
    try {
      const estado = JSON.parse(texto);

      estado.estado =
        'CANCELADO_POR_V6_1_003';

      estado.actualizadoEn =
        new Date().toISOString();

      props.setProperty(
        SII_MODELO_MARCAS_V61003
          .ESTADO_ANTERIOR,
        JSON.stringify(estado)
      );
    } catch (error) {
      Logger.log(
        'No se pudo actualizar el estado anterior: ' +
        error.message
      );
    }
  }

  const resultado = {
    triggersEliminados: eliminados,
    hojaTemporalConservada:
      '_MODELO_MARCAS_BASE'
  };

  Logger.log(
    JSON.stringify(resultado, null, 2)
  );

  return resultado;
}


/**************************************************************
 * COLUMNAS
 **************************************************************/

function mm3Columnas_(h) {
  return {
    sku: mm3Buscar_(h, ['SKU']),
    marca: mm3Buscar_(h, ['MARCA']),

    stock: mm3Buscar_(
      h,
      ['STOCK_TOTAL', 'STOCK_DISPONIBLE']
    ),

    pendiente: mm3Buscar_(
      h,
      ['PENDIENTE_RECIBIR', 'PENDIENTE_TOTAL']
    ),

    consumo12: mm3Buscar_(
      h,
      ['CONSUMO_12_MESES', 'UNIDADES_12_MESES']
    ),

    promedio: mm3Buscar_(
      h,
      ['PROMEDIO_MENSUAL', 'CONSUMO_MENSUAL']
    ),

    cobertura: mm3Buscar_(
      h,
      ['COBERTURA_ACTUAL_MESES', 'COBERTURA_ACTUAL']
    ),

    cantidad: mm3Buscar_(
      h,
      ['CANTIDAD_SUGERIDA']
    ),

    compraUsd: mm3Buscar_(
      h,
      [
        'COMPRA_ESTIMADA_USD',
        'COMPRA_SUGERIDA_USD',
        'COMPRA_USD'
      ]
    ),

    leadTime: mm3Buscar_(
      h,
      ['LEAD_TIME_DIAS']
    ),

    quiebre: mm3Buscar_(
      h,
      [
        'DIAS_QUIEBRE_PROYECTADO',
        'DIAS_QUIEBRE_FISICO',
        'DIAS_QUIEBRE'
      ]
    ),

    riesgo: mm3Buscar_(
      h,
      ['RIESGO_RUPTURA', 'RIESGO']
    ),

    estadoCompra: mm3Buscar_(
      h,
      ['ESTADO_COMPRA']
    ),

    accion: mm3Buscar_(
      h,
      ['ACCION']
    ),

    prioridad: mm3Buscar_(
      h,
      ['PRIORIDAD']
    ),

    facturacion12: mm3Buscar_(
      h,
      [
        'FACTURACION_12_MESES',
        'VENTAS_12_MESES_IMPORTE',
        'IMPORTE_12_MESES'
      ]
    ),

    calidad: mm3Buscar_(
      h,
      ['CALIDAD_DATOS', 'CALIDAD_DATOS_PUNTAJE']
    ),

    alertas: mm3Buscar_(
      h,
      ['CANT_ALERTAS', 'CANTIDAD_ALERTAS', 'ALERTAS_DATOS']
    ),

    motivo: mm3Buscar_(
      h,
      ['MOTIVO', 'MOTIVO_MRP']
    )
  };
}


/**************************************************************
 * AGRUPACIÓN
 **************************************************************/

function mm3Agrupar_(filas, c) {
  const grupos = new Map();

  filas.forEach(fila => {
    const sku = mm3Texto_(
      mm3Valor_(fila, c.sku)
    );

    if (!sku) {
      return;
    }

    const marca = mm3Texto_(
      mm3Valor_(fila, c.marca)
    ) || 'SIN MARCA';

    const claveMarca =
      mm3Normalizar_(marca);

    if (!grupos.has(claveMarca)) {
      grupos.set(
        claveMarca,
        mm3GrupoNuevo_(marca)
      );
    }

    const g = grupos.get(claveMarca);
    const claveSku = mm3Clave_(sku);

    if (claveSku && g.skus.has(claveSku)) {
      return;
    }

    if (claveSku) {
      g.skus.add(claveSku);
    }

    g.cantSku++;

    const consumo12 = mm3Numero_(
      mm3Valor_(fila, c.consumo12)
    );

    const promedio = mm3Numero_(
      mm3Valor_(fila, c.promedio)
    );

    if (
      consumo12 !== 0 ||
      promedio !== 0
    ) {
      g.skuConVentas++;
    }

    g.unidades12 += consumo12;

    g.facturacion12 += mm3Numero_(
      mm3Valor_(fila, c.facturacion12)
    );

    g.stock += mm3Numero_(
      mm3Valor_(fila, c.stock)
    );

    g.pendiente += mm3Numero_(
      mm3Valor_(fila, c.pendiente)
    );

    g.cantidad += mm3Numero_(
      mm3Valor_(fila, c.cantidad)
    );

    g.compraUsd += mm3Numero_(
      mm3Valor_(fila, c.compraUsd)
    );

    const cobertura = mm3NumeroNulo_(
      mm3Valor_(fila, c.cobertura)
    );

    if (cobertura !== null) {
      g.sumaCobertura += cobertura;
      g.cantCobertura++;

      if (
        g.coberturaMin === null ||
        cobertura < g.coberturaMin
      ) {
        g.coberturaMin = cobertura;
      }
    }

    const lead = mm3NumeroNulo_(
      mm3Valor_(fila, c.leadTime)
    );

    if (lead !== null) {
      g.sumaLead += lead;
      g.cantLead++;
    }

    const quiebre = mm3NumeroNulo_(
      mm3Valor_(fila, c.quiebre)
    );

    if (
      quiebre !== null &&
      (
        g.primerQuiebre === null ||
        quiebre < g.primerQuiebre
      )
    ) {
      g.primerQuiebre = quiebre;
    }

    const riesgo = mm3Normalizar_(
      mm3Valor_(fila, c.riesgo)
    );

    g.riesgoMax = mm3MayorRiesgo_(
      g.riesgoMax,
      riesgo
    );

    const estado = mm3Normalizar_(
      mm3Valor_(fila, c.estadoCompra)
    );

    const accion = mm3Normalizar_(
      mm3Valor_(fila, c.accion)
    );

    if (
      riesgo === 'CRITICO' ||
      riesgo === 'ALTO' ||
      accion === 'COMPRAR' ||
      estado.includes('URGENTE')
    ) {
      g.skuCriticos++;
    }

    if (
      estado.includes('URGENTE') ||
      (
        accion === 'COMPRAR' &&
        (
          riesgo === 'CRITICO' ||
          riesgo === 'ALTO'
        )
      )
    ) {
      g.skuUrgentes++;
    }

    const calidad = mm3NumeroNulo_(
      mm3Valor_(fila, c.calidad)
    );

    if (calidad !== null) {
      g.sumaCalidad += calidad;
      g.cantCalidad++;
    }

    const alertas = mm3Numero_(
      mm3Valor_(fila, c.alertas)
    );

    const motivo = mm3Normalizar_(
      mm3Valor_(fila, c.motivo)
    );

    if (
      alertas > 0 ||
      motivo.includes('REVISAR DATOS') ||
      motivo.includes('SIN HISTORIAL') ||
      motivo.includes('SIN PARAMETRO') ||
      motivo.includes('SIN MARCA')
    ) {
      g.skuAlertas++;
    }
  });

  return grupos;
}


function mm3GrupoNuevo_(marca) {
  return {
    marca: marca,
    skus: new Set(),
    cantSku: 0,
    skuConVentas: 0,
    skuCriticos: 0,
    skuUrgentes: 0,
    unidades12: 0,
    facturacion12: 0,
    stock: 0,
    pendiente: 0,
    cantidad: 0,
    compraUsd: 0,
    sumaCobertura: 0,
    cantCobertura: 0,
    coberturaMin: null,
    sumaLead: 0,
    cantLead: 0,
    primerQuiebre: null,
    riesgoMax: 'BAJO',
    sumaCalidad: 0,
    cantCalidad: 0,
    skuAlertas: 0
  };
}


/**************************************************************
 * SALIDA
 **************************************************************/

function mm3Salida_(grupos, manuales) {
  const totalFacturacion =
    grupos.reduce(
      (suma, g) =>
        suma + g.facturacion12,
      0
    );

  grupos.sort(
    (a, b) =>
      b.facturacion12 -
      a.facturacion12 ||
      b.skuUrgentes -
      a.skuUrgentes ||
      b.skuCriticos -
      a.skuCriticos ||
      a.marca.localeCompare(b.marca)
  );

  let acumulado = 0;

  return grupos.map((g, indice) => {
    const participacion =
      totalFacturacion > 0
        ? g.facturacion12 /
          totalFacturacion
        : 0;

    const previo = acumulado;
    acumulado += participacion;

    const abc =
      g.facturacion12 <= 0
        ? 'SIN DATOS'
        : previo < 0.80
          ? 'A'
          : previo < 0.95
            ? 'B'
            : 'C';

    const coberturaPromedio =
      g.cantCobertura > 0
        ? g.sumaCobertura /
          g.cantCobertura
        : '';

    const leadPromedio =
      g.cantLead > 0
        ? g.sumaLead /
          g.cantLead
        : '';

    const factMensual =
      g.facturacion12 / 12;

    const prioridad =
      mm3Prioridad_(g);

    const accion =
      mm3Accion_(g, prioridad);

    const calidadPromedio =
      g.cantCalidad > 0
        ? g.sumaCalidad /
          g.cantCalidad
        : '';

    const manual =
      manuales.get(
        mm3Normalizar_(g.marca)
      ) || {};

    return [
      g.marca,
      indice + 1,
      abc,
      g.cantSku,
      g.skuConVentas,
      g.skuCriticos,
      g.skuUrgentes,
      g.unidades12,
      g.facturacion12,
      factMensual,
      participacion,
      g.stock,
      g.pendiente,
      g.coberturaMin === null
        ? ''
        : g.coberturaMin,
      coberturaPromedio,
      Math.ceil(g.cantidad),
      g.compraUsd,
      leadPromedio,
      g.primerQuiebre === null
        ? ''
        : g.primerQuiebre,
      '',
      '',
      g.riesgoMax,
      prioridad,
      accion,
      calidadPromedio,
      g.skuAlertas,
      new Date(),
      manual.RESPONSABLE || '',
      manual.PRIORIDAD_COMERCIAL || '',
      manual.ESTRATEGIA || '',
      manual.OBSERVACIONES || '',
      manual.ULTIMA_REVISION || ''
    ];
  });
}


function mm3Prioridad_(g) {
  if (
    g.skuUrgentes > 0 ||
    g.riesgoMax === 'CRITICO'
  ) {
    return 'P1';
  }

  if (
    g.skuCriticos > 0 ||
    g.riesgoMax === 'ALTO'
  ) {
    return 'P2';
  }

  if (
    g.cantidad > 0 ||
    g.riesgoMax === 'MEDIO'
  ) {
    return 'P3';
  }

  return 'P4';
}


function mm3Accion_(g, prioridad) {
  if (g.marca === 'SIN MARCA') {
    return 'COMPLETAR MARCA';
  }

  if (prioridad === 'P1') {
    return 'ANALIZAR COMPRA INMEDIATA';
  }

  if (prioridad === 'P2') {
    return 'PLANIFICAR COMPRA';
  }

  if (g.cantidad > 0) {
    return 'REVISAR COMPRA SUGERIDA';
  }

  if (g.skuAlertas > 0) {
    return 'REVISAR DATOS';
  }

  return 'MONITOREAR';
}


/**************************************************************
 * MANUALES
 **************************************************************/

function mm3LeerManuales_(sh) {
  const mapa = new Map();

  if (
    !sh ||
    sh.getLastRow() < 2
  ) {
    return mapa;
  }

  const datos = sh
    .getDataRange()
    .getValues();

  const encabezados =
    datos[0].map(mm3Encabezado_);

  const colMarca =
    encabezados.indexOf('MARCA');

  if (colMarca === -1) {
    return mapa;
  }

  const indices = {};

  SII_MODELO_MARCAS_V61003
    .MANUALES
    .forEach(nombre => {
      indices[nombre] =
        encabezados.indexOf(nombre);
    });

  for (
    let i = 1;
    i < datos.length;
    i++
  ) {
    const marca =
      mm3Texto_(datos[i][colMarca]);

    if (!marca) {
      continue;
    }

    const reg = {};

    Object.keys(indices)
      .forEach(nombre => {
        const col = indices[nombre];

        reg[nombre] =
          col === -1
            ? ''
            : datos[i][col];
      });

    mapa.set(
      mm3Normalizar_(marca),
      reg
    );
  }

  return mapa;
}


/**************************************************************
 * ESCRITURA
 **************************************************************/

function mm3Escribir_(sh, filas) {
  const filtro = sh.getFilter();

  if (filtro) {
    filtro.remove();
  }

  const encabezados =
    SII_MODELO_MARCAS_V61003
      .ENCABEZADOS;

  const columnas =
    encabezados.length;

  if (
    sh.getMaxColumns() < columnas
  ) {
    sh.insertColumnsAfter(
      sh.getMaxColumns(),
      columnas -
        sh.getMaxColumns()
    );
  }

  if (
    sh.getMaxRows() <
    filas.length + 1
  ) {
    sh.insertRowsAfter(
      sh.getMaxRows(),
      filas.length + 1 -
        sh.getMaxRows()
    );
  }

  sh.clear();

  sh.getRange(
    1,
    1,
    1,
    columnas
  ).setValues([encabezados]);

  if (filas.length > 0) {
    sh.getRange(
      2,
      1,
      filas.length,
      columnas
    ).setValues(filas);

    sh.getRange(
      1,
      1,
      filas.length + 1,
      columnas
    ).createFilter();
  }

  sh.setFrozenRows(1);

  sh.getRange(
    1,
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

  if (filas.length <= 0) {
    return;
  }

  const mapa = mm3Mapa_(sh);

  mm3Formato_(
    sh,
    mapa,
    'PARTICIPACION_FACTURACION',
    filas.length,
    '0.00%'
  );

  [
    'COBERTURA_MINIMA_MESES',
    'COBERTURA_PROMEDIO_MESES',
    'LEAD_TIME_PROMEDIO_DIAS',
    'PRIMER_QUIEBRE_DIAS',
    'CALIDAD_DATOS_PROMEDIO'
  ].forEach(nombre =>
    mm3Formato_(
      sh,
      mapa,
      nombre,
      filas.length,
      '0.00'
    )
  );

  mm3Formato_(
    sh,
    mapa,
    'ULTIMA_ACTUALIZACION',
    filas.length,
    'dd/MM/yyyy HH:mm'
  );

  mm3Formato_(
    sh,
    mapa,
    'ULTIMA_REVISION',
    filas.length,
    'dd/MM/yyyy'
  );

  const colPrioridadComercial =
    mapa.get('PRIORIDAD_COMERCIAL');

  if (colPrioridadComercial) {
    const validacion =
      SpreadsheetApp
        .newDataValidation()
        .requireValueInList(
          ['ALTA', 'MEDIA', 'BAJA'],
          true
        )
        .setAllowInvalid(true)
        .build();

    sh.getRange(
      2,
      colPrioridadComercial,
      filas.length,
      1
    ).setDataValidation(validacion);
  }

  sh.getRange(
    2,
    1,
    filas.length,
    columnas
  )
    .setVerticalAlignment('middle')
    .setWrap(true);

  sh.setColumnWidth(1, 180);
  sh.setColumnWidth(24, 220);
  sh.setColumnWidth(30, 220);
  sh.setColumnWidth(31, 280);

  const colPrioridad =
    mapa.get('PRIORIDAD_SISTEMA');

  if (colPrioridad) {
    const rango = sh.getRange(
      2,
      colPrioridad,
      filas.length,
      1
    );

    sh.setConditionalFormatRules([
      mm3Regla_(rango, 'P1', '#F4CCCC'),
      mm3Regla_(rango, 'P2', '#FCE5CD'),
      mm3Regla_(rango, 'P3', '#FFF2CC'),
      mm3Regla_(rango, 'P4', '#D9EAD3')
    ]);
  }
}


/**************************************************************
 * UTILIDADES
 **************************************************************/

function mm3Buscar_(encabezados, candidatos) {
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


function mm3Valor_(fila, columna) {
  if (
    columna === -1 ||
    columna === undefined
  ) {
    return '';
  }

  return fila[columna];
}


function mm3MayorRiesgo_(actual, nuevo) {
  const orden =
    SII_MODELO_MARCAS_V61003
      .RIESGO_ORDEN;

  const a =
    mm3Normalizar_(actual) ||
    'BAJO';

  const b =
    mm3Normalizar_(nuevo);

  return (
    (orden[b] || 0) >
    (orden[a] || 0)
  )
    ? b
    : a;
}


function mm3ObtenerHoja_(ss, nombre) {
  return (
    ss.getSheetByName(nombre) ||
    ss.insertSheet(nombre)
  );
}


function mm3Mapa_(sh) {
  const encabezados = sh.getRange(
    1,
    1,
    1,
    sh.getLastColumn()
  ).getDisplayValues()[0];

  const mapa = new Map();

  encabezados.forEach(
    (valor, indice) => {
      const clave =
        mm3Encabezado_(valor);

      if (clave) {
        mapa.set(
          clave,
          indice + 1
        );
      }
    }
  );

  return mapa;
}


function mm3Formato_(
  sh,
  mapa,
  nombre,
  filas,
  formato
) {
  const columna = mapa.get(nombre);

  if (!columna) {
    return;
  }

  sh.getRange(
    2,
    columna,
    filas,
    1
  ).setNumberFormat(formato);
}


function mm3Regla_(rango, texto, color) {
  return SpreadsheetApp
    .newConditionalFormatRule()
    .whenTextEqualTo(texto)
    .setBackground(color)
    .setBold(true)
    .setRanges([rango])
    .build();
}


function mm3Encabezado_(valor) {
  return mm3Texto_(valor)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/\s+/g, '_');
}


function mm3Normalizar_(valor) {
  return mm3Texto_(valor)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ');
}


function mm3Clave_(valor) {
  return mm3Normalizar_(valor)
    .replace(/[^A-Z0-9]/g, '');
}


function mm3Texto_(valor) {
  return String(
    valor === null ||
    valor === undefined
      ? ''
      : valor
  ).trim();
}


function mm3NumeroNulo_(valor) {
  if (
    valor === null ||
    valor === undefined ||
    mm3Texto_(valor) === ''
  ) {
    return null;
  }

  return mm3Numero_(valor);
}


function mm3Numero_(valor) {
  if (typeof valor === 'number') {
    return Number.isFinite(valor)
      ? valor
      : 0;
  }

  let texto =
    mm3Texto_(valor)
      .replace(/[^\d,.-]/g, '');

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
  } else if (
    texto.includes(',')
  ) {
    texto =
      texto.replace(',', '.');
  }

  const numero = Number(texto);

  return Number.isFinite(numero)
    ? numero
    : 0;
}
