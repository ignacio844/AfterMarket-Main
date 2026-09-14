/**************************************************************
 * SISTEMA SEGUIMIENTO IMPORTACIONES
 * MÓDULO: PLAN DE COMPRAS V4.4.001
 *
 * Genera PLAN_COMPRAS utilizando:
 * - PRODUCTOS
 * - MARCAS
 * - STOCK
 * - VENTAS
 * - DETALLE_IMPORTACIONES
 * - EQUIVALENCIAS_SKU
 *
 * Particularidades de DETALLE_IMPORTACIONES:
 * - Puede tener SKU vacío.
 * - En ese caso se busca el SKU mediante ITEM.
 * - El estado logístico se toma de STATUS_LINEA.
 * - La cantidad pendiente se toma de CANTIDAD_PENDIENTE.
 **************************************************************/


/**
 * Función principal.
 */
function actualizarPlanCompras() {
  const medicionTotal =
    iniciarMedicionCompras_(
      'TOTAL PLAN DE COMPRAS'
    );

  let medicion;
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  /*
   * Parámetros configurables desde PARAMETROS_COMPRAS.
   */
  const parametrosCompras = cargarParametrosCompras_();
  const parametrosImportacion =
    leerParametrosImportacion_();
  const generalesCompras = parametrosCompras.generales;

  const shStock = obtenerHoja_(
    ss,
    SII_CFG.SHEETS.STOCK
  );

  const shVentas = obtenerHoja_(
    ss,
    SII_CFG.SHEETS.VENTAS
  );

  const shDetalle = obtenerHoja_(
    ss,
    SII_CFG.SHEETS.DETALLE
  );

  const shOrdenes = obtenerHoja_(
    ss,
    SII_CFG.SHEETS.ORDENES
  );

  const shProductos = obtenerHoja_(
    ss,
    SII_CFG.SHEETS.PRODUCTOS
  );

  const shMarcas = obtenerHoja_(
    ss,
    SII_CFG.SHEETS.MARCAS
  );

  const shEquivalencias = obtenerHoja_(
    ss,
    SII_CFG.SHEETS.EQUIVALENCIAS_SKU
  );

  const shPlan = obtenerHoja_(
    ss,
    SII_CFG.SHEETS.PLAN_COMPRAS
  );


  /************************************************************
   * LECTURA DE DATOS
   ************************************************************/

 medicion = iniciarMedicionCompras_(
    'Leer STOCK'
  );

  const stock =
    leerFilasComoObjetos_(shStock);

  finalizarMedicionCompras_(medicion);


  medicion = iniciarMedicionCompras_(
    'Leer VENTAS'
  );

  const ventas =
    leerFilasComoObjetos_(shVentas);

  finalizarMedicionCompras_(medicion);


  medicion = iniciarMedicionCompras_(
    'Leer DETALLE'
  );

  const detalle =
    leerFilasComoObjetos_(shDetalle);

  finalizarMedicionCompras_(medicion);


  medicion = iniciarMedicionCompras_(
    'Leer ORDENES'
  );

  const ordenes =
    leerFilasComoObjetos_(shOrdenes);

  finalizarMedicionCompras_(medicion);


  medicion = iniciarMedicionCompras_(
    'Leer PRODUCTOS'
  );

  const productos =
    leerFilasComoObjetos_(shProductos);

  finalizarMedicionCompras_(medicion);


  medicion = iniciarMedicionCompras_(
    'Leer MARCAS'
  );

  const marcas =
    leerFilasComoObjetos_(shMarcas);

  finalizarMedicionCompras_(medicion);


  medicion = iniciarMedicionCompras_(
    'Leer EQUIVALENCIAS'
  );

  const equivalencias =
    leerFilasComoObjetos_(
      shEquivalencias
    );

  finalizarMedicionCompras_(medicion);


  /************************************************************
   * PRODUCTOS POR SKU
   ************************************************************/

  const productoPorSku = new Map();

  productos.forEach(reg => {
    const sku = normalizarClave_(reg.SKU);

    if (!sku) return;

    productoPorSku.set(sku, {
      skuOriginal: limpiarTexto_(reg.SKU),
      marca: limpiarTexto_(reg.MARCA),
      proveedor: limpiarTexto_(reg.PROVEEDOR),
      descripcion: limpiarTexto_(reg.DESCRIPCION)
    });
  });


  /************************************************************
   * OBJETIVO DE COBERTURA POR MARCA
   ************************************************************/

  const objetivoPorMarca = new Map();

  marcas.forEach(reg => {
    const marca = normalizarClave_(reg.MARCA);

    if (!marca) return;

    const objetivo =
      numero_(reg.OBJETIVO_STOCK_MESES) ||
      numero_(reg.OBJETIVO_MESES) ||
      4;

    objetivoPorMarca.set(
      marca,
      objetivo
    );
  });


  /************************************************************
   * EQUIVALENCIAS ITEM → SKU
   ************************************************************/

  const skuPorProveedorItem =
    new Map();

  const skuUnicoPorItem =
    new Map();

  const itemsAmbiguos =
    new Set();

  const marcaPorProveedorItem =
    new Map();

  const marcaEquivalenciaPorSku =
    new Map();

  equivalencias.forEach(reg => {
    const item =
      normalizarClave_(
        primerValorNoVacio_(
          reg.ITEM,
          reg.CODIGO_PROVEEDOR,
          reg.CODIGO_ORIGEN,
          reg.ITEM_PROVEEDOR,
          reg.CODIGO_ITEM
        )
      );

    const sku =
      normalizarClave_(
        primerValorNoVacio_(
          reg.SKU,
          reg.SKU_BAM,
          reg.CODIGO_BAM,
          reg.CODIGO_INTERNO
        )
      );

    const proveedor =
      limpiarTexto_(
        reg.PROVEEDOR
      );

    const marcaEquivalencia =
      limpiarTexto_(
        reg.MARCA
      );

    if (!item || !sku) return;

    const claveProveedorItem =
      construirClaveProveedorItemV43_(
        proveedor,
        item
      );

    skuPorProveedorItem.set(
      claveProveedorItem,
      sku
    );

    if (
      skuUnicoPorItem.has(item) &&
      skuUnicoPorItem.get(item) !== sku
    ) {
      itemsAmbiguos.add(item);
      skuUnicoPorItem.delete(item);

    } else if (
      !itemsAmbiguos.has(item)
    ) {
      skuUnicoPorItem.set(
        item,
        sku
      );
    }

    if (marcaEquivalencia) {
      marcaPorProveedorItem.set(
        claveProveedorItem,
        marcaEquivalencia
      );

      marcaEquivalenciaPorSku.set(
        sku,
        marcaEquivalencia
      );
    }
  });


  /************************************************************
 * TEXTO ORIGINAL DE LOS SKU
 ************************************************************/

const textoSkuPorClave = new Map();

function guardarTextoSku_(valor) {
  const texto = limpiarTexto_(valor);
  const clave = normalizarClave_(texto);

  if (
    clave &&
    !textoSkuPorClave.has(clave)
  ) {
    textoSkuPorClave.set(
      clave,
      texto
    );
  }
}

productos.forEach(reg => {
  guardarTextoSku_(
    primerValorNoVacio_(
      reg.SKU,
      reg.COD_BAM,
      reg.Cod_BAM
    )
  );
});

stock.forEach(reg => {
  guardarTextoSku_(
    primerValorNoVacio_(
      reg.SKU,
      reg.COD_BAM,
      reg.Cod_BAM
    )
  );
});

ventas.forEach(reg => {
  guardarTextoSku_(
    primerValorNoVacio_(
      reg.Cod_BAM,
      reg.COD_BAM,
      reg.SKU,
      reg.Código,
      reg.CODIGO
    )
  );
});

equivalencias.forEach(reg => {
  guardarTextoSku_(
    primerValorNoVacio_(
      reg.SKU,
      reg.SKU_BAM,
      reg.CODIGO_BAM,
      reg.COD_BAM,
      reg.Cod_BAM,
      reg.CODIGO_INTERNO
    )
  );
});

detalle.forEach(reg => {
  guardarTextoSku_(
    primerValorNoVacio_(
      reg.SKU,
      reg.SKU_BAM,
      reg.CODIGO_BAM,
      reg.COD_BAM,
      reg.Cod_BAM
    )
  );
});


  /************************************************************
   * STOCK POR SKU Y DEPÓSITO
   *
   * Se mantiene también el total por SKU para que la cobertura
   * y la cantidad sugerida se calculen sobre todo el stock
   * disponible de la empresa.
   ************************************************************/

  const stockPorSku = new Map();
  const marcaStockPorSku = new Map();

  function obtenerStockSku_(sku) {
    if (!stockPorSku.has(sku)) {
      stockPorSku.set(sku, {
        warnes: 0,
        escobar: 0,
        otros: 0,
        total: 0
      });
    }

    return stockPorSku.get(sku);
  }

  stock.forEach(reg => {
    const sku = normalizarClave_(reg.SKU);

    if (!sku) return;

    const cantidadStock = numero_(
      primerValorNoVacio_(
        reg.STOCK,
        reg.STOCK_DISPONIBLE,
        reg.CANTIDAD
      )
    );

    const deposito = normalizarDepositoPlanCompras_(
      primerValorNoVacio_(
        reg.DEPOSITO,
        reg.ALMACEN,
        reg.SUCURSAL
      )
    );

    const resumenStock = obtenerStockSku_(sku);

    resumenStock.total += cantidadStock;

    if (deposito === 'WARNES') {
      resumenStock.warnes += cantidadStock;

    } else if (deposito === 'ESCOBAR') {
      resumenStock.escobar += cantidadStock;

    } else {
      resumenStock.otros += cantidadStock;
    }

    const marca = limpiarTexto_(reg.MARCA);

    if (
      marca &&
      !marcaStockPorSku.has(sku)
    ) {
      marcaStockPorSku.set(
        sku,
        marca
      );
    }
  });


/************************************************************
 * CONSUMO POR SKU - ÚLTIMOS 12 MESES
 ************************************************************/

const consumoPorSku = new Map();

const columnasMesesVentas = [
  'AGO_2025',
  'SEP_2025',
  'OCT_2025',
  'NOV_2025',
  'DIC_2025',
  'ENE_2026',
  'FEB_2026',
  'MAR_2026',
  'ABR_2026',
  'MAY_2026',
  'JUN_2026',
  'JUL_2026'
];

/**
 * Convierte las unidades de VENTAS.
 *
 * Ejemplos:
 * "324"      -> 324
 * "1,064.00" -> 1064
 * 618        -> 618
 */
function numeroVentas_(valor) {
  if (
    valor === null ||
    valor === undefined ||
    valor === ''
  ) {
    return 0;
  }

  if (typeof valor === 'number') {
    return Number.isFinite(valor)
      ? valor
      : 0;
  }

  const texto = String(valor)
    .trim()
    .replace(/\s/g, '')
    .replace(/,/g, '');

  const resultado = Number(texto);

  return Number.isFinite(resultado)
    ? resultado
    : 0;
}

ventas.forEach(reg => {
  const sku = normalizarClave_(
    primerValorNoVacio_(
      reg.COD_BAM,
      reg.SKU,
      reg.CODIGO
    )
  );

  if (!sku) return;

  let consumoFila = 0;

  columnasMesesVentas.forEach(nombreColumna => {
    consumoFila += numeroVentas_(
      reg[nombreColumna]
    );
  });

  /*
   * Puede haber más de una fila para el mismo SKU.
   * En ese caso se acumula y no se reemplaza.
   */
  const consumoAnterior =
    consumoPorSku.get(sku) || {
      consumoTotal: 0,
      meses: 12,
      promedioMensual: 0
    };

  const consumoTotal =
    consumoAnterior.consumoTotal +
    consumoFila;

  consumoPorSku.set(sku, {
    consumoTotal: consumoTotal,
    meses: 12,
    promedioMensual:
      consumoTotal / 12
  });
});


 /************************************************************
 * PROVEEDOR POR ORDEN
 ************************************************************/

const proveedorPorOrden = new Map();

ordenes.forEach(reg => {
  const idOrden =
    normalizarIdOrdenProveedor_(
      reg.ID_ORDEN
    );

  const proveedor =
    limpiarTexto_(
      reg.PROVEEDOR
    );

  if (
    idOrden &&
    proveedor
  ) {
    proveedorPorOrden.set(
      idOrden,
      proveedor
    );
  }
});

  /************************************************************
   * IMPORTACIONES PENDIENTES POR SKU
   ************************************************************/

  const pendientesPorSku = new Map();
  const marcaDetallePorSku = new Map();

  /*
   * Un mismo SKU puede aparecer en órdenes de distintos
   * proveedores. Por eso se acumulan proveedores en un Set.
   */
  const proveedoresDetallePorSku = new Map();

  function obtenerPendientesSku_(sku) {
    if (!pendientesPorSku.has(sku)) {
      pendientesPorSku.set(sku, {
        enFabrica: 0,
        aEmbarcar: 0,
        embarcado: 0,
        aIngresar: 0
      });
    }

    return pendientesPorSku.get(sku);
  }


  detalle.forEach(reg => {
    const skuDirecto =
      normalizarClave_(reg.SKU);

    const item =
      normalizarClave_(
        primerValorNoVacio_(
          reg.ITEM,
          reg.ITEM_PROVEEDOR,
          reg.CODIGO_PROVEEDOR,
          reg.CODIGO_ITEM
        )
      );

    /*
     * Prioridad:
     * 1. SKU informado en DETALLE_IMPORTACIONES.
     * 2. SKU obtenido mediante ITEM y EQUIVALENCIAS_SKU.
     */
    /*
    * Prioridad:
    * 1. SKU informado directamente en DETALLE_IMPORTACIONES.
    * 2. SKU definido en EQUIVALENCIAS_SKU.
    * 3. Si no hay equivalencia, se asume ITEM = SKU.
    */
    const idOrdenDetalle =
      normalizarIdOrdenProveedor_(
        primerValorNoVacio_(
          reg.ID_ORDEN,
          reg.NUMERO_ORDEN,
          reg.NUMERO_PI,
          reg.ORDEN,
          reg.PI
        )
      );

    /*
     * El proveedor siempre se obtiene de la orden concreta.
     * No se utiliza PRODUCTOS ni MARCAS como respaldo porque
     * un mismo SKU puede cambiar de proveedor con el tiempo.
     */
    const proveedorDetalle =
      limpiarTexto_(
        proveedorPorOrden.get(
          idOrdenDetalle
        )
      );

    const claveProveedorItem =
      construirClaveProveedorItemV43_(
        proveedorDetalle,
        item
      );

    const sku =
      skuDirecto ||
      skuPorProveedorItem.get(
        claveProveedorItem
      ) ||
      skuUnicoPorItem.get(item) ||
      item ||
      '';

    if (!sku) return;

    if (proveedorDetalle) {
      if (
        !proveedoresDetallePorSku.has(sku)
      ) {
        proveedoresDetallePorSku.set(
          sku,
          new Set()
        );
      }

      proveedoresDetallePorSku
        .get(sku)
        .add(proveedorDetalle);
    }
    /**********************************************************
     * ESTADO LOGÍSTICO
     * Fuente canónica: STATUS_LINEA.
     **********************************************************/

    const estado = obtenerEstadoDetalle_(reg);

    if (!estado) return;


    /**********************************************************
     * CANTIDAD PENDIENTE
     * Fuente canónica: CANTIDAD_PENDIENTE.
     **********************************************************/

    const cantidad =
      obtenerCantidadPendienteDetalle_(reg);

    if (cantidad <= 0) return;


    const pendientes =
      obtenerPendientesSku_(sku);

    switch (estado) {
      case 'EN FABRICA':
        pendientes.enFabrica += cantidad;
        break;

      case 'A EMBARCAR':
        pendientes.aEmbarcar += cantidad;
        break;

      case 'EMBARCADO':
        pendientes.embarcado += cantidad;
        break;

      case 'A INGRESAR':
        pendientes.aIngresar += cantidad;
        break;
    }


    const marca =
      limpiarTexto_(reg.MARCA) ||
      limpiarTexto_(
        marcaPorProveedorItem.get(
          claveProveedorItem
        )
      ) ||
      limpiarTexto_(
        marcaEquivalenciaPorSku.get(sku)
      );

    if (
      marca &&
      !marcaDetallePorSku.has(sku)
    ) {
      marcaDetallePorSku.set(
        sku,
        marca
      );
    }
  });


  /************************************************************
   * UNIÓN DE TODOS LOS SKU
   ************************************************************/

  const todosLosSku = new Set();

  productoPorSku.forEach(
    (valor, sku) => todosLosSku.add(sku)
  );

  stockPorSku.forEach(
    (valor, sku) => todosLosSku.add(sku)
  );

  consumoPorSku.forEach(
    (valor, sku) => todosLosSku.add(sku)
  );

  pendientesPorSku.forEach(
    (valor, sku) => todosLosSku.add(sku)
  );


  /************************************************************
   * GENERACIÓN DE PLAN_COMPRAS
   ************************************************************/

  const fechaActualizacion = new Date();

  medicion = iniciarMedicionCompras_(
      'Generar filas PLAN_COMPRAS'
    );

  const salida = [...todosLosSku]
    .map(sku => {
      const producto =
        productoPorSku.get(sku) || {};

      const consumo =
        consumoPorSku.get(sku) || {
          consumoTotal: 0,
          meses: 0,
          promedioMensual: 0
        };

      const pendientes =
        pendientesPorSku.get(sku) || {
          enFabrica: 0,
          aEmbarcar: 0,
          embarcado: 0,
          aIngresar: 0
        };


      /********************************************************
       * DATOS MAESTROS
       ********************************************************/

      const marca =
        limpiarTexto_(
          producto.marca
        ) ||
        limpiarTexto_(
          marcaStockPorSku.get(sku)
        ) ||
        limpiarTexto_(
          marcaDetallePorSku.get(sku)
        ) ||
        limpiarTexto_(
          marcaEquivalenciaPorSku.get(sku)
        );

      const proveedoresSku =
        proveedoresDetallePorSku.get(sku);

      /*
       * PROVEEDOR representa exclusivamente los proveedores
       * asociados a las órdenes pendientes del SKU.
       * Si hay más de uno, se muestran separados por " | ".
       */
      const proveedor =
        proveedoresSku
          ? Array.from(proveedoresSku)
              .sort((a, b) =>
                limpiarTexto_(a).localeCompare(
                  limpiarTexto_(b)
                )
              )
              .join(' | ')
          : '';

      /********************************************************
       * STOCK Y PENDIENTES
       ********************************************************/

      const resumenStock =
        stockPorSku.get(sku) || {
          warnes: 0,
          escobar: 0,
          otros: 0,
          total: 0
        };

      const stockWarnes =
        resumenStock.warnes || 0;

      const stockEscobar =
        resumenStock.escobar || 0;

      const stockOtros =
        resumenStock.otros || 0;

      const stockDisponible =
        resumenStock.total || 0;

      const pendienteRecibir =
        pendientes.enFabrica +
        pendientes.aEmbarcar +
        pendientes.embarcado +
        pendientes.aIngresar;


      /********************************************************
       * CONSUMO
       ********************************************************/

      const promedioMensual =
        consumo.promedioMensual > 0
          ? consumo.promedioMensual
          : (
              consumo.meses > 0
                ? consumo.consumoTotal /
                  consumo.meses
                : 0
            );

      const esInactivo = esSkuInactivo_(
        stockDisponible,
        pendienteRecibir,
        consumo.consumoTotal
      );

      const resultadoMRP =
        esInactivo
          ? {
              estadoDemanda: 'INACTIVO',
              leadTimeDias: '',
              consumoDiario: 0,
              ventasLeadTime: 0,
              stockProyectado: 0,
              pendienteQueLlegaATiempo: 0,
              pendienteQueLlegaTarde: 0,
              primeraLlegadaEstimadaDias: '',
              diasQuiebreFisico: '',
              diasQuiebreProyectado: '',
              riesgoRuptura: 'INACTIVO',
              huboRupturaAntesDeRecepcion: false,
              detalleRecepciones: [],
              motivoMRP:
                'Producto sin stock, sin consumo y sin importaciones pendientes. ' +
                'Se excluye del plan operativo.'
            }
          : calcularMRPPorSku_(
          {
            marca: marca,

            stockTotal:
              stockDisponible,

            consumoTotal:
              consumo.consumoTotal,

            meses:
              consumo.meses,

            promedioMensual:
              promedioMensual,

            pendientes: {
              enFabrica:
                pendientes.enFabrica,

              aEmbarcar:
                pendientes.aEmbarcar,

              embarcado:
                pendientes.embarcado,

              aIngresar:
                pendientes.aIngresar
            }
          },
          parametrosImportacion
        );

      /********************************************************
       * COBERTURA
       ********************************************************/

      const coberturaActual =
        promedioMensual > 0
          ? stockDisponible /
            promedioMensual
          : '';

      const coberturaProyectada =
        promedioMensual > 0
          ? (
              stockDisponible +
              pendienteRecibir
            ) / promedioMensual
          : '';


      /********************************************************
       * OBJETIVO
       ********************************************************/

      const objetivoMeses =
        obtenerCoberturaObjetivoCompras_(
          marca,
          parametrosCompras
        );


      /********************************************************
       * CANTIDAD SUGERIDA
       ********************************************************/

      const cantidadSugerida =
        promedioMensual > 0
          ? Math.max(
              0,
              Math.ceil(
                promedioMensual *
                objetivoMeses -
                stockDisponible -
                pendienteRecibir
              )
            )
          : 0;


      /********************************************************
       * PLANIFICACIÓN INTELIGENTE
       *
       * La compra se calcula con consumo y stock TOTAL.
       * La distribución 85/15 se aplica únicamente al stock
       * físico disponible entre Escobar y Warnes.
       ********************************************************/

      const stockObjetivoTotal =
        promedioMensual > 0
          ? Math.ceil(
              promedioMensual * objetivoMeses
            )
          : 0;

      const porcentajeEscobar =
        generalesCompras.porcentajeEscobar / 100;

      const porcentajeWarnes =
        generalesCompras.porcentajeWarnes / 100;

      const stockDistribuible =
        stockEscobar + stockWarnes;

      const objetivoStockEscobar =
        Math.round(
          stockDistribuible * porcentajeEscobar
        );

      const objetivoStockWarnes =
        stockDistribuible - objetivoStockEscobar;

      let transferenciaSugerida = 0;
      let origenTransferencia = '';
      let destinoTransferencia = '';

      if (stockDistribuible > 0) {
        if (stockWarnes > objetivoStockWarnes) {
          transferenciaSugerida = Math.floor(
            stockWarnes - objetivoStockWarnes
          );
          origenTransferencia = 'WARNES';
          destinoTransferencia = 'ESCOBAR';

        } else if (stockWarnes < objetivoStockWarnes) {
          transferenciaSugerida = Math.floor(
            Math.min(
              objetivoStockWarnes - stockWarnes,
              stockEscobar
            )
          );
          origenTransferencia = 'ESCOBAR';
          destinoTransferencia = 'WARNES';
        }
      }

      const decisionCompra =
        determinarDecisionCompraV21_(
          {
            consumoTotal: consumo.consumoTotal,
            meses: consumo.meses,
            promedioMensual: promedioMensual,
            stockTotal: stockDisponible,
            pendienteRecibir: pendienteRecibir,
            coberturaActual: coberturaActual,
            coberturaProyectada: coberturaProyectada,
            objetivoMeses: objetivoMeses,
            cantidadSugerida: cantidadSugerida,
            transferenciaSugerida: transferenciaSugerida,
            origenTransferencia: origenTransferencia,
            destinoTransferencia: destinoTransferencia
          },
          generalesCompras
        );

      /********************************************************
       * ESTADO DE COMPRA
       ********************************************************/

      const estadoCompra =
        decisionCompra.estadoCompra;

      const filaPlan = [
        textoSkuPorClave.get(sku) || sku,
        marca,
        proveedor,
        stockWarnes,
        stockEscobar,
        stockOtros,
        stockDisponible,
        pendientes.enFabrica,
        pendientes.aEmbarcar,
        pendientes.embarcado,
        pendientes.aIngresar,
        pendienteRecibir,
        consumo.consumoTotal,
        consumo.meses,
        promedioMensual,
        coberturaActual,
        coberturaProyectada,
        objetivoMeses,
        stockObjetivoTotal,
        cantidadSugerida,
        resultadoMRP.leadTimeDias,
        resultadoMRP.consumoDiario,
        resultadoMRP.ventasLeadTime,
        resultadoMRP.stockProyectado,
        resultadoMRP.pendienteQueLlegaATiempo,
        resultadoMRP.pendienteQueLlegaTarde,
        resultadoMRP.primeraLlegadaEstimadaDias,
        resultadoMRP.diasQuiebreFisico,
        resultadoMRP.diasQuiebreProyectado,
        resultadoMRP.riesgoRuptura,
        resultadoMRP.motivoMRP,
        objetivoStockEscobar,
        objetivoStockWarnes,
        transferenciaSugerida,
        origenTransferencia,
        destinoTransferencia,
        estadoCompra,
        decisionCompra.accion,
        decisionCompra.motivo,
        decisionCompra.prioridad,
        fechaActualizacion
      ];

      return {
        inactivo: esInactivo,
        fila: filaPlan
      };
    })
    .sort((a, b) => {
      const marcaA =
        limpiarTexto_(a.fila[1]).toUpperCase();

      const marcaB =
        limpiarTexto_(b.fila[1]).toUpperCase();

      if (marcaA !== marcaB) {
        return marcaA.localeCompare(
          marcaB
        );
      }

      return limpiarTexto_(a.fila[0])
        .localeCompare(
          limpiarTexto_(b.fila[0])
        );
    });

  const salidaActivos = salida
    .filter(reg => !reg.inactivo)
    .map(reg => reg.fila);

  const salidaInactivos = salida
    .filter(reg => reg.inactivo)
    .map(reg => reg.fila);

  finalizarMedicionCompras_(medicion);

  medicion = iniciarMedicionCompras_(
    'Escribir PLAN_COMPRAS'
  );

  escribirPlanCompras_(
    shPlan,
    salidaActivos
  );

  let shInactivos =
    ss.getSheetByName('SKU_INACTIVOS');

  if (!shInactivos) {
    shInactivos =
      ss.insertSheet('SKU_INACTIVOS');
  }

  escribirPlanCompras_(
    shInactivos,
    salidaInactivos
  );

  finalizarMedicionCompras_(medicion);

  ss.toast(
    salidaActivos.length +
      ' SKU activos y ' +
      salidaInactivos.length +
      ' SKU inactivos procesados.',
    'Plan de compras',
    7
  );

  /*****************************************
   * DASHBOARD EJECUTIVO V4.5
   *****************************************/
  try {

    generarDashboard_();

  } catch (e) {

    Logger.log(
      'Error Dashboard: ' + e
    );

  }

  finalizarMedicionCompras_(
    medicionTotal
  );
}


/**
 * Obtiene el estado logístico de una línea de DETALLE_IMPORTACIONES.
 * La fuente canónica es STATUS_LINEA.
 */
function obtenerEstadoDetalle_(reg) {
  return valorEsEstadoImportacion_(reg.STATUS_LINEA)
    ? normalizarEstadoImportacion_(reg.STATUS_LINEA)
    : '';
}


/**
 * Obtiene la cantidad pendiente física de una línea.
 * La fuente canónica es CANTIDAD_PENDIENTE.
 */
function obtenerCantidadPendienteDetalle_(reg) {
  return esNumeroValido_(reg.CANTIDAD_PENDIENTE)
    ? Math.max(0, numero_(reg.CANTIDAD_PENDIENTE))
    : 0;
}


/**
 * Indica si un valor puede interpretarse como número.
 */
function esNumeroValido_(valor) {
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

  if (!texto) return false;

  /*
   * Evita interpretar los estados como cantidades.
   */
  if (
    valorEsEstadoImportacion_(texto)
  ) {
    return false;
  }

  const convertido =
    numero_(texto);

  return !isNaN(convertido);
}


/**
 * Determina si un texto corresponde a un estado
 * reconocido de importación.
 */
function valorEsEstadoImportacion_(valor) {
  const estado =
    normalizarEstadoImportacion_(valor);

  return [
    'EN FABRICA',
    'A EMBARCAR',
    'EMBARCADO',
    'A INGRESAR'
  ].includes(estado);
}


/**
 * Normaliza estados y acepta variantes.
 */
function normalizarEstadoImportacion_(valor) {
  const estado = limpiarTexto_(valor)
    .normalize('NFD')
    .replace(
      /[\u0300-\u036f]/g,
      ''
    )
    .toUpperCase()
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const equivalenciasEstado = {
    'EN FABRICA': 'EN FABRICA',
    'EN FABRICACION': 'EN FABRICA',
    'FABRICACION': 'EN FABRICA',

    'A EMBARCAR': 'A EMBARCAR',
    'PENDIENTE DE EMBARQUE': 'A EMBARCAR',
    'PENDIENTE EMBARQUE': 'A EMBARCAR',

    'EMBARCADO': 'EMBARCADO',
    'EMBARCADA': 'EMBARCADO',
    'EN TRANSITO': 'EMBARCADO',

    'A INGRESAR': 'A INGRESAR',
    'PENDIENTE DE INGRESO': 'A INGRESAR',
    'PENDIENTE INGRESO': 'A INGRESAR'
  };

  return equivalenciasEstado[estado] || estado;
}


/**
 * Normaliza el nombre del depósito informado en STOCK.
 */
function normalizarDepositoPlanCompras_(valor) {
  const deposito = limpiarTexto_(valor)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim();

  if (deposito.includes('WARNES')) {
    return 'WARNES';
  }

  if (deposito.includes('ESCOBAR')) {
    return 'ESCOBAR';
  }

  return deposito || 'SIN DEPOSITO';
}


/**
 * Determina el estado de reposición.
 */
function determinarEstadoCompra_(
  promedioMensual,
  coberturaProyectada,
  objetivoMeses,
  pendienteRecibir
) {
  if (promedioMensual <= 0) {
    return 'SIN CONSUMO';
  }

  if (coberturaProyectada < 1) {
    return pendienteRecibir > 0
      ? 'URGENTE - CON MERCADERIA EN CAMINO'
      : 'URGENTE';
  }

  if (coberturaProyectada < 2) {
    return pendienteRecibir > 0
      ? 'REVISAR LLEGADA'
      : 'COMPRAR';
  }

  if (
    coberturaProyectada <
    objetivoMeses
  ) {
    return 'REVISAR';
  }

  return 'OK';
}


/**
 * Determina acción, motivo, estado y prioridad sin volver a
 * recorrer ninguna hoja.
 */
function determinarDecisionCompraV21_(datos, generales) {
  if (
    numero_(datos.stockTotal) <= 0 &&
    numero_(datos.pendienteRecibir) <= 0 &&
    numero_(datos.consumoTotal) <= 0
  ) {
    return {
      estadoCompra: 'INACTIVO',
      accion: 'SIN ACCION',
      motivo:
        'Producto sin stock, sin consumo y sin importaciones pendientes. ' +
        'Se excluye del plan operativo.',
      prioridad: generales.prioridadOk
    };
  }

  if (datos.promedioMensual <= 0) {
    const sinHistorial =
      numero_(datos.meses) <= 0 &&
      numero_(datos.consumoTotal) <= 0;

    return {
      estadoCompra: sinHistorial
        ? 'SIN HISTORIAL'
        : 'SIN CONSUMO',

      accion: datos.transferenciaSugerida > 0
        ? 'TRANSFERIR'
        : 'REVISAR',

      motivo: sinHistorial
        ? (
            'Producto sin historial de consumo. ' +
            'Verificar si es un SKU nuevo o si falta una equivalencia.'
          )
        : (
            'Producto con historial, pero sin consumo en el período analizado. ' +
            'Revisar continuidad, equivalencias o posible discontinuación.'
          ),

      prioridad: datos.transferenciaSugerida > 0
        ? generales.prioridadTransferir
        : generales.prioridadRevisar
    };
  }

  if (
    datos.stockTotal <= 0 &&
    datos.pendienteRecibir <= 0
  ) {
    return {
      estadoCompra: 'URGENTE',
      accion: 'COMPRAR',
      motivo: 'Sin stock y sin mercadería pendiente de recibir.',
      prioridad: generales.prioridadSinStock
    };
  }

  if (
    datos.coberturaProyectada <
    generales.coberturaUrgenteMeses
  ) {
    return {
      estadoCompra: datos.pendienteRecibir > 0
        ? 'URGENTE - CON MERCADERIA EN CAMINO'
        : 'URGENTE',
      accion: datos.cantidadSugerida > 0
        ? 'COMPRAR'
        : 'REVISAR LLEGADA',
      motivo:
        'Cobertura proyectada de ' +
        formatearNumeroDecisionCompras_(
          datos.coberturaProyectada
        ) +
        ' meses.',
      prioridad: generales.prioridadUrgente
    };
  }

  if (datos.cantidadSugerida > 0) {
    return {
      estadoCompra:
        datos.coberturaProyectada <
        generales.coberturaComprarMeses
          ? 'COMPRAR'
          : 'REVISAR',
      accion: 'COMPRAR',
      motivo:
        'Faltan ' + datos.cantidadSugerida +
        ' unidades para alcanzar ' +
        formatearNumeroDecisionCompras_(
          datos.objetivoMeses
        ) +
        ' meses de cobertura.',
      prioridad:
        datos.coberturaProyectada <
        generales.coberturaComprarMeses
          ? generales.prioridadComprar
          : generales.prioridadRevisar
    };
  }

  if (datos.transferenciaSugerida > 0) {
    return {
      estadoCompra: 'OK',
      accion: 'TRANSFERIR',
      motivo:
        'Transferir ' + datos.transferenciaSugerida +
        ' unidades de ' + datos.origenTransferencia +
        ' a ' + datos.destinoTransferencia +
        ' para aproximar la distribución 85/15.',
      prioridad: generales.prioridadTransferir
    };
  }

  return {
    estadoCompra: 'OK',
    accion: 'OK',
    motivo: 'Cobertura suficiente y distribución sin ajuste relevante.',
    prioridad: generales.prioridadOk
  };
}


function formatearNumeroDecisionCompras_(valor) {
  const numero = Number(valor);

  if (!Number.isFinite(numero)) {
    return '0';
  }

  return numero.toFixed(2).replace('.', ',');
}


/**
 * Devuelve el primer valor no vacío.
 */
function primerValorNoVacio_() {
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


/**
 * Escribe PLAN_COMPRAS priorizando velocidad.
 *
 * Evita operaciones lentas sobre toda la hoja:
 * - no usa clearFormats();
 * - no usa autoResizeColumns();
 * - no reconstruye formatos condicionales en cada ejecución.
 */
function escribirPlanCompras_(
  sh,
  salida
) {
  const encabezados = [[
    'SKU',
    'MARCA',
    'PROVEEDOR',
    'STOCK_WARNES',
    'STOCK_ESCOBAR',
    'STOCK_OTROS',
    'STOCK_TOTAL',
    'EN_FABRICA',
    'A_EMBARCAR',
    'EMBARCADO',
    'A_INGRESAR',
    'PENDIENTE_RECIBIR',
    'CONSUMO_12_MESES',
    'MESES',
    'PROMEDIO_MENSUAL',
    'COBERTURA_ACTUAL_MESES',
    'COBERTURA_PROYECTADA_MESES',
    'OBJETIVO_MESES',
    'STOCK_OBJETIVO_TOTAL',
    'CANTIDAD_SUGERIDA',
    'LEAD_TIME_DIAS',
    'CONSUMO_DIARIO',
    'VENTAS_LEADTIME',
    'STOCK_PROYECTADO',
    'PENDIENTE_QUE_LLEGA_A_TIEMPO',
    'PENDIENTE_QUE_LLEGA_TARDE',
    'PRIMERA_LLEGADA_ESTIMADA_DIAS',
    'DIAS_QUIEBRE_FISICO',
    'DIAS_QUIEBRE_PROYECTADO',
    'RIESGO_RUPTURA',
    'MOTIVO_MRP',
    'OBJETIVO_STOCK_ESCOBAR',
    'OBJETIVO_STOCK_WARNES',
    'TRANSFERENCIA_SUGERIDA',
    'ORIGEN_TRANSFERENCIA',
    'DESTINO_TRANSFERENCIA',
    'ESTADO_COMPRA',
    'ACCION',
    'MOTIVO',
    'PRIORIDAD',
    'ULTIMA_ACTUALIZACION'
  ]];

  const cantidadColumnas =
    encabezados[0].length;

  let t = Date.now();

  for (let i = 0; i < salida.length; i++) {
    if (
      !Array.isArray(salida[i]) ||
      salida[i].length !== cantidadColumnas
    ) {
      throw new Error(
        'La fila ' + (i + 2) +
        ' tiene una cantidad incorrecta de columnas.'
      );
    }
  }

  Logger.log(
    'Validar filas: ' +
    (Date.now() - t) +
    ' ms'
  );

  t = Date.now();

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
    cantidadColumnas
  ) {
    sh.insertColumnsAfter(
      sh.getMaxColumns(),
      cantidadColumnas -
      sh.getMaxColumns()
    );
  }

  Logger.log(
    'Ajustar tamaño hoja: ' +
    (Date.now() - t) +
    ' ms'
  );

  t = Date.now();

  const filasALimpiar = Math.max(
    sh.getLastRow(),
    salida.length + 1
  );

  if (filasALimpiar > 0) {
    sh.getRange(
      1,
      1,
      filasALimpiar,
      cantidadColumnas
    ).clearContent();
  }

  Logger.log(
    'Limpiar contenido: ' +
    (Date.now() - t) +
    ' ms'
  );

  t = Date.now();

  /*
  * Encabezado separado.
  */
  sh.getRange(
    1,
    1,
    1,
    cantidadColumnas
  ).setValues(encabezados);


  /*
  * Escritura por bloques.
  *
  * Con aproximadamente 32.000 filas y 30 columnas,
  * una única llamada setValues() resulta demasiado pesada.
  */
  const tamanoBloque = 2000;

  for (
    let inicio = 0;
    inicio < salida.length;
    inicio += tamanoBloque
  ) {
    const bloque = salida.slice(
      inicio,
      inicio + tamanoBloque
    );

    const tiempoBloque = Date.now();

    sh.getRange(
      inicio + 2,
      1,
      bloque.length,
      cantidadColumnas
    ).setValues(bloque);

    Logger.log(
      'Bloque ' +
      (inicio + 1) +
      ' a ' +
      (inicio + bloque.length) +
      ': ' +
      (Date.now() - tiempoBloque) +
      ' ms'
    );
  }

  Logger.log(
    'setValues completo: ' +
    (Date.now() - t) +
    ' ms'
  );

  t = Date.now();

  sh.setFrozenRows(1);
  formatearEncabezado_(sh);

  Logger.log(
    'Formato encabezado: ' +
    (Date.now() - t) +
    ' ms'
  );

  if (salida.length > 0) {
    t = Date.now();

    /* Stock, tránsito y consumo total: D:M. */
    sh.getRange(
      2,
      4,
      salida.length,
      10
    ).setNumberFormat('#,##0.00');

    /* Meses analizados: N. */
    sh.getRange(
      2,
      14,
      salida.length,
      1
    ).setNumberFormat('0');

    /* Promedio, coberturas y objetivo: O:R. */
    sh.getRange(
      2,
      15,
      salida.length,
      4
    ).setNumberFormat('#,##0.00');

    /* Stock objetivo y compra sugerida: S:T. */
    sh.getRange(
      2,
      19,
      salida.length,
      2
    ).setNumberFormat('#,##0');

    /* Lead time: U. */
    sh.getRange(
      2,
      21,
      salida.length,
      1
    ).setNumberFormat('0');

    /* Consumo diario, ventas y stock proyectado: V:X. */
    sh.getRange(
      2,
      22,
      salida.length,
      3
    ).setNumberFormat('#,##0.00');

    /* Pendientes y primera llegada: Y:AA. */
    sh.getRange(
      2,
      25,
      salida.length,
      3
    ).setNumberFormat('#,##0');

    /* Días de quiebre: AB:AC. */
    sh.getRange(
      2,
      28,
      salida.length,
      2
    ).setNumberFormat('#,##0.00');

    /* Objetivos por depósito y transferencia: AF:AH. */
    sh.getRange(
      2,
      32,
      salida.length,
      3
    ).setNumberFormat('#,##0');

    /* Prioridad: AN. */
    sh.getRange(
      2,
      40,
      salida.length,
      1
    ).setNumberFormat('0');

    /* Última actualización: AO. */
    sh.getRange(
      2,
      41,
      salida.length,
      1
    ).setNumberFormat(
      'dd/MM/yyyy HH:mm'
    );

    Logger.log(
      'Formatos numéricos: ' +
      (Date.now() - t) +
      ' ms'
    );
  }

  t = Date.now();

  const filtroAnterior = sh.getFilter();

  if (filtroAnterior) {
    filtroAnterior.remove();
  }

  if (salida.length > 0) {
    sh.getRange(
      1,
      1,
      salida.length + 1,
      cantidadColumnas
    ).createFilter();
  }

  Logger.log(
    'Filtro: ' +
    (Date.now() - t) +
    ' ms'
  );

  t = Date.now();

  Logger.log(
    'Flush: ' +
    (Date.now() - t) +
    ' ms'
  );
}

/**
 * Formato condicional de ESTADO_COMPRA.
 */
function aplicarColoresEstadoCompra_(
  sh,
  cantidadFilas
) {
  if (cantidadFilas <= 0) {
    sh.setConditionalFormatRules([]);
    return;
  }

  /*
   * ESTADO_COMPRA = columna AK.
   */
  const rangoEstado = sh.getRange(
    2,
    37,
    cantidadFilas,
    1
  );

  const reglas = [
    SpreadsheetApp
      .newConditionalFormatRule()
      .whenTextStartsWith('URGENTE')
      .setBackground('#F4CCCC')
      .setFontColor('#9C0006')
      .setBold(true)
      .setRanges([rangoEstado])
      .build(),

    SpreadsheetApp
      .newConditionalFormatRule()
      .whenTextEqualTo('COMPRAR')
      .setBackground('#FCE5CD')
      .setFontColor('#B45F06')
      .setBold(true)
      .setRanges([rangoEstado])
      .build(),

    SpreadsheetApp
      .newConditionalFormatRule()
      .whenTextStartsWith('REVISAR')
      .setBackground('#FFF2CC')
      .setFontColor('#7F6000')
      .setBold(true)
      .setRanges([rangoEstado])
      .build(),

    SpreadsheetApp
      .newConditionalFormatRule()
      .whenTextEqualTo('OK')
      .setBackground('#D9EAD3')
      .setFontColor('#274E13')
      .setBold(true)
      .setRanges([rangoEstado])
      .build(),

    SpreadsheetApp
      .newConditionalFormatRule()
      .whenTextEqualTo('INACTIVO')
      .setBackground('#E7E6E6')
      .setFontColor('#7F7F7F')
      .setRanges([rangoEstado])
      .build(),

    SpreadsheetApp
      .newConditionalFormatRule()
      .whenTextEqualTo('SIN HISTORIAL')
      .setBackground('#D9EAD3')
      .setFontColor('#274E13')
      .setRanges([rangoEstado])
      .build(),

    SpreadsheetApp
      .newConditionalFormatRule()
      .whenTextEqualTo('SIN CONSUMO')
      .setBackground('#D9D9D9')
      .setFontColor('#666666')
      .setRanges([rangoEstado])
      .build()
  ];

  sh.setConditionalFormatRules(
    reglas
  );
} 


/**
 * Diagnóstico puntual del vínculo:
 * DETALLE_IMPORTACIONES → EQUIVALENCIAS_SKU → SKU
 * y DETALLE_IMPORTACIONES → ORDENES → PROVEEDOR.
 *
 * Cambiar el valor de skuBuscado antes de ejecutar.
 */
function diagnosticarProveedorPendienteSkuV41() {
  const skuBuscado =
    normalizarClave_(
      'KLILED12961SGBLA'
    );

  const ss =
    SpreadsheetApp.getActiveSpreadsheet();

  const detalle =
    leerFilasComoObjetos_(
      obtenerHoja_(
        ss,
        SII_CFG.SHEETS.DETALLE
      )
    );

  const ordenes =
    leerFilasComoObjetos_(
      obtenerHoja_(
        ss,
        SII_CFG.SHEETS.ORDENES
      )
    );

  const equivalencias =
    leerFilasComoObjetos_(
      obtenerHoja_(
        ss,
        SII_CFG.SHEETS.EQUIVALENCIAS_SKU
      )
    );

  const proveedorPorOrden = new Map();

  ordenes.forEach(reg => {
    const idOrden =
      normalizarIdOrdenProveedor_(
        primerValorNoVacio_(
          reg.ID_ORDEN,
          reg.NUMERO_ORDEN,
          reg.NUMERO_PI,
          reg.ORDEN,
          reg.PI
        )
      );

    const proveedor =
      limpiarTexto_(reg.PROVEEDOR);

    if (idOrden && proveedor) {
      proveedorPorOrden.set(
        idOrden,
        proveedor
      );
    }
  });

  const skuPorItem = new Map();

  equivalencias.forEach(reg => {
    const item =
      normalizarClave_(
        primerValorNoVacio_(
          reg.ITEM,
          reg.CODIGO_PROVEEDOR,
          reg.CODIGO_ORIGEN,
          reg.ITEM_PROVEEDOR,
          reg.CODIGO_ITEM
        )
      );

    const sku =
      normalizarClave_(
        primerValorNoVacio_(
          reg.SKU,
          reg.SKU_BAM,
          reg.CODIGO_BAM,
          reg.CODIGO_INTERNO
        )
      );

    if (item && sku) {
      skuPorItem.set(item, sku);
    }
  });

  const coincidencias = [];

  detalle.forEach(reg => {
    const skuDirecto =
      normalizarClave_(reg.SKU);

    const item =
      normalizarClave_(
        primerValorNoVacio_(
          reg.ITEM,
          reg.ITEM_PROVEEDOR,
          reg.CODIGO_PROVEEDOR
        )
      );

    const skuResuelto =
      skuDirecto ||
      skuPorItem.get(item) ||
      '';

    if (skuResuelto !== skuBuscado) {
      return;
    }

    const idOrdenTexto =
      primerValorNoVacio_(
        reg.ID_ORDEN,
        reg.NUMERO_ORDEN,
        reg.NUMERO_PI,
        reg.ORDEN,
        reg.PI
      );

    const idOrden =
      normalizarIdOrdenProveedor_(
        idOrdenTexto
      );

    coincidencias.push({
      item:
        limpiarTexto_(
          primerValorNoVacio_(
            reg.ITEM,
            reg.ITEM_PROVEEDOR,
            reg.CODIGO_PROVEEDOR
          )
        ),

      idOrden:
        limpiarTexto_(idOrdenTexto),

      proveedor:
        limpiarTexto_(
          proveedorPorOrden.get(idOrden)
        ),

      estado:
        obtenerEstadoDetalle_(reg),

      cantidad:
        obtenerCantidadPendienteDetalle_(reg)
    });
  });

  Logger.log(
    JSON.stringify(
      {
        sku: skuBuscado,
        coincidencias: coincidencias
      },
      null,
      2
    )
  );
}


function iniciarMedicionCompras_(nombre) {
  return {
    nombre: nombre,
    inicio: Date.now()
  };
}


function finalizarMedicionCompras_(medicion) {
  const duracion =
    Date.now() - medicion.inicio;

  Logger.log(
    medicion.nombre +
    ': ' +
    duracion +
    ' ms'
  );

  return duracion;
}

function construirClaveProveedorItemV43_(
  proveedor,
  item
) {
  return (
    limpiarTexto_(proveedor)
      .normalize('NFD')
      .replace(
        /[\u0300-\u036f]/g,
        ''
      )
      .toUpperCase()
      .replace(/\s+/g, ' ')
      .trim() +
    '|' +
    normalizarClave_(item)
  );
}


function normalizarIdOrdenProveedor_(valor) {
  return String(
    valor === null || valor === undefined
      ? ''
      : valor
  )
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
}

function pruebaConsumo() {
  if (typeof cargarVentasModelo_ !== 'function') {
    Logger.log('No existe cargarVentasModelo_()');
    return;
  }

  const ventas = cargarVentasModelo_();

  Logger.log('Tipo: ' + typeof ventas);

  if (ventas instanceof Map) {
    Logger.log('Cantidad de SKUs: ' + ventas.size);

    let i = 0;
    for (const [sku, dato] of ventas.entries()) {
      Logger.log(sku + ' => ' + JSON.stringify(dato));
      if (++i >= 10) break;
    }
  } else {
    Logger.log(JSON.stringify(ventas, null, 2));
  }
}

function diagnosticarSkuVentas() {

  const ss = SpreadsheetApp.getActiveSpreadsheet();

  const ventas = leerFilasComoObjetos_(
    obtenerHoja_(ss, SII_CFG.SHEETS.VENTAS)
  );

  const buscar = "3M_42385";

  ventas.forEach(reg => {

    const sku = normalizarClave_(
      primerValorNoVacio_(
        reg.Cod_BAM,
        reg.COD_BAM,
        reg.SKU,
        reg["Código"]
      )
    );

    if (sku === normalizarClave_(buscar)) {

      Logger.log(JSON.stringify(reg, null, 2));

      Logger.log("SKU normalizado: " + sku);

      Logger.log("Total_Unidades_Netas: " + reg.Total_Unidades_Netas);

      Logger.log("Ago_2025: " + reg.Ago_2025);

      Logger.log("Jul_2026: " + reg.Jul_2026);
    }

  });

}

/**
 * Determina si un SKU debe excluirse del Plan de Compras.
 *
 * Un SKU se considera inactivo cuando no tiene:
 * - stock físico disponible;
 * - importaciones pendientes;
 * - consumo en los últimos 12 meses.
 *
 * Si vuelve a registrar stock, consumo o mercadería pendiente,
 * regresará automáticamente a PLAN_COMPRAS.
 */
function esSkuInactivo_(
  stockDisponible,
  pendienteRecibir,
  consumo12Meses
) {
  return (
    numero_(stockDisponible) <= 0 &&
    numero_(pendienteRecibir) <= 0 &&
    numero_(consumo12Meses) <= 0
  );
}

/****************************************************************
 * DASHBOARD EJECUTIVO
 * V4.5
 ****************************************************************/

function generarDashboard_() {

  const ss = SpreadsheetApp.getActive();

  let sh = ss.getSheetByName("DASHBOARD");

  if (!sh) {
    sh = ss.insertSheet("DASHBOARD");
  }

  sh.clear();
  sh.clearFormats();
  sh.clearConditionalFormatRules();
  sh.setHiddenGridlines(true);

  const plan = ss.getSheetByName("PLAN_COMPRAS");

  if (!plan)
    throw new Error("No existe la hoja PLAN_COMPRAS");

  const datos = plan.getDataRange().getValues();

  if (datos.length < 2)
    return;

  const cab = datos[0];

  const cEstado = cab.indexOf("ESTADO_COMPRA");
  const cStock = cab.indexOf("STOCK_TOTAL");
  const cPend = cab.indexOf("PENDIENTE_RECIBIR");
  const cSug = cab.indexOf("CANTIDAD_SUGERIDA");
  const cCob = cab.indexOf("COBERTURA_ACTUAL_MESES");

  if (
    cEstado < 0 ||
    cStock < 0 ||
    cPend < 0 ||
    cSug < 0 ||
    cCob < 0
  ) {
    throw new Error(
      "No se encontraron todas las columnas necesarias."
    );
  }

  let urgentes = 0;
  let comprar = 0;
  let revisar = 0;
  let ok = 0;

  let stockTotal = 0;
  let pendienteTotal = 0;
  let compraTotal = 0;

  let cobertura = 0;
  let totalCobertura = 0;

  for (let i = 1; i < datos.length; i++) {

    const fila = datos[i];

    const estado = String(fila[cEstado]).trim();

    switch (estado) {

      case "URGENTE":
        urgentes++;
        break;

      case "COMPRAR":
        comprar++;
        break;

      case "REVISAR":
        revisar++;
        break;

      case "OK":
        ok++;
        break;
    }

    stockTotal += Number(fila[cStock]) || 0;

    pendienteTotal += Number(fila[cPend]) || 0;

    compraTotal += Number(fila[cSug]) || 0;

    const cob = Number(fila[cCob]);

    if (!isNaN(cob)) {

      cobertura += cob;
      totalCobertura++;

    }

  }

  const total =
    urgentes +
    comprar +
    revisar +
    ok;

  const coberturaPromedio =
    totalCobertura > 0
      ? cobertura / totalCobertura
      : 0;

  const indicadores = {

    urgentes,

    comprar,

    revisar,

    ok,

    porcUrgentes:
      total ? urgentes / total * 100 : 0,

    porcComprar:
      total ? comprar / total * 100 : 0,

    porcRevisar:
      total ? revisar / total * 100 : 0,

    porcOk:
      total ? ok / total * 100 : 0,

    stock:
      stockTotal,

    pendiente:
      pendienteTotal,

    compra:
      compraTotal,

    cobertura:
      coberturaPromedio.toFixed(2) + " meses"

  };

  escribirCabeceraDashboard_(sh, indicadores);

  //
  // Próximos módulos
  //

  // escribirResumenEjecutivo_(sh);

  // escribirTopSkuCriticos_(sh, datos);

  // escribirTopProveedores_(sh, datos);

  // escribirTopMarcas_(sh, datos);

  // crearGraficosDashboard_(sh, datos);

}

function crearTarjeta_(sh,row,col,titulo,valor,porcentaje,color){

  sh.getRange(row,col,row+3,col+2)
    .merge()
    .setBackground(color)
    .setFontColor("white")
    .setHorizontalAlignment("center")
    .setVerticalAlignment("middle")
    .setBorder(true,true,true,true,true,true);

  sh.getRange(row,col)
    .setValue(titulo)
    .setFontWeight("bold")
    .setFontSize(12);

  sh.getRange(row+1,col)
    .setValue(
      Utilities.formatString("%,d",valor)
    )
    .setFontSize(22)
    .setFontWeight("bold");

  sh.getRange(row+2,col)
    .setValue(
      porcentaje.toFixed(1)+" %"
    )
    .setFontSize(12);
}

function crearTarjetaInventario_(sh,row,col,titulo,valor,color){

  sh.getRange(row,col,row+2,col+2)
    .merge()
    .setBackground(color)
    .setFontColor("white")
    .setHorizontalAlignment("center")
    .setVerticalAlignment("middle")
    .setBorder(true,true,true,true,true,true);

  sh.getRange(row,col)
    .setValue(titulo)
    .setFontWeight("bold")
    .setFontSize(12);

  sh.getRange(row+1,col)
    .setValue(valor)
    .setFontSize(18)
    .setFontWeight("bold");
}
