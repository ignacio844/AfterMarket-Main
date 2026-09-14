/**************************************************************
 * SII V6.3.007
 * CENTRO INTELIGENTE DE COMPRAS
 *
 * Fuente principal:
 * - PLAN_COMPRAS
 *
 * La pantalla no recalcula todos los modelos SKU.
 * Usa la información consolidada de PLAN_COMPRAS para mantener
 * una respuesta rápida y abre la Ficha SKU Ejecutiva para el
 * análisis detallado.
 *
 * Archivo HTML requerido:
 * - centro_compras_inteligente_ui
 *
 * Funciones públicas:
 * - abrirCentroComprasInteligente()
 * - obtenerCentroComprasInteligente(filtros)
 * - abrirFichaDesdeCentroCompras(sku)
 **************************************************************/

const SII_CENTRO_COMPRAS_V63000 = {
  VERSION: '6.3.007',
  HTML: 'centro_compras_inteligente_ui',
  HOJA_PLAN: 'PLAN_COMPRAS',
  ANCHO: 1320,
  ALTO: 780,
  LIMITE_DEFAULT: 500
};


/**
 * Abre el Centro Inteligente de Compras.
 */
function abrirCentroComprasInteligente() {
  const template =
    HtmlService.createTemplateFromFile(
      SII_CENTRO_COMPRAS_V63000.HTML
    );

  template.version =
    SII_CENTRO_COMPRAS_V63000.VERSION;

  const html =
    template.evaluate()
      .setWidth(
        SII_CENTRO_COMPRAS_V63000.ANCHO
      )
      .setHeight(
        SII_CENTRO_COMPRAS_V63000.ALTO
      );

  SpreadsheetApp
    .getUi()
    .showModalDialog(
      html,
      'Centro Inteligente de Compras'
    );
}


/**
 * Devuelve resumen, filtros y filas.
 */
function obtenerCentroComprasInteligente(
  filtros
) {
  const inicio = Date.now();
  const ss = SpreadsheetApp.getActive();

  const nombreHoja =
    cciNombreHoja_(
      'PLAN_COMPRAS',
      SII_CENTRO_COMPRAS_V63000
        .HOJA_PLAN
    );

  const sh =
    ss.getSheetByName(
      nombreHoja
    );

  if (!sh) {
    throw new Error(
      'No existe la hoja ' +
      nombreHoja +
      '.'
    );
  }

  const datos =
    sh.getDataRange()
      .getDisplayValues();

  if (datos.length < 2) {
    return cciResultadoVacio_(
      inicio
    );
  }

  const encabezados =
    datos[0].map(
      cciNormalizarEncabezado_
    );

  const columnas =
    cciResolverColumnas_(
      encabezados
    );

  if (columnas.sku === -1) {
    throw new Error(
      'PLAN_COMPRAS no contiene la columna SKU.'
    );
  }

  const configuracion =
    cciNormalizarFiltros_(
      filtros
    );

  const marcas = new Set();
  const proveedores = new Set();
  const filas = [];

  /*
   * Los umbrales se leen una sola vez.
   * En V6.3.000 se consultaban dentro de cada fila,
   * provocando miles de accesos repetidos a PARAMETROS.
   */
  const umbralesAccion =
    cciObtenerUmbralesAccion_();

  /*
   * Mapa de equivalencias para consolidar códigos comerciales
   * y SKU BAM en una única fila.
   */
  if (
    typeof skuIdentityConstruirIndice ===
    'function'
  ) {
    skuIdentityConstruirIndice(
      false
    );
  }

  const mapaCanonico =
    cciConstruirMapaSkuCanonico_(
      ss
    );

  const consolidados =
    new Map();

  for (
    let i = 1;
    i < datos.length;
    i++
  ) {
    const fila =
      datos[i];

    const sku =
      cciTexto_(
        fila[columnas.sku]
      );

    if (!sku) {
      continue;
    }

    const marca =
      cciValorColumna_(
        fila,
        columnas.marca
      );

    const proveedor =
      cciValorColumna_(
        fila,
        columnas.proveedor
      );

    if (marca) {
      marcas.add(marca);
    }

    if (proveedor) {
      proveedores.add(proveedor);
    }

    const score =
      cciNumero_(
        cciValorColumna_(
          fila,
          columnas.score
        )
      );

    const accionOriginal =
      cciPrimerTexto_(
        cciValorColumna_(
          fila,
          columnas.accion
        ),
        cciValorColumna_(
          fila,
          columnas.estadoCompra
        )
      );

    const accion =
      cciClasificarAccion_(
        accionOriginal,
        score,
        umbralesAccion
      );

    const skuCanonico =
      cciResolverSkuCanonico_(
        sku,
        mapaCanonico
      );

    const registro = {
      sku: skuCanonico,

      skuOriginal:
        sku,

      descripcion:
        cciValorColumna_(
          fila,
          columnas.descripcion
        ),

      marca: marca,

      proveedor: proveedor,

      score: score,

      accion: accion,

      accionOriginal:
        accionOriginal,

      prioridad:
        cciValorColumna_(
          fila,
          columnas.prioridad
        ),

      riesgo:
        cciValorColumna_(
          fila,
          columnas.riesgo
        ),

      stockTotal:
        cciNumero_(
          cciValorColumna_(
            fila,
            columnas.stock
          )
        ),

      pendienteRecibir:
        cciNumero_(
          cciValorColumna_(
            fila,
            columnas.pendiente
          )
        ),

      consumoMensual:
        cciNumero_(
          cciValorColumna_(
            fila,
            columnas.consumo
          )
        ),

      coberturaActual:
        cciNumeroNullable_(
          cciValorColumna_(
            fila,
            columnas.coberturaActual
          )
        ),

      coberturaProyectada:
        cciNumeroNullable_(
          cciValorColumna_(
            fila,
            columnas.coberturaProyectada
          )
        ),

      objetivoMeses:
        cciNumeroNullable_(
          cciValorColumna_(
            fila,
            columnas.objetivoMeses
          )
        ),

      cantidadSugerida:
        cciNumero_(
          cciValorColumna_(
            fila,
            columnas.cantidadSugerida
          )
        ),

      compraEstimadaUsd:
        cciNumeroNullable_(
          cciValorColumna_(
            fila,
            columnas.compraEstimada
          )
        ),

      leadTimeDias:
        cciNumeroNullable_(
          cciValorColumna_(
            fila,
            columnas.leadTime
          )
        ),

      diasQuiebre:
        cciNumeroNullable_(
          cciValorColumna_(
            fila,
            columnas.diasQuiebre
          )
        ),

      motivo:
        cciValorColumna_(
          fila,
          columnas.motivo
        ),

      nivel:
        cciNivelAccion_(
          accion
        )
    };

    const claveCanonica =
      cciNormalizarClave_(
        skuCanonico
      );

    if (
      consolidados.has(
        claveCanonica
      )
    ) {
      consolidados.set(
        claveCanonica,
        cciConsolidarRegistros_(
          consolidados.get(
            claveCanonica
          ),
          registro
        )
      );

    } else {
      consolidados.set(
        claveCanonica,
        registro
      );
    }
  }

  /*
   * Segunda pasada:
   * consolida alias por sufijo cuando la coincidencia es única.
   * Ejemplo: DJ1012SPEP -> LUXDJ1012SPEP.
   */
  cciConsolidarAliasPorSufijo_(
    consolidados
  );

  Array.from(
    consolidados.values()
  ).forEach(registro => {
    cciRecalcularConsolidado_(
      registro
    );

    if (
      cciCumpleFiltros_(
        registro,
        configuracion
      )
    ) {
      filas.push(
        registro
      );
    }
  });

  filas.sort(
    cciOrdenarFilas_
  );

  const limite =
    configuracion.limite;

  const filasLimitadas =
    filas.slice(
      0,
      limite
    );

  return {
    version:
      SII_CENTRO_COMPRAS_V63000.VERSION,

    generadoEn:
      Utilities.formatDate(
        new Date(),
        Session.getScriptTimeZone(),
        'dd/MM/yyyy HH:mm'
      ),

    duracionMs:
      Date.now() - inicio,

    totalFiltrado:
      filas.length,

    truncado:
      filas.length >
      filasLimitadas.length,

    resumen:
      cciConstruirResumen_(
        filas
      ),

    opciones: {
      marcas:
        Array.from(marcas)
          .sort(),

      proveedores:
        Array.from(proveedores)
          .sort()
    },

    filas:
      filasLimitadas
  };
}


/**
 * Devuelve las opciones de filtros sin depender de la carga principal.
 */
function obtenerOpcionesCentroComprasInteligente() {
  const ss = SpreadsheetApp.getActive();

  const nombreHoja =
    cciNombreHoja_(
      'PLAN_COMPRAS',
      SII_CENTRO_COMPRAS_V63000
        .HOJA_PLAN
    );

  const sh =
    ss.getSheetByName(
      nombreHoja
    );

  if (!sh) {
    throw new Error(
      'No existe la hoja ' +
      nombreHoja +
      '.'
    );
  }

  const datos =
    sh.getDataRange()
      .getDisplayValues();

  if (datos.length < 2) {
    return {
      marcas: [],
      proveedores: []
    };
  }

  const encabezados =
    datos[0].map(
      cciNormalizarEncabezado_
    );

  const colMarca =
    cciBuscarColumna_(
      encabezados,
      ['MARCA']
    );

  const colProveedor =
    cciBuscarColumna_(
      encabezados,
      ['PROVEEDOR']
    );

  const marcas = new Set();
  const proveedores = new Set();

  for (
    let i = 1;
    i < datos.length;
    i++
  ) {
    if (colMarca !== -1) {
      const marca =
        cciTexto_(
          datos[i][colMarca]
        );

      if (marca) {
        marcas.add(marca);
      }
    }

    if (colProveedor !== -1) {
      const proveedor =
        cciTexto_(
          datos[i][colProveedor]
        );

      if (proveedor) {
        proveedores.add(
          proveedor
        );
      }
    }
  }

  return {
    marcas:
      Array.from(marcas)
        .sort(),

    proveedores:
      Array.from(proveedores)
        .sort()
  };
}


/**
 * Abre la ficha ejecutiva del SKU desde el Centro de Compras.
 */
function abrirFichaDesdeCentroCompras(
  sku
) {
  const skuTexto =
    cciTexto_(sku);

  if (!skuTexto) {
    throw new Error(
      'No se recibió el SKU.'
    );
  }

  const template =
    HtmlService.createTemplateFromFile(
      'ficha_sku_ejecutiva_ui'
    );

  template.version =
    (
      typeof SII_FICHA_SKU_EJECUTIVA !==
        'undefined'
    )
      ? SII_FICHA_SKU_EJECUTIVA.VERSION
      : '6.2.000';

  template.skuInicial =
    skuTexto;

  const html =
    template.evaluate()
      .setWidth(1220)
      .setHeight(760);

  SpreadsheetApp
    .getUi()
    .showModalDialog(
      html,
      'Ficha SKU Ejecutiva'
    );

  return true;
}


/**************************************************************
 * RESUMEN Y FILTROS
 **************************************************************/

function cciConstruirResumen_(filas) {
  const resumen = {
    total: filas.length,
    comprar: 0,
    planificar: 0,
    revisar: 0,
    sinAccion: 0,
    revisarDatos: 0,
    cantidadSugerida: 0,
    compraEstimadaUsd: 0,
    skuSinCosto: 0,
    coberturaMinima: null,
    scorePromedio: 0
  };

  let sumaScore = 0;

  filas.forEach(reg => {
    if (
      reg.accion === 'COMPRAR'
    ) {
      resumen.comprar++;

    } else if (
      reg.accion === 'PLANIFICAR'
    ) {
      resumen.planificar++;

    } else if (
      reg.accion === 'REVISAR DATOS'
    ) {
      resumen.revisarDatos++;

    } else if (
      reg.accion === 'REVISAR'
    ) {
      resumen.revisar++;

    } else {
      resumen.sinAccion++;
    }

    resumen.cantidadSugerida +=
      reg.cantidadSugerida;

    if (
      reg.compraEstimadaUsd !==
        null
    ) {
      resumen.compraEstimadaUsd +=
        reg.compraEstimadaUsd;

    } else if (
      reg.cantidadSugerida > 0
    ) {
      resumen.skuSinCosto++;
    }

    if (
      reg.coberturaActual !== null &&
      (
        resumen.coberturaMinima ===
          null ||
        reg.coberturaActual <
          resumen.coberturaMinima
      )
    ) {
      resumen.coberturaMinima =
        reg.coberturaActual;
    }

    sumaScore += reg.score;
  });

  resumen.scorePromedio =
    filas.length > 0
      ? sumaScore / filas.length
      : 0;

  return resumen;
}


function cciNormalizarFiltros_(
  filtros
) {
  const f = filtros || {};

  return {
    texto:
      cciNormalizarTexto_(
        f.texto
      ),

    marca:
      cciTexto_(
        f.marca
      ),

    proveedor:
      cciTexto_(
        f.proveedor
      ),

    accion:
      cciTexto_(
        f.accion
      ).toUpperCase(),

    scoreMinimo:
      cciNumero_(
        f.scoreMinimo
      ),

    soloConCompra:
      Boolean(
        f.soloConCompra
      ),

    limite:
      Math.max(
        1,
        Math.min(
          2000,
          cciNumero_(
            f.limite ||
            SII_CENTRO_COMPRAS_V63000
              .LIMITE_DEFAULT
          )
        )
      )
  };
}


function cciCumpleFiltros_(
  registro,
  filtros
) {
  if (
    filtros.texto
  ) {
    const contenido =
      cciNormalizarTexto_(
        [
          registro.sku,
          registro.descripcion,
          registro.marca,
          registro.proveedor,
          registro.motivo
        ].join(' ')
      );

    if (
      !contenido.includes(
        filtros.texto
      )
    ) {
      return false;
    }
  }

  if (
    filtros.marca &&
    registro.marca !==
      filtros.marca
  ) {
    return false;
  }

  if (
    filtros.proveedor &&
    registro.proveedor !==
      filtros.proveedor
  ) {
    return false;
  }

  if (
    filtros.accion &&
    registro.accion !==
      filtros.accion
  ) {
    return false;
  }

  if (
    registro.score <
    filtros.scoreMinimo
  ) {
    return false;
  }

  if (
    filtros.soloConCompra &&
    registro.cantidadSugerida <= 0
  ) {
    return false;
  }

  return true;
}


/**************************************************************
 * CLASIFICACIÓN
 **************************************************************/

function cciClasificarAccion_(
  accionOriginal,
  score,
  umbrales
) {
  const texto =
    cciNormalizarTexto_(
      accionOriginal
    );

  if (
    texto.includes(
      'REVISAR DATOS'
    ) ||
    texto.includes(
      'SIN HISTORIAL'
    )
  ) {
    return 'REVISAR DATOS';
  }

  if (
    texto.includes('COMPRAR')
  ) {
    return 'COMPRAR';
  }

  if (
    texto.includes(
      'PLANIFICAR'
    )
  ) {
    return 'PLANIFICAR';
  }

  if (
    texto.includes('REVISAR')
  ) {
    return 'REVISAR';
  }

  if (
    texto === 'OK' ||
    texto.includes(
      'SIN ACCION'
    )
  ) {
    return 'SIN ACCIÓN';
  }

  const limites =
    umbrales ||
    cciObtenerUmbralesAccion_();

  if (
    score >=
    limites.comprar
  ) {
    return 'COMPRAR';
  }

  if (
    score >=
    limites.planificar
  ) {
    return 'PLANIFICAR';
  }

  if (
    score >=
    limites.revisar
  ) {
    return 'REVISAR';
  }

  return 'SIN ACCIÓN';
}


function cciObtenerUmbralesAccion_() {
  return {
    comprar:
      cciParametroNumero_(
        'IPC',
        'IPC_COMPRAR',
        80
      ),

    planificar:
      cciParametroNumero_(
        'IPC',
        'IPC_PLANIFICAR',
        60
      ),

    revisar:
      cciParametroNumero_(
        'IPC',
        'IPC_REVISAR',
        40
      )
  };
}


function cciNivelAccion_(accion) {
  if (accion === 'COMPRAR') {
    return 'ROJO';
  }

  if (accion === 'PLANIFICAR') {
    return 'NARANJA';
  }

  if (accion === 'REVISAR') {
    return 'AMARILLO';
  }

  if (
    accion === 'REVISAR DATOS'
  ) {
    return 'GRIS';
  }

  return 'VERDE';
}


function cciOrdenarFilas_(a, b) {
  const orden = {
    COMPRAR: 1,
    PLANIFICAR: 2,
    'REVISAR DATOS': 3,
    REVISAR: 4,
    'SIN ACCIÓN': 5
  };

  const accionA =
    orden[a.accion] || 99;

  const accionB =
    orden[b.accion] || 99;

  if (accionA !== accionB) {
    return accionA - accionB;
  }

  if (a.score !== b.score) {
    return b.score - a.score;
  }

  const coberturaA =
    a.coberturaActual === null
      ? 999999
      : a.coberturaActual;

  const coberturaB =
    b.coberturaActual === null
      ? 999999
      : b.coberturaActual;

  return coberturaA -
    coberturaB;
}


/**************************************************************
 * COLUMNAS
 **************************************************************/

function cciResolverColumnas_(
  encabezados
) {
  return {
    sku:
      cciBuscarColumna_(
        encabezados,
        ['SKU']
      ),

    descripcion:
      cciBuscarColumna_(
        encabezados,
        ['DESCRIPCION']
      ),

    marca:
      cciBuscarColumna_(
        encabezados,
        ['MARCA']
      ),

    proveedor:
      cciBuscarColumna_(
        encabezados,
        ['PROVEEDOR']
      ),

    score:
      cciBuscarColumna_(
        encabezados,
        [
          'SCORE',
          'IPC',
          'PRIORIDAD_NUMERICA',
          'PRIORIDAD'
        ]
      ),

    accion:
      cciBuscarColumna_(
        encabezados,
        ['ACCION']
      ),

    estadoCompra:
      cciBuscarColumna_(
        encabezados,
        ['ESTADO_COMPRA']
      ),

    prioridad:
      cciBuscarColumna_(
        encabezados,
        ['PRIORIDAD']
      ),

    riesgo:
      cciBuscarColumna_(
        encabezados,
        [
          'RIESGO_RUPTURA',
          'RIESGO'
        ]
      ),

    stock:
      cciBuscarColumna_(
        encabezados,
        [
          'STOCK_TOTAL',
          'STOCK_DISPONIBLE'
        ]
      ),

    pendiente:
      cciBuscarColumna_(
        encabezados,
        ['PENDIENTE_RECIBIR']
      ),

    consumo:
      cciBuscarColumna_(
        encabezados,
        [
          'CONSUMO_MENSUAL',
          'PROMEDIO_MENSUAL'
        ]
      ),

    coberturaActual:
      cciBuscarColumna_(
        encabezados,
        ['COBERTURA_ACTUAL_MESES']
      ),

    coberturaProyectada:
      cciBuscarColumna_(
        encabezados,
        ['COBERTURA_PROYECTADA_MESES']
      ),

    objetivoMeses:
      cciBuscarColumna_(
        encabezados,
        ['OBJETIVO_MESES']
      ),

    cantidadSugerida:
      cciBuscarColumna_(
        encabezados,
        ['CANTIDAD_SUGERIDA']
      ),

    compraEstimada:
      cciBuscarColumna_(
        encabezados,
        [
          'COMPRA_ESTIMADA_USD',
          'COMPRA_USD'
        ]
      ),

    leadTime:
      cciBuscarColumna_(
        encabezados,
        ['LEAD_TIME_DIAS']
      ),

    diasQuiebre:
      cciBuscarColumna_(
        encabezados,
        [
          'DIAS_QUIEBRE_PROYECTADO',
          'DIAS_QUIEBRE'
        ]
      ),

    motivo:
      cciBuscarColumna_(
        encabezados,
        [
          'MOTIVO',
          'MOTIVO_MRP'
        ]
      )
  };
}


function cciBuscarColumna_(
  encabezados,
  candidatos
) {
  for (
    let i = 0;
    i < candidatos.length;
    i++
  ) {
    const indice =
      encabezados.indexOf(
        candidatos[i]
      );

    if (indice !== -1) {
      return indice;
    }
  }

  return -1;
}


function cciValorColumna_(
  fila,
  columna
) {
  if (
    columna === -1 ||
    columna === undefined
  ) {
    return '';
  }

  return fila[columna];
}


/**************************************************************
 * CONSOLIDACIÓN DE SKU EQUIVALENTES
 **************************************************************/

function cciConstruirMapaSkuCanonico_(
  ss
) {
  const mapa = new Map();

  const agregar = (
    alias,
    canonico
  ) => {
    const claveAlias =
      cciNormalizarClave_(
        alias
      );

    const valorCanonico =
      cciTexto_(
        canonico
      );

    if (
      claveAlias &&
      valorCanonico
    ) {
      mapa.set(
        claveAlias,
        valorCanonico
      );
    }
  };

  /*
   * VENTAS:
   * Código comercial -> Cod_BAM.
   */
  const shVentas =
    ss.getSheetByName(
      cciNombreHoja_(
        'VENTAS',
        'VENTAS'
      )
    );

  if (shVentas) {
    const datos =
      shVentas.getDataRange()
        .getDisplayValues();

    if (datos.length > 1) {
      const enc =
        datos[0].map(
          cciNormalizarEncabezado_
        );

      const colCodigo =
        cciBuscarColumna_(
          enc,
          [
            'CODIGO',
            'CODIGO_PROVEEDOR',
            'ITEM'
          ]
        );

      const colBam =
        cciBuscarColumna_(
          enc,
          [
            'COD_BAM',
            'SKU_BAM',
            'SKU'
          ]
        );

      if (
        colCodigo !== -1 &&
        colBam !== -1
      ) {
        for (
          let i = 1;
          i < datos.length;
          i++
        ) {
          agregar(
            datos[i][colCodigo],
            datos[i][colBam]
          );

          agregar(
            datos[i][colBam],
            datos[i][colBam]
          );
        }
      }
    }
  }

  /*
   * EQUIVALENCIAS_SKU:
   * ITEM/Código -> SKU BAM.
   */
  const shEquiv =
    ss.getSheetByName(
      cciNombreHoja_(
        'EQUIVALENCIAS_SKU',
        'EQUIVALENCIAS_SKU'
      )
    );

  if (shEquiv) {
    const datos =
      shEquiv.getDataRange()
        .getDisplayValues();

    if (datos.length > 1) {
      const enc =
        datos[0].map(
          cciNormalizarEncabezado_
        );

      const colDestino =
        cciBuscarColumna_(
          enc,
          [
            'SKU',
            'COD_BAM',
            'SKU_BAM',
            'SKU_DESTINO'
          ]
        );

      const columnasAlias = [
        'ITEM',
        'CODIGO',
        'CODIGO_PROVEEDOR',
        'SKU_ORIGEN',
        'SKU_ANTERIOR',
        'CODIGO_COMERCIAL'
      ]
        .map(nombre =>
          cciBuscarColumna_(
            enc,
            [nombre]
          )
        )
        .filter(indice =>
          indice !== -1
        );

      if (colDestino !== -1) {
        for (
          let i = 1;
          i < datos.length;
          i++
        ) {
          const destino =
            datos[i][colDestino];

          agregar(
            destino,
            destino
          );

          columnasAlias.forEach(
            columna => {
              agregar(
                datos[i][columna],
                destino
              );
            }
          );
        }
      }
    }
  }

  return mapa;
}


function cciResolverSkuCanonico_(
  sku,
  mapa
) {
  const entrada =
    cciTexto_(sku);

  if (
    typeof skuIdentityResolver ===
    'function'
  ) {
    try {
      const resultado =
        skuIdentityResolver(
          entrada
        );

      if (
        resultado &&
        !resultado.ambiguo &&
        resultado.skuCanonico
      ) {
        return resultado.skuCanonico;
      }
    } catch (error) {}
  }

  const clave =
    cciNormalizarClave_(
      entrada
    );

  return (
    mapa &&
    mapa.get(clave)
  ) || entrada;
}


function cciConsolidarAliasPorSufijo_(
  consolidados
) {
  const claves =
    Array.from(
      consolidados.keys()
    );

  const movimientos = [];

  claves.forEach(claveCorta => {
    if (
      !consolidados.has(
        claveCorta
      )
    ) {
      return;
    }

    const candidatos =
      claves.filter(claveLarga =>
        claveLarga !== claveCorta &&
        claveLarga.length >
          claveCorta.length &&
        claveLarga.endsWith(
          claveCorta
        ) &&
        (
          claveLarga.length -
          claveCorta.length
        ) <= 10
      );

    /*
     * Solo se consolida cuando existe un único destino
     * posible para evitar asociaciones ambiguas.
     */
    if (candidatos.length !== 1) {
      return;
    }

    const claveLarga =
      candidatos[0];

    if (
      !consolidados.has(
        claveLarga
      )
    ) {
      return;
    }

    movimientos.push({
      origen:
        claveCorta,
      destino:
        claveLarga
    });
  });

  movimientos.forEach(mov => {
    if (
      !consolidados.has(
        mov.origen
      ) ||
      !consolidados.has(
        mov.destino
      )
    ) {
      return;
    }

    const corto =
      consolidados.get(
        mov.origen
      );

    const largo =
      consolidados.get(
        mov.destino
      );

    const fusionado =
      cciConsolidarRegistros_(
        largo,
        corto
      );

    /*
     * Mantiene siempre el SKU largo como canónico.
     */
    fusionado.sku =
      largo.sku;

    consolidados.set(
      mov.destino,
      fusionado
    );

    consolidados.delete(
      mov.origen
    );
  });
}


function cciConsolidarRegistros_(
  base,
  nuevo
) {
  const resultado =
    Object.assign(
      {},
      base
    );

  resultado.descripcion =
    cciPrimerTexto_(
      base.descripcion,
      nuevo.descripcion
    );

  resultado.marca =
    cciPrimerTexto_(
      base.marca,
      nuevo.marca
    );

  resultado.proveedor =
    cciPrimerTexto_(
      base.proveedor,
      nuevo.proveedor
    );

  resultado.motivo =
    cciPrimerTexto_(
      base.motivo,
      nuevo.motivo
    );

  /*
   * Son dos representaciones del mismo SKU,
   * no dos existencias diferentes. Por eso se toma
   * el mayor valor y no se suman stock/consumo/pendiente.
   */
  resultado.stockTotal =
    Math.max(
      base.stockTotal,
      nuevo.stockTotal
    );

  resultado.pendienteRecibir =
    Math.max(
      base.pendienteRecibir,
      nuevo.pendienteRecibir
    );

  resultado.consumoMensual =
    Math.max(
      base.consumoMensual,
      nuevo.consumoMensual
    );

  resultado.objetivoMeses =
    cciPrimerNumeroNullable_(
      base.objetivoMeses,
      nuevo.objetivoMeses
    );

  resultado.leadTimeDias =
    cciPrimerNumeroNullable_(
      base.leadTimeDias,
      nuevo.leadTimeDias
    );

  resultado.diasQuiebre =
    cciPrimerNumeroNullable_(
      base.diasQuiebre,
      nuevo.diasQuiebre
    );

  resultado.compraEstimadaUsd =
    cciPrimerNumeroNullable_(
      base.compraEstimadaUsd,
      nuevo.compraEstimadaUsd
    );

  /*
   * Conserva la mayor criticidad calculada.
   */
  if (
    cciJerarquiaAccion_(
      nuevo.accion
    ) <
    cciJerarquiaAccion_(
      base.accion
    )
  ) {
    resultado.accion =
      nuevo.accion;

    resultado.nivel =
      nuevo.nivel;

    resultado.score =
      nuevo.score;

  } else {
    resultado.score =
      Math.max(
        base.score,
        nuevo.score
      );
  }

  return resultado;
}


function cciRecalcularConsolidado_(
  registro
) {
  const consumo =
    cciNumero_(
      registro.consumoMensual
    );

  const stock =
    cciNumero_(
      registro.stockTotal
    );

  const pendiente =
    cciNumero_(
      registro.pendienteRecibir
    );

  registro.coberturaActual =
    consumo > 0
      ? stock / consumo
      : null;

  registro.coberturaProyectada =
    consumo > 0
      ? (
          stock +
          pendiente
        ) /
        consumo
      : null;

  const objetivo =
    registro.objetivoMeses !==
      null
      ? registro.objetivoMeses
      : 4;

  registro.cantidadSugerida =
    consumo > 0
      ? Math.max(
          0,
          Math.ceil(
            objetivo *
            consumo -
            stock -
            pendiente
          )
        )
      : 0;
}


function cciJerarquiaAccion_(
  accion
) {
  const orden = {
    COMPRAR: 1,
    PLANIFICAR: 2,
    'REVISAR DATOS': 3,
    REVISAR: 4,
    'SIN ACCIÓN': 5
  };

  return orden[accion] || 99;
}


function cciPrimerNumeroNullable_() {
  for (
    let i = 0;
    i < arguments.length;
    i++
  ) {
    const valor =
      cciNumeroNullable_(
        arguments[i]
      );

    if (valor !== null) {
      return valor;
    }
  }

  return null;
}


function cciNormalizarClave_(
  valor
) {
  return cciNormalizarTexto_(
    valor
  ).replace(
    /[^A-Z0-9]/g,
    ''
  );
}


/**************************************************************
 * UTILIDADES
 **************************************************************/

function cciNombreHoja_(
  clave,
  respaldo
) {
  if (
    typeof SII_CFG !==
      'undefined' &&
    SII_CFG.SHEETS &&
    SII_CFG.SHEETS[clave]
  ) {
    return SII_CFG.SHEETS[
      clave
    ];
  }

  return respaldo;
}


function cciParametroNumero_(
  tipo,
  clave,
  valorDefault
) {
  if (
    typeof obtenerParametroNumero ===
    'function'
  ) {
    return obtenerParametroNumero(
      tipo,
      clave,
      valorDefault
    );
  }

  return valorDefault;
}


function cciNormalizarEncabezado_(
  valor
) {
  return cciTexto_(valor)
    .normalize('NFD')
    .replace(
      /[\u0300-\u036f]/g,
      ''
    )
    .toUpperCase()
    .replace(/\s+/g, '_');
}


function cciNormalizarTexto_(
  valor
) {
  return cciTexto_(valor)
    .normalize('NFD')
    .replace(
      /[\u0300-\u036f]/g,
      ''
    )
    .toUpperCase()
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ');
}


function cciTexto_(valor) {
  return String(
    valor === null ||
    valor === undefined
      ? ''
      : valor
  ).trim();
}


function cciPrimerTexto_() {
  for (
    let i = 0;
    i < arguments.length;
    i++
  ) {
    const valor =
      cciTexto_(
        arguments[i]
      );

    if (valor) {
      return valor;
    }
  }

  return '';
}


function cciNumeroNullable_(
  valor
) {
  if (
    valor === null ||
    valor === undefined ||
    cciTexto_(valor) === ''
  ) {
    return null;
  }

  return cciNumero_(valor);
}


function cciNumero_(valor) {
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

  let texto =
    cciTexto_(valor)
      .replace(
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

  const numero =
    Number(texto);

  return Number.isFinite(numero)
    ? numero
    : 0;
}


function cciResultadoVacio_(
  inicio
) {
  return {
    version:
      SII_CENTRO_COMPRAS_V63000.VERSION,

    generadoEn:
      Utilities.formatDate(
        new Date(),
        Session.getScriptTimeZone(),
        'dd/MM/yyyy HH:mm'
      ),

    duracionMs:
      Date.now() - inicio,

    totalFiltrado: 0,
    truncado: false,

    resumen:
      cciConstruirResumen_(
        []
      ),

    opciones: {
      marcas: [],
      proveedores: []
    },

    filas: []
  };
}
