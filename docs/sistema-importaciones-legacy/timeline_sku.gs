/**************************************************************
 * SII V6.1.001
 * MÓDULO: TIMELINE DEL SKU
 *
 * Funciones públicas:
 * - construirTimelineSku(modelo)
 * - probarTimelineSku()
 *
 * El timeline unifica:
 * - Hoy
 * - Quiebre estimado
 * - En fábrica
 * - A embarcar
 * - Embarcado
 * - A ingresar
 * - Fechas reales y estimadas
 * - Disponibilidad acumulada
 **************************************************************/

const SII_TIMELINE_SKU_V61001 = {
  VERSION: '6.1.001',

  ORDEN_ESTADOS: {
    'A INGRESAR': 10,
    'EMBARCADO': 20,
    'A EMBARCAR': 30,
    'EN FABRICA': 40,
    'OTRO': 90
  }
};


/**
 * Construye una línea de tiempo logística y de cobertura.
 */
function construirTimelineSku(modelo) {
  if (!modelo) {
    throw new Error(
      'No se recibió el modelo del SKU.'
    );
  }

  const hoy = tlInicioDia_(new Date());

  const importaciones =
    modelo.importaciones || {};

  const compras =
    modelo.compras || {};

  const cobertura =
    modelo.cobertura || {};

  const ventas =
    modelo.ventas || {};

  const eventos = [];

  /*
   * Evento de inicio.
   */
  eventos.push({
    tipo: 'HOY',
    estado: 'HOY',
    fecha: tlFormatearFecha_(hoy),
    fechaIso: tlFechaIso_(hoy),
    diasDesdeHoy: 0,
    cantidad: tlNumero_(
      cobertura.stockTotal
    ),
    descripcion:
      'Stock disponible al día de hoy.',
    origen: 'SISTEMA',
    disponibleAcumulado:
      tlNumero_(
        cobertura.stockTotal
      )
  });

  /*
   * Quiebre proyectado.
   */
  let fechaQuiebre = null;

  if (
    compras.diasQuiebre !== null &&
    compras.diasQuiebre !== undefined &&
    tlNumero_(compras.diasQuiebre) >= 0
  ) {
    fechaQuiebre =
      tlSumarDias_(
        hoy,
        tlNumero_(
          compras.diasQuiebre
        )
      );

  } else if (
    importaciones.fechaQuiebre
  ) {
    fechaQuiebre =
      tlConvertirFecha_(
        importaciones.fechaQuiebre
      );
  }

  if (fechaQuiebre) {
    eventos.push({
      tipo: 'QUIEBRE',
      estado: 'QUIEBRE PROYECTADO',
      fecha:
        tlFormatearFecha_(
          fechaQuiebre
        ),
      fechaIso:
        tlFechaIso_(
          fechaQuiebre
        ),
      diasDesdeHoy:
        tlDiferenciaDias_(
          hoy,
          fechaQuiebre
        ),
      cantidad: 0,
      descripcion:
        'Fecha estimada de quiebre de stock.',
      origen: 'MRP',
      disponibleAcumulado: null
    });
  }

  /*
   * Eventos por línea de importación.
   */
  const lineas =
    Array.isArray(
      importaciones.lineas
    )
      ? importaciones.lineas
      : [];

  lineas.forEach((linea, indice) => {
    const cantidad =
      tlNumero_(
        linea.cantidadPendiente
      );

    if (cantidad <= 0) {
      return;
    }

    const fecha =
      tlConvertirFecha_(
        linea.fechaEstimada
      );

    if (!fecha) {
      eventos.push({
        tipo: 'IMPORTACION_SIN_FECHA',
        estado:
          tlNormalizarEstado_(
            linea.estado
          ),
        fecha: '',
        fechaIso: '',
        diasDesdeHoy: null,
        cantidad: cantidad,
        descripcion:
          'Importación pendiente sin fecha estimada.',
        origen:
          linea.origenFecha || '',
        idOrden:
          linea.idOrden || '',
        item:
          linea.item || '',
        proveedor:
          linea.proveedor || '',
        indiceLinea: indice,
        llegaAntesQuiebre: null,
        disponibleAcumulado: null
      });

      return;
    }

    const estado =
      tlNormalizarEstado_(
        linea.estado
      );

    const llegaAntesQuiebre =
      fechaQuiebre
        ? fecha <= fechaQuiebre
        : null;

    eventos.push({
      tipo: 'IMPORTACION',
      estado: estado,
      fecha:
        tlFormatearFecha_(
          fecha
        ),
      fechaIso:
        tlFechaIso_(
          fecha
        ),
      diasDesdeHoy:
        tlDiferenciaDias_(
          hoy,
          fecha
        ),
      cantidad: cantidad,
      descripcion:
        tlDescripcionEstado_(
          estado
        ),
      origen:
        linea.origenFecha || '',
      idOrden:
        linea.idOrden || '',
      item:
        linea.item || '',
      proveedor:
        linea.proveedor || '',
      indiceLinea: indice,
      llegaAntesQuiebre:
        llegaAntesQuiebre,
      disponibleAcumulado: null
    });
  });

  /*
   * Si no existen líneas detalladas, usa el resumen.
   */
  if (
    lineas.length === 0
  ) {
    tlAgregarEventoResumen_(
      eventos,
      hoy,
      fechaQuiebre,
      'EN FABRICA',
      importaciones.enFabrica,
      importaciones.ultimaLlegadaEstimada
    );

    tlAgregarEventoResumen_(
      eventos,
      hoy,
      fechaQuiebre,
      'A EMBARCAR',
      importaciones.aEmbarcar,
      importaciones.ultimaLlegadaEstimada
    );

    tlAgregarEventoResumen_(
      eventos,
      hoy,
      fechaQuiebre,
      'EMBARCADO',
      importaciones.embarcado,
      importaciones.primeraLlegadaEstimada
    );

    tlAgregarEventoResumen_(
      eventos,
      hoy,
      fechaQuiebre,
      'A INGRESAR',
      importaciones.aIngresar,
      importaciones.primeraLlegadaEstimada
    );
  }

  /*
   * Orden cronológico.
   */
  eventos.sort((a, b) => {
    if (
      a.fechaIso &&
      b.fechaIso
    ) {
      const comparacion =
        a.fechaIso.localeCompare(
          b.fechaIso
        );

      if (comparacion !== 0) {
        return comparacion;
      }
    }

    if (a.fechaIso && !b.fechaIso) {
      return -1;
    }

    if (!a.fechaIso && b.fechaIso) {
      return 1;
    }

    return (
      tlOrdenEstado_(
        a.estado
      ) -
      tlOrdenEstado_(
        b.estado
      )
    );
  });

  /*
   * Disponibilidad acumulada.
   */
  let disponibleAcumulado =
    tlNumero_(
      cobertura.stockTotal
    );

  eventos.forEach(evento => {
    if (
      evento.tipo === 'IMPORTACION' &&
      evento.fechaIso
    ) {
      disponibleAcumulado +=
        evento.cantidad;

      evento.disponibleAcumulado =
        disponibleAcumulado;
    }

    if (
      evento.tipo === 'QUIEBRE'
    ) {
      evento.disponibleAcumulado =
        disponibleAcumulado;
    }
  });

  const eventosAntesQuiebre =
    eventos.filter(evento =>
      evento.tipo === 'IMPORTACION' &&
      evento.llegaAntesQuiebre === true
    );

  const eventosDespuesQuiebre =
    eventos.filter(evento =>
      evento.tipo === 'IMPORTACION' &&
      evento.llegaAntesQuiebre === false
    );

  const cantidadAntesQuiebre =
    eventosAntesQuiebre.reduce(
      (acc, evento) =>
        acc +
        tlNumero_(
          evento.cantidad
        ),
      0
    );

  const cantidadDespuesQuiebre =
    eventosDespuesQuiebre.reduce(
      (acc, evento) =>
        acc +
        tlNumero_(
          evento.cantidad
        ),
      0
    );

  const primeraLlegada =
    eventos.find(evento =>
      evento.tipo === 'IMPORTACION' &&
      evento.fechaIso
    );

  const llegadasConFecha =
    eventos.filter(evento =>
      evento.tipo === 'IMPORTACION' &&
      evento.fechaIso
    );

  const ultimaLlegada =
    llegadasConFecha.length
      ? llegadasConFecha[
          llegadasConFecha.length - 1
        ]
      : null;

  return {
    version:
      SII_TIMELINE_SKU_V61001.VERSION,

    hoy:
      tlFormatearFecha_(
        hoy
      ),

    hoyIso:
      tlFechaIso_(hoy),

    fechaQuiebre:
      fechaQuiebre
        ? tlFormatearFecha_(
            fechaQuiebre
          )
        : '',

    fechaQuiebreIso:
      fechaQuiebre
        ? tlFechaIso_(
            fechaQuiebre
          )
        : '',

    diasHastaQuiebre:
      fechaQuiebre
        ? tlDiferenciaDias_(
            hoy,
            fechaQuiebre
          )
        : null,

    primeraLlegada:
      primeraLlegada
        ? primeraLlegada.fecha
        : '',

    ultimaLlegada:
      ultimaLlegada
        ? ultimaLlegada.fecha
        : '',

    cantidadAntesQuiebre:
      cantidadAntesQuiebre,

    cantidadDespuesQuiebre:
      cantidadDespuesQuiebre,

    cantidadSinFecha:
      eventos
        .filter(evento =>
          evento.tipo ===
            'IMPORTACION_SIN_FECHA'
        )
        .reduce(
          (acc, evento) =>
            acc +
            tlNumero_(
              evento.cantidad
            ),
          0
        ),

    stockInicial:
      tlNumero_(
        cobertura.stockTotal
      ),

    pendienteTotal:
      tlNumero_(
        importaciones
          .cantidadPendiente
      ),

    promedioDemanda:
      tlNumero_(
        cobertura
          .promedioDemandaBase
      ),

    criterioDemanda:
      cobertura
        .criterioDemanda || '',

    tendencia:
      ventas.tendencia || '',

    eventos:
      eventos
  };
}


/**
 * Agrega un evento desde el resumen cuando no hay líneas.
 */
function tlAgregarEventoResumen_(
  eventos,
  hoy,
  fechaQuiebre,
  estado,
  cantidad,
  fechaTexto
) {
  const cantidadNumero =
    tlNumero_(cantidad);

  if (cantidadNumero <= 0) {
    return;
  }

  const fecha =
    tlConvertirFecha_(
      fechaTexto
    );

  eventos.push({
    tipo:
      fecha
        ? 'IMPORTACION'
        : 'IMPORTACION_SIN_FECHA',

    estado:
      estado,

    fecha:
      fecha
        ? tlFormatearFecha_(
            fecha
          )
        : '',

    fechaIso:
      fecha
        ? tlFechaIso_(
            fecha
          )
        : '',

    diasDesdeHoy:
      fecha
        ? tlDiferenciaDias_(
            hoy,
            fecha
          )
        : null,

    cantidad:
      cantidadNumero,

    descripcion:
      tlDescripcionEstado_(
        estado
      ),

    origen:
      'RESUMEN',

    idOrden:
      '',

    item:
      '',

    proveedor:
      '',

    llegaAntesQuiebre:
      fecha &&
      fechaQuiebre
        ? fecha <= fechaQuiebre
        : null,

    disponibleAcumulado:
      null
  });
}


/**
 * Prueba con el primer SKU disponible.
 */
function probarTimelineSku() {
  if (
    typeof probarModeloSku !==
    'function'
  ) {
    throw new Error(
      'No está disponible probarModeloSku().'
    );
  }

  const modelo =
    probarModeloSku();

  const timeline =
    modelo.timeline ||
    construirTimelineSku(
      modelo
    );

  Logger.log(
    JSON.stringify(
      timeline,
      null,
      2
    )
  );

  SpreadsheetApp
    .getActive()
    .toast(
      'Timeline generado correctamente.',
      'Timeline SKU',
      5
    );

  return timeline;
}


/**************************************************************
 * UTILIDADES
 **************************************************************/

function tlNormalizarEstado_(valor) {
  const texto =
    String(valor || '')
      .trim()
      .normalize('NFD')
      .replace(
        /[\u0300-\u036f]/g,
        ''
      )
      .toUpperCase()
      .replace(/_/g, ' ')
      .replace(/\s+/g, ' ');

  if (texto.includes('FABRICA')) {
    return 'EN FABRICA';
  }

  if (
    texto.includes('A EMBARCAR') ||
    texto.includes('POR EMBARCAR')
  ) {
    return 'A EMBARCAR';
  }

  if (texto.includes('EMBARCADO')) {
    return 'EMBARCADO';
  }

  if (
    texto.includes('A INGRESAR') ||
    texto.includes('NACIONALIZ')
  ) {
    return 'A INGRESAR';
  }

  return texto || 'OTRO';
}


function tlDescripcionEstado_(estado) {
  const descripciones = {
    'EN FABRICA':
      'Mercadería en producción.',

    'A EMBARCAR':
      'Mercadería preparada o pendiente de embarque.',

    'EMBARCADO':
      'Mercadería en tránsito internacional.',

    'A INGRESAR':
      'Mercadería próxima a ingresar al stock.'
  };

  return descripciones[estado] ||
    'Importación pendiente.';
}


function tlOrdenEstado_(estado) {
  return (
    SII_TIMELINE_SKU_V61001
      .ORDEN_ESTADOS[estado] ||
    SII_TIMELINE_SKU_V61001
      .ORDEN_ESTADOS.OTRO
  );
}


function tlConvertirFecha_(valor) {
  if (!valor) {
    return null;
  }

  if (
    valor instanceof Date &&
    !isNaN(valor.getTime())
  ) {
    return tlInicioDia_(valor);
  }

  if (
    typeof convertirFecha_ ===
    'function'
  ) {
    const fecha =
      convertirFecha_(valor);

    if (fecha) {
      return tlInicioDia_(
        fecha
      );
    }
  }

  const texto =
    String(valor)
      .trim();

  let match =
    texto.match(
      /^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/
    );

  if (match) {
    return tlInicioDia_(
      new Date(
        Number(match[3]),
        Number(match[2]) - 1,
        Number(match[1])
      )
    );
  }

  match =
    texto.match(
      /^(\d{4})[\/-](\d{1,2})[\/-](\d{1,2})$/
    );

  if (match) {
    return tlInicioDia_(
      new Date(
        Number(match[1]),
        Number(match[2]) - 1,
        Number(match[3])
      )
    );
  }

  const fecha =
    new Date(texto);

  return isNaN(fecha.getTime())
    ? null
    : tlInicioDia_(fecha);
}


function tlInicioDia_(fecha) {
  const copia =
    new Date(fecha);

  copia.setHours(
    0,
    0,
    0,
    0
  );

  return copia;
}


function tlSumarDias_(fecha, dias) {
  const resultado =
    tlInicioDia_(fecha);

  resultado.setDate(
    resultado.getDate() +
    Number(dias || 0)
  );

  return resultado;
}


function tlDiferenciaDias_(
  desde,
  hasta
) {
  const msDia =
    24 * 60 * 60 * 1000;

  return Math.round(
    (
      tlInicioDia_(hasta).getTime() -
      tlInicioDia_(desde).getTime()
    ) /
    msDia
  );
}


function tlFormatearFecha_(fecha) {
  return Utilities.formatDate(
    fecha,
    Session.getScriptTimeZone(),
    'dd/MM/yyyy'
  );
}


function tlFechaIso_(fecha) {
  return Utilities.formatDate(
    fecha,
    Session.getScriptTimeZone(),
    'yyyy-MM-dd'
  );
}


function tlNumero_(valor) {
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

  const resultado =
    Number(valor);

  return Number.isFinite(resultado)
    ? resultado
    : 0;
}
