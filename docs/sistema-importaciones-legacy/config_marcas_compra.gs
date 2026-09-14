/******************************************************************
 * SII - POLÍTICA DE COMPRAS POR MARCA
 * Sprint B.1.9-B
 *
 * Reglas:
 *   COMPRA = NO  -> excluida de nuevas compras.
 *   NACIONAL     -> cobertura objetivo 1,5 meses.
 *   IMPORTADO    -> cobertura objetivo 6 meses.
 *
 * Fuente inicial:
 *   compra.xlsx suministrado por el usuario.
 *
 * La hoja CONFIG_MARCAS_COMPRA queda editable. Una vez creada,
 * este módulo NO sobreescribe cambios manuales posteriores.
 ******************************************************************/

const SII_POLITICA_MARCAS_B19A = {
  VERSION: 'B.1.9-B',
  HOJA_CONFIG: 'CONFIG_MARCAS_COMPRA',
  HOJA_MODELO: 'MODELO_COMPRAS',
  HOJA_GESTION_ACTIVA: 'GESTION_COMPRAS_ACTIVA',
  FILAS_INICIALES: [
  [
    "PHILIPS",
    "NACIONALES ACTIVOS",
    "SI",
    "NACIONAL",
    1.5
  ],
  [
    "WILLARD BATERIAS",
    "NACIONALES ACTIVOS",
    "SI",
    "NACIONAL",
    1.5
  ],
  [
    "GENOUD",
    "NACIONALES ACTIVOS",
    "SI",
    "NACIONAL",
    1.5
  ],
  [
    "MOHER",
    "NACIONALES ACTIVOS",
    "SI",
    "NACIONAL",
    1.5
  ],
  [
    "POSITRON",
    "NACIONALES ACTIVOS",
    "SI",
    "NACIONAL",
    1.5
  ],
  [
    "ORLAN ROBER",
    "NACIONALES ACTIVOS",
    "SI",
    "NACIONAL",
    1.5
  ],
  [
    "RALUX",
    "NACIONALES ACTIVOS",
    "SI",
    "NACIONAL",
    1.5
  ],
  [
    "ORO",
    "NACIONALES ACTIVOS",
    "SI",
    "NACIONAL",
    1.5
  ],
  [
    "HUTCHINSON",
    "NACIONALES ACTIVOS",
    "SI",
    "NACIONAL",
    1.5
  ],
  [
    "KESSEL",
    "NACIONALES ACTIVOS",
    "SI",
    "NACIONAL",
    1.5
  ],
  [
    "COBREFLEX",
    "NACIONALES ACTIVOS",
    "SI",
    "NACIONAL",
    1.5
  ],
  [
    "3M",
    "NACIONALES ACTIVOS",
    "SI",
    "NACIONAL",
    1.5
  ],
  [
    "CHAMPION",
    "NACIONALES ACTIVOS",
    "SI",
    "NACIONAL",
    1.5
  ],
  [
    "MATAFUEGOS",
    "NACIONALES ACTIVOS",
    "SI",
    "NACIONAL",
    1.5
  ],
  [
    "NOSSO",
    "NACIONALES ACTIVOS",
    "SI",
    "NACIONAL",
    1.5
  ],
  [
    "GV",
    "NACIONALES ACTIVOS",
    "SI",
    "NACIONAL",
    1.5
  ],
  [
    "DZE",
    "NACIONALES ACTIVOS",
    "SI",
    "NACIONAL",
    1.5
  ],
  [
    "KOBLA",
    "NACIONALES ACTIVOS",
    "SI",
    "NACIONAL",
    1.5
  ],
  [
    "DAEMA - TRIA",
    "NACIONALES ACTIVOS",
    "SI",
    "NACIONAL",
    1.5
  ],
  [
    "VUARAM",
    "NACIONALES ACTIVOS",
    "SI",
    "NACIONAL",
    1.5
  ],
  [
    "ZEN",
    "NACIONALES ACTIVOS",
    "SI",
    "NACIONAL",
    1.5
  ],
  [
    "TOXIC SHINE",
    "NACIONALES ACTIVOS",
    "SI",
    "NACIONAL",
    1.5
  ],
  [
    "REIMOTOR",
    "NACIONALES ACTIVOS",
    "SI",
    "NACIONAL",
    1.5
  ],
  [
    "MB",
    "NACIONALES ACTIVOS",
    "SI",
    "NACIONAL",
    1.5
  ],
  [
    "FERRAZZI",
    "NACIONALES ACTIVOS",
    "SI",
    "NACIONAL",
    1.5
  ],
  [
    "WAGNER LOCKHEED",
    "NACIONALES ACTIVOS",
    "SI",
    "NACIONAL",
    1.5
  ],
  [
    "GAREF",
    "NACIONALES ACTIVOS",
    "SI",
    "NACIONAL",
    1.5
  ],
  [
    "DEXCO",
    "NACIONALES ACTIVOS",
    "SI",
    "NACIONAL",
    1.5
  ],
  [
    "WD-40",
    "NACIONALES ACTIVOS",
    "SI",
    "NACIONAL",
    1.5
  ],
  [
    "MCGARD",
    "NACIONALES ACTIVOS",
    "SI",
    "NACIONAL",
    1.5
  ],
  [
    "MACO",
    "NACIONALES ACTIVOS",
    "SI",
    "NACIONAL",
    1.5
  ],
  [
    "BYC",
    "NACIONALES ACTIVOS",
    "SI",
    "NACIONAL",
    1.5
  ],
  [
    "ZM",
    "NACIONALES ACTIVOS",
    "SI",
    "NACIONAL",
    1.5
  ],
  [
    "PRECINTOS",
    "NACIONALES ACTIVOS",
    "SI",
    "NACIONAL",
    1.5
  ],
  [
    "EXIMETAL",
    "NACIONALES ACTIVOS",
    "SI",
    "NACIONAL",
    1.5
  ],
  [
    "ELECTRONOVA",
    "NACIONALES ACTIVOS",
    "SI",
    "NACIONAL",
    1.5
  ],
  [
    "PICBORG",
    "NACIONALES ACTIVOS",
    "SI",
    "NACIONAL",
    1.5
  ],
  [
    "HIT",
    "NACIONALES ACTIVOS",
    "SI",
    "NACIONAL",
    1.5
  ],
  [
    "TERMOCONTRAIBLE",
    "NACIONALES ACTIVOS",
    "SI",
    "NACIONAL",
    1.5
  ],
  [
    "REBULA",
    "NACIONALES ACTIVOS",
    "SI",
    "NACIONAL",
    1.5
  ],
  [
    "INDUMAG",
    "NACIONALES DESACTIVADOS",
    "NO",
    "NACIONAL",
    1.5
  ],
  [
    "STARYEN",
    "NACIONALES DESACTIVADOS",
    "NO",
    "NACIONAL",
    1.5
  ],
  [
    "LS",
    "NACIONALES DESACTIVADOS",
    "NO",
    "NACIONAL",
    1.5
  ],
  [
    "NGK",
    "NACIONALES DESACTIVADOS",
    "NO",
    "NACIONAL",
    1.5
  ],
  [
    "BERU",
    "NACIONALES DESACTIVADOS",
    "NO",
    "NACIONAL",
    1.5
  ],
  [
    "DÓLAR",
    "NACIONALES DESACTIVADOS",
    "NO",
    "NACIONAL",
    1.5
  ],
  [
    "DRIVEN",
    "NACIONALES DESACTIVADOS",
    "NO",
    "NACIONAL",
    1.5
  ],
  [
    "DUCK PORTAEQUIPAJES",
    "NACIONALES DESACTIVADOS",
    "NO",
    "NACIONAL",
    1.5
  ],
  [
    "HIGHWAY STAR",
    "NACIONALES DESACTIVADOS",
    "NO",
    "NACIONAL",
    1.5
  ],
  [
    "TRICO",
    "NACIONALES DESACTIVADOS",
    "NO",
    "NACIONAL",
    1.5
  ],
  [
    "LITTON",
    "NACIONALES LOTEADOS",
    "NO",
    "NACIONAL",
    1.5
  ],
  [
    "LAM",
    "NACIONALES LOTEADOS",
    "NO",
    "NACIONAL",
    1.5
  ],
  [
    "LC",
    "NACIONALES LOTEADOS",
    "NO",
    "NACIONAL",
    1.5
  ],
  [
    "GZ",
    "NACIONALES LOTEADOS",
    "NO",
    "NACIONAL",
    1.5
  ],
  [
    "HDS",
    "NACIONALES LOTEADOS",
    "NO",
    "NACIONAL",
    1.5
  ],
  [
    "VEYPA",
    "NACIONALES LOTEADOS",
    "NO",
    "NACIONAL",
    1.5
  ],
  [
    "ROFIL",
    "NACIONALES LOTEADOS",
    "NO",
    "NACIONAL",
    1.5
  ],
  [
    "PITTS",
    "NACIONALES LOTEADOS",
    "NO",
    "NACIONAL",
    1.5
  ],
  [
    "FELKO",
    "NACIONALES LOTEADOS",
    "NO",
    "NACIONAL",
    1.5
  ],
  [
    "MOURA",
    "NACIONALES LOTEADOS",
    "NO",
    "NACIONAL",
    1.5
  ],
  [
    "DUCK BRAZOS",
    "NACIONALES LOTEADOS",
    "NO",
    "NACIONAL",
    1.5
  ],
  [
    "ELOD",
    "NACIONALES LOTEADOS",
    "NO",
    "NACIONAL",
    1.5
  ],
  [
    "GG",
    "NACIONALES LOTEADOS",
    "NO",
    "NACIONAL",
    1.5
  ],
  [
    "MIRBA",
    "NACIONALES LOTEADOS",
    "NO",
    "NACIONAL",
    1.5
  ],
  [
    "MD",
    "NACIONALES LOTEADOS",
    "NO",
    "NACIONAL",
    1.5
  ],
  [
    "CHEFREN",
    "NACIONALES LOTEADOS",
    "NO",
    "NACIONAL",
    1.5
  ],
  [
    "MALLORY",
    "NACIONALES LOTEADOS",
    "NO",
    "NACIONAL",
    1.5
  ],
  [
    "TAILLOT",
    "NACIONALES LOTEADOS",
    "NO",
    "NACIONAL",
    1.5
  ],
  [
    "PLASTITREBOL",
    "NACIONALES LOTEADOS",
    "NO",
    "NACIONAL",
    1.5
  ],
  [
    "DOG",
    "NACIONALES LOTEADOS",
    "NO",
    "NACIONAL",
    1.5
  ],
  [
    "ALFA",
    "NACIONALES LOTEADOS",
    "NO",
    "NACIONAL",
    1.5
  ],
  [
    "LOCTITE",
    "NACIONALES LOTEADOS",
    "NO",
    "NACIONAL",
    1.5
  ],
  [
    "LUX LED LIGHTING",
    "IMPORTADOS ACTIVOS",
    "SI",
    "IMPORTADO",
    6
  ],
  [
    "KOBO LIGHTING",
    "IMPORTADOS ACTIVOS",
    "SI",
    "IMPORTADO",
    6
  ],
  [
    "OREGON",
    "IMPORTADOS ACTIVOS",
    "SI",
    "IMPORTADO",
    6
  ],
  [
    "IRON LED",
    "IMPORTADOS ACTIVOS",
    "SI",
    "IMPORTADO",
    6
  ],
  [
    "RGU PRO",
    "IMPORTADOS ACTIVOS",
    "SI",
    "IMPORTADO",
    6
  ],
  [
    "DIVAIO",
    "IMPORTADOS ACTIVOS",
    "SI",
    "IMPORTADO",
    6
  ],
  [
    "KUBE",
    "IMPORTADOS ACTIVOS",
    "SI",
    "IMPORTADO",
    6
  ],
  [
    "EKTION",
    "IMPORTADOS ACTIVOS",
    "SI",
    "IMPORTADO",
    6
  ],
  [
    "MAVERICK",
    "IMPORTADOS ACTIVOS",
    "SI",
    "IMPORTADO",
    6
  ],
  [
    "NQD",
    "IMPORTADOS ACTIVOS",
    "SI",
    "IMPORTADO",
    6
  ],
  [
    "VERKEHR",
    "IMPORTADOS ACTIVOS",
    "SI",
    "IMPORTADO",
    6
  ],
  [
    "DERFOE",
    "IMPORTADOS ACTIVOS",
    "SI",
    "IMPORTADO",
    6
  ],
  [
    "IMPORTADOS VARIOS",
    "IMPORTADOS ACTIVOS",
    "SI",
    "IMPORTADO",
    6
  ],
  [
    "TOP SAFE",
    "IMPORTADOS ACTIVOS",
    "SI",
    "IMPORTADO",
    6
  ],
  [
    "SRA BEARINGS",
    "IMPORTADOS ACTIVOS",
    "SI",
    "IMPORTADO",
    6
  ],
  [
    "CROCOS DETAILING",
    "IMPORTADOS ACTIVOS",
    "SI",
    "IMPORTADO",
    6
  ],
  [
    "MIKIMOTO",
    "IMPORTADOS ACTIVOS",
    "SI",
    "IMPORTADO",
    6
  ],
  [
    "MOTOLITE",
    "IMPORTADOS ACTIVOS",
    "SI",
    "IMPORTADO",
    6
  ],
  [
    "NOVOPLAST",
    "IMPORTADOS ACTIVOS",
    "SI",
    "IMPORTADO",
    6
  ],
  [
    "AFA  SELECCION",
    "IMPORTADOS ACTIVOS",
    "SI",
    "IMPORTADO",
    6
  ],
  [
    "ACCESORIOS CELULARES",
    "IMPORTADOS DESACTIVADOS",
    "NO",
    "IMPORTADO",
    6
  ],
  [
    "KASSLER",
    "IMPORTADOS DESACTIVADOS",
    "NO",
    "IMPORTADO",
    6
  ],
  [
    "ROCKFORD FOSGATE",
    "IMPORTADOS DESACTIVADOS",
    "NO",
    "IMPORTADO",
    6
  ],
  [
    "PIONEER",
    "IMPORTADOS DESACTIVADOS",
    "NO",
    "IMPORTADO",
    6
  ],
  [
    "HID XENON",
    "IMPORTADOS DESACTIVADOS",
    "NO",
    "IMPORTADO",
    6
  ],
  [
    "ROYAL SUPER",
    "IMPORTADOS ESPECIALES",
    "SI",
    "IMPORTADO",
    6
  ],
  [
    "MIRAGE TYRES",
    "IMPORTADOS ESPECIALES",
    "SI",
    "IMPORTADO",
    6
  ],
  [
    "DERUIBO",
    "IMPORTADOS ESPECIALES",
    "SI",
    "IMPORTADO",
    6
  ]
]
};


/**
 * Ejecutar una vez para crear CONFIG_MARCAS_COMPRA.
 * Si la hoja ya tiene datos, no los reemplaza.
 */
function inicializarConfigMarcasCompra() {

  const ss =
    SpreadsheetApp.getActiveSpreadsheet();

  let sh =
    ss.getSheetByName(
      SII_POLITICA_MARCAS_B19A.HOJA_CONFIG
    );

  if (!sh) {
    sh =
      ss.insertSheet(
        SII_POLITICA_MARCAS_B19A.HOJA_CONFIG
      );
  }

  const headers = [[
    'MARCA',
    'SITUACION',
    'COMPRA',
    'ORIGEN',
    'COBERTURA_OBJETIVO',
    'ULTIMA_ACTUALIZACION'
  ]];

  if (
    sh.getLastRow() >= 2
  ) {
    return {
      ok: true,
      creada: false,
      marcas: sh.getLastRow() - 1
    };
  }

  sh.clear();

  sh.getRange(
    1,
    1,
    1,
    headers[0].length
  ).setValues(
    headers
  );

  const ahora =
    new Date();

  const filas =
    SII_POLITICA_MARCAS_B19A
      .FILAS_INICIALES
      .map(
        function(f) {
          return [
            f[0],
            f[1],
            f[2],
            f[3],
            f[4],
            ahora
          ];
        }
      );

  if (
    filas.length > 0
  ) {
    sh.getRange(
      2,
      1,
      filas.length,
      headers[0].length
    ).setValues(
      filas
    );
  }

  sh.setFrozenRows(1);

  sh.getRange(
    1,
    1,
    1,
    headers[0].length
  )
  .setBackground(
    '#123d6a'
  )
  .setFontColor(
    'white'
  )
  .setFontWeight(
    'bold'
  );

  sh.getRange(
    2,
    5,
    Math.max(
      filas.length,
      1
    ),
    1
  ).setNumberFormat(
    '0.0'
  );

  sh.autoResizeColumns(
    1,
    headers[0].length
  );

  return {
    ok: true,
    creada: true,
    marcas: filas.length
  };
}


/**
 * Aplica la política al MODELO_COMPRAS y sincroniza
 * GESTION_COMPRAS_ACTIVA.
 *
 * Ejecutar después de actualizar MODELO_COMPRAS.
 */
function aplicarPoliticaMarcasCompra() {

  const inicio =
    Date.now();

  const ss =
    SpreadsheetApp.getActiveSpreadsheet();

  inicializarConfigMarcasCompra();

  const mapa =
    leerConfigMarcasCompra_(
      ss
    );

  const mapaAlias =
    typeof obtenerMapaAliasMarcasCompra_ === 'function'
      ? obtenerMapaAliasMarcasCompra_(ss)
      : new Map();

  const shModelo =
    ss.getSheetByName(
      SII_POLITICA_MARCAS_B19A.HOJA_MODELO
    );

  if (!shModelo) {
    throw new Error(
      'No existe MODELO_COMPRAS.'
    );
  }

  const resultado =
    aplicarPoliticaAHojaCompras_(
      shModelo,
      mapa,
      mapaAlias
    );

  const shActiva =
    ss.getSheetByName(
      SII_POLITICA_MARCAS_B19A.HOJA_GESTION_ACTIVA
    );

  if (shActiva) {
    sincronizarGestionActivaDesdeModeloB19_(
      shModelo,
      shActiva
    );
  }

  const salida = {
    version:
      SII_POLITICA_MARCAS_B19A.VERSION,
    marcasConfiguradas:
      mapa.size,
    aliasActivos:
      mapaAlias.size,
    skuProcesados:
      resultado.skuProcesados,
    skuHabilitados:
      resultado.skuHabilitados,
    skuNoCompra:
      resultado.skuNoCompra,
    skuSinConfig:
      resultado.skuSinConfig,
    unidadesSugeridas:
      resultado.unidadesSugeridas,
    duracionMs:
      Date.now() - inicio
  };

  Logger.log(
    JSON.stringify(
      salida,
      null,
      2
    )
  );

  ss.toast(
    resultado.skuProcesados +
      ' SKU procesados. ' +
      resultado.skuNoCompra +
      ' excluidos de compra.',
    'Política de marcas',
    7
  );

  return salida;
}


function leerConfigMarcasCompra_(
  ss
) {

  const sh =
    ss.getSheetByName(
      SII_POLITICA_MARCAS_B19A.HOJA_CONFIG
    );

  if (
    !sh ||
    sh.getLastRow() < 2
  ) {
    throw new Error(
      'CONFIG_MARCAS_COMPRA no contiene datos.'
    );
  }

  const datos =
    sh.getDataRange()
      .getValues();

  const headers =
    datos[0]
      .map(
        normalizarB19_
      );

  const idx = {};

  headers.forEach(
    function(h, i) {
      idx[h] = i;
    }
  );

  const requeridos = [
    'MARCA',
    'COMPRA',
    'ORIGEN',
    'COBERTURA_OBJETIVO'
  ];

  requeridos.forEach(
    function(h) {
      if (
        idx[h] ===
        undefined
      ) {
        throw new Error(
          'Falta la columna ' +
          h +
          ' en CONFIG_MARCAS_COMPRA.'
        );
      }
    }
  );

  const mapa =
    new Map();

  for (
    let f = 1;
    f < datos.length;
    f++
  ) {

    const marca =
      claveB19_(
        datos[f][
          idx.MARCA
        ]
      );

    if (!marca) {
      continue;
    }

    const compra =
      normalizarSiNoB19_(
        datos[f][
          idx.COMPRA
        ]
      );

    const origen =
      String(
        datos[f][
          idx.ORIGEN
        ] || ''
      )
      .trim()
      .toUpperCase();

    let objetivo =
      numeroB19_(
        datos[f][
          idx.COBERTURA_OBJETIVO
        ]
      );

    if (
      objetivo <= 0
    ) {
      objetivo =
        origen ===
        'IMPORTADO'
          ? 6
          : (
              origen ===
              'NACIONAL'
                ? 1.5
                : 0
            );
    }

    mapa.set(
      marca,
      {
        compra:
          compra,
        origen:
          origen ||
          'SIN CONFIGURAR',
        objetivo:
          objetivo
      }
    );
  }

  return mapa;
}


function aplicarPoliticaAHojaCompras_(
  sh,
  mapa,
  mapaAlias
) {

  const filaHeader =
    detectarFilaHeaderB19_(
      sh
    );

  let ultimaColumna =
    sh.getLastColumn();

  let headers =
    sh.getRange(
      filaHeader,
      1,
      1,
      ultimaColumna
    )
    .getDisplayValues()[0]
    .map(
      normalizarB19_
    );

  const asegurar =
    function(nombre) {

      let c =
        headers.indexOf(
          nombre
        );

      if (
        c >= 0
      ) {
        return c;
      }

      ultimaColumna++;

      sh.getRange(
        filaHeader,
        ultimaColumna
      ).setValue(
        nombre
      );

      headers.push(
        nombre
      );

      return (
        ultimaColumna -
        1
      );
    };

  const idx = {};

  headers.forEach(
    function(h, i) {
      idx[h] = i;
    }
  );

  const cSku =
    buscarB19_(
      idx,
      ['SKU']
    );

  const cMarca =
    buscarB19_(
      idx,
      ['MARCA']
    );

  const cPromedio =
    buscarB19_(
      idx,
      ['PROMEDIO_MENSUAL']
    );

  const cStock =
    buscarB19_(
      idx,
      ['STOCK_TOTAL']
    );

  const cPendiente =
    buscarB19_(
      idx,
      [
        'PENDIENTE_TOTAL',
        'PENDIENTE_RECIBIR'
      ]
    );

  const cCobAct =
    asegurar(
      'COBERTURA_ACTUAL'
    );

  const cCobFut =
    asegurar(
      'COBERTURA_FUTURA'
    );

  const cObjetivo =
    asegurar(
      'COBERTURA_OBJETIVO'
    );

  const cCompra =
    asegurar(
      'COMPRA_SUGERIDA'
    );

  const cRiesgo =
    asegurar(
      'RIESGO'
    );

  const cPrioridad =
    asegurar(
      'PRIORIDAD'
    );

  const cOrigen =
    asegurar(
      'ORIGEN'
    );

  const cHabilitada =
    asegurar(
      'COMPRA_HABILITADA'
    );

  if (
    cSku < 0 ||
    cMarca < 0 ||
    cPromedio < 0 ||
    cStock < 0 ||
    cPendiente < 0
  ) {
    throw new Error(
      'MODELO_COMPRAS no contiene SKU, MARCA, PROMEDIO_MENSUAL, STOCK_TOTAL o PENDIENTE_TOTAL.'
    );
  }

  const ultimaFila =
    sh.getLastRow();

  if (
    ultimaFila <=
    filaHeader
  ) {
    return {
      skuProcesados: 0,
      skuHabilitados: 0,
      skuNoCompra: 0,
      skuSinConfig: 0,
      unidadesSugeridas: 0
    };
  }

  const datos =
    sh.getRange(
      filaHeader + 1,
      1,
      ultimaFila - filaHeader,
      ultimaColumna
    )
    .getValues();

  let skuProcesados = 0;
  let skuHabilitados = 0;
  let skuNoCompra = 0;
  let skuSinConfig = 0;
  let unidadesSugeridas = 0;

  datos.forEach(
    function(fila) {

      const sku =
        String(
          fila[cSku] || ''
        ).trim();

      if (!sku) {
        return;
      }

      skuProcesados++;

      const marcaOriginal =
        String(
          fila[cMarca] || ''
        ).trim();

      const marcaResuelta =
        typeof resolverMarcaCompra_ === 'function'
          ? resolverMarcaCompra_(
              marcaOriginal,
              mapaAlias
            )
          : marcaOriginal;

      const marca =
        claveB19_(
          marcaResuelta
        );

      const cfg =
        mapa.get(
          marca
        ) || {
          compra: 'NO',
          origen: 'SIN CONFIGURAR',
          objetivo: 0
        };

      if (
        !mapa.has(
          marca
        )
      ) {
        skuSinConfig++;
      }

      const promedio =
        numeroB19_(
          fila[cPromedio]
        );

      const stock =
        numeroB19_(
          fila[cStock]
        );

      const pendiente =
        numeroB19_(
          fila[cPendiente]
        );

      const habilitada =
        cfg.compra ===
        'SI';

      const coberturaActual =
        promedio > 0
          ? stock /
            promedio
          : 0;

      const coberturaFutura =
        promedio > 0
          ? (
              stock +
              pendiente
            ) /
            promedio
          : 0;

      let compraSugerida =
        0;

      let riesgo =
        '';

      let prioridad =
        0;

      /*
       * B.1.9-B
       * RIESGO describe la situación del SKU.
       * COMPRA_HABILITADA describe la política de compra.
       * Una marca bloqueada puede estar SIN STOCK, URGENTE, etc.,
       * pero su COMPRA_SUGERIDA siempre queda en cero.
       */
      if (
        habilitada
      ) {
        skuHabilitados++;
      } else {
        skuNoCompra++;
      }

      if (
        stock <= 0 &&
        pendiente <= 0
      ) {

        riesgo =
          'SIN STOCK';

        prioridad =
          100;

      } else if (
        promedio <= 0
      ) {

        riesgo =
          'SIN CONSUMO';

        prioridad =
          0;

      } else if (
        coberturaFutura <
        1
      ) {

        riesgo =
          'URGENTE';

        prioridad =
          90;

      } else {

        const necesidadTeorica =
          Math.max(
            0,
            Math.ceil(
              promedio *
              cfg.objetivo -
              stock -
              pendiente
            )
          );

        if (
          necesidadTeorica >
          0
        ) {

          riesgo =
            'COMPRAR';

          prioridad =
            70;

        } else {

          riesgo =
            'OK';

          prioridad =
            10;
        }
      }

      /*
       * La política manda sobre la sugerencia, no sobre el riesgo.
       */
      if (
        habilitada &&
        promedio > 0
      ) {
        compraSugerida =
          Math.max(
            0,
            Math.ceil(
              promedio *
              cfg.objetivo -
              stock -
              pendiente
            )
          );
      }

      unidadesSugeridas +=
        compraSugerida;

      fila[cCobAct] =
        coberturaActual;

      fila[cCobFut] =
        coberturaFutura;

      fila[cObjetivo] =
        cfg.objetivo;

      fila[cCompra] =
        compraSugerida;

      fila[cRiesgo] =
        riesgo;

      fila[cPrioridad] =
        prioridad;

      fila[cOrigen] =
        cfg.origen;

      fila[cHabilitada] =
        habilitada
          ? 'SI'
          : 'NO';
    }
  );

  sh.getRange(
    filaHeader + 1,
    1,
    datos.length,
    ultimaColumna
  ).setValues(
    datos
  );

  return {
    skuProcesados:
      skuProcesados,
    skuHabilitados:
      skuHabilitados,
    skuNoCompra:
      skuNoCompra,
    skuSinConfig:
      skuSinConfig,
    unidadesSugeridas:
      unidadesSugeridas
  };
}


function sincronizarGestionActivaDesdeModeloB19_(
  shModelo,
  shActiva
) {

  const filaHeaderModelo =
    detectarFilaHeaderB19_(
      shModelo
    );

  const datosModelo =
    shModelo
      .getRange(
        filaHeaderModelo,
        1,
        shModelo.getLastRow() -
          filaHeaderModelo +
          1,
        shModelo.getLastColumn()
      )
      .getValues();

  if (
    datosModelo.length < 2
  ) {
    return;
  }

  const hm =
    datosModelo[0]
      .map(
        normalizarB19_
      );

  const im = {};

  hm.forEach(
    function(h, i) {
      im[h] = i;
    }
  );

  const cSkuM =
    buscarB19_(
      im,
      ['SKU']
    );

  if (
    cSkuM < 0
  ) {
    return;
  }

  const mapaModelo =
    new Map();

  for (
    let f = 1;
    f < datosModelo.length;
    f++
  ) {

    const clave =
      claveB19_(
        datosModelo[f][
          cSkuM
        ]
      );

    if (clave) {
      mapaModelo.set(
        clave,
        datosModelo[f]
      );
    }
  }

  let ultimaCol =
    shActiva.getLastColumn();

  let headers =
    shActiva.getRange(
      1,
      1,
      1,
      ultimaCol
    )
    .getDisplayValues()[0]
    .map(
      normalizarB19_
    );

  const asegurar =
    function(nombre) {
      let c =
        headers.indexOf(
          nombre
        );

      if (
        c >= 0
      ) {
        return c;
      }

      ultimaCol++;

      shActiva.getRange(
        1,
        ultimaCol
      ).setValue(
        nombre
      );

      headers.push(
        nombre
      );

      return ultimaCol - 1;
    };

  const ia = {};

  headers.forEach(
    function(h, i) {
      ia[h] = i;
    }
  );

  const cSkuA =
    buscarB19_(
      ia,
      ['SKU']
    );

  if (
    cSkuA < 0
  ) {
    return;
  }

  [
    'RIESGO',
    'PRIORIDAD',
    'COBERTURA_ACTUAL',
    'COBERTURA_FUTURA',
    'COBERTURA_OBJETIVO',
    'COMPRA_SUGERIDA',
    'ORIGEN',
    'COMPRA_HABILITADA'
  ].forEach(
    asegurar
  );

  const datosActiva =
    shActiva
      .getRange(
        2,
        1,
        Math.max(
          shActiva.getLastRow() - 1,
          0
        ),
        ultimaCol
      )
      .getValues();

  if (
    datosActiva.length === 0
  ) {
    return;
  }

  const columnas = [
    'RIESGO',
    'PRIORIDAD',
    'COBERTURA_ACTUAL',
    'COBERTURA_FUTURA',
    'COBERTURA_OBJETIVO',
    'COMPRA_SUGERIDA',
    'ORIGEN',
    'COMPRA_HABILITADA'
  ];

  datosActiva.forEach(
    function(fila) {

      const clave =
        claveB19_(
          fila[cSkuA]
        );

      const modelo =
        mapaModelo.get(
          clave
        );

      if (!modelo) {
        return;
      }

      columnas.forEach(
        function(nombre) {

          const ca =
            headers.indexOf(
              nombre
            );

          const cm =
            hm.indexOf(
              nombre
            );

          if (
            ca >= 0 &&
            cm >= 0
          ) {
            fila[ca] =
              modelo[cm];
          }
        }
      );
    }
  );

  shActiva.getRange(
    2,
    1,
    datosActiva.length,
    ultimaCol
  ).setValues(
    datosActiva
  );
}


function detectarFilaHeaderB19_(
  sh
) {

  const maxFilas =
    Math.min(
      5,
      sh.getLastRow()
    );

  const maxCols =
    sh.getLastColumn();

  const datos =
    sh.getRange(
      1,
      1,
      maxFilas,
      maxCols
    )
    .getDisplayValues();

  for (
    let f = 0;
    f < datos.length;
    f++
  ) {

    const headers =
      datos[f]
        .map(
          normalizarB19_
        );

    if (
      headers.includes(
        'SKU'
      ) &&
      headers.includes(
        'MARCA'
      )
    ) {
      return f + 1;
    }
  }

  throw new Error(
    'No se encontró la fila de encabezados.'
  );
}


function buscarB19_(
  idx,
  nombres
) {

  for (
    const nombre
    of nombres
  ) {
    if (
      Object.prototype
        .hasOwnProperty
        .call(
          idx,
          nombre
        )
    ) {
      return idx[nombre];
    }
  }

  return -1;
}


function normalizarB19_(
  valor
) {

  return String(
    valor || ''
  )
  .trim()
  .toUpperCase()
  .normalize(
    'NFD'
  )
  .replace(
    /[\u0300-\u036f]/g,
    ''
  )
  .replace(
    /[^A-Z0-9]+/g,
    '_'
  )
  .replace(
    /^_+|_+$/g,
    ''
  );
}


function claveB19_(
  valor
) {

  /*
   * B.1.9-B
   * Unificamos la clave de marca con la misma normalización usada
   * por ALIAS_MARCAS_COMPRA: espacios múltiples, NBSP y guiones
   * dejan de provocar falsos SIN CONFIGURAR.
   */
  if (
    typeof normalizarMarcaAlias_ ===
    'function'
  ) {
    return normalizarMarcaAlias_(
      valor
    );
  }

  return String(
    valor || ''
  )
  .replace(/\u00A0/g, ' ')
  .trim()
  .toUpperCase()
  .normalize('NFD')
  .replace(
    /[\u0300-\u036f]/g,
    ''
  )
  .replace(
    /[-–—_]+/g,
    ' '
  )
  .replace(
    /\s+/g,
    ' '
  );
}


function normalizarSiNoB19_(
  valor
) {

  const texto =
    String(
      valor || ''
    )
    .trim()
    .toUpperCase();

  return (
    texto === 'SI' ||
    texto === 'SÍ' ||
    texto === 'YES' ||
    texto === '1' ||
    texto === 'TRUE'
  )
    ? 'SI'
    : 'NO';
}


function numeroB19_(
  valor
) {

  if (
    typeof valor ===
    'number'
  ) {
    return isFinite(
      valor
    )
      ? valor
      : 0;
  }

  let texto =
    String(
      valor || ''
    )
    .trim()
    .replace(
      /\s/g,
      ''
    );

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
      texto =
        texto
          .replace(
            /\./g,
            ''
          )
          .replace(
            ',',
            '.'
          );
    } else {
      texto =
        texto.replace(
          /,/g,
          ''
        );
    }

  } else if (
    texto.includes(',')
  ) {
    texto =
      texto.replace(
        ',',
        '.'
      );
  }

  const n =
    Number(
      texto
    );

  return isFinite(
    n
  )
    ? n
    : 0;
}
