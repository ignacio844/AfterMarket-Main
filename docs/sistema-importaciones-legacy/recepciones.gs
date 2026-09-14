/*******************************************************
 * SII V1.1.002
 * RECEPCIONES
 * Estructura normalizada de estados logísticos y de recepción
 *******************************************************/


/**
 * Abre la pantalla de recepción.
 */
function abrirRecepciones() {
  const html = HtmlService
    .createHtmlOutputFromFile('recepciones_ui')
    .setWidth(1300)
    .setHeight(750);

  SpreadsheetApp.getUi()
    .showModalDialog(
      html,
      'Registrar recepción'
    );
}


/**
 * Devuelve todas las PI abiertas.
 */
function obtenerOrdenesPendientes() {
  const sh = obtenerHoja_(
    SpreadsheetApp.getActive(),
    SII_CFG.SHEETS.ORDENES
  );

  const datos = leerFilasComoObjetos_(sh);

  return datos
    .filter(reg => {
      const estadoRecepcion = limpiarTexto_(
        reg.ESTADO_RECEPCION
      ).toUpperCase();

      const statusLogistico = limpiarTexto_(
        reg.STATUS ||
        reg.SITUACION
      ).toUpperCase();

      return estadoRecepcion !== 'RECIBIDO' &&
        statusLogistico !== 'CERRADO' &&
        statusLogistico !== 'CERRADA';
    })
    .map(reg => {
      const idOrden = limpiarTexto_(
        reg.ID_ORDEN ||
        reg.NUMERO_ORDEN ||
        reg.NUMERO_PI
      );

      const numeroPI = limpiarTexto_(
        reg.NUMERO_PI ||
        reg.PI ||
        reg.ID_ORDEN
      );

      return {
        idOrden: idOrden,
        numeroPI: numeroPI,
        proveedor: limpiarTexto_(reg.PROVEEDOR),
        legajo: limpiarTexto_(
          reg.LEGAJO_CONTENEDOR ||
          reg.LEGAJO_NRO ||
          reg.LEGAJO
        ),
        estado: limpiarTexto_(
          reg.STATUS ||
          reg.SITUACION
        ),
        estadoRecepcion: limpiarTexto_(
          reg.ESTADO_RECEPCION || 'PENDIENTE'
        )
      };
    })
    .filter(orden => orden.idOrden)
    .sort((a, b) => {
      return limpiarTexto_(a.numeroPI)
        .localeCompare(
          limpiarTexto_(b.numeroPI),
          'es',
          {
            numeric: true,
            sensitivity: 'base'
          }
        );
    });
}

/**
 * Devuelve el detalle pendiente de una orden.
 *
 * Estructura normalizada de DETALLE_IMPORTACIONES:
 *
 * STATUS_LINEA: estado logístico importado desde Excel.
 * CANTIDAD_PENDIENTE: cantidad aún no recibida.
 * CANTIDAD_RECIBIDA: cantidad recibida acumulada.
 * ESTADO_RECEPCION: PENDIENTE / PARCIAL / RECIBIDO.
 */
function obtenerDetalleRecepcion(idOrden) {
  const sh = obtenerHoja_(
    SpreadsheetApp.getActive(),
    SII_CFG.SHEETS.DETALLE
  );

  const datos = leerFilasComoObjetos_(sh);
  const claveOrden = limpiarTexto_(idOrden);

  return datos
    .filter(reg => {
      return limpiarTexto_(reg.ID_ORDEN) === claveOrden;
    })
    .map(reg => {
      return {
        idDetalle: limpiarTexto_(reg.ID_DETALLE),
        sku: limpiarTexto_(reg.SKU),
        item: limpiarTexto_(reg.ITEM),
        marca: limpiarTexto_(reg.MARCA),
        statusLinea: limpiarTexto_(reg.STATUS_LINEA),
        estadoRecepcion: limpiarTexto_(
          reg.ESTADO_RECEPCION || 'PENDIENTE'
        ),
        cantidadPendiente: numero_(reg.CANTIDAD_PENDIENTE),
        cantidadRecibida: numero_(reg.CANTIDAD_RECIBIDA),
        precio: numero_(reg.PRECIO_UNITARIO)
      };
    })
    .filter(reg => {
      return reg.idDetalle && reg.cantidadPendiente > 0;
    });
}

/**
 * Indica si un valor puede interpretarse
 * como una cantidad numérica.
 */
function esValorNumericoRecepcion_(valor) {
  if (
    valor === null ||
    valor === undefined ||
    valor === ''
  ) {
    return false;
  }

  if (typeof valor === 'number') {
    return !isNaN(valor);
  }

  const texto =
    String(valor).trim();

  if (!texto) {
    return false;
  }

  /*
   * Evita interpretar estados como cantidades.
   */
  const estado = texto
    .normalize('NFD')
    .replace(
      /[\u0300-\u036f]/g,
      ''
    )
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim();

  const estados = [
    'EN FABRICA',
    'A EMBARCAR',
    'EMBARCADO',
    'A INGRESAR',
    'PARCIAL',
    'RECIBIDO'
  ];

  if (estados.includes(estado)) {
    return false;
  }

  return !isNaN(
    numero_(texto)
  );
}


/**
 * Registra una recepción parcial o total.
 */
function registrarRecepcion(datos) {
  if (!datos) {
    throw new Error(
      'No se recibieron datos de la recepción.'
    );
  }

  const idOrden =
    limpiarTexto_(datos.idOrden);

  const fechaRecepcionTexto =
    limpiarTexto_(datos.fechaRecepcion);

  const observacionesGenerales =
    limpiarTexto_(datos.observaciones);

  const lineas =
    Array.isArray(datos.lineas)
      ? datos.lineas
      : [];

  if (!idOrden) {
    throw new Error(
      'Debe indicar la orden.'
    );
  }

  if (!fechaRecepcionTexto) {
    throw new Error(
      'Debe indicar la fecha de recepción.'
    );
  }

  if (lineas.length === 0) {
    throw new Error(
      'No hay líneas para registrar.'
    );
  }

  const ss =
    SpreadsheetApp.getActive();

  const fechaRecepcion =
    convertirFechaRecepcion_(
      fechaRecepcionTexto
    );

  const usuario =
    Session.getActiveUser().getEmail() ||
    Session.getEffectiveUser().getEmail() ||
    'USUARIO_SIN_EMAIL';

  const shDetalle = obtenerHoja_(
    ss,
    SII_CFG.SHEETS.DETALLE
  );

  const shRecepciones = obtenerHoja_(
    ss,
    SII_CFG.SHEETS.RECEPCIONES
  );

  const shEventos = obtenerHoja_(
    ss,
    SII_CFG.SHEETS.EVENTOS_IMPORTACION
  );

  const lock =
    LockService.getDocumentLock();

  lock.waitLock(30000);

  try {
    const detalleValores =
      shDetalle
        .getDataRange()
        .getValues();

    if (detalleValores.length < 2) {
      throw new Error(
        'DETALLE_IMPORTACIONES no contiene datos.'
      );
    }

    const encabezados =
      detalleValores[0]
        .map(limpiarTexto_);

    const columnas = {
      idDetalle:
        buscarColumnaRecepcion_(
          encabezados,
          'ID_DETALLE'
        ),

      idOrden:
        buscarColumnaRecepcion_(
          encabezados,
          'ID_ORDEN'
        ),

      item:
        buscarColumnaRecepcion_(
          encabezados,
          'ITEM'
        ),

      sku:
        buscarColumnaRecepcion_(
          encabezados,
          'SKU'
        ),

      estadoRecepcion:
        buscarColumnaRecepcion_(
          encabezados,
          'ESTADO_RECEPCION'
        ),

      cantidadPendiente:
        buscarColumnaRecepcion_(
          encabezados,
          'CANTIDAD_PENDIENTE'
        ),

      cantidadRecibida:
        buscarColumnaRecepcion_(
          encabezados,
          'CANTIDAD_RECIBIDA'
        ),

      usuario:
        buscarColumnaRecepcion_(
          encabezados,
          'USUARIO'
        ),

      observaciones:
        buscarColumnaRecepcion_(
          encabezados,
          'OBSERVACIONES'
        ),

      fechaEstado:
        buscarColumnaRecepcion_(
          encabezados,
          'FECHA_ESTADO'
        )
    };

    /*
     * Relación ID_DETALLE → índice de fila
     * dentro del array detalleValores.
     */
    const filaPorIdDetalle =
      new Map();

    for (
      let i = 1;
      i < detalleValores.length;
      i++
    ) {
      const idDetalle =
        limpiarTexto_(
          detalleValores[i][
            columnas.idDetalle
          ]
        );

      if (idDetalle) {
        filaPorIdDetalle.set(
          idDetalle,
          i
        );
      }
    }

    const idRecepcion =
      generarIdRecepcion_();

    const eventos = [];
    const filasModificadas = [];

    let cantidadTotalRecibida = 0;
    let lineasProcesadas = 0;

    lineas.forEach(linea => {
      const idDetalle =
        limpiarTexto_(linea.idDetalle);

      const cantidadAhora =
        numero_(linea.cantidadRecibida);

      if (!idDetalle) {
        throw new Error(
          'Una línea no tiene ID_DETALLE.'
        );
      }

      if (cantidadAhora <= 0) {
        return;
      }

      if (
        !filaPorIdDetalle.has(
          idDetalle
        )
      ) {
        throw new Error(
          `No se encontró el detalle ${idDetalle} ` +
          'en DETALLE_IMPORTACIONES.'
        );
      }

      const indiceFila =
        filaPorIdDetalle.get(idDetalle);

      const fila =
        detalleValores[indiceFila];

      const idOrdenFila =
        limpiarTexto_(
          fila[columnas.idOrden]
        );

      if (idOrdenFila !== idOrden) {
        throw new Error(
          `El detalle ${idDetalle} no pertenece ` +
          'a la orden seleccionada.'
        );
      }

      const pendienteAnterior =
        numero_(
          fila[
            columnas.cantidadPendiente
          ]
        );

      const recibidoAnterior =
        numero_(
          fila[
            columnas.cantidadRecibida
          ]
        );

      if (
        cantidadAhora >
        pendienteAnterior
      ) {
        throw new Error(
          `La cantidad recibida del detalle ` +
          `${idDetalle} supera la pendiente.`
        );
      }

      const pendienteNuevo =
        pendienteAnterior -
        cantidadAhora;

      const recibidoNuevo =
        recibidoAnterior +
        cantidadAhora;

      const estadoNuevo =
        pendienteNuevo <= 0
          ? 'RECIBIDO'
          : 'PARCIAL';

      fila[
        columnas.cantidadPendiente
      ] = pendienteNuevo;

      fila[
        columnas.cantidadRecibida
      ] = recibidoNuevo;

      fila[
        columnas.estadoRecepcion
      ] = estadoNuevo;

      fila[
        columnas.usuario
      ] = usuario;

      fila[
        columnas.observaciones
      ] = observacionesGenerales;

      fila[
        columnas.fechaEstado
      ] = fechaRecepcion;

      /*
       * indiceFila es base cero dentro del array.
       * La fila física en Sheets es indiceFila + 1.
       */
      filasModificadas.push({
        numeroFila:
          indiceFila + 1,

        valores:
          fila.slice()
      });

      cantidadTotalRecibida +=
        cantidadAhora;

      lineasProcesadas++;

      eventos.push([
        generarIdEvento_(),
        new Date(),
        idOrden,
        idDetalle,

        limpiarTexto_(
          fila[columnas.item]
        ),

        limpiarTexto_(
          fila[columnas.sku]
        ) ||
        limpiarTexto_(
          fila[columnas.item]
        ),

        pendienteNuevo <= 0
          ? 'RECEPCION COMPLETA'
          : 'RECEPCION PARCIAL',

        cantidadAhora,
        usuario,
        observacionesGenerales
      ]);
    });

    if (lineasProcesadas === 0) {
      throw new Error(
        'No se ingresaron cantidades válidas para recibir.'
      );
    }

    /*
     * Se escriben únicamente las filas modificadas.
     *
     * No se vuelve a grabar toda la hoja, para evitar
     * demoras innecesarias.
     */
    filasModificadas.forEach(
      registro => {
        shDetalle
          .getRange(
            registro.numeroFila,
            1,
            1,
            encabezados.length
          )
          .setValues([
            registro.valores
          ]);
      }
    );

    /*
     * Registra la cabecera de la recepción.
     */
    registrarCabeceraRecepcion_(
      shRecepciones,
      {
        idRecepcion:
          idRecepcion,

        fechaRecepcion:
          fechaRecepcion,

        idOrden:
          idOrden,

        usuario:
          usuario,

        observaciones:
          observacionesGenerales
      }
    );

    /*
     * Registra un evento por cada línea recibida.
     */
    if (eventos.length > 0) {
      shEventos
        .getRange(
          shEventos.getLastRow() + 1,
          1,
          eventos.length,
          eventos[0].length
        )
        .setValues(eventos);
    }

    /*
     * Fuerza la escritura antes de releer el detalle
     * para calcular el estado general de la orden.
     */
    SpreadsheetApp.flush();

    actualizarEstadoOrdenDesdeDetalle_(
      idOrden
    );

    /*
     * Se mantiene manual para no demorar
     * el registro de la recepción.
     */
    // actualizarPlanCompras();

    return {
      ok: true,

      idRecepcion:
        idRecepcion,

      lineasProcesadas:
        lineasProcesadas,

      cantidadTotalRecibida:
        cantidadTotalRecibida,

      mensaje:
        `Recepción ${idRecepcion} registrada. ` +
        `${lineasProcesadas} líneas y ` +
        `${cantidadTotalRecibida} unidades recibidas.`
    };

  } finally {
    lock.releaseLock();
  }
}



/**
 * Valida una recepción masiva proveniente de Excel.
 * No modifica ninguna hoja.
 */
function validarRecepcionExcel(datos) {
  const preparacion = prepararRecepcionExcel_(datos);

  return {
    ok: preparacion.errores === 0,
    filasLeidas: preparacion.lineas.length,
    filasCorrectas: preparacion.lineas.length - preparacion.errores,
    filasConError: preparacion.errores,
    unidadesARecibir: preparacion.unidadesARecibir,
    ordenes: preparacion.ordenes.size,
    lineas: preparacion.lineas.map(reg => ({
      filaExcel: reg.filaExcel,
      idOrden: reg.idOrdenReal || reg.idOrdenArchivo,
      idDetalle: reg.idDetalle,
      item: reg.itemReal || reg.itemArchivo,
      sku: reg.skuReal || reg.skuArchivo,
      cantidadRecibida: reg.cantidadRecibida,
      cantidadPendiente: reg.cantidadPendiente,
      fechaRecepcion: reg.fechaRecepcionTexto,
      estado: reg.errores.length ? 'ERROR' : 'OK',
      errores: reg.errores
    }))
  };
}

/**
 * Registra una recepción masiva validada desde Excel.
 * Vuelve a validar todo bajo LockService.
 */
function registrarRecepcionesExcel(datos) {
  const ss = SpreadsheetApp.getActive();
  const lock = LockService.getDocumentLock();
  lock.waitLock(30000);

  try {
    const preparacion = prepararRecepcionExcel_(datos);

    if (preparacion.errores > 0) {
      const ejemplos = preparacion.lineas
        .filter(reg => reg.errores.length)
        .slice(0, 8)
        .map(reg => `Fila ${reg.filaExcel}: ${reg.errores.join(' / ')}`)
        .join('\n');

      throw new Error(
        'El archivo contiene errores y no se registró ninguna recepción.\n' +
        ejemplos
      );
    }

    if (preparacion.lineas.length === 0) {
      throw new Error('El archivo no contiene líneas para recibir.');
    }

    const shDetalle = preparacion.shDetalle;
    const shRecepciones = obtenerHoja_(ss, SII_CFG.SHEETS.RECEPCIONES);
    const shEventos = obtenerHoja_(ss, SII_CFG.SHEETS.EVENTOS_IMPORTACION);

    const usuario =
      Session.getActiveUser().getEmail() ||
      Session.getEffectiveUser().getEmail() ||
      'USUARIO_SIN_EMAIL';

    const filasModificadas = [];
    const eventos = [];
    const gruposRecepcion = new Map();
    const ordenesAActualizar = new Set();

    let cantidadTotalRecibida = 0;

    preparacion.lineas.forEach(reg => {
      const fila = preparacion.detalleValores[reg.indiceFila];

      const pendienteAnterior = numero_(
        fila[preparacion.columnas.cantidadPendiente]
      );

      const recibidoAnterior = numero_(
        fila[preparacion.columnas.cantidadRecibida]
      );

      if (
        reg.cantidadRecibida <= 0 ||
        reg.cantidadRecibida > pendienteAnterior
      ) {
        throw new Error(
          `La cantidad de la fila ${reg.filaExcel} ya no es válida. ` +
          'Vuelva a validar el archivo.'
        );
      }

      const pendienteNuevo = pendienteAnterior - reg.cantidadRecibida;
      const recibidoNuevo = recibidoAnterior + reg.cantidadRecibida;
      const estadoNuevo = pendienteNuevo <= 0 ? 'RECIBIDO' : 'PARCIAL';

      fila[preparacion.columnas.cantidadPendiente] = pendienteNuevo;
      fila[preparacion.columnas.cantidadRecibida] = recibidoNuevo;
      fila[preparacion.columnas.estadoRecepcion] = estadoNuevo;
      fila[preparacion.columnas.usuario] = usuario;
      fila[preparacion.columnas.observaciones] = reg.observaciones;
      fila[preparacion.columnas.fechaEstado] = reg.fechaRecepcion;

      filasModificadas.push({
        numeroFila: reg.indiceFila + 1,
        valores: fila.slice()
      });

      cantidadTotalRecibida += reg.cantidadRecibida;
      ordenesAActualizar.add(reg.idOrdenReal);

      const claveGrupo = reg.idOrdenReal + '|' + reg.fechaRecepcionTexto;

      if (!gruposRecepcion.has(claveGrupo)) {
        gruposRecepcion.set(claveGrupo, {
          idRecepcion: generarIdRecepcion_(),
          idOrden: reg.idOrdenReal,
          fechaRecepcion: reg.fechaRecepcion,
          observaciones: reg.observaciones
        });
      }

      eventos.push([
        generarIdEvento_(),
        new Date(),
        reg.idOrdenReal,
        reg.idDetalle,
        reg.itemReal,
        reg.skuReal || reg.itemReal,
        pendienteNuevo <= 0 ? 'RECEPCION COMPLETA' : 'RECEPCION PARCIAL',
        reg.cantidadRecibida,
        usuario,
        reg.observaciones
      ]);
    });

    filasModificadas.forEach(registro => {
      shDetalle
        .getRange(
          registro.numeroFila,
          1,
          1,
          preparacion.encabezados.length
        )
        .setValues([registro.valores]);
    });

    gruposRecepcion.forEach(grupo => {
      registrarCabeceraRecepcion_(
        shRecepciones,
        {
          idRecepcion: grupo.idRecepcion,
          fechaRecepcion: grupo.fechaRecepcion,
          idOrden: grupo.idOrden,
          usuario: usuario,
          observaciones: grupo.observaciones
        }
      );
    });

    if (eventos.length > 0) {
      shEventos
        .getRange(
          shEventos.getLastRow() + 1,
          1,
          eventos.length,
          eventos[0].length
        )
        .setValues(eventos);
    }

    SpreadsheetApp.flush();

    ordenesAActualizar.forEach(idOrden => {
      actualizarEstadoOrdenDesdeDetalle_(idOrden);
    });

    return {
      ok: true,
      lineasProcesadas: preparacion.lineas.length,
      cantidadTotalRecibida: cantidadTotalRecibida,
      ordenesProcesadas: ordenesAActualizar.size,
      recepcionesGeneradas: gruposRecepcion.size,
      mensaje:
        'Importación registrada correctamente. ' +
        `${preparacion.lineas.length} líneas, ` +
        `${cantidadTotalRecibida} unidades y ` +
        `${ordenesAActualizar.size} orden(es).`
    };

  } finally {
    lock.releaseLock();
  }
}

/**
 * Prepara y valida las líneas recibidas desde Excel.
 */
function prepararRecepcionExcel_(datos) {
  if (!datos) {
    throw new Error('No se recibieron datos del archivo Excel.');
  }

  const lineasEntrada = Array.isArray(datos.lineas) ? datos.lineas : [];

  if (lineasEntrada.length === 0) {
    throw new Error('El archivo Excel no contiene líneas.');
  }

  const fechaDefault = limpiarTexto_(datos.fechaRecepcionDefault);
  const observacionesDefault = limpiarTexto_(datos.observacionesDefault);

  const ss = SpreadsheetApp.getActive();
  const shDetalle = obtenerHoja_(ss, SII_CFG.SHEETS.DETALLE);
  const detalleValores = shDetalle.getDataRange().getValues();

  if (detalleValores.length < 2) {
    throw new Error('DETALLE_IMPORTACIONES no contiene datos.');
  }

  const encabezados = detalleValores[0].map(limpiarTexto_);

  const columnas = {
    idDetalle: buscarColumnaRecepcion_(encabezados, 'ID_DETALLE'),
    idOrden: buscarColumnaRecepcion_(encabezados, 'ID_ORDEN'),
    item: buscarColumnaRecepcion_(encabezados, 'ITEM'),
    sku: buscarColumnaRecepcion_(encabezados, 'SKU'),
    cantidadPendiente: buscarColumnaRecepcion_(encabezados, 'CANTIDAD_PENDIENTE'),
    cantidadRecibida: buscarColumnaRecepcion_(encabezados, 'CANTIDAD_RECIBIDA'),
    estadoRecepcion: buscarColumnaRecepcion_(encabezados, 'ESTADO_RECEPCION'),
    usuario: buscarColumnaRecepcion_(encabezados, 'USUARIO'),
    observaciones: buscarColumnaRecepcion_(encabezados, 'OBSERVACIONES'),
    fechaEstado: buscarColumnaRecepcion_(encabezados, 'FECHA_ESTADO')
  };

  const filaPorIdDetalle = new Map();

  for (let i = 1; i < detalleValores.length; i++) {
    const idDetalle = limpiarTexto_(
      detalleValores[i][columnas.idDetalle]
    );

    if (idDetalle) {
      filaPorIdDetalle.set(idDetalle, i);
    }
  }

  const apariciones = new Map();

  lineasEntrada.forEach(linea => {
    const idDetalle = limpiarTexto_(linea.idDetalle);

    if (idDetalle) {
      apariciones.set(
        idDetalle,
        (apariciones.get(idDetalle) || 0) + 1
      );
    }
  });

  let errores = 0;
  let unidadesARecibir = 0;
  const ordenes = new Set();

  const lineas = lineasEntrada.map((linea, indice) => {
    const filaExcel = numero_(linea.filaExcel) || indice + 2;
    const idDetalle = limpiarTexto_(linea.idDetalle);
    const idOrdenArchivo = limpiarTexto_(linea.idOrden);
    const itemArchivo = limpiarTexto_(linea.item);
    const skuArchivo = limpiarTexto_(linea.sku);
    const cantidadRecibida = numero_(linea.cantidadRecibida);

    const fechaRecepcionTexto = normalizarFechaRecepcionExcel_(
      linea.fechaRecepcion || fechaDefault
    );

    const observaciones = limpiarTexto_(
      linea.observaciones || observacionesDefault
    );

    const erroresLinea = [];

    if (!idDetalle) {
      erroresLinea.push('Falta ID_DETALLE.');
    }

    if (cantidadRecibida <= 0) {
      erroresLinea.push('CANTIDAD_RECIBIDA debe ser mayor que cero.');
    }

    if (
      idDetalle &&
      (apariciones.get(idDetalle) || 0) > 1
    ) {
      erroresLinea.push('ID_DETALLE duplicado dentro del archivo.');
    }

    if (!fechaRecepcionTexto) {
      erroresLinea.push('FECHA_RECEPCION inválida o vacía.');
    }

    let indiceFila = -1;
    let idOrdenReal = '';
    let itemReal = '';
    let skuReal = '';
    let cantidadPendiente = 0;

    if (idDetalle && filaPorIdDetalle.has(idDetalle)) {
      indiceFila = filaPorIdDetalle.get(idDetalle);

      const fila = detalleValores[indiceFila];

      idOrdenReal = limpiarTexto_(fila[columnas.idOrden]);
      itemReal = limpiarTexto_(fila[columnas.item]);
      skuReal = limpiarTexto_(fila[columnas.sku]);
      cantidadPendiente = numero_(fila[columnas.cantidadPendiente]);

      const estadoRecepcion = limpiarTexto_(
        fila[columnas.estadoRecepcion]
      ).toUpperCase();

      if (
        cantidadPendiente <= 0 ||
        estadoRecepcion === 'RECIBIDO'
      ) {
        erroresLinea.push('La línea ya está completamente recibida.');
      }

      if (cantidadRecibida > cantidadPendiente) {
        erroresLinea.push(
          `La cantidad supera el pendiente (${cantidadPendiente}).`
        );
      }

      if (
        idOrdenArchivo &&
        normalizarClaveRecepcionExcel_(idOrdenArchivo) !==
          normalizarClaveRecepcionExcel_(idOrdenReal)
      ) {
        erroresLinea.push(
          `ID_ORDEN no coincide. Corresponde a ${idOrdenReal}.`
        );
      }

      if (
        itemArchivo &&
        itemReal &&
        normalizarClaveRecepcionExcel_(itemArchivo) !==
          normalizarClaveRecepcionExcel_(itemReal)
      ) {
        erroresLinea.push(
          `ITEM no coincide. Corresponde a ${itemReal}.`
        );
      }

      // ID_DETALLE es la clave autoritativa de la recepción.
      // El SKU del Excel es informativo: puede haber quedado desactualizado
      // si una equivalencia se completó después de descargar la plantilla.
      // Siempre se utiliza el SKU vigente de DETALLE_IMPORTACIONES (skuReal).

    } else if (idDetalle) {
      erroresLinea.push(
        'ID_DETALLE no existe en DETALLE_IMPORTACIONES.'
      );
    }

    let fechaRecepcion = null;

    if (fechaRecepcionTexto) {
      try {
        fechaRecepcion = convertirFechaRecepcion_(
          fechaRecepcionTexto
        );
      } catch (error) {
        erroresLinea.push('FECHA_RECEPCION no es válida.');
      }
    }

    if (erroresLinea.length === 0) {
      unidadesARecibir += cantidadRecibida;
      ordenes.add(idOrdenReal);
    } else {
      errores++;
    }

    return {
      filaExcel: filaExcel,
      indiceFila: indiceFila,
      idDetalle: idDetalle,
      idOrdenArchivo: idOrdenArchivo,
      idOrdenReal: idOrdenReal,
      itemArchivo: itemArchivo,
      itemReal: itemReal,
      skuArchivo: skuArchivo,
      skuReal: skuReal,
      cantidadRecibida: cantidadRecibida,
      cantidadPendiente: cantidadPendiente,
      fechaRecepcionTexto: fechaRecepcionTexto,
      fechaRecepcion: fechaRecepcion,
      observaciones: observaciones,
      errores: erroresLinea
    };
  });

  return {
    shDetalle: shDetalle,
    detalleValores: detalleValores,
    encabezados: encabezados,
    columnas: columnas,
    lineas: lineas,
    errores: errores,
    unidadesARecibir: unidadesARecibir,
    ordenes: ordenes
  };
}

/**
 * Normaliza identificadores provenientes de Excel/Sheets
 * para comparaciones seguras.
 *
 * Elimina espacios, guiones, barras, caracteres invisibles
 * y diferencias de mayúsculas/minúsculas.
 */
function normalizarClaveRecepcionExcel_(valor) {
  return String(
    valor === null || valor === undefined
      ? ''
      : valor
  )
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
}


/**
 * Normaliza fechas provenientes del Excel a yyyy-MM-dd.
 * Acepta yyyy-MM-dd, dd/MM/yyyy y dd-MM-yyyy.
 */
function normalizarFechaRecepcionExcel_(valor) {
  const texto = limpiarTexto_(valor);

  if (!texto) {
    return '';
  }

  let m = texto.match(
    /^(\d{4})-(\d{1,2})-(\d{1,2})$/
  );

  if (m) {
    return (
      m[1] +
      '-' +
      String(Number(m[2])).padStart(2, '0') +
      '-' +
      String(Number(m[3])).padStart(2, '0')
    );
  }

  m = texto.match(
    /^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/
  );

  if (m) {
    return (
      m[3] +
      '-' +
      String(Number(m[2])).padStart(2, '0') +
      '-' +
      String(Number(m[1])).padStart(2, '0')
    );
  }

  return '';
}


/**
 * Actualiza el estado general de la orden
 * según sus líneas.
 *
 * Si todas las líneas tienen pendiente 0:
 * RECIBIDO.
 *
 * Si existe una cantidad recibida y todavía
 * queda mercadería pendiente:
 * PARCIAL.
 */
function actualizarEstadoOrdenDesdeDetalle_(
  idOrden
) {
  const ss = SpreadsheetApp.getActive();

  const shDetalle = obtenerHoja_(
    ss,
    SII_CFG.SHEETS.DETALLE
  );

  const shOrdenes = obtenerHoja_(
    ss,
    SII_CFG.SHEETS.ORDENES
  );

  const datosDetalle = shDetalle
    .getDataRange()
    .getValues();

  if (datosDetalle.length < 2) {
    return;
  }

  const encabezadosDetalle = datosDetalle[0]
    .map(limpiarTexto_);

  const colIdOrdenDetalle = buscarColumnaRecepcion_(
    encabezadosDetalle,
    'ID_ORDEN'
  );

  const colPendienteDetalle = buscarColumnaRecepcion_(
    encabezadosDetalle,
    'CANTIDAD_PENDIENTE'
  );

  const colRecibidaDetalle = buscarColumnaRecepcion_(
    encabezadosDetalle,
    'CANTIDAD_RECIBIDA'
  );

  const claveOrden = limpiarTexto_(idOrden);

  const lineasOrden = datosDetalle
    .slice(1)
    .filter(fila => {
      return limpiarTexto_(
        fila[colIdOrdenDetalle]
      ) === claveOrden;
    });

  if (lineasOrden.length === 0) {
    throw new Error(
      `No se encontraron líneas para la orden ${idOrden}.`
    );
  }

  let pendienteTotal = 0;
  let recibidoTotal = 0;

  lineasOrden.forEach(fila => {
    pendienteTotal += numero_(
      fila[colPendienteDetalle]
    );

    recibidoTotal += numero_(
      fila[colRecibidaDetalle]
    );
  });

  let nuevoEstado = 'PENDIENTE';

  if (pendienteTotal <= 0) {
    nuevoEstado = 'RECIBIDO';
  } else if (recibidoTotal > 0) {
    nuevoEstado = 'PARCIAL';
  }

  const datosOrdenes = shOrdenes
    .getDataRange()
    .getValues();

  if (datosOrdenes.length < 2) {
    throw new Error(
      'La hoja ORDENES no contiene registros.'
    );
  }

  let encabezadosOrdenes = datosOrdenes[0]
    .map(limpiarTexto_);

  const colIdOrden = buscarPrimeraColumna_(
    encabezadosOrdenes,
    [
      'ID_ORDEN',
      'NUMERO_ORDEN',
      'NUMERO_PI'
    ]
  );

  let colEstadoRecepcion =
    encabezadosOrdenes.indexOf('ESTADO_RECEPCION');

  if (colEstadoRecepcion === -1) {
    colEstadoRecepcion = shOrdenes.getLastColumn();
    shOrdenes
      .getRange(1, colEstadoRecepcion + 1)
      .setValue('ESTADO_RECEPCION');

    encabezadosOrdenes.push('ESTADO_RECEPCION');
  }

  let filaOrden = 0;

  for (let i = 1; i < datosOrdenes.length; i++) {
    if (
      limpiarTexto_(
        datosOrdenes[i][colIdOrden]
      ) === claveOrden
    ) {
      filaOrden = i + 1;
      break;
    }
  }

  if (filaOrden === 0) {
    throw new Error(
      `No se encontró la orden ${idOrden} en ORDENES.`
    );
  }

  shOrdenes
    .getRange(
      filaOrden,
      colEstadoRecepcion + 1
    )
    .setValue(nuevoEstado);
}

/**
 * Registra la cabecera en RECEPCIONES
 * respetando los encabezados reales.
 */
function registrarCabeceraRecepcion_(
  sh,
  datos
) {
  const ultimaColumna =
    sh.getLastColumn();

  if (ultimaColumna === 0) {
    throw new Error(
      'La hoja RECEPCIONES no tiene encabezados.'
    );
  }

  const encabezados =
    sh.getRange(
      1,
      1,
      1,
      ultimaColumna
    )
      .getValues()[0]
      .map(limpiarTexto_);

  const fila =
    encabezados.map(encabezado => {
      switch (encabezado) {
        case 'ID_RECEPCION':
          return datos.idRecepcion;

        case 'FECHA_RECEPCION':
        case 'FECHA':
          return datos.fechaRecepcion;

        case 'ID_ORDEN':
          return datos.idOrden;

        case 'NUMERO_PI':
          /*
           * Por ahora ID_ORDEN y NUMERO_PI
           * utilizan el mismo identificador enviado
           * por la pantalla.
           */
          return datos.idOrden;

        case 'USUARIO':
          return datos.usuario;

        case 'OBSERVACIONES':
          return datos.observaciones;

        default:
          return '';
      }
    });

  sh.appendRow(fila);
}


/**
 * Busca una columna obligatoria.
 */
function buscarColumnaRecepcion_(
  encabezados,
  nombre
) {
  const indice =
    encabezados.indexOf(nombre);

  if (indice === -1) {
    throw new Error(
      `No se encontró la columna "${nombre}".`
    );
  }

  return indice;
}


/**
 * Busca la primera columna existente
 * entre diferentes nombres posibles.
 */
function buscarPrimeraColumna_(
  encabezados,
  nombresPosibles
) {
  for (
    let i = 0;
    i < nombresPosibles.length;
    i++
  ) {
    const indice =
      encabezados.indexOf(
        nombresPosibles[i]
      );

    if (indice !== -1) {
      return indice;
    }
  }

  throw new Error(
    'No se encontró ninguna de estas columnas: ' +
    nombresPosibles.join(', ')
  );
}


/**
 * Convierte yyyy-MM-dd a una fecha local.
 */
function convertirFechaRecepcion_(
  texto
) {
  const partes =
    texto.split('-');

  if (partes.length !== 3) {
    throw new Error(
      'La fecha de recepción no es válida.'
    );
  }

  const anio =
    Number(partes[0]);

  const mes =
    Number(partes[1]);

  const dia =
    Number(partes[2]);

  if (
    !anio ||
    !mes ||
    !dia
  ) {
    throw new Error(
      'La fecha de recepción no es válida.'
    );
  }

  return new Date(
    anio,
    mes - 1,
    dia,
    12,
    0,
    0
  );
}


/**
 * Genera un ID único de recepción.
 */
function generarIdRecepcion_() {
  const fecha =
    Utilities.formatDate(
      new Date(),
      Session.getScriptTimeZone(),
      'yyyyMMdd-HHmmss'
    );

  const sufijo =
    Utilities
      .getUuid()
      .substring(0, 4)
      .toUpperCase();

  return (
    'REC-' +
    fecha +
    '-' +
    sufijo
  );
}


/**
 * Genera un ID único de evento.
 */
function generarIdEvento_() {
  return (
    'EVT-' +
    Utilities
      .getUuid()
      .substring(0, 8)
      .toUpperCase()
  );
}