/*******************************************************
 * SII V3.1 FINAL - SISTEMA INTEGRAL DE IMPORTACIONES
 * Versión mejorada y alineada
 *******************************************************/

/** El menú principal se define únicamente en menu.js. */

/**
 * Crea las hojas faltantes y configura sus encabezados.
 * No elimina información existente.
 */
function inicializarSII() {
  const ss = SpreadsheetApp.getActive();

  crearHojaSiNoExiste_(ss, SII_CFG.SHEETS.PROVEEDORES, [
    'ID_PROVEEDOR', 'PROVEEDOR', 'DIAS_FABRICACION', 'DIAS_TRANSITO', 'DIAS_NACIONALIZACION', 'ACTIVO', 'OBSERVACIONES'
  ]);

  crearHojaSiNoExiste_(ss, SII_CFG.SHEETS.MARCAS, [
    'ID_MARCA', 'MARCA', 'OBJETIVO_STOCK_MESES', 'ACTIVA', 'RESPONSABLE', 'OBSERVACIONES'
  ]);

  crearHojaSiNoExiste_(ss, SII_CFG.SHEETS.PRODUCTOS, [
    'SKU', 'MARCA', 'PROVEEDOR', 'DESCRIPCION', 'ACTIVO', 'OBSERVACIONES'
  ]);

  crearHojaSiNoExiste_(ss, SII_CFG.SHEETS.STOCK, [
    'SKU', 'STOCK_FISICO', 'RESERVADO', 'STOCK_DISPONIBLE', 'FECHA_STOCK', 'ARCHIVO_ORIGEN', 'FECHA_IMPORTACION'
  ]);

  crearHojaSiNoExiste_(ss, SII_CFG.SHEETS.VENTAS, [
    'FECHA_VENTA', 'SKU', 'CANTIDAD', 'EMPRESA', 'CLIENTE', 'COMPROBANTE', 'ARCHIVO_ORIGEN', 'FECHA_IMPORTACION'
  ]);

  crearHojaSiNoExiste_(ss, SII_CFG.SHEETS.RECEPCIONES, [
    'ID_RECEPCION', 'ID_ORDEN', 'ID_EMBARQUE', 'FECHA_RECEPCION', 'DEPOSITO', 'USUARIO', 'OBSERVACIONES', 'FECHA_REGISTRO'
  ]);

  crearHojaSiNoExiste_(ss, SII_CFG.SHEETS.DOCUMENTOS, [
    'ID_DOCUMENTO', 'ID_ORDEN', 'TIPO_DOCUMENTO', 'ENLACE_DRIVE', 'FECHA_DOCUMENTO', 'USUARIO', 'OBSERVACIONES'
  ]);

  crearHojaSiNoExiste_(ss, SII_CFG.SHEETS.PLAN_COMPRAS, [
    'SKU', 'MARCA', 'PROVEEDOR', 'STOCK_DISPONIBLE', 'PENDIENTE_RECIBIR', 'CONSUMO_30_DIAS',
    'PROMEDIO_MENSUAL_3M', 'CONSUMO_12_MESES', 'COBERTURA_ACTUAL_MESES', 'COBERTURA_PROYECTADA_MESES',
    'OBJETIVO_MESES', 'CANTIDAD_SUGERIDA', 'ESTADO_COMPRA', 'ULTIMA_ACTUALIZACION'
  ]);

  crearHojaSiNoExiste_(ss, SII_CFG.SHEETS.INDICADORES, [
    'MARCA', 'CANTIDAD_SKU', 'STOCK_DISPONIBLE', 'PENDIENTE_RECIBIR', 'CONSUMO_MENSUAL',
    'COBERTURA_PROYECTADA', 'URGENTES', 'A_COMPRAR', 'A_REVISAR', 'CANTIDAD_SUGERIDA'
  ]);

  crearHojaSiNoExiste_(ss, 'EQUIVALENCIAS_SKU', [
    'SKU', 'PROVEEDOR', 'ITEM_PROVEEDOR', 'MARCA', 'ACTIVO', 'OBSERVACIONES'
  ]);

  actualizarMaestros();
  actualizarCantidadesPendientes();

  SpreadsheetApp.getUi().alert(
    'Inicialización finalizada.\n\nSe crearon las hojas faltantes y se actualizaron los maestros.'
  );
}

/**
 * Actualiza proveedores, marcas y productos.
 */
function actualizarMaestros() {
  actualizarProveedores(false);
  actualizarMarcas(false);
  actualizarProductos(false);

  SpreadsheetApp.getActive().toast('Maestros actualizados correctamente.', 'SII', 5);
}

/**
 * Genera PROVEEDORES tomando la información de ORDENES.
 */
function actualizarProveedores(mostrarMensaje = true) {
  const ss = SpreadsheetApp.getActive();
  const shOrdenes = obtenerHoja_(ss, SII_CFG.SHEETS.ORDENES);
  const shDestino = obtenerHoja_(ss, SII_CFG.SHEETS.PROVEEDORES);

  const datos = shOrdenes.getDataRange().getDisplayValues();
  if (datos.length < 2) return;

  const headers = mapaEncabezados_(datos[0]);
  const colProveedor = requerirColumna_(headers, 'PROVEEDOR');

  const proveedores = new Set();
  datos.slice(1).forEach(fila => {
    const proveedor = limpiarTexto_(fila[colProveedor]);
    if (proveedor) proveedores.add(proveedor);
  });

  const existentes = leerTablaPorClave_(shDestino, 'PROVEEDOR');

  const salida = [...proveedores]
    .sort((a, b) => a.localeCompare(b))
    .map(proveedor => {
      const anterior = existentes.get(normalizar_(proveedor));
      return [
        anterior?.ID_PROVEEDOR || generarId_('PROV'),
        proveedor,
        anterior?.DIAS_FABRICACION || 45,
        anterior?.DIAS_TRANSITO || 40,
        anterior?.DIAS_NACIONALIZACION || 15,
        anterior?.ACTIVO || 'SI',
        anterior?.OBSERVACIONES || ''
      ];
    });

  escribirTabla_(shDestino, salida);

  if (mostrarMensaje) {
    ss.toast(`${salida.length} proveedores actualizados.`, 'SII', 5);
  }
}

/**
 * Genera MARCAS tomando la información de DETALLE_IMPORTACIONES.
 */
function actualizarMarcas(mostrarMensaje = true) {
  const ss = SpreadsheetApp.getActive();
  const shDetalle = obtenerHoja_(ss, SII_CFG.SHEETS.DETALLE);
  const shDestino = obtenerHoja_(ss, SII_CFG.SHEETS.MARCAS);

  const datos = shDetalle.getDataRange().getDisplayValues();
  if (datos.length < 2) return;

  const headers = mapaEncabezados_(datos[0]);
  const colMarca = requerirColumna_(headers, 'MARCA');

  const marcas = new Set();
  datos.slice(1).forEach(fila => {
    const marca = limpiarTexto_(fila[colMarca]);
    if (marca) marcas.add(marca);
  });

  const existentes = leerTablaPorClave_(shDestino, 'MARCA');

  const salida = [...marcas]
    .sort((a, b) => a.localeCompare(b))
    .map(marca => {
      const anterior = existentes.get(normalizar_(marca));
      return [
        anterior?.ID_MARCA || generarId_('MAR'),
        marca,
        anterior?.OBJETIVO_STOCK_MESES || 4,
        anterior?.ACTIVA || 'SI',
        anterior?.RESPONSABLE || '',
        anterior?.OBSERVACIONES || ''
      ];
    });

  escribirTabla_(shDestino, salida);

  if (mostrarMensaje) {
    ss.toast(`${salida.length} marcas actualizadas.`, 'SII', 5);
  }
}

/**
 * Genera PRODUCTOS desde DETALLE_IMPORTACIONES y ORDENES
 */
function actualizarProductos(mostrarMensaje = true) {
  const ss = SpreadsheetApp.getActive();
  const shDetalle = obtenerHoja_(ss, SII_CFG.SHEETS.DETALLE);
  const shOrdenes = obtenerHoja_(ss, SII_CFG.SHEETS.ORDENES);
  const shDestino = obtenerHoja_(ss, SII_CFG.SHEETS.PRODUCTOS);

  const datosDetalle = shDetalle.getDataRange().getDisplayValues();
  const datosOrdenes = shOrdenes.getDataRange().getDisplayValues();

  if (datosDetalle.length < 2) return;

  const hDetalle = mapaEncabezados_(datosDetalle[0]);
  const hOrdenes = mapaEncabezados_(datosOrdenes[0]);

  const colOrdenDetalle = requerirColumna_(hDetalle, 'ID_ORDEN');
  const colSku = requerirColumna_(hDetalle, 'SKU');
  const colMarca = requerirColumna_(hDetalle, 'MARCA');
  const colOrden = requerirColumna_(hOrdenes, 'ID_ORDEN');
  const colProveedor = requerirColumna_(hOrdenes, 'PROVEEDOR');

  const proveedorPorOrden = new Map();
  datosOrdenes.slice(1).forEach(fila => {
    const idOrden = limpiarTexto_(fila[colOrden]);
    const proveedor = limpiarTexto_(fila[colProveedor]);
    if (idOrden) proveedorPorOrden.set(normalizarClave_(idOrden), proveedor);
  });

  const productos = new Map();
  datosDetalle.slice(1).forEach(fila => {
    const sku = limpiarTexto_(fila[colSku]);
    if (!sku) return;

    const idOrden = limpiarTexto_(fila[colOrdenDetalle]);
    const marca = limpiarTexto_(fila[colMarca]);
    const proveedor = proveedorPorOrden.get(normalizarClave_(idOrden)) || '';
    const clave = normalizarClave_(sku);

    if (!productos.has(clave)) {
      productos.set(clave, { sku, marca, proveedor });
    } else {
      const actual = productos.get(clave);
      if (!actual.marca && marca) actual.marca = marca;
      if (!actual.proveedor && proveedor) actual.proveedor = proveedor;
    }
  });

  const existentes = leerTablaPorClave_(shDestino, 'SKU');

  const salida = [...productos.values()]
    .sort((a, b) => a.sku.localeCompare(b.sku))
    .map(producto => {
      const anterior = existentes.get(normalizarClave_(producto.sku));
      return [
        producto.sku,
        producto.marca || limpiarTexto_(anterior?.MARCA),
        producto.proveedor || limpiarTexto_(anterior?.PROVEEDOR),
        limpiarTexto_(anterior?.DESCRIPCION),
        limpiarTexto_(anterior?.ACTIVO) || 'SI',
        limpiarTexto_(anterior?.OBSERVACIONES),
        limpiarTexto_(anterior?.ESTADO_ALTA) || 'PENDIENTE_BAM'
      ];
    });

  asegurarEncabezadosProductos_(shDestino);
  escribirTabla_(shDestino, salida);
  aplicarValidacionEstadoAlta_(shDestino);

  if (mostrarMensaje) {
    ss.toast(`${salida.length} productos actualizados.`, 'SII', 5);
  }
}

/**
 * Recalcula en DETALLE_IMPORTACIONES los campos de recepción:
 * CANTIDAD_PENDIENTE y ESTADO_RECEPCION.
 * No modifica STATUS_LINEA.
 */
function actualizarCantidadesPendientes() {
  const ss = SpreadsheetApp.getActive();
  const shDetalle = obtenerHoja_(ss, SII_CFG.SHEETS.DETALLE);

  const datos = shDetalle.getDataRange().getValues();
  if (datos.length < 2) return;

  const h = mapaEncabezados_(datos[0]);

  const colCantidad = requerirColumna_(h, 'CANTIDAD');
  const colRecibida = requerirColumna_(h, 'CANTIDAD_RECIBIDA');
  const colPendiente = requerirColumna_(h, 'CANTIDAD_PENDIENTE');
  const colEstadoRecepcion = requerirColumna_(h, 'ESTADO_RECEPCION');

  const salidaPendiente = [];
  const salidaEstado = [];

  datos.slice(1).forEach(fila => {
    const cantidad = Math.max(0, numero_(fila[colCantidad]));
    const recibida = Math.max(0, numero_(fila[colRecibida]));
    const pendiente = Math.max(0, cantidad - recibida);

    let estadoRecepcion = 'PENDIENTE';

    if (cantidad > 0 && pendiente <= 0) {
      estadoRecepcion = 'RECIBIDO';
    } else if (recibida > 0) {
      estadoRecepcion = 'PARCIAL';
    }

    salidaPendiente.push([pendiente]);
    salidaEstado.push([estadoRecepcion]);
  });

  if (salidaPendiente.length) {
    shDetalle
      .getRange(2, colPendiente + 1, salidaPendiente.length, 1)
      .setValues(salidaPendiente);

    shDetalle
      .getRange(2, colEstadoRecepcion + 1, salidaEstado.length, 1)
      .setValues(salidaEstado);
  }

  ss.toast('Cantidades pendientes y estados de recepción actualizados.', 'SII', 5);
}

/**
 * Resume PLAN_COMPRAS por marca.
 */
function actualizarIndicadores() {
  const ss = SpreadsheetApp.getActive();
  const shPlan = obtenerHoja_(ss, SII_CFG.SHEETS.PLAN_COMPRAS);
  const shIndicadores = obtenerHoja_(ss, SII_CFG.SHEETS.INDICADORES);

  const plan = leerFilasComoObjetos_(shPlan);
  const resumen = new Map();

  plan.forEach(reg => {
    const marcaTexto = limpiarTexto_(reg.MARCA);
    if (!marcaTexto) return;

    const clave = normalizar_(marcaTexto);

    if (!resumen.has(clave)) {
      resumen.set(clave, {
        marca: marcaTexto,
        skus: 0,
        stock: 0,
        pendiente: 0,
        consumo: 0,
        urgentes: 0,
        comprar: 0,
        revisar: 0,
        sugerido: 0
      });
    }

    const r = resumen.get(clave);
    r.skus++;
    r.stock += numero_(reg.STOCK_DISPONIBLE);
    r.pendiente += numero_(reg.PENDIENTE_RECIBIR);
    r.consumo += numero_(reg.PROMEDIO_MENSUAL_3M);
    r.sugerido += numero_(reg.CANTIDAD_SUGERIDA);

    const estado = limpiarTexto_(reg.ESTADO_COMPRA).toUpperCase();
    if (estado === 'URGENTE') r.urgentes++;
    if (estado === 'COMPRAR') r.comprar++;
    if (estado === 'REVISAR') r.revisar++;
  });

  const salida = [...resumen.values()]
    .sort((a, b) => a.marca.localeCompare(b.marca))
    .map(r => [
      r.marca,
      r.skus,
      r.stock,
      r.pendiente,
      r.consumo,
      r.consumo > 0 ? (r.stock + r.pendiente) / r.consumo : '',
      r.urgentes,
      r.comprar,
      r.revisar,
      r.sugerido
    ]);

  escribirTabla_(shIndicadores, salida);

  if (salida.length > 0) {
    shIndicadores.getRange(2, 2, salida.length, 9).setNumberFormat('#,##0.00');
  }

  ss.toast(`${salida.length} marcas resumidas.`, 'Indicadores', 5);
}

/*******************************************************
 * DASHBOARD EJECUTIVO
 *******************************************************
 */

function actualizarDashboard() {
  const ss = SpreadsheetApp.getActive();
  const shDashboard = obtenerHoja_(ss, SII_CFG.SHEETS.DASHBOARD);
  const shOrdenes = obtenerHoja_(ss, SII_CFG.SHEETS.ORDENES);
  const shDetalle = obtenerHoja_(ss, SII_CFG.SHEETS.DETALLE);
  const shPlan = obtenerHoja_(ss, SII_CFG.SHEETS.PLAN_COMPRAS);
  const shRecepciones = obtenerHoja_(ss, SII_CFG.SHEETS.RECEPCIONES);

  const ordenes = leerFilasComoObjetos_(shOrdenes);
  const plan = leerFilasComoObjetos_(shPlan);
  const recepciones = leerFilasComoObjetos_(shRecepciones);

  const mapaOrdenes = new Map();
  ordenes.forEach(reg => {
    const idOrden = limpiarTexto_(reg.ID_ORDEN || reg.NUMERO_ORDEN || reg.NUMERO_PI);
    if (!idOrden) return;

    mapaOrdenes.set(normalizarEstadoDashboard_(idOrden), {
      proveedor: limpiarTexto_(reg.PROVEEDOR),
      estado: normalizarEstadoDashboard_(reg.ESTADO_RECEPCION)
    });
  });

  let ordenesAbiertas = 0;
  let ordenesParciales = 0;
  let ordenesRecibidas = 0;

  mapaOrdenes.forEach(orden => {
    const estado = orden.estado;
    if (estado === 'RECIBIDO') {
      ordenesRecibidas++;
    } else if (estado === 'PARCIAL') {
      ordenesParciales++;
    } else if (!['CERRADO', 'CERRADA', 'ANULADO', 'ANULADA'].includes(estado)) {
      ordenesAbiertas++;
    }
  });

  const resumenLogistico = obtenerResumenLogisticoDashboardV31_(shDetalle);

  let skuCriticos = 0;
  let skuUrgentes = 0;
  let skuRevisar = 0;
  let skuOk = 0;
  let skuInactivos = 0;
  let skuActivos = 0;
  let skuSinHistorial = 0;
  let skuSinConsumo = 0;
  let sumaCobertura = 0;
  let cantidadConCobertura = 0;
  let totalCompraSugerida = 0;

  const topCriticos = [];

  plan.forEach(reg => {
    const riesgo = normalizarEstadoDashboard_(reg.RIESGO_RUPTURA);
    const estado = normalizarEstadoDashboard_(reg.ESTADO_COMPRA);
    const accion = normalizarEstadoDashboard_(reg.ACCION);
    const cobertura = numeroDashboard_(reg.COBERTURA_PROYECTADA_MESES);
    const compra = numeroDashboard_(reg.CANTIDAD_SUGERIDA);

    if (estado === 'INACTIVO') {
      skuInactivos++;
      return;
    }

    skuActivos++;

    if (riesgo === 'CRITICO') skuCriticos++;

    if (estado.startsWith('URGENTE') || (accion === 'COMPRAR' && riesgo === 'CRITICO')) {
      skuUrgentes++;
    } else if (estado.startsWith('REVISAR') || accion === 'REVISAR') {
      skuRevisar++;
    } else if (estado === 'OK') {
      skuOk++;
    }

    if (estado === 'SIN HISTORIAL') skuSinHistorial++;
    if (estado === 'SIN CONSUMO') skuSinConsumo++;

    if (cobertura > 0 && Number.isFinite(cobertura)) {
      sumaCobertura += cobertura;
      cantidadConCobertura++;
    }

    totalCompraSugerida += compra;

    if (riesgo === 'CRITICO' || estado.startsWith('URGENTE')) {
      topCriticos.push({
        sku: limpiarTexto_(reg.SKU),
        marca: limpiarTexto_(reg.MARCA),
        cobertura: cobertura,
        compra: compra,
        riesgo: riesgo || estado
      });
    }
  });

  topCriticos.sort((a, b) => (a.cobertura !== b.cobertura ? a.cobertura - b.cobertura : b.compra - a.compra));

  const coberturaPromedio = cantidadConCobertura > 0 ? sumaCobertura / cantidadConCobertura : 0;

  const ultimasRecepciones = recepciones
    .filter(reg => limpiarTexto_(reg.ID_RECEPCION || reg.FECHA_RECEPCION || reg.FECHA))
    .sort((a, b) => fechaDashboard_(b.FECHA_RECEPCION || b.FECHA) - fechaDashboard_(a.FECHA_RECEPCION || a.FECHA))
    .slice(0, 10)
    .map(reg => {
      const idOrden = limpiarTexto_(reg.ID_ORDEN || reg.NUMERO_PI);
      const orden = mapaOrdenes.get(normalizarEstadoDashboard_(idOrden)) || {};
      return [
        reg.FECHA_RECEPCION || reg.FECHA || '',
        idOrden,
        orden.proveedor || '',
        reg.DEPOSITO || '',
        reg.OBSERVACIONES || ''
      ];
    });

  quitarFiltroHoja_(shDashboard);
  shDashboard.getCharts().forEach(chart => shDashboard.removeChart(chart));

  shDashboard.clear();
  shDashboard.setConditionalFormatRules([]);
  shDashboard.setHiddenGridlines(true);

  // Encabezado
  shDashboard.getRange('A1:N1').merge().setValue('SII V3.1 FINAL - SISTEMA INTEGRAL DE IMPORTACIONES');
  shDashboard.getRange('A2:N2').merge().setValue(
    'Última actualización: ' + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'dd/MM/yyyy HH:mm')
  );

  // Tarjetas KPI Principales
  crearTarjetaDashboardV31_(shDashboard, 'A4:C6', skuCriticos, 'SKU CRÍTICOS', '#990000');
  crearTarjetaDashboardV31_(shDashboard, 'E4:G6', skuUrgentes, 'COMPRAS URGENTES', '#CC0000');
  crearTarjetaDashboardV31_(shDashboard, 'I4:K6', skuRevisar, 'A REVISAR', '#BF9000');
  crearTarjetaDashboardV31_(shDashboard, 'M4:N6', skuOk, 'SKU OK', '#38761D');

  crearTarjetaDashboardV31_(shDashboard, 'A8:C10', ordenesAbiertas, 'ÓRDENES ABIERTAS', '#1F4E78');
  crearTarjetaDashboardV31_(shDashboard, 'E8:G10', skuInactivos, 'SKU INACTIVOS', '#7F7F7F');
  crearTarjetaDashboardV31_(shDashboard, 'I8:K10', Math.round(resumenLogistico.unidadesPendientes), 'UNIDADES PENDIENTES', '#0B5394');
  crearTarjetaDashboardV31_(shDashboard, 'M8:N10', coberturaPromedio.toFixed(2), 'COBERTURA PROMEDIO', '#45818E');

  // Tablas resumen
  shDashboard.getRange('A13:B13').setValues([['ESTADO LOGÍSTICO', 'LÍNEAS']]);
  shDashboard.getRange('A14:B19').setValues([
    ['En fábrica', resumenLogistico.estados['EN FABRICA']],
    ['A embarcar', resumenLogistico.estados['A EMBARCAR']],
    ['Embarcado', resumenLogistico.estados['EMBARCADO']],
    ['A ingresar', resumenLogistico.estados['A INGRESAR']],
    ['Ingresado', resumenLogistico.estados['INGRESADO']],
    ['Recepción parcial', resumenLogistico.recepcion['PARCIAL']]
  ]);

  shDashboard.getRange('D13:E13').setValues([['PLAN DE COMPRAS', 'SKU']]);
  shDashboard.getRange('D14:E20').setValues([
    ['Críticos', skuCriticos],
    ['Urgentes', skuUrgentes],
    ['Revisar', skuRevisar],
    ['OK', skuOk],
    ['Sin historial', skuSinHistorial],
    ['Sin consumo', skuSinConsumo],
    ['Inactivos', skuInactivos]
  ]);

  shDashboard.getRange('G13:H13').setValues([['RESUMEN', 'VALOR']]);
  shDashboard.getRange('G14:H19').setValues([
    ['SKU activos', skuActivos],
    ['Productos analizados', plan.length],
    ['Compra sugerida', Math.round(totalCompraSugerida)],
    ['Órdenes parciales', ordenesParciales],
    ['Unidades recibidas', Math.round(resumenLogistico.unidadesRecibidas)],
    ['Cobertura promedio', coberturaPromedio]
  ]);

  // Top críticos
  shDashboard.getRange('J13:N13').merge().setValue('TOP 10 SKU CRÍTICOS');
  shDashboard.getRange('J14:N14').setValues([['SKU', 'MARCA', 'COBERTURA', 'COMPRA', 'RIESGO']]);

  const salidaCriticos = topCriticos.slice(0, 10).map(reg => [
    reg.sku, reg.marca, reg.cobertura, reg.compra, reg.riesgo
  ]);

  if (salidaCriticos.length > 0) {
    shDashboard.getRange(15, 10, salidaCriticos.length, 5).setValues(salidaCriticos);
  }

  // Últimas recepciones
  shDashboard.getRange('A23:E23').merge().setValue('ÚLTIMAS RECEPCIONES');
  shDashboard.getRange('A24:E24').setValues([['FECHA', 'PI / ORDEN', 'PROVEEDOR', 'DEPÓSITO', 'OBSERVACIONES']]);

  if (ultimasRecepciones.length > 0) {
    shDashboard.getRange(25, 1, ultimasRecepciones.length, 5).setValues(ultimasRecepciones);
  }

  // Formato visual y alineación
  aplicarFormatoDashboardV31_(shDashboard, salidaCriticos.length, ultimasRecepciones.length);

  // Re-crear gráficos corregidos
  crearGraficosDashboardV31_(shDashboard);

  ss.toast('Dashboard V3.1 FINAL actualizado.', 'SII', 5);
}

function obtenerResumenLogisticoDashboardV31_(shDetalle) {
  const valores = shDetalle.getDataRange().getDisplayValues();

  const estados = {
    'EN FABRICA': 0,
    'A EMBARCAR': 0,
    'EMBARCADO': 0,
    'A INGRESAR': 0,
    'INGRESADO': 0
  };

  if (valores.length < 2) {
    return {
      estados: estados,
      recepcion: { PENDIENTE: 0, PARCIAL: 0, RECIBIDO: 0 },
      unidadesPendientes: 0,
      unidadesRecibidas: 0
    };
  }

  const h = mapaEncabezados_(valores[0]);

  const colStatusLinea = requerirColumna_(h, 'STATUS_LINEA');
  const colEstadoRecepcion = requerirColumna_(h, 'ESTADO_RECEPCION');
  const colPendiente = requerirColumna_(h, 'CANTIDAD_PENDIENTE');
  const colRecibida = requerirColumna_(h, 'CANTIDAD_RECIBIDA');

  const recepcion = {
    PENDIENTE: 0,
    PARCIAL: 0,
    RECIBIDO: 0
  };

  let unidadesPendientes = 0;
  let unidadesRecibidas = 0;

  for (let fila = 1; fila < valores.length; fila++) {
    const statusLinea = normalizarEstadoDashboard_(valores[fila][colStatusLinea]);
    const estadoRecepcion = normalizarEstadoDashboard_(valores[fila][colEstadoRecepcion]);

    if (Object.prototype.hasOwnProperty.call(estados, statusLinea)) {
      estados[statusLinea]++;
    }

    if (Object.prototype.hasOwnProperty.call(recepcion, estadoRecepcion)) {
      recepcion[estadoRecepcion]++;
    }

    unidadesPendientes += numeroDashboard_(valores[fila][colPendiente]);
    unidadesRecibidas += numeroDashboard_(valores[fila][colRecibida]);
  }

  return {
    estados: estados,
    recepcion: recepcion,
    unidadesPendientes: unidadesPendientes,
    unidadesRecibidas: unidadesRecibidas
  };
}

/**
 * Tarjetas de KPIs alineadas vertical y horizontalmente.
 */
function crearTarjetaDashboardV31_(sh, rangoA1, valor, titulo, colorFondo) {
  const rango = sh.getRange(rangoA1);
  rango.merge();
  rango
    .setValue(valor + '\n' + titulo)
    .setBackground(colorFondo)
    .setFontColor('#FFFFFF')
    .setFontSize(14)
    .setFontWeight('bold')
    .setHorizontalAlignment('center')
    .setVerticalAlignment('middle')
    .setWrap(true);
}

/**
 * Centra y emprolija el formato general de la planilla.
 */
function aplicarFormatoDashboardV31_(sh, cantidadCriticos, cantidadRecepciones) {
  const anchos = [150, 95, 25, 145, 95, 25, 145, 95, 25, 155, 120, 25, 110, 110];

  anchos.forEach((ancho, indice) => sh.setColumnWidth(indice + 1, ancho));

  [1, 2, 4, 5, 6, 8, 9, 10].forEach(fila => {
    sh.setRowHeight(fila, fila === 1 ? 38 : fila === 2 ? 24 : 34);
  });

  // Título principal
  sh.getRange('A1:N1')
    .setBackground('#17365D')
    .setFontColor('#FFFFFF')
    .setFontSize(18)
    .setFontWeight('bold')
    .setHorizontalAlignment('center')
    .setVerticalAlignment('middle');

  // Subtítulo
  sh.getRange('A2:N2')
    .setBackground('#D9EAF7')
    .setFontColor('#1F4E78')
    .setFontStyle('italic')
    .setHorizontalAlignment('center')
    .setVerticalAlignment('middle');

  // Encabezados de Tablas
  [
    'A13:B13', 'D13:E13', 'G13:H13', 'J13:N13', 'J14:N14', 'A23:E23', 'A24:E24'
  ].forEach(rangoA1 => {
    sh.getRange(rangoA1)
      .setBackground('#1F4E78')
      .setFontColor('#FFFFFF')
      .setFontWeight('bold')
      .setHorizontalAlignment('center')
      .setVerticalAlignment('middle');
  });

  // Bordes y alineación interna
  ['A14:B19', 'D14:E20', 'G14:H19'].forEach(rangoA1 => {
    sh.getRange(rangoA1)
      .setBorder(true, true, true, true, true, true, '#B7C9D6', SpreadsheetApp.BorderStyle.SOLID)
      .setVerticalAlignment('middle');
  });

  // Alineación general centrada
  sh.getRange('A13:N40').setVerticalAlignment('middle');
  sh.getRange('B14:B19').setHorizontalAlignment('center').setNumberFormat('#,##0');
  sh.getRange('E14:E20').setHorizontalAlignment('center').setNumberFormat('#,##0');
  sh.getRange('H14:H18').setHorizontalAlignment('center').setNumberFormat('#,##0');
  sh.getRange('H16').setNumberFormat('$ #,##0'); // Compra sugerida
  sh.getRange('H19').setHorizontalAlignment('center').setNumberFormat('0.00');

  if (cantidadCriticos > 0) {
    sh.getRange(15, 10, cantidadCriticos, 5).setVerticalAlignment('middle');
    sh.getRange(15, 12, cantidadCriticos, 1).setHorizontalAlignment('center').setNumberFormat('0.00');
    sh.getRange(15, 13, cantidadCriticos, 1).setHorizontalAlignment('center').setNumberFormat('#,##0');
    sh.getRange(15, 14, cantidadCriticos, 1).setHorizontalAlignment('center');
  }

  if (cantidadRecepciones > 0) {
    sh.getRange(25, 1, cantidadRecepciones, 5).setVerticalAlignment('middle');
    sh.getRange(25, 1, cantidadRecepciones, 1).setHorizontalAlignment('center').setNumberFormat('dd/MM/yyyy');
  }
}

/**
 * Reubica y acomoda los gráficos para que no tapen datos
 */
function crearGraficosDashboardV31_(sh) {
  const graficoLogistico = sh.newChart()
    .setChartType(Charts.ChartType.BAR)
    .addRange(sh.getRange('A13:B19'))
    .setOption('title', 'Estado logístico')
    .setOption('legend', { position: 'none' })
    .setOption('height', 280)
    .setOption('width', 500)
    .setPosition(23, 7, 0, 0)
    .build();

  sh.insertChart(graficoLogistico);

  const graficoCompras = sh.newChart()
    .setChartType(Charts.ChartType.COLUMN)
    .addRange(sh.getRange('D13:E20'))
    .setOption('title', 'Estado del plan de compras')
    .setOption('legend', { position: 'none' })
    .setOption('height', 280)
    .setOption('width', 500)
    .setPosition(23, 11, 0, 0)
    .build();

  sh.insertChart(graficoCompras);
}

function normalizarEstadoDashboard_(valor) {
  return String(valor === null || valor === undefined ? '' : valor)
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ');
}

function fechaDashboard_(valor) {
  if (valor instanceof Date) return valor;
  const fecha = new Date(valor);
  return isNaN(fecha.getTime()) ? new Date(0) : fecha;
}

function numeroDashboard_(valor) {
  if (typeof valor === 'number') return Number.isFinite(valor) ? valor : 0;

  let texto = String(valor === null || valor === undefined ? '' : valor)
    .trim()
    .replace(/\s/g, '');

  if (!texto) return 0;

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

function actualizacionCompleta() {
  const ss = SpreadsheetApp.getActive();
  ss.toast('Iniciando actualización...', 'SII', 3);

  actualizarMaestros();
  actualizarCantidadesPendientes();
  actualizarIndicadores();
  actualizarDashboard();

  ss.toast('Actualización completa finalizada.', 'SII', 8);
}

/**
 * Registra cambios realizados en la hoja ORDENES.
 */
function onEdit(e) {
  if (!e || !e.range) return;

  const sh = e.range.getSheet();
  if (sh.getName() !== SII_CFG.SHEETS.ORDENES) return;
  if (e.range.getRow() === 1) return;
  if (e.range.getNumRows() !== 1 || e.range.getNumColumns() !== 1) return;

  // Lógica opcional para guardar historial o auditoría de edición de órdenes
}