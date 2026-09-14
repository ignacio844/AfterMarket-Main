/*******************************************************
 * SII V2.3.1
 * PLANIFICACIÓN DE ABASTECIMIENTO POR LEAD TIME
 *
 * No modifica el motor actual de PLAN_COMPRAS.
 * Completa únicamente las columnas predictivas.
 *******************************************************/

/**
 * Actualiza las columnas predictivas de PLAN_COMPRAS.
 */
function actualizarPlanificacionImportacion() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const nombrePlan = SII_CFG.SHEETS.PLAN_COMPRAS || 'PLAN_COMPRAS';
  const sh = ss.getSheetByName(nombrePlan);

  if (!sh) {
    throw new Error('No existe la hoja ' + nombrePlan + '.');
  }

  const ultimaFila = sh.getLastRow();

  if (ultimaFila < 2) {
    ss.toast('PLAN_COMPRAS no contiene datos.', 'SII', 5);
    return;
  }

  const parametros = leerParametrosImportacion_();
  const encabezadosActuales = sh
    .getRange(1, 1, 1, sh.getLastColumn())
    .getDisplayValues()[0]
    .map(normalizarEncabezadoPlanificacion_);

  const columnasBase = {
    marca: buscarColumnaPlanificacion_(encabezadosActuales, ['MARCA']),
    stockTotal: buscarColumnaPlanificacion_(encabezadosActuales, ['STOCK_TOTAL']),
    pendiente: buscarColumnaPlanificacion_(encabezadosActuales, ['PENDIENTE_RECIBIR']),
    promedio: buscarColumnaPlanificacion_(encabezadosActuales, ['PROMEDIO_MENSUAL'])
  };

  const columnasPredictivas = asegurarColumnasPlanificacion_(
    sh,
    [
      'LEAD_TIME_DIAS',
      'VENTAS_LEADTIME',
      'STOCK_PROYECTADO',
      'FECHA_QUIEBRE',
      'ULTIMA_FECHA_OC',
      'DIAS_HASTA_EMITIR_OC',
      'SEMAFORO'
    ]
  );

  const datos = sh
    .getRange(2, 1, ultimaFila - 1, sh.getLastColumn())
    .getValues();

  const hoy = inicioDiaPlanificacion_(new Date());
  const milisegundosDia = 24 * 60 * 60 * 1000;

  const resultados = {
    leadTime: [],
    ventasLeadTime: [],
    stockProyectado: [],
    fechaQuiebre: [],
    ultimaFechaOc: [],
    diasHastaOc: [],
    semaforo: []
  };

  datos.forEach(fila => {
    const marca = normalizarClavePlanificacion_(
      fila[columnasBase.marca]
    );

    const parametro =
      parametros[marca] ||
      parametros.DEFAULT ||
      {
        leadTime: 120,
        fabricacion: 45,
        transito: 55,
        aduana: 15,
        recepcion: 5,
        cobertura: 4
      };

    const leadTimeDias = numeroPlanificacion_(parametro.leadTime) || 120;
    const stockTotal = numeroPlanificacion_(fila[columnasBase.stockTotal]);
    const pendienteRecibir = numeroPlanificacion_(fila[columnasBase.pendiente]);
    const promedioMensual = numeroPlanificacion_(fila[columnasBase.promedio]);
    const consumoDiario = promedioMensual > 0 ? promedioMensual / 30 : 0;
    const ventasLeadTime = consumoDiario * leadTimeDias;
    const stockBase = stockTotal + pendienteRecibir;
    const stockProyectado = stockBase - ventasLeadTime;

    let fechaQuiebre = '';
    let ultimaFechaOc = '';
    let diasHastaEmitirOc = '';
    let semaforo = 'SIN CONSUMO';

    if (consumoDiario > 0) {
      const diasCobertura = stockBase > 0
        ? Math.floor(stockBase / consumoDiario)
        : 0;

      fechaQuiebre = sumarDiasPlanificacion_(hoy, diasCobertura);
      ultimaFechaOc = sumarDiasPlanificacion_(fechaQuiebre, -leadTimeDias);
      diasHastaEmitirOc = Math.ceil(
        (ultimaFechaOc.getTime() - hoy.getTime()) / milisegundosDia
      );

      if (diasHastaEmitirOc < 0) {
        semaforo = 'VENCIDO';
      } else if (diasHastaEmitirOc <= 15) {
        semaforo = 'ROJO';
      } else if (diasHastaEmitirOc <= 45) {
        semaforo = 'AMARILLO';
      } else {
        semaforo = 'VERDE';
      }
    }

    resultados.leadTime.push([leadTimeDias]);
    resultados.ventasLeadTime.push([ventasLeadTime]);
    resultados.stockProyectado.push([stockProyectado]);
    resultados.fechaQuiebre.push([fechaQuiebre]);
    resultados.ultimaFechaOc.push([ultimaFechaOc]);
    resultados.diasHastaOc.push([diasHastaEmitirOc]);
    resultados.semaforo.push([semaforo]);
  });

  const cantidadFilas = datos.length;

  escribirColumnaPlanificacion_(
    sh,
    columnasPredictivas.LEAD_TIME_DIAS,
    resultados.leadTime,
    '0'
  );

  escribirColumnaPlanificacion_(
    sh,
    columnasPredictivas.VENTAS_LEADTIME,
    resultados.ventasLeadTime,
    '#,##0.00'
  );

  escribirColumnaPlanificacion_(
    sh,
    columnasPredictivas.STOCK_PROYECTADO,
    resultados.stockProyectado,
    '#,##0.00'
  );

  escribirColumnaPlanificacion_(
    sh,
    columnasPredictivas.FECHA_QUIEBRE,
    resultados.fechaQuiebre,
    'dd/MM/yyyy'
  );

  escribirColumnaPlanificacion_(
    sh,
    columnasPredictivas.ULTIMA_FECHA_OC,
    resultados.ultimaFechaOc,
    'dd/MM/yyyy'
  );

  escribirColumnaPlanificacion_(
    sh,
    columnasPredictivas.DIAS_HASTA_EMITIR_OC,
    resultados.diasHastaOc,
    '0'
  );

  escribirColumnaPlanificacion_(
    sh,
    columnasPredictivas.SEMAFORO,
    resultados.semaforo,
    '@'
  );

  aplicarFormatoSemaforoPlanificacion_(
    sh,
    columnasPredictivas.SEMAFORO,
    cantidadFilas
  );

  ss.toast(
    cantidadFilas + ' SKU actualizados con planificación por lead time.',
    'SII - Planificación',
    7
  );
}

/**
 * Agrega las columnas faltantes y devuelve sus índices 1-based.
 */
function asegurarColumnasPlanificacion_(sh, nombres) {
  let encabezados = sh
    .getRange(1, 1, 1, sh.getLastColumn())
    .getDisplayValues()[0]
    .map(normalizarEncabezadoPlanificacion_);

  nombres.forEach(nombre => {
    const clave = normalizarEncabezadoPlanificacion_(nombre);

    if (!encabezados.includes(clave)) {
      const nuevaColumna = sh.getLastColumn() + 1;
      sh.getRange(1, nuevaColumna).setValue(nombre);
      encabezados.push(clave);
    }
  });

  const resultado = {};

  nombres.forEach(nombre => {
    resultado[nombre] = encabezados.indexOf(
      normalizarEncabezadoPlanificacion_(nombre)
    ) + 1;
  });

  return resultado;
}

/**
 * Busca una columna obligatoria y devuelve índice 0-based.
 */
function buscarColumnaPlanificacion_(encabezados, alternativas) {
  for (let i = 0; i < alternativas.length; i++) {
    const clave = normalizarEncabezadoPlanificacion_(alternativas[i]);
    const indice = encabezados.indexOf(clave);

    if (indice !== -1) {
      return indice;
    }
  }

  throw new Error(
    'No se encontró la columna: ' + alternativas.join(' / ')
  );
}

/**
 * Escribe una columna completa y aplica formato.
 */
function escribirColumnaPlanificacion_(sh, columna, valores, formato) {
  if (!valores.length) {
    return;
  }

  const rango = sh.getRange(2, columna, valores.length, 1);
  rango.setValues(valores);

  if (formato) {
    rango.setNumberFormat(formato);
  }
}

/**
 * Formato condicional del semáforo.
 */
function aplicarFormatoSemaforoPlanificacion_(sh, columna, cantidadFilas) {
  if (cantidadFilas <= 0) {
    return;
  }

  const rango = sh.getRange(2, columna, cantidadFilas, 1);
  const reglasExistentes = sh.getConditionalFormatRules();

  const reglasNuevas = [
    SpreadsheetApp.newConditionalFormatRule()
      .whenTextEqualTo('VENCIDO')
      .setBackground('#666666')
      .setFontColor('#FFFFFF')
      .setBold(true)
      .setRanges([rango])
      .build(),

    SpreadsheetApp.newConditionalFormatRule()
      .whenTextEqualTo('ROJO')
      .setBackground('#F4CCCC')
      .setFontColor('#9C0006')
      .setBold(true)
      .setRanges([rango])
      .build(),

    SpreadsheetApp.newConditionalFormatRule()
      .whenTextEqualTo('AMARILLO')
      .setBackground('#FFF2CC')
      .setFontColor('#7F6000')
      .setBold(true)
      .setRanges([rango])
      .build(),

    SpreadsheetApp.newConditionalFormatRule()
      .whenTextEqualTo('VERDE')
      .setBackground('#D9EAD3')
      .setFontColor('#274E13')
      .setBold(true)
      .setRanges([rango])
      .build()
  ];

  sh.setConditionalFormatRules(
    reglasExistentes.concat(reglasNuevas)
  );
}

function normalizarEncabezadoPlanificacion_(valor) {
  return String(valor || '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/\s+/g, '_');
}

function normalizarClavePlanificacion_(valor) {
  return String(valor || '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/\s+/g, ' ');
}

function numeroPlanificacion_(valor) {
  if (typeof valor === 'number') {
    return Number.isFinite(valor) ? valor : 0;
  }

  let texto = String(valor === null || valor === undefined ? '' : valor)
    .trim()
    .replace(/\s/g, '');

  if (!texto) {
    return 0;
  }

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

function inicioDiaPlanificacion_(fecha) {
  return new Date(
    fecha.getFullYear(),
    fecha.getMonth(),
    fecha.getDate(),
    12,
    0,
    0
  );
}

function sumarDiasPlanificacion_(fecha, dias) {
  const resultado = new Date(fecha.getTime());
  resultado.setDate(resultado.getDate() + Number(dias || 0));
  return resultado;
}
