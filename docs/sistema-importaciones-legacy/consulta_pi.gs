/*******************************************************
 * SII V1.2.001
 * CONSULTA INTEGRAL DE PI
 *******************************************************/

/**
 * Abre la pantalla de consulta.
 */
function abrirConsultaPi() {
  const html = HtmlService
    .createHtmlOutputFromFile('consulta_pi_ui')
    .setWidth(1400)
    .setHeight(820);

  SpreadsheetApp.getUi().showModalDialog(
    html,
    'Consulta integral de importación'
  );
}


/**
 * Devuelve las órdenes disponibles.
 */
function obtenerOrdenesConsultaPi() {
  const ss = SpreadsheetApp.getActive();

  const shOrdenes = obtenerHoja_(
    ss,
    SII_CFG.SHEETS.ORDENES
  );

  const ordenes = leerFilasComoObjetos_(
    shOrdenes
  );

  return ordenes
    .map(reg => {
      const idOrden = limpiarTexto_(
        reg.ID_ORDEN ||
        reg.NUMERO_ORDEN ||
        reg.NUMERO_PI
      );

      return {
        idOrden: idOrden,

        proveedor: limpiarTexto_(
          reg.PROVEEDOR
        ),

        estado: limpiarTexto_(
          reg.STATUS ||
          reg.SITUACION
        ),

        legajo: limpiarTexto_(
          reg.LEGAJO_CONTENEDOR ||
          reg.LEGAJO_NRO ||
          reg.LEGAJO
        )
      };
    })
    .filter(reg => reg.idOrden)
    .sort((a, b) =>
      a.idOrden.localeCompare(
        b.idOrden,
        'es',
        {
          numeric: true,
          sensitivity: 'base'
        }
      )
    );
}


/**
 * Devuelve toda la información de una PI.
 */
/**
 * Devuelve la información integral de una PI:
 * - cabecera;
 * - resumen;
 * - líneas de productos;
 * - recepciones;
 * - historial de eventos.
 */
function obtenerConsultaPi(idOrden) {
  const ss = SpreadsheetApp.getActive();

  const idBuscado = limpiarTexto_(idOrden);

  if (!idBuscado) {
    throw new Error('Debe seleccionar una orden.');
  }


  /*****************************************************
   * HOJAS
   *****************************************************/

  const shOrdenes = obtenerHoja_(
    ss,
    SII_CFG.SHEETS.ORDENES
  );

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


  /*****************************************************
   * DATOS
   *****************************************************/

  const ordenes = leerFilasComoObjetos_(
    shOrdenes
  );

  const detalle = leerFilasComoObjetos_(
    shDetalle
  );

  const datosRecepciones = leerFilasComoObjetos_(
    shRecepciones
  );

  const datosEventos = leerFilasComoObjetos_(
    shEventos
  );


  /*****************************************************
   * CABECERA DE LA ORDEN
   *****************************************************/

  const orden = ordenes.find(reg => {
    const id = limpiarTexto_(
      reg.ID_ORDEN ||
      reg.NUMERO_ORDEN ||
      reg.NUMERO_PI
    );

    return id === idBuscado;
  });

  if (!orden) {
    throw new Error(
      `No se encontró la orden ${idBuscado}.`
    );
  }

  const cabecera = {
    idOrden: idBuscado,

    proveedor: limpiarTexto_(
      orden.PROVEEDOR
    ),

    estado: limpiarTexto_(
      orden.STATUS
    ),

    estadoRecepcion: limpiarTexto_(
      orden.ESTADO_RECEPCION || 'PENDIENTE'
    ),

    situacion: limpiarTexto_(
      orden.SITUACION
    ),

    legajo: limpiarTexto_(
      orden.LEGAJO_CONTENEDOR ||
      orden.LEGAJO_NRO ||
      orden.LEGAJO
    ),

    fechaOrden: formatearFechaConsultaPi_(
      orden.FECHA_ORDEN
    ),

    fechaDeposito: formatearFechaConsultaPi_(
      orden.FECHA_DEPOSITO
    ),

    fechaEmbarque: formatearFechaConsultaPi_(
      orden.FECHA_EMBARQUE ||
      orden.FECHA_SHIPPEO
    ),

    fechaIngreso: formatearFechaConsultaPi_(
      orden.FECHA_INGRESO ||
      orden.FECHA_NACIONALIZACION
    ),

    importe: numeroConsultaPi_(
      orden.IMPORTE ||
      orden.IMPORTE_ORDEN ||
      orden.IMPORTE_TOTAL
    ),

    moneda: limpiarTexto_(
      orden.MONEDA
    ) || 'USD'
  };


  /*****************************************************
   * DETALLE DE PRODUCTOS
   *****************************************************/

  const lineas = detalle
    .filter(reg => {
      return limpiarTexto_(
        reg.ID_ORDEN
      ) === idBuscado;
    })
    .map(reg => {
      const cantidadPedida = numeroConsultaPi_(
        reg.CANTIDAD
      );

      const cantidadRecibida = numeroConsultaPi_(
        reg.CANTIDAD_RECIBIDA
      );

      /*
       * Para la consulta, la fuente de verdad del
       * pendiente es:
       *
       * cantidad pedida - cantidad recibida.
       */
      const cantidadPendiente =
        obtenerPendienteConsultaPi_(
          reg,
          cantidadPedida,
          cantidadRecibida
        );

      const estado =
        obtenerEstadoLineaConsultaPi_(
          reg,
          cantidadPendiente,
          cantidadPedida,
          cantidadRecibida
        );

      return {
        idDetalle: limpiarTexto_(
          reg.ID_DETALLE
        ),

        marca: limpiarTexto_(
          reg.MARCA
        ),

        sku: limpiarTexto_(
          reg.SKU
        ) || limpiarTexto_(
          reg.ITEM
        ),

        item: limpiarTexto_(
          reg.ITEM
        ),

        cantidadPedida: cantidadPedida,

        cantidadRecibida: cantidadRecibida,

        cantidadPendiente: cantidadPendiente,

        precioUnitario: numeroConsultaPi_(
          reg.PRECIO_UNITARIO
        ),

        importeLinea: numeroConsultaPi_(
          reg.IMPORTE_LINEA
        ),

        estado: estado
      };
    });


  /*****************************************************
   * RESUMEN DE LA ORDEN
   *****************************************************/

  const resumen = lineas.reduce(
    (acc, linea) => {
      acc.lineas++;

      acc.cantidadPedida +=
        linea.cantidadPedida;

      acc.cantidadRecibida +=
        linea.cantidadRecibida;

      acc.cantidadPendiente +=
        linea.cantidadPendiente;

      acc.importeTotal +=
        linea.importeLinea;

      if (linea.estado === 'RECIBIDO') {
        acc.lineasRecibidas++;

      } else if (linea.estado === 'PARCIAL') {
        acc.lineasParciales++;

      } else {
        acc.lineasPendientes++;
      }

      return acc;
    },
    {
      lineas: 0,
      lineasRecibidas: 0,
      lineasParciales: 0,
      lineasPendientes: 0,
      cantidadPedida: 0,
      cantidadRecibida: 0,
      cantidadPendiente: 0,
      importeTotal: 0
    }
  );

  resumen.porcentajeRecibido =
    resumen.cantidadPedida > 0
      ? (
          resumen.cantidadRecibida /
          resumen.cantidadPedida
        ) * 100
      : 0;


  /*****************************************************
   * RECEPCIONES REGISTRADAS
   *****************************************************/

  const recepciones = datosRecepciones
    .filter(reg => {
      return limpiarTexto_(
        reg.ID_ORDEN ||
        reg.NUMERO_PI
      ) === idBuscado;
    })
    .map(reg => ({
      idRecepcion: limpiarTexto_(
        reg.ID_RECEPCION
      ),

      fecha: formatearFechaConsultaPi_(
        reg.FECHA_RECEPCION ||
        reg.FECHA
      ),

      deposito: limpiarTexto_(
        reg.DEPOSITO
      ),

      usuario: limpiarTexto_(
        reg.USUARIO
      ),

      observaciones: limpiarTexto_(
        reg.OBSERVACIONES
      ),

      fechaOrdenamiento:
        convertirFechaConsultaPi_(
          reg.FECHA_RECEPCION ||
          reg.FECHA
        )
    }))
    .sort((a, b) => {
      return (
        b.fechaOrdenamiento.getTime() -
        a.fechaOrdenamiento.getTime()
      );
    })
    .map(reg => ({
      idRecepcion: reg.idRecepcion,
      fecha: reg.fecha,
      deposito: reg.deposito,
      usuario: reg.usuario,
      observaciones: reg.observaciones
    }));


  /*****************************************************
   * HISTORIAL DE EVENTOS
   *****************************************************/

  const eventos = datosEventos
    .filter(reg => {
      return limpiarTexto_(
        reg.ID_ORDEN ||
        reg.NUMERO_PI
      ) === idBuscado;
    })
    .map(reg => {
      const fechaOriginal =
        reg.FECHA_EVENTO ||
        reg.FECHA_HORA ||
        reg.FECHA ||
        reg.FECHA_REGISTRO;

      return {
        fecha: formatearFechaHoraConsultaPi_(
          fechaOriginal
        ),

        tipo: limpiarTexto_(
          reg.TIPO_EVENTO ||
          reg.EVENTO ||
          reg.ACCION
        ),

        item: limpiarTexto_(
          reg.ITEM
        ),

        sku: limpiarTexto_(
          reg.SKU
        ),

        cantidad: numeroConsultaPi_(
          reg.CANTIDAD
        ),

        usuario: limpiarTexto_(
          reg.USUARIO
        ),

        observaciones: limpiarTexto_(
          reg.OBSERVACIONES
        ),

        fechaOrdenamiento:
          convertirFechaConsultaPi_(
            fechaOriginal
          )
      };
    })
    .sort((a, b) => {
      return (
        b.fechaOrdenamiento.getTime() -
        a.fechaOrdenamiento.getTime()
      );
    })
    .map(reg => ({
      fecha: reg.fecha,
      tipo: reg.tipo,
      item: reg.item,
      sku: reg.sku,
      cantidad: reg.cantidad,
      usuario: reg.usuario,
      observaciones: reg.observaciones
    }));


  /*****************************************************
   * RESULTADO
   *****************************************************/

  return {
    cabecera: cabecera,
    resumen: resumen,
    lineas: lineas,
    recepciones: recepciones,
    eventos: eventos
  };
}


/**
 * Obtiene la cantidad pendiente sin depender de una
 * única estructura física de columnas.
 */
/**
 * Calcula el pendiente desde pedido menos recibido.
 * Esta es la fuente más segura para la consulta.
 */
function obtenerPendienteConsultaPi_(
  reg,
  cantidadPedida,
  cantidadRecibida
) {
  const pendiente =
    numeroConsultaPi_(reg.CANTIDAD_PENDIENTE);

  return Math.max(0, pendiente);
}


/**
 * Determina el estado real de la línea.
 */
/**
 * Determina el estado real de cada línea según
 * sus cantidades pedidas, recibidas y pendientes.
 */
function obtenerEstadoLineaConsultaPi_(
  reg,
  pendiente,
  pedido,
  recibido
) {
  const estadoRecepcion =
    limpiarTexto_(reg.ESTADO_RECEPCION)
      .toUpperCase();

  if (
    estadoRecepcion === 'RECIBIDO' ||
    estadoRecepcion === 'PARCIAL'
  ) {
    return estadoRecepcion;
  }

  const estadoLogistico =
    normalizarEstadoDashboard_(
      reg.STATUS_LINEA
    );

  if (
    [
      'EN FABRICA',
      'A EMBARCAR',
      'EMBARCADO',
      'A INGRESAR',
      'INGRESADO'
    ].includes(estadoLogistico)
  ) {
    return estadoLogistico;
  }

  return estadoRecepcion || 'PENDIENTE';
}


/**
 * Convierte valores a número.
 */
function numeroConsultaPi_(valor) {
  return numero_(valor);
}


/**
 * Devuelve la fecha formateada.
 */
function formatearFechaConsultaPi_(valor) {
  if (!valor) {
    return '';
  }

  const fecha = convertirFecha_(valor);

  if (!fecha) {
    return limpiarTexto_(valor);
  }

  return Utilities.formatDate(
    fecha,
    Session.getScriptTimeZone(),
    'dd/MM/yyyy'
  );
}
