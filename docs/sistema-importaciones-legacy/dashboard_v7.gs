/**************************************************************
 * SII V7.2.000 - DASHBOARD EJECUTIVO
 *
 * Fuentes:
 * - MODELO_MARCAS
 * - EVENTOS_COMPRAS
 * - ACCIONES_DEL_DIA
 *
 * Destino:
 * - DASHBOARD_V7
 *
 * Funciones públicas:
 * - actualizarDashboardV7()
 * - abrirDashboardV7()
 * - probarDashboardV72000()
 **************************************************************/

const SII_DASHBOARD_V72000 = {
  VERSION: '7.2.000',

  HOJA_MODELO: 'MODELO_MARCAS',
  HOJA_EVENTOS: 'EVENTOS_COMPRAS',
  HOJA_ACCIONES: 'ACCIONES_DEL_DIA',
  HOJA_DASHBOARD: 'DASHBOARD_V7',

  ESTADOS_ABIERTOS: [
    'NUEVO',
    'ASIGNADO',
    'EN_PROCESO'
  ],

  PRIORIDADES: [
    'P1',
    'P2',
    'P3',
    'P4'
  ],

  CODIGOS_EVENTO: [
    'EVT001',
    'EVT002',
    'EVT003',
    'EVT004',
    'EVT005'
  ]
};


/**
 * Genera el dashboard ejecutivo completo.
 */
function actualizarDashboardV7() {
  const inicio = Date.now();
  const ss = SpreadsheetApp.getActive();

  const shModelo = ss.getSheetByName(
    SII_DASHBOARD_V72000.HOJA_MODELO
  );

  const shEventos = ss.getSheetByName(
    SII_DASHBOARD_V72000.HOJA_EVENTOS
  );

  const shAcciones = ss.getSheetByName(
    SII_DASHBOARD_V72000.HOJA_ACCIONES
  );

  if (!shModelo) {
    throw new Error(
      'No existe MODELO_MARCAS.'
    );
  }

  if (!shEventos) {
    throw new Error(
      'No existe EVENTOS_COMPRAS.'
    );
  }

  if (!shAcciones) {
    throw new Error(
      'No existe ACCIONES_DEL_DIA.'
    );
  }

  const modelos =
    db7LeerObjetos_(shModelo);

  const eventos =
    db7LeerObjetos_(shEventos);

  const acciones =
    db7LeerObjetos_(shAcciones);

  const shDashboard =
    db7ObtenerOCrearHoja_(
      ss,
      SII_DASHBOARD_V72000
        .HOJA_DASHBOARD
    );

  db7PrepararHoja_(shDashboard);

  const resumen =
    db7CalcularResumen_(
      modelos,
      eventos,
      acciones
    );

  const prioridades =
    db7AgruparPorPrioridad_(eventos);

  const codigos =
    db7AgruparPorCodigo_(eventos);

  const estados =
    db7AgruparPorEstado_(eventos);

  const topMarcas =
    db7TopMarcas_(eventos, 12);

  const topAcciones =
    db7TopAcciones_(acciones, 15);

  db7EscribirCabecera_(
    shDashboard,
    resumen
  );

  db7EscribirKpis_(
    shDashboard,
    resumen
  );

  db7EscribirDistribuciones_(
    shDashboard,
    prioridades,
    codigos,
    estados
  );

  db7EscribirTopMarcas_(
    shDashboard,
    topMarcas
  );

  db7EscribirAccionesCriticas_(
    shDashboard,
    topAcciones
  );

  db7CrearGraficos_(
    shDashboard,
    prioridades,
    codigos,
    topMarcas
  );

  db7AplicarFormatoGeneral_(
    shDashboard
  );

  const resultado = {
    version:
      SII_DASHBOARD_V72000.VERSION,
    marcas:
      modelos.length,
    eventos:
      eventos.length,
    acciones:
      acciones.length,
    eventosAbiertos:
      resumen.eventosAbiertos,
    accionesP1:
      resumen.accionesP1,
    duracionMs:
      Date.now() - inicio
  };

  Logger.log(
    JSON.stringify(
      resultado,
      null,
      2
    )
  );

  ss.toast(
    'Dashboard actualizado en ' +
      Math.round(
        resultado.duracionMs / 1000
      ) +
      ' segundos.',
    'DASHBOARD V7.2.000',
    8
  );

  return resultado;
}


/**
 * Abre DASHBOARD_V7.
 */
function abrirDashboardV7() {
  const ss = SpreadsheetApp.getActive();

  const sh = ss.getSheetByName(
    SII_DASHBOARD_V72000
      .HOJA_DASHBOARD
  );

  if (!sh) {
    throw new Error(
      'No existe DASHBOARD_V7. ' +
      'Ejecutá actualizarDashboardV7().'
    );
  }

  sh.activate();
  sh.setActiveSelection('A1');
}


function probarDashboardV72000() {
  return actualizarDashboardV7();
}


/**************************************************************
 * CÁLCULOS
 **************************************************************/

function db7CalcularResumen_(
  modelos,
  eventos,
  acciones
) {
  const abiertos =
    eventos.filter(db7EventoAbierto_);

  const resueltos =
    eventos.filter(evento =>
      db7Normalizar_(evento.ESTADO) ===
      'RESUELTO'
    );

  const cerrados =
    eventos.filter(evento =>
      db7Normalizar_(evento.ESTADO) ===
      'CERRADO'
    );

  const p1 =
    acciones.filter(accion =>
      db7Normalizar_(
        accion.PRIORIDAD
      ) === 'P1'
    );

  const p2 =
    acciones.filter(accion =>
      db7Normalizar_(
        accion.PRIORIDAD
      ) === 'P2'
    );

  const p3 =
    acciones.filter(accion =>
      db7Normalizar_(
        accion.PRIORIDAD
      ) === 'P3'
    );

  const sinResponsable =
    acciones.filter(accion =>
      !db7Texto_(
        accion.RESPONSABLE
      )
    );

  const vencidas =
    acciones.filter(accion => {
      const dias =
        db7NumeroNullable_(
          accion.DIAS_VENCIMIENTO
        );

      return (
        dias !== null &&
        dias < 0
      );
    });

  const marcasP1 = new Set();

  p1.forEach(accion => {
    const marca =
      db7Normalizar_(
        accion.MARCA
      );

    if (marca) {
      marcasP1.add(marca);
    }
  });

  const marcasConAlertas = new Set();

  eventos.forEach(evento => {
    if (
      db7Normalizar_(
        evento.CODIGO_EVENTO
      ) === 'EVT004' &&
      db7EventoAbierto_(evento)
    ) {
      const marca =
        db7Normalizar_(
          evento.MARCA
        );

      if (marca) {
        marcasConAlertas.add(marca);
      }
    }
  });

  return {
    marcasTotales:
      modelos.length,
    eventosTotales:
      eventos.length,
    eventosAbiertos:
      abiertos.length,
    eventosResueltos:
      resueltos.length,
    eventosCerrados:
      cerrados.length,
    accionesTotales:
      acciones.length,
    accionesP1:
      p1.length,
    accionesP2:
      p2.length,
    accionesP3:
      p3.length,
    accionesVencidas:
      vencidas.length,
    accionesSinResponsable:
      sinResponsable.length,
    marcasCriticas:
      marcasP1.size,
    marcasConAlertas:
      marcasConAlertas.size,
    fechaActualizacion:
      new Date()
  };
}


function db7AgruparPorPrioridad_(eventos) {
  const salida = {
    P1: 0,
    P2: 0,
    P3: 0,
    P4: 0
  };

  eventos.forEach(evento => {
    if (!db7EventoAbierto_(evento)) {
      return;
    }

    const prioridad =
      db7Normalizar_(
        evento.PRIORIDAD
      );

    if (
      salida[prioridad] !==
      undefined
    ) {
      salida[prioridad]++;
    }
  });

  return salida;
}


function db7AgruparPorCodigo_(eventos) {
  const salida = {
    EVT001: 0,
    EVT002: 0,
    EVT003: 0,
    EVT004: 0,
    EVT005: 0
  };

  eventos.forEach(evento => {
    if (!db7EventoAbierto_(evento)) {
      return;
    }

    const codigo =
      db7Normalizar_(
        evento.CODIGO_EVENTO
      );

    if (
      salida[codigo] !==
      undefined
    ) {
      salida[codigo]++;
    }
  });

  return salida;
}


function db7AgruparPorEstado_(eventos) {
  const salida = {
    NUEVO: 0,
    ASIGNADO: 0,
    EN_PROCESO: 0,
    RESUELTO: 0,
    CERRADO: 0,
    IGNORADO: 0
  };

  eventos.forEach(evento => {
    const estado =
      db7Normalizar_(
        evento.ESTADO
      );

    if (
      salida[estado] !==
      undefined
    ) {
      salida[estado]++;
    }
  });

  return salida;
}


function db7TopMarcas_(
  eventos,
  limite
) {
  const mapa = new Map();

  eventos.forEach(evento => {
    if (!db7EventoAbierto_(evento)) {
      return;
    }

    const marca =
      db7Texto_(evento.MARCA) ||
      'SIN MARCA';

    const clave =
      db7Normalizar_(marca);

    if (!mapa.has(clave)) {
      mapa.set(
        clave,
        {
          marca: marca,
          total: 0,
          p1: 0,
          p2: 0,
          p3: 0,
          p4: 0
        }
      );
    }

    const registro =
      mapa.get(clave);

    registro.total++;

    const prioridad =
      db7Normalizar_(
        evento.PRIORIDAD
      );

    if (
      prioridad === 'P1' ||
      prioridad === 'P2' ||
      prioridad === 'P3' ||
      prioridad === 'P4'
    ) {
      registro[
        prioridad.toLowerCase()
      ]++;
    }
  });

  return Array.from(
    mapa.values()
  )
    .sort((a, b) =>
      b.p1 - a.p1 ||
      b.p2 - a.p2 ||
      b.total - a.total ||
      a.marca.localeCompare(b.marca)
    )
    .slice(0, limite);
}


function db7TopAcciones_(
  acciones,
  limite
) {
  const orden = {
    P1: 1,
    P2: 2,
    P3: 3,
    P4: 4
  };

  return acciones
    .slice()
    .sort((a, b) => {
      const pa =
        orden[
          db7Normalizar_(
            a.PRIORIDAD
          )
        ] || 99;

      const pb =
        orden[
          db7Normalizar_(
            b.PRIORIDAD
          )
        ] || 99;

      if (pa !== pb) {
        return pa - pb;
      }

      const da =
        db7NumeroNullable_(
          a.DIAS_VENCIMIENTO
        );

      const db =
        db7NumeroNullable_(
          b.DIAS_VENCIMIENTO
        );

      const va =
        da === null
          ? 999999
          : da;

      const vb =
        db === null
          ? 999999
          : db;

      if (va !== vb) {
        return va - vb;
      }

      return db7Texto_(a.MARCA)
        .localeCompare(
          db7Texto_(b.MARCA)
        );
    })
    .slice(0, limite);
}


function db7EventoAbierto_(evento) {
  return SII_DASHBOARD_V72000
    .ESTADOS_ABIERTOS
    .includes(
      db7Normalizar_(
        evento.ESTADO
      )
    );
}


/**************************************************************
 * ESCRITURA DEL DASHBOARD
 **************************************************************/

function db7PrepararHoja_(sh) {
  const filtro = sh.getFilter();

  if (filtro) {
    filtro.remove();
  }

  sh.getCharts()
    .forEach(chart =>
      sh.removeChart(chart)
    );

  sh.clear();
  sh.clearFormats();
  sh.clearConditionalFormatRules();

  if (sh.getMaxColumns() < 16) {
    sh.insertColumnsAfter(
      sh.getMaxColumns(),
      16 - sh.getMaxColumns()
    );
  }

  if (sh.getMaxRows() < 80) {
    sh.insertRowsAfter(
      sh.getMaxRows(),
      80 - sh.getMaxRows()
    );
  }

  sh.setHiddenGridlines(true);
}


function db7EscribirCabecera_(
  sh,
  resumen
) {
  sh.getRange('A1:P2')
    .merge()
    .setValue(
      'SII · DASHBOARD EJECUTIVO DE COMPRAS'
    )
    .setBackground('#17365D')
    .setFontColor('#FFFFFF')
    .setFontSize(20)
    .setFontWeight('bold')
    .setHorizontalAlignment('center')
    .setVerticalAlignment('middle');

  sh.getRange('A3:P3')
    .merge()
    .setValue(
      'Versión ' +
      SII_DASHBOARD_V72000.VERSION +
      ' · Actualizado: ' +
      Utilities.formatDate(
        resumen.fechaActualizacion,
        Session.getScriptTimeZone(),
        'dd/MM/yyyy HH:mm'
      )
    )
    .setBackground('#D9EAF7')
    .setFontColor('#1F1F1F')
    .setFontSize(10)
    .setHorizontalAlignment('center');
}


function db7EscribirKpis_(
  sh,
  r
) {
  const kpis = [
    {
      rango: 'A5:D8',
      titulo: 'MARCAS',
      valor: r.marcasTotales,
      subtitulo:
        r.marcasCriticas +
        ' con acciones P1',
      color: '#D9EAD3'
    },
    {
      rango: 'E5:H8',
      titulo: 'EVENTOS ABIERTOS',
      valor: r.eventosAbiertos,
      subtitulo:
        r.eventosResueltos +
        ' resueltos',
      color: '#FFF2CC'
    },
    {
      rango: 'I5:L8',
      titulo: 'ACCIONES P1',
      valor: r.accionesP1,
      subtitulo:
        r.accionesP2 +
        ' P2 · ' +
        r.accionesP3 +
        ' P3',
      color: '#F4CCCC'
    },
    {
      rango: 'M5:P8',
      titulo: 'SIN RESPONSABLE',
      valor:
        r.accionesSinResponsable,
      subtitulo:
        r.accionesVencidas +
        ' vencidas',
      color: '#FCE5CD'
    }
  ];

  kpis.forEach(kpi => {
    const rango =
      sh.getRange(kpi.rango);

    rango.merge()
      .setBackground(kpi.color)
      .setHorizontalAlignment('center')
      .setVerticalAlignment('middle')
      .setWrap(true);

    const celda =
      rango.getCell(1, 1);

    celda.setValue(
      kpi.titulo +
      '\n' +
      kpi.valor +
      '\n' +
      kpi.subtitulo
    );

    celda.setFontSize(12)
      .setFontWeight('bold');
  });
}


function db7EscribirDistribuciones_(
  sh,
  prioridades,
  codigos,
  estados
) {
  sh.getRange('A10:D10')
    .merge()
    .setValue(
      'EVENTOS ABIERTOS POR PRIORIDAD'
    )
    .setBackground('#1F4E78')
    .setFontColor('#FFFFFF')
    .setFontWeight('bold')
    .setHorizontalAlignment('center');

  const datosPrioridad = [
    ['PRIORIDAD', 'CANTIDAD'],
    ['P1', prioridades.P1],
    ['P2', prioridades.P2],
    ['P3', prioridades.P3],
    ['P4', prioridades.P4]
  ];

  sh.getRange(
    11,
    1,
    datosPrioridad.length,
    2
  ).setValues(datosPrioridad);

  sh.getRange('E10:H10')
    .merge()
    .setValue(
      'EVENTOS ABIERTOS POR TIPO'
    )
    .setBackground('#1F4E78')
    .setFontColor('#FFFFFF')
    .setFontWeight('bold')
    .setHorizontalAlignment('center');

  const datosCodigo = [
    ['CÓDIGO', 'CANTIDAD'],
    ['EVT001', codigos.EVT001],
    ['EVT002', codigos.EVT002],
    ['EVT003', codigos.EVT003],
    ['EVT004', codigos.EVT004],
    ['EVT005', codigos.EVT005]
  ];

  sh.getRange(
    11,
    5,
    datosCodigo.length,
    2
  ).setValues(datosCodigo);

  sh.getRange('I10:L10')
    .merge()
    .setValue(
      'EVENTOS POR ESTADO'
    )
    .setBackground('#1F4E78')
    .setFontColor('#FFFFFF')
    .setFontWeight('bold')
    .setHorizontalAlignment('center');

  const datosEstado = [
    ['ESTADO', 'CANTIDAD'],
    ['NUEVO', estados.NUEVO],
    ['ASIGNADO', estados.ASIGNADO],
    ['EN_PROCESO', estados.EN_PROCESO],
    ['RESUELTO', estados.RESUELTO],
    ['CERRADO', estados.CERRADO],
    ['IGNORADO', estados.IGNORADO]
  ];

  sh.getRange(
    11,
    9,
    datosEstado.length,
    2
  ).setValues(datosEstado);

  sh.getRange('M10:P10')
    .merge()
    .setValue(
      'LECTURA EJECUTIVA'
    )
    .setBackground('#1F4E78')
    .setFontColor('#FFFFFF')
    .setFontWeight('bold')
    .setHorizontalAlignment('center');

  sh.getRange('M11:P17')
    .merge()
    .setValue(
      'P1 representa acciones inmediatas.\n\n' +
      'P2 corresponde a planificación prioritaria.\n\n' +
      'EVT004 identifica alertas de calidad de datos.\n\n' +
      'Las acciones sin responsable requieren asignación.'
    )
    .setBackground('#F3F6F9')
    .setWrap(true)
    .setVerticalAlignment('top');
}


function db7EscribirTopMarcas_(
  sh,
  topMarcas
) {
  sh.getRange('A20:H20')
    .merge()
    .setValue(
      'MARCAS CON MÁS EVENTOS ABIERTOS'
    )
    .setBackground('#1F4E78')
    .setFontColor('#FFFFFF')
    .setFontWeight('bold')
    .setHorizontalAlignment('center');

  const datos = [
    [
      'MARCA',
      'TOTAL',
      'P1',
      'P2',
      'P3',
      'P4'
    ]
  ];

  topMarcas.forEach(reg => {
    datos.push([
      reg.marca,
      reg.total,
      reg.p1,
      reg.p2,
      reg.p3,
      reg.p4
    ]);
  });

  sh.getRange(
    21,
    1,
    datos.length,
    6
  ).setValues(datos);
}


function db7EscribirAccionesCriticas_(
  sh,
  acciones
) {
  sh.getRange('I20:P20')
    .merge()
    .setValue(
      'PRÓXIMAS ACCIONES'
    )
    .setBackground('#1F4E78')
    .setFontColor('#FFFFFF')
    .setFontWeight('bold')
    .setHorizontalAlignment('center');

  const datos = [
    [
      'PRIORIDAD',
      'MARCA',
      'ACCIÓN',
      'RESPONSABLE',
      'FECHA LÍMITE',
      'ESTADO'
    ]
  ];

  acciones.forEach(accion => {
    datos.push([
      db7Texto_(
        accion.PRIORIDAD
      ),
      db7Texto_(
        accion.MARCA
      ),
      db7Texto_(
        accion.ACCION
      ),
      db7Texto_(
        accion.RESPONSABLE
      ),
      db7Fecha_(
        accion.FECHA_LIMITE
      ) || '',
      db7Texto_(
        accion.ESTADO
      )
    ]);
  });

  sh.getRange(
    21,
    9,
    datos.length,
    6
  ).setValues(datos);

  if (datos.length > 1) {
    sh.getRange(
      22,
      13,
      datos.length - 1,
      1
    ).setNumberFormat(
      'dd/MM/yyyy'
    );
  }
}


/**************************************************************
 * GRÁFICOS
 **************************************************************/

function db7CrearGraficos_(
  sh,
  prioridades,
  codigos,
  topMarcas
) {
  const graficoPrioridad =
    sh.newChart()
      .asPieChart()
      .addRange(
        sh.getRange('A11:B15')
      )
      .setPosition(
        38,
        1,
        0,
        0
      )
      .setOption(
        'title',
        'Eventos abiertos por prioridad'
      )
      .setOption(
        'legend',
        {
          position: 'right'
        }
      )
      .build();

  sh.insertChart(graficoPrioridad);

  const graficoCodigo =
    sh.newChart()
      .asColumnChart()
      .addRange(
        sh.getRange('E11:F16')
      )
      .setPosition(
        38,
        7,
        0,
        0
      )
      .setOption(
        'title',
        'Eventos abiertos por tipo'
      )
      .setOption(
        'legend',
        {
          position: 'none'
        }
      )
      .build();

  sh.insertChart(graficoCodigo);

  if (topMarcas.length > 0) {
    const ultimaFila =
      21 + topMarcas.length;

    const graficoMarcas =
      sh.newChart()
        .asBarChart()
        .addRange(
          sh.getRange(
            'A21:B' +
            ultimaFila
          )
        )
        .setPosition(
          38,
          13,
          0,
          0
        )
        .setOption(
          'title',
          'Top marcas por eventos abiertos'
        )
        .setOption(
          'legend',
          {
            position: 'none'
          }
        )
        .build();

    sh.insertChart(graficoMarcas);
  }
}


/**************************************************************
 * FORMATO GENERAL
 **************************************************************/

function db7AplicarFormatoGeneral_(
  sh
) {
  sh.setFrozenRows(3);

  for (
    let columna = 1;
    columna <= 16;
    columna++
  ) {
    sh.setColumnWidth(
      columna,
      105
    );
  }

  sh.setColumnWidth(1, 170);
  sh.setColumnWidth(9, 90);
  sh.setColumnWidth(10, 160);
  sh.setColumnWidth(11, 280);
  sh.setColumnWidth(12, 150);
  sh.setColumnWidth(13, 115);
  sh.setColumnWidth(14, 110);

  sh.getRange('A10:P60')
    .setVerticalAlignment('middle')
    .setWrap(true);

  sh.getRange('A11:B11')
    .setFontWeight('bold')
    .setBackground('#D9EAF7');

  sh.getRange('E11:F11')
    .setFontWeight('bold')
    .setBackground('#D9EAF7');

  sh.getRange('I11:J11')
    .setFontWeight('bold')
    .setBackground('#D9EAF7');

  sh.getRange('A21:F21')
    .setFontWeight('bold')
    .setBackground('#D9EAF7');

  sh.getRange('I21:N21')
    .setFontWeight('bold')
    .setBackground('#D9EAF7');

  db7FormatoPrioridades_(
    sh,
    'C22:C35'
  );

  db7FormatoPrioridades_(
    sh,
    'I22:I36'
  );
}


function db7FormatoPrioridades_(
  sh,
  rangoA1
) {
  const rango =
    sh.getRange(rangoA1);

  const reglas =
    sh.getConditionalFormatRules();

  reglas.push(
    SpreadsheetApp
      .newConditionalFormatRule()
      .whenTextEqualTo('P1')
      .setBackground('#F4CCCC')
      .setBold(true)
      .setRanges([rango])
      .build(),
    SpreadsheetApp
      .newConditionalFormatRule()
      .whenTextEqualTo('P2')
      .setBackground('#FCE5CD')
      .setBold(true)
      .setRanges([rango])
      .build(),
    SpreadsheetApp
      .newConditionalFormatRule()
      .whenTextEqualTo('P3')
      .setBackground('#FFF2CC')
      .setBold(true)
      .setRanges([rango])
      .build(),
    SpreadsheetApp
      .newConditionalFormatRule()
      .whenTextEqualTo('P4')
      .setBackground('#D9EAD3')
      .setBold(true)
      .setRanges([rango])
      .build()
  );

  sh.setConditionalFormatRules(reglas);
}


/**************************************************************
 * LECTURA Y UTILIDADES
 **************************************************************/

function db7LeerObjetos_(sh) {
  const datos =
    sh.getDataRange()
      .getValues();

  if (datos.length < 2) {
    return [];
  }

  const encabezados =
    datos[0].map(
      db7NormalizarEncabezado_
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


function db7ObtenerOCrearHoja_(
  ss,
  nombre
) {
  return (
    ss.getSheetByName(nombre) ||
    ss.insertSheet(nombre)
  );
}


function db7NormalizarEncabezado_(
  valor
) {
  return db7Texto_(valor)
    .normalize('NFD')
    .replace(
      /[\u0300-\u036f]/g,
      ''
    )
    .toUpperCase()
    .replace(/\s+/g, '_');
}


function db7Normalizar_(valor) {
  return db7Texto_(valor)
    .normalize('NFD')
    .replace(
      /[\u0300-\u036f]/g,
      ''
    )
    .toUpperCase()
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ');
}


function db7Texto_(valor) {
  return String(
    valor === null ||
    valor === undefined
      ? ''
      : valor
  ).trim();
}


function db7NumeroNullable_(
  valor
) {
  if (
    valor === null ||
    valor === undefined ||
    db7Texto_(valor) === ''
  ) {
    return null;
  }

  const numero =
    Number(
      db7Texto_(valor)
        .replace(/[^\d,.-]/g, '')
        .replace(',', '.')
    );

  return Number.isFinite(numero)
    ? numero
    : null;
}


function db7Fecha_(valor) {
  if (
    valor instanceof Date &&
    !isNaN(valor.getTime())
  ) {
    return valor;
  }

  if (
    valor === null ||
    valor === undefined ||
    db7Texto_(valor) === ''
  ) {
    return null;
  }

  const fecha =
    new Date(valor);

  return isNaN(fecha.getTime())
    ? null
    : fecha;
}

