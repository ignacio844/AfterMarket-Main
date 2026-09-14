/**************************************************************
 * SII V6.3.011
 * MÓDULO: MODELO UNIFICADO DEL SKU
 *
 * Funciones públicas:
 * - cargarSKU(sku)
 * - cargarSkuSeleccionado()
 * - probarModeloSku()
 * - cargarTodosLosSKUs(opciones)
 * - cargarModelosSkuMasivo(skus, opciones)
 *
 * Este módulo centraliza:
 * - Identificación
 * - Demanda / ventas
 * - Stock
 * - Importaciones
 * - Cobertura
 * - Plan de compras
 * - Parámetros
 * - Diagnóstico base
 *
 * Dependencias ya existentes:
 * - parametros.gs
 * - ventas_modelo.gs
 * - ficha_stock.gs
 * - ficha_importaciones.gs
 * - funciones generales:
 *   obtenerHoja_()
 *   leerFilasComoObjetos_()
 *   limpiarTexto_()
 *   numero_()
 **************************************************************/

const SII_SKU_MODELO_V60100 = {
  VERSION: '6.3.011',

  HOJAS: {
    PRODUCTOS: 'PRODUCTOS',
    PLAN_COMPRAS: 'PLAN_COMPRAS',
    STOCK: 'STOCK',
    DETALLE: 'DETALLE_IMPORTACIONES',
    ORDENES: 'ORDENES',
    EQUIVALENCIAS: 'EQUIVALENCIAS_SKU',
    PARAMETROS: 'PARAMETROS',
    VENTAS: 'VENTAS'
  }
};

/** Caché temporal para cargas masivas. */
let SII_SKU_MODELO_CACHE_MASIVA_ = null;


/**
 * Devuelve el modelo unificado de un SKU.
 */
function cargarSKU(skuSeleccionado) {
  const inicio = Date.now();
  const ss = SpreadsheetApp.getActive();

  const skuTexto =
    smLimpiarTexto_(skuSeleccionado);

  if (!skuTexto) {
    throw new Error(
      'Debe informar un SKU.'
    );
  }

  const claveSku =
    smNormalizarClave_(skuTexto);

  const hojas =
    smResolverHojas_(ss);

  const productos =
    smLeerHojaOpcional_(
      hojas.productos
    );

  const plan =
    smLeerHojaOpcional_(
      hojas.plan
    );

  const stock =
    smLeerHojaOpcional_(
      hojas.stock
    );

  const detalle =
    smLeerHojaOpcional_(
      hojas.detalle
    );

  const ordenes =
    smLeerHojaOpcional_(
      hojas.ordenes
    );

  const equivalencias =
    smLeerHojaOpcional_(
      hojas.equivalencias
    );

  const parametros =
    smLeerHojaOpcional_(
      hojas.parametros
    );

  const ventasRaw =
    smLeerHojaOpcional_(
      hojas.ventas
    );

  /*
   * Resuelve alias/código comercial al SKU BAM canónico.
   * Ejemplo:
   * DJ1012SPEP -> LUXDJ1012SPEP
   */
  const resolucionSku =
    (
      typeof skuIdentityResolver ===
      'function'
    )
      ? skuIdentityResolver(
          skuTexto
        )
      : smResolverSkuCanonico_(
          skuTexto,
          equivalencias,
          ventasRaw,
          productos,
          plan
        );

  if (
    resolucionSku &&
    resolucionSku.ambiguo
  ) {
    throw new Error(
      'El código "' +
      skuTexto +
      '" tiene más de una equivalencia posible: ' +
      (
        resolucionSku.candidatos ||
        []
      ).join(', ')
    );
  }

  const skuCanonico =
    (
      resolucionSku &&
      resolucionSku.skuCanonico
    )
      ? resolucionSku.skuCanonico
      : skuTexto;

  const claveSkuCanonica =
    smNormalizarClave_(
      skuCanonico
    );

  const productoCanonico =
    productos.find(reg =>
      smNormalizarClave_(
        reg.SKU
      ) === claveSkuCanonica
    ) || {};

  const productoAlias =
    productos.find(reg =>
      smNormalizarClave_(
        reg.SKU
      ) === claveSku
    ) || {};

  const producto =
    Object.assign(
      {},
      productoAlias,
      productoCanonico
    );

  const filaPlanCanonica =
    plan.find(reg =>
      smNormalizarClave_(
        reg.SKU
      ) === claveSkuCanonica
    ) || {};

  const filaPlanAlias =
    plan.find(reg =>
      smNormalizarClave_(
        reg.SKU
      ) === claveSku
    ) || {};

  const filaPlan =
    Object.assign(
      {},
      filaPlanAlias,
      filaPlanCanonica
    );

  if (
    Object.keys(producto).length === 0 &&
    Object.keys(filaPlan).length === 0
  ) {
    throw new Error(
      'No se encontró el SKU "' +
      skuTexto +
      '" ni su equivalente canónico en PRODUCTOS o PLAN_COMPRAS.'
    );
  }

  /*
   * Identificación mínima para consultar ventas.
   * Se construye antes del modelo completo porque las ventas
   * también aportan descripción, marca y otros datos maestros.
   */
  const identificacion = {
    skuConsultado:
      skuTexto,

    skuCanonico:
      skuCanonico,

    skuOriginal:
      skuTexto,

    aliases:
      Array.isArray(
        resolucionSku.aliases
      )
        ? resolucionSku.aliases
        : []
  };

  const ventas =
    smCargarVentasIdentificacion_(
      identificacion
    );

  const resumenStock =
    (
      typeof obtenerResumenStockModelo_ ===
      'function'
    )
      ? obtenerResumenStockModelo_(
          stock,
          skuCanonico,
          filaPlan
        )
      : (
          typeof obtenerResumenStockFichaSku_ ===
          'function'
        )
          ? obtenerResumenStockFichaSku_(
              stock,
              claveSkuCanonica,
              filaPlan
            )
          : smResumenStockBasico_(
              stock,
              claveSkuCanonica,
              filaPlan
            );

  const resumenImportaciones =
    (
      typeof obtenerResumenImportacionesFichaSku_ ===
      'function'
    )
      ? obtenerResumenImportacionesFichaSku_(
          detalle,
          ordenes,
          equivalencias,
          parametros,
          claveSkuCanonica,
          filaPlan
        )
      : smResumenImportacionesVacio_();

  Object.assign(
    identificacion,
    smConstruirIdentificacion_(
      skuCanonico,
      producto,
      filaPlan,
      ventas
    )
  );

  identificacion.skuConsultado =
    skuTexto;

  identificacion.skuCanonico =
    skuCanonico;

  identificacion.resueltoPor =
    resolucionSku.origen || '';

  identificacion.confianzaIdentidad =
    resolucionSku.confianza !==
      undefined
      ? resolucionSku.confianza
      : null;

  identificacion.aliases =
    Array.isArray(
      resolucionSku.aliases
    )
      ? resolucionSku.aliases
      : [];

  const compras =
    smConstruirCompras_(
      producto,
      filaPlan
    );

  const cobertura =
    smConstruirCobertura_(
      resumenStock,
      ventas,
      resumenImportaciones,
      filaPlan
    );

  const parametrosModelo =
    smConstruirParametrosModelo_(
      identificacion.marca
    );

  const diagnostico =
    smConstruirDiagnosticoBase_(
      identificacion,
      ventas,
      resumenStock,
      resumenImportaciones,
      cobertura,
      compras,
      parametrosModelo
    );

  const calidadDatos =
    smEvaluarCalidadDatos_(
      identificacion,
      ventas,
      resumenStock,
      resumenImportaciones,
      compras
    );

  const timeline =
    (
      typeof construirTimelineSku ===
      'function'
    )
      ? construirTimelineSku({
          identificacion:
            identificacion,
          ventas:
            ventas,
          stock:
            resumenStock,
          importaciones:
            resumenImportaciones,
          cobertura:
            cobertura,
          compras:
            compras,
          parametros:
            parametrosModelo,
          diagnostico:
            diagnostico,
          calidadDatos:
            calidadDatos
        })
      : null;

  const modeloBaseScore = {
    identificacion:
      identificacion,
    ventas:
      ventas,
    stock:
      resumenStock,
    importaciones:
      resumenImportaciones,
    cobertura:
      cobertura,
    compras:
      compras,
    parametros:
      parametrosModelo,
    diagnostico:
      diagnostico,
    calidadDatos:
      calidadDatos,
    timeline:
      timeline
  };

  const score =
    (
      typeof calcularScoreSKU ===
      'function'
    )
      ? calcularScoreSKU(
          modeloBaseScore
        )
      : null;

  const modeloBaseReglas = Object.assign(
    {},
    modeloBaseScore,
    {
      score:
        score
    }
  );

  const reglas =
    (
      typeof evaluarReglasSku ===
      'function'
    )
      ? evaluarReglasSku(
          modeloBaseReglas
        )
      : null;

  const modelo = {
    meta: {
      version:
        SII_SKU_MODELO_V60100.VERSION,

      generadoEn:
        new Date(),

      duracionMs:
        Date.now() - inicio,

      fuenteVentas:
        ventas.fuente || ''
    },

    identificacion:
      identificacion,

    ventas:
      ventas,

    stock:
      resumenStock,

    importaciones:
      resumenImportaciones,

    cobertura:
      cobertura,

    compras:
      compras,

    parametros:
      parametrosModelo,

    diagnostico:
      diagnostico,

    calidadDatos:
      calidadDatos,

    timeline:
      timeline,

    score:
      score,

    reglas:
      reglas
  };

  return modelo;
}


/**
 * Construye modelos para todos los SKU únicos de PLAN_COMPRAS.
 *
 * V6.3.010: usa un contexto indexado y no ejecuta cargarSKU()
 * repetidamente.
 */
function cargarTodosLosSKUs(opciones) {
  const inicio = Date.now();
  const cfg = smNormalizarOpcionesMasivas_(opciones);
  const contexto = construirContextoSkuIndexado_();

  const skus = [];
  const vistos = new Set();

  contexto.plan.forEach(reg => {
    const sku = smLimpiarTexto_(reg.SKU);
    const clave = smNormalizarClave_(sku);

    if (!sku || !clave || vistos.has(clave)) {
      return;
    }

    vistos.add(clave);
    skus.push(sku);
  });

  const lista = cfg.limite > 0
    ? skus.slice(0, cfg.limite)
    : skus;

  return cargarModelosSkuMasivo(
    lista,
    Object.assign({}, cfg, {
      inicioGeneral: inicio,
      contexto: contexto
    })
  );
}


/**
 * Construye modelos para una lista de SKU mediante índices en memoria.
 */
function cargarModelosSkuMasivo(skus, opciones) {
  const inicio = opciones && opciones.inicioGeneral
    ? opciones.inicioGeneral
    : Date.now();

  const cfg = smNormalizarOpcionesMasivas_(opciones);
  const contexto = opciones && opciones.contexto
    ? opciones.contexto
    : construirContextoSkuIndexado_();

  const lista = Array.isArray(skus) ? skus : [];
  const unicos = [];
  const vistos = new Set();

  lista.forEach(valor => {
    const sku = smLimpiarTexto_(valor);
    const clave = smNormalizarClave_(sku);

    if (!sku || !clave || vistos.has(clave)) {
      return;
    }

    vistos.add(clave);
    unicos.push(sku);
  });

  const mapa = new Map();
  const modelos = [];
  const errores = [];

  for (let i = 0; i < unicos.length; i++) {
    const sku = unicos[i];

    try {
      const modelo = smConstruirModeloSkuIndexado_(
        sku,
        contexto,
        cfg
      );

      const canonico = smPrimerTexto_(
        modelo.identificacion.skuCanonico,
        sku
      );

      mapa.set(
        smNormalizarClave_(canonico),
        modelo
      );

      modelos.push(modelo);

    } catch (error) {
      errores.push({
        sku: sku,
        mensaje:
          error && error.message
            ? error.message
            : String(error)
      });

      if (!cfg.continuarConErrores) {
        throw error;
      }
    }
  }

  return {
    version: SII_SKU_MODELO_V60100.VERSION,
    generadoEn: new Date(),
    duracionMs: Date.now() - inicio,
    tiempoContextoMs: contexto.meta.duracionMs,
    solicitados: unicos.length,
    generados: modelos.length,
    cantidadErrores: errores.length,
    modelos: modelos,
    errores: cfg.incluirErrores ? errores : [],
    mapa: mapa,
    indices: contexto.meta.indices
  };
}


/**
 * Lee cada hoja una sola vez y construye índices directos.
 */
function construirContextoSkuIndexado_() {
  const inicio = Date.now();
  const ss = SpreadsheetApp.getActive();
  const hojas = smResolverHojas_(ss);

  const productos = smLeerHojaOpcional_(hojas.productos);
  const plan = smLeerHojaOpcional_(hojas.plan);
  const stock = smLeerHojaOpcional_(hojas.stock);
  const detalle = smLeerHojaOpcional_(hojas.detalle);
  const ordenes = smLeerHojaOpcional_(hojas.ordenes);
  const equivalencias = smLeerHojaOpcional_(hojas.equivalencias);
  const parametros = smLeerHojaOpcional_(hojas.parametros);
  const ventas = smLeerHojaOpcional_(hojas.ventas);

  const contexto = {
    productos: productos,
    plan: plan,
    stock: stock,
    detalle: detalle,
    ordenes: ordenes,
    equivalencias: equivalencias,
    parametros: parametros,
    ventas: ventas,

    productoPorSku: smIndexarPrimeroPorSku_(productos),
    planPorSku: smIndexarPrimeroPorSku_(plan),
    stockPorSku: smIndexarListaPorSku_(stock),
    detallePorSku: smIndexarListaPorSku_(detalle),
    ventaPorSku: new Map(),
    aliasACanonico: new Map(),
    parametrosPorMarca: new Map(),

    meta: {
      duracionMs: 0,
      indices: {}
    }
  };

  smIndexarVentas_(contexto);
  smIndexarEquivalencias_(contexto);

  contexto.meta.indices = {
    productos: contexto.productoPorSku.size,
    plan: contexto.planPorSku.size,
    ventas: contexto.ventaPorSku.size,
    stock: contexto.stockPorSku.size,
    detalle: contexto.detallePorSku.size,
    equivalencias: contexto.aliasACanonico.size
  };

  contexto.meta.duracionMs = Date.now() - inicio;

  return contexto;
}


function smIndexarPrimeroPorSku_(filas) {
  const mapa = new Map();

  (filas || []).forEach(reg => {
    const sku = smPrimerTexto_(
      reg.SKU,
      reg.COD_BAM,
      reg.CODIGO
    );

    const clave = smNormalizarClave_(sku);

    if (clave && !mapa.has(clave)) {
      mapa.set(clave, reg);
    }
  });

  return mapa;
}


function smIndexarListaPorSku_(filas) {
  const mapa = new Map();

  (filas || []).forEach(reg => {
    const sku = smPrimerTexto_(
      reg.SKU,
      reg.COD_BAM,
      reg.ITEM,
      reg.CODIGO_PRODUCTO,
      reg.CODIGO
    );

    const clave = smNormalizarClave_(sku);

    if (!clave) return;

    if (!mapa.has(clave)) {
      mapa.set(clave, []);
    }

    mapa.get(clave).push(reg);
  });

  return mapa;
}


function smIndexarVentas_(contexto) {
  (contexto.ventas || []).forEach(reg => {
    const canonico = smPrimerTexto_(
      reg.COD_BAM,
      reg.SKU,
      reg.CODIGO
    );

    const claveCanonica =
      smNormalizarClave_(canonico);

    if (!claveCanonica) return;

    if (!contexto.ventaPorSku.has(claveCanonica)) {
      contexto.ventaPorSku.set(
        claveCanonica,
        reg
      );
    }

    [
      reg.COD_BAM,
      reg.SKU,
      reg.CODIGO,
      reg.CODIGO_PROVEEDOR,
      reg.ITEM
    ].forEach(alias => {
      const claveAlias =
        smNormalizarClave_(alias);

      if (claveAlias) {
        contexto.aliasACanonico.set(
          claveAlias,
          canonico
        );
      }
    });
  });
}


function smIndexarEquivalencias_(contexto) {
  (contexto.equivalencias || []).forEach(reg => {
    const destino = smPrimerTexto_(
      reg.SKU,
      reg.COD_BAM,
      reg.SKU_BAM,
      reg.SKU_DESTINO
    );

    if (!destino) return;

    [
      destino,
      reg.ITEM,
      reg.CODIGO,
      reg.CODIGO_PROVEEDOR,
      reg.SKU_ORIGEN,
      reg.SKU_ANTERIOR,
      reg.CODIGO_COMERCIAL
    ].forEach(alias => {
      const clave = smNormalizarClave_(alias);

      if (clave) {
        contexto.aliasACanonico.set(
          clave,
          destino
        );
      }
    });
  });
}


function smResolverSkuIndexado_(sku, contexto) {
  const original = smLimpiarTexto_(sku);
  const clave = smNormalizarClave_(original);

  const canonico =
    contexto.aliasACanonico.get(clave) ||
    original;

  return {
    skuCanonico: canonico,
    origen:
      canonico !== original
        ? 'INDICE_EQUIVALENCIAS'
        : 'INGRESADO',
    aliases: canonico !== original
      ? [original]
      : [],
    ambiguo: false
  };
}


function smConstruirModeloSkuIndexado_(
  skuSeleccionado,
  contexto,
  opciones
) {
  const inicio = Date.now();
  const resolucion = smResolverSkuIndexado_(
    skuSeleccionado,
    contexto
  );

  const skuCanonico = resolucion.skuCanonico;
  const claveCanonica =
    smNormalizarClave_(skuCanonico);
  const claveOriginal =
    smNormalizarClave_(skuSeleccionado);

  const producto = Object.assign(
    {},
    contexto.productoPorSku.get(claveOriginal) || {},
    contexto.productoPorSku.get(claveCanonica) || {}
  );

  const filaPlan = Object.assign(
    {},
    contexto.planPorSku.get(claveOriginal) || {},
    contexto.planPorSku.get(claveCanonica) || {}
  );

  const filaVenta =
    contexto.ventaPorSku.get(claveCanonica) ||
    contexto.ventaPorSku.get(claveOriginal) ||
    {};

  if (
    Object.keys(producto).length === 0 &&
    Object.keys(filaPlan).length === 0 &&
    Object.keys(filaVenta).length === 0
  ) {
    throw new Error(
      'No se encontró el SKU "' +
      skuSeleccionado +
      '" en los índices.'
    );
  }

  const ventas =
    smConstruirVentasDesdeFilaIndexada_(
      filaVenta,
      filaPlan,
      skuCanonico
    );

  const identificacion = {
    skuConsultado: skuSeleccionado,
    skuCanonico: skuCanonico,
    skuOriginal: skuSeleccionado,
    aliases: resolucion.aliases || []
  };

  Object.assign(
    identificacion,
    smConstruirIdentificacion_(
      skuCanonico,
      producto,
      filaPlan,
      ventas
    )
  );

  identificacion.skuConsultado = skuSeleccionado;
  identificacion.skuCanonico = skuCanonico;
  identificacion.resueltoPor = resolucion.origen;
  identificacion.confianzaIdentidad = 1;
  identificacion.aliases = resolucion.aliases || [];

  const filasStock =
    contexto.stockPorSku.get(claveCanonica) ||
    contexto.stockPorSku.get(claveOriginal) ||
    [];

  const resumenStock = smResumenStockBasico_(
    filasStock,
    claveCanonica,
    filaPlan
  );

  const resumenImportaciones =
    smResumenImportacionesDesdePlanIndexado_(
      filaPlan
    );

  const compras = smConstruirCompras_(
    producto,
    filaPlan
  );

  const cobertura = smConstruirCobertura_(
    resumenStock,
    ventas,
    resumenImportaciones,
    filaPlan
  );

  const parametrosModelo =
    smConstruirParametrosMarcaCache_(
      identificacion.marca,
      contexto
    );

  const diagnostico = smConstruirDiagnosticoBase_(
    identificacion,
    ventas,
    resumenStock,
    resumenImportaciones,
    cobertura,
    compras,
    parametrosModelo
  );

  const calidadDatos = smEvaluarCalidadDatos_(
    identificacion,
    ventas,
    resumenStock,
    resumenImportaciones,
    compras
  );

  const modeloBase = {
    identificacion: identificacion,
    ventas: ventas,
    stock: resumenStock,
    importaciones: resumenImportaciones,
    cobertura: cobertura,
    compras: compras,
    parametros: parametrosModelo,
    diagnostico: diagnostico,
    calidadDatos: calidadDatos,
    timeline: null
  };

  const score =
    typeof calcularScoreSKU === 'function'
      ? calcularScoreSKU(modeloBase)
      : null;

  const reglas =
    typeof evaluarReglasSku === 'function'
      ? evaluarReglasSku(
          Object.assign({}, modeloBase, {
            score: score
          })
        )
      : null;

  return Object.assign({}, modeloBase, {
    meta: {
      version: SII_SKU_MODELO_V60100.VERSION,
      generadoEn: new Date(),
      duracionMs: Date.now() - inicio,
      fuenteVentas: ventas.fuente || '',
      motor: 'INDEXADO'
    },
    score: score,
    reglas: reglas
  });
}


function smConstruirVentasDesdeFilaIndexada_(
  filaVenta,
  filaPlan,
  skuCanonico
) {
  const historico = [];

  Object.keys(filaVenta || {}).forEach(clave => {
    const match = String(clave).match(
      /^(ENE|FEB|MAR|ABR|MAY|JUN|JUL|AGO|SEP|OCT|NOV|DIC)_(\d{4})$/
    );

    if (!match) return;

    const unidades = smNumero_(filaVenta[clave]);
    const facturacion = smNumero_(
      filaVenta['TOTAL_' + clave]
    );

    historico.push({
      periodo: clave,
      anio: Number(match[2]),
      mes: smNumeroMes_(match[1]),
      unidades: unidades,
      facturacion: facturacion
    });
  });

  historico.sort((a, b) =>
    (a.anio * 100 + a.mes) -
    (b.anio * 100 + b.mes)
  );

  const ultimos12 = historico.slice(-12);
  const ultimos6 = historico.slice(-6);
  const ultimos3 = historico.slice(-3);

  const sumar = lista =>
    lista.reduce(
      (total, reg) => total + reg.unidades,
      0
    );

  const sumarFacturacion = lista =>
    lista.reduce(
      (total, reg) => total + reg.facturacion,
      0
    );

  const total12 = ultimos12.length > 0
    ? sumar(ultimos12)
    : smNumero_(filaPlan.CONSUMO_12_MESES);

  const meses = historico.length > 0
    ? historico.length
    : smNumero_(filaPlan.MESES);

  const promedioFallback = smPrimerNumero_(
    filaPlan.PROMEDIO_MENSUAL,
    meses > 0 ? total12 / meses : 0
  );

  const promedio = lista =>
    lista.length > 0
      ? sumar(lista) / lista.length
      : promedioFallback;

  return {
    sku: skuCanonico,
    descripcion: smPrimerTexto_(
      filaVenta.DESCRIPCION,
      filaPlan.DESCRIPCION
    ),
    marca: smPrimerTexto_(
      filaVenta.MARCA,
      filaPlan.MARCA
    ),
    proveedor: smPrimerTexto_(
      filaVenta.PROVEEDOR,
      filaPlan.PROVEEDOR
    ),
    historicoMensual: historico,
    cantidadMeses: meses,
    mesesConVenta: historico.filter(
      reg => reg.unidades !== 0
    ).length,
    totalUnidades: total12,
    totalFacturacion: sumarFacturacion(ultimos12),
    promedio3: promedio(ultimos3),
    promedio6: promedio(ultimos6),
    promedio12: promedio(ultimos12),
    promedioTotal: promedioFallback,
    promedioMensual: promedioFallback,
    tendencia: 'NO CALCULADA EN CARGA MASIVA',
    clasificacionAceleracion: 'NO CALCULADA',
    fuente: historico.length > 0
      ? 'VENTAS_INDEXADAS'
      : 'PLAN_COMPRAS'
  };
}


function smNumeroMes_(mes) {
  const mapa = {
    ENE: 1,
    FEB: 2,
    MAR: 3,
    ABR: 4,
    MAY: 5,
    JUN: 6,
    JUL: 7,
    AGO: 8,
    SEP: 9,
    OCT: 10,
    NOV: 11,
    DIC: 12
  };

  return mapa[mes] || 0;
}


function smResumenImportacionesDesdePlanIndexado_(
  filaPlan
) {
  const cantidadPendiente = smNumero_(
    filaPlan.PENDIENTE_RECIBIR
  );

  return {
    cantidadOrdenes: 0,
    ordenesConPendiente:
      cantidadPendiente > 0 ? 1 : 0,
    cantidadPedida: cantidadPendiente,
    cantidadRecibida: 0,
    cantidadPendiente: cantidadPendiente,
    enFabrica: smNumero_(filaPlan.EN_FABRICA),
    aEmbarcar: smNumero_(filaPlan.A_EMBARCAR),
    embarcado: smNumero_(filaPlan.EMBARCADO),
    aIngresar: smNumero_(filaPlan.A_INGRESAR),
    otrosEstados: 0,
    llegaAntesQuiebre: smNumero_(
      filaPlan.PENDIENTE_QUE_LLEGA_A_TIEMPO
    ),
    llegaDespuesQuiebre: smNumero_(
      filaPlan.PENDIENTE_QUE_LLEGA_TARDE
    ),
    sinFechaEstimada: 0,
    primeraLlegadaEstimada:
      filaPlan.PRIMERA_LLEGADA_ESTIMADA_DIAS || '',
    ultimaLlegadaEstimada: '',
    fechaQuiebre:
      filaPlan.DIAS_QUIEBRE_PROYECTADO || '',
    lineas: []
  };
}


function smConstruirParametrosMarcaCache_(
  marca,
  contexto
) {
  const clave = smNormalizarTexto_(marca);

  if (contexto.parametrosPorMarca.has(clave)) {
    return contexto.parametrosPorMarca.get(clave);
  }

  const parametros = smConstruirParametrosModelo_(marca);
  contexto.parametrosPorMarca.set(clave, parametros);

  return parametros;
}


function smNormalizarOpcionesMasivas_(opciones) {
  const cfg = opciones || {};

  return {
    limite: Math.max(
      0,
      Math.floor(smNumero_(cfg.limite))
    ),
    continuarConErrores:
      cfg.continuarConErrores !== false,
    incluirErrores:
      cfg.incluirErrores !== false,
    inicioGeneral:
      cfg.inicioGeneral || null,
    incluirTimeline:
      cfg.incluirTimeline === true
  };
}


function invalidarContextoSkuIndexado_() {
  return true;
}


/**
 * Toma el SKU desde la fila seleccionada.
 */
function cargarSkuSeleccionado() {
  const ss =
    SpreadsheetApp.getActive();

  const sh =
    ss.getActiveSheet();

  const rango =
    ss.getActiveRange();

  if (!sh || !rango) {
    throw new Error(
      'Seleccioná una fila que contenga un SKU.'
    );
  }

  const encabezados =
    sh.getRange(
      1,
      1,
      1,
      sh.getLastColumn()
    ).getDisplayValues()[0];

  const mapa =
    smMapaEncabezados_(
      encabezados
    );

  const colSku =
    mapa.get('SKU');

  if (colSku === undefined) {
    throw new Error(
      'La hoja seleccionada no contiene una columna SKU.'
    );
  }

  const sku =
    smLimpiarTexto_(
      sh.getRange(
        rango.getRow(),
        colSku + 1
      ).getDisplayValue()
    );

  if (!sku) {
    throw new Error(
      'La fila seleccionada no contiene un SKU.'
    );
  }

  return cargarSKU(sku);
}


/**
 * Prueba rápida.
 *
 * Busca el primer SKU de PLAN_COMPRAS y lo muestra en el log.
 */
function probarModeloSku() {
  const ss =
    SpreadsheetApp.getActive();

  const shPlan =
    ss.getSheetByName(
      (
        typeof SII_CFG !== 'undefined' &&
        SII_CFG.SHEETS &&
        SII_CFG.SHEETS.PLAN_COMPRAS
      )
        ? SII_CFG.SHEETS.PLAN_COMPRAS
        : SII_SKU_MODELO_V60100
            .HOJAS.PLAN_COMPRAS
    );

  if (!shPlan) {
    throw new Error(
      'No existe PLAN_COMPRAS.'
    );
  }

  const datos =
    shPlan.getDataRange()
      .getDisplayValues();

  if (datos.length < 2) {
    throw new Error(
      'PLAN_COMPRAS no contiene registros.'
    );
  }

  const mapa =
    smMapaEncabezados_(
      datos[0]
    );

  const colSku =
    mapa.get('SKU');

  if (colSku === undefined) {
    throw new Error(
      'PLAN_COMPRAS no contiene la columna SKU.'
    );
  }

  let sku = '';

  for (
    let i = 1;
    i < datos.length;
    i++
  ) {
    sku =
      smLimpiarTexto_(
        datos[i][colSku]
      );

    if (sku) break;
  }

  if (!sku) {
    throw new Error(
      'No se encontró ningún SKU para probar.'
    );
  }

  const modelo =
    cargarSKU(sku);

  Logger.log(
    JSON.stringify(
      modelo,
      null,
      2
    )
  );

  SpreadsheetApp
    .getActive()
    .toast(
      'Modelo SKU generado: ' +
      sku,
      'SKU',
      6
    );

  return modelo;

  Logger.log(
    JSON.stringify(
      modelo.ventas,
      null,
      2
    )
  );

}




/**************************************************************
 * IDENTIFICACIÓN
 **************************************************************/

function smConstruirIdentificacion_(
  skuCanonico,
  producto,
  filaPlan,
  ventas
) {
  producto = producto || {};
  filaPlan = filaPlan || {};
  ventas = ventas || {};

  /*
   * Fuente prioritaria:
   *
   * DESCRIPCIÓN → VENTAS
   * MARCA       → VENTAS
   *
   * producto y PLAN_COMPRAS quedan solamente
   * como respaldo cuando VENTAS no tenga el dato.
   */

  const descripcion =
    smPrimerTexto_(
      ventas.descripcion,
      ventas.DESCRIPCION,
      ventas.Descripcion,
      ventas['Descripción'],

      producto.descripcion,
      producto.DESCRIPCION,
      producto.Descripcion,
      producto['Descripción'],

      filaPlan.descripcion,
      filaPlan.DESCRIPCION,
      filaPlan.Descripcion,
      filaPlan['Descripción']
    );

  const marca =
    smPrimerTexto_(
      ventas.marca,
      ventas.MARCA,
      ventas.Marca,

      producto.marca,
      producto.MARCA,
      producto.Marca,

      filaPlan.marca,
      filaPlan.MARCA,
      filaPlan.Marca
    );

  const proveedor =
    smPrimerTexto_(
      producto.proveedor,
      producto.proveedorPrincipal,
      producto.PROVEEDOR,

      filaPlan.proveedor,
      filaPlan.proveedorPrincipal,
      filaPlan.PROVEEDOR,

      ventas.proveedor,
      ventas.PROVEEDOR
    );

  const ean =
    smPrimerTexto_(
      producto.ean,
      producto.EAN,
      producto.codigoBarras,
      producto.CODIGO_BARRAS,

      filaPlan.ean,
      filaPlan.EAN,

      ventas.ean,
      ventas.EAN
    );

  const codigoProveedor =
    smPrimerTexto_(
      producto.codigoProveedor,
      producto.codigoProveedorOriginal,
      producto.CODIGO_PROVEEDOR,

      filaPlan.codigoProveedor,
      filaPlan.CODIGO_PROVEEDOR,

      ventas.codigoProveedor,
      ventas.CODIGO_PROVEEDOR
    );

  return {
    skuCanonico:
      smTexto_(skuCanonico),

    skuOriginal:
      smPrimerTexto_(
        producto.skuOriginal,
        filaPlan.skuOriginal,
        ventas.skuOriginal,
        skuCanonico
      ),

    descripcion:
      descripcion,

    marca:
      marca,

    proveedor:
      proveedor,

    proveedorPrincipal:
      proveedor,

    ean:
      ean,

    codigoProveedor:
      codigoProveedor
  };
}


/**************************************************************
 * COMPRAS
 **************************************************************/

function smConstruirCompras_(
  producto,
  filaPlan
) {
  const costoUsd =
    smPrimerNumeroNullable_(
      producto.COSTO_USD,
      producto['COSTO USD'],
      producto.COSTO_UNITARIO_USD,
      producto.COSTO_UNITARIO,
      producto.COSTO
    );

  const cantidadSugerida =
    smNumero_(
      filaPlan.CANTIDAD_SUGERIDA
    );

  return {
    estadoCompra:
      smPrimerTexto_(
        filaPlan.ESTADO_COMPRA
      ),

    accion:
      smPrimerTexto_(
        filaPlan.ACCION
      ),

    prioridad:
      smPrimerTexto_(
        filaPlan.PRIORIDAD
      ),

    riesgoRuptura:
      smPrimerTexto_(
        filaPlan.RIESGO_RUPTURA
      ),

    cantidadSugerida:
      cantidadSugerida,

    costoUnitarioUsd:
      costoUsd,

    compraEstimadaUsd:
      (
        costoUsd !== null &&
        cantidadSugerida > 0
      )
        ? costoUsd *
          cantidadSugerida
        : null,

    objetivoMeses:
      smNumeroNullable_(
        filaPlan.OBJETIVO_MESES
      ),

    leadTimeDias:
      smNumeroNullable_(
        filaPlan.LEAD_TIME_DIAS
      ),

    diasQuiebre:
      smNumeroNullable_(
        filaPlan.DIAS_QUIEBRE_PROYECTADO
      ),

    primeraLlegadaDias:
      smNumeroNullable_(
        filaPlan.PRIMERA_LLEGADA_ESTIMADA_DIAS
      ),

    pendienteLlegaTarde:
      smNumero_(
        filaPlan.PENDIENTE_QUE_LLEGA_TARDE
      ),

    motivo:
      smPrimerTexto_(
        filaPlan.MOTIVO,
        filaPlan.MOTIVO_MRP
      )
  };
}


/**************************************************************
 * COBERTURA
 **************************************************************/

function smConstruirCobertura_(
  stock,
  ventas,
  importaciones,
  filaPlan
) {
  const promedioBase =
    smSeleccionarPromedioDemanda_(
      ventas
    );

  const stockTotal =
    smPrimerNumero_(
      stock.stockDisponible,
      stock.total,
      filaPlan.STOCK_DISPONIBLE,
      filaPlan.STOCK_TOTAL
    );

  const pendienteTotal =
    smPrimerNumero_(
      importaciones.cantidadPendiente,
      filaPlan.PENDIENTE_RECIBIR
    );

  const coberturaCalculada =
    promedioBase > 0
      ? stockTotal /
        promedioBase
      : null;

  const coberturaProyectadaCalculada =
    promedioBase > 0
      ? (
          stockTotal +
          pendienteTotal
        ) /
        promedioBase
      : null;

  return {
    promedioDemandaBase:
      promedioBase,

    criterioDemanda:
      smCriterioPromedioDemanda_(
        ventas
      ),

    actualMeses:
      smPrimerNumeroNullable_(
        filaPlan.COBERTURA_ACTUAL_MESES,
        coberturaCalculada
      ),

    proyectadaMeses:
      smPrimerNumeroNullable_(
        filaPlan.COBERTURA_PROYECTADA_MESES,
        coberturaProyectadaCalculada
      ),

    objetivoMeses:
      smNumeroNullable_(
        filaPlan.OBJETIVO_MESES
      ),

    stockTotal:
      stockTotal,

    pendienteTotal:
      pendienteTotal,

    llegaAntesQuiebre:
      smNumero_(
        importaciones
          .llegaAntesQuiebre
      ),

    llegaDespuesQuiebre:
      smNumero_(
        importaciones
          .llegaDespuesQuiebre
      )
  };
}


function smSeleccionarPromedioDemanda_(
  ventas
) {
  if (
    ventas &&
    ventas.cantidadMeses >= 3 &&
    ventas.promedio3 > 0
  ) {
    return ventas.promedio3;
  }

  if (
    ventas &&
    ventas.promedio6 > 0
  ) {
    return ventas.promedio6;
  }

  if (
    ventas &&
    ventas.promedio12 > 0
  ) {
    return ventas.promedio12;
  }

  return smNumero_(
    ventas &&
    (
      ventas.promedioTotal ||
      ventas.promedioMensual
    )
  );
}


function smCriterioPromedioDemanda_(
  ventas
) {
  if (
    ventas &&
    ventas.cantidadMeses >= 3 &&
    ventas.promedio3 > 0
  ) {
    return 'PROMEDIO_3_MESES';
  }

  if (
    ventas &&
    ventas.promedio6 > 0
  ) {
    return 'PROMEDIO_6_MESES';
  }

  if (
    ventas &&
    ventas.promedio12 > 0
  ) {
    return 'PROMEDIO_12_MESES';
  }

  return 'PROMEDIO_TOTAL';
}


/**************************************************************
 * PARÁMETROS
 **************************************************************/

function smConstruirParametrosModelo_(
  marca
) {
  const coberturaObjetivo =
    (
      typeof obtenerCoberturaMarca ===
      'function'
    )
      ? obtenerCoberturaMarca(
          marca,
          4
        )
      : 4;

  const diasLogisticos =
    (
      typeof obtenerDiasLogisticos ===
      'function'
    )
      ? obtenerDiasLogisticos()
      : {
          aIngresar: 10,
          embarcado: 45,
          aEmbarcar: 90,
          enFabrica: 120,
          bufferRecepcion: 0
        };

  const ipc =
    (
      typeof obtenerParametrosGrupo ===
      'function'
    )
      ? obtenerParametrosGrupo(
          'IPC'
        )
      : {};

  return {
    coberturaObjetivo:
      coberturaObjetivo,

    diasLogisticos:
      diasLogisticos,

    ipc:
      ipc
  };
}


/**************************************************************
 * DIAGNÓSTICO BASE
 **************************************************************/

function smConstruirDiagnosticoBase_(
  identificacion,
  ventas,
  stock,
  importaciones,
  cobertura,
  compras,
  parametros
) {
  let nivel = 'VERDE';
  let titulo = 'SIN ACCIÓN INMEDIATA';

  const motivos = [];
  const recomendaciones = [];

  /*
   * La calidad de datos tiene prioridad.
   * El sistema no emite una recomendación normal
   * cuando faltan datos esenciales.
   */
  const sinDescripcion =
    !identificacion.descripcion;

  const sinMarca =
    !identificacion.marca;

  const sinProveedor =
    !identificacion.proveedor;

  const sinVentas =
    !ventas ||
    ventas.fuente === 'SIN DATOS' ||
    (
      smNumero_(
        ventas.totalUnidades
      ) === 0 &&
      smNumero_(
        ventas.cantidadMeses
      ) === 0
    );

  const sinStockRegistrado =
    smNumero_(
      stock.stockDisponible
    ) === 0 &&
    smNumero_(
      stock.stockEscobar
    ) === 0 &&
    smNumero_(
      stock.stockWarnes
    ) === 0 &&
    smNumero_(
      stock.stockOtros
    ) === 0;

  const datosEsencialesFaltantes =
    sinDescripcion ||
    sinMarca ||
    sinVentas;

  if (datosEsencialesFaltantes) {
    nivel = 'GRIS';
    titulo = 'DATOS INSUFICIENTES';

    if (sinDescripcion) {
      motivos.push(
        'Descripción faltante.'
      );
    }

    if (sinMarca) {
      motivos.push(
        'Marca faltante.'
      );
    }

    if (sinProveedor) {
      motivos.push(
        'Proveedor faltante.'
      );
    }

    if (sinVentas) {
      motivos.push(
        'Sin historial de ventas.'
      );
    }

    if (sinStockRegistrado) {
      motivos.push(
        'Sin stock registrado.'
      );
    }

    motivos.push(
      'El producto puede ser nuevo o puede faltar una equivalencia.'
    );

    recomendaciones.push(
      'Revisar PRODUCTOS, EQUIVALENCIAS_SKU y VENTAS antes de decidir una compra.'
    );

    if (
      importaciones.cantidadPendiente > 0
    ) {
      recomendaciones.push(
        'Mantener seguimiento de las ' +
        smFormatearNumero_(
          importaciones.cantidadPendiente,
          0
        ) +
        ' unidades pendientes.'
      );
    }

    return {
      nivel: nivel,
      titulo: titulo,
      motivos: motivos,
      recomendaciones:
        recomendaciones,
      confiable: false
    };
  }

  const coberturaActual =
    cobertura.actualMeses;

  const urgente =
    (
      typeof obtenerParametroNumero ===
      'function'
    )
      ? obtenerParametroNumero(
          'COBERTURA',
          'URGENTE_MESES',
          1
        )
      : 1;

  const comprar =
    (
      typeof obtenerParametroNumero ===
      'function'
    )
      ? obtenerParametroNumero(
          'COBERTURA',
          'COMPRAR_MESES',
          2
        )
      : 2;

  if (
    coberturaActual !== null &&
    coberturaActual <= urgente
  ) {
    nivel = 'ROJO';
    titulo = 'COMPRA URGENTE';

    motivos.push(
      'Cobertura actual de ' +
      smFormatearNumero_(
        coberturaActual,
        2
      ) +
      ' meses.'
    );

  } else if (
    coberturaActual !== null &&
    coberturaActual <= comprar
  ) {
    nivel = 'NARANJA';
    titulo = 'PLANIFICAR COMPRA';

    motivos.push(
      'La cobertura está por debajo del umbral de compra.'
    );
  }

  if (
    cobertura.llegaDespuesQuiebre > 0
  ) {
    if (nivel === 'VERDE') {
      nivel = 'NARANJA';
      titulo =
        'REVISAR ABASTECIMIENTO';
    }

    motivos.push(
      smFormatearNumero_(
        cobertura.llegaDespuesQuiebre,
        0
      ) +
      ' unidades llegarían después del quiebre.'
    );
  }

  if (
    importaciones.cantidadPendiente === 0 &&
    compras.cantidadSugerida > 0
  ) {
    motivos.push(
      'No se detectaron importaciones pendientes.'
    );
  }

  if (
    ventas.clasificacionAceleracion ===
      'ACELERANDO' &&
    ventas.mesesConVenta >= 3
  ) {
    motivos.push(
      'La demanda reciente está acelerando.'
    );
  }

  if (
    compras.cantidadSugerida > 0
  ) {
    recomendaciones.push(
      'Evaluar compra por ' +
      smFormatearNumero_(
        compras.cantidadSugerida,
        0
      ) +
      ' unidades.'
    );
  } else {
    recomendaciones.push(
      'Mantener seguimiento periódico.'
    );
  }

  if (
    compras.costoUnitarioUsd === null &&
    compras.cantidadSugerida > 0
  ) {
    recomendaciones.push(
      'Completar costo USD para valorizar la compra.'
    );
  }

  return {
    nivel: nivel,
    titulo: titulo,
    motivos: motivos,
    recomendaciones:
      recomendaciones,
    confiable: true
  };
}

/**************************************************************
 * CALIDAD DE DATOS
 **************************************************************/

function smEvaluarCalidadDatos_(
  identificacion,
  ventas,
  stock,
  importaciones,
  compras
) {
  const alertas = [];

  if (!identificacion.descripcion) {
    alertas.push(
      'Descripción faltante'
    );
  }

  if (!identificacion.marca) {
    alertas.push(
      'Marca faltante'
    );
  }

  if (!identificacion.proveedor) {
    alertas.push(
      'Proveedor faltante'
    );
  }

  if (
    !ventas ||
    ventas.fuente === 'SIN DATOS'
  ) {
    alertas.push(
      'Ventas faltantes'
    );
  }

  if (
    compras.cantidadSugerida > 0 &&
    compras.costoUnitarioUsd === null
  ) {
    alertas.push(
      'Costo USD faltante'
    );
  }

  if (
    importaciones &&
    importaciones.sinFechaEstimada > 0
  ) {
    alertas.push(
      'Importaciones sin fecha estimada'
    );
  }

  const puntaje =
    Math.max(
      0,
      100 -
      (
        alertas.length *
        15
      )
    );

  return {
    completa:
      alertas.length === 0,

    puntaje:
      puntaje,

    nivel:
      puntaje >= 90
        ? 'ALTA'
        : (
            puntaje >= 70
              ? 'MEDIA'
              : 'BAJA'
          ),

    cantidadAlertas:
      alertas.length,

    alertas:
      alertas
  };
}


/**************************************************************
 * RESPALDOS
 **************************************************************/

function smModeloVentasBasico_(
  filaPlan
) {
  const total =
    smNumero_(
      filaPlan.CONSUMO_12_MESES
    );

  const meses =
    smNumero_(
      filaPlan.MESES
    );

  const promedio =
    smPrimerNumero_(
      filaPlan.PROMEDIO_MENSUAL,
      meses > 0
        ? total / meses
        : 0
    );

  return {
    sku:
      smLimpiarTexto_(
        filaPlan.SKU
      ),

    historicoMensual:
      [],

    cantidadMeses:
      meses,

    mesesConVenta:
      meses,

    totalUnidades:
      total,

    promedio3:
      promedio,

    promedio6:
      promedio,

    promedio12:
      promedio,

    promedioTotal:
      promedio,

    tendencia:
      'SIN HISTORICO',

    clasificacionAceleracion:
      'SIN HISTORICO',

    fuente:
      'PLAN_COMPRAS'
  };
}


function smResumenStockBasico_(
  stock,
  claveSku,
  filaPlan
) {
  const resumen = {
    stockDisponible: 0,
    stockWarnes: 0,
    stockEscobar: 0,
    stockOtros: 0,
    total: 0
  };

  stock.forEach(reg => {
    if (
      smNormalizarClave_(
        reg.SKU
      ) !== claveSku
    ) {
      return;
    }

    const cantidad =
      smPrimerNumero_(
        reg.STOCK_DISPONIBLE,
        reg.STOCK,
        reg.CANTIDAD
      );

    const deposito =
      smNormalizarTexto_(
        reg.DEPOSITO
      );

    resumen.stockDisponible +=
      cantidad;

    if (
      deposito.includes('WARNES')
    ) {
      resumen.stockWarnes +=
        cantidad;

    } else if (
      deposito.includes('ESCOBAR')
    ) {
      resumen.stockEscobar +=
        cantidad;

    } else {
      resumen.stockOtros +=
        cantidad;
    }
  });

  if (
    resumen.stockDisponible === 0
  ) {
    resumen.stockDisponible =
      smPrimerNumero_(
        filaPlan.STOCK_DISPONIBLE,
        filaPlan.STOCK_TOTAL
      );
  }

  resumen.total =
    resumen.stockDisponible;

  return resumen;
}


function smResumenImportacionesVacio_() {
  return {
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
    fechaQuiebre: '',
    lineas: []
  };
}


/**************************************************************
 * LECTURA DE HOJAS
 **************************************************************/

function smResolverHojas_(ss) {
  return {
    productos:
      smBuscarHoja_(
        ss,
        smNombreHojaCfg_(
          'PRODUCTOS',
          SII_SKU_MODELO_V60100
            .HOJAS.PRODUCTOS
        )
      ),

    plan:
      smBuscarHoja_(
        ss,
        smNombreHojaCfg_(
          'PLAN_COMPRAS',
          SII_SKU_MODELO_V60100
            .HOJAS.PLAN_COMPRAS
        )
      ),

    stock:
      smBuscarHoja_(
        ss,
        smNombreHojaCfg_(
          'STOCK',
          SII_SKU_MODELO_V60100
            .HOJAS.STOCK
        )
      ),

    detalle:
      smBuscarHoja_(
        ss,
        smNombreHojaCfg_(
          'DETALLE',
          SII_SKU_MODELO_V60100
            .HOJAS.DETALLE
        )
      ),

    ordenes:
      smBuscarHoja_(
        ss,
        smNombreHojaCfg_(
          'ORDENES',
          SII_SKU_MODELO_V60100
            .HOJAS.ORDENES
        )
      ),

    equivalencias:
      smBuscarHoja_(
        ss,
        smNombreHojaCfg_(
          'EQUIVALENCIAS_SKU',
          SII_SKU_MODELO_V60100
            .HOJAS.EQUIVALENCIAS
        )
      ),

    parametros:
      smBuscarHoja_(
        ss,
        smNombreHojaCfg_(
          'PARAMETROS',
          SII_SKU_MODELO_V60100
            .HOJAS.PARAMETROS
        )
      ),

    ventas:
      smBuscarHoja_(
        ss,
        smNombreHojaCfg_(
          'VENTAS',
          SII_SKU_MODELO_V60100
            .HOJAS.VENTAS
        )
      )
  };
}


function smNombreHojaCfg_(
  clave,
  respaldo
) {
  if (
    typeof SII_CFG !== 'undefined' &&
    SII_CFG.SHEETS &&
    SII_CFG.SHEETS[clave]
  ) {
    return SII_CFG.SHEETS[clave];
  }

  return respaldo;
}


function smBuscarHoja_(
  ss,
  nombre
) {
  return nombre
    ? ss.getSheetByName(nombre)
    : null;
}


function smLeerHojaOpcional_(
  sh
) {
  if (!sh) return [];

  const cacheActiva =
    SII_SKU_MODELO_CACHE_MASIVA_ &&
    SII_SKU_MODELO_CACHE_MASIVA_.hojas;

  const claveCache = cacheActiva
    ? String(sh.getSheetId())
    : '';

  if (cacheActiva && cacheActiva.has(claveCache)) {
    return cacheActiva.get(claveCache);
  }

  let resultado;

  if (typeof leerFilasComoObjetos_ === 'function') {
    resultado = leerFilasComoObjetos_(sh);
  } else {
    const datos = sh.getDataRange().getValues();

    if (datos.length < 2) {
      resultado = [];
    } else {
      const encabezados = datos[0].map(smNormalizarEncabezado_);
      resultado = datos
        .slice(1)
        .filter(fila => fila.some(valor => valor !== '' && valor !== null))
        .map(fila => {
          const obj = {};
          encabezados.forEach((encabezado, indice) => {
            if (encabezado) obj[encabezado] = fila[indice];
          });
          return obj;
        });
    }
  }

  if (cacheActiva) cacheActiva.set(claveCache, resultado);
  return resultado;
}


/****************************************************************
 * RESOLUCIÓN DE SKU CANÓNICO
 **************************************************************/

function smResolverSkuCanonico_(
  skuIngresado,
  equivalencias,
  ventas,
  productos,
  plan
) {
  const original =
    smLimpiarTexto_(
      skuIngresado
    );

  const claveOriginal =
    smNormalizarClave_(
      original
    );

  if (!claveOriginal) {
    return {
      skuCanonico: original,
      origen: 'INGRESADO'
    };
  }

  /*
   * 1. Equivalencias explícitas.
   */
  const camposAlias = [
    'ITEM',
    'CODIGO',
    'CODIGO_PROVEEDOR',
    'SKU_ORIGEN',
    'SKU_ANTERIOR',
    'CODIGO_COMERCIAL'
  ];

  const camposDestino = [
    'SKU',
    'COD_BAM',
    'SKU_BAM',
    'SKU_DESTINO'
  ];

  for (
    let i = 0;
    i < equivalencias.length;
    i++
  ) {
    const reg =
      equivalencias[i];

    const coincide =
      camposAlias.some(campo =>
        smNormalizarClave_(
          reg[campo]
        ) === claveOriginal
      );

    if (!coincide) {
      continue;
    }

    const destino =
      smPrimerTexto_.apply(
        null,
        camposDestino.map(
          campo => reg[campo]
        )
      );

    if (destino) {
      return {
        skuCanonico: destino,
        origen: 'EQUIVALENCIAS_SKU'
      };
    }
  }

  /*
   * 2. Mapeo del archivo de ventas:
   * Código / código comercial -> Cod_BAM.
   */
  const candidatosVentas = [];

  ventas.forEach(reg => {
    const codBam =
      smPrimerTexto_(
        reg.COD_BAM,
        reg.SKU
      );

    if (!codBam) {
      return;
    }

    const alias = [
      reg.CODIGO,
      reg.CODIGO_PROVEEDOR,
      reg.ITEM,
      reg.SKU
    ];

    const matchExacto =
      alias.some(valor =>
        smNormalizarClave_(valor) ===
          claveOriginal
      );

    const matchSufijo =
      alias.some(valor => {
        const clave =
          smNormalizarClave_(valor);

        return (
          clave.length >
            claveOriginal.length &&
          clave.endsWith(
            claveOriginal
          )
        );
      });

    if (
      matchExacto ||
      matchSufijo
    ) {
      candidatosVentas.push(
        codBam
      );
    }
  });

  const unicosVentas =
    Array.from(
      new Set(
        candidatosVentas.map(
          smLimpiarTexto_
        )
      )
    );

  if (unicosVentas.length === 1) {
    return {
      skuCanonico:
        unicosVentas[0],
      origen:
        'VENTAS_COD_BAM'
    };
  }

  /*
   * 3. Si el SKU ingresado es sufijo de un único SKU
   * existente en PLAN_COMPRAS/PRODUCTOS, lo usa.
   */
  const candidatosMaestro = [];

  [plan, productos]
    .forEach(lista => {
      lista.forEach(reg => {
        const sku =
          smLimpiarTexto_(
            reg.SKU
          );

        const clave =
          smNormalizarClave_(
            sku
          );

        if (
          clave &&
          clave !== claveOriginal &&
          clave.endsWith(
            claveOriginal
          )
        ) {
          candidatosMaestro.push(
            sku
          );
        }
      });
    });

  const unicosMaestro =
    Array.from(
      new Set(
        candidatosMaestro
      )
    );

  if (unicosMaestro.length === 1) {
    return {
      skuCanonico:
        unicosMaestro[0],
      origen:
        'MAESTRO_POR_SUFIJO'
    };
  }

  return {
    skuCanonico: original,
    origen: 'INGRESADO'
  };
}


/**************************************************************
 * UTILIDADES
 **************************************************************/

function smMapaEncabezados_(
  encabezados
) {
  const mapa = new Map();

  encabezados.forEach(
    (valor, indice) => {
      const clave =
        smNormalizarEncabezado_(
          valor
        );

      if (clave) {
        mapa.set(
          clave,
          indice
        );
      }
    }
  );

  return mapa;
}


function smNormalizarEncabezado_(
  valor
) {
  return smLimpiarTexto_(valor)
    .normalize('NFD')
    .replace(
      /[\u0300-\u036f]/g,
      ''
    )
    .toUpperCase()
    .replace(/\s+/g, '_');
}


function smNormalizarClave_(
  valor
) {
  return smLimpiarTexto_(valor)
    .normalize('NFD')
    .replace(
      /[\u0300-\u036f]/g,
      ''
    )
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
}


function smNormalizarTexto_(
  valor
) {
  return smLimpiarTexto_(valor)
    .normalize('NFD')
    .replace(
      /[\u0300-\u036f]/g,
      ''
    )
    .toUpperCase()
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ');
}


function smLimpiarTexto_(
  valor
) {
  return String(
    valor === null ||
    valor === undefined
      ? ''
      : valor
  ).trim();
}


function smNumeroNullable_(
  valor
) {
  if (
    valor === null ||
    valor === undefined ||
    smLimpiarTexto_(valor) === ''
  ) {
    return null;
  }

  const numero =
    smNumero_(valor);

  return Number.isFinite(numero)
    ? numero
    : null;
}


function smNumero_(valor) {
  if (typeof valor === 'number') {
    return Number.isFinite(valor)
      ? valor
      : 0;
  }

  let texto =
    smLimpiarTexto_(valor);

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


function smPrimerNumero_() {
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
      smLimpiarTexto_(valor) !== ''
    ) {
      return smNumero_(valor);
    }
  }

  return 0;
}


function smPrimerNumeroNullable_() {
  for (
    let i = 0;
    i < arguments.length;
    i++
  ) {
    const numero =
      smNumeroNullable_(
        arguments[i]
      );

    if (numero !== null) {
      return numero;
    }
  }

  return null;
}


function smFormatearNumero_(
  valor,
  decimales
) {
  const numero =
    Number(valor);

  if (!Number.isFinite(numero)) {
    return '0';
  }

  return numero.toLocaleString(
    'es-AR',
    {
      minimumFractionDigits:
        decimales,
      maximumFractionDigits:
        decimales
    }
  );
}

function smPrimerTexto_() {
  for (
    let i = 0;
    i < arguments.length;
    i++
  ) {
    const valor =
      smTexto_(arguments[i]);

    if (valor) {
      return valor;
    }
  }

  return '';
}

function smTexto_(valor) {
  return String(
    valor === null ||
    valor === undefined
      ? ''
      : valor
  ).trim();
}

/**
 * Busca ventas usando todas las identidades conocidas del SKU.
 *
 * Orden:
 * 1. SKU canónico.
 * 2. Alias de identidad.
 * 3. SKU original.
 * 4. SKU consultado.
 *
 * Devuelve el primer modelo con datos.
 */
function smCargarVentasIdentificacion_(
  identificacion
) {
  const candidatos = [];

  function agregar(valor) {
    const texto =
      String(
        valor === null ||
        valor === undefined
          ? ''
          : valor
      ).trim();

    if (!texto) {
      return;
    }

    const clave =
      texto
        .normalize('NFD')
        .replace(
          /[\u0300-\u036f]/g,
          ''
        )
        .toUpperCase()
        .replace(
          /[^A-Z0-9]/g,
          ''
        );

    const yaExiste =
      candidatos.some(
        candidato =>
          candidato.clave === clave
      );

    if (!yaExiste) {
      candidatos.push({
        valor: texto,
        clave: clave
      });
    }
  }

  agregar(
    identificacion.skuCanonico
  );

  (
    identificacion.aliases || []
  ).forEach(agregar);

  agregar(
    identificacion.skuOriginal
  );

  agregar(
    identificacion.skuConsultado
  );

  for (
    let i = 0;
    i < candidatos.length;
    i++
  ) {
    const modelo =
      cargarHistoricoVentas(
        candidatos[i].valor
      );

    if (
      modelo &&
      modelo.fuente !== 'SIN DATOS'
    ) {
      modelo.skuConsultadoVentas =
        candidatos[i].valor;

      return modelo;
    }
  }

  return cargarHistoricoVentas(
    identificacion.skuCanonico ||
    identificacion.skuOriginal ||
    identificacion.skuConsultado ||
    ''
  );
}

function probarIR100() {
  const modelo = cargarSKU("IR100-H1");
  Logger.log(JSON.stringify(modelo.ventas, null, 2));
}

function probarKo12065() {
  const modelo = cargarSKU('KO12065PR');
  Logger.log(
    JSON.stringify(
      modelo.stock,
      null,
      2
    )
  );
}

function probarCargaMasivaSkuV63010() {
  const resultado = cargarTodosLosSKUs({
    limite: 10,
    continuarConErrores: true,
    incluirErrores: true
  });

  Logger.log(JSON.stringify({
    version: resultado.version,
    solicitados: resultado.solicitados,
    generados: resultado.generados,
    cantidadErrores: resultado.cantidadErrores,
    duracionMs: resultado.duracionMs,
    errores: resultado.errores
  }, null, 2));

  SpreadsheetApp.getActive().toast(
    resultado.generados + ' modelos generados; ' +
      resultado.cantidadErrores + ' errores.',
    'Carga masiva SKU V6.3.010',
    8
  );

  return resultado;
}
