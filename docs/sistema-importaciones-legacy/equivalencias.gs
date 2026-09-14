/*******************************************************
 * SII V2 - EQUIVALENCIAS DE SKU
 * Versión 0.2.005
 *******************************************************/


/**
 * Crea o actualiza:
 * - EQUIVALENCIAS_SKU
 * - PENDIENTES_SKU
 *
 * Luego completa automáticamente los SKU conocidos
 * dentro de DETALLE_IMPORTACIONES.
 */
function actualizarEquivalenciasSku() {
  const ss = SpreadsheetApp.getActive();

  prepararHojasEquivalencias_();
  completarSkuEnDetalle(false);
  generarPendientesSku_(false);
  actualizarProductos(false);

  ss.toast(
    'Equivalencias y pendientes de SKU actualizados.',
    'SII',
    6
  );
}


/**
 * Completa la columna SKU en DETALLE_IMPORTACIONES utilizando:
 *
 * PROVEEDOR + ITEM_PROVEEDOR
 *
 * No reemplaza un SKU ya cargado.
 */
function completarSkuEnDetalle(mostrarMensaje = true) {
  const ss = SpreadsheetApp.getActive();

  const shDetalle = obtenerHoja_(ss, SII_CFG.SHEETS.DETALLE);
  const shOrdenes = obtenerHoja_(ss, SII_CFG.SHEETS.ORDENES);
  const shEquivalencias = obtenerHoja_(ss, SII_CFG.SHEETS.EQUIVALENCIAS_SKU);
  const shSantiago = ss.getSheetByName('INFO_SANTIAGO');

  const datosDetalle = shDetalle.getDataRange().getDisplayValues();
  const datosOrdenes = shOrdenes.getDataRange().getDisplayValues();
  const datosEquivalencias = shEquivalencias.getDataRange().getDisplayValues();

  if (datosDetalle.length < 2) return;

  const hDetalle = mapaEncabezados_(datosDetalle[0]);
  const hOrdenes = mapaEncabezados_(datosOrdenes[0]);
  const hEquivalencias = mapaEncabezados_(datosEquivalencias[0]);

  const colOrdenDetalle = requerirColumna_(hDetalle, 'ID_ORDEN');
  const colMarcaDetalle = buscarColumna_(hDetalle, ['MARCA']);
  const colItem = buscarColumna_(hDetalle, ['ITEM', 'ITEM_PROVEEDOR', 'CODIGO_PROVEEDOR']);
  const colSku = buscarOAgregarColumna_(shDetalle, hDetalle, 'SKU');

  const colOrden = requerirColumna_(hOrdenes, 'ID_ORDEN');
  const colProveedorOrden = requerirColumna_(hOrdenes, 'PROVEEDOR');

  const proveedorPorOrden = new Map();
  datosOrdenes.slice(1).forEach(fila => {
    const idOrden = limpiarTexto_(fila[colOrden]);
    const proveedor = limpiarTexto_(fila[colProveedorOrden]);
    if (idOrden) proveedorPorOrden.set(normalizarClave_(idOrden), proveedor);
  });

  const mapaEquivalencias = new Map();

  if (datosEquivalencias.length > 1) {
    const colSkuEq = requerirColumna_(hEquivalencias, 'SKU');
    const colProveedorEq = requerirColumna_(hEquivalencias, 'PROVEEDOR');
    const colItemEq = buscarColumna_(hEquivalencias, ['ITEM_PROVEEDOR', 'ITEM']);
    const colActivoEq = hEquivalencias.get('ACTIVO');

    datosEquivalencias.slice(1).forEach(fila => {
      const sku = limpiarTexto_(fila[colSkuEq]);
      const proveedor = limpiarTexto_(fila[colProveedorEq]);
      const item = limpiarTexto_(fila[colItemEq]);
      const activo = colActivoEq === undefined
        ? 'SI'
        : limpiarTexto_(fila[colActivoEq]).toUpperCase();

      if (!sku || !item || activo === 'NO') return;
      mapaEquivalencias.set(generarClaveEquivalencia_(proveedor, item), sku);
    });
  }

  // INFO_SANTIAGO: CODIGO SANTIAGO = ITEM; CODIGO BAM/OCTOSIS = SKU.
  const mapaSantiagoPorItem = new Map();

  if (shSantiago && shSantiago.getLastRow() > 1) {
    const datosSantiago = shSantiago.getDataRange().getDisplayValues();
    const encabezadosSantiago = datosSantiago[0];

    const colCodArticulo = buscarColumnaFlexibleSantiago_(
      encabezadosSantiago,
      ['CODARTICULO']
    );

    const colCodigoBam = buscarColumnaFlexibleSantiago_(
      encabezadosSantiago,
      ['CODIGOBAMOCTOSIS', 'CODIGOBAM']
    );

    const colCodigoSan = buscarColumnaFlexibleSantiago_(
      encabezadosSantiago,
      [
        'CODIGOSANTIAGO',
        'CODIGOSAN'
      ]
    );

    datosSantiago.slice(1).forEach(fila => {
      const codigoSan = limpiarTexto_(fila[colCodigoSan]);
      const sku = limpiarTexto_(fila[colCodigoBam]);
      const codArticulo = limpiarTexto_(fila[colCodArticulo]);

      if (!codigoSan || !sku) return;

      const claveItem = normalizarCodigoSku_(codigoSan);
      if (!mapaSantiagoPorItem.has(claveItem)) mapaSantiagoPorItem.set(claveItem, []);

      mapaSantiagoPorItem.get(claveItem).push({
        codigoSan: codigoSan,
        sku: sku,
        codArticulo: codArticulo
      });
    });
  }

  const salidaSku = [];
  const nuevasEquivalencias = [];
  const clavesNuevas = new Set();

  let completadosEquivalencia = 0;
  let completadosSantiago = 0;
  let existentes = 0;
  let sinEquivalencia = 0;
  let ambiguosSantiago = 0;

  datosDetalle.slice(1).forEach(fila => {
    const skuActual = limpiarTexto_(fila[colSku]);
    const idOrden = limpiarTexto_(fila[colOrdenDetalle]);
    const item = limpiarTexto_(fila[colItem]);
    const marca = limpiarTexto_(fila[colMarcaDetalle]);

    if (skuActual) {
      salidaSku.push([skuActual]);
      existentes++;
      return;
    }

    if (!item) {
      salidaSku.push(['']);
      return;
    }

    const proveedor = proveedorPorOrden.get(normalizarClave_(idOrden)) || '';
    const claveEquivalencia = generarClaveEquivalencia_(proveedor, item);
    const skuEquivalencia = mapaEquivalencias.get(claveEquivalencia) || '';

    if (skuEquivalencia) {
      salidaSku.push([skuEquivalencia]);
      completadosEquivalencia++;
      return;
    }

    const candidatos = mapaSantiagoPorItem.get(normalizarCodigoSku_(item)) || [];
    let elegido = null;

    if (candidatos.length === 1) {
      elegido = candidatos[0];
    } else if (candidatos.length > 1 && marca) {
      const claveMarcaItem = normalizarCodigoSku_(marca + item);
      const porMarca = candidatos.filter(c =>
        normalizarCodigoSku_(c.codArticulo) === claveMarcaItem
      );
      if (porMarca.length === 1) elegido = porMarca[0];
    }

    if (elegido) {
      salidaSku.push([elegido.sku]);
      completadosSantiago++;

      if (
        claveEquivalencia &&
        !mapaEquivalencias.has(claveEquivalencia) &&
        !clavesNuevas.has(claveEquivalencia)
      ) {
        nuevasEquivalencias.push([
          elegido.sku,
          proveedor,
          item,
          marca,
          'SI',
          'Alta automática desde INFO_SANTIAGO',
          new Date(),
          new Date()
        ]);

        clavesNuevas.add(claveEquivalencia);
        mapaEquivalencias.set(claveEquivalencia, elegido.sku);
      }
      return;
    }

    salidaSku.push(['']);
    sinEquivalencia++;
    if (candidatos.length > 1) ambiguosSantiago++;
  });

  if (salidaSku.length > 0) {
    shDetalle.getRange(2, colSku + 1, salidaSku.length, 1).setValues(salidaSku);
  }

  if (nuevasEquivalencias.length > 0) {
    const filaInicial = Math.max(2, shEquivalencias.getLastRow() + 1);

    shEquivalencias
      .getRange(filaInicial, 1, nuevasEquivalencias.length, nuevasEquivalencias[0].length)
      .setValues(nuevasEquivalencias);

    shEquivalencias
      .getRange(filaInicial, 7, nuevasEquivalencias.length, 2)
      .setNumberFormat('dd/MM/yyyy HH:mm');
  }

  const resumen = {
    completadosEquivalencia: completadosEquivalencia,
    completadosSantiago: completadosSantiago,
    existentes: existentes,
    sinEquivalencia: sinEquivalencia,
    ambiguosSantiago: ambiguosSantiago,
    equivalenciasNuevas: nuevasEquivalencias.length
  };

  if (mostrarMensaje) {
    ss.toast(
      [
        `Por equivalencias: ${completadosEquivalencia}`,
        `Desde INFO_SANTIAGO: ${completadosSantiago}`,
        `Ya existentes: ${existentes}`,
        `Sin equivalencia: ${sinEquivalencia}`,
        `Ambiguos: ${ambiguosSantiago}`,
        `Nuevas guardadas: ${nuevasEquivalencias.length}`
      ].join(' | '),
      'Completar SKU en detalle',
      10
    );
  }

  return resumen;
}


/**
 * Normaliza códigos para comparar ITEM, CODIGO SAN y Cod. Articulo.
 */
function buscarColumnaFlexibleSantiago_(encabezados, clavesEsperadas) {
  const normalizados = encabezados.map(valor =>
    String(valor === null || valor === undefined ? '' : valor)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '')
  );

  for (const clave of clavesEsperadas) {
    const indice = normalizados.indexOf(clave);

    if (indice !== -1) {
      return indice;
    }
  }

  throw new Error(
    'No se encontró la columna de INFO_SANTIAGO. ' +
    'Buscadas: ' + clavesEsperadas.join(', ') +
    '. Encabezados detectados: ' +
    encabezados.join(' | ')
  );
}


function normalizarCodigoSku_(valor) {
  return limpiarTexto_(valor)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
}


/**
 * Genera la hoja PENDIENTES_SKU agrupando los ITEM
 * todavía no vinculados a un SKU.
 */
function generarPendientesSku_(mostrarMensaje = true) {
  const ss = SpreadsheetApp.getActive();

  const shDetalle = obtenerHoja_(
    ss,
    SII_CFG.SHEETS.DETALLE
  );

  const shOrdenes = obtenerHoja_(
    ss,
    SII_CFG.SHEETS.ORDENES
  );

  const shPendientes = obtenerHoja_(
    ss,
    SII_CFG.SHEETS.PENDIENTES_SKU
  );

  const datosDetalle = shDetalle
    .getDataRange()
    .getDisplayValues();

  const datosOrdenes = shOrdenes
    .getDataRange()
    .getDisplayValues();

  if (datosDetalle.length < 2) {
    escribirTabla_(shPendientes, []);
    return;
  }

  const hDetalle = mapaEncabezados_(datosDetalle[0]);
  const hOrdenes = mapaEncabezados_(datosOrdenes[0]);

  const colOrdenDetalle = requerirColumna_(
    hDetalle,
    'ID_ORDEN'
  );

  const colMarca = requerirColumna_(
    hDetalle,
    'MARCA'
  );

  const colItem = buscarColumna_(
    hDetalle,
    ['ITEM', 'ITEM_PROVEEDOR', 'CODIGO_PROVEEDOR']
  );

  const colSku = buscarColumna_(
    hDetalle,
    ['SKU']
  );

  const colCantidad = buscarColumna_(
    hDetalle,
    ['CANTIDAD']
  );

  const colOrden = requerirColumna_(
    hOrdenes,
    'ID_ORDEN'
  );

  const colProveedor = requerirColumna_(
    hOrdenes,
    'PROVEEDOR'
  );

  const proveedorPorOrden = new Map();

  datosOrdenes.slice(1).forEach(fila => {
    const idOrden = limpiarTexto_(fila[colOrden]);
    const proveedor = limpiarTexto_(
      fila[colProveedor]
    );

    if (idOrden) {
      proveedorPorOrden.set(
        normalizarClave_(idOrden),
        proveedor
      );
    }
  });

  const pendientes = new Map();

  datosDetalle.slice(1).forEach(fila => {
    const sku = limpiarTexto_(fila[colSku]);
    const item = limpiarTexto_(fila[colItem]);

    if (sku || !item) return;

    const idOrden = limpiarTexto_(
      fila[colOrdenDetalle]
    );

    const proveedor =
      proveedorPorOrden.get(
        normalizarClave_(idOrden)
      ) || '';

    const marca = limpiarTexto_(fila[colMarca]);
    const cantidad = numero_(fila[colCantidad]);

    const clave = generarClaveEquivalencia_(
      proveedor,
      item
    );

    if (!pendientes.has(clave)) {
      pendientes.set(clave, {
        proveedor,
        marca,
        item,
        cantidadLineas: 0,
        cantidadTotal: 0,
        ultimaOrden: '',
        skuAsignar: '',
        observaciones: ''
      });
    }

    const reg = pendientes.get(clave);

    reg.cantidadLineas++;
    reg.cantidadTotal += cantidad;
    reg.ultimaOrden = idOrden;
  });

  const salida = [...pendientes.values()]
    .sort((a, b) => {
      const proveedor = a.proveedor.localeCompare(
        b.proveedor
      );

      if (proveedor !== 0) return proveedor;

      return a.item.localeCompare(b.item);
    })
    .map(reg => [
      reg.proveedor,
      reg.marca,
      reg.item,
      reg.cantidadLineas,
      reg.cantidadTotal,
      reg.ultimaOrden,
      '',
      '',
      new Date()
    ]);

  escribirTabla_(shPendientes, salida);

  if (salida.length > 0) {
    shPendientes
      .getRange(2, 9, salida.length, 1)
      .setNumberFormat('dd/MM/yyyy HH:mm');
  }

  shPendientes.setFrozenRows(1);
  shPendientes.autoResizeColumns(
    1,
    shPendientes.getLastColumn()
  );

  if (mostrarMensaje) {
    SpreadsheetApp.getUi().alert(
      'Pendientes de SKU',
      `${salida.length} ITEM requieren asociación.`,
      SpreadsheetApp.getUi().ButtonSet.OK
    );
  }
}


/**
 * Toma los SKU cargados manualmente en PENDIENTES_SKU
 * y los incorpora en EQUIVALENCIAS_SKU.
 */
function guardarEquivalenciasPendientes() {
  const ss = SpreadsheetApp.getActive();

  const shPendientes = obtenerHoja_(
    ss,
    SII_CFG.SHEETS.PENDIENTES_SKU
  );

  const shEquivalencias = obtenerHoja_(
    ss,
    SII_CFG.SHEETS.EQUIVALENCIAS_SKU
  );

  const pendientes = leerFilasComoObjetos_(
    shPendientes
  );

  const equivalencias = leerFilasComoObjetos_(
    shEquivalencias
  );

  const mapaExistentes = new Map();

  equivalencias.forEach(reg => {
    const clave = generarClaveEquivalencia_(
      reg.PROVEEDOR,
      reg.ITEM_PROVEEDOR
    );

    if (clave) mapaExistentes.set(clave, reg);
  });

  let agregadas = 0;
  let actualizadas = 0;
  let omitidas = 0;

  pendientes.forEach(reg => {
    const sku = limpiarTexto_(reg.SKU_ASIGNAR);
    const proveedor = limpiarTexto_(reg.PROVEEDOR);
    const item = limpiarTexto_(reg.ITEM_PROVEEDOR);
    const marca = limpiarTexto_(reg.MARCA);

    if (!sku || !item) {
      omitidas++;
      return;
    }

    const clave = generarClaveEquivalencia_(
      proveedor,
      item
    );

    if (mapaExistentes.has(clave)) {
      const existente = mapaExistentes.get(clave);
      existente.SKU = sku;
      existente.MARCA = marca ||
        limpiarTexto_(existente.MARCA);
      existente.ACTIVO = 'SI';
      existente.FECHA_ACTUALIZACION = new Date();

      actualizadas++;
    } else {
      const nuevo = {
        SKU: sku,
        PROVEEDOR: proveedor,
        ITEM_PROVEEDOR: item,
        MARCA: marca,
        ACTIVO: 'SI',
        OBSERVACIONES:
          limpiarTexto_(reg.OBSERVACIONES),
        FECHA_ALTA: new Date(),
        FECHA_ACTUALIZACION: new Date()
      };

      equivalencias.push(nuevo);
      mapaExistentes.set(clave, nuevo);

      agregadas++;
    }
  });

  const salida = equivalencias
    .filter(reg =>
      limpiarTexto_(reg.ITEM_PROVEEDOR)
    )
    .sort((a, b) => {
      const proveedor =
        limpiarTexto_(a.PROVEEDOR).localeCompare(
          limpiarTexto_(b.PROVEEDOR)
        );

      if (proveedor !== 0) return proveedor;

      return limpiarTexto_(a.ITEM_PROVEEDOR)
        .localeCompare(
          limpiarTexto_(b.ITEM_PROVEEDOR)
        );
    })
    .map(reg => [
      limpiarTexto_(reg.SKU),
      limpiarTexto_(reg.PROVEEDOR),
      limpiarTexto_(reg.ITEM_PROVEEDOR),
      limpiarTexto_(reg.MARCA),
      limpiarTexto_(reg.ACTIVO) || 'SI',
      limpiarTexto_(reg.OBSERVACIONES),
      reg.FECHA_ALTA || new Date(),
      new Date()
    ]);

  escribirTabla_(shEquivalencias, salida);

  if (salida.length > 0) {
    shEquivalencias
      .getRange(2, 7, salida.length, 2)
      .setNumberFormat('dd/MM/yyyy HH:mm');
  }

  completarSkuEnDetalle(false);
  generarPendientesSku_(false);

  SpreadsheetApp.getUi().alert(
    'Guardar equivalencias',
    [
      `Equivalencias nuevas: ${agregadas}`,
      `Equivalencias actualizadas: ${actualizadas}`,
      `Filas omitidas sin SKU: ${omitidas}`
    ].join('\n'),
    SpreadsheetApp.getUi().ButtonSet.OK
  );
}


/**
 * Inicializa las hojas del módulo.
 */
function prepararHojasEquivalencias_() {
  const ss = SpreadsheetApp.getActive();

  crearHojaSiNoExiste_(
    ss,
    SII_CFG.SHEETS.EQUIVALENCIAS_SKU,
    [
      'SKU',
      'PROVEEDOR',
      'ITEM_PROVEEDOR',
      'MARCA',
      'ACTIVO',
      'OBSERVACIONES',
      'FECHA_ALTA',
      'FECHA_ACTUALIZACION'
    ]
  );

  crearHojaSiNoExiste_(
    ss,
    SII_CFG.SHEETS.PENDIENTES_SKU,
    [
      'PROVEEDOR',
      'MARCA',
      'ITEM_PROVEEDOR',
      'CANTIDAD_LINEAS',
      'CANTIDAD_TOTAL',
      'ULTIMA_ORDEN',
      'SKU_ASIGNAR',
      'OBSERVACIONES',
      'FECHA_DETECCION'
    ]
  );

  const shEquivalencias = obtenerHoja_(
    ss,
    SII_CFG.SHEETS.EQUIVALENCIAS_SKU
  );

  const shPendientes = obtenerHoja_(
    ss,
    SII_CFG.SHEETS.PENDIENTES_SKU
  );

  shEquivalencias
    .getRange('E2:E')
    .setDataValidation(
      SpreadsheetApp
        .newDataValidation()
        .requireValueInList(
          ['SI', 'NO'],
          true
        )
        .setAllowInvalid(false)
        .build()
    );

  shEquivalencias.setFrozenRows(1);
  shPendientes.setFrozenRows(1);
}


/**
 * Busca una columna utilizando varias denominaciones posibles.
 */
function buscarColumna_(mapa, nombres) {
  for (const nombre of nombres) {
    const clave = normalizar_(nombre);

    if (mapa.has(clave)) {
      return mapa.get(clave);
    }
  }

  throw new Error(
    `No se encontró ninguna de estas columnas: ` +
    nombres.join(', ')
  );
}


/**
 * Busca una columna y, si no existe, la agrega al final.
 */
function buscarOAgregarColumna_(
  sh,
  mapaActual,
  nombre
) {
  const clave = normalizar_(nombre);

  if (mapaActual.has(clave)) {
    return mapaActual.get(clave);
  }

  const nuevaColumna = sh.getLastColumn() + 1;

  sh.getRange(1, nuevaColumna)
    .setValue(nombre);

  formatearEncabezado_(sh);

  return nuevaColumna - 1;
}


/**
 * Clave compuesta proveedor + ITEM.
 */
function generarClaveEquivalencia_(
  proveedor,
  item
) {
  return [
    normalizarClave_(proveedor),
    normalizarClave_(item)
  ].join('||');
}


/**
 * Normalización para claves sin convertir espacios en "_".
 */
function normalizarClave_(valor) {
  return limpiarTexto_(valor)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function corregirEncabezadosPendientesSku() {
  const ss = SpreadsheetApp.getActive();
  const sh = ss.getSheetByName(
    SII_CFG.SHEETS.PENDIENTES_SKU
  );

  if (!sh) {
    throw new Error('No existe la hoja PENDIENTES_SKU.');
  }

  const encabezados = [[
    'PROVEEDOR',
    'MARCA',
    'ITEM_PROVEEDOR',
    'CANTIDAD_LINEAS',
    'CANTIDAD_TOTAL',
    'ULTIMA_ORDEN',
    'SKU_ASIGNAR',
    'OBSERVACIONES',
    'FECHA_DETECCION'
  ]];

  sh.getRange(1, 1, 1, encabezados[0].length)
    .setValues(encabezados);

  formatearEncabezado_(sh);
  sh.setFrozenRows(1);
  sh.autoResizeColumns(1, encabezados[0].length);

  ss.toast(
    'Encabezados de PENDIENTES_SKU corregidos.',
    'SII',
    5
  );
}
