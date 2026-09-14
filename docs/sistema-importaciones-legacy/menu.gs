/*******************************************************
 * SII V5.2.000 - MENÚ PRINCIPAL
 * Centro de Compras por proveedor y por marca.
 *******************************************************/

function onOpen() {
  const ui = SpreadsheetApp.getUi();

  ui.createMenu(`SII V${SII_VERSION}`)
    .addSubMenu(
      ui.createMenu('Configuración')
        .addItem('Inicializar sistema', 'inicializarSII')
        .addItem('Actualizar todos los maestros', 'actualizarMaestros')
    )
    .addSubMenu(
      ui.createMenu('Maestros')
        .addItem('Actualizar proveedores', 'actualizarProveedores')
        .addItem('Actualizar marcas', 'actualizarMarcas')
        .addItem('Actualizar productos', 'actualizarProductos')
        .addSeparator()
        .addItem('Actualizar equivalencias SKU', 'actualizarEquivalenciasSku')
        .addItem('Guardar equivalencias pendientes', 'guardarEquivalenciasPendientes')
        .addItem('Completar SKU en detalle', 'completarSkuEnDetalle')
    )
    .addSubMenu(
      ui.createMenu('Importaciones')
        .addItem('Actualizar cantidades pendientes', 'actualizarCantidadesPendientes')
        .addItem('Actualizar estados', 'actualizarEstadosImportaciones')
        .addItem('Documentación', 'abrirDocumentacion')
        .addItem('Consulta integral PI', 'abrirConsultaPi')
    )
    .addSubMenu(
      ui.createMenu('Datos externos')
        .addItem('Importar stock BAM', 'mostrarImportadorStock')
        .addItem('Importar consumo facturador', 'mostrarImportadorVentasNuevo')
    )
    .addSubMenu(
      ui.createMenu('Compras')
        .addItem('Actualizar plan de compras', 'actualizarPlanCompras')
        .addItem('Actualizar indicadores', 'actualizarIndicadores')
        .addItem('Ficha integral del SKU', 'abrirFichaSku')
        .addItem('Actualizar acciones del día', 'actualizarAccionesDelDia')
    )
    .addSubMenu(
      ui.createMenu('Centro de Compras')
        .addItem('Actualizar centro de compras', 'actualizarCentroCompras')
        .addItem('Abrir centro de compras', 'abrirCentroCompras')
        .addSeparator()
        .addSubMenu(
          ui.createMenu('Detalle por proveedor')
            .addItem('Ver proveedor de la fila seleccionada', 'verDetalleProveedorSeleccionado')
            .addItem('Abrir detalle de proveedor', 'abrirDetalleProveedor')
            .addItem('Actualizar detalle de proveedor', 'actualizarDetalleProveedor')
        )
        .addSubMenu(
          ui.createMenu('Detalle por marca')
            .addItem('Ver marca de la fila seleccionada', 'verDetalleMarcaSeleccionada')
            .addItem('Abrir detalle de marca', 'abrirDetalleMarca')
            .addItem('Actualizar detalle de marca', 'actualizarDetalleMarca')
        )
        .addSeparator()
        .addItem('Centro de Compras por Marca', 'abrirCentroComprasPorMarca')
        .addItem('Centro Inteligente de Compras', 'abrirCentroComprasInteligente')
    )
    .addSubMenu(
      ui.createMenu('Recepciones')
        .addItem('Registrar recepción', 'abrirRecepciones')
    )
    .addItem('Actualizar dashboard', 'actualizarDashboard')
    .addSeparator()
    .addItem('Ejecutar actualización completa', 'actualizacionCompleta')
    .addSeparator()
    .addItem('Información del sistema', 'mostrarVersionSII')
    .addToUi();
    agregarMenuAdministracionSII_(ui);

     ui.createMenu("🛒 Gestión Compras")
    .addItem(
      "Gestionar SKU seleccionado",
      "gestionarSkuSeleccionadoB17D"
    )
    .addToUi();
}


function mostrarVersionSII() {
  SpreadsheetApp.getUi().alert(
    'Sistema Integral de Importaciones',
    `Versión actual: ${SII_VERSION}`,
    SpreadsheetApp.getUi().ButtonSet.OK
  );
}


function abrirCentroCompras() {
  abrirHojaCentroMenu_('CENTRO_COMPRAS', 'A1');
}


function abrirDetalleProveedor() {
  abrirHojaCentroMenu_('DETALLE_PROVEEDOR', 'C2');
}


function abrirDetalleMarca() {
  abrirHojaCentroMenu_('DETALLE_MARCA', 'C2');
}


function verDetalleProveedorSeleccionado() {
  const contexto = obtenerContextoFilaCentroMenu_();
  const colProveedor = contexto.mapa.get('PROVEEDOR');

  if (colProveedor === undefined) {
    throw new Error(
      'No se encontró la columna PROVEEDOR en CENTRO_COMPRAS.'
    );
  }

  const proveedor = limpiarTextoCentroMenu_(
    contexto.fila[colProveedor]
  );

  if (!proveedor) {
    throw new Error(
      'La fila seleccionada no tiene proveedor.'
    );
  }

  if (
    typeof generarDetalleProveedorV5003_1_ !==
    'function'
  ) {
    throw new Error(
      'No se encontró generarDetalleProveedorV5003_1_.'
    );
  }

  generarDetalleProveedorV5003_1_(proveedor);
}


function verDetalleMarcaSeleccionada() {
  const contexto = obtenerContextoFilaCentroMenu_();
  const colMarcas = contexto.mapa.get('MARCAS');

  if (colMarcas === undefined) {
    throw new Error(
      'No se encontró la columna MARCAS en CENTRO_COMPRAS.'
    );
  }

  const textoMarcas = limpiarTextoCentroMenu_(
    contexto.fila[colMarcas]
  );

  if (!textoMarcas) {
    throw new Error(
      'La fila seleccionada no contiene marcas.'
    );
  }

  const marcas = textoMarcas
    .split('|')
    .map(limpiarTextoCentroMenu_)
    .filter(Boolean);

  const marca = seleccionarMarcaCentroMenu_(marcas);

  if (!marca) {
    return;
  }

  if (
    typeof generarDetalleMarcaV52000_ !==
    'function'
  ) {
    throw new Error(
      'No se encontró generarDetalleMarcaV52000_. ' +
      'Instalá primero detalle_marca.gs.'
    );
  }

  generarDetalleMarcaV52000_(marca);
}


function obtenerContextoFilaCentroMenu_() {
  const ss = SpreadsheetApp.getActive();
  const sh = ss.getActiveSheet();
  const rango = ss.getActiveRange();

  if (
    !sh ||
    sh.getName() !== 'CENTRO_COMPRAS'
  ) {
    throw new Error(
      'Seleccioná una fila en CENTRO_COMPRAS.'
    );
  }

  if (
    !rango ||
    rango.getRow() < 2
  ) {
    throw new Error(
      'Seleccioná una fila debajo del encabezado.'
    );
  }

  const ultimaColumna = sh.getLastColumn();

  const encabezados = sh.getRange(
    1,
    1,
    1,
    ultimaColumna
  ).getDisplayValues()[0];

  const mapa = construirMapaEncabezadosCentroMenu_(
    encabezados
  );

  const fila = sh.getRange(
    rango.getRow(),
    1,
    1,
    ultimaColumna
  ).getDisplayValues()[0];

  return {
    ss: ss,
    sh: sh,
    rango: rango,
    mapa: mapa,
    fila: fila
  };
}


function seleccionarMarcaCentroMenu_(marcas) {
  const unicas = [];

  marcas.forEach(marca => {
    const clave = normalizarTextoCentroMenu_(marca);

    const existe = unicas.some(item =>
      normalizarTextoCentroMenu_(item) === clave
    );

    if (marca && !existe) {
      unicas.push(marca);
    }
  });

  if (unicas.length === 0) {
    return '';
  }

  if (unicas.length === 1) {
    return unicas[0];
  }

  const ui = SpreadsheetApp.getUi();

  const respuesta = ui.prompt(
    'Seleccionar marca',
    'La fila contiene varias marcas:\n\n' +
    unicas.join('\n') +
    '\n\nEscribí exactamente la marca que querés abrir.',
    ui.ButtonSet.OK_CANCEL
  );

  if (
    respuesta.getSelectedButton() !==
    ui.Button.OK
  ) {
    return '';
  }

  const ingresada = limpiarTextoCentroMenu_(
    respuesta.getResponseText()
  );

  const encontrada = unicas.find(marca =>
    normalizarTextoCentroMenu_(marca) ===
    normalizarTextoCentroMenu_(ingresada)
  );

  if (!encontrada) {
    throw new Error(
      'La marca ingresada no pertenece a la fila seleccionada.'
    );
  }

  return encontrada;
}


function abrirHojaCentroMenu_(nombreHoja, celda) {
  const ss = SpreadsheetApp.getActive();
  const sh = ss.getSheetByName(nombreHoja);

  if (!sh) {
    throw new Error(
      'No existe la hoja "' +
      nombreHoja +
      '".'
    );
  }

  sh.activate();
  sh.setActiveSelection(celda || 'A1');
}


function construirMapaEncabezadosCentroMenu_(encabezados) {
  const mapa = new Map();

  encabezados.forEach((valor, indice) => {
    const clave = normalizarTextoCentroMenu_(valor);

    if (clave) {
      mapa.set(clave, indice);
    }
  });

  return mapa;
}


function normalizarTextoCentroMenu_(valor) {
  return limpiarTextoCentroMenu_(valor)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/\s+/g, '_');
}


function limpiarTextoCentroMenu_(valor) {
  return String(
    valor === null ||
    valor === undefined
      ? ''
      : valor
  ).trim();
}
