/**************************************************************
 * SII V3.1 FINAL - MOTOR MRP
 *
 * Primera versión del motor de planificación temporal.
 *
 * Esta versión trabaja con:
 * - stock físico actual;
 * - consumo promedio diario;
 * - cantidades pendientes agrupadas por estado;
 * - días restantes estimados definidos en
 *   PARAMETROS_IMPORTACION.
 *
 * No modifica hojas. Solo calcula y devuelve resultados.
 **************************************************************/

function obtenerParametrosMarcaMRP_(
  marca,
  parametrosImportacion
) {
  const claveMarca = normalizarClaveMRP_(marca);

  const parametroMarca =
    parametrosImportacion[claveMarca];

  const parametroDefault =
    parametrosImportacion.DEFAULT;

  if (!parametroMarca && !parametroDefault) {
    throw new Error(
      'No existe la marca ' +
      claveMarca +
      ' ni la fila DEFAULT en PARAMETROS_IMPORTACION.'
    );
  }

  const base =
    parametroMarca ||
    parametroDefault;

  return {
    leadTime:
      numeroMRP_(
        primerValorMRP_(
          base.leadTime,
          base.LEAD_TIME_DIAS
        )
      ) || 120,

    cobertura:
      numeroMRP_(
        primerValorMRP_(
          base.cobertura,
          base.COBERTURA_OBJETIVO_MESES
        )
      ) || 4,

    diasEnFabrica:
      numeroMRP_(
        primerValorMRP_(
          base.diasEnFabrica,
          base.DIAS_RESTANTES_EN_FABRICA,
          base.leadTime
        )
      ) || 120,

    diasAEmbarcar:
      numeroMRP_(
        primerValorMRP_(
          base.diasAEmbarcar,
          base.DIAS_RESTANTES_A_EMBARCAR
        )
      ) || 75,

    diasEmbarcado:
      numeroMRP_(
        primerValorMRP_(
          base.diasEmbarcado,
          base.DIAS_RESTANTES_EMBARCADO
        )
      ) || 60,

    diasAIngresar:
      numeroMRP_(
        primerValorMRP_(
          base.diasAIngresar,
          base.DIAS_RESTANTES_A_INGRESAR
        )
      ) || 15
  };
}


function construirRecepcionesEstimadasMRP_(
  pendientes,
  parametrosMarca
) {
  const recepciones = [];

  agregarRecepcionMRP_(
    recepciones,
    'A INGRESAR',
    pendientes.aIngresar,
    parametrosMarca.diasAIngresar
  );

  agregarRecepcionMRP_(
    recepciones,
    'EMBARCADO',
    pendientes.embarcado,
    parametrosMarca.diasEmbarcado
  );

  agregarRecepcionMRP_(
    recepciones,
    'A EMBARCAR',
    pendientes.aEmbarcar,
    parametrosMarca.diasAEmbarcar
  );

  agregarRecepcionMRP_(
    recepciones,
    'EN FABRICA',
    pendientes.enFabrica,
    parametrosMarca.diasEnFabrica
  );

  return recepciones.sort(
    (a, b) => a.dias - b.dias
  );
}


function agregarRecepcionMRP_(
  recepciones,
  estado,
  cantidad,
  dias
) {
  const cantidadNumerica =
    Math.max(0, numeroMRP_(cantidad));

  if (cantidadNumerica <= 0) {
    return;
  }

  recepciones.push({
    estado: estado,
    cantidad: cantidadNumerica,
    dias: Math.max(
      0,
      Math.round(numeroMRP_(dias))
    )
  });
}


function simularLineaTiempoMRP_(datos) {
  const stockInicial =
    Math.max(0, numeroMRP_(datos.stockInicial));

  const consumoDiario =
    Math.max(0, numeroMRP_(datos.consumoDiario));

  const recepciones =
    Array.isArray(datos.recepciones)
      ? datos.recepciones
          .slice()
          .sort((a, b) => a.dias - b.dias)
      : [];

  if (consumoDiario <= 0) {
    return {
      diasQuiebreFisico: '',
      diasQuiebreProyectado: '',
      pendienteQueLlegaATiempo:
        recepciones.reduce(
          (suma, reg) =>
            suma + numeroMRP_(reg.cantidad),
          0
        ),
      pendienteQueLlegaTarde: 0,
      primeraLlegadaEstimadaDias:
        recepciones.length > 0
          ? recepciones[0].dias
          : '',
      riesgoRuptura: 'SIN CONSUMO',
      huboRupturaAntesDeRecepcion: false,
      stockFinalSimulado: stockInicial,
      detalleRecepciones: recepciones.map(
        reg => ({
          estado: reg.estado,
          cantidad: reg.cantidad,
          dias: reg.dias,
          llegaATiempo: true
        })
      )
    };
  }

  const diasQuiebreFisico =
    stockInicial / consumoDiario;

  let stock = stockInicial;
  let diaAnterior = 0;
  let primerQuiebre = null;
  let pendienteATiempo = 0;
  let pendienteTarde = 0;
  let huboRupturaAntesDeRecepcion = false;

  const detalleRecepciones = [];

  recepciones.forEach(reg => {
    const diasTranscurridos =
      Math.max(0, reg.dias - diaAnterior);

    const stockAntesDelConsumo = stock;

    stock -=
      consumoDiario *
      diasTranscurridos;

    if (
      stock < 0 &&
      primerQuiebre === null
    ) {
      primerQuiebre =
        diaAnterior +
        (
          stockAntesDelConsumo /
          consumoDiario
        );
    }

    const llegaATiempo =
      primerQuiebre === null ||
      primerQuiebre >= reg.dias;

    if (llegaATiempo) {
      pendienteATiempo += reg.cantidad;
    } else {
      pendienteTarde += reg.cantidad;
      huboRupturaAntesDeRecepcion = true;
    }

    stock += reg.cantidad;
    diaAnterior = reg.dias;

    detalleRecepciones.push({
      estado: reg.estado,
      cantidad: reg.cantidad,
      dias: reg.dias,
      llegaATiempo: llegaATiempo
    });
  });

  if (primerQuiebre === null) {
    primerQuiebre =
      diaAnterior +
      (
        Math.max(0, stock) /
        consumoDiario
      );
  }

  return {
    diasQuiebreFisico:
      redondearMRP_(diasQuiebreFisico, 2),

    diasQuiebreProyectado:
      redondearMRP_(primerQuiebre, 2),

    pendienteQueLlegaATiempo:
      pendienteATiempo,

    pendienteQueLlegaTarde:
      pendienteTarde,

    primeraLlegadaEstimadaDias:
      recepciones.length > 0
        ? recepciones[0].dias
        : '',

    riesgoRuptura:
      determinarRiesgoRupturaMRP_(
        primerQuiebre,
        huboRupturaAntesDeRecepcion
      ),

    huboRupturaAntesDeRecepcion:
      huboRupturaAntesDeRecepcion,

    stockFinalSimulado:
      redondearMRP_(stock, 2),

    detalleRecepciones:
      detalleRecepciones
  };
}


function calcularMRPPorSku_(
  datosSku,
  parametrosImportacion
) {
  const parametrosMarca =
    obtenerParametrosMarcaMRP_(
      datosSku.marca,
      parametrosImportacion
    );

  const promedioMensual =
    Math.max(
      0,
      numeroMRP_(
        datosSku.promedioMensual
      )
    );

  const consumoTotal =
    Math.max(
      0,
      numeroMRP_(datosSku.consumoTotal)
    );

  const mesesAnalisis =
    Math.max(
      0,
      numeroMRP_(datosSku.meses)
    );

  const estadoDemanda =
    promedioMensual > 0
      ? 'CON CONSUMO'
      : (
          consumoTotal <= 0 &&
          mesesAnalisis <= 0
            ? 'SIN HISTORIAL'
            : 'SIN CONSUMO'
        );

  const consumoDiario =
    promedioMensual / 30;

  const pendientes =
    datosSku.pendientes || {
      enFabrica: 0,
      aEmbarcar: 0,
      embarcado: 0,
      aIngresar: 0
    };

  const recepciones =
    construirRecepcionesEstimadasMRP_(
      pendientes,
      parametrosMarca
    );

  const simulacion =
    simularLineaTiempoMRP_({
      stockInicial:
        datosSku.stockTotal,
      consumoDiario:
        consumoDiario,
      recepciones:
        recepciones
    });

  if (estadoDemanda !== 'CON CONSUMO') {
    simulacion.riesgoRuptura = estadoDemanda;
  }

  const ventasLeadTime =
    consumoDiario *
    parametrosMarca.leadTime;

  const pendienteTotal =
    recepciones.reduce(
      (suma, reg) =>
        suma + numeroMRP_(reg.cantidad),
      0
    );

  const stockProyectadoLeadTime =
    numeroMRP_(datosSku.stockTotal) +
    pendienteTotal -
    ventasLeadTime;

  return {
    estadoDemanda:
      estadoDemanda,

    leadTimeDias:
      parametrosMarca.leadTime,

    consumoDiario:
      redondearMRP_(
        consumoDiario,
        4
      ),

    ventasLeadTime:
      redondearMRP_(
        ventasLeadTime,
        2
      ),

    stockProyectado:
      redondearMRP_(
        stockProyectadoLeadTime,
        2
      ),

    pendienteQueLlegaATiempo:
      simulacion.pendienteQueLlegaATiempo,

    pendienteQueLlegaTarde:
      simulacion.pendienteQueLlegaTarde,

    primeraLlegadaEstimadaDias:
      simulacion.primeraLlegadaEstimadaDias,

    diasQuiebreFisico:
      simulacion.diasQuiebreFisico,

    diasQuiebreProyectado:
      simulacion.diasQuiebreProyectado,

    riesgoRuptura:
      simulacion.riesgoRuptura,

    huboRupturaAntesDeRecepcion:
      simulacion.huboRupturaAntesDeRecepcion,

    detalleRecepciones:
      simulacion.detalleRecepciones,

    motivoMRP:
      explicarResultadoMRP_(
        simulacion,
        parametrosMarca,
        {
          estadoDemanda: estadoDemanda,
          stockTotal: numeroMRP_(datosSku.stockTotal),
          pendienteTotal: pendienteTotal
        }
      )
  };
}


function determinarRiesgoRupturaMRP_(
  diasQuiebre,
  huboRupturaAntesDeRecepcion
) {
  if (
    diasQuiebre === '' ||
    diasQuiebre === null ||
    diasQuiebre === undefined
  ) {
    return 'SIN CONSUMO';
  }

  if (huboRupturaAntesDeRecepcion) {
    return 'CRITICO';
  }

  if (diasQuiebre <= 15) {
    return 'CRITICO';
  }

  if (diasQuiebre <= 45) {
    return 'ALTO';
  }

  if (diasQuiebre <= 90) {
    return 'MEDIO';
  }

  return 'BAJO';
}


function explicarResultadoMRP_(
  simulacion,
  parametrosMarca,
  contexto
) {
  const estadoDemanda =
    contexto && contexto.estadoDemanda
      ? contexto.estadoDemanda
      : simulacion.riesgoRuptura;

  if (estadoDemanda === 'SIN HISTORIAL') {
    return (
      'Producto sin historial de consumo. ' +
      'Verificar si es un SKU nuevo o si falta una equivalencia ' +
      'entre el código comercial y el SKU BAM.'
    );
  }

  if (estadoDemanda === 'SIN CONSUMO') {
    return (
      'Producto con historial, pero sin consumo en el período analizado. ' +
      'Revisar si continúa activo, si cambió de código o si fue discontinuado.'
    );
  }

  const diasQuiebre =
    formatearNumeroMRP_(
      simulacion.diasQuiebreProyectado
    );

  if (simulacion.huboRupturaAntesDeRecepcion) {
    return (
      'El stock se agotará en aproximadamente ' +
      diasQuiebre +
      ' días, antes de una o más recepciones previstas. ' +
      simulacion.pendienteQueLlegaTarde +
      ' unidades llegarían después del quiebre. ' +
      'Emitir la PI inmediatamente o revisar abastecimiento local.'
    );
  }

  if (
    simulacion.riesgoRuptura === 'CRITICO'
  ) {
    if (
      simulacion.pendienteQueLlegaATiempo > 0
    ) {
      return (
        'Riesgo crítico: el quiebre se proyecta en ' +
        diasQuiebre +
        ' días. Hay mercadería que llegaría a tiempo, ' +
        'pero el margen es inferior a 15 días. Revisar la fecha real de llegada.'
      );
    }

    return (
      'El stock se agotará en aproximadamente ' +
      diasQuiebre +
      ' días. No existen recepciones útiles antes del quiebre. ' +
      'Emitir la PI inmediatamente.'
    );
  }

  if (
    simulacion.riesgoRuptura === 'ALTO'
  ) {
    return (
      'La cobertura proyectada es de aproximadamente ' +
      diasQuiebre +
      ' días. Revisar la compra durante esta semana y confirmar ' +
      'las fechas de las recepciones en curso.'
    );
  }

  if (
    simulacion.riesgoRuptura === 'MEDIO'
  ) {
    return (
      'La cobertura proyectada es de aproximadamente ' +
      diasQuiebre +
      ' días. No requiere una PI inmediata, pero debe revisarse ' +
      'en la próxima planificación.'
    );
  }

  if (
    simulacion.pendienteQueLlegaATiempo > 0
  ) {
    return (
      'Las recepciones estimadas llegan antes del quiebre. ' +
      'La cobertura proyectada alcanza aproximadamente ' +
      diasQuiebre +
      ' días. No se requiere acción inmediata.'
    );
  }

  return (
    'La cobertura proyectada alcanza aproximadamente ' +
    diasQuiebre +
    ' días. No hay recepciones pendientes y no se requiere ' +
    'acción inmediata. Lead time considerado: ' +
    parametrosMarca.leadTime +
    ' días.'
  );
}

function probarMotorMRPV3() {
  const parametros =
    leerParametrosImportacion_();

  const resultado =
    calcularMRPPorSku_(
      {
        marca: 'DEFAULT',
        stockTotal: 300,
        promedioMensual: 300,
        pendientes: {
          enFabrica: 800,
          aEmbarcar: 0,
          embarcado: 500,
          aIngresar: 100
        }
      },
      parametros
    );

  Logger.log(
    JSON.stringify(
      resultado,
      null,
      2
    )
  );

  SpreadsheetApp
    .getActive()
    .toast(
      'Prueba MRP V3 finalizada. Revisá los registros.',
      'SII V3',
      5
    );
}


function normalizarClaveMRP_(valor) {
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


function numeroMRP_(valor) {
  if (typeof valor === 'number') {
    return Number.isFinite(valor)
      ? valor
      : 0;
  }

  let texto = String(
    valor === null ||
    valor === undefined
      ? ''
      : valor
  )
    .trim()
    .replace(/\s/g, '');

  if (!texto) {
    return 0;
  }

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
  } else if (texto.includes(',')) {
    texto = texto.replace(',', '.');
  }

  const numero = Number(texto);

  return Number.isFinite(numero)
    ? numero
    : 0;
}


function primerValorMRP_() {
  for (
    let i = 0;
    i < arguments.length;
    i++
  ) {
    const valor = arguments[i];

    if (
      valor !== null &&
      valor !== undefined &&
      String(valor).trim() !== ''
    ) {
      return valor;
    }
  }

  return '';
}


function redondearMRP_(
  valor,
  decimales
) {
  const factor =
    Math.pow(10, decimales);

  return Math.round(
    numeroMRP_(valor) * factor
  ) / factor;
}


function formatearNumeroMRP_(valor) {
  const numero =
    numeroMRP_(valor);

  return numero.toLocaleString(
    'es-AR',
    {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    }
  );
}
