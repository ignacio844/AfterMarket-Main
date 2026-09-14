/**************************************************************
 * SII V7.1.000 - ACCIONES DEL DÍA
 *
 * Fuente: EVENTOS_COMPRAS
 * Destino: ACCIONES_DEL_DIA
 *
 * Funciones públicas:
 * - actualizarAccionesDelDia()
 * - abrirAccionesDelDia()
 * - completarAccionSeleccionada()
 * - posponerAccionSeleccionada()
 * - asignarResponsableAccionSeleccionada()
 * - escalarAccionSeleccionada()
 * - abrirEventoOrigenSeleccionado()
 * - probarAccionesDelDiaV71000()
 **************************************************************/

const SII_ACCIONES_DIA_V71000 = {
  VERSION: '7.1.000',
  HOJA_EVENTOS: 'EVENTOS_COMPRAS',
  HOJA_ACCIONES: 'ACCIONES_DEL_DIA',

  ESTADOS_ABIERTOS: [
    'NUEVO',
    'ASIGNADO',
    'EN_PROCESO'
  ],

  ENCABEZADOS: [
    'ORDEN',
    'PRIORIDAD',
    'SEVERIDAD',
    'MARCA',
    'ACCION',
    'MOTIVO',
    'ESTADO',
    'RESPONSABLE',
    'FECHA_LIMITE',
    'DIAS_VENCIMIENTO',
    'ID_EVENTO',
    'CODIGO_EVENTO',
    'TIPO',
    'RECURRENCIAS',
    'OBSERVACIONES',
    'FECHA_CREACION',
    'ULTIMA_DETECCION'
  ]
};


function actualizarAccionesDelDia() {
  const inicio = Date.now();
  const ss = SpreadsheetApp.getActive();

  const shEventos = ss.getSheetByName(
    SII_ACCIONES_DIA_V71000.HOJA_EVENTOS
  );

  if (!shEventos) {
    throw new Error(
      'No existe EVENTOS_COMPRAS. ' +
      'Ejecutá primero actualizarEventosCompras().'
    );
  }

  const eventos =
    adLeerObjetos_(shEventos);

  const acciones =
    eventos
      .filter(adEventoAbierto_)
      .map(adEventoAAccion_)
      .sort(adOrdenar_);

  acciones.forEach((accion, indice) => {
    accion.ORDEN = indice + 1;
  });

  const shAcciones =
    adObtenerHoja_(
      ss,
      SII_ACCIONES_DIA_V71000.HOJA_ACCIONES
    );

  adEscribir_(shAcciones, acciones);

  const resumen =
    adResumen_(acciones);

  const resultado = {
    version:
      SII_ACCIONES_DIA_V71000.VERSION,
    eventosLeidos:
      eventos.length,
    accionesAbiertas:
      acciones.length,
    p1: resumen.p1,
    p2: resumen.p2,
    p3: resumen.p3,
    p4: resumen.p4,
    vencidas:
      resumen.vencidas,
    sinResponsable:
      resumen.sinResponsable,
    duracionMs:
      Date.now() - inicio
  };

  Logger.log(
    JSON.stringify(resultado, null, 2)
  );

  ss.toast(
    acciones.length +
      ' acciones abiertas. ' +
      resumen.p1 +
      ' críticas.',
    'ACCIONES_DEL_DIA V7.1.000',
    8
  );

  return resultado;
}


function abrirAccionesDelDia() {
  const ss = SpreadsheetApp.getActive();

  const sh = ss.getSheetByName(
    SII_ACCIONES_DIA_V71000.HOJA_ACCIONES
  );

  if (!sh) {
    throw new Error(
      'No existe ACCIONES_DEL_DIA.'
    );
  }

  sh.activate();
  sh.setActiveSelection('A1');
}


function probarAccionesDelDiaV71000() {
  return actualizarAccionesDelDia();
}


/**************************************************************
 * ACCIONES SOBRE LA FILA SELECCIONADA
 **************************************************************/

function completarAccionSeleccionada() {
  return adActualizarEvento_({
    estado: 'RESUELTO',
    fechaResolucion: new Date()
  });
}


function escalarAccionSeleccionada() {
  return adActualizarEvento_({
    prioridad: 'P1',
    estado: 'EN_PROCESO'
  });
}


function asignarResponsableAccionSeleccionada() {
  const ui = SpreadsheetApp.getUi();

  const respuesta = ui.prompt(
    'Asignar responsable',
    'Ingresá el nombre o correo del responsable:',
    ui.ButtonSet.OK_CANCEL
  );

  if (
    respuesta.getSelectedButton() !==
    ui.Button.OK
  ) {
    return;
  }

  const responsable =
    adTexto_(
      respuesta.getResponseText()
    );

  if (!responsable) {
    throw new Error(
      'No se ingresó un responsable.'
    );
  }

  return adActualizarEvento_({
    responsable: responsable,
    estado: 'ASIGNADO'
  });
}


function posponerAccionSeleccionada() {
  const ui = SpreadsheetApp.getUi();

  const respuesta = ui.prompt(
    'Posponer acción',
    'Ingresá la nueva fecha límite en formato DD/MM/AAAA:',
    ui.ButtonSet.OK_CANCEL
  );

  if (
    respuesta.getSelectedButton() !==
    ui.Button.OK
  ) {
    return;
  }

  const fecha =
    adParsearFecha_(
      respuesta.getResponseText()
    );

  if (!fecha) {
    throw new Error(
      'Fecha inválida. Usá DD/MM/AAAA.'
    );
  }

  return adActualizarEvento_({
    fechaLimite: fecha,
    estado: 'EN_PROCESO'
  });
}


function abrirEventoOrigenSeleccionado() {
  const contexto =
    adContextoSeleccion_();

  const ss = SpreadsheetApp.getActive();
  const shEventos = ss.getSheetByName(
    SII_ACCIONES_DIA_V71000.HOJA_EVENTOS
  );

  if (!shEventos) {
    throw new Error(
      'No existe EVENTOS_COMPRAS.'
    );
  }

  const fila =
    adBuscarFilaEvento_(
      shEventos,
      contexto.idEvento
    );

  if (fila === -1) {
    throw new Error(
      'No se encontró el evento origen.'
    );
  }

  shEventos.activate();
  shEventos.setActiveRange(
    shEventos.getRange(
      fila,
      1,
      1,
      shEventos.getLastColumn()
    )
  );

  return {
    idEvento:
      contexto.idEvento,
    fila:
      fila
  };
}


/**************************************************************
 * ACTUALIZACIÓN DE EVENTOS_COMPRAS
 **************************************************************/

function adActualizarEvento_(cambios) {
  const contexto =
    adContextoSeleccion_();

  const ss = SpreadsheetApp.getActive();
  const shEventos = ss.getSheetByName(
    SII_ACCIONES_DIA_V71000.HOJA_EVENTOS
  );

  if (!shEventos) {
    throw new Error(
      'No existe EVENTOS_COMPRAS.'
    );
  }

  const fila =
    adBuscarFilaEvento_(
      shEventos,
      contexto.idEvento
    );

  if (fila === -1) {
    throw new Error(
      'No se encontró el evento ' +
      contexto.idEvento +
      '.'
    );
  }

  const mapa =
    adMapa_(shEventos);

  adSetear_(
    shEventos,
    mapa,
    fila,
    'ESTADO',
    cambios.estado
  );

  adSetear_(
    shEventos,
    mapa,
    fila,
    'RESPONSABLE',
    cambios.responsable
  );

  adSetear_(
    shEventos,
    mapa,
    fila,
    'FECHA_LIMITE',
    cambios.fechaLimite
  );

  adSetear_(
    shEventos,
    mapa,
    fila,
    'PRIORIDAD',
    cambios.prioridad
  );

  adSetear_(
    shEventos,
    mapa,
    fila,
    'FECHA_RESOLUCION',
    cambios.fechaResolucion
  );

  adSetear_(
    shEventos,
    mapa,
    fila,
    'ULTIMA_ACTUALIZACION',
    new Date()
  );

  SpreadsheetApp.flush();

  const resultado =
    actualizarAccionesDelDia();

  return {
    idEvento:
      contexto.idEvento,
    filaEvento:
      fila,
    actualizado:
      true,
    accionesAbiertas:
      resultado.accionesAbiertas
  };
}


function adSetear_(
  sh,
  mapa,
  fila,
  campo,
  valor
) {
  if (valor === undefined) {
    return;
  }

  const columna =
    mapa.get(campo);

  if (!columna) {
    return;
  }

  sh.getRange(
    fila,
    columna
  ).setValue(valor);
}


function adBuscarFilaEvento_(
  sh,
  idEvento
) {
  const mapa = adMapa_(sh);
  const colId = mapa.get('ID_EVENTO');

  if (!colId) {
    throw new Error(
      'EVENTOS_COMPRAS no contiene ID_EVENTO.'
    );
  }

  const ultimaFila =
    sh.getLastRow();

  if (ultimaFila < 2) {
    return -1;
  }

  const ids = sh.getRange(
    2,
    colId,
    ultimaFila - 1,
    1
  ).getDisplayValues();

  for (
    let i = 0;
    i < ids.length;
    i++
  ) {
    if (
      adTexto_(ids[i][0]) ===
      idEvento
    ) {
      return i + 2;
    }
  }

  return -1;
}


/**************************************************************
 * TRANSFORMACIÓN Y ORDEN
 **************************************************************/

function adEventoAbierto_(evento) {
  return SII_ACCIONES_DIA_V71000
    .ESTADOS_ABIERTOS
    .includes(
      adNormalizar_(evento.ESTADO)
    );
}


function adEventoAAccion_(evento) {
  const fechaLimite =
    adFecha_(evento.FECHA_LIMITE);

  return {
    ORDEN: '',
    PRIORIDAD:
      adTexto_(evento.PRIORIDAD),
    SEVERIDAD:
      adTexto_(evento.SEVERIDAD),
    MARCA:
      adTexto_(evento.MARCA),
    ACCION:
      adTexto_(
        evento.ACCION_RECOMENDADA
      ),
    MOTIVO:
      adTexto_(evento.MOTIVO),
    ESTADO:
      adTexto_(evento.ESTADO),
    RESPONSABLE:
      adTexto_(evento.RESPONSABLE),
    FECHA_LIMITE:
      fechaLimite || '',
    DIAS_VENCIMIENTO:
      fechaLimite
        ? adDiasHasta_(fechaLimite)
        : '',
    ID_EVENTO:
      adTexto_(evento.ID_EVENTO),
    CODIGO_EVENTO:
      adTexto_(evento.CODIGO_EVENTO),
    TIPO:
      adTexto_(evento.TIPO),
    RECURRENCIAS:
      adNumero_(evento.RECURRENCIAS),
    OBSERVACIONES:
      adTexto_(evento.OBSERVACIONES),
    FECHA_CREACION:
      adFecha_(evento.FECHA_CREACION) || '',
    ULTIMA_DETECCION:
      adFecha_(
        evento.FECHA_ULTIMA_DETECCION
      ) || ''
  };
}


function adOrdenar_(a, b) {
  const orden = {
    P1: 1,
    P2: 2,
    P3: 3,
    P4: 4
  };

  const pa =
    orden[
      adNormalizar_(a.PRIORIDAD)
    ] || 99;

  const pb =
    orden[
      adNormalizar_(b.PRIORIDAD)
    ] || 99;

  if (pa !== pb) {
    return pa - pb;
  }

  const da =
    a.DIAS_VENCIMIENTO === ''
      ? 999999
      : Number(a.DIAS_VENCIMIENTO);

  const db =
    b.DIAS_VENCIMIENTO === ''
      ? 999999
      : Number(b.DIAS_VENCIMIENTO);

  if (da !== db) {
    return da - db;
  }

  const ra =
    adNumero_(a.RECURRENCIAS);

  const rb =
    adNumero_(b.RECURRENCIAS);

  if (ra !== rb) {
    return rb - ra;
  }

  return adTexto_(a.MARCA)
    .localeCompare(
      adTexto_(b.MARCA)
    );
}


function adResumen_(acciones) {
  const r = {
    p1: 0,
    p2: 0,
    p3: 0,
    p4: 0,
    vencidas: 0,
    sinResponsable: 0
  };

  acciones.forEach(accion => {
    const p =
      adNormalizar_(
        accion.PRIORIDAD
      );

    if (p === 'P1') r.p1++;
    if (p === 'P2') r.p2++;
    if (p === 'P3') r.p3++;
    if (p === 'P4') r.p4++;

    if (
      accion.DIAS_VENCIMIENTO !== '' &&
      Number(
        accion.DIAS_VENCIMIENTO
      ) < 0
    ) {
      r.vencidas++;
    }

    if (
      !adTexto_(
        accion.RESPONSABLE
      )
    ) {
      r.sinResponsable++;
    }
  });

  return r;
}


/**************************************************************
 * ESCRITURA Y FORMATO
 **************************************************************/

function adEscribir_(sh, acciones) {
  const filtro = sh.getFilter();

  if (filtro) {
    filtro.remove();
  }

  const encabezados =
    SII_ACCIONES_DIA_V71000
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
    acciones.length + 1
  ) {
    sh.insertRowsAfter(
      sh.getMaxRows(),
      acciones.length + 1 -
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

  if (acciones.length > 0) {
    const valores =
      acciones.map(accion =>
        encabezados.map(
          encabezado =>
            accion[encabezado] ===
              undefined
              ? ''
              : accion[encabezado]
        )
      );

    sh.getRange(
      2,
      1,
      valores.length,
      columnas
    ).setValues(valores);

    sh.getRange(
      1,
      1,
      valores.length + 1,
      columnas
    ).createFilter();
  }

  adFormato_(
    sh,
    acciones.length
  );
}


function adFormato_(sh, filas) {
  const columnas =
    SII_ACCIONES_DIA_V71000
      .ENCABEZADOS.length;

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

  if (filas <= 0) {
    return;
  }

  const mapa = adMapa_(sh);

  [
    'FECHA_LIMITE',
    'FECHA_CREACION',
    'ULTIMA_DETECCION'
  ].forEach(campo => {
    const col = mapa.get(campo);

    if (col) {
      sh.getRange(
        2,
        col,
        filas,
        1
      ).setNumberFormat(
        campo === 'FECHA_LIMITE'
          ? 'dd/MM/yyyy'
          : 'dd/MM/yyyy HH:mm'
      );
    }
  });

  sh.getRange(
    2,
    1,
    filas,
    columnas
  )
    .setVerticalAlignment('middle')
    .setWrap(true);

  const anchos = {
    ORDEN: 70,
    PRIORIDAD: 85,
    SEVERIDAD: 95,
    MARCA: 170,
    ACCION: 300,
    MOTIVO: 380,
    ESTADO: 120,
    RESPONSABLE: 160,
    FECHA_LIMITE: 115,
    DIAS_VENCIMIENTO: 110,
    ID_EVENTO: 190,
    CODIGO_EVENTO: 100,
    TIPO: 110,
    RECURRENCIAS: 100,
    OBSERVACIONES: 280,
    FECHA_CREACION: 145,
    ULTIMA_DETECCION: 145
  };

  Object.keys(anchos)
    .forEach(nombre => {
      const col = mapa.get(nombre);

      if (col) {
        sh.setColumnWidth(
          col,
          anchos[nombre]
        );
      }
    });

  const reglas = [];

  const colPrioridad =
    mapa.get('PRIORIDAD');

  if (colPrioridad) {
    const rango = sh.getRange(
      2,
      colPrioridad,
      filas,
      1
    );

    reglas.push(
      adRegla_(
        rango,
        'P1',
        '#F4CCCC'
      ),
      adRegla_(
        rango,
        'P2',
        '#FCE5CD'
      ),
      adRegla_(
        rango,
        'P3',
        '#FFF2CC'
      ),
      adRegla_(
        rango,
        'P4',
        '#D9EAD3'
      )
    );
  }

  const colDias =
    mapa.get(
      'DIAS_VENCIMIENTO'
    );

  if (colDias) {
    const rango = sh.getRange(
      2,
      colDias,
      filas,
      1
    );

    reglas.push(
      SpreadsheetApp
        .newConditionalFormatRule()
        .whenNumberLessThan(0)
        .setBackground('#F4CCCC')
        .setBold(true)
        .setRanges([rango])
        .build(),
      SpreadsheetApp
        .newConditionalFormatRule()
        .whenNumberBetween(0, 3)
        .setBackground('#FCE5CD')
        .setBold(true)
        .setRanges([rango])
        .build()
    );
  }

  sh.setConditionalFormatRules(reglas);
}


function adRegla_(
  rango,
  texto,
  color
) {
  return SpreadsheetApp
    .newConditionalFormatRule()
    .whenTextEqualTo(texto)
    .setBackground(color)
    .setBold(true)
    .setRanges([rango])
    .build();
}


/**************************************************************
 * UTILIDADES
 **************************************************************/

function adContextoSeleccion_() {
  const ss = SpreadsheetApp.getActive();
  const sh = ss.getActiveSheet();
  const rango = ss.getActiveRange();

  if (
    !sh ||
    sh.getName() !==
      SII_ACCIONES_DIA_V71000
        .HOJA_ACCIONES
  ) {
    throw new Error(
      'Seleccioná una fila en ACCIONES_DEL_DIA.'
    );
  }

  if (
    !rango ||
    rango.getRow() < 2
  ) {
    throw new Error(
      'Seleccioná una fila de acción.'
    );
  }

  const mapa = adMapa_(sh);
  const colId = mapa.get('ID_EVENTO');

  if (!colId) {
    throw new Error(
      'ACCIONES_DEL_DIA no contiene ID_EVENTO.'
    );
  }

  const idEvento = adTexto_(
    sh.getRange(
      rango.getRow(),
      colId
    ).getDisplayValue()
  );

  if (!idEvento) {
    throw new Error(
      'La fila no tiene ID_EVENTO.'
    );
  }

  return {
    fila:
      rango.getRow(),
    idEvento:
      idEvento
  };
}


function adLeerObjetos_(sh) {
  const datos = sh
    .getDataRange()
    .getValues();

  if (datos.length < 2) {
    return [];
  }

  const encabezados =
    datos[0].map(adEncabezado_);

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


function adMapa_(sh) {
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
        adEncabezado_(valor);

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


function adObtenerHoja_(ss, nombre) {
  return (
    ss.getSheetByName(nombre) ||
    ss.insertSheet(nombre)
  );
}


function adParsearFecha_(texto) {
  const valor = adTexto_(texto);

  const match = valor.match(
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/
  );

  if (!match) {
    return null;
  }

  const dia = Number(match[1]);
  const mes = Number(match[2]) - 1;
  const anio = Number(match[3]);

  const fecha = new Date(
    anio,
    mes,
    dia,
    12,
    0,
    0
  );

  if (
    fecha.getFullYear() !== anio ||
    fecha.getMonth() !== mes ||
    fecha.getDate() !== dia
  ) {
    return null;
  }

  return fecha;
}


function adFecha_(valor) {
  if (
    valor instanceof Date &&
    !isNaN(valor.getTime())
  ) {
    return valor;
  }

  if (
    valor === null ||
    valor === undefined ||
    adTexto_(valor) === ''
  ) {
    return null;
  }

  const fecha = new Date(valor);

  return isNaN(fecha.getTime())
    ? null
    : fecha;
}


function adDiasHasta_(fecha) {
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);

  const destino = new Date(fecha);
  destino.setHours(0, 0, 0, 0);

  return Math.round(
    (
      destino.getTime() -
      hoy.getTime()
    ) /
    86400000
  );
}


function adEncabezado_(valor) {
  return adTexto_(valor)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/\s+/g, '_');
}


function adNormalizar_(valor) {
  return adTexto_(valor)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ');
}


function adTexto_(valor) {
  return String(
    valor === null ||
    valor === undefined
      ? ''
      : valor
  ).trim();
}


function adNumero_(valor) {
  if (typeof valor === 'number') {
    return Number.isFinite(valor)
      ? valor
      : 0;
  }

  const numero = Number(
    adTexto_(valor)
      .replace(/[^\d,.-]/g, '')
      .replace(',', '.')
  );

  return Number.isFinite(numero)
    ? numero
    : 0;
}

