/**************************************************************
 * SII V5.2.004
 * DETALLE DE COMPRAS POR MARCA
 *
 * Fuente:
 * - PLAN_COMPRAS
 *
 * Funciones públicas:
 * - generarDetalleMarcaV52000_(marca)
 * - actualizarDetalleMarca()
 * - abrirDetalleMarca()
 *
 * Hoja generada:
 * - DETALLE_MARCA
 **************************************************************/

const SII_DETALLE_MARCA_V52001 = {
  VERSION: '5.2.101',
  HOJA_ORIGEN: 'PLAN_COMPRAS',
  HOJA_DESTINO: 'DETALLE_MARCA_DASHBOARD',
  HOJA_DASHBOARD: 'DASHBOARD_V5',
  CELDA_MARCA: 'C2',
  FILA_ENCABEZADOS: 7,
  FILA_DATOS: 8
};


/**
 * Genera la hoja DETALLE_MARCA para la marca indicada.
 *
 * Esta función conserva el nombre esperado por menu_compras.gs.
 */
function generarDetalleMarcaV52000_(marca) {
  const inicioTotal = Date.now();
  DM_UMBRALES_ACCION_CACHE_ = null;

  const marcaTexto = dmTexto_(marca);

  if (!marcaTexto) {
    throw new Error(
      'No se recibió una marca para generar el detalle.'
    );
  }

  const ss = SpreadsheetApp.getActive();

  const shOrigen = ss.getSheetByName(
    dmNombreHoja_(
      'PLAN_COMPRAS',
      SII_DETALLE_MARCA_V52001.HOJA_ORIGEN
    )
  );

  if (!shOrigen) {
    throw new Error(
      'No existe la hoja PLAN_COMPRAS.'
    );
  }

  const inicioLectura = Date.now();

  const ultimaFila = shOrigen.getLastRow();
  const ultimaColumna = shOrigen.getLastColumn();

  const datos = shOrigen
    .getRange(
      1,
      1,
      ultimaFila,
      ultimaColumna
    )
    .getDisplayValues();

  Logger.log(
    'LECTURA PLAN_COMPRAS: ' +
    (Date.now() - inicioLectura) +
    ' ms'
  );

  if (datos.length < 2) {
    throw new Error(
      'PLAN_COMPRAS no contiene datos.'
    );
  }

  const inicioPreparacion = Date.now();

  const encabezadosNormalizados =
    datos[0].map(dmNormalizarEncabezado_);

  const columnas =
    dmResolverColumnas_(encabezadosNormalizados);

  if (columnas.marca === -1) {
    throw new Error(
      'PLAN_COMPRAS no contiene la columna MARCA.'
    );
  }

  if (columnas.sku === -1) {
    throw new Error(
      'PLAN_COMPRAS no contiene la columna SKU.'
    );
  }

  Logger.log(
    'PREPARACIÓN DE COLUMNAS: ' +
    (Date.now() - inicioPreparacion) +
    ' ms'
  );

  const inicioFiltrado = Date.now();

  const marcaClave =
    dmNormalizarTexto_(marcaTexto);

  const registros = [];

  for (let i = 1; i < datos.length; i++) {
    const fila = datos[i];

    const marcaFila =
      dmValorColumna_(
        fila,
        columnas.marca
      );

    if (
      dmNormalizarTexto_(marcaFila) !==
      marcaClave
    ) {
      continue;
    }

    const sku =
      dmTexto_(
        dmValorColumna_(
          fila,
          columnas.sku
        )
      );

    if (!sku) {
      continue;
    }

    registros.push(
      dmConstruirRegistro_(
        fila,
        columnas
      )
    );
  }

  Logger.log(
    'FILTRADO Y CONSTRUCCIÓN: ' +
    (Date.now() - inicioFiltrado) +
    ' ms'
  );

  const inicioOrden = Date.now();

  registros.sort(
    dmOrdenarRegistros_
  );

  Logger.log(
    'ORDENAMIENTO: ' +
    (Date.now() - inicioOrden) +
    ' ms'
  );

  const inicioDestino = Date.now();

  const shDestino =
    dmObtenerOCrearHojaDestino_(ss);

  Logger.log(
    'OBTENER HOJA DESTINO: ' +
    (Date.now() - inicioDestino) +
    ' ms'
  );

  const inicioDibujo = Date.now();

  dmPrepararHoja_(
    shDestino,
    marcaTexto,
    registros
  );

  Logger.log(
    'DIBUJO Y FORMATO: ' +
    (Date.now() - inicioDibujo) +
    ' ms'
  );

  const inicioActivacion = Date.now();

  shDestino.activate();
  shDestino.setActiveSelection('A8');

  Logger.log(
    'ACTIVACIÓN DE HOJA: ' +
    (Date.now() - inicioActivacion) +
    ' ms'
  );

  Logger.log(
    'TIEMPO TOTAL: ' +
    (Date.now() - inicioTotal) +
    ' ms'
  );

  return {
    version:
      SII_DETALLE_MARCA_V52001.VERSION,
    marca: marcaTexto,
    cantidadSku: registros.length
  };
}

/**
 * Actualiza el detalle usando la marca guardada en C2.
 */
function actualizarDetalleMarca() {
  const ss = SpreadsheetApp.getActive();

  const sh = ss.getSheetByName(
    SII_DETALLE_MARCA_V52001.HOJA_DESTINO
  );

  if (!sh) {
    throw new Error(
      'No existe la hoja DETALLE_MARCA.'
    );
  }

  const marca =
    dmTexto_(
      sh.getRange(
        SII_DETALLE_MARCA_V52001.CELDA_MARCA
      ).getDisplayValue()
    );

  if (!marca) {
    throw new Error(
      'La hoja DETALLE_MARCA no tiene una marca seleccionada en C2.'
    );
  }

  return generarDetalleMarcaV52000_(marca);
}


/**
 * Abre la hoja DETALLE_MARCA.
 *
 * Se incluye para que el módulo pueda funcionar aun si esta función
 * no estuviera declarada en menu_compras.gs.
 */
function abrirDetalleMarca() {
  const ss = SpreadsheetApp.getActive();

  const sh = ss.getSheetByName(
    SII_DETALLE_MARCA_V52001.HOJA_DESTINO
  );

  if (!sh) {
    throw new Error(
      'No existe la hoja DETALLE_MARCA. ' +
      'Seleccioná primero una marca desde CENTRO_COMPRAS.'
    );
  }

  sh.activate();
  sh.setActiveSelection(
    SII_DETALLE_MARCA_V52001.CELDA_MARCA
  );
}


/**************************************************************
 * GENERACIÓN DE LA HOJA
 **************************************************************/

function dmPrepararHoja_(
  sh,
  marca,
  registros
) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const filtroExistente = sh.getFilter();

  if (filtroExistente) {
    filtroExistente.remove();
  }

  const ultimaFilaDetalle = Math.max(
    sh.getLastRow(),
    SII_DETALLE_MARCA_V52001.FILA_DATOS
  );

  const ultimaColumnaDetalle = Math.max(
    sh.getLastColumn(),
    18
  );

  sh.getRange(
    SII_DETALLE_MARCA_V52001.FILA_DATOS,
    1,
    ultimaFilaDetalle -
      SII_DETALLE_MARCA_V52001.FILA_DATOS +
      1,
    ultimaColumnaDetalle
  )
    .clearContent()
    .clearFormat();

  const columnasSalida = [
    'SKU',
    'PROVEEDOR',
    'ACCIÓN',
    'PRIORIDAD',
    'RIESGO',
    'STOCK TOTAL',
    'PENDIENTE RECIBIR',
    'CONSUMO 12 MESES',
    'PROMEDIO MENSUAL',
    'COBERTURA ACTUAL',
    'COBERTURA PROYECTADA',
    'OBJETIVO MESES',
    'CANTIDAD SUGERIDA',
    'LEAD TIME DÍAS',
    'DÍAS QUIEBRE PROYECTADO',
    'MOTIVO MRP',
    'MOTIVO',
    'FECHA LÍMITE ACCIÓN'
  ];

  if (
    sh.getMaxColumns() <
    columnasSalida.length
  ) {
    sh.insertColumnsAfter(
      sh.getMaxColumns(),
      columnasSalida.length -
        sh.getMaxColumns()
    );
  }

    /*
   * ==========================================================
   * ENCABEZADO Y NAVEGACIÓN
   * ==========================================================
   */

  // Elimina combinaciones anteriores para reconstruir
  // correctamente el encabezado.
  sh.getRange('A1:R4').breakApart();

  // ----------------------------------------------------------
  // FILA 1: TÍTULO
  // ----------------------------------------------------------

  sh.getRange('A1:R1')
    .merge()
    .setValue(
      'DETALLE DE COMPRAS POR MARCA'
    )
    .setFontSize(16)
    .setFontWeight('bold')
    .setHorizontalAlignment('center')
    .setVerticalAlignment('middle')
    .setBackground('#1f4e78')
    .setFontColor('#ffffff');

  // ----------------------------------------------------------
  // FILA 2: MARCA
  // ----------------------------------------------------------

  sh.getRange('A2:B2')
    .merge()
    .setValue('MARCA')
    .setFontWeight('bold')
    .setFontSize(10)
    .setHorizontalAlignment('center')
    .setVerticalAlignment('middle')
    .setBackground('#d9eaf7');

  sh.getRange('C2:H2')
    .merge()
    .setValue(marca)
    .setFontWeight('bold')
    .setFontSize(14)
    .setHorizontalAlignment('left')
    .setVerticalAlignment('middle')
    .setBackground('#ffffff');

  // ----------------------------------------------------------
  // FILA 2: BARRA DE NAVEGACIÓN
  // ----------------------------------------------------------

  // Por ahora se muestran las flechas, pero todavía no
  // tienen acción asignada.
  sh.getRange('I2:L2')
    .merge()
    .setValue('◀ ANTERIOR')
    .setBackground('#e7e6e6')
    .setFontColor('#666666')
    .setFontWeight('bold')
    .setHorizontalAlignment('center')
    .setVerticalAlignment('middle');

  const shDashboard = ss.getSheetByName(
    SII_DETALLE_MARCA_V52001.HOJA_DASHBOARD
  );

  if (shDashboard) {
    const gidDashboard =
      shDashboard.getSheetId();

    sh.getRange('M2:O2')
      .merge()
      .setFormula(
        '=HYPERLINK("#gid=' +
        gidDashboard +
        '";"🏠 DASHBOARD")'
      )
      .setBackground('#d9eaf7')
      .setFontColor('#1155cc')
      .setFontWeight('bold')
      .setHorizontalAlignment('center')
      .setVerticalAlignment('middle');

  } else {
    sh.getRange('M2:O2')
      .merge()
      .setValue('🏠 DASHBOARD')
      .setBackground('#d9eaf7')
      .setFontWeight('bold')
      .setHorizontalAlignment('center')
      .setVerticalAlignment('middle');
  }

  sh.getRange('P2:R2')
    .merge()
    .setValue('SIGUIENTE ▶')
    .setBackground('#e7e6e6')
    .setFontColor('#666666')
    .setFontWeight('bold')
    .setHorizontalAlignment('center')
    .setVerticalAlignment('middle');

  /*
   * ==========================================================
   * TARJETAS KPI
   * ==========================================================
   */

  const resumen =
    dmConstruirResumen_(registros);

  const tarjetas = [
    {
      rangoTitulo: 'A3:B3',
      rangoValor: 'A4:B4',
      titulo: 'SKU ANALIZADOS',
      valor: resumen.total,
      color: '#d9eaf7'
    },
    {
      rangoTitulo: 'C3:D3',
      rangoValor: 'C4:D4',
      titulo: 'COMPRAR',
      valor: resumen.comprar,
      color: '#f4cccc'
    },
    {
      rangoTitulo: 'E3:F3',
      rangoValor: 'E4:F4',
      titulo: 'PLANIFICAR',
      valor: resumen.planificar,
      color: '#fce5cd'
    },
    {
      rangoTitulo: 'G3:H3',
      rangoValor: 'G4:H4',
      titulo: 'REVISAR',
      valor: resumen.revisar,
      color: '#fff2cc'
    },
    {
      rangoTitulo: 'I3:J3',
      rangoValor: 'I4:J4',
      titulo: 'REVISAR DATOS',
      valor: resumen.revisarDatos,
      color: '#d9d9d9'
    },
    {
      rangoTitulo: 'K3:L3',
      rangoValor: 'K4:L4',
      titulo: 'SIN ACCIÓN',
      valor: resumen.sinAccion,
      color: '#d9ead3'
    },
    {
      rangoTitulo: 'M3:R3',
      rangoValor: 'M4:R4',
      titulo: 'CANTIDAD SUGERIDA',
      valor: resumen.cantidadSugerida,
      color: '#cfe2f3'
    }
  ];

  tarjetas.forEach(function(tarjeta) {

    sh.getRange(tarjeta.rangoTitulo)
      .merge()
      .setValue(tarjeta.titulo)
      .setBackground(tarjeta.color)
      .setFontWeight('bold')
      .setFontSize(9)
      .setHorizontalAlignment('center')
      .setVerticalAlignment('middle')
      .setWrap(true);

    sh.getRange(tarjeta.rangoValor)
      .merge()
      .setValue(tarjeta.valor)
      .setBackground(tarjeta.color)
      .setFontWeight('bold')
      .setFontSize(13)
      .setHorizontalAlignment('center')
      .setVerticalAlignment('middle');
  });

  sh.getRange('M4:R4')
    .setNumberFormat('#,##0');

  sh.setRowHeight(1, 36);
  sh.setRowHeight(2, 30);
  sh.setRowHeight(3, 28);
  sh.setRowHeight(4, 30);
  
  sh.getRange(
    SII_DETALLE_MARCA_V52001.FILA_ENCABEZADOS,
    1,
    1,
    columnasSalida.length
  )
    .setValues([columnasSalida])
    .setFontWeight('bold')
    .setBackground('#1f4e78')
    .setFontColor('#ffffff')
    .setHorizontalAlignment('center')
    .setWrap(true);

  if (registros.length > 0) {
    const valores =
      registros.map(reg => [
        reg.sku,
        reg.proveedor,
        reg.accion,
        reg.prioridad,
        reg.riesgo,
        reg.stockTotal,
        reg.pendienteRecibir,
        reg.consumo12Meses,
        reg.consumoMensual,
        reg.coberturaActual,
        reg.coberturaProyectada,
        reg.objetivoMeses,
        reg.cantidadSugerida,
        reg.leadTimeDias,
        reg.diasQuiebre,
        reg.motivoMrp,
        reg.motivo,
        reg.fechaLimiteAccion
      ]);

    sh.getRange(
      SII_DETALLE_MARCA_V52001.FILA_DATOS,
      1,
      valores.length,
      columnasSalida.length
    ).setValues(valores);

    dmAplicarFormatosDatos_(
      sh,
      valores.length
    );

    dmAplicarColoresAccion_(
      sh,
      registros
    );
  } else {
    sh.getRange(
      SII_DETALLE_MARCA_V52001.FILA_DATOS,
      1
    )
      .setValue(
        'No se encontraron SKU para la marca seleccionada.'
      )
      .setFontStyle('italic');
  }

  sh.setFrozenRows(
    SII_DETALLE_MARCA_V52001.FILA_ENCABEZADOS
  );

 // sh.setFrozenColumns(2);

  sh.getRange(
    SII_DETALLE_MARCA_V52001.FILA_ENCABEZADOS,
    1,
    Math.max(registros.length + 1, 2),
    columnasSalida.length
  ).createFilter();

  dmAjustarColumnas_(sh);
}


function dmConstruirResumen_(registros) {
  const resumen = {
    total: registros.length,
    comprar: 0,
    planificar: 0,
    revisar: 0,
    revisarDatos: 0,
    sinAccion: 0,
    cantidadSugerida: 0
  };

  registros.forEach(reg => {
    const accion =
      dmNormalizarTexto_(reg.accion);

    if (accion === 'COMPRAR') {
      resumen.comprar++;

    } else if (
      accion === 'PLANIFICAR'
    ) {
      resumen.planificar++;

    } else if (
      accion === 'REVISAR DATOS'
    ) {
      resumen.revisarDatos++;

    } else if (
      accion === 'REVISAR'
    ) {
      resumen.revisar++;

    } else {
      resumen.sinAccion++;
    }

    resumen.cantidadSugerida +=
      dmNumero_(reg.cantidadSugerida);

  });

  return resumen;
}


function dmAplicarFormatosDatos_(
  sh,
  cantidadFilas
) {
  const filaInicial =
    SII_DETALLE_MARCA_V52001.FILA_DATOS;

  sh.getRange(
    filaInicial,
    4,
    cantidadFilas,
    1
  ).setNumberFormat('0');

  sh.getRange(
    filaInicial,
    6,
    cantidadFilas,
    4
  ).setNumberFormat('#,##0.00');

  sh.getRange(
    filaInicial,
    10,
    cantidadFilas,
    3
  ).setNumberFormat('0.00');

  sh.getRange(
    filaInicial,
    13,
    cantidadFilas,
    1
  ).setNumberFormat('#,##0');

  sh.getRange(
    filaInicial,
    14,
    cantidadFilas,
    2
  ).setNumberFormat('0');

  sh.getRange(
    filaInicial,
    1,
    cantidadFilas,
    18
  )
    .setVerticalAlignment('middle')
    .setWrap(true);
}


function dmAplicarColoresAccion_(
  sh,
  registros
) {
  const colores = registros.map(reg => {
    const accion =
      dmNormalizarTexto_(reg.accion);

    if (accion === 'COMPRAR') {
      return ['#f4cccc'];

    }

    if (accion === 'PLANIFICAR') {
      return ['#fce5cd'];

    }

    if (accion === 'REVISAR') {
      return ['#fff2cc'];

    }

    if (accion === 'REVISAR DATOS') {
      return ['#d9d9d9'];
    }

    return ['#d9ead3'];
  });

  sh.getRange(
    SII_DETALLE_MARCA_V52001.FILA_DATOS,
    3,
    registros.length,
    1
  ).setBackgrounds(colores);
}


function dmAjustarColumnas_(sh) {
  const anchos = [
    130,
    220,
    110,
    90,
    130,
    100,
    120,
    120,
    120,
    120,
    140,
    110,
    130,
    110,
    150,
    260,
    260,
    140
  ];

  anchos.forEach(
    (ancho, indice) => {
      sh.setColumnWidth(
        indice + 1,
        ancho
      );
    }
  );
}


/**************************************************************
 * LECTURA Y NORMALIZACIÓN DE PLAN_COMPRAS
 **************************************************************/

function dmResolverColumnas_(encabezados) {
  return {
    sku:
      dmBuscarColumna_(
        encabezados,
        ['SKU']
      ),

    marca:
      dmBuscarColumna_(
        encabezados,
        ['MARCA']
      ),

    proveedor:
      dmBuscarColumna_(
        encabezados,
        ['PROVEEDOR']
      ),

    accion:
      dmBuscarColumna_(
        encabezados,
        ['ACCION', 'ESTADO_COMPRA']
      ),

    prioridad:
      dmBuscarColumna_(
        encabezados,
        ['PRIORIDAD']
      ),

    riesgo:
      dmBuscarColumna_(
        encabezados,
        [
          'RIESGO_RUPTURA',
          'RIESGO'
        ]
      ),

    stock:
      dmBuscarColumna_(
        encabezados,
        [
          'STOCK_TOTAL',
          'STOCK_DISPONIBLE'
        ]
      ),

    pendiente:
      dmBuscarColumna_(
        encabezados,
        ['PENDIENTE_RECIBIR']
      ),

    consumo12Meses:
      dmBuscarColumna_(
        encabezados,
        ['CONSUMO_12_MESES']
      ),

    consumo:
      dmBuscarColumna_(
        encabezados,
        ['PROMEDIO_MENSUAL']
      ),

    coberturaActual:
      dmBuscarColumna_(
        encabezados,
        ['COBERTURA_ACTUAL_MESES']
      ),

    coberturaProyectada:
      dmBuscarColumna_(
        encabezados,
        ['COBERTURA_PROYECTADA_MESES']
      ),

    objetivoMeses:
      dmBuscarColumna_(
        encabezados,
        ['OBJETIVO_MESES']
      ),

    cantidadSugerida:
      dmBuscarColumna_(
        encabezados,
        ['CANTIDAD_SUGERIDA']
      ),

    compraEstimada:
      dmBuscarColumna_(
        encabezados,
        [
          'COMPRA_ESTIMADA_USD',
          'COMPRA_USD'
        ]
      ),

    leadTime:
      dmBuscarColumna_(
        encabezados,
        ['LEAD_TIME_DIAS']
      ),

    diasQuiebre:
      dmBuscarColumna_(
        encabezados,
        [
          'DIAS_QUIEBRE_PROYECTADO',
          'DIAS_QUIEBRE'
        ]
      ),

    motivoMrp:
      dmBuscarColumna_(
        encabezados,
        ['MOTIVO_MRP']
      ),

    motivo:
      dmBuscarColumna_(
        encabezados,
        ['MOTIVO']
      ),

    fechaLimiteAccion:
      dmBuscarColumna_(
        encabezados,
        ['FECHA_LIMITE_ACCION']
      )
  };
}


function dmConstruirRegistro_(
  fila,
  columnas
) {
  const accionOriginal =
    dmTexto_(
      dmValorColumna_(
        fila,
        columnas.accion
      )
    );

  const prioridad =
    dmNumero_(
      dmValorColumna_(
        fila,
        columnas.prioridad
      )
    );

  return {
    sku:
      dmTexto_(
        dmValorColumna_(
          fila,
          columnas.sku
        )
      ),

    proveedor:
      dmTexto_(
        dmValorColumna_(
          fila,
          columnas.proveedor
        )
      ),

    accion:
      dmClasificarAccion_(
        accionOriginal,
        prioridad
      ),

    prioridad: prioridad,

    riesgo:
      dmTexto_(
        dmValorColumna_(
          fila,
          columnas.riesgo
        )
      ),

    stockTotal:
      dmNumero_(
        dmValorColumna_(
          fila,
          columnas.stock
        )
      ),

    pendienteRecibir:
      dmNumero_(
        dmValorColumna_(
          fila,
          columnas.pendiente
        )
      ),

    consumo12Meses:
      dmNumero_(
        dmValorColumna_(
          fila,
          columnas.consumo12Meses
        )
      ),

    consumoMensual:
      dmNumero_(
        dmValorColumna_(
          fila,
          columnas.consumo
        )
      ),

    coberturaActual:
      dmNumeroNullable_(
        dmValorColumna_(
          fila,
          columnas.coberturaActual
        )
      ),

    coberturaProyectada:
      dmNumeroNullable_(
        dmValorColumna_(
          fila,
          columnas.coberturaProyectada
        )
      ),

    objetivoMeses:
      dmNumeroNullable_(
        dmValorColumna_(
          fila,
          columnas.objetivoMeses
        )
      ),

    cantidadSugerida:
      dmNumero_(
        dmValorColumna_(
          fila,
          columnas.cantidadSugerida
        )
      ),


    leadTimeDias:
      dmNumeroNullable_(
        dmValorColumna_(
          fila,
          columnas.leadTime
        )
      ),

    diasQuiebre:
      dmNumeroNullable_(
        dmValorColumna_(
          fila,
          columnas.diasQuiebre
        )
      ),

    motivoMrp:
      dmTexto_(
        dmValorColumna_(
          fila,
          columnas.motivoMrp
        )
      ),

    motivo:
      dmTexto_(
        dmValorColumna_(
          fila,
          columnas.motivo
        )
      ),

    fechaLimiteAccion:
      dmTexto_(
        dmValorColumna_(
          fila,
          columnas.fechaLimiteAccion
        )
      )
  };
}


function dmClasificarAccion_(
  accionOriginal,
  score
) {
  const texto =
    dmNormalizarTexto_(accionOriginal);

  if (
    texto.includes('REVISAR DATOS') ||
    texto.includes('SIN HISTORIAL')
  ) {
    return 'REVISAR DATOS';
  }

  if (texto.includes('COMPRAR')) {
    return 'COMPRAR';
  }

  if (texto.includes('PLANIFICAR')) {
    return 'PLANIFICAR';
  }

  if (texto.includes('REVISAR')) {
    return 'REVISAR';
  }

  if (
    texto === 'OK' ||
    texto.includes('SIN ACCION')
  ) {
    return 'SIN ACCIÓN';
  }

  const umbrales =
    dmObtenerUmbralesAccion_();

  if (score >= umbrales.comprar) {
    return 'COMPRAR';
  }

  if (score >= umbrales.planificar) {
    return 'PLANIFICAR';
  }

  if (score >= umbrales.revisar) {
    return 'REVISAR';
  }

  return 'SIN ACCIÓN';
}

let DM_UMBRALES_ACCION_CACHE_ = null;

function dmObtenerUmbralesAccion_() {
  if (DM_UMBRALES_ACCION_CACHE_ !== null) {
    return DM_UMBRALES_ACCION_CACHE_;
  }

  DM_UMBRALES_ACCION_CACHE_ = {
    comprar:
      dmParametroNumero_(
        'IPC',
        'IPC_COMPRAR',
        80
      ),

    planificar:
      dmParametroNumero_(
        'IPC',
        'IPC_PLANIFICAR',
        60
      ),

    revisar:
      dmParametroNumero_(
        'IPC',
        'IPC_REVISAR',
        40
      )
  };

  return DM_UMBRALES_ACCION_CACHE_;
}


function dmOrdenarRegistros_(a, b) {

  const ordenAccion = {
    COMPRAR: 1,
    PLANIFICAR: 2,
    REVISAR: 3,
    "REVISAR DATOS": 4,
    "SIN ACCIÓN": 5
  };

  const ordenRiesgo = {
    CRÍTICO: 1,
    CRITICO: 1,
    ALTO: 2,
    MEDIO: 3,
    BAJO: 4,
    "SIN RIESGO": 5,
    "": 99
  };

  // 1) Acción
  const accionA = ordenAccion[a.accion] ?? 99;
  const accionB = ordenAccion[b.accion] ?? 99;

  if (accionA !== accionB) {
    return accionA - accionB;
  }

  // 2) Riesgo
  const riesgoA =
    ordenRiesgo[
      String(a.riesgo || "")
        .trim()
        .toUpperCase()
    ] ?? 99;

  const riesgoB =
    ordenRiesgo[
      String(b.riesgo || "")
        .trim()
        .toUpperCase()
    ] ?? 99;

  if (riesgoA !== riesgoB) {
    return riesgoA - riesgoB;
  }

  // 3) Menor cantidad de días al quiebre
  const quiebreA =
    a.diasQuiebre == null
      ? 999999
      : Number(a.diasQuiebre);

  const quiebreB =
    b.diasQuiebre == null
      ? 999999
      : Number(b.diasQuiebre);

  if (quiebreA !== quiebreB) {
    return quiebreA - quiebreB;
  }

  // 4) Prioridad
  if (a.prioridad !== b.prioridad) {
    return b.prioridad - a.prioridad;
  }

  // 5) Cobertura
  const coberturaA =
    a.coberturaActual == null
      ? 999999
      : Number(a.coberturaActual);

  const coberturaB =
    b.coberturaActual == null
      ? 999999
      : Number(b.coberturaActual);

  if (coberturaA !== coberturaB) {
    return coberturaA - coberturaB;
  }

  // 6) SKU (para mantener un orden estable)
  return String(a.sku).localeCompare(
    String(b.sku),
    "es"
  );
}


/**************************************************************
 * UTILIDADES
 **************************************************************/

function dmObtenerOCrearHojaDestino_(ss) {
  let sh = ss.getSheetByName(
    SII_DETALLE_MARCA_V52001.HOJA_DESTINO
  );

  if (!sh) {
    sh = ss.insertSheet(
      SII_DETALLE_MARCA_V52001.HOJA_DESTINO
    );
  }

  return sh;
}


function dmBuscarColumna_(
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


function dmValorColumna_(
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


function dmNombreHoja_(
  clave,
  respaldo
) {
  if (
    typeof SII_CFG !== 'undefined' &&
    SII_CFG.SHEETS &&
    SII_CFG.SHEETS[clave]
  ) {
    return SII_CFG.SHEETS[clave];
  }

  return respaldo;
}


function dmParametroNumero_(
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


function dmNormalizarEncabezado_(valor) {
  return dmTexto_(valor)
    .normalize('NFD')
    .replace(
      /[\u0300-\u036f]/g,
      ''
    )
    .toUpperCase()
    .replace(/\s+/g, '_');
}


function dmNormalizarTexto_(valor) {
  return dmTexto_(valor)
    .normalize('NFD')
    .replace(
      /[\u0300-\u036f]/g,
      ''
    )
    .toUpperCase()
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ');
}


function dmTexto_(valor) {
  return String(
    valor === null ||
    valor === undefined
      ? ''
      : valor
  ).trim();
}


function dmNumeroNullable_(valor) {
  if (
    valor === null ||
    valor === undefined ||
    dmTexto_(valor) === ''
  ) {
    return null;
  }

  return dmNumero_(valor);
}


function dmNumero_(valor) {
  if (typeof valor === 'number') {
    return Number.isFinite(valor)
      ? valor
      : 0;
  }

  if (
    typeof numero_ === 'function'
  ) {
    return numero_(valor);
  }

  let texto =
    dmTexto_(valor)
      .replace(/[^\d,.-]/g, '');

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

function generarDetalleMarcaDashboardV5_(marca) {
  return generarDetalleMarcaV52000_(marca);
}
