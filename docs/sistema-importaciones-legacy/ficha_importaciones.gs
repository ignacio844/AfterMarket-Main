/*******************************************************
 * SII V5.9.005
 * MÓDULO: IMPORTACIONES DE LA FICHA INTEGRAL DEL SKU
 *
 * Separa cantidades pendientes por estado:
 * - EN FABRICA
 * - A EMBARCAR
 * - EMBARCADO
 * - A INGRESAR
 *
 * Parámetros leídos desde PARAMETROS:
 * - DIAS_A_INGRESAR
 * - DIAS_EMBARCADO
 * - DIAS_A_EMBARCAR
 * - DIAS_EN_FABRICA
 *
 * Las fechas reales tienen prioridad sobre los días
 * parametrizados.
 *******************************************************/


/**
 * Devuelve el resumen completo de importaciones.
 */
function obtenerResumenImportacionesFichaSku_(
  detalle,
  ordenes,
  equivalencias,
  parametros,
  claveSku,
  filaPlan
) {
  const mapaOrdenes =
    construirMapaOrdenesFichaSku_(
      ordenes
    );

  const mapaSkuPorItem =
    construirMapaEquivalenciasFichaSku_(
      equivalencias
    );

  const diasEstado =
    obtenerDiasEstadosImportacionFichaSku_(
      parametros
    );

  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);

  const diasQuiebre =
    numeroNullableImportacionFichaSku_(
      filaPlan.DIAS_QUIEBRE_PROYECTADO
    );

  const fechaQuiebre =
    diasQuiebre === null
      ? null
      : sumarDiasImportacionFichaSku_(
          hoy,
          diasQuiebre
        );

  const resumen = {
    cantidadOrdenes: 0,
    ordenesConPendiente: 0,

    cantidadPedida: 0,
    cantidadRecibida: 0,
    cantidadPendiente: 0,

    enFabrica: 0,
    aEmbarcar: 0,
    embarcado: 0,
    aIngresar: 0,
    otrosEstados: 0,

    llegaAntesQuiebre: 0,
    llegaDespuesQuiebre: 0,
    sinFechaEstimada: 0,

    primeraLlegadaEstimada: '',
    ultimaLlegadaEstimada: '',
    fechaQuiebre: fechaQuiebre
      ? formatearFechaImportacionFichaSku_(
          fechaQuiebre
        )
      : '',

    diasParametros: diasEstado,
    lineas: []
  };

  const ordenesUnicas =
    new Set();

  const ordenesPendientes =
    new Set();

  let primeraFecha = null;
  let ultimaFecha = null;

  detalle.forEach(reg => {
    const item =
      limpiarTexto_(
        primerValorImportacionFichaSku_(
          reg.ITEM,
          reg.ITEM_PROVEEDOR,
          reg.CODIGO_PROVEEDOR
        )
      );

    const claveItem =
      normalizarClaveFichaSku_(
        item
      );

    const skuDirecto =
      limpiarTexto_(
        reg.SKU
      );

    const claveSkuDirecto =
      normalizarClaveFichaSku_(
        skuDirecto
      );

    const claveSkuResuelto =
      claveSkuDirecto ||
      mapaSkuPorItem.get(
        claveItem
      ) ||
      claveItem;

    if (
      claveSkuResuelto !== claveSku
    ) {
      return;
    }

    const idOrden =
      limpiarTexto_(
        primerValorImportacionFichaSku_(
          reg.ID_ORDEN,
          reg.NUMERO_ORDEN,
          reg.NUMERO_PI,
          reg.ORDEN,
          reg.PI
        )
      );

    const cabecera =
      mapaOrdenes.get(
        normalizarClaveFichaSku_(
          idOrden
        )
      ) || {};

    const cantidadPedida =
      numero_(reg.CANTIDAD);

    const cantidadRecibida =
      numero_(reg.CANTIDAD_RECIBIDA);

    const cantidadPendiente =
      numero_(reg.CANTIDAD_PENDIENTE);

    const estado =
      normalizarEstadoImportacionFichaSku_(
        reg.STATUS_LINEA
      );

    const fechaReal =
      obtenerFechaRealImportacionFichaSku_(
        reg,
        cabecera,
        estado
      );

    const fechaBase =
      fechaReal ||
      estimarFechaPorEstadoFichaSku_(
        hoy,
        estado,
        diasEstado
      );

    /*
     * La fecha disponible incorpora el tiempo
     * operativo de recepción parametrizado.
     */
    const fechaEstimada =
      fechaBase
        ? sumarDiasImportacionFichaSku_(
            fechaBase,
            diasEstado.bufferRecepcion
          )
        : null;

    const origenFecha =
      fechaReal
        ? (
            diasEstado.bufferRecepcion > 0
              ? 'FECHA REAL + BUFFER'
              : 'FECHA REAL'
          )
        : (
            fechaEstimada
              ? (
                  diasEstado.bufferRecepcion > 0
                    ? 'PARAMETRO + BUFFER'
                    : 'PARAMETRO'
                )
              : ''
          );

    if (cantidadPendiente > 0) {
      acumularEstadoImportacionFichaSku_(
        resumen,
        estado,
        cantidadPendiente
      );

      if (fechaEstimada) {
        if (
          !primeraFecha ||
          fechaEstimada < primeraFecha
        ) {
          primeraFecha =
            fechaEstimada;
        }

        if (
          !ultimaFecha ||
          fechaEstimada > ultimaFecha
        ) {
          ultimaFecha =
            fechaEstimada;
        }

        if (fechaQuiebre) {
          if (
            fechaEstimada <= fechaQuiebre
          ) {
            resumen.llegaAntesQuiebre +=
              cantidadPendiente;
          } else {
            resumen.llegaDespuesQuiebre +=
              cantidadPendiente;
          }
        }
      } else {
        resumen.sinFechaEstimada +=
          cantidadPendiente;
      }

      if (idOrden) {
        ordenesPendientes.add(
          idOrden
        );
      }
    }

    if (idOrden) {
      ordenesUnicas.add(
        idOrden
      );
    }

    resumen.cantidadPedida +=
      cantidadPedida;

    resumen.cantidadRecibida +=
      cantidadRecibida;

    resumen.cantidadPendiente +=
      cantidadPendiente;

    resumen.lineas.push({
      idDetalle:
        limpiarTexto_(
          reg.ID_DETALLE
        ),

      idOrden: idOrden,

      proveedor:
        limpiarTexto_(
          cabecera.proveedor
        ) ||
        limpiarTexto_(
          filaPlan.PROVEEDOR
        ),

      item: item,

      sku:
        skuDirecto ||
        limpiarTexto_(
          filaPlan.SKU
        ),

      marca:
        limpiarTexto_(
          reg.MARCA
        ) ||
        limpiarTexto_(
          filaPlan.MARCA
        ),

      cantidadPedida:
        cantidadPedida,

      cantidadRecibida:
        cantidadRecibida,

      cantidadPendiente:
        cantidadPendiente,

      estado: estado,

      legajo:
        limpiarTexto_(
          primerValorImportacionFichaSku_(
            reg.LEGAJO_CONTENEDOR,
            reg.LEGAJO_NRO,
            reg.LEGAJO,
            cabecera.legajo
          )
        ),

      fechaOrden:
        formatearFechaFichaSku_(
          primerValorImportacionFichaSku_(
            reg.FECHA_ORDEN,
            cabecera.fechaOrdenRaw
          )
        ),

      fechaEmbarque:
        formatearFechaFichaSku_(
          primerValorImportacionFichaSku_(
            reg.FECHA_EMBARQUE,
            reg.FECHA_SHIPPEO,
            cabecera.fechaEmbarqueRaw
          )
        ),

      fechaIngreso:
        formatearFechaFichaSku_(
          primerValorImportacionFichaSku_(
            reg.FECHA_INGRESO,
            reg.FECHA_NACIONALIZACION,
            reg.FECHA_DE_NACIONALIZACION,
            cabecera.fechaIngresoRaw
          )
        ),

      fechaEstimada:
        fechaEstimada
          ? formatearFechaImportacionFichaSku_(
              fechaEstimada
            )
          : '',

      origenFecha:
        origenFecha,

      diasEstimados:
        fechaEstimada
          ? diferenciaDiasImportacionFichaSku_(
              hoy,
              fechaEstimada
            )
          : '',

      llegaAntesQuiebre:
        fechaQuiebre &&
        fechaEstimada
          ? fechaEstimada <=
            fechaQuiebre
          : null,

      precioUnitario:
        numero_(
          reg.PRECIO_UNITARIO
        ),

      importeLinea:
        numero_(
          reg.IMPORTE_LINEA
        )
    });
  });

  resumen.cantidadOrdenes =
    ordenesUnicas.size;

  resumen.ordenesConPendiente =
    ordenesPendientes.size;

  resumen.primeraLlegadaEstimada =
    primeraFecha
      ? formatearFechaImportacionFichaSku_(
          primeraFecha
        )
      : '';

  resumen.ultimaLlegadaEstimada =
    ultimaFecha
      ? formatearFechaImportacionFichaSku_(
          ultimaFecha
        )
      : '';

  resumen.lineas.sort((a, b) => {
    const ordenEstado =
      ordenEstadoImportacionFichaSku_(
        a.estado
      ) -
      ordenEstadoImportacionFichaSku_(
        b.estado
      );

    if (ordenEstado !== 0) {
      return ordenEstado;
    }

    if (
      a.diasEstimados !==
      b.diasEstimados
    ) {
      return numeroOrdenImportacionFichaSku_(
        a.diasEstimados
      ) -
      numeroOrdenImportacionFichaSku_(
        b.diasEstimados
      );
    }

    return a.idOrden.localeCompare(
      b.idOrden,
      'es',
      {
        numeric: true,
        sensitivity: 'base'
      }
    );
  });

  return resumen;
}


/**
 * Construye ID de orden → datos de cabecera.
 */
function construirMapaOrdenesFichaSku_(
  ordenes
) {
  const mapa = new Map();

  ordenes.forEach(reg => {
    const idOrden =
      limpiarTexto_(
        primerValorImportacionFichaSku_(
          reg.ID_ORDEN,
          reg.NUMERO_ORDEN,
          reg.NUMERO_PI,
          reg.ORDEN,
          reg.PI
        )
      );

    if (!idOrden) return;

    mapa.set(
      normalizarClaveFichaSku_(
        idOrden
      ),
      {
        proveedor:
          limpiarTexto_(
            reg.PROVEEDOR
          ),

        estado:
          limpiarTexto_(reg.STATUS),

        situacion:
          limpiarTexto_(
            reg.SITUACION
          ),

        legajo:
          limpiarTexto_(
            primerValorImportacionFichaSku_(
              reg.LEGAJO_CONTENEDOR,
              reg.LEGAJO_NRO,
              reg.LEGAJO
            )
          ),

        fechaOrdenRaw:
          primerValorImportacionFichaSku_(
            reg.FECHA_ORDEN,
            reg.FECHA_AUTORIZADA
          ),

        fechaEmbarqueRaw:
          primerValorImportacionFichaSku_(
            reg.FECHA_EMBARQUE,
            reg.FECHA_SHIPPEO
          ),

        fechaIngresoRaw:
          primerValorImportacionFichaSku_(
            reg.FECHA_INGRESO,
            reg.FECHA_NACIONALIZACION,
            reg.FECHA_DE_NACIONALIZACION,
            reg.ETA
          )
      }
    );
  });

  return mapa;
}


/**
 * Construye ITEM → SKU desde EQUIVALENCIAS_SKU.
 */
function construirMapaEquivalenciasFichaSku_(
  equivalencias
) {
  const mapa = new Map();

  equivalencias.forEach(reg => {
    const item =
      normalizarClaveFichaSku_(
        primerValorImportacionFichaSku_(
          reg.ITEM,
          reg.ITEM_PROVEEDOR,
          reg.CODIGO_PROVEEDOR,
          reg.CODIGO_ITEM
        )
      );

    const sku =
      normalizarClaveFichaSku_(
        primerValorImportacionFichaSku_(
          reg.SKU,
          reg.SKU_BAM,
          reg.CODIGO_BAM
        )
      );

    if (item && sku) {
      mapa.set(item, sku);
    }
  });

  return mapa;
}


/**
 * Lee los días configurables desde PARAMETROS.
 */
function obtenerDiasEstadosImportacionFichaSku_(
  parametros
) {
  const valores = {
    aIngresar: 10,
    embarcado: 45,
    aEmbarcar: 90,
    enFabrica: 120,
    bufferRecepcion: 0
  };

  parametros.forEach(reg => {
    const clave =
      normalizarParametroImportacionFichaSku_(
        primerValorImportacionFichaSku_(
          reg.CLAVE,
          reg.PARAMETRO,
          reg.NOMBRE,
          reg.CODIGO
        )
      );

    const valor =
      numeroNullableImportacionFichaSku_(
        primerValorImportacionFichaSku_(
          reg.VALOR,
          reg.VALUE,
          reg.DIAS
        )
      );

    if (
      valor === null ||
      valor < 0
    ) {
      return;
    }

    if (clave === 'DIAS_A_INGRESAR') {
      valores.aIngresar = valor;

    } else if (
      clave === 'DIAS_EMBARCADO'
    ) {
      valores.embarcado = valor;

    } else if (
      clave === 'DIAS_A_EMBARCAR'
    ) {
      valores.aEmbarcar = valor;

    } else if (
      clave === 'DIAS_EN_FABRICA'
    ) {
      valores.enFabrica = valor;

    } else if (
      clave === 'BUFFER_RECEPCION' ||
      clave === 'DIAS_BUFFER_RECEPCION'
    ) {
      valores.bufferRecepcion =
        valor;
    }
  });

  return valores;
}


/**
 * Obtiene una fecha real según el estado.
 */
function obtenerFechaRealImportacionFichaSku_(
  reg,
  cabecera,
  estado
) {
  let valor = '';

  if (estado === 'A INGRESAR') {
    valor =
      primerValorImportacionFichaSku_(
        reg.FECHA_INGRESO,
        reg.FECHA_NACIONALIZACION,
        reg.FECHA_DE_NACIONALIZACION,
        reg.ETA,
        cabecera.fechaIngresoRaw
      );

  } else if (
    estado === 'EMBARCADO'
  ) {
    valor =
      primerValorImportacionFichaSku_(
        reg.ETA,
        reg.FECHA_INGRESO,
        reg.FECHA_NACIONALIZACION,
        reg.FECHA_DE_NACIONALIZACION,
        cabecera.fechaIngresoRaw
      );

  } else if (
    estado === 'A EMBARCAR'
  ) {
    valor =
      primerValorImportacionFichaSku_(
        reg.FECHA_EMBARQUE_ESTIMADA,
        reg.ETD,
        reg.FECHA_SHIPPEO,
        cabecera.fechaEmbarqueRaw
      );

  } else if (
    estado === 'EN FABRICA'
  ) {
    valor =
      primerValorImportacionFichaSku_(
        reg.FECHA_EMBARQUE_ESTIMADA,
        reg.FECHA_PRODUCCION,
        reg.ETD
      );
  }

  return convertirFechaImportacionFichaSku_(
    valor
  );
}


/**
 * Estima fecha usando días parametrizados.
 */
function estimarFechaPorEstadoFichaSku_(
  hoy,
  estado,
  diasEstado
) {
  if (estado === 'A INGRESAR') {
    return sumarDiasImportacionFichaSku_(
      hoy,
      diasEstado.aIngresar
    );
  }

  if (estado === 'EMBARCADO') {
    return sumarDiasImportacionFichaSku_(
      hoy,
      diasEstado.embarcado
    );
  }

  if (estado === 'A EMBARCAR') {
    return sumarDiasImportacionFichaSku_(
      hoy,
      diasEstado.aEmbarcar
    );
  }

  if (estado === 'EN FABRICA') {
    return sumarDiasImportacionFichaSku_(
      hoy,
      diasEstado.enFabrica
    );
  }

  return null;
}


function acumularEstadoImportacionFichaSku_(
  resumen,
  estado,
  cantidad
) {
  if (estado === 'EN FABRICA') {
    resumen.enFabrica += cantidad;

  } else if (
    estado === 'A EMBARCAR'
  ) {
    resumen.aEmbarcar += cantidad;

  } else if (
    estado === 'EMBARCADO'
  ) {
    resumen.embarcado += cantidad;

  } else if (
    estado === 'A INGRESAR'
  ) {
    resumen.aIngresar += cantidad;

  } else {
    resumen.otrosEstados += cantidad;
  }
}


function normalizarEstadoImportacionFichaSku_(
  valor
) {
  const texto =
    limpiarTexto_(valor)
      .normalize('NFD')
      .replace(
        /[\u0300-\u036f]/g,
        ''
      )
      .toUpperCase()
      .replace(/_/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

  if (
    texto.includes('FABRICA')
  ) {
    return 'EN FABRICA';
  }

  if (
    texto.includes('A EMBARCAR') ||
    texto.includes('POR EMBARCAR')
  ) {
    return 'A EMBARCAR';
  }

  if (
    texto.includes('EMBARCADO')
  ) {
    return 'EMBARCADO';
  }

  if (
    texto.includes('A INGRESAR') ||
    texto.includes('NACIONALIZ')
  ) {
    return 'A INGRESAR';
  }

  if (
    texto.includes('INGRESADO')
  ) {
    return 'INGRESADO';
  }

  return texto;
}


function ordenEstadoImportacionFichaSku_(
  estado
) {
  const orden = {
    'A INGRESAR': 1,
    'EMBARCADO': 2,
    'A EMBARCAR': 3,
    'EN FABRICA': 4,
    'INGRESADO': 5
  };

  return orden[estado] || 8;
}


function normalizarParametroImportacionFichaSku_(
  valor
) {
  return limpiarTexto_(valor)
    .normalize('NFD')
    .replace(
      /[\u0300-\u036f]/g,
      ''
    )
    .toUpperCase()
    .replace(/\s+/g, '_')
    .trim();
}


function numeroNullableImportacionFichaSku_(
  valor
) {
  if (
    valor === null ||
    valor === undefined ||
    limpiarTexto_(valor) === ''
  ) {
    return null;
  }

  const resultado =
    numero_(valor);

  return Number.isFinite(resultado)
    ? resultado
    : null;
}


function numeroOrdenImportacionFichaSku_(
  valor
) {
  const numero =
    numeroNullableImportacionFichaSku_(
      valor
    );

  return numero === null
    ? Number.MAX_SAFE_INTEGER
    : numero;
}


function primerValorImportacionFichaSku_() {
  for (
    let i = 0;
    i < arguments.length;
    i++
  ) {
    const valor = arguments[i];

    if (
      valor !== null &&
      valor !== undefined &&
      limpiarTexto_(valor) !== ''
    ) {
      return valor;
    }
  }

  return '';
}


function convertirFechaImportacionFichaSku_(
  valor
) {
  if (!valor) return null;

  if (
    valor instanceof Date &&
    !isNaN(valor.getTime())
  ) {
    const fecha =
      new Date(valor);

    fecha.setHours(0, 0, 0, 0);
    return fecha;
  }

  if (
    typeof convertirFecha_ ===
    'function'
  ) {
    const fecha =
      convertirFecha_(valor);

    if (fecha) {
      const copia =
        new Date(fecha);

      copia.setHours(0, 0, 0, 0);
      return copia;
    }
  }

  const texto =
    limpiarTexto_(valor);

  const partes =
    texto.match(
      /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/
    );

  if (partes) {
    const fecha =
      new Date(
        Number(partes[3]),
        Number(partes[2]) - 1,
        Number(partes[1])
      );

    fecha.setHours(0, 0, 0, 0);

    return isNaN(fecha.getTime())
      ? null
      : fecha;
  }

  const fecha =
    new Date(texto);

  if (isNaN(fecha.getTime())) {
    return null;
  }

  fecha.setHours(0, 0, 0, 0);
  return fecha;
}


function sumarDiasImportacionFichaSku_(
  fecha,
  dias
) {
  const resultado =
    new Date(fecha);

  resultado.setDate(
    resultado.getDate() +
    Number(dias || 0)
  );

  resultado.setHours(0, 0, 0, 0);

  return resultado;
}


function diferenciaDiasImportacionFichaSku_(
  desde,
  hasta
) {
  const msDia =
    24 * 60 * 60 * 1000;

  return Math.round(
    (
      hasta.getTime() -
      desde.getTime()
    ) / msDia
  );
}


function formatearFechaImportacionFichaSku_(
  fecha
) {
  return Utilities.formatDate(
    fecha,
    Session.getScriptTimeZone(),
    'dd/MM/yyyy'
  );
}
