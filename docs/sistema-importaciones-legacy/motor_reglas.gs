/**************************************************************
 * SII V6.1.003
 * MÓDULO: MOTOR DE REGLAS DEL SKU
 *
 * Funciones públicas:
 * - evaluarReglasSku(modelo)
 * - probarMotorReglasSku()
 *
 * El módulo no calcula el score.
 * Evalúa y explica la situación del SKU.
 **************************************************************/

const SII_REGLAS_SKU_V61003 = {
  VERSION: '6.1.003',

  SEVERIDAD_ORDEN: {
    CRITICA: 1,
    ALTA: 2,
    MEDIA: 3,
    BAJA: 4,
    INFORMATIVA: 5
  }
};


/**
 * Evalúa todas las reglas del SKU.
 */
function evaluarReglasSku(modelo) {
  const inicio = Date.now();

  if (!modelo) {
    throw new Error(
      'No se recibió el modelo del SKU.'
    );
  }

  const reglas = [];

  rgEvaluarCalidadDatos_(
    modelo,
    reglas
  );

  rgEvaluarCobertura_(
    modelo,
    reglas
  );

  rgEvaluarStock_(
    modelo,
    reglas
  );

  rgEvaluarDemanda_(
    modelo,
    reglas
  );

  rgEvaluarImportaciones_(
    modelo,
    reglas
  );

  rgEvaluarQuiebre_(
    modelo,
    reglas
  );

  rgEvaluarLeadTime_(
    modelo,
    reglas
  );

  rgEvaluarCompras_(
    modelo,
    reglas
  );

  rgEvaluarOrdenes_(
    modelo,
    reglas
  );

  reglas.sort(
    (a, b) => {
      const ordenA =
        SII_REGLAS_SKU_V61003
          .SEVERIDAD_ORDEN[
            a.severidad
          ] || 99;

      const ordenB =
        SII_REGLAS_SKU_V61003
          .SEVERIDAD_ORDEN[
            b.severidad
          ] || 99;

      if (ordenA !== ordenB) {
        return ordenA - ordenB;
      }

      return a.codigo.localeCompare(
        b.codigo
      );
    }
  );

  const activas =
    reglas.filter(
      regla =>
        regla.activa === true
    );

  const bloqueantes =
    activas.filter(
      regla =>
        regla.bloqueante === true
    );

  const criticas =
    activas.filter(
      regla =>
        regla.severidad ===
          'CRITICA'
    );

  const altas =
    activas.filter(
      regla =>
        regla.severidad ===
          'ALTA'
    );

  const nivel =
    bloqueantes.length > 0
      ? 'GRIS'
      : (
          criticas.length > 0
            ? 'ROJO'
            : (
                altas.length > 0
                  ? 'NARANJA'
                  : (
                      activas.length > 0
                        ? 'AMARILLO'
                        : 'VERDE'
                    )
              )
        );

  const accion =
    rgDeterminarAccion_(
      modelo,
      activas,
      bloqueantes
    );

  const explicacion =
    activas.map(
      regla =>
        regla.mensaje
    );

  const recomendaciones =
    rgConstruirRecomendaciones_(
      modelo,
      activas,
      bloqueantes
    );

  return {
    version:
      SII_REGLAS_SKU_V61003.VERSION,

    nivel:
      nivel,

    accion:
      accion,

    cantidadReglas:
      reglas.length,

    cantidadActivas:
      activas.length,

    cantidadBloqueantes:
      bloqueantes.length,

    reglas:
      reglas,

    reglasActivas:
      activas,

    codigosActivos:
      activas.map(
        regla =>
          regla.codigo
      ),

    explicacion:
      explicacion,

    recomendaciones:
      recomendaciones,

    auditoria: {
      evaluadoEn:
        new Date(),

      duracionMs:
        Date.now() - inicio,

      motor:
        'REGLAS_SKU',

      versionMotor:
        SII_REGLAS_SKU_V61003
          .VERSION
    }
  };
}


/**************************************************************
 * CALIDAD DE DATOS
 **************************************************************/

function rgEvaluarCalidadDatos_(
  modelo,
  reglas
) {
  const id =
    modelo.identificacion || {};

  const ventas =
    modelo.ventas || {};

  const compras =
    modelo.compras || {};

  rgAgregarRegla_(
    reglas,
    {
      codigo:
        'DESCRIPCION_FALTANTE',
      activa:
        !id.descripcion,
      severidad:
        'ALTA',
      categoria:
        'CALIDAD',
      mensaje:
        'Falta la descripción del SKU.',
      recomendacion:
        'Completar la descripción en PRODUCTOS.',
      bloqueante:
        true
    }
  );

  rgAgregarRegla_(
    reglas,
    {
      codigo:
        'MARCA_FALTANTE',
      activa:
        !id.marca,
      severidad:
        'ALTA',
      categoria:
        'CALIDAD',
      mensaje:
        'Falta la marca del SKU.',
      recomendacion:
        'Completar la marca en PRODUCTOS o PLAN_COMPRAS.',
      bloqueante:
        true
    }
  );

  rgAgregarRegla_(
    reglas,
    {
      codigo:
        'PROVEEDOR_FALTANTE',
      activa:
        !id.proveedor,
      severidad:
        'ALTA',
      categoria:
        'CALIDAD',
      mensaje:
        'Falta el proveedor del SKU.',
      recomendacion:
        'Completar el proveedor en el maestro correspondiente.',
      bloqueante:
        true
    }
  );

  const sinVentas =
    !ventas ||
    ventas.fuente ===
      'SIN DATOS';

  rgAgregarRegla_(
    reglas,
    {
      codigo:
        'VENTAS_FALTANTES',
      activa:
        sinVentas,
      severidad:
        'ALTA',
      categoria:
        'CALIDAD',
      mensaje:
        'No existe historial de ventas para el SKU.',
      recomendacion:
        'Verificar Cod_BAM, VENTAS y EQUIVALENCIAS_SKU.',
      bloqueante:
        true
    }
  );

  rgAgregarRegla_(
    reglas,
    {
      codigo:
        'COSTO_USD_FALTANTE',
      activa:
        compras.cantidadSugerida > 0 &&
        compras.costoUnitarioUsd ===
          null,
      severidad:
        'MEDIA',
      categoria:
        'CALIDAD',
      mensaje:
        'La compra sugerida no puede valorizarse porque falta el costo USD.',
      recomendacion:
        'Completar el costo unitario USD.',
      bloqueante:
        false
    }
  );
}


/**************************************************************
 * COBERTURA Y STOCK
 **************************************************************/

function rgEvaluarCobertura_(
  modelo,
  reglas
) {
  const cobertura =
    modelo.cobertura || {};

  const actual =
    rgNumeroNullable_(
      cobertura.actualMeses
    );

  const objetivo =
    rgNumeroNullable_(
      cobertura.objetivoMeses
    ) ||
    rgNumeroNullable_(
      modelo.parametros &&
      modelo.parametros
        .coberturaObjetivo
    ) ||
    4;

  const urgente =
    rgParametroNumero_(
      'COBERTURA',
      'URGENTE_MESES',
      1
    );

  const comprar =
    rgParametroNumero_(
      'COBERTURA',
      'COMPRAR_MESES',
      2
    );

  rgAgregarRegla_(
    reglas,
    {
      codigo:
        'COBERTURA_NO_CALCULABLE',
      activa:
        actual === null,
      severidad:
        'MEDIA',
      categoria:
        'COBERTURA',
      mensaje:
        'No se puede calcular la cobertura.',
      recomendacion:
        'Revisar stock y demanda.',
      bloqueante:
        false
    }
  );

  rgAgregarRegla_(
    reglas,
    {
      codigo:
        'COBERTURA_CERO',
      activa:
        actual !== null &&
        actual <= 0,
      severidad:
        'CRITICA',
      categoria:
        'COBERTURA',
      mensaje:
        'La cobertura es igual a cero.',
      recomendacion:
        'Analizar compra inmediata.',
      bloqueante:
        false
    }
  );

  rgAgregarRegla_(
    reglas,
    {
      codigo:
        'COBERTURA_URGENTE',
      activa:
        actual !== null &&
        actual > 0 &&
        actual <= urgente,
      severidad:
        'CRITICA',
      categoria:
        'COBERTURA',
      mensaje:
        'La cobertura es crítica: ' +
        rgFormatoNumero_(
          actual,
          2
        ) +
        ' meses.',
      recomendacion:
        'Priorizar la compra del SKU.',
      bloqueante:
        false
    }
  );

  rgAgregarRegla_(
    reglas,
    {
      codigo:
        'COBERTURA_BAJA',
      activa:
        actual !== null &&
        actual > urgente &&
        actual <= comprar,
      severidad:
        'ALTA',
      categoria:
        'COBERTURA',
      mensaje:
        'La cobertura es baja: ' +
        rgFormatoNumero_(
          actual,
          2
        ) +
        ' meses.',
      recomendacion:
        'Planificar la compra.',
      bloqueante:
        false
    }
  );

  rgAgregarRegla_(
    reglas,
    {
      codigo:
        'COBERTURA_BAJO_OBJETIVO',
      activa:
        actual !== null &&
        actual > comprar &&
        actual < objetivo,
      severidad:
        'MEDIA',
      categoria:
        'COBERTURA',
      mensaje:
        'La cobertura está por debajo del objetivo (' +
        rgFormatoNumero_(
          actual,
          2
        ) +
        ' vs ' +
        rgFormatoNumero_(
          objetivo,
          2
        ) +
        ' meses).',
      recomendacion:
        'Revisar la próxima compra.',
      bloqueante:
        false
    }
  );
}


function rgEvaluarStock_(
  modelo,
  reglas
) {
  const cobertura =
    modelo.cobertura || {};

  const stock =
    rgNumero_(
      cobertura.stockTotal
    );

  const demanda =
    rgNumero_(
      cobertura.promedioDemandaBase
    );

  rgAgregarRegla_(
    reglas,
    {
      codigo:
        'SIN_STOCK',
      activa:
        stock <= 0 &&
        demanda > 0,
      severidad:
        'CRITICA',
      categoria:
        'STOCK',
      mensaje:
        'No existe stock disponible.',
      recomendacion:
        'Priorizar abastecimiento inmediato.',
      bloqueante:
        false
    }
  );

  rgAgregarRegla_(
    reglas,
    {
      codigo:
        'STOCK_MENOR_UN_MES',
      activa:
        stock > 0 &&
        demanda > 0 &&
        stock < demanda,
      severidad:
        'ALTA',
      categoria:
        'STOCK',
      mensaje:
        'El stock disponible cubre menos de un mes de demanda.',
      recomendacion:
        'Revisar compra y fechas de ingreso.',
      bloqueante:
        false
    }
  );

  rgAgregarRegla_(
    reglas,
    {
      codigo:
        'STOCK_CERO_SIN_DEMANDA',
      activa:
        stock <= 0 &&
        demanda <= 0,
      severidad:
        'INFORMATIVA',
      categoria:
        'STOCK',
      mensaje:
        'No hay stock registrado y tampoco existe demanda suficiente para evaluarlo.',
      recomendacion:
        'Revisar si se trata de un producto nuevo.',
      bloqueante:
        false
    }
  );
}


/**************************************************************
 * DEMANDA
 **************************************************************/

function rgEvaluarDemanda_(
  modelo,
  reglas
) {
  const ventas =
    modelo.ventas || {};

  const mesesConVenta =
    rgNumero_(
      ventas.mesesConVenta
    );

  const tendencia =
    String(
      ventas.tendencia || ''
    ).toUpperCase();

  const aceleracion =
    String(
      ventas
        .clasificacionAceleracion ||
      ''
    ).toUpperCase();

  const variabilidad =
    String(
      ventas
        .nivelVariabilidad ||
      ''
    ).toUpperCase();

  rgAgregarRegla_(
    reglas,
    {
      codigo:
        'SKU_NUEVO',
      activa:
        ventas.fuente !==
          'SIN DATOS' &&
        mesesConVenta > 0 &&
        mesesConVenta < 3,
      severidad:
        'MEDIA',
      categoria:
        'DEMANDA',
      mensaje:
        'El SKU tiene historial insuficiente para evaluar una tendencia confiable.',
      recomendacion:
        'Revisar manualmente el comportamiento inicial.',
      bloqueante:
        false
    }
  );

  rgAgregarRegla_(
    reglas,
    {
      codigo:
        'DEMANDA_ACELERANDO',
      activa:
        mesesConVenta >= 3 &&
        aceleracion ===
          'ACELERANDO',
      severidad:
        'ALTA',
      categoria:
        'DEMANDA',
      mensaje:
        'La demanda reciente está acelerando.',
      recomendacion:
        'Considerar el promedio reciente para la compra.',
      bloqueante:
        false
    }
  );

  rgAgregarRegla_(
    reglas,
    {
      codigo:
        'DEMANDA_CRECIENTE',
      activa:
        mesesConVenta >= 3 &&
        tendencia ===
          'CRECIENTE',
      severidad:
        'ALTA',
      categoria:
        'DEMANDA',
      mensaje:
        'La demanda presenta una tendencia creciente.',
      recomendacion:
        'Revisar si la cobertura objetivo sigue siendo suficiente.',
      bloqueante:
        false
    }
  );

  rgAgregarRegla_(
    reglas,
    {
      codigo:
        'DEMANDA_DECRECIENTE',
      activa:
        mesesConVenta >= 3 &&
        (
          tendencia ===
            'DECRECIENTE' ||
          aceleracion ===
            'DESACELERANDO'
        ),
      severidad:
        'BAJA',
      categoria:
        'DEMANDA',
      mensaje:
        'La demanda se está desacelerando.',
      recomendacion:
        'Evitar sobrestock y revisar la cantidad sugerida.',
      bloqueante:
        false
    }
  );

  rgAgregarRegla_(
    reglas,
    {
      codigo:
        'DEMANDA_VARIABLE',
      activa:
        mesesConVenta >= 3 &&
        variabilidad === 'ALTA',
      severidad:
        'MEDIA',
      categoria:
        'DEMANDA',
      mensaje:
        'La demanda presenta alta variabilidad.',
      recomendacion:
        'Considerar stock de seguridad y revisar picos mensuales.',
      bloqueante:
        false
    }
  );
}


/**************************************************************
 * IMPORTACIONES
 **************************************************************/

function rgEvaluarImportaciones_(
  modelo,
  reglas
) {
  const imp =
    modelo.importaciones || {};

  const pendiente =
    rgNumero_(
      imp.cantidadPendiente
    );

  const antes =
    rgNumero_(
      imp.llegaAntesQuiebre
    );

  const despues =
    rgNumero_(
      imp.llegaDespuesQuiebre
    );

  const sinFecha =
    rgNumero_(
      imp.sinFechaEstimada
    );

  rgAgregarRegla_(
    reglas,
    {
      codigo:
        'SIN_TRANSITO',
      activa:
        pendiente <= 0,
      severidad:
        'ALTA',
      categoria:
        'IMPORTACIONES',
      mensaje:
        'No existen importaciones pendientes.',
      recomendacion:
        'Verificar si corresponde emitir una nueva orden.',
      bloqueante:
        false
    }
  );

  rgAgregarRegla_(
    reglas,
    {
      codigo:
        'TRANSITO_SIN_FECHA',
      activa:
        sinFecha > 0,
      severidad:
        'ALTA',
      categoria:
        'IMPORTACIONES',
      mensaje:
        rgFormatoNumero_(
          sinFecha,
          0
        ) +
        ' unidades pendientes no tienen fecha estimada.',
      recomendacion:
        'Completar las fechas logísticas.',
      bloqueante:
        false
    }
  );

  rgAgregarRegla_(
    reglas,
    {
      codigo:
        'IMPORTACION_LLEGA_TARDE',
      activa:
        despues > 0,
      severidad:
        'CRITICA',
      categoria:
        'IMPORTACIONES',
      mensaje:
        rgFormatoNumero_(
          despues,
          0
        ) +
        ' unidades llegarían después del quiebre.',
      recomendacion:
        'Evaluar compra adicional o alternativa de abastecimiento.',
      bloqueante:
        false
    }
  );

  rgAgregarRegla_(
    reglas,
    {
      codigo:
        'IMPORTACION_LLEGA_A_TIEMPO',
      activa:
        antes > 0 &&
        despues <= 0,
      severidad:
        'INFORMATIVA',
      categoria:
        'IMPORTACIONES',
      mensaje:
        rgFormatoNumero_(
          antes,
          0
        ) +
        ' unidades llegarían antes del quiebre.',
      recomendacion:
        'Mantener seguimiento del embarque.',
      bloqueante:
        false
    }
  );

  rgAgregarRegla_(
    reglas,
    {
      codigo:
        'TRANSITO_SIN_COMPARACION',
      activa:
        pendiente > 0 &&
        antes <= 0 &&
        despues <= 0 &&
        sinFecha <= 0,
      severidad:
        'MEDIA',
      categoria:
        'IMPORTACIONES',
      mensaje:
        'Existe mercadería pendiente, pero no puede compararse con una fecha de quiebre.',
      recomendacion:
        'Completar o validar el cálculo de quiebre.',
      bloqueante:
        false
    }
  );
}


/**************************************************************
 * QUIEBRE, LEAD TIME Y COMPRAS
 **************************************************************/

function rgEvaluarQuiebre_(
  modelo,
  reglas
) {
  const timeline =
    modelo.timeline || {};

  const dias =
    rgNumeroNullable_(
      timeline.diasHastaQuiebre
    );

  rgAgregarRegla_(
    reglas,
    {
      codigo:
        'QUIEBRE_NO_CALCULABLE',
      activa:
        dias === null,
      severidad:
        'MEDIA',
      categoria:
        'QUIEBRE',
      mensaje:
        'No se puede calcular la fecha de quiebre.',
      recomendacion:
        'Revisar demanda y cobertura.',
      bloqueante:
        false
    }
  );

  rgAgregarRegla_(
    reglas,
    {
      codigo:
        'QUIEBRE_INMEDIATO',
      activa:
        dias !== null &&
        dias <= 0,
      severidad:
        'CRITICA',
      categoria:
        'QUIEBRE',
      mensaje:
        'El SKU se encuentra en quiebre o con quiebre inmediato.',
      recomendacion:
        'Tomar una acción urgente.',
      bloqueante:
        false
    }
  );

  rgAgregarRegla_(
    reglas,
    {
      codigo:
        'QUIEBRE_30_DIAS',
      activa:
        dias !== null &&
        dias > 0 &&
        dias <= 30,
      severidad:
        'CRITICA',
      categoria:
        'QUIEBRE',
      mensaje:
        'El quiebre se proyecta dentro de 30 días.',
      recomendacion:
        'Priorizar una solución inmediata.',
      bloqueante:
        false
    }
  );

  rgAgregarRegla_(
    reglas,
    {
      codigo:
        'QUIEBRE_60_DIAS',
      activa:
        dias !== null &&
        dias > 30 &&
        dias <= 60,
      severidad:
        'ALTA',
      categoria:
        'QUIEBRE',
      mensaje:
        'El quiebre se proyecta dentro de 60 días.',
      recomendacion:
        'Planificar la compra con prioridad alta.',
      bloqueante:
        false
    }
  );
}


function rgEvaluarLeadTime_(
  modelo,
  reglas
) {
  const leadTime =
    rgNumeroNullable_(
      modelo.compras &&
      modelo.compras.leadTimeDias
    );

  rgAgregarRegla_(
    reglas,
    {
      codigo:
        'LEADTIME_FALTANTE',
      activa:
        leadTime === null,
      severidad:
        'MEDIA',
      categoria:
        'LOGISTICA',
      mensaje:
        'El Lead Time no está informado.',
      recomendacion:
        'Completar el Lead Time del proveedor.',
      bloqueante:
        false
    }
  );

  rgAgregarRegla_(
    reglas,
    {
      codigo:
        'LEADTIME_ALTO',
      activa:
        leadTime !== null &&
        leadTime >= 120,
      severidad:
        'ALTA',
      categoria:
        'LOGISTICA',
      mensaje:
        'El Lead Time es alto: ' +
        rgFormatoNumero_(
          leadTime,
          0
        ) +
        ' días.',
      recomendacion:
        'Anticipar la planificación de compra.',
      bloqueante:
        false
    }
  );

  rgAgregarRegla_(
    reglas,
    {
      codigo:
        'LEADTIME_MEDIO',
      activa:
        leadTime !== null &&
        leadTime >= 90 &&
        leadTime < 120,
      severidad:
        'MEDIA',
      categoria:
        'LOGISTICA',
      mensaje:
        'El Lead Time es de ' +
        rgFormatoNumero_(
          leadTime,
          0
        ) +
        ' días.',
      recomendacion:
        'Mantener planificación anticipada.',
      bloqueante:
        false
    }
  );
}


function rgEvaluarCompras_(
  modelo,
  reglas
) {
  const compras =
    modelo.compras || {};

  const sugerida =
    rgNumero_(
      compras.cantidadSugerida
    );

  rgAgregarRegla_(
    reglas,
    {
      codigo:
        'COMPRA_SUGERIDA',
      activa:
        sugerida > 0,
      severidad:
        'ALTA',
      categoria:
        'COMPRAS',
      mensaje:
        'El sistema sugiere comprar ' +
        rgFormatoNumero_(
          sugerida,
          0
        ) +
        ' unidades.',
      recomendacion:
        'Revisar y validar la propuesta de compra.',
      bloqueante:
        false
    }
  );

  rgAgregarRegla_(
    reglas,
    {
      codigo:
        'PENDIENTE_LLEGA_TARDE',
      activa:
        rgNumero_(
          compras.pendienteLlegaTarde
        ) > 0,
      severidad:
        'CRITICA',
      categoria:
        'COMPRAS',
      mensaje:
        rgFormatoNumero_(
          compras.pendienteLlegaTarde,
          0
        ) +
        ' unidades pendientes llegarían tarde.',
      recomendacion:
        'Recalcular la compra real necesaria.',
      bloqueante:
        false
    }
  );
}


function rgEvaluarOrdenes_(
  modelo,
  reglas
) {
  const imp =
    modelo.importaciones || {};

  const compras =
    modelo.compras || {};

  const ordenes =
    rgNumero_(
      imp.ordenesConPendiente
    );

  const sugerida =
    rgNumero_(
      compras.cantidadSugerida
    );

  rgAgregarRegla_(
    reglas,
    {
      codigo:
        'COMPRA_SIN_ORDEN',
      activa:
        sugerida > 0 &&
        ordenes <= 0,
      severidad:
        'ALTA',
      categoria:
        'ORDENES',
      mensaje:
        'Existe compra sugerida, pero no hay órdenes abiertas.',
      recomendacion:
        'Evaluar la emisión de una nueva PI.',
      bloqueante:
        false
    }
  );
}


/**************************************************************
 * RESULTADO
 **************************************************************/

function rgDeterminarAccion_(
  modelo,
  activas,
  bloqueantes
) {
  if (bloqueantes.length > 0) {
    return 'REVISAR DATOS';
  }

  if (
    activas.some(
      regla =>
        regla.codigo ===
          'QUIEBRE_INMEDIATO' ||
        regla.codigo ===
          'QUIEBRE_30_DIAS' ||
        regla.codigo ===
          'COBERTURA_CERO' ||
        regla.codigo ===
          'COBERTURA_URGENTE' ||
        regla.codigo ===
          'IMPORTACION_LLEGA_TARDE'
    )
  ) {
    return 'COMPRAR';
  }

  if (
    activas.some(
      regla =>
        regla.severidad === 'ALTA'
    )
  ) {
    return 'PLANIFICAR';
  }

  if (activas.length > 0) {
    return 'REVISAR';
  }

  return 'SIN ACCIÓN';
}


function rgConstruirRecomendaciones_(
  modelo,
  activas,
  bloqueantes
) {
  const salida = [];

  const fuente =
    bloqueantes.length > 0
      ? bloqueantes
      : activas;

  fuente.forEach(regla => {
    if (
      regla.recomendacion &&
      !salida.includes(
        regla.recomendacion
      )
    ) {
      salida.push(
        regla.recomendacion
      );
    }
  });

  if (salida.length === 0) {
    salida.push(
      'Mantener seguimiento periódico.'
    );
  }

  return salida;
}


function rgAgregarRegla_(
  reglas,
  regla
) {
  reglas.push({
    codigo:
      regla.codigo,

    activa:
      Boolean(regla.activa),

    severidad:
      regla.severidad ||
      'INFORMATIVA',

    categoria:
      regla.categoria ||
      'GENERAL',

    mensaje:
      regla.mensaje || '',

    recomendacion:
      regla.recomendacion || '',

    bloqueante:
      Boolean(
        regla.bloqueante
      )
  });
}


/**************************************************************
 * UTILIDADES
 **************************************************************/

function rgParametroNumero_(
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


function rgNumeroNullable_(
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
    rgNumero_(valor);

  return Number.isFinite(numero)
    ? numero
    : null;
}


function rgNumero_(valor) {
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


function rgFormatoNumero_(
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
function probarMotorReglasSku() {
  const ss =
    SpreadsheetApp.getActive();

  const sh =
    ss.getSheetByName(
      SII_CFG.SHEETS.PLAN_COMPRAS
    );

  if (!sh) {
    throw new Error(
      'No existe PLAN_COMPRAS.'
    );
  }

  const datos =
    sh.getDataRange()
      .getDisplayValues();

  const encabezados =
    datos[0].map(
      valor =>
        String(valor || '')
          .trim()
          .toUpperCase()
    );

  const colSku =
    encabezados.indexOf('SKU');

  if (colSku === -1) {
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
      String(
        datos[i][colSku] || ''
      ).trim();

    if (sku) {
      break;
    }
  }

  if (!sku) {
    throw new Error(
      'No se encontró ningún SKU para probar.'
    );
  }

  const modelo =
    cargarSKU(sku);

  const resultado =
    modelo.reglas;

  Logger.log(
    JSON.stringify(
      {
        sku:
          modelo.identificacion.sku,

        nivel:
          resultado.nivel,

        accion:
          resultado.accion,

        cantidadActivas:
          resultado.cantidadActivas,

        cantidadBloqueantes:
          resultado.cantidadBloqueantes,

        codigosActivos:
          resultado.codigosActivos,

        recomendaciones:
          resultado.recomendaciones
      },
      null,
      2
    )
  );

  SpreadsheetApp
    .getActive()
    .toast(
      'Reglas activas: ' +
      resultado.cantidadActivas,
      'Motor de Reglas',
      5
    );

  return resultado;
}