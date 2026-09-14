/**************************************************************
 * SII V5.0.004
 * MÓDULO: CENTRO DE COMPRAS
 * INTELIGENCIA POR PROVEEDOR
 *
 * Fuentes:
 * - PLAN_COMPRAS
 * - ORDENES
 * - DETALLE_IMPORTACIONES
 * - PRODUCTOS
 *
 * Cada fila representa un proveedor.
 * Si no existe proveedor, se genera una fila independiente por marca.
 **************************************************************/

const SII_CENTRO_COMPRAS_V5002 = {
  HOJA: 'CENTRO_COMPRAS',

  ENCABEZADOS: [
    'PRIORIDAD',
    'SEMAFORO',
    'FECHA_LIMITE',
    'DIAS_HASTA_ACTUAR',
    'PROVEEDOR',
    'MARCAS',
    'CANT_SKU',
    'SKU_CRITICOS',
    'SKU_URGENTES',
    'CANTIDAD_SUGERIDA',
    'IMPORTE_USD_ESTIMADO',
    'COBERTURA_MINIMA_MESES',
    'LEAD_TIME_PROMEDIO_DIAS',
    'PRIMER_QUIEBRE_DIAS',
    'ORDENES_ABIERTAS',
    'UNIDADES_EN_CAMINO',
    'PROXIMA_LLEGADA_DIAS',
    'RIESGO_MAXIMO',
    'ACCION',
    'RESPONSABLE',
    'ESTADO_GESTION',
    'OBSERVACIONES',
    'ULTIMA_ACTUALIZACION'
  ],

  ESTADOS_GESTION: [
    'PENDIENTE',
    'EN ANALISIS',
    'EN PROCESO',
    'FINALIZADO'
  ],

  ESTADOS_CERRADOS: [
    'RECIBIDO',
    'CERRADO',
    'CERRADA',
    'ANULADO',
    'ANULADA',
    'CANCELADO',
    'CANCELADA'
  ]
};


/**
 * Función principal.
 */
function actualizarCentroCompras() {
  const inicio = Date.now();
  const ss = SpreadsheetApp.getActive();

  const shPlan = ccObtenerHoja_(
    ss,
    SII_CFG.SHEETS.PLAN_COMPRAS
  );

  const shOrdenes = ccObtenerHoja_(
    ss,
    SII_CFG.SHEETS.ORDENES
  );

  const shDetalle = ccObtenerHoja_(
    ss,
    SII_CFG.SHEETS.DETALLE
  );

  const shProductos = ccObtenerHoja_(
    ss,
    SII_CFG.SHEETS.PRODUCTOS
  );

  let shCentro =
    ss.getSheetByName(
      SII_CENTRO_COMPRAS_V5002.HOJA
    );

  if (!shCentro) {
    shCentro = ss.insertSheet(
      SII_CENTRO_COMPRAS_V5002.HOJA
    );
  }

  const plan =
    ccLeerFilasComoObjetos_(shPlan);

  const ordenes =
    ccLeerFilasComoObjetos_(shOrdenes);

  const detalle =
    ccLeerFilasComoObjetos_(shDetalle);

  const productos =
    ccLeerFilasComoObjetos_(shProductos);

  const gestionAnterior =
    leerGestionAnteriorCentroV5002_(
      shCentro
    );

  const costoPorSku =
    construirCostoPorSkuV5002_(
      productos
    );

  const resumenOrdenes =
    construirResumenOrdenesProveedorV5002_(
      ordenes,
      detalle
    );

  const salida =
    generarCentroComprasV5002_(
      plan,
      gestionAnterior,
      costoPorSku,
      resumenOrdenes
    );

  escribirCentroComprasV5002_(
    shCentro,
    salida
  );

  aplicarFormatoCentroComprasV5002_(
    shCentro,
    salida.length
  );

  ss.toast(
    salida.length +
      ' filas procesadas.',
    'Centro de Compras V5.0.004',
    6
  );

  const duracion =
    Date.now() - inicio;

  Logger.log(
    'CENTRO_COMPRAS V5.0.004: ' +
      duracion +
      ' ms'
  );

  return {
    proveedores: salida.length,
    duracionMs: duracion
  };
}


/**
 * Genera una fila por proveedor.
 */
function generarCentroComprasV5002_(
  plan,
  gestionAnterior,
  costoPorSku,
  resumenOrdenes
) {
  const grupos = new Map();
  const fechaProceso = new Date();

  plan.forEach(reg => {
    const proveedorTexto =
      ccLimpiarTexto_(
        reg.PROVEEDOR
      );

    const proveedor =
      proveedorTexto ||
      'SIN PROVEEDOR ASIGNADO';

    const sinProveedor =
      normalizarCentroV5002_(
        proveedor
      ) ===
      'SIN PROVEEDOR ASIGNADO';

    const estadoCompra =
      normalizarCentroV5002_(
        reg.ESTADO_COMPRA
      );

    const accion =
      normalizarCentroV5002_(
        reg.ACCION
      );

    const riesgo =
      normalizarCentroV5002_(
        reg.RIESGO_RUPTURA
      );

    if (
      !requiereGestionCentroV5002_(
        estadoCompra,
        accion,
        riesgo
      )
    ) {
      return;
    }

    /*
     * Proveedores normales:
     * se mantiene una fila por proveedor.
     *
     * Sin proveedor asignado:
     * se genera una fila independiente por cada marca y el nombre
     * visible queda como "MARCA (Sin Proveedor)".
     */
    if (sinProveedor) {
      const marcas =
        ccObtenerMarcasCentroV5003_(
          reg.MARCA
        );

      marcas.forEach(marca => {
        const proveedorVisible =
          marca + ' (Sin Proveedor)';

        const claveGrupo =
          normalizarCentroV5002_(
            proveedorVisible
          );

        if (!grupos.has(claveGrupo)) {
          grupos.set(
            claveGrupo,
            crearGrupoProveedorV5002_(
              proveedorVisible,
              {
                sinProveedor: true,
                proveedorReal:
                  'SIN PROVEEDOR ASIGNADO',
                marcaUnica: marca,
                claveOrdenes: ''
              }
            )
          );
        }

        const grupo =
          grupos.get(claveGrupo);

        acumularLineaPlanV5002_(
          grupo,
          reg,
          estadoCompra,
          accion,
          riesgo,
          costoPorSku,
          fechaProceso,
          marca
        );
      });

      return;
    }

    /*
     * PLAN_COMPRAS puede contener varios proveedores
     * separados por " | ". Cada uno recibe su propia fila.
     */
    const proveedores =
      proveedor
        .split('|')
        .map(valor =>
          ccLimpiarTexto_(valor)
        )
        .filter(Boolean);

    proveedores.forEach(
      proveedorIndividual => {
        const claveProveedor =
          normalizarCentroV5002_(
            proveedorIndividual
          );

        if (!grupos.has(claveProveedor)) {
          grupos.set(
            claveProveedor,
            crearGrupoProveedorV5002_(
              proveedorIndividual,
              {
                sinProveedor: false,
                proveedorReal:
                  proveedorIndividual,
                marcaUnica: '',
                claveOrdenes:
                  claveProveedor
              }
            )
          );
        }

        const grupo =
          grupos.get(claveProveedor);

        acumularLineaPlanV5002_(
          grupo,
          reg,
          estadoCompra,
          accion,
          riesgo,
          costoPorSku,
          fechaProceso,
          ''
        );
      }
    );
  });

  const salida = [];

  grupos.forEach(
    (grupo, claveGrupo) => {
      const gestion =
        gestionAnterior.get(
          claveGrupo
        ) || {};

      const ordenesProveedor =
        grupo.claveOrdenes
          ? resumenOrdenes.get(
              grupo.claveOrdenes
            ) || {
              ordenesAbiertas: 0,
              unidadesEnCamino: 0,
              proximaLlegadaDias: ''
            }
          : {
              ordenesAbiertas: 0,
              unidadesEnCamino: 0,
              proximaLlegadaDias: ''
            };

      const prioridad =
        obtenerPrioridadCentroV5002_(
          grupo
        );

      const semaforo =
        obtenerSemaforoCentroV5002_(
          prioridad,
          grupo.diasHastaActuarMinimo
        );

      const accionGrupo =
        determinarAccionCentroV5002_(
          grupo
        );

      const leadTimePromedio =
        grupo.cantidadLeadTime > 0
          ? grupo.sumaLeadTime /
            grupo.cantidadLeadTime
          : '';

      salida.push([
        prioridad,
        semaforo,
        grupo.fechaLimite || '',
        grupo.diasHastaActuarMinimo === null
          ? ''
          : grupo.diasHastaActuarMinimo,
        grupo.proveedor,
        Array.from(grupo.marcas)
          .sort()
          .join(' | '),
        grupo.sku.size,
        grupo.skuCriticos,
        grupo.skuUrgentes,
        Math.ceil(
          grupo.cantidadSugerida
        ),
        grupo.importeUsdEstimado,
        grupo.coberturaMinima === null
          ? ''
          : grupo.coberturaMinima,
        leadTimePromedio,
        grupo.primerQuiebreDias === null
          ? ''
          : grupo.primerQuiebreDias,
        ordenesProveedor.ordenesAbiertas,
        ordenesProveedor.unidadesEnCamino,
        ordenesProveedor.proximaLlegadaDias,
        grupo.riesgoMaximo,
        accionGrupo,
        ccLimpiarTexto_(
          gestion.RESPONSABLE
        ),
        normalizarCentroV5002_(
          gestion.ESTADO_GESTION
        ) ||
          'PENDIENTE',
        ccLimpiarTexto_(
          gestion.OBSERVACIONES
        ) ||
          grupo.observaciones.join(
            '\n'
          ),
        fechaProceso
      ]);
    }
  );

  salida.sort((a, b) => {
    const prioridadA =
      prioridadOrdenCentroV5002_(
        a[0]
      );

    const prioridadB =
      prioridadOrdenCentroV5002_(
        b[0]
      );

    if (prioridadA !== prioridadB) {
      return prioridadA - prioridadB;
    }

    const diasA =
      numeroCentroNullableV5002_(
        a[3]
      );

    const diasB =
      numeroCentroNullableV5002_(
        b[3]
      );

    if (
      diasA !== null &&
      diasB !== null &&
      diasA !== diasB
    ) {
      return diasA - diasB;
    }

    return ccLimpiarTexto_(a[4])
      .localeCompare(
        ccLimpiarTexto_(b[4])
      );
  });

  return salida;
}


function crearGrupoProveedorV5002_(
  proveedor,
  opciones
) {
  const cfg = opciones || {};

  return {
    proveedor: proveedor,
    proveedorReal:
      ccLimpiarTexto_(
        cfg.proveedorReal
      ) || proveedor,
    sinProveedor:
      Boolean(cfg.sinProveedor),
    marcaUnica:
      ccLimpiarTexto_(
        cfg.marcaUnica
      ),
    claveOrdenes:
      ccLimpiarTexto_(
        cfg.claveOrdenes
      ),
    marcas: new Set(),
    sku: new Set(),
    skuCriticos: 0,
    skuUrgentes: 0,
    cantidadSugerida: 0,
    importeUsdEstimado: 0,
    coberturaMinima: null,
    sumaLeadTime: 0,
    cantidadLeadTime: 0,
    primerQuiebreDias: null,
    riesgoMaximo: 'BAJO',
    prioridadNumerica: 999,
    diasHastaActuarMinimo: null,
    fechaLimite: null,
    acciones: new Set(),
    observaciones: []
  };
}


function acumularLineaPlanV5002_(
  grupo,
  reg,
  estadoCompra,
  accion,
  riesgo,
  costoPorSku,
  fechaProceso,
  marcaForzada
) {
  const sku =
    ccLimpiarTexto_(reg.SKU);

  const skuClave =
    normalizarCentroV5002_(sku);

  const marca =
    ccLimpiarTexto_(
      marcaForzada || reg.MARCA
    );

  if (sku) {
    grupo.sku.add(sku);
  }

  if (marca) {
    grupo.marcas.add(marca);
  }

  const cantidadSugerida =
    ccNumero_(reg.CANTIDAD_SUGERIDA);

  grupo.cantidadSugerida +=
    cantidadSugerida;

  const costoUsd =
    costoPorSku.get(skuClave) || 0;

  grupo.importeUsdEstimado +=
    cantidadSugerida *
    costoUsd;

  const cobertura =
    numeroCentroNullableV5002_(
      reg.COBERTURA_PROYECTADA_MESES
    );

  if (
    cobertura !== null &&
    (
      grupo.coberturaMinima === null ||
      cobertura <
        grupo.coberturaMinima
    )
  ) {
    grupo.coberturaMinima =
      cobertura;
  }

  const leadTime =
    numeroCentroNullableV5002_(
      reg.LEAD_TIME_DIAS
    );

  if (
    leadTime !== null &&
    leadTime > 0
  ) {
    grupo.sumaLeadTime +=
      leadTime;

    grupo.cantidadLeadTime++;
  }

  const diasQuiebre =
    numeroCentroNullableV5002_(
      reg.DIAS_QUIEBRE_PROYECTADO
    );

  if (
    diasQuiebre !== null &&
    (
      grupo.primerQuiebreDias === null ||
      diasQuiebre <
        grupo.primerQuiebreDias
    )
  ) {
    grupo.primerQuiebreDias =
      diasQuiebre;
  }

  if (riesgo === 'CRITICO') {
    grupo.skuCriticos++;
  }

  if (
    estadoCompra.startsWith(
      'URGENTE'
    ) ||
    (
      accion === 'COMPRAR' &&
      riesgo === 'CRITICO'
    )
  ) {
    grupo.skuUrgentes++;
  }

  grupo.riesgoMaximo =
    obtenerRiesgoMaximoCentroV5002_(
      grupo.riesgoMaximo,
      riesgo
    );

  const prioridad =
    numeroCentroNullableV5002_(
      reg.PRIORIDAD
    );

  if (
    prioridad !== null &&
    prioridad <
      grupo.prioridadNumerica
  ) {
    grupo.prioridadNumerica =
      prioridad;
  }

  if (accion) {
    grupo.acciones.add(accion);
  }

  const diasHastaActuar =
    calcularDiasHastaActuarCentroV5002_(
      reg
    );

  if (
    grupo.diasHastaActuarMinimo === null ||
    diasHastaActuar <
      grupo.diasHastaActuarMinimo
  ) {
    grupo.diasHastaActuarMinimo =
      diasHastaActuar;
  }

  const fechaLimite =
    sumarDiasCentroV5002_(
      fechaProceso,
      diasHastaActuar
    );

  if (
    !grupo.fechaLimite ||
    fechaLimite <
      grupo.fechaLimite
  ) {
    grupo.fechaLimite =
      fechaLimite;
  }

  const motivo =
    ccLimpiarTexto_(reg.MOTIVO);

  if (
    motivo &&
    grupo.observaciones.length < 3
  ) {
    grupo.observaciones.push(
      sku
        ? sku + ': ' + motivo
        : motivo
    );
  }
}


/**
 * Devuelve las marcas individuales de una línea del plan.
 * Si la marca está vacía, conserva el registro bajo SIN MARCA.
 */
function ccObtenerMarcasCentroV5003_(valor) {
  const marcas = ccLimpiarTexto_(valor)
    .split('|')
    .map(marca =>
      ccLimpiarTexto_(marca)
    )
    .filter(Boolean);

  if (marcas.length === 0) {
    return ['SIN MARCA'];
  }

  const unicas = [];
  const claves = new Set();

  marcas.forEach(marca => {
    const clave =
      normalizarCentroV5002_(marca);

    if (!claves.has(clave)) {
      claves.add(clave);
      unicas.push(marca);
    }
  });

  return unicas;
}


/**
 * Resumen de órdenes por proveedor.
 */
function construirResumenOrdenesProveedorV5002_(
  ordenes,
  detalle
) {
  const proveedorPorOrden =
    new Map();

  const estadoPorOrden =
    new Map();

  ordenes.forEach(reg => {
    const idOrden =
      normalizarIdCentroV5002_(
        primerValorCentroV5002_(
          reg.ID_ORDEN,
          reg.NUMERO_ORDEN,
          reg.NUMERO_PI,
          reg.ORDEN,
          reg.PI
        )
      );

    const proveedor =
      ccLimpiarTexto_(reg.PROVEEDOR);

    const estado =
      normalizarCentroV5002_(
        primerValorCentroV5002_(
          reg.STATUS,
          reg.SITUACION
        )
      );

    if (!idOrden) return;

    proveedorPorOrden.set(
      idOrden,
      proveedor
    );

    estadoPorOrden.set(
      idOrden,
      estado
    );
  });

  const resumen =
    new Map();

  ordenes.forEach(reg => {
    const idOrden =
      normalizarIdCentroV5002_(
        primerValorCentroV5002_(
          reg.ID_ORDEN,
          reg.NUMERO_ORDEN,
          reg.NUMERO_PI,
          reg.ORDEN,
          reg.PI
        )
      );

    if (!idOrden) return;

    const proveedor =
      proveedorPorOrden.get(idOrden) ||
      'SIN PROVEEDOR ASIGNADO';

    const claveProveedor =
      normalizarCentroV5002_(
        proveedor
      );

    const estado =
      estadoPorOrden.get(idOrden) ||
      '';

    if (
      SII_CENTRO_COMPRAS_V5002
        .ESTADOS_CERRADOS
        .includes(estado)
    ) {
      return;
    }

    const r =
      obtenerResumenProveedorV5002_(
        resumen,
        claveProveedor
      );

    r.ordenes.add(idOrden);
  });

  detalle.forEach(reg => {
    const idOrden =
      normalizarIdCentroV5002_(
        primerValorCentroV5002_(
          reg.ID_ORDEN,
          reg.NUMERO_ORDEN,
          reg.NUMERO_PI,
          reg.ORDEN,
          reg.PI
        )
      );

    if (!idOrden) return;

    const proveedor =
      proveedorPorOrden.get(idOrden) ||
      'SIN PROVEEDOR ASIGNADO';

    const claveProveedor =
      normalizarCentroV5002_(
        proveedor
      );

    const estado =
      normalizarCentroV5002_(
        reg.STATUS_LINEA
      );

    const cantidad =
      obtenerCantidadDetalleCentroV5002_(
        reg
      );

    const r =
      obtenerResumenProveedorV5002_(
        resumen,
        claveProveedor
      );

    if (
      estado &&
      !SII_CENTRO_COMPRAS_V5002
        .ESTADOS_CERRADOS
        .includes(estado)
    ) {
      r.unidadesEnCamino +=
        cantidad;
    }

    const llegada =
      estimarLlegadaCentroV5002_(
        estado
      );

    if (
      llegada !== null &&
      (
        r.proximaLlegadaDias === null ||
        llegada <
          r.proximaLlegadaDias
      )
    ) {
      r.proximaLlegadaDias =
        llegada;
    }
  });

  const salida = new Map();

  resumen.forEach(
    (r, clave) => {
      salida.set(
        clave,
        {
          ordenesAbiertas:
            r.ordenes.size,
          unidadesEnCamino:
            Math.round(
              r.unidadesEnCamino
            ),
          proximaLlegadaDias:
            r.proximaLlegadaDias === null
              ? ''
              : r.proximaLlegadaDias
        }
      );
    }
  );

  return salida;
}


function obtenerResumenProveedorV5002_(
  mapa,
  clave
) {
  if (!mapa.has(clave)) {
    mapa.set(
      clave,
      {
        ordenes: new Set(),
        unidadesEnCamino: 0,
        proximaLlegadaDias: null
      }
    );
  }

  return mapa.get(clave);
}


/**
 * Costo USD por SKU desde PRODUCTOS.
 */
function construirCostoPorSkuV5002_(
  productos
) {
  const mapa = new Map();

  productos.forEach(reg => {
    const sku =
      normalizarCentroV5002_(
        reg.SKU
      );

    if (!sku) return;

    const costo =
      ccNumero_(
        primerValorCentroV5002_(
          reg.COSTO_USD,
          reg['COSTO USD'],
          reg.COSTO,
          reg.PRECIO_USD,
          reg['PRECIO USD']
        )
      );

    mapa.set(
      sku,
      costo
    );
  });

  return mapa;
}


/**
 * Conserva RESPONSABLE, ESTADO_GESTION y OBSERVACIONES.
 */
function leerGestionAnteriorCentroV5002_(
  sh
) {
  const mapa = new Map();

  if (
    sh.getLastRow() < 2 ||
    sh.getLastColumn() < 5
  ) {
    return mapa;
  }

  ccLeerFilasComoObjetos_(sh)
    .forEach(reg => {
      const proveedor =
        normalizarCentroV5002_(
          reg.PROVEEDOR
        );

      if (!proveedor) return;

      mapa.set(
        proveedor,
        {
          RESPONSABLE:
            ccLimpiarTexto_(
              reg.RESPONSABLE
            ),

          ESTADO_GESTION:
            ccLimpiarTexto_(
              reg.ESTADO_GESTION
            ),

          OBSERVACIONES:
            ccLimpiarTexto_(
              reg.OBSERVACIONES
            )
        }
      );
    });

  return mapa;
}


function escribirCentroComprasV5002_(
  sh,
  salida
) {
  const columnas =
    SII_CENTRO_COMPRAS_V5002
      .ENCABEZADOS.length;

  quitarFiltroCentroV5002_(sh);

  const filasNecesarias =
    Math.max(
      salida.length + 1,
      2
    );

  if (
    sh.getMaxRows() <
    filasNecesarias
  ) {
    sh.insertRowsAfter(
      sh.getMaxRows(),
      filasNecesarias -
        sh.getMaxRows()
    );
  }

  if (
    sh.getMaxColumns() <
    columnas
  ) {
    sh.insertColumnsAfter(
      sh.getMaxColumns(),
      columnas -
        sh.getMaxColumns()
    );
  }

  const filasLimpiar =
    Math.max(
      sh.getLastRow(),
      salida.length + 1
    );

  sh.getRange(
    1,
    1,
    filasLimpiar,
    columnas
  ).clearContent();

  sh.getRange(
    1,
    1,
    1,
    columnas
  ).setValues([
    SII_CENTRO_COMPRAS_V5002
      .ENCABEZADOS
  ]);

  if (salida.length > 0) {
    sh.getRange(
      2,
      1,
      salida.length,
      columnas
    ).setValues(salida);

    sh.getRange(
      1,
      1,
      salida.length + 1,
      columnas
    ).createFilter();
  }
}


function aplicarFormatoCentroComprasV5002_(
  sh,
  cantidadFilas
) {
  /*
   * Formato liviano y estable.
   * Evita lecturas/escrituras masivas adicionales sobre la hoja.
   */
  ccFormatearEncabezado_(sh);
  sh.setFrozenRows(1);

  if (cantidadFilas <= 0) {
    return;
  }

  /*
   * Fechas.
   */
  sh.getRange(
    2, 3,
    cantidadFilas, 1
  ).setNumberFormat(
    'dd/MM/yyyy'
  );

  sh.getRange(
    2, 15,
    cantidadFilas, 2
  ).setNumberFormat(
    'dd/MM/yyyy'
  );

  sh.getRange(
    2, 22,
    cantidadFilas, 1
  ).setNumberFormat(
    'dd/MM/yyyy HH:mm'
  );

  /*
   * Cantidades e importes.
   */
  sh.getRange(
    2, 6,
    cantidadFilas, 4
  ).setNumberFormat(
    '#,##0'
  );

  sh.getRange(
    2, 10,
    cantidadFilas, 1
  ).setNumberFormat(
    '$ #,##0.00'
  );

  sh.getRange(
    2, 11,
    cantidadFilas, 1
  ).setNumberFormat(
    '#,##0'
  );

  sh.getRange(
    2, 12,
    cantidadFilas, 2
  ).setNumberFormat(
    '0.00'
  );

  sh.getRange(
    2, 14,
    cantidadFilas, 1
  ).setNumberFormat(
    '#,##0'
  );

  /*
   * Validación de estado de gestión.
   */
  const validacion =
    SpreadsheetApp
      .newDataValidation()
      .requireValueInList(
        SII_CENTRO_COMPRAS_V5002
          .ESTADOS_GESTION,
        true
      )
      .setAllowInvalid(false)
      .build();

  sh.getRange(
    2, 21,
    cantidadFilas, 1
  ).setDataValidation(
    validacion
  );
}
function obtenerEstiloCentroV5002_(
  valor,
  mapa
) {
  const estilo =
    mapa[valor];

  if (!estilo) {
    return {
      fondo: '#FFFFFF',
      fuente: '#000000'
    };
  }

  return {
    fondo: estilo[0],
    fuente: estilo[1]
  };
}

function reglaTextoCentroV5002_(
  rango,
  texto,
  fondo,
  fuente
) {
  return SpreadsheetApp
    .newConditionalFormatRule()
    .whenTextEqualTo(texto)
    .setBackground(fondo)
    .setFontColor(fuente)
    .setBold(true)
    .setRanges([rango])
    .build();
}


function requiereGestionCentroV5002_(
  estado,
  accion,
  riesgo
) {
  if (
    estado === 'INACTIVO' ||
    accion === 'OK' ||
    accion === 'SIN ACCION'
  ) {
    return false;
  }

  return (
    estado.startsWith('URGENTE') ||
    estado.startsWith('REVISAR') ||
    estado === 'COMPRAR' ||
    accion === 'COMPRAR' ||
    accion.startsWith('REVISAR') ||
    riesgo === 'CRITICO' ||
    riesgo === 'ALTO'
  );
}


function calcularDiasHastaActuarCentroV5002_(
  reg
) {
  const diasQuiebre =
    numeroCentroNullableV5002_(
      reg.DIAS_QUIEBRE_PROYECTADO
    );

  const leadTime =
    numeroCentroNullableV5002_(
      reg.LEAD_TIME_DIAS
    );

  if (
    diasQuiebre !== null &&
    leadTime !== null
  ) {
    return Math.max(
      0,
      Math.floor(
        diasQuiebre -
        leadTime
      )
    );
  }

  const estado =
    normalizarCentroV5002_(
      reg.ESTADO_COMPRA
    );

  if (estado.startsWith('URGENTE')) {
    return 0;
  }

  const prioridad =
    numeroCentroNullableV5002_(
      reg.PRIORIDAD
    );

  if (prioridad !== null) {
    if (prioridad <= 20) return 0;
    if (prioridad <= 50) return 7;
    if (prioridad <= 70) return 30;
  }

  return 60;
}


function obtenerPrioridadCentroV5002_(
  grupo
) {
  if (
    grupo.skuCriticos > 0 ||
    grupo.skuUrgentes > 0 ||
    grupo.prioridadNumerica <= 20
  ) {
    return 'P1';
  }

  if (
    grupo.riesgoMaximo === 'ALTO' ||
    grupo.prioridadNumerica <= 50
  ) {
    return 'P2';
  }

  if (
    grupo.cantidadSugerida > 0 ||
    grupo.prioridadNumerica <= 70
  ) {
    return 'P3';
  }

  return 'P4';
}


function obtenerSemaforoCentroV5002_(
  prioridad,
  diasHastaActuar
) {
  if (
    prioridad === 'P1' ||
    diasHastaActuar === 0
  ) {
    return 'COMPRAR HOY';
  }

  if (
    prioridad === 'P2' ||
    (
      diasHastaActuar !== null &&
      diasHastaActuar <= 7
    )
  ) {
    return 'COMPRAR ESTA SEMANA';
  }

  if (
    diasHastaActuar !== null &&
    diasHastaActuar <= 30
  ) {
    return 'COMPRAR ESTE MES';
  }

  return 'PROGRAMAR';
}


function determinarAccionCentroV5002_(
  grupo
) {
  if (
    grupo.skuCriticos > 0 ||
    grupo.skuUrgentes > 0
  ) {
    return grupo.sinProveedor
        ? 'SELECCIONAR PROVEEDOR Y EMITIR PI'
        : 'ANALIZAR Y EMITIR PI';
  }

  if (
    grupo.acciones.has(
      'COMPRAR'
    )
  ) {
    return grupo.sinProveedor
        ? 'SELECCIONAR PROVEEDOR'
        : 'PREPARAR COMPRA';
  }

  return 'REVISAR';
}


function obtenerRiesgoMaximoCentroV5002_(
  actual,
  nuevo
) {
  const orden = {
    'INACTIVO': 0,
    'SIN CONSUMO': 1,
    'BAJO': 2,
    'MEDIO': 3,
    'ALTO': 4,
    'CRITICO': 5
  };

  return (
    (orden[nuevo] || 0) >
    (orden[actual] || 0)
  )
    ? nuevo
    : actual;
}


function estimarLlegadaCentroV5002_(
  estado
) {
  const mapa = {
    'A INGRESAR': 10,
    'EMBARCADO': 60,
    'A EMBARCAR': 90,
    'EN FABRICA': 120
  };

  return Object.prototype
    .hasOwnProperty
    .call(mapa, estado)
      ? mapa[estado]
      : null;
}


function obtenerCantidadDetalleCentroV5002_(
  reg
) {
  const cantidad =
    numeroCentroNullableV5002_(
      reg.CANTIDAD_PENDIENTE
    );

  return (
    cantidad !== null &&
    cantidad > 0
  )
    ? cantidad
    : 0;
}


function prioridadOrdenCentroV5002_(
  prioridad
) {
  const mapa = {
    P1: 1,
    P2: 2,
    P3: 3,
    P4: 4
  };

  return mapa[
    normalizarCentroV5002_(
      prioridad
    )
  ] || 99;
}


function numeroCentroNullableV5002_(
  valor
) {
  if (
    valor === null ||
    valor === undefined ||
    ccLimpiarTexto_(valor) === ''
  ) {
    return null;
  }

  const resultado =
    ccNumero_(valor);

  return Number.isFinite(resultado)
    ? resultado
    : null;
}


function sumarDiasCentroV5002_(
  fecha,
  dias
) {
  const salida =
    new Date(fecha);

  salida.setHours(
    0, 0, 0, 0
  );

  salida.setDate(
    salida.getDate() +
    Math.max(
      0,
      Number(dias) || 0
    )
  );

  return salida;
}


function normalizarCentroV5002_(
  valor
) {
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


function normalizarIdCentroV5002_(
  valor
) {
  return normalizarCentroV5002_(
    valor
  ).replace(/[^A-Z0-9]/g, '');
}


function primerValorCentroV5002_() {
  for (
    let i = 0;
    i < arguments.length;
    i++
  ) {
    const valor =
      arguments[i];

    if (
      valor !== null &&
      valor !== undefined &&
      ccLimpiarTexto_(valor) !== ''
    ) {
      return valor;
    }
  }

  return '';
}


function quitarFiltroCentroV5002_(
  sh
) {
  const filtro =
    sh.getFilter();

  if (filtro) {
    filtro.remove();
  }
}


/**************************************************************
 * FUNCIONES AUXILIARES LOCALES
 *
 * Estas funciones hacen que CENTRO_COMPRAS no dependa
 * de motor.js ni de otros módulos para su ejecución.
 **************************************************************/

function ccObtenerHoja_(ss, nombre) {
  const sh = ss.getSheetByName(nombre);

  if (!sh) {
    throw new Error(
      'No existe la hoja "' +
      nombre +
      '".'
    );
  }

  return sh;
}


function ccLeerFilasComoObjetos_(sh) {
  const datos =
    sh.getDataRange().getValues();

  if (datos.length < 2) {
    return [];
  }

  const encabezados =
    datos[0].map(
      valor =>
        ccNormalizarEncabezado_(
          valor
        )
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
      const objeto = {};

      encabezados.forEach(
        (encabezado, indice) => {
          if (encabezado) {
            objeto[encabezado] =
              fila[indice];
          }
        }
      );

      return objeto;
    });
}


function ccNormalizarEncabezado_(valor) {
  return ccLimpiarTexto_(valor)
    .normalize('NFD')
    .replace(
      /[\u0300-\u036f]/g,
      ''
    )
    .toUpperCase()
    .replace(/\s+/g, '_');
}


function ccLimpiarTexto_(valor) {
  return String(
    valor === null ||
    valor === undefined
      ? ''
      : valor
  ).trim();
}


function ccNumero_(valor) {
  if (typeof valor === 'number') {
    return Number.isFinite(valor)
      ? valor
      : 0;
  }

  let texto =
    ccLimpiarTexto_(valor);

  if (!texto) return 0;

  texto =
    texto.replace(
      /[^\d,.-]/g,
      ''
    );

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

  const resultado =
    Number(texto);

  return Number.isFinite(resultado)
    ? resultado
    : 0;
}


function ccPrimerValorNoVacio_() {
  for (
    let i = 0;
    i < arguments.length;
    i++
  ) {
    const valor =
      arguments[i];

    if (
      valor !== null &&
      valor !== undefined &&
      ccLimpiarTexto_(valor) !== ''
    ) {
      return valor;
    }
  }

  return '';
}


function ccFormatearEncabezado_(sh) {
  const ultimaColumna =
    sh.getLastColumn();

  if (ultimaColumna <= 0) {
    return;
  }

  const colorEncabezado =
    (
      typeof SII_CFG !== 'undefined' &&
      SII_CFG.COLOR_ENCABEZADO
    )
      ? SII_CFG.COLOR_ENCABEZADO
      : '#1F4E78';

  const colorTexto =
    (
      typeof SII_CFG !== 'undefined' &&
      SII_CFG.COLOR_TEXTO_ENCABEZADO
    )
      ? SII_CFG.COLOR_TEXTO_ENCABEZADO
      : '#FFFFFF';

  sh.getRange(
    1,
    1,
    1,
    ultimaColumna
  )
    .setBackground(
      colorEncabezado
    )
    .setFontColor(
      colorTexto
    )
    .setFontWeight('bold')
    .setHorizontalAlignment(
      'center'
    )
    .setVerticalAlignment(
      'middle'
    )
    .setWrap(true);
}
