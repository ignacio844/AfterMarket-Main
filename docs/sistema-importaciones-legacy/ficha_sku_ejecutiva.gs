/**************************************************************
 * SII V6.3.007
 * PANTALLA: FICHA SKU EJECUTIVA
 *
 * Dependencia principal:
 * - cargarSKU(sku) de sku_modelo.gs
 *
 * Archivo HTML requerido:
 * - ficha_sku_ejecutiva_ui
 *
 * Funciones públicas:
 * - abrirFichaSku()
 * - abrirFichaSkuEjecutiva()
 * - abrirFichaSkuSeleccionado()
 * - obtenerFichaSkuEjecutiva(sku)
 * - buscarSkuFichaEjecutiva(texto, limite)
 **************************************************************/

const SII_FICHA_SKU_EJECUTIVA = {
  VERSION: '6.3.007',
  HTML: 'ficha_sku_ejecutiva_ui',
  ANCHO: 1220,
  ALTO: 760,
  LIMITE_BUSQUEDA: 30
};


/**
 * Mantiene compatibilidad con el menú actual.
 */
function abrirFichaSku() {
  abrirFichaSkuEjecutiva();
}


/**
 * Abre la ficha ejecutiva.
 */
function abrirFichaSkuEjecutiva() {
  const template =
    HtmlService.createTemplateFromFile(
      SII_FICHA_SKU_EJECUTIVA.HTML
    );

  template.version =
    SII_FICHA_SKU_EJECUTIVA.VERSION;

  template.skuInicial =
    obtenerSkuActivoFichaEjecutiva_();

  const html =
    template.evaluate()
      .setWidth(
        SII_FICHA_SKU_EJECUTIVA.ANCHO
      )
      .setHeight(
        SII_FICHA_SKU_EJECUTIVA.ALTO
      );

  SpreadsheetApp
    .getUi()
    .showModalDialog(
      html,
      'Ficha SKU Ejecutiva'
    );
}


/**
 * Abre la ficha tomando el SKU de la fila activa.
 */
function abrirFichaSkuSeleccionado() {
  const sku =
    obtenerSkuActivoFichaEjecutiva_();

  if (!sku) {
    throw new Error(
      'Seleccioná una fila que contenga un SKU.'
    );
  }

  abrirFichaSkuEjecutiva();
}


/**
 * Devuelve el modelo preparado para la interfaz.
 */
function obtenerFichaSkuEjecutiva(sku) {
  const skuTexto =
    String(sku || '').trim();

  if (!skuTexto) {
    throw new Error(
      'Ingresá un SKU.'
    );
  }

  if (
    typeof cargarSKU !==
    'function'
  ) {
    throw new Error(
      'No está disponible cargarSKU(). Revisá sku_modelo.gs.'
    );
  }

  const modelo =
    cargarSKU(skuTexto);

  return prepararFichaSkuEjecutiva_(
    modelo
  );
}


/**
 * Búsqueda rápida por SKU, descripción, marca o proveedor.
 */
function buscarSkuFichaEjecutiva(
  texto,
  limite
) {
  const consulta =
    normalizarTextoFichaEjecutiva_(
      texto
    );

  if (!consulta) {
    return [];
  }

  const ss =
    SpreadsheetApp.getActive();

  const nombres = [
    nombreHojaFichaEjecutiva_(
      'PLAN_COMPRAS',
      'PLAN_COMPRAS'
    ),
    nombreHojaFichaEjecutiva_(
      'PRODUCTOS',
      'PRODUCTOS'
    ),
    nombreHojaFichaEjecutiva_(
      'VENTAS',
      'VENTAS'
    )
  ];

  const resultados = [];
  const vistos = new Set();

  nombres.forEach(nombre => {
    const sh =
      ss.getSheetByName(nombre);

    if (!sh) return;

    const datos =
      sh.getDataRange()
        .getDisplayValues();

    if (datos.length < 2) {
      return;
    }

    const encabezados =
      datos[0].map(
        normalizarEncabezadoFichaEjecutiva_
      );

    const colSku =
      buscarColumnaFichaEjecutiva_(
        encabezados,
        [
          'SKU',
          'COD_BAM'
        ]
      );

    if (colSku === -1) {
      return;
    }

    const colCodigo =
      buscarColumnaFichaEjecutiva_(
        encabezados,
        [
          'CODIGO',
          'CODIGO_PROVEEDOR',
          'ITEM'
        ]
      );

    const colDescripcion =
      buscarColumnaFichaEjecutiva_(
        encabezados,
        ['DESCRIPCION']
      );

    const colMarca =
      buscarColumnaFichaEjecutiva_(
        encabezados,
        ['MARCA']
      );

    const colProveedor =
      buscarColumnaFichaEjecutiva_(
        encabezados,
        ['PROVEEDOR']
      );

    for (
      let i = 1;
      i < datos.length;
      i++
    ) {
      const sku =
        String(
          datos[i][colSku] || ''
        ).trim();

      if (!sku) continue;

      const descripcion =
        colDescripcion === -1
          ? ''
          : String(
              datos[i][colDescripcion] ||
              ''
            ).trim();

      const marca =
        colMarca === -1
          ? ''
          : String(
              datos[i][colMarca] ||
              ''
            ).trim();

      const proveedor =
        colProveedor === -1
          ? ''
          : String(
              datos[i][colProveedor] ||
              ''
            ).trim();

      const codigo =
        colCodigo === -1
          ? ''
          : String(
              datos[i][colCodigo] ||
              ''
            ).trim();

      const textoFila =
        normalizarTextoFichaEjecutiva_(
          [
            sku,
            codigo,
            descripcion,
            marca,
            proveedor
          ].join(' ')
        );

      if (
        !textoFila.includes(
          consulta
        )
      ) {
        continue;
      }

      const skuCanonico =
        resolverSkuCanonicoBusquedaFicha_(
          sku,
          codigo
        );

      const clave =
        normalizarClaveFichaEjecutiva_(
          skuCanonico
        );

      if (vistos.has(clave)) {
        continue;
      }

      vistos.add(clave);

      resultados.push({
        sku: skuCanonico,
        alias:
          skuCanonico !== sku
            ? sku
            : codigo,
        descripcion:
          descripcion,
        marca:
          marca,
        proveedor:
          proveedor
      });

      if (
        resultados.length >=
        Number(
          limite ||
          SII_FICHA_SKU_EJECUTIVA
            .LIMITE_BUSQUEDA
        )
      ) {
        return;
      }
    }
  });

  return resultados;
}


/**************************************************************
 * PREPARACIÓN PARA UI
 **************************************************************/

function prepararFichaSkuEjecutiva_(
  modelo
) {
  const score =
    modelo.score || {};

  const reglas =
    modelo.reglas || {};

  const identificacion =
    modelo.identificacion || {};

  const ventas =
    modelo.ventas || {};

  const stock =
    modelo.stock || {};

  const importaciones =
    modelo.importaciones || {};

  const cobertura =
    modelo.cobertura || {};

  const compras =
    modelo.compras || {};

  const timeline =
    modelo.timeline || {};

  const calidad =
    modelo.calidadDatos || {};

  return {
    meta: {
      version:
        SII_FICHA_SKU_EJECUTIVA.VERSION,

      versionModelo:
        modelo.meta
          ? modelo.meta.version
          : '',

      generadoEn:
        formatearFechaHoraFichaEjecutiva_(
          modelo.meta &&
          modelo.meta.generadoEn
        )
    },

    identificacion: {
      sku:
        identificacion.sku || '',

      descripcion:
        identificacion.descripcion ||
        'Sin descripción',

      marca:
        identificacion.marca ||
        'Sin marca',

      proveedor:
        identificacion.proveedor ||
        'Sin proveedor',

      codigoProveedor:
        identificacion.codigoProveedor ||
        '',

      activo:
        identificacion.activo || '',

      skuConsultado:
        identificacion.skuConsultado || '',

      skuCanonico:
        identificacion.skuCanonico ||
        identificacion.sku || '',

      resueltoPor:
        identificacion.resueltoPor || '',

      confianzaIdentidad:
        identificacion.confianzaIdentidad !==
          undefined
          ? identificacion.confianzaIdentidad
          : null,

      aliases:
        Array.isArray(
          identificacion.aliases
        )
          ? identificacion.aliases
          : []
    },

    resumen: {
      prioridad:
        numeroFichaEjecutiva_(
          score.prioridad
        ),

      calidad:
        numeroFichaEjecutiva_(
          score.calidad !==
            undefined
            ? score.calidad
            : calidad.puntaje
        ),

      confianza:
        numeroFichaEjecutiva_(
          score.confianza
        ),

      accion:
        score.accion ||
        reglas.accion ||
        compras.accion ||
        'REVISAR',

      nivel:
        score.nivel ||
        reglas.nivel ||
        'GRIS',

      coberturaActual:
        nullableNumeroFichaEjecutiva_(
          cobertura.actualMeses
        ),

      coberturaObjetivo:
        nullableNumeroFichaEjecutiva_(
          cobertura.objetivoMeses
        ),

      stockTotal:
        numeroFichaEjecutiva_(
          cobertura.stockTotal
        ),

      pendienteTotal:
        numeroFichaEjecutiva_(
          importaciones
            .cantidadPendiente
        ),

      cantidadSugerida:
        numeroFichaEjecutiva_(
          compras.cantidadSugerida
        ),

      compraEstimadaUsd:
        nullableNumeroFichaEjecutiva_(
          compras.compraEstimadaUsd
        )
    },

    demanda: {
      promedio3:
        numeroFichaEjecutiva_(
          ventas.promedio3
        ),

      promedio6:
        numeroFichaEjecutiva_(
          ventas.promedio6
        ),

      promedio12:
        numeroFichaEjecutiva_(
          ventas.promedio12
        ),

      ultimoMes:
        numeroFichaEjecutiva_(
          ventas.ultimoMes
        ),

      totalUnidades:
        numeroFichaEjecutiva_(
          ventas.totalUnidades
        ),

      tendencia:
        ventas.tendencia ||
        'SIN DATOS',

      aceleracion:
        ventas
          .clasificacionAceleracion ||
        'SIN DATOS',

      variabilidad:
        ventas
          .nivelVariabilidad ||
        'SIN DATOS',

      meses:
        numeroFichaEjecutiva_(
          ventas.cantidadMeses
        ),

      mesesConVenta:
        numeroFichaEjecutiva_(
          ventas.mesesConVenta
        ),

      historicoMensual:
        Array.isArray(
          ventas.historicoMensual
        )
          ? ventas.historicoMensual
          : []
    },

    stock: {
      disponible:
        numeroFichaEjecutiva_(
          stock.stockDisponible
        ),

      escobar:
        numeroFichaEjecutiva_(
          stock.stockEscobar
        ),

      warnes:
        numeroFichaEjecutiva_(
          stock.stockWarnes
        ),

      otros:
        numeroFichaEjecutiva_(
          stock.stockOtros
        )
    },

    importaciones: {
      enFabrica:
        numeroFichaEjecutiva_(
          importaciones.enFabrica
        ),

      aEmbarcar:
        numeroFichaEjecutiva_(
          importaciones.aEmbarcar
        ),

      embarcado:
        numeroFichaEjecutiva_(
          importaciones.embarcado
        ),

      aIngresar:
        numeroFichaEjecutiva_(
          importaciones.aIngresar
        ),

      pendienteTotal:
        numeroFichaEjecutiva_(
          importaciones
            .cantidadPendiente
        ),

      ordenes:
        numeroFichaEjecutiva_(
          importaciones
            .ordenesConPendiente
        ),

      primeraLlegada:
        importaciones
          .primeraLlegadaEstimada ||
        '',

      ultimaLlegada:
        importaciones
          .ultimaLlegadaEstimada ||
        '',

      antesQuiebre:
        numeroFichaEjecutiva_(
          timeline
            .cantidadAntesQuiebre
        ),

      despuesQuiebre:
        numeroFichaEjecutiva_(
          timeline
            .cantidadDespuesQuiebre
        ),

      lineas:
        Array.isArray(
          importaciones.lineas
        )
          ? importaciones.lineas
          : []
    },

    timeline: {
      hoy:
        timeline.hoy || '',

      fechaQuiebre:
        timeline.fechaQuiebre ||
        '',

      diasHastaQuiebre:
        nullableNumeroFichaEjecutiva_(
          timeline.diasHastaQuiebre
        ),

      primeraLlegada:
        timeline.primeraLlegada ||
        '',

      ultimaLlegada:
        timeline.ultimaLlegada ||
        '',

      eventos:
        Array.isArray(
          timeline.eventos
        )
          ? timeline.eventos
          : []
    },

    reglas: {
      nivel:
        reglas.nivel ||
        score.nivel ||
        'GRIS',

      accion:
        reglas.accion ||
        score.accion ||
        'REVISAR',

      cantidadActivas:
        numeroFichaEjecutiva_(
          reglas.cantidadActivas
        ),

      cantidadBloqueantes:
        numeroFichaEjecutiva_(
          reglas
            .cantidadBloqueantes
        ),

      activas:
        Array.isArray(
          reglas.reglasActivas
        )
          ? reglas.reglasActivas
          : [],

      recomendaciones:
        Array.isArray(
          reglas.recomendaciones
        )
          ? reglas.recomendaciones
          : []
    },

    score: {
      componentes:
        score.componentes || {},

      reglasAplicadas:
        Array.isArray(
          score.reglasAplicadas
        )
          ? score.reglasAplicadas
          : []
    },

    calidadDatos: {
      puntaje:
        numeroFichaEjecutiva_(
          calidad.puntaje
        ),

      nivel:
        calidad.nivel ||
        'SIN DATOS',

      completa:
        Boolean(
          calidad.completa
        ),

      alertas:
        Array.isArray(
          calidad.alertas
        )
          ? calidad.alertas
          : []
    }
  };
}


/**************************************************************
 * RESOLUCIÓN RÁPIDA PARA AUTOCOMPLETADO
 **************************************************************/

function resolverSkuCanonicoBusquedaFicha_(
  sku,
  codigo
) {
  const entrada =
    String(
      codigo ||
      sku ||
      ''
    ).trim();

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

  return String(
    sku ||
    codigo ||
    ''
  ).trim();
}


/**************************************************************
 * AUXILIARES
 **************************************************************/

function obtenerSkuActivoFichaEjecutiva_() {
  try {
    const ss =
      SpreadsheetApp.getActive();

    const sh =
      ss.getActiveSheet();

    const rango =
      ss.getActiveRange();

    if (!sh || !rango) {
      return '';
    }

    if (rango.getRow() < 2) {
      return '';
    }

    const encabezados =
      sh.getRange(
        1,
        1,
        1,
        sh.getLastColumn()
      ).getDisplayValues()[0]
      .map(
        normalizarEncabezadoFichaEjecutiva_
      );

    const colSku =
      encabezados.indexOf(
        'SKU'
      );

    if (colSku === -1) {
      return '';
    }

    return String(
      sh.getRange(
        rango.getRow(),
        colSku + 1
      ).getDisplayValue() || ''
    ).trim();

  } catch (error) {
    return '';
  }
}


function nombreHojaFichaEjecutiva_(
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


function buscarColumnaFichaEjecutiva_(
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


function normalizarEncabezadoFichaEjecutiva_(
  valor
) {
  return String(valor || '')
    .trim()
    .normalize('NFD')
    .replace(
      /[\u0300-\u036f]/g,
      ''
    )
    .toUpperCase()
    .replace(/\s+/g, '_');
}


function normalizarTextoFichaEjecutiva_(
  valor
) {
  return String(valor || '')
    .trim()
    .normalize('NFD')
    .replace(
      /[\u0300-\u036f]/g,
      ''
    )
    .toUpperCase()
    .replace(/\s+/g, ' ');
}


function normalizarClaveFichaEjecutiva_(
  valor
) {
  return normalizarTextoFichaEjecutiva_(
    valor
  ).replace(
    /[^A-Z0-9]/g,
    ''
  );
}


function numeroFichaEjecutiva_(valor) {
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

  const numero =
    Number(valor);

  return Number.isFinite(numero)
    ? numero
    : 0;
}


function nullableNumeroFichaEjecutiva_(
  valor
) {
  if (
    valor === null ||
    valor === undefined ||
    String(valor).trim() === ''
  ) {
    return null;
  }

  return numeroFichaEjecutiva_(
    valor
  );
}


function formatearFechaHoraFichaEjecutiva_(
  valor
) {
  if (!valor) {
    return '';
  }

  const fecha =
    valor instanceof Date
      ? valor
      : new Date(valor);

  if (isNaN(fecha.getTime())) {
    return String(valor);
  }

  return Utilities.formatDate(
    fecha,
    Session.getScriptTimeZone(),
    'dd/MM/yyyy HH:mm'
  );
}
