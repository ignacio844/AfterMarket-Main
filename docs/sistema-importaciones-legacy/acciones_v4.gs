/**************************************************************
 * SII V4 DEV - CENTRO DE ACCIONES SPRINT 1.1 CORREGIDO
 *
 * Genera ACCIONES_DEL_DIA tomando PLAN_COMPRAS como fuente.
 * Completa DESCRIPCION, MARCA y PROVEEDOR desde PRODUCTOS
 * cuando esos datos no están disponibles en PLAN_COMPRAS.
 **************************************************************/


function actualizarAccionesDelDia() {
  const ss = SpreadsheetApp.getActive();

  const shPlan = obtenerHoja_(
    ss,
    SII_CFG.SHEETS.PLAN_COMPRAS
  );

  const shProductos = obtenerHoja_(
    ss,
    SII_CFG.SHEETS.PRODUCTOS
  );

  let shAcciones = ss.getSheetByName(
    'ACCIONES_DEL_DIA'
  );

  if (!shAcciones) {
    shAcciones = ss.insertSheet(
      'ACCIONES_DEL_DIA'
    );
  }

  const plan = leerFilasComoObjetos_(
    shPlan
  );

  const productos = leerFilasComoObjetos_(
    shProductos
  );

  const productoPorSku =
    construirMapaProductosAccionesV4_(
      productos
    );

  const fechaProceso = new Date();

  const acciones = plan
    .map(reg =>
      construirAccionV4_(
        reg,
        fechaProceso,
        productoPorSku
      )
    )
    .filter(reg => reg !== null)
    .sort(ordenarAccionesV4_);

  escribirAccionesV4_(
    shAcciones,
    acciones
  );

  aplicarFormatoAccionesV4_(
    shAcciones,
    acciones.length
  );

  ss.toast(
    acciones.length +
      ' acciones generadas.',
    'SII V4',
    6
  );

  return {
    acciones: acciones.length,
    fecha: Utilities.formatDate(
      fechaProceso,
      Session.getScriptTimeZone(),
      'dd/MM/yyyy HH:mm'
    )
  };
}


function construirMapaProductosAccionesV4_(
  productos
) {
  const mapa = new Map();

  productos.forEach(reg => {
    const sku = normalizarAccionV4_(
      reg.SKU
    );

    if (!sku) return;

    mapa.set(sku, {
      descripcion: limpiarTexto_(
        reg.DESCRIPCION
      ),
      marca: limpiarTexto_(
        reg.MARCA
      ),
      proveedor: limpiarTexto_(
        reg.PROVEEDOR
      )
    });
  });

  return mapa;
}


function construirAccionV4_(
  reg,
  fechaProceso,
  productoPorSku
) {
  const sku = limpiarTexto_(reg.SKU);

  const producto =
    productoPorSku.get(
      normalizarAccionV4_(sku)
    ) || {};

  const estadoCompra =
    normalizarAccionV4_(
      reg.ESTADO_COMPRA
    );

  const riesgo =
    normalizarAccionV4_(
      reg.RIESGO_RUPTURA
    );

  const accionOriginal =
    normalizarAccionV4_(
      reg.ACCION
    );

  if (
    estadoCompra === 'INACTIVO' ||
    estadoCompra === 'OK' ||
    accionOriginal === 'OK' ||
    accionOriginal === 'SIN ACCION'
  ) {
    return null;
  }

  const diasQuiebre =
    numeroAccionV4_(
      reg.DIAS_QUIEBRE_PROYECTADO
    );

  const leadTime =
    numeroAccionV4_(
      reg.LEAD_TIME_DIAS
    );

  const cobertura =
    numeroAccionV4_(
      reg.COBERTURA_PROYECTADA_MESES
    );

  const compraSugerida = Math.max(
    0,
    numeroAccionV4_(
      reg.CANTIDAD_SUGERIDA
    )
  );

  const transferencia = Math.max(
    0,
    numeroAccionV4_(
      reg.TRANSFERENCIA_SUGERIDA
    )
  );

  const pendienteTarde = Math.max(
    0,
    numeroAccionV4_(
      reg.PENDIENTE_QUE_LLEGA_TARDE
    )
  );

  const prioridad =
    calcularPrioridadAccionV4_({
      estadoCompra: estadoCompra,
      riesgo: riesgo,
      accion: accionOriginal,
      diasQuiebre: diasQuiebre,
      compraSugerida: compraSugerida,
      transferencia: transferencia,
      pendienteTarde: pendienteTarde
    });

  if (prioridad === 'P4') {
    return null;
  }

  const accion =
    determinarAccionOperativaV4_({
      estadoCompra: estadoCompra,
      riesgo: riesgo,
      accion: accionOriginal,
      pendienteTarde: pendienteTarde,
      transferencia: transferencia,
      compraSugerida: compraSugerida
    });

  const diasHastaActuar =
    calcularDiasHastaActuarV4_({
      prioridad: prioridad,
      diasQuiebre: diasQuiebre,
      leadTime: leadTime,
      accion: accion
    });

  return {
    prioridad: prioridad,
    fechaLimite: sumarDiasAccionV4_(
      fechaProceso,
      diasHastaActuar
    ),
    diasHastaActuar: diasHastaActuar,
    sku: sku,
    descripcion: limpiarTexto_(
      producto.descripcion
    ),
    marca:
      limpiarTexto_(reg.MARCA) ||
      limpiarTexto_(producto.marca),
    proveedor:
      limpiarTexto_(reg.PROVEEDOR) ||
      limpiarTexto_(producto.proveedor),
    accion: accion,
    estadoLogistico:
      determinarEstadoLogisticoV4_(reg),
    riesgo: riesgo || estadoCompra,
    cobertura: cobertura,
    diasQuiebre:
      diasQuiebre || '',
    compraSugerida: compraSugerida,
    transferenciaSugerida:
      transferencia,
    origenTransferencia:
      limpiarTexto_(
        reg.ORIGEN_TRANSFERENCIA
      ),
    destinoTransferencia:
      limpiarTexto_(
        reg.DESTINO_TRANSFERENCIA
      ),
    pendienteTarde: pendienteTarde,
    motivo: construirMotivoAccionV4_(
      reg,
      {
        accion: accion,
        pendienteTarde: pendienteTarde,
        transferencia: transferencia
      }
    ),
    responsable: '',
    estadoGestion: 'PENDIENTE',
    ultimaActualizacion:
      reg.ULTIMA_ACTUALIZACION ||
      fechaProceso
  };
}


function calcularPrioridadAccionV4_(datos) {
  if (
    datos.riesgo === 'CRITICO' ||
    datos.estadoCompra.startsWith(
      'URGENTE'
    ) ||
    (
      datos.diasQuiebre > 0 &&
      datos.diasQuiebre <= 15
    ) ||
    (
      datos.pendienteTarde > 0 &&
      datos.diasQuiebre > 0 &&
      datos.diasQuiebre <= 45
    )
  ) {
    return 'P1';
  }

  if (
    datos.riesgo === 'ALTO' ||
    datos.estadoCompra === 'COMPRAR' ||
    datos.accion === 'COMPRAR' ||
    (
      datos.diasQuiebre > 15 &&
      datos.diasQuiebre <= 45
    )
  ) {
    return 'P2';
  }

  if (
    datos.riesgo === 'MEDIO' ||
    datos.estadoCompra.startsWith(
      'REVISAR'
    ) ||
    datos.accion === 'REVISAR' ||
    datos.accion === 'TRANSFERIR' ||
    datos.transferencia > 0 ||
    datos.estadoCompra ===
      'SIN HISTORIAL' ||
    datos.estadoCompra ===
      'SIN CONSUMO'
  ) {
    return 'P3';
  }

  return 'P4';
}


function determinarAccionOperativaV4_(
  datos
) {
  if (
    datos.transferencia > 0 &&
    datos.compraSugerida <= 0
  ) {
    return 'TRANSFERIR';
  }

  if (
    datos.pendienteTarde > 0 &&
    [
      'CRITICO',
      'ALTO'
    ].includes(datos.riesgo)
  ) {
    return 'CONFIRMAR LLEGADA / COMPRAR';
  }

  if (
    datos.accion === 'COMPRAR' ||
    datos.compraSugerida > 0
  ) {
    return 'EMITIR PI';
  }

  if (
    datos.estadoCompra ===
      'SIN HISTORIAL'
  ) {
    return 'REVISAR ALTA / EQUIVALENCIA';
  }

  if (
    datos.estadoCompra ===
      'SIN CONSUMO'
  ) {
    return 'REVISAR CONTINUIDAD';
  }

  return datos.accion || 'REVISAR';
}


function calcularDiasHastaActuarV4_(datos) {
  if (datos.prioridad === 'P1') {
    return 0;
  }

  if (datos.prioridad === 'P2') {
    if (
      datos.diasQuiebre > 0 &&
      datos.leadTime > 0
    ) {
      return Math.max(
        0,
        Math.min(
          7,
          Math.floor(
            datos.diasQuiebre -
            datos.leadTime
          )
        )
      );
    }

    return 7;
  }

  return 30;
}


function determinarEstadoLogisticoV4_(reg) {
  if (
    numeroAccionV4_(
      reg.A_INGRESAR
    ) > 0
  ) {
    return 'A INGRESAR';
  }

  if (
    numeroAccionV4_(
      reg.EMBARCADO
    ) > 0
  ) {
    return 'EMBARCADO';
  }

  if (
    numeroAccionV4_(
      reg.A_EMBARCAR
    ) > 0
  ) {
    return 'A EMBARCAR';
  }

  if (
    numeroAccionV4_(
      reg.EN_FABRICA
    ) > 0
  ) {
    return 'EN FABRICA';
  }

  return 'SIN IMPORTACION';
}


function construirMotivoAccionV4_(
  reg,
  datos
) {
  const motivoMRP = limpiarTexto_(
    reg.MOTIVO_MRP
  );

  const motivoCompra = limpiarTexto_(
    reg.MOTIVO
  );

  if (datos.accion === 'TRANSFERIR') {
    return (
      'Transferir ' +
      datos.transferencia +
      ' unidades de ' +
      limpiarTexto_(
        reg.ORIGEN_TRANSFERENCIA
      ) +
      ' a ' +
      limpiarTexto_(
        reg.DESTINO_TRANSFERENCIA
      ) +
      '.'
    );
  }

  if (datos.pendienteTarde > 0) {
    return (
      'Hay ' +
      datos.pendienteTarde +
      ' unidades que llegarían después del quiebre. ' +
      (motivoMRP || motivoCompra)
    );
  }

  return (
    motivoMRP ||
    motivoCompra ||
    'Revisar situación del SKU.'
  );
}


function ordenarAccionesV4_(a, b) {
  const orden = {
    P1: 1,
    P2: 2,
    P3: 3,
    P4: 4
  };

  const prioridad =
    orden[a.prioridad] -
    orden[b.prioridad];

  if (prioridad !== 0) {
    return prioridad;
  }

  const fecha =
    a.fechaLimite.getTime() -
    b.fechaLimite.getTime();

  if (fecha !== 0) {
    return fecha;
  }

  const diasA =
    a.diasQuiebre === ''
      ? 999999
      : a.diasQuiebre;

  const diasB =
    b.diasQuiebre === ''
      ? 999999
      : b.diasQuiebre;

  if (diasA !== diasB) {
    return diasA - diasB;
  }

  return (
    b.compraSugerida -
    a.compraSugerida
  );
}


function escribirAccionesV4_(
  sh,
  acciones
) {
  const encabezados = [[
    'PRIORIDAD',
    'FECHA_LIMITE',
    'DIAS_HASTA_ACTUAR',
    'SKU',
    'DESCRIPCION',
    'MARCA',
    'PROVEEDOR',
    'ACCION',
    'ESTADO_LOGISTICO',
    'RIESGO_RUPTURA',
    'COBERTURA_PROYECTADA_MESES',
    'DIAS_QUIEBRE_PROYECTADO',
    'CANTIDAD_SUGERIDA',
    'TRANSFERENCIA_SUGERIDA',
    'ORIGEN_TRANSFERENCIA',
    'DESTINO_TRANSFERENCIA',
    'PENDIENTE_QUE_LLEGA_TARDE',
    'MOTIVO',
    'RESPONSABLE',
    'ESTADO_GESTION',
    'ULTIMA_ACTUALIZACION'
  ]];

  const salida = acciones.map(reg => [
    reg.prioridad,
    reg.fechaLimite,
    reg.diasHastaActuar,
    reg.sku,
    reg.descripcion,
    reg.marca,
    reg.proveedor,
    reg.accion,
    reg.estadoLogistico,
    reg.riesgo,
    reg.cobertura,
    reg.diasQuiebre,
    reg.compraSugerida,
    reg.transferenciaSugerida,
    reg.origenTransferencia,
    reg.destinoTransferencia,
    reg.pendienteTarde,
    reg.motivo,
    reg.responsable,
    reg.estadoGestion,
    reg.ultimaActualizacion
  ]);

  const filtro = sh.getFilter();

  if (filtro) {
    filtro.remove();
  }

  const columnas =
    encabezados[0].length;

  const filasALimpiar = Math.max(
    sh.getLastRow(),
    salida.length + 1
  );

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
    Math.max(2, salida.length + 1)
  ) {
    sh.insertRowsAfter(
      sh.getMaxRows(),
      Math.max(
        2,
        salida.length + 1
      ) -
      sh.getMaxRows()
    );
  }

  if (filasALimpiar > 0) {
    sh.getRange(
      1,
      1,
      filasALimpiar,
      columnas
    ).clearContent();
  }

  sh.getRange(
    1,
    1,
    1,
    columnas
  ).setValues(encabezados);

  if (salida.length > 0) {
    const tamanoBloque = 3000;

    for (
      let inicio = 0;
      inicio < salida.length;
      inicio += tamanoBloque
    ) {
      const bloque = salida.slice(
        inicio,
        inicio + tamanoBloque
      );

      sh.getRange(
        inicio + 2,
        1,
        bloque.length,
        columnas
      ).setValues(bloque);
    }

    sh.getRange(
      1,
      1,
      salida.length + 1,
      columnas
    ).createFilter();
  }
}


function aplicarFormatoAccionesV4_(
  sh,
  cantidadFilas
) {
  sh.setFrozenRows(1);
  formatearEncabezado_(sh);

  const anchos = [
    80, 105, 95, 155, 300,
    120, 220, 190, 120, 110,
    115, 115, 115, 115, 120,
    120, 130, 420, 140, 120,
    150
  ];

  anchos.forEach(
    (ancho, indice) => {
      sh.setColumnWidth(
        indice + 1,
        ancho
      );
    }
  );

  if (cantidadFilas <= 0) {
    sh.setConditionalFormatRules([]);
    return;
  }

  sh.getRange(
    2,
    2,
    cantidadFilas,
    1
  ).setNumberFormat('dd/MM/yyyy');

  sh.getRange(
    2,
    3,
    cantidadFilas,
    1
  ).setNumberFormat('0');

  sh.getRange(
    2,
    11,
    cantidadFilas,
    2
  ).setNumberFormat('0.00');

  sh.getRange(
    2,
    13,
    cantidadFilas,
    5
  ).setNumberFormat('#,##0.00');

  sh.getRange(
    2,
    18,
    cantidadFilas,
    1
  ).setWrap(true);

  sh.getRange(
    2,
    21,
    cantidadFilas,
    1
  ).setNumberFormat(
    'dd/MM/yyyy HH:mm'
  );

  const rangoPrioridad = sh.getRange(
    2,
    1,
    cantidadFilas,
    1
  );

  const rangoEstado = sh.getRange(
    2,
    20,
    cantidadFilas,
    1
  );

  const reglas = [
    SpreadsheetApp
      .newConditionalFormatRule()
      .whenTextEqualTo('P1')
      .setBackground('#F4CCCC')
      .setFontColor('#9C0006')
      .setBold(true)
      .setRanges([rangoPrioridad])
      .build(),

    SpreadsheetApp
      .newConditionalFormatRule()
      .whenTextEqualTo('P2')
      .setBackground('#FCE5CD')
      .setFontColor('#B45F06')
      .setBold(true)
      .setRanges([rangoPrioridad])
      .build(),

    SpreadsheetApp
      .newConditionalFormatRule()
      .whenTextEqualTo('P3')
      .setBackground('#FFF2CC')
      .setFontColor('#7F6000')
      .setBold(true)
      .setRanges([rangoPrioridad])
      .build(),

    SpreadsheetApp
      .newConditionalFormatRule()
      .whenTextEqualTo('PENDIENTE')
      .setBackground('#FFF2CC')
      .setFontColor('#7F6000')
      .setRanges([rangoEstado])
      .build(),

    SpreadsheetApp
      .newConditionalFormatRule()
      .whenTextEqualTo('EN ANALISIS')
      .setBackground('#D9EAD3')
      .setFontColor('#274E13')
      .setRanges([rangoEstado])
      .build(),

    SpreadsheetApp
      .newConditionalFormatRule()
      .whenTextEqualTo('EN PROCESO')
      .setBackground('#CFE2F3')
      .setFontColor('#0B5394')
      .setRanges([rangoEstado])
      .build(),

    SpreadsheetApp
      .newConditionalFormatRule()
      .whenTextEqualTo('FINALIZADO')
      .setBackground('#D9EAD3')
      .setFontColor('#38761D')
      .setRanges([rangoEstado])
      .build()
  ];

  sh.setConditionalFormatRules(
    reglas
  );

  const validacion = SpreadsheetApp
    .newDataValidation()
    .requireValueInList(
      [
        'PENDIENTE',
        'EN ANALISIS',
        'EN PROCESO',
        'FINALIZADO'
      ],
      true
    )
    .setAllowInvalid(false)
    .build();

  sh.getRange(
    2,
    20,
    cantidadFilas,
    1
  ).setDataValidation(validacion);
}


function sumarDiasAccionV4_(
  fecha,
  dias
) {
  const resultado = new Date(fecha);

  resultado.setDate(
    resultado.getDate() +
    Math.round(
      numeroAccionV4_(dias)
    )
  );

  return resultado;
}


function normalizarAccionV4_(valor) {
  return String(
    valor === null ||
    valor === undefined
      ? ''
      : valor
  )
    .trim()
    .normalize('NFD')
    .replace(
      /[\u0300-\u036f]/g,
      ''
    )
    .toUpperCase()
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ');
}


function numeroAccionV4_(valor) {
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
