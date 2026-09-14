/**************************************************************
 * SII V6.1.002
 * MÓDULO: SCORE DEL SKU
 *
 * Funciones públicas:
 * - calcularScoreSKU(modelo)
 * - probarScoreSku()
 *
 * El score se compone de:
 * - Cobertura
 * - Quiebre
 * - Importaciones
 * - Lead Time
 * - Demanda
 * - Stock
 * - Órdenes abiertas
 *
 * Los pesos se leen desde PARAMETROS:
 * TIPO = IPC
 *
 * PESO_COBERTURA
 * PESO_QUIEBRE
 * PESO_IMPORTACIONES
 * PESO_LEADTIME
 * PESO_CONSUMO
 * PESO_STOCK
 * PESO_ORDENES
 *
 * Umbrales:
 * IPC_COMPRAR
 * IPC_PLANIFICAR
 * IPC_REVISAR
 * IPC_OK
 **************************************************************/

const SII_SCORE_SKU_V61002 = {
  VERSION: '6.1.002',

  PESOS_DEFAULT: {
    cobertura: 30,
    quiebre: 20,
    importaciones: 20,
    leadTime: 10,
    demanda: 10,
    stock: 5,
    ordenes: 5
  },

  UMBRALES_DEFAULT: {
    comprar: 80,
    planificar: 60,
    revisar: 40,
    ok: 0
  }
};


/**
 * Calcula el score completo del SKU.
 */
function calcularScoreSKU(modelo) {
  const inicio = Date.now();

  if (!modelo) {
    throw new Error(
      'No se recibió el modelo del SKU.'
    );
  }

  const pesos =
    scObtenerPesos_();

  const umbrales =
    scObtenerUmbrales_();

  const componentes = {
    cobertura:
      scComponenteCobertura_(
        modelo,
        pesos.cobertura
      ),

    quiebre:
      scComponenteQuiebre_(
        modelo,
        pesos.quiebre
      ),

    importaciones:
      scComponenteImportaciones_(
        modelo,
        pesos.importaciones
      ),

    leadTime:
      scComponenteLeadTime_(
        modelo,
        pesos.leadTime
      ),

    demanda:
      scComponenteDemanda_(
        modelo,
        pesos.demanda
      ),

    stock:
      scComponenteStock_(
        modelo,
        pesos.stock
      ),

    ordenes:
      scComponenteOrdenes_(
        modelo,
        pesos.ordenes
      )
  };

  const prioridadBruta =
    Object.keys(componentes)
      .reduce(
        (acum, clave) =>
          acum +
          scNumero_(
            componentes[clave]
              .puntos
          ),
        0
      );

  const maximo =
    Object.keys(componentes)
      .reduce(
        (acum, clave) =>
          acum +
          scNumero_(
            componentes[clave]
              .maximo
          ),
        0
      );

  const prioridad =
    maximo > 0
      ? Math.round(
          (
            prioridadBruta /
            maximo
          ) *
          100
        )
      : 0;

  const calidad =
    scLimitar_(
      scNumero_(
        modelo.calidadDatos &&
        modelo.calidadDatos.puntaje
      ),
      0,
      100
    );

  const confianza =
    scCalcularConfianza_(
      modelo,
      calidad
    );

  const clasificacion =
    scClasificarPrioridad_(
      prioridad,
      umbrales
    );

  const datosInsuficientes =
    modelo.diagnostico &&
    modelo.diagnostico.confiable ===
      false;

  const accion =
    datosInsuficientes
      ? 'REVISAR DATOS'
      : clasificacion.accion;

  const nivel =
    datosInsuficientes
      ? 'GRIS'
      : clasificacion.nivel;

  const reglasAplicadas = [];

  Object.keys(componentes)
    .forEach(clave => {
      const componente =
        componentes[clave];

      (
        componente.reglas || []
      ).forEach(regla => {
        if (
          !reglasAplicadas.includes(
            regla
          )
        ) {
          reglasAplicadas.push(
            regla
          );
        }
      });
    });

  if (datosInsuficientes) {
    reglasAplicadas.push(
      'DATOS_INSUFICIENTES'
    );
  }

  return {
    version:
      SII_SCORE_SKU_V61002.VERSION,

    prioridad:
      prioridad,

    prioridadBruta:
      scRedondear_(
        prioridadBruta,
        2
      ),

    maximo:
      maximo,

    calidad:
      calidad,

    confianza:
      confianza,

    nivel:
      nivel,

    accion:
      accion,

    componentes:
      componentes,

    reglasAplicadas:
      reglasAplicadas,

    parametrosUtilizados: {
      pesos:
        pesos,

      umbrales:
        umbrales
    },

    auditoria: {
      calculadoEn:
        new Date(),

      duracionMs:
        Date.now() - inicio,

      motor:
        'SCORE_SKU',

      versionMotor:
        SII_SCORE_SKU_V61002.VERSION
    }
  };
}


/**************************************************************
 * COMPONENTES
 **************************************************************/

function scComponenteCobertura_(
  modelo,
  maximo
) {
  const cobertura =
    modelo.cobertura || {};

  const actual =
    scNumeroNullable_(
      cobertura.actualMeses
    );

  const objetivo =
    scNumeroNullable_(
      cobertura.objetivoMeses
    ) ||
    scNumeroNullable_(
      modelo.parametros &&
      modelo.parametros
        .coberturaObjetivo
    ) ||
    4;

  const urgente =
    scParametroNumero_(
      'COBERTURA',
      'URGENTE_MESES',
      1
    );

  const comprar =
    scParametroNumero_(
      'COBERTURA',
      'COMPRAR_MESES',
      2
    );

  let porcentaje = 0;
  let motivo =
    'Cobertura suficiente.';
  const reglas = [];

  if (actual === null) {
    porcentaje = 0;
    motivo =
      'No existe cobertura calculable.';
    reglas.push(
      'COBERTURA_NO_CALCULABLE'
    );

  } else if (actual <= 0) {
    porcentaje = 1;
    motivo =
      'Cobertura igual a cero.';
    reglas.push('COBERTURA_CERO');

  } else if (actual <= urgente) {
    porcentaje = 1;
    motivo =
      'Cobertura crítica de ' +
      scFormatoNumero_(
        actual,
        2
      ) +
      ' meses.';
    reglas.push(
      'COBERTURA_URGENTE'
    );

  } else if (actual <= comprar) {
    porcentaje = 0.80;
    motivo =
      'Cobertura baja de ' +
      scFormatoNumero_(
        actual,
        2
      ) +
      ' meses.';
    reglas.push(
      'COBERTURA_COMPRAR'
    );

  } else if (actual < objetivo) {
    porcentaje = 0.45;
    motivo =
      'Cobertura por debajo del objetivo (' +
      scFormatoNumero_(
        actual,
        2
      ) +
      ' vs ' +
      scFormatoNumero_(
        objetivo,
        2
      ) +
      ').';
    reglas.push(
      'COBERTURA_BAJO_OBJETIVO'
    );

  } else {
    porcentaje = 0;
    motivo =
      'Cobertura igual o superior al objetivo.';
  }

  return scCrearComponente_(
    porcentaje,
    maximo,
    motivo,
    reglas
  );
}


function scComponenteQuiebre_(
  modelo,
  maximo
) {
  const timeline =
    modelo.timeline || {};

  const dias =
    scNumeroNullable_(
      timeline.diasHastaQuiebre
    );

  const leadTime =
    scNumeroNullable_(
      modelo.compras &&
      modelo.compras.leadTimeDias
    ) || 120;

  let porcentaje = 0;
  let motivo =
    'No se detecta un quiebre próximo.';
  const reglas = [];

  if (dias === null) {
    porcentaje = 0;
    motivo =
      'No se puede calcular la fecha de quiebre.';
    reglas.push(
      'QUIEBRE_NO_CALCULABLE'
    );

  } else if (dias <= 0) {
    porcentaje = 1;
    motivo =
      'El SKU se encuentra en quiebre o con quiebre inmediato.';
    reglas.push('QUIEBRE_INMEDIATO');

  } else if (dias <= 30) {
    porcentaje = 1;
    motivo =
      'Quiebre estimado en ' +
      scFormatoNumero_(
        dias,
        0
      ) +
      ' días.';
    reglas.push('QUIEBRE_30_DIAS');

  } else if (dias <= 60) {
    porcentaje = 0.80;
    motivo =
      'Quiebre estimado dentro de 60 días.';
    reglas.push('QUIEBRE_60_DIAS');

  } else if (dias < leadTime) {
    porcentaje = 0.60;
    motivo =
      'El quiebre ocurriría antes de completar el Lead Time.';
    reglas.push(
      'QUIEBRE_ANTES_LEADTIME'
    );

  } else {
    porcentaje = 0.15;
    motivo =
      'El quiebre está fuera del horizonte inmediato.';
  }

  return scCrearComponente_(
    porcentaje,
    maximo,
    motivo,
    reglas
  );
}


function scComponenteImportaciones_(
  modelo,
  maximo
) {
  const imp =
    modelo.importaciones || {};

  const pendiente =
    scNumero_(
      imp.cantidadPendiente
    );

  const antes =
    scNumero_(
      imp.llegaAntesQuiebre
    );

  const despues =
    scNumero_(
      imp.llegaDespuesQuiebre
    );

  const sinFecha =
    scNumero_(
      imp.sinFechaEstimada
    );

  let porcentaje = 0;
  let motivo =
    'Las importaciones cubren la necesidad.';
  const reglas = [];

  if (pendiente <= 0) {
    porcentaje = 1;
    motivo =
      'No existen importaciones pendientes.';
    reglas.push('SIN_TRANSITO');

  } else if (sinFecha > 0) {
    porcentaje = 0.90;
    motivo =
      'Existen importaciones sin fecha estimada.';
    reglas.push(
      'TRANSITO_SIN_FECHA'
    );

  } else if (despues > 0) {
    const proporcionTarde =
      pendiente > 0
        ? despues /
          pendiente
        : 1;

    porcentaje =
      Math.max(
        0.60,
        proporcionTarde
      );

    motivo =
      scFormatoNumero_(
        despues,
        0
      ) +
      ' unidades llegarían después del quiebre.';

    reglas.push(
      'IMPORTACION_LLEGA_TARDE'
    );

  } else if (
    antes > 0
  ) {
    porcentaje = 0.15;
    motivo =
      scFormatoNumero_(
        antes,
        0
      ) +
      ' unidades llegarían antes del quiebre.';

    reglas.push(
      'IMPORTACION_LLEGA_A_TIEMPO'
    );

  } else {
    porcentaje = 0.45;
    motivo =
      'Existe mercadería pendiente, pero no se puede comparar con el quiebre.';
    reglas.push(
      'TRANSITO_SIN_COMPARACION'
    );
  }

  return scCrearComponente_(
    porcentaje,
    maximo,
    motivo,
    reglas
  );
}


function scComponenteLeadTime_(
  modelo,
  maximo
) {
  const leadTime =
    scNumeroNullable_(
      modelo.compras &&
      modelo.compras.leadTimeDias
    );

  let porcentaje = 0;
  let motivo =
    'Lead Time bajo.';
  const reglas = [];

  if (leadTime === null) {
    porcentaje = 0.50;
    motivo =
      'Lead Time no informado.';
    reglas.push('LEADTIME_FALTANTE');

  } else if (leadTime >= 120) {
    porcentaje = 1;
    motivo =
      'Lead Time alto de ' +
      scFormatoNumero_(
        leadTime,
        0
      ) +
      ' días.';
    reglas.push('LEADTIME_ALTO');

  } else if (leadTime >= 90) {
    porcentaje = 0.75;
    motivo =
      'Lead Time de ' +
      scFormatoNumero_(
        leadTime,
        0
      ) +
      ' días.';
    reglas.push('LEADTIME_90');

  } else if (leadTime >= 60) {
    porcentaje = 0.40;
    motivo =
      'Lead Time medio.';
  } else {
    porcentaje = 0.10;
  }

  return scCrearComponente_(
    porcentaje,
    maximo,
    motivo,
    reglas
  );
}


function scComponenteDemanda_(
  modelo,
  maximo
) {
  const ventas =
    modelo.ventas || {};

  const clasificacion =
    String(
      ventas
        .clasificacionAceleracion ||
      ''
    ).toUpperCase();

  const tendencia =
    String(
      ventas.tendencia || ''
    ).toUpperCase();

  const variabilidad =
    String(
      ventas
        .nivelVariabilidad ||
      ''
    ).toUpperCase();

  let porcentaje = 0.20;
  let motivo =
    'Demanda estable.';
  const reglas = [];

  if (
    ventas.fuente === 'SIN DATOS'
  ) {
    porcentaje = 0;
    motivo =
      'No existe historial de demanda.';
    reglas.push(
      'DEMANDA_SIN_DATOS'
    );

  } else if (
    clasificacion ===
      'ACELERANDO'
  ) {
    porcentaje = 1;
    motivo =
      'La demanda reciente está acelerando.';
    reglas.push(
      'DEMANDA_ACELERANDO'
    );

  } else if (
    tendencia === 'CRECIENTE'
  ) {
    porcentaje = 0.80;
    motivo =
      'La demanda presenta tendencia creciente.';
    reglas.push(
      'DEMANDA_CRECIENTE'
    );

  } else if (
    variabilidad === 'ALTA'
  ) {
    porcentaje = 0.60;
    motivo =
      'La demanda presenta alta variabilidad.';
    reglas.push(
      'DEMANDA_VARIABLE'
    );

  } else if (
    clasificacion ===
      'DESACELERANDO' ||
    tendencia === 'DECRECIENTE'
  ) {
    porcentaje = 0.05;
    motivo =
      'La demanda se está desacelerando.';
    reglas.push(
      'DEMANDA_DECRECIENTE'
    );
  }

  return scCrearComponente_(
    porcentaje,
    maximo,
    motivo,
    reglas
  );
}


function scComponenteStock_(
  modelo,
  maximo
) {
  const stock =
    scNumero_(
      modelo.cobertura &&
      modelo.cobertura.stockTotal
    );

  const consumo =
    scNumero_(
      modelo.cobertura &&
      modelo.cobertura
        .promedioDemandaBase
    );

  let porcentaje = 0;
  let motivo =
    'Existe stock disponible.';
  const reglas = [];

  if (stock <= 0 && consumo > 0) {
    porcentaje = 1;
    motivo =
      'No existe stock disponible.';
    reglas.push('SIN_STOCK');

  } else if (
    consumo > 0 &&
    stock < consumo
  ) {
    porcentaje = 0.70;
    motivo =
      'El stock es inferior a un mes de demanda.';
    reglas.push(
      'STOCK_MENOR_1_MES'
    );

  } else if (stock <= 0) {
    porcentaje = 0.30;
    motivo =
      'No existe stock, pero tampoco hay demanda suficiente para evaluar.';
    reglas.push(
      'STOCK_CERO_SIN_DEMANDA'
    );
  }

  return scCrearComponente_(
    porcentaje,
    maximo,
    motivo,
    reglas
  );
}


function scComponenteOrdenes_(
  modelo,
  maximo
) {
  const ordenes =
    scNumero_(
      modelo.importaciones &&
      modelo.importaciones
        .ordenesConPendiente
    );

  const sugerida =
    scNumero_(
      modelo.compras &&
      modelo.compras
        .cantidadSugerida
    );

  let porcentaje = 0;
  let motivo =
    'Existen órdenes abiertas.';
  const reglas = [];

  if (
    ordenes <= 0 &&
    sugerida > 0
  ) {
    porcentaje = 1;
    motivo =
      'Existe compra sugerida sin órdenes abiertas.';
    reglas.push(
      'COMPRA_SIN_ORDEN'
    );

  } else if (ordenes <= 0) {
    porcentaje = 0.50;
    motivo =
      'No existen órdenes abiertas.';
    reglas.push(
      'SIN_ORDENES_ABIERTAS'
    );

  } else {
    porcentaje = 0.10;
    motivo =
      scFormatoNumero_(
        ordenes,
        0
      ) +
      ' orden(es) con pendiente.';
  }

  return scCrearComponente_(
    porcentaje,
    maximo,
    motivo,
    reglas
  );
}


/**************************************************************
 * CLASIFICACIÓN Y CONFIANZA
 **************************************************************/

function scClasificarPrioridad_(
  prioridad,
  umbrales
) {
  if (
    prioridad >=
    umbrales.comprar
  ) {
    return {
      nivel: 'ROJO',
      accion: 'COMPRAR'
    };
  }

  if (
    prioridad >=
    umbrales.planificar
  ) {
    return {
      nivel: 'NARANJA',
      accion: 'PLANIFICAR'
    };
  }

  if (
    prioridad >=
    umbrales.revisar
  ) {
    return {
      nivel: 'AMARILLO',
      accion: 'REVISAR'
    };
  }

  return {
    nivel: 'VERDE',
    accion: 'SIN ACCIÓN'
  };
}


function scCalcularConfianza_(
  modelo,
  calidad
) {
  let confianza =
    calidad;

  const ventas =
    modelo.ventas || {};

  if (
    ventas.cantidadMeses < 3
  ) {
    confianza -= 20;

  } else if (
    ventas.cantidadMeses < 6
  ) {
    confianza -= 10;
  }

  if (
    modelo.importaciones &&
    modelo.importaciones
      .sinFechaEstimada > 0
  ) {
    confianza -= 10;
  }

  if (
    modelo.compras &&
    modelo.compras
      .leadTimeDias === null
  ) {
    confianza -= 10;
  }

  return Math.round(
    scLimitar_(
      confianza,
      0,
      100
    )
  );
}


/**************************************************************
 * PARÁMETROS
 **************************************************************/

function scObtenerPesos_() {
  return {
    cobertura:
      scParametroNumeroDual_(
        'PESO_COBERTURA',
        SII_SCORE_SKU_V61002
          .PESOS_DEFAULT
          .cobertura
      ),

    quiebre:
      scParametroNumeroDual_(
        'PESO_QUIEBRE',
        SII_SCORE_SKU_V61002
          .PESOS_DEFAULT
          .quiebre
      ),

    importaciones:
      scParametroNumeroDual_(
        'PESO_IMPORTACIONES',
        SII_SCORE_SKU_V61002
          .PESOS_DEFAULT
          .importaciones
      ),

    leadTime:
      scParametroNumeroDual_(
        'PESO_LEADTIME',
        SII_SCORE_SKU_V61002
          .PESOS_DEFAULT
          .leadTime
      ),

    demanda:
      scParametroNumeroDual_(
        'PESO_CONSUMO',
        SII_SCORE_SKU_V61002
          .PESOS_DEFAULT
          .demanda
      ),

    stock:
      scParametroNumeroDual_(
        'PESO_STOCK',
        SII_SCORE_SKU_V61002
          .PESOS_DEFAULT
          .stock
      ),

    ordenes:
      scParametroNumeroDual_(
        'PESO_ORDENES',
        SII_SCORE_SKU_V61002
          .PESOS_DEFAULT
          .ordenes
      )
  };
}


function scObtenerUmbrales_() {
  return {
    comprar:
      scParametroNumeroDual_(
        'IPC_COMPRAR',
        SII_SCORE_SKU_V61002
          .UMBRALES_DEFAULT
          .comprar
      ),

    planificar:
      scParametroNumeroDual_(
        'IPC_PLANIFICAR',
        SII_SCORE_SKU_V61002
          .UMBRALES_DEFAULT
          .planificar
      ),

    revisar:
      scParametroNumeroDual_(
        'IPC_REVISAR',
        SII_SCORE_SKU_V61002
          .UMBRALES_DEFAULT
          .revisar
      ),

    ok:
      scParametroNumeroDual_(
        'IPC_OK',
        SII_SCORE_SKU_V61002
          .UMBRALES_DEFAULT
          .ok
      )
  };
}


/**
 * Busca primero en SCORE y luego en IPC.
 */
function scParametroNumeroDual_(
  clave,
  valorDefault
) {
  const score =
    scParametroNumero_(
      'SCORE',
      clave,
      null
    );

  if (score !== null) {
    return score;
  }

  return scParametroNumero_(
    'IPC',
    clave,
    valorDefault
  );
}


function scParametroNumero_(
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


/**************************************************************
 * UTILIDADES
 **************************************************************/

function scCrearComponente_(
  porcentaje,
  maximo,
  motivo,
  reglas
) {
  const porcentajeLimitado =
    scLimitar_(
      porcentaje,
      0,
      1
    );

  return {
    puntos:
      scRedondear_(
        porcentajeLimitado *
        maximo,
        2
      ),

    maximo:
      maximo,

    porcentaje:
      scRedondear_(
        porcentajeLimitado *
        100,
        1
      ),

    motivo:
      motivo,

    reglas:
      reglas || []
  };
}


function scNumeroNullable_(
  valor
) {
  if (
    valor === null ||
    valor === undefined ||
    String(valor).trim() === ''
  ) {
    return null;
  }

  const numero =
    scNumero_(valor);

  return Number.isFinite(numero)
    ? numero
    : null;
}


function scNumero_(valor) {
  if (typeof valor === 'number') {
    return Number.isFinite(valor)
      ? valor
      : 0;
  }

  if (
    typeof numero_ === 'function'
  ) {
    return numero_(valor);
  }

  const numero =
    Number(valor);

  return Number.isFinite(numero)
    ? numero
    : 0;
}


function scLimitar_(
  valor,
  minimo,
  maximo
) {
  return Math.max(
    minimo,
    Math.min(
      maximo,
      valor
    )
  );
}


function scRedondear_(
  valor,
  decimales
) {
  const factor =
    Math.pow(
      10,
      decimales
    );

  return Math.round(
    valor *
    factor
  ) / factor;
}


function scFormatoNumero_(
  valor,
  decimales
) {
  return Number(valor || 0)
    .toLocaleString(
      'es-AR',
      {
        minimumFractionDigits:
          decimales,
        maximumFractionDigits:
          decimales
      }
    );
}


/**
 * Prueba utilizando el primer SKU de PLAN_COMPRAS.
 */
function probarScoreSku() {
  if (
    typeof probarModeloSku !==
    'function'
  ) {
    throw new Error(
      'No está disponible probarModeloSku().'
    );
  }

  const modelo =
    probarModeloSku();

  const score =
    modelo.score ||
    calcularScoreSKU(
      modelo
    );

  Logger.log(
    JSON.stringify(
      score,
      null,
      2
    )
  );

  SpreadsheetApp
    .getActive()
    .toast(
      'Score calculado: ' +
      score.prioridad +
      '/100',
      'Score SKU',
      5
    );

  return score;
}
