/**************************************************************
 * SII V4.3 - MAESTRO DE PRODUCTOS Y EQUIVALENCIAS
 *
 * Funciones públicas:
 * - buscarNuevasEquivalencias()
 * - actualizarEquivalenciasDesdePendientes()
 *
 * Criterios:
 * - La equivalencia se identifica por PROVEEDOR + ITEM.
 * - MARCA es obligatoria para resolver.
 * - Si el SKU no existe en PRODUCTOS, se crea automáticamente.
 * - PRODUCTOS.PROVEEDOR queda vacío: el proveedor es transaccional.
 **************************************************************/

const SII_EQ_V43 = {
  HOJA_PENDIENTES: 'PENDIENTES_EQUIVALENCIA',

  ENCABEZADOS_PENDIENTES: [
    'ITEM_PROVEEDOR',
    'MARCA',
    'PROVEEDOR',
    'ID_ORDEN',
    'SKU',
    'DESCRIPCION',
    'ESTADO',
    'OBSERVACIONES',
    'FECHA_DETECCION',
    'FECHA_RESOLUCION'
  ],

  ENCABEZADOS_EQUIVALENCIAS: [
    'SKU',
    'PROVEEDOR',
    'ITEM_PROVEEDOR',
    'MARCA',
    'ACTIVO',
    'OBSERVACIONES'
  ],

  ESTADOS: {
    PENDIENTE: 'PENDIENTE',
    RESUELTA: 'RESUELTA',
    ERROR: 'ERROR'
  }
};


function buscarNuevasEquivalencias() {
  const ss = SpreadsheetApp.getActive();

  const shDetalle = obtenerHoja_(
    ss,
    SII_CFG.SHEETS.DETALLE
  );

  const shOrdenes = obtenerHoja_(
    ss,
    SII_CFG.SHEETS.ORDENES
  );

  const shEquivalencias = obtenerHoja_(
    ss,
    SII_CFG.SHEETS.EQUIVALENCIAS_SKU
  );

  let shPendientes =
    ss.getSheetByName(
      SII_EQ_V43.HOJA_PENDIENTES
    );

  if (!shPendientes) {
    shPendientes =
      ss.insertSheet(
        SII_EQ_V43.HOJA_PENDIENTES
      );
  }

  asegurarEstructuraPendientesV43_(
    shPendientes
  );

  const detalle =
    leerFilasComoObjetos_(shDetalle);

  const ordenes =
    leerFilasComoObjetos_(shOrdenes);

  const equivalencias =
    leerFilasComoObjetos_(
      shEquivalencias
    );

  const pendientesExistentes =
    leerFilasComoObjetos_(
      shPendientes
    );

  const proveedorPorOrden =
    construirProveedorPorOrdenV43_(
      ordenes
    );

  const clavesExistentes =
    construirSetClavesEquivalenciaV43_(
      equivalencias
    );

  const pendientePorClave =
    construirMapaPendientesV43_(
      pendientesExistentes
    );

  const nuevosPorClave =
    new Map();

  const fechaDeteccion =
    new Date();

  detalle.forEach(reg => {
    const itemTexto =
      limpiarTexto_(
        primerValorNoVacio_(
          reg.ITEM,
          reg.ITEM_PROVEEDOR,
          reg.CODIGO_PROVEEDOR,
          reg.CODIGO_ITEM
        )
      );

    if (!normalizarItemV43_(itemTexto)) {
      return;
    }

    const idOrdenTexto =
      limpiarTexto_(
        primerValorNoVacio_(
          reg.ID_ORDEN,
          reg.NUMERO_ORDEN,
          reg.NUMERO_PI,
          reg.ORDEN,
          reg.PI
        )
      );

    const idOrdenClave =
      normalizarIdOrdenV43_(
        idOrdenTexto
      );

    const proveedor =
      limpiarTexto_(
        reg.PROVEEDOR
      ) ||
      limpiarTexto_(
        proveedorPorOrden.get(
          idOrdenClave
        )
      );

    const clave =
      construirClaveEquivalenciaV43_(
        proveedor,
        itemTexto
      );

    if (
      clavesExistentes.has(clave)
    ) {
      return;
    }

    const marca =
      limpiarTexto_(
        reg.MARCA
      );

    const descripcion =
      limpiarTexto_(
        primerValorNoVacio_(
          reg.DESCRIPCION,
          reg.DESCRIPCIÓN,
          reg.DETALLE,
          reg.PRODUCTO
        )
      );

    if (!nuevosPorClave.has(clave)) {
      nuevosPorClave.set(
        clave,
        {
          item: itemTexto,
          marca: marca,
          proveedor: proveedor,
          idOrden: idOrdenTexto,
          descripcion: descripcion,
          fechaDeteccion:
            fechaDeteccion
        }
      );

    } else {
      const actual =
        nuevosPorClave.get(clave);

      if (!actual.marca && marca) {
        actual.marca = marca;
      }

      if (
        !actual.descripcion &&
        descripcion
      ) {
        actual.descripcion =
          descripcion;
      }
    }
  });

  const salida = [];

  nuevosPorClave.forEach(
    (nuevo, clave) => {
      const anterior =
        pendientePorClave.get(clave) ||
        {};

      if (
        normalizarTextoV43_(
          anterior.ESTADO
        ) ===
        SII_EQ_V43.ESTADOS.RESUELTA
      ) {
        return;
      }

      salida.push([
        nuevo.item,
        nuevo.marca ||
          limpiarTexto_(
            anterior.MARCA
          ),
        nuevo.proveedor ||
          limpiarTexto_(
            anterior.PROVEEDOR
          ),
        nuevo.idOrden ||
          limpiarTexto_(
            anterior.ID_ORDEN
          ),
        limpiarTexto_(
          anterior.SKU
        ),
        nuevo.descripcion ||
          limpiarTexto_(
            anterior.DESCRIPCION
          ),
        normalizarTextoV43_(
          anterior.ESTADO
        ) ||
          SII_EQ_V43.ESTADOS.PENDIENTE,
        limpiarTexto_(
          anterior.OBSERVACIONES
        ),
        anterior.FECHA_DETECCION ||
          nuevo.fechaDeteccion,
        anterior.FECHA_RESOLUCION ||
          ''
      ]);
    }
  );

  salida.sort((a, b) => {
    const proveedorA =
      normalizarTextoV43_(a[2]);

    const proveedorB =
      normalizarTextoV43_(b[2]);

    if (proveedorA !== proveedorB) {
      return proveedorA.localeCompare(
        proveedorB
      );
    }

    return normalizarTextoV43_(a[0])
      .localeCompare(
        normalizarTextoV43_(b[0])
      );
  });

  escribirPendientesV43_(
    shPendientes,
    salida
  );

  aplicarFormatoPendientesV43_(
    shPendientes,
    salida.length
  );

  ss.toast(
    salida.length +
      ' equivalencias pendientes.',
    'SII V4.3',
    6
  );

  return {
    pendientes: salida.length,
    equivalenciasExistentes:
      clavesExistentes.size
  };
}


function actualizarEquivalenciasDesdePendientes() {
  const ss = SpreadsheetApp.getActive();

  const shPendientes = obtenerHoja_(
    ss,
    SII_EQ_V43.HOJA_PENDIENTES
  );

  const shEquivalencias = obtenerHoja_(
    ss,
    SII_CFG.SHEETS.EQUIVALENCIAS_SKU
  );

  const shProductos = obtenerHoja_(
    ss,
    SII_CFG.SHEETS.PRODUCTOS
  );

  asegurarEstructuraPendientesV43_(
    shPendientes
  );

  asegurarEstructuraEquivalenciasV43_(
    shEquivalencias
  );

  const pendientes =
    leerFilasComoObjetos_(
      shPendientes
    );

  const equivalencias =
    leerFilasComoObjetos_(
      shEquivalencias
    );

  const productos =
    leerFilasComoObjetos_(
      shProductos
    );

  const productoPorSku =
    new Map();

  productos.forEach((reg, indice) => {
    const sku =
      normalizarSkuV43_(
        reg.SKU
      );

    if (!sku) return;

    productoPorSku.set(
      sku,
      {
        fila: indice + 2,
        registro: reg
      }
    );
  });

  const clavesExistentes =
    construirSetClavesEquivalenciaV43_(
      equivalencias
    );

  const nuevasEquivalencias = [];
  const nuevosProductos = [];
  const actualizacionesProducto = [];
  const resultadoPendientes = [];

  const fechaResolucion =
    new Date();

  let incorporadas = 0;
  let errores = 0;
  let sinSku = 0;
  let yaExistentes = 0;
  let productosCreados = 0;
  let productosActualizados = 0;

  pendientes.forEach(reg => {
    const itemTexto =
      limpiarTexto_(
        reg.ITEM_PROVEEDOR
      );

    const proveedor =
      limpiarTexto_(
        reg.PROVEEDOR
      );

    const marca =
      limpiarTexto_(
        reg.MARCA
      );

    const skuTexto =
      limpiarTexto_(
        reg.SKU
      );

    const itemClave =
      normalizarItemV43_(
        itemTexto
      );

    const skuClave =
      normalizarSkuV43_(
        skuTexto
      );

    const claveEquivalencia =
      construirClaveEquivalenciaV43_(
        proveedor,
        itemTexto
      );

    let estado =
      normalizarTextoV43_(
        reg.ESTADO
      ) ||
      SII_EQ_V43.ESTADOS.PENDIENTE;

    let observaciones =
      limpiarTexto_(
        reg.OBSERVACIONES
      );

    let fechaResuelta =
      reg.FECHA_RESOLUCION ||
      '';

    if (!itemClave) {
      estado =
        SII_EQ_V43.ESTADOS.ERROR;

      observaciones =
        'ITEM_PROVEEDOR vacío.';

      errores++;

    } else if (!skuClave) {
      estado =
        SII_EQ_V43.ESTADOS.PENDIENTE;

      observaciones =
        'Completar SKU.';

      sinSku++;

    } else if (!marca) {
      estado =
        SII_EQ_V43.ESTADOS.ERROR;

      observaciones =
        'Debe completar MARCA.';

      errores++;

    } else if (
      clavesExistentes.has(
        claveEquivalencia
      )
    ) {
      estado =
        SII_EQ_V43.ESTADOS.RESUELTA;

      observaciones =
        'La equivalencia proveedor + ITEM ya existía.';

      fechaResuelta =
        fechaResuelta ||
        fechaResolucion;

      yaExistentes++;

    } else {
      nuevasEquivalencias.push([
        skuTexto,
        proveedor,
        itemTexto,
        marca,
        'SI',
        'Alta desde PENDIENTES_EQUIVALENCIA'
      ]);

      clavesExistentes.add(
        claveEquivalencia
      );

      const productoExistente =
        productoPorSku.get(
          skuClave
        );

      if (!productoExistente) {
        nuevosProductos.push(
          construirFilaProductoV43_({
            sku: skuTexto,
            marca: marca,
            descripcion:
              limpiarTexto_(
                reg.DESCRIPCION
              )
          })
        );

        productoPorSku.set(
          skuClave,
          {
            fila: null,
            registro: {
              SKU: skuTexto,
              MARCA: marca
            }
          }
        );

        productosCreados++;

      } else {
        const registroProducto =
          productoExistente.registro;

        const marcaActual =
          limpiarTexto_(
            registroProducto.MARCA
          );

        const descripcionActual =
          limpiarTexto_(
            registroProducto.DESCRIPCION
          );

        const descripcionNueva =
          limpiarTexto_(
            reg.DESCRIPCION
          );

        if (
          productoExistente.fila &&
          (
            !marcaActual ||
            (
              !descripcionActual &&
              descripcionNueva
            )
          )
        ) {
          actualizacionesProducto.push({
            fila:
              productoExistente.fila,
            marca:
              marcaActual ||
              marca,
            descripcion:
              descripcionActual ||
              descripcionNueva
          });

          productosActualizados++;
        }
      }

      estado =
        SII_EQ_V43.ESTADOS.RESUELTA;

      observaciones =
        'Equivalencia incorporada y PRODUCTOS sincronizado.';

      fechaResuelta =
        fechaResolucion;

      incorporadas++;
    }

    resultadoPendientes.push([
      itemTexto,
      marca,
      proveedor,
      limpiarTexto_(
        reg.ID_ORDEN
      ),
      skuTexto,
      limpiarTexto_(
        reg.DESCRIPCION
      ),
      estado,
      observaciones,
      reg.FECHA_DETECCION ||
        '',
      fechaResuelta
    ]);
  });

  if (
    nuevasEquivalencias.length > 0
  ) {
    const filaInicial =
      Math.max(
        2,
        shEquivalencias.getLastRow() + 1
      );

    shEquivalencias.getRange(
      filaInicial,
      1,
      nuevasEquivalencias.length,
      SII_EQ_V43
        .ENCABEZADOS_EQUIVALENCIAS
        .length
    ).setValues(
      nuevasEquivalencias
    );
  }

  escribirNuevosProductosV43_(
    shProductos,
    nuevosProductos
  );

  actualizarProductosExistentesV43_(
    shProductos,
    actualizacionesProducto
  );

  escribirPendientesV43_(
    shPendientes,
    resultadoPendientes
  );

  aplicarFormatoPendientesV43_(
    shPendientes,
    resultadoPendientes.length
  );

  aplicarFormatoEquivalenciasV43_(
    shEquivalencias
  );

  ss.toast(
    incorporadas +
      ' equivalencias. ' +
      productosCreados +
      ' productos creados. ' +
      errores +
      ' errores.',
    'SII V4.3',
    8
  );

  return {
    incorporadas: incorporadas,
    errores: errores,
    sinSku: sinSku,
    yaExistentes:
      yaExistentes,
    productosCreados:
      productosCreados,
    productosActualizados:
      productosActualizados
  };
}


function construirProveedorPorOrdenV43_(
  ordenes
) {
  const mapa = new Map();

  ordenes.forEach(reg => {
    const id =
      normalizarIdOrdenV43_(
        primerValorNoVacio_(
          reg.ID_ORDEN,
          reg.NUMERO_ORDEN,
          reg.NUMERO_PI,
          reg.ORDEN,
          reg.PI
        )
      );

    const proveedor =
      limpiarTexto_(
        reg.PROVEEDOR
      );

    if (id && proveedor) {
      mapa.set(
        id,
        proveedor
      );
    }
  });

  return mapa;
}


function construirClaveEquivalenciaV43_(
  proveedor,
  item
) {
  return (
    normalizarTextoV43_(proveedor) +
    '|' +
    normalizarItemV43_(item)
  );
}


function construirSetClavesEquivalenciaV43_(
  equivalencias
) {
  const claves = new Set();

  equivalencias.forEach(reg => {
    const item =
      primerValorNoVacio_(
        reg.ITEM_PROVEEDOR,
        reg.ITEM,
        reg.CODIGO_PROVEEDOR,
        reg.CODIGO_ORIGEN,
        reg.CODIGO_ITEM
      );

    if (!normalizarItemV43_(item)) {
      return;
    }

    claves.add(
      construirClaveEquivalenciaV43_(
        reg.PROVEEDOR,
        item
      )
    );
  });

  return claves;
}


function construirMapaPendientesV43_(
  pendientes
) {
  const mapa = new Map();

  pendientes.forEach(reg => {
    if (
      !normalizarItemV43_(
        reg.ITEM_PROVEEDOR
      )
    ) {
      return;
    }

    mapa.set(
      construirClaveEquivalenciaV43_(
        reg.PROVEEDOR,
        reg.ITEM_PROVEEDOR
      ),
      reg
    );
  });

  return mapa;
}


function construirFilaProductoV43_(
  datos
) {
  /*
   * PRODUCTOS:
   * A SKU
   * B MARCA
   * C PROVEEDOR
   * D DESCRIPCION
   * E FAMILIA
   * F SUBFAMILIA
   * G UNIDAD
   * H ACTIVO
   * I COSTO USD
   * J VOLUMEN M3
   * K PESO
   * L MOQ
   * M OBSERVACIONES
   * N ESTADO_ALTA
   *
   * PROVEEDOR queda vacío porque se obtiene por orden.
   */
  return [
    datos.sku,
    datos.marca,
    '',
    datos.descripcion ||
      '',
    '',
    '',
    '',
    'SI',
    '',
    '',
    '',
    '',
    'Alta automática desde equivalencias',
    'PENDIENTE'
  ];
}


function escribirNuevosProductosV43_(
  shProductos,
  filas
) {
  if (!filas.length) {
    return;
  }

  const filaInicial =
    Math.max(
      2,
      shProductos.getLastRow() + 1
    );

  shProductos.getRange(
    filaInicial,
    1,
    filas.length,
    14
  ).setValues(filas);
}


function actualizarProductosExistentesV43_(
  shProductos,
  actualizaciones
) {
  actualizaciones.forEach(reg => {
    shProductos.getRange(
      reg.fila,
      2
    ).setValue(
      reg.marca
    );

    shProductos.getRange(
      reg.fila,
      4
    ).setValue(
      reg.descripcion
    );
  });
}


function asegurarEstructuraPendientesV43_(
  sh
) {
  const columnas =
    SII_EQ_V43
      .ENCABEZADOS_PENDIENTES
      .length;

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

  sh.getRange(
    1,
    1,
    1,
    columnas
  ).setValues([
    SII_EQ_V43
      .ENCABEZADOS_PENDIENTES
  ]);
}


function asegurarEstructuraEquivalenciasV43_(
  sh
) {
  const columnas =
    SII_EQ_V43
      .ENCABEZADOS_EQUIVALENCIAS
      .length;

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

  sh.getRange(
    1,
    1,
    1,
    columnas
  ).setValues([
    SII_EQ_V43
      .ENCABEZADOS_EQUIVALENCIAS
  ]);
}


function escribirPendientesV43_(
  sh,
  salida
) {
  const columnas =
    SII_EQ_V43
      .ENCABEZADOS_PENDIENTES
      .length;

  const filtro =
    sh.getFilter();

  if (filtro) {
    filtro.remove();
  }

  const filasLimpiar =
    Math.max(
      sh.getLastRow(),
      salida.length + 1
    );

  if (filasLimpiar > 1) {
    sh.getRange(
      2,
      1,
      filasLimpiar - 1,
      columnas
    ).clearContent();
  }

  sh.getRange(
    1,
    1,
    1,
    columnas
  ).setValues([
    SII_EQ_V43
      .ENCABEZADOS_PENDIENTES
  ]);

  if (salida.length > 0) {
    sh.getRange(
      2,
      1,
      salida.length,
      columnas
    ).setValues(
      salida
    );

    sh.getRange(
      1,
      1,
      salida.length + 1,
      columnas
    ).createFilter();
  }
}


function aplicarFormatoPendientesV43_(
  sh,
  cantidadFilas
) {
  formatearEncabezado_(sh);
  sh.setFrozenRows(1);

  const anchos = [
    160, 120, 260, 150, 160,
    320, 110, 330, 145, 145
  ];

  anchos.forEach(
    (ancho, indice) => {
      sh.setColumnWidth(
        indice + 1,
        ancho
      );
    }
  );

  if (cantidadFilas <= 0) {
    sh.setConditionalFormatRules([]);
    return;
  }

  sh.getRange(
    2,
    6,
    cantidadFilas,
    1
  ).setWrap(true);

  sh.getRange(
    2,
    8,
    cantidadFilas,
    1
  ).setWrap(true);

  sh.getRange(
    2,
    9,
    cantidadFilas,
    2
  ).setNumberFormat(
    'dd/MM/yyyy HH:mm'
  );

  const rangoEstado =
    sh.getRange(
      2,
      7,
      cantidadFilas,
      1
    );

  const reglas = [
    SpreadsheetApp
      .newConditionalFormatRule()
      .whenTextEqualTo(
        SII_EQ_V43.ESTADOS.PENDIENTE
      )
      .setBackground('#FFF2CC')
      .setFontColor('#7F6000')
      .setRanges([rangoEstado])
      .build(),

    SpreadsheetApp
      .newConditionalFormatRule()
      .whenTextEqualTo(
        SII_EQ_V43.ESTADOS.RESUELTA
      )
      .setBackground('#D9EAD3')
      .setFontColor('#274E13')
      .setRanges([rangoEstado])
      .build(),

    SpreadsheetApp
      .newConditionalFormatRule()
      .whenTextEqualTo(
        SII_EQ_V43.ESTADOS.ERROR
      )
      .setBackground('#F4CCCC')
      .setFontColor('#9C0006')
      .setRanges([rangoEstado])
      .build()
  ];

  sh.setConditionalFormatRules(
    reglas
  );
}


function aplicarFormatoEquivalenciasV43_(
  sh
) {
  formatearEncabezado_(sh);
  sh.setFrozenRows(1);

  [
    160, 260, 170,
    130, 90, 310
  ].forEach(
    (ancho, indice) => {
      sh.setColumnWidth(
        indice + 1,
        ancho
      );
    }
  );
}


function normalizarItemV43_(valor) {
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
    .replace(/[^A-Z0-9]/g, '');
}


function normalizarSkuV43_(valor) {
  return normalizarItemV43_(
    valor
  );
}


function normalizarIdOrdenV43_(
  valor
) {
  return normalizarItemV43_(
    valor
  );
}


function normalizarTextoV43_(valor) {
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
    .replace(/\s+/g, ' ');
}
