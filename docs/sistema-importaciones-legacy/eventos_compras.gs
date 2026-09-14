/**************************************************************
 * SII V7.0.003 - EVENTOS DE COMPRAS
 *
 * Fuente: MODELO_MARCAS
 * Destino: EVENTOS_COMPRAS
 *
 * Mejora principal:
 * - Evalúa impacto relativo dentro de cada marca.
 * - Usa cantidad y porcentaje de SKU urgentes/críticos.
 * - Excluye marcas sin ventas del evento de compra.
 * - Reserva P1 para casos con impacto operativo real.
 * - Conserva estado, responsable, fecha límite y observaciones.
 *
 * Funciones públicas:
 * - actualizarEventosCompras()
 * - abrirEventosCompras()
 * - cerrarEventoSeleccionado()
 * - reabrirEventoSeleccionado()
 * - cambiarEstadoEventoSeleccionado()
 * - probarEventosComprasV70003()
 **************************************************************/

const SII_EVENTOS_COMPRAS_V70003 = {
  VERSION: '7.0.003',
  ORIGEN: 'MODELO_MARCAS',
  DESTINO: 'EVENTOS_COMPRAS',

  ESTADOS_ABIERTOS: [
    'NUEVO',
    'ASIGNADO',
    'EN_PROCESO'
  ],

  ESTADOS_VALIDOS: [
    'NUEVO',
    'ASIGNADO',
    'EN_PROCESO',
    'RESUELTO',
    'CERRADO',
    'IGNORADO'
  ],

  REGLAS: {
    P1_MIN_SKU_URGENTES: 5,
    P1_PORC_SKU_URGENTES: 0.10,
    P1_QUIEBRE_DIAS: 15,
    P1_MIN_URGENTES_CON_QUIEBRE: 3,

    P2_MIN_SKU_URGENTES: 1,
    P2_MAX_SKU_URGENTES: 4,
    P2_PORC_SKU_CRITICOS: 0.05,

    P3_CANTIDAD_SUGERIDA_MIN: 1
  },

  ENCABEZADOS: [
    'ID_EVENTO',
    'CODIGO_EVENTO',
    'FECHA_CREACION',
    'FECHA_ULTIMA_DETECCION',
    'FECHA_RESOLUCION',
    'TIPO',
    'SEVERIDAD',
    'PRIORIDAD',
    'MARCA',
    'DESCRIPCION',
    'MOTIVO',
    'ACCION_RECOMENDADA',
    'PUNTAJE_CRITICIDAD',
    'CRITERIOS_PUNTAJE',
    'PORC_SKU_URGENTES',
    'PORC_SKU_CRITICOS',
    'ESTADO',
    'RESPONSABLE',
    'FECHA_LIMITE',
    'RECURRENCIAS',
    'ORIGEN',
    'VALOR_REFERENCIA',
    'UNIDAD_REFERENCIA',
    'OBSERVACIONES',
    'ULTIMA_ACTUALIZACION'
  ]
};


function actualizarEventosCompras() {
  const inicio = Date.now();
  const ss = SpreadsheetApp.getActive();

  const shModelo = ss.getSheetByName(
    SII_EVENTOS_COMPRAS_V70003.ORIGEN
  );

  if (!shModelo) {
    throw new Error(
      'No existe MODELO_MARCAS.'
    );
  }

  const modelos =
    ec3LeerObjetos_(shModelo);

  if (modelos.length === 0) {
    throw new Error(
      'MODELO_MARCAS no contiene registros.'
    );
  }

  const shEventos =
    ec3ObtenerOCrearHoja_(
      ss,
      SII_EVENTOS_COMPRAS_V70003.DESTINO
    );

  const anteriores =
    ec3LeerMapaEventos_(shEventos);

  const detectados = new Map();

  modelos.forEach(modelo => {
    ec3EventosDesdeMarca_(modelo)
      .forEach(evento => {
        detectados.set(
          evento.ID_EVENTO,
          evento
        );
      });
  });

  const eventos =
    ec3FusionarEventos_(
      anteriores,
      detectados
    );

  ec3EscribirEventos_(
    shEventos,
    eventos
  );

  const conteo = {
    EVT001: 0,
    EVT002: 0,
    EVT003: 0,
    EVT004: 0,
    EVT005: 0
  };

  let abiertos = 0;

  eventos.forEach(evento => {
    const estado =
      ec3Norm_(evento.ESTADO);

    if (
      SII_EVENTOS_COMPRAS_V70003
        .ESTADOS_ABIERTOS
        .includes(estado)
    ) {
      abiertos++;

      const codigo =
        ec3Norm_(evento.CODIGO_EVENTO);

      if (conteo[codigo] !== undefined) {
        conteo[codigo]++;
      }
    }
  });

  const resultado = {
    version:
      SII_EVENTOS_COMPRAS_V70003.VERSION,
    marcas:
      modelos.length,
    detectados:
      detectados.size,
    totales:
      eventos.length,
    abiertos:
      abiertos,
    eventosAbiertosPorCodigo:
      conteo,
    duracionMs:
      Date.now() - inicio
  };

  Logger.log(
    JSON.stringify(
      resultado,
      null,
      2
    )
  );

  ss.toast(
    abiertos +
      ' eventos abiertos. ' +
      conteo.EVT001 +
      ' compras inmediatas.',
    'EVENTOS_COMPRAS V7.0.003',
    8
  );

  return resultado;
}


function abrirEventosCompras() {
  const ss = SpreadsheetApp.getActive();

  const sh = ss.getSheetByName(
    SII_EVENTOS_COMPRAS_V70003.DESTINO
  );

  if (!sh) {
    throw new Error(
      'No existe EVENTOS_COMPRAS.'
    );
  }

  sh.activate();
  sh.setActiveSelection('A1');
}


function probarEventosComprasV70003() {
  return actualizarEventosCompras();
}


/**************************************************************
 * REGLAS DE CLASIFICACIÓN
 **************************************************************/

function ec3EventosDesdeMarca_(m) {
  const eventos = [];

  const marca =
    ec3Texto_(m.MARCA) ||
    'SIN MARCA';

  const cantSku =
    ec3Num_(m.CANT_SKU);

  const skuConVentas =
    ec3Num_(m.SKU_CON_VENTAS);

  const urgentes =
    ec3Num_(m.SKU_URGENTES);

  const criticos =
    ec3Num_(m.SKU_CRITICOS);

  const cobertura =
    ec3NumNulo_(
      m.COBERTURA_MINIMA_MESES
    );

  const quiebre =
    ec3NumNulo_(
      m.PRIMER_QUIEBRE_DIAS
    );

  const riesgo =
    ec3Norm_(m.RIESGO_MAXIMO);

  const sugerida =
    ec3Num_(m.CANTIDAD_SUGERIDA);

  const alertas =
    ec3Num_(
      m.SKU_CON_ALERTAS_DATOS
    );

  const porcUrgentes =
    cantSku > 0
      ? urgentes / cantSku
      : 0;

  const porcCriticos =
    cantSku > 0
      ? criticos / cantSku
      : 0;

  /*
   * Las marcas sin ventas no generan evento de compra.
   */
  const tieneVentas =
    skuConVentas > 0;

  const evaluacion =
    ec3ClasificarCompra_({
      cantSku: cantSku,
      urgentes: urgentes,
      criticos: criticos,
      porcUrgentes: porcUrgentes,
      porcCriticos: porcCriticos,
      cobertura: cobertura,
      quiebre: quiebre,
      riesgo: riesgo,
      sugerida: sugerida,
      tieneVentas: tieneVentas
    });

  if (
    evaluacion.prioridad === 'P1'
  ) {
    eventos.push(
      ec3NuevoEvento_({
        codigo: 'EVT001',
        tipo: 'COMPRA',
        severidad: 'ROJA',
        prioridad: 'P1',
        marca: marca,
        descripcion:
          'La marca requiere análisis de compra inmediata.',
        motivo:
          ec3MotivoCompra_(
            urgentes,
            criticos,
            porcUrgentes,
            porcCriticos,
            cobertura,
            quiebre,
            riesgo,
            sugerida
          ),
        accion:
          'Analizar SKU afectados y emitir PI si corresponde.',
        puntaje:
          evaluacion.puntaje,
        criterios:
          evaluacion.criterios,
        porcUrgentes:
          porcUrgentes,
        porcCriticos:
          porcCriticos,
        valor:
          sugerida,
        unidad:
          'UNIDADES'
      })
    );

  } else if (
    evaluacion.prioridad === 'P2'
  ) {
    eventos.push(
      ec3NuevoEvento_({
        codigo: 'EVT002',
        tipo: 'PLANIFICACION',
        severidad: 'NARANJA',
        prioridad: 'P2',
        marca: marca,
        descripcion:
          'La marca requiere planificación prioritaria de compra.',
        motivo:
          ec3MotivoCompra_(
            urgentes,
            criticos,
            porcUrgentes,
            porcCriticos,
            cobertura,
            quiebre,
            riesgo,
            sugerida
          ),
        accion:
          'Revisar el detalle y preparar la próxima compra.',
        puntaje:
          evaluacion.puntaje,
        criterios:
          evaluacion.criterios,
        porcUrgentes:
          porcUrgentes,
        porcCriticos:
          porcCriticos,
        valor:
          sugerida,
        unidad:
          'UNIDADES'
      })
    );

  } else if (
    evaluacion.prioridad === 'P3'
  ) {
    eventos.push(
      ec3NuevoEvento_({
        codigo: 'EVT003',
        tipo: 'REVISION',
        severidad: 'AMARILLA',
        prioridad: 'P3',
        marca: marca,
        descripcion:
          'La marca requiere revisión de compra.',
        motivo:
          ec3MotivoCompra_(
            urgentes,
            criticos,
            porcUrgentes,
            porcCriticos,
            cobertura,
            quiebre,
            riesgo,
            sugerida
          ),
        accion:
          'Validar consumo, cobertura, pendientes y necesidad de compra.',
        puntaje:
          evaluacion.puntaje,
        criterios:
          evaluacion.criterios,
        porcUrgentes:
          porcUrgentes,
        porcCriticos:
          porcCriticos,
        valor:
          sugerida,
        unidad:
          'UNIDADES'
      })
    );
  }

  /*
   * Calidad de datos.
   */
  if (
    alertas > 0 ||
    marca === 'SIN MARCA'
  ) {
    eventos.push(
      ec3NuevoEvento_({
        codigo: 'EVT004',
        tipo: 'DATOS',
        severidad:
          marca === 'SIN MARCA'
            ? 'ROJA'
            : 'AMARILLA',
        prioridad:
          marca === 'SIN MARCA'
            ? 'P1'
            : 'P3',
        marca: marca,
        descripcion:
          'Hay información incompleta que puede afectar la recomendación.',
        motivo:
          marca === 'SIN MARCA'
            ? 'Existen SKU sin marca asignada.'
            : alertas +
              ' SKU presentan alertas de datos.',
        accion:
          'Revisar maestros, equivalencias, ventas y parámetros.',
        puntaje:
          0,
        criterios:
          'CALIDAD DE DATOS',
        porcUrgentes:
          porcUrgentes,
        porcCriticos:
          porcCriticos,
        valor:
          alertas,
        unidad:
          'SKU'
      })
    );
  }

  /*
   * Marca sin ventas.
   */
  if (
    cantSku > 0 &&
    skuConVentas === 0
  ) {
    eventos.push(
      ec3NuevoEvento_({
        codigo: 'EVT005',
        tipo: 'REVISION',
        severidad: 'GRIS',
        prioridad: 'P4',
        marca: marca,
        descripcion:
          'La marca no registra SKU con ventas.',
        motivo:
          cantSku +
          ' SKU sin historial de ventas.',
        accion:
          'Confirmar si la marca es nueva, inactiva o tiene equivalencias pendientes.',
        puntaje:
          0,
        criterios:
          'SIN VENTAS',
        porcUrgentes:
          porcUrgentes,
        porcCriticos:
          porcCriticos,
        valor:
          cantSku,
        unidad:
          'SKU'
      })
    );
  }

  return eventos;
}


function ec3ClasificarCompra_(d) {
  if (!d.tieneVentas) {
    return {
      prioridad: '',
      puntaje: 0,
      criterios:
        'Marca sin ventas: no genera evento de compra'
    };
  }

  const reglas =
    SII_EVENTOS_COMPRAS_V70003
      .REGLAS;

  const criterios = [];
  let puntaje = 0;

  const cumpleBaseCritica =
    d.riesgo === 'CRITICO';

  const cumpleImpactoP1 =
    d.urgentes >=
      reglas.P1_MIN_SKU_URGENTES ||
    d.porcUrgentes >=
      reglas.P1_PORC_SKU_URGENTES ||
    (
      d.quiebre !== null &&
      d.quiebre <
        reglas.P1_QUIEBRE_DIAS &&
      d.urgentes >=
        reglas.P1_MIN_URGENTES_CON_QUIEBRE
    );

  if (cumpleBaseCritica) {
    puntaje += 50;
    criterios.push(
      'Riesgo crítico'
    );
  }

  if (
    d.urgentes >=
    reglas.P1_MIN_SKU_URGENTES
  ) {
    puntaje += 25;
    criterios.push(
      d.urgentes +
      ' SKU urgentes'
    );
  }

  if (
    d.porcUrgentes >=
    reglas.P1_PORC_SKU_URGENTES
  ) {
    puntaje += 25;
    criterios.push(
      ec3FmtPorcentaje_(
        d.porcUrgentes
      ) +
      ' de SKU urgentes'
    );
  }

  if (
    d.quiebre !== null &&
    d.quiebre <
      reglas.P1_QUIEBRE_DIAS &&
    d.urgentes >=
      reglas.P1_MIN_URGENTES_CON_QUIEBRE
  ) {
    puntaje += 20;
    criterios.push(
      'Quiebre < ' +
      reglas.P1_QUIEBRE_DIAS +
      ' días con ' +
      d.urgentes +
      ' SKU urgentes'
    );
  }

  if (
    cumpleBaseCritica &&
    cumpleImpactoP1
  ) {
    return {
      prioridad: 'P1',
      puntaje: puntaje,
      criterios:
        criterios.join(' | ')
    };
  }

  const p2Urgentes =
    d.urgentes >=
      reglas.P2_MIN_SKU_URGENTES &&
    d.urgentes <=
      reglas.P2_MAX_SKU_URGENTES;

  const p2Criticos =
    d.porcCriticos >=
      reglas.P2_PORC_SKU_CRITICOS;

  const p2Riesgo =
    d.riesgo === 'CRITICO' ||
    d.riesgo === 'ALTO';

  if (p2Riesgo) {
    puntaje += 30;
    criterios.push(
      'Riesgo ' +
      d.riesgo.toLowerCase()
    );
  }

  if (p2Urgentes) {
    puntaje += 15;
    criterios.push(
      d.urgentes +
      ' SKU urgentes'
    );
  }

  if (p2Criticos) {
    puntaje += 15;
    criterios.push(
      ec3FmtPorcentaje_(
        d.porcCriticos
      ) +
      ' de SKU críticos'
    );
  }

  if (
    p2Riesgo &&
    (
      p2Urgentes ||
      p2Criticos ||
      d.urgentes > 0
    )
  ) {
    return {
      prioridad: 'P2',
      puntaje: puntaje,
      criterios:
        criterios.join(' | ')
    };
  }

  if (
    d.sugerida >=
      reglas.P3_CANTIDAD_SUGERIDA_MIN ||
    d.riesgo === 'MEDIO' ||
    d.cobertura === 0 ||
    (
      d.cobertura !== null &&
      d.cobertura < 1
    )
  ) {
    if (
      d.sugerida >=
      reglas.P3_CANTIDAD_SUGERIDA_MIN
    ) {
      criterios.push(
        'Cantidad sugerida: ' +
        ec3Fmt_(d.sugerida, 0)
      );
      puntaje += 10;
    }

    if (d.riesgo === 'MEDIO') {
      criterios.push(
        'Riesgo medio'
      );
      puntaje += 5;
    }

    if (
      d.cobertura !== null &&
      d.cobertura < 1
    ) {
      criterios.push(
        'Cobertura menor a 1 mes'
      );
      puntaje += 5;
    }

    return {
      prioridad: 'P3',
      puntaje: puntaje,
      criterios:
        criterios.join(' | ')
    };
  }

  return {
    prioridad: '',
    puntaje: puntaje,
    criterios:
      criterios.length > 0
        ? criterios.join(' | ')
        : 'Sin condiciones de compra'
  };
}


function ec3MotivoCompra_(
  urgentes,
  criticos,
  porcUrgentes,
  porcCriticos,
  cobertura,
  quiebre,
  riesgo,
  sugerida
) {
  return ec3Motivos_([
    urgentes > 0
      ? urgentes +
        ' SKU urgentes (' +
        ec3FmtPorcentaje_(
          porcUrgentes
        ) +
        ')'
      : '',
    criticos > 0
      ? criticos +
        ' SKU críticos (' +
        ec3FmtPorcentaje_(
          porcCriticos
        ) +
        ')'
      : '',
    riesgo
      ? 'Riesgo: ' + riesgo
      : '',
    cobertura !== null
      ? 'Cobertura mínima: ' +
        ec3Fmt_(cobertura, 2) +
        ' meses'
      : '',
    quiebre !== null
      ? 'Primer quiebre: ' +
        ec3Fmt_(quiebre, 0) +
        ' días'
      : '',
    sugerida > 0
      ? 'Cantidad sugerida: ' +
        ec3Fmt_(sugerida, 0)
      : ''
  ]);
}


function ec3NuevoEvento_(d) {
  const ahora = new Date();

  return {
    ID_EVENTO:
      ec3Norm_(d.codigo) +
      '-' +
      ec3Clave_(d.marca),
    CODIGO_EVENTO:
      ec3Norm_(d.codigo),
    FECHA_CREACION:
      ahora,
    FECHA_ULTIMA_DETECCION:
      ahora,
    FECHA_RESOLUCION:
      '',
    TIPO:
      ec3Texto_(d.tipo),
    SEVERIDAD:
      ec3Texto_(d.severidad),
    PRIORIDAD:
      ec3Texto_(d.prioridad),
    MARCA:
      ec3Texto_(d.marca),
    DESCRIPCION:
      ec3Texto_(d.descripcion),
    MOTIVO:
      ec3Texto_(d.motivo),
    ACCION_RECOMENDADA:
      ec3Texto_(d.accion),
    PUNTAJE_CRITICIDAD:
      ec3Num_(d.puntaje),
    CRITERIOS_PUNTAJE:
      ec3Texto_(d.criterios),
    PORC_SKU_URGENTES:
      ec3Num_(d.porcUrgentes),
    PORC_SKU_CRITICOS:
      ec3Num_(d.porcCriticos),
    ESTADO:
      'NUEVO',
    RESPONSABLE:
      '',
    FECHA_LIMITE:
      '',
    RECURRENCIAS:
      1,
    ORIGEN:
      SII_EVENTOS_COMPRAS_V70003.ORIGEN,
    VALOR_REFERENCIA:
      d.valor === null ||
      d.valor === undefined
        ? ''
        : d.valor,
    UNIDAD_REFERENCIA:
      ec3Texto_(d.unidad),
    OBSERVACIONES:
      '',
    ULTIMA_ACTUALIZACION:
      ahora
  };
}


/**************************************************************
 * FUSIÓN E HISTORIAL
 **************************************************************/

function ec3FusionarEventos_(
  anteriores,
  detectados
) {
  const salida = [];
  const ahora = new Date();

  detectados.forEach(
    (nuevo, id) => {
      const anterior =
        anteriores.get(id);

      if (!anterior) {
        salida.push(nuevo);
        return;
      }

      const previo =
        ec3Norm_(anterior.ESTADO);

      const estado =
        (
          previo === 'CERRADO' ||
          previo === 'IGNORADO'
        )
          ? previo
          : (
              previo === 'RESUELTO'
                ? 'NUEVO'
                : previo || 'NUEVO'
            );

      salida.push({
        ID_EVENTO: id,
        CODIGO_EVENTO:
          nuevo.CODIGO_EVENTO,
        FECHA_CREACION:
          anterior.FECHA_CREACION ||
          nuevo.FECHA_CREACION,
        FECHA_ULTIMA_DETECCION:
          ahora,
        FECHA_RESOLUCION:
          '',
        TIPO:
          nuevo.TIPO,
        SEVERIDAD:
          nuevo.SEVERIDAD,
        PRIORIDAD:
          nuevo.PRIORIDAD,
        MARCA:
          nuevo.MARCA,
        DESCRIPCION:
          nuevo.DESCRIPCION,
        MOTIVO:
          nuevo.MOTIVO,
        ACCION_RECOMENDADA:
          nuevo.ACCION_RECOMENDADA,
        PUNTAJE_CRITICIDAD:
          nuevo.PUNTAJE_CRITICIDAD,
        CRITERIOS_PUNTAJE:
          nuevo.CRITERIOS_PUNTAJE,
        PORC_SKU_URGENTES:
          nuevo.PORC_SKU_URGENTES,
        PORC_SKU_CRITICOS:
          nuevo.PORC_SKU_CRITICOS,
        ESTADO:
          estado,
        RESPONSABLE:
          anterior.RESPONSABLE || '',
        FECHA_LIMITE:
          anterior.FECHA_LIMITE || '',
        RECURRENCIAS:
          ec3Num_(
            anterior.RECURRENCIAS
          ) + 1,
        ORIGEN:
          nuevo.ORIGEN,
        VALOR_REFERENCIA:
          nuevo.VALOR_REFERENCIA,
        UNIDAD_REFERENCIA:
          nuevo.UNIDAD_REFERENCIA,
        OBSERVACIONES:
          anterior.OBSERVACIONES || '',
        ULTIMA_ACTUALIZACION:
          ahora
      });
    }
  );

  anteriores.forEach(
    (anterior, id) => {
      if (detectados.has(id)) {
        return;
      }

      const estadoAnterior =
        ec3Norm_(anterior.ESTADO);

      const abierto =
        SII_EVENTOS_COMPRAS_V70003
          .ESTADOS_ABIERTOS
          .includes(estadoAnterior);

      salida.push(
        Object.assign(
          {},
          anterior,
          {
            ESTADO:
              abierto
                ? 'RESUELTO'
                : estadoAnterior,
            FECHA_RESOLUCION:
              abierto
                ? ahora
                : anterior.FECHA_RESOLUCION,
            ULTIMA_ACTUALIZACION:
              ahora
          }
        )
      );
    }
  );

  salida.sort(ec3OrdenEventos_);

  return salida;
}


function ec3OrdenEventos_(a, b) {
  const estados = {
    NUEVO: 1,
    ASIGNADO: 2,
    EN_PROCESO: 3,
    RESUELTO: 4,
    CERRADO: 5,
    IGNORADO: 6
  };

  const prioridades = {
    P1: 1,
    P2: 2,
    P3: 3,
    P4: 4
  };

  const ea =
    estados[ec3Norm_(a.ESTADO)] || 99;

  const eb =
    estados[ec3Norm_(b.ESTADO)] || 99;

  if (ea !== eb) {
    return ea - eb;
  }

  const pa =
    prioridades[
      ec3Norm_(a.PRIORIDAD)
    ] || 99;

  const pb =
    prioridades[
      ec3Norm_(b.PRIORIDAD)
    ] || 99;

  if (pa !== pb) {
    return pa - pb;
  }

  const scoreA =
    ec3Num_(a.PUNTAJE_CRITICIDAD);

  const scoreB =
    ec3Num_(b.PUNTAJE_CRITICIDAD);

  if (scoreA !== scoreB) {
    return scoreB - scoreA;
  }

  return ec3Texto_(a.MARCA)
    .localeCompare(
      ec3Texto_(b.MARCA)
    );
}


/**************************************************************
 * CAMBIO MANUAL DE ESTADO
 **************************************************************/

function cerrarEventoSeleccionado() {
  return ec3CambiarEstadoFila_(
    'CERRADO'
  );
}


function reabrirEventoSeleccionado() {
  return ec3CambiarEstadoFila_(
    'NUEVO'
  );
}


function cambiarEstadoEventoSeleccionado() {
  const ui =
    SpreadsheetApp.getUi();

  const respuesta =
    ui.prompt(
      'Cambiar estado',
      'Estados permitidos:\n' +
      SII_EVENTOS_COMPRAS_V70003
        .ESTADOS_VALIDOS
        .join('\n'),
      ui.ButtonSet.OK_CANCEL
    );

  if (
    respuesta.getSelectedButton() !==
    ui.Button.OK
  ) {
    return;
  }

  const estado =
    ec3Norm_(
      respuesta.getResponseText()
    );

  if (
    !SII_EVENTOS_COMPRAS_V70003
      .ESTADOS_VALIDOS
      .includes(estado)
  ) {
    throw new Error(
      'Estado inválido: ' +
      estado
    );
  }

  return ec3CambiarEstadoFila_(
    estado
  );
}


function ec3CambiarEstadoFila_(
  estado
) {
  const ss =
    SpreadsheetApp.getActive();

  const sh =
    ss.getActiveSheet();

  const rango =
    ss.getActiveRange();

  if (
    !sh ||
    sh.getName() !==
      SII_EVENTOS_COMPRAS_V70003
        .DESTINO
  ) {
    throw new Error(
      'Seleccioná una fila en EVENTOS_COMPRAS.'
    );
  }

  if (
    !rango ||
    rango.getRow() < 2
  ) {
    throw new Error(
      'Seleccioná una fila de evento.'
    );
  }

  const mapa =
    ec3MapaCabeceras_(sh);

  const fila =
    rango.getRow();

  sh.getRange(
    fila,
    mapa.get('ESTADO')
  ).setValue(estado);

  if (mapa.get('FECHA_RESOLUCION')) {
    sh.getRange(
      fila,
      mapa.get('FECHA_RESOLUCION')
    ).setValue(
      (
        estado === 'RESUELTO' ||
        estado === 'CERRADO'
      )
        ? new Date()
        : ''
    );
  }

  sh.getRange(
    fila,
    mapa.get('ULTIMA_ACTUALIZACION')
  ).setValue(new Date());

  return {
    fila: fila,
    estado: estado
  };
}


/**************************************************************
 * LECTURA, ESCRITURA Y FORMATO
 **************************************************************/

function ec3LeerMapaEventos_(sh) {
  const mapa = new Map();

  if (
    !sh ||
    sh.getLastRow() < 2
  ) {
    return mapa;
  }

  ec3LeerObjetos_(sh)
    .forEach(evento => {
      const id =
        ec3Texto_(evento.ID_EVENTO);

      if (id) {
        mapa.set(id, evento);
      }
    });

  return mapa;
}


function ec3LeerObjetos_(sh) {
  const datos =
    sh.getDataRange()
      .getValues();

  if (datos.length < 2) {
    return [];
  }

  const encabezados =
    datos[0].map(ec3Cabecera_);

  return datos
    .slice(1)
    .filter(fila =>
      fila.some(valor =>
        valor !== '' &&
        valor !== null
      )
    )
    .map(fila => {
      const obj = {};

      encabezados.forEach(
        (encabezado, indice) => {
          if (encabezado) {
            obj[encabezado] =
              fila[indice];
          }
        }
      );

      return obj;
    });
}


function ec3EscribirEventos_(
  sh,
  eventos
) {
  const filtro =
    sh.getFilter();

  if (filtro) {
    filtro.remove();
  }

  const encabezados =
    SII_EVENTOS_COMPRAS_V70003
      .ENCABEZADOS;

  const columnas =
    encabezados.length;

  if (
    sh.getMaxColumns() < columnas
  ) {
    sh.insertColumnsAfter(
      sh.getMaxColumns(),
      columnas -
        sh.getMaxColumns()
    );
  }

  if (
    sh.getMaxRows() <
    eventos.length + 1
  ) {
    sh.insertRowsAfter(
      sh.getMaxRows(),
      eventos.length + 1 -
        sh.getMaxRows()
    );
  }

  sh.clear();

  sh.getRange(
    1,
    1,
    1,
    columnas
  ).setValues([encabezados]);

  if (eventos.length > 0) {
    const valores =
      eventos.map(evento =>
        encabezados.map(
          encabezado =>
            evento[encabezado] ===
              undefined
              ? ''
              : evento[encabezado]
        )
      );

    sh.getRange(
      2,
      1,
      valores.length,
      columnas
    ).setValues(valores);

    sh.getRange(
      1,
      1,
      valores.length + 1,
      columnas
    ).createFilter();
  }

  ec3Formato_(
    sh,
    eventos.length
  );
}


function ec3Formato_(
  sh,
  filas
) {
  const columnas =
    SII_EVENTOS_COMPRAS_V70003
      .ENCABEZADOS.length;

  sh.setFrozenRows(1);

  sh.getRange(
    1,
    1,
    1,
    columnas
  )
    .setBackground('#1F4E78')
    .setFontColor('#FFFFFF')
    .setFontWeight('bold')
    .setHorizontalAlignment('center')
    .setWrap(true);

  if (filas <= 0) {
    return;
  }

  const mapa =
    ec3MapaCabeceras_(sh);

  [
    'FECHA_CREACION',
    'FECHA_ULTIMA_DETECCION',
    'FECHA_RESOLUCION',
    'ULTIMA_ACTUALIZACION'
  ].forEach(campo => {
    const col = mapa.get(campo);

    if (col) {
      sh.getRange(
        2,
        col,
        filas,
        1
      ).setNumberFormat(
        'dd/MM/yyyy HH:mm'
      );
    }
  });

  [
    'PORC_SKU_URGENTES',
    'PORC_SKU_CRITICOS'
  ].forEach(campo => {
    const col = mapa.get(campo);

    if (col) {
      sh.getRange(
        2,
        col,
        filas,
        1
      ).setNumberFormat('0.00%');
    }
  });

  const colFechaLimite =
    mapa.get('FECHA_LIMITE');

  if (colFechaLimite) {
    sh.getRange(
      2,
      colFechaLimite,
      filas,
      1
    ).setNumberFormat(
      'dd/MM/yyyy'
    );
  }

  const colEstado =
    mapa.get('ESTADO');

  if (colEstado) {
    const validacion =
      SpreadsheetApp
        .newDataValidation()
        .requireValueInList(
          SII_EVENTOS_COMPRAS_V70003
            .ESTADOS_VALIDOS,
          true
        )
        .setAllowInvalid(false)
        .build();

    sh.getRange(
      2,
      colEstado,
      filas,
      1
    ).setDataValidation(validacion);
  }

  sh.getRange(
    2,
    1,
    filas,
    columnas
  )
    .setVerticalAlignment('middle')
    .setWrap(true);

  sh.setColumnWidth(1, 190);
  sh.setColumnWidth(9, 170);
  sh.setColumnWidth(10, 280);
  sh.setColumnWidth(11, 380);
  sh.setColumnWidth(12, 300);
  sh.setColumnWidth(14, 380);
  sh.setColumnWidth(24, 300);

  const reglas = [];

  const colPrioridad =
    mapa.get('PRIORIDAD');

  if (colPrioridad) {
    const rango =
      sh.getRange(
        2,
        colPrioridad,
        filas,
        1
      );

    reglas.push(
      ec3Regla_(
        rango,
        'P1',
        '#F4CCCC'
      ),
      ec3Regla_(
        rango,
        'P2',
        '#FCE5CD'
      ),
      ec3Regla_(
        rango,
        'P3',
        '#FFF2CC'
      ),
      ec3Regla_(
        rango,
        'P4',
        '#D9EAD3'
      )
    );
  }

  sh.setConditionalFormatRules(reglas);
}


function ec3Regla_(
  rango,
  texto,
  color
) {
  return SpreadsheetApp
    .newConditionalFormatRule()
    .whenTextEqualTo(texto)
    .setBackground(color)
    .setBold(true)
    .setRanges([rango])
    .build();
}


function ec3MapaCabeceras_(sh) {
  const encabezados =
    sh.getRange(
      1,
      1,
      1,
      sh.getLastColumn()
    ).getDisplayValues()[0];

  const mapa = new Map();

  encabezados.forEach(
    (valor, indice) => {
      const clave =
        ec3Cabecera_(valor);

      if (clave) {
        mapa.set(
          clave,
          indice + 1
        );
      }
    }
  );

  return mapa;
}


function ec3ObtenerOCrearHoja_(
  ss,
  nombre
) {
  return (
    ss.getSheetByName(nombre) ||
    ss.insertSheet(nombre)
  );
}


/**************************************************************
 * UTILIDADES
 **************************************************************/

function ec3Motivos_(lista) {
  return lista
    .map(ec3Texto_)
    .filter(Boolean)
    .join(' | ');
}


function ec3Cabecera_(valor) {
  return ec3Texto_(valor)
    .normalize('NFD')
    .replace(
      /[\u0300-\u036f]/g,
      ''
    )
    .toUpperCase()
    .replace(/\s+/g, '_');
}


function ec3Norm_(valor) {
  return ec3Texto_(valor)
    .normalize('NFD')
    .replace(
      /[\u0300-\u036f]/g,
      ''
    )
    .toUpperCase()
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ');
}


function ec3Clave_(valor) {
  return ec3Norm_(valor)
    .replace(
      /[^A-Z0-9]/g,
      ''
    );
}


function ec3Texto_(valor) {
  return String(
    valor === null ||
    valor === undefined
      ? ''
      : valor
  ).trim();
}


function ec3NumNulo_(valor) {
  if (
    valor === null ||
    valor === undefined ||
    ec3Texto_(valor) === ''
  ) {
    return null;
  }

  const numero = ec3Num_(valor);

  return Number.isFinite(numero)
    ? numero
    : null;
}


function ec3Num_(valor) {
  if (typeof valor === 'number') {
    return Number.isFinite(valor)
      ? valor
      : 0;
  }

  let texto =
    ec3Texto_(valor)
      .replace(/[^\d,.-]/g, '');

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

  } else if (
    texto.includes(',')
  ) {
    texto =
      texto.replace(',', '.');
  }

  const numero = Number(texto);

  return Number.isFinite(numero)
    ? numero
    : 0;
}


function ec3Fmt_(
  valor,
  decimales
) {
  const numero = Number(valor);

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


function ec3FmtPorcentaje_(valor) {
  const numero = Number(valor);

  if (!Number.isFinite(numero)) {
    return '0,00%';
  }

  return numero.toLocaleString(
    'es-AR',
    {
      style: 'percent',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }
  );
}
