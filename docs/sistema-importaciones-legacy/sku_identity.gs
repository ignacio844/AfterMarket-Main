/**************************************************************
 * SII V6.4.001
 * SERVICIO DE IDENTIDAD DE SKU
 *
 * Objetivo:
 * - Resolver cualquier código conocido al SKU BAM canónico.
 * - Evitar lógica duplicada en Ficha SKU, Centro de Compras,
 *   importaciones, ventas y futuros módulos.
 *
 * Fuentes:
 * - EQUIVALENCIAS_SKU
 * - VENTAS
 * - PRODUCTOS
 * - PLAN_COMPRAS
 * - STOCK
 *
 * Funciones públicas:
 * - skuIdentityResolver(codigo)
 * - skuIdentityResolverLista(codigos)
 * - skuIdentityConstruirIndice(force)
 * - skuIdentityLimpiarCache()
 * - skuIdentityProbar(codigo)
 *
 * Resultado:
 * {
 *   entrada,
 *   skuCanonico,
 *   encontrado,
 *   origen,
 *   confianza,
 *   ambiguo,
 *   candidatos,
 *   aliases,
 *   datos
 * }
 **************************************************************/

let SII_SKU_IDENTITY_MEMORIA_ = null;

const SII_SKU_IDENTITY_V64001 = {
  VERSION: '6.4.001',

  CACHE_KEY:
    'SII_SKU_IDENTITY_INDEX_V64001',

  CACHE_SEGUNDOS:
    900,

  HOJAS: {
    EQUIVALENCIAS:
      'EQUIVALENCIAS_SKU',

    VENTAS:
      'VENTAS',

    PRODUCTOS:
      'PRODUCTOS',

    PLAN:
      'PLAN_COMPRAS',

    STOCK:
      'STOCK'
  },

  CAMPOS_CANONICOS: [
    'SKU',
    'COD_BAM',
    'SKU_BAM',
    'SKU_DESTINO'
  ],

  CAMPOS_ALIAS: [
    'ITEM',
    'CODIGO',
    'CODIGO_PROVEEDOR',
    'SKU_ORIGEN',
    'SKU_ANTERIOR',
    'CODIGO_COMERCIAL',
    'EAN',
    'CODIGO_BARRAS'
  ]
};


/**
 * Resuelve un código al SKU BAM canónico.
 */
function skuIdentityResolver(
  codigo
) {
  const entrada =
    sidTexto_(codigo);

  if (!entrada) {
    return sidResultadoVacio_(
      entrada
    );
  }

  const claveEntrada =
    sidClave_(entrada);

  const indice =
    skuIdentityConstruirIndice(
      false
    );

  /*
   * 1. Coincidencia exacta.
   */
  if (
    indice.aliasACanonico[
      claveEntrada
    ]
  ) {
    const canonicos =
      indice.aliasACanonico[
        claveEntrada
      ];

    if (
      canonicos.length === 1
    ) {
      const canonicoExacto =
        canonicos[0];

      /*
       * PLAN_COMPRAS puede contener simultáneamente un código
       * comercial corto y el SKU BAM largo como si fueran dos SKU.
       * Si la coincidencia exacta apunta al mismo código ingresado,
       * se busca un único SKU canónico más largo que termine en él.
       */
      if (
        sidClave_(
          canonicoExacto
        ) === claveEntrada
      ) {
        const candidatoLargo =
          sidBuscarCanonicoPorSufijo_(
            claveEntrada,
            indice
          );

        if (
          candidatoLargo &&
          sidClave_(
            candidatoLargo
          ) !== claveEntrada
        ) {
          return sidConstruirResultado_(
            entrada,
            candidatoLargo,
            indice,
            'SUFIJO_UNICO_SOBRE_EXACTO',
            90,
            false,
            [
              candidatoLargo
            ]
          );
        }
      }

      return sidConstruirResultado_(
        entrada,
        canonicoExacto,
        indice,
        'COINCIDENCIA_EXACTA',
        100,
        false,
        canonicos
      );
    }

    /*
     * V6.4: si el mismo alias quedó registrado como SKU corto en
     * PLAN_COMPRAS y como alias de un SKU BAM operativo, se elige
     * el único canónico operativo más largo que termina en la entrada.
     *
     * Ejemplo:
     *   IR100-H1     (PLAN_COMPRAS)
     *   IROIR100-H1  (VENTAS)
     */
    const preferidoExacto =
      sidSeleccionarCanonicoPreferidoExacto_(
        claveEntrada,
        canonicos,
        indice
      );

    if (preferidoExacto) {
      return sidConstruirResultado_(
        entrada,
        preferidoExacto,
        indice,
        'ALIAS_OPERATIVO_PRIORIZADO',
        95,
        false,
        canonicos
      );
    }

    return sidConstruirResultado_(
      entrada,
      '',
      indice,
      'AMBIGUO_EXACTO',
      0,
      true,
      canonicos
    );
  }

  /*
   * 2. Coincidencia única por sufijo.
   * Ejemplo:
   * DJ1012SPEP -> LUXDJ1012SPEP
   */
  const candidatoSufijo =
    sidBuscarCanonicoPorSufijo_(
      claveEntrada,
      indice
    );

  const candidatosSufijo =
    candidatoSufijo
      ? [candidatoSufijo]
      : sidBuscarCandidatosSufijo_(
          claveEntrada,
          indice
        );

  if (
    candidatosSufijo.length === 1
  ) {
    return sidConstruirResultado_(
      entrada,
      candidatosSufijo[0],
      indice,
      'SUFIJO_UNICO',
      85,
      false,
      candidatosSufijo
    );
  }

  if (
    candidatosSufijo.length > 1
  ) {
    return sidConstruirResultado_(
      entrada,
      '',
      indice,
      'AMBIGUO_POR_SUFIJO',
      0,
      true,
      candidatosSufijo
    );
  }

  /*
   * 3. Si ya parece un SKU BAM y aparece como canónico.
   */
  if (
    indice.datosCanonicos[
      claveEntrada
    ]
  ) {
    return sidConstruirResultado_(
      entrada,
      indice.datosCanonicos[
        claveEntrada
      ].skuCanonico,
      indice,
      'SKU_CANONICO',
      100,
      false,
      [
        indice.datosCanonicos[
          claveEntrada
        ].skuCanonico
      ]
    );
  }

  return sidConstruirResultado_(
    entrada,
    entrada,
    indice,
    'SIN_EQUIVALENCIA',
    20,
    false,
    []
  );
}


/**
 * Resuelve varios códigos sin reconstruir el índice.
 */
function skuIdentityResolverLista(
  codigos
) {
  const lista =
    Array.isArray(codigos)
      ? codigos
      : [];

  return lista.map(
    codigo =>
      skuIdentityResolver(
        codigo
      )
  );
}


/**
 * Construye el índice de identidad.
 */
function skuIdentityConstruirIndice(
  force
) {
  /*
   * Cache en memoria de la ejecución actual.
   * El índice completo supera el límite de CacheService,
   * por eso no se intenta guardar como un único valor.
   */
  if (
    !force &&
    SII_SKU_IDENTITY_MEMORIA_
  ) {
    return SII_SKU_IDENTITY_MEMORIA_;
  }

  const ss =
    SpreadsheetApp.getActive();

  const indice = {
    version:
      SII_SKU_IDENTITY_V64001.VERSION,

    generadoEn:
      new Date().toISOString(),

    aliasACanonico: {},

    aliasesPorCanonico: {},

    datosCanonicos: {},

    canonicos: [],

    conflictos: []
  };

  sidProcesarProductos_(
    ss,
    indice
  );

  sidProcesarPlan_(
    ss,
    indice
  );

  sidProcesarStock_(
    ss,
    indice
  );

  sidProcesarVentas_(
    ss,
    indice
  );

  sidProcesarEquivalencias_(
    ss,
    indice
  );

  indice.canonicos =
    Object.keys(
      indice.datosCanonicos
    )
      .map(
        clave =>
          indice.datosCanonicos[
            clave
          ].skuCanonico
      )
      .filter(Boolean)
      .sort();

  sidDetectarConflictos_(
    indice
  );

  SII_SKU_IDENTITY_MEMORIA_ =
    indice;

  return indice;
}


/**
 * Limpia el cache del servicio.
 */
function skuIdentityLimpiarCache() {
  SII_SKU_IDENTITY_MEMORIA_ =
    null;

  try {
    CacheService
      .getDocumentCache()
      .remove(
        SII_SKU_IDENTITY_V64001
          .CACHE_KEY
      );
  } catch (error) {}

  SpreadsheetApp
    .getActive()
    .toast(
      'Cache de identidad SKU limpiado.',
      'SKU Identity',
      4
    );
}


/**
 * Prueba rápida.
 */
function skuIdentityProbar(
  codigo
) {
  const entrada =
    sidTexto_(codigo) ||
    'IROIR100-H1';

  const resultado =
    skuIdentityResolver(
      entrada
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
      entrada +
      ' → ' +
      resultado.skuCanonico,
      'SKU Identity',
      6
    );

  return resultado;
}


/**
 * Diagnóstico V6.4 para validar la relación entre un código corto
 * y su SKU BAM. No modifica datos.
 */
function skuIdentityProbarV64000() {
  skuIdentityLimpiarCache();

  const pruebas = [
    'IR100-H1',
    'HX  IR100-H1',
    'IROIR100-H1'
  ];

  const resultados =
    pruebas.map(codigo =>
      skuIdentityResolver(codigo)
    );

  Logger.log(
    JSON.stringify(
      resultados,
      null,
      2
    )
  );

  return resultados;
}


/**************************************************************
 * FUENTES
 **************************************************************/

function sidProcesarProductos_(
  ss,
  indice
) {
  const filas =
    sidLeerHoja_(
      ss,
      sidNombreHoja_(
        'PRODUCTOS',
        SII_SKU_IDENTITY_V64001
          .HOJAS.PRODUCTOS
      )
    );

  filas.forEach(reg => {
    const canonico =
      sidPrimerTexto_(
        reg.SKU,
        reg.COD_BAM,
        reg.SKU_BAM
      );

    if (!canonico) {
      return;
    }

    sidRegistrarCanonico_(
      indice,
      canonico,
      {
        descripcion:
          sidPrimerTexto_(
            reg.DESCRIPCION
          ),

        marca:
          sidPrimerTexto_(
            reg.MARCA
          ),

        proveedor:
          sidPrimerTexto_(
            reg.PROVEEDOR
          ),

        fuente:
          'PRODUCTOS'
      }
    );

    sidRegistrarAlias_(
      indice,
      canonico,
      canonico,
      'PRODUCTOS'
    );

    SII_SKU_IDENTITY_V64001
      .CAMPOS_ALIAS
      .forEach(campo => {
        sidRegistrarAlias_(
          indice,
          reg[campo],
          canonico,
          'PRODUCTOS'
        );
      });
  });
}


function sidProcesarPlan_(
  ss,
  indice
) {
  const filas =
    sidLeerHoja_(
      ss,
      sidNombreHoja_(
        'PLAN_COMPRAS',
        SII_SKU_IDENTITY_V64001
          .HOJAS.PLAN
      )
    );

  filas.forEach(reg => {
    const canonico =
      sidPrimerTexto_(
        reg.SKU,
        reg.COD_BAM,
        reg.SKU_BAM
      );

    if (!canonico) {
      return;
    }

    sidRegistrarCanonico_(
      indice,
      canonico,
      {
        descripcion:
          sidPrimerTexto_(
            reg.DESCRIPCION
          ),

        marca:
          sidPrimerTexto_(
            reg.MARCA
          ),

        proveedor:
          sidPrimerTexto_(
            reg.PROVEEDOR
          ),

        fuente:
          'PLAN_COMPRAS'
      }
    );

    sidRegistrarAlias_(
      indice,
      canonico,
      canonico,
      'PLAN_COMPRAS'
    );
  });
}


function sidProcesarStock_(
  ss,
  indice
) {
  const filas =
    sidLeerHoja_(
      ss,
      sidNombreHoja_(
        'STOCK',
        SII_SKU_IDENTITY_V64001
          .HOJAS.STOCK
      )
    );

  filas.forEach(reg => {
    const canonico =
      sidPrimerTexto_(
        reg.SKU,
        reg.COD_BAM,
        reg.SKU_BAM
      );

    if (!canonico) {
      return;
    }

    sidRegistrarCanonico_(
      indice,
      canonico,
      {
        marca:
          sidPrimerTexto_(
            reg.MARCA
          ),

        fuente:
          'STOCK'
      }
    );

    sidRegistrarAlias_(
      indice,
      canonico,
      canonico,
      'STOCK'
    );
  });
}


function sidProcesarVentas_(
  ss,
  indice
) {
  const filas =
    sidLeerHoja_(
      ss,
      sidNombreHoja_(
        'VENTAS',
        SII_SKU_IDENTITY_V64001
          .HOJAS.VENTAS
      )
    );

  filas.forEach(reg => {
    const canonico =
      sidPrimerTexto_(
        reg.COD_BAM,
        reg.SKU_BAM,
        reg.SKU
      );

    if (!canonico) {
      return;
    }

    sidRegistrarCanonico_(
      indice,
      canonico,
      {
        descripcion:
          sidPrimerTexto_(
            reg.DESCRIPCION
          ),

        fuente:
          'VENTAS'
      }
    );

    /*
     * El Cod_BAM siempre se conserva como alias exacto.
     */
    sidRegistrarAlias_(
      indice,
      canonico,
      canonico,
      'VENTAS'
    );

    /*
     * V6.4: además del valor original, se registran variantes
     * seguras de los códigos comerciales/proveedor.
     *
     * Ejemplo real:
     *   Código:  HX  IR100-H1
     *   Cod_BAM: IROIR100-H1
     *
     * Se registran como alias del Cod_BAM:
     *   HX  IR100-H1
     *   IR100-H1
     *
     * La variante corta solo se acepta cuando su clave es
     * sufijo del Cod_BAM, evitando quitar prefijos de forma libre.
     */
    [
      reg.CODIGO,
      reg.CODIGO_PROVEEDOR,
      reg.ITEM,
      reg.SKU
    ].forEach(alias => {
      sidRegistrarAliasExpandido_(
        indice,
        alias,
        canonico,
        'VENTAS'
      );
    });
  });
}


function sidProcesarEquivalencias_(
  ss,
  indice
) {
  const filas =
    sidLeerHoja_(
      ss,
      sidNombreHoja_(
        'EQUIVALENCIAS_SKU',
        SII_SKU_IDENTITY_V64001
          .HOJAS.EQUIVALENCIAS
      )
    );

  filas.forEach(reg => {
    const canonico =
      sidPrimerTexto_.apply(
        null,
        SII_SKU_IDENTITY_V64001
          .CAMPOS_CANONICOS
          .map(
            campo => reg[campo]
          )
      );

    if (!canonico) {
      return;
    }

    sidRegistrarCanonico_(
      indice,
      canonico,
      {
        descripcion:
          sidPrimerTexto_(
            reg.DESCRIPCION
          ),

        marca:
          sidPrimerTexto_(
            reg.MARCA
          ),

        proveedor:
          sidPrimerTexto_(
            reg.PROVEEDOR
          ),

        fuente:
          'EQUIVALENCIAS_SKU'
      }
    );

    sidRegistrarAlias_(
      indice,
      canonico,
      canonico,
      'EQUIVALENCIAS_SKU'
    );

    SII_SKU_IDENTITY_V64001
      .CAMPOS_ALIAS
      .forEach(campo => {
        sidRegistrarAlias_(
          indice,
          reg[campo],
          canonico,
          'EQUIVALENCIAS_SKU'
        );
      });
  });
}


/**************************************************************
 * REGISTRO DEL ÍNDICE
 **************************************************************/

function sidRegistrarCanonico_(
  indice,
  skuCanonico,
  datos
) {
  const sku =
    sidTexto_(
      skuCanonico
    );

  const clave =
    sidClave_(sku);

  if (!clave) {
    return;
  }

  if (
    !indice.datosCanonicos[
      clave
    ]
  ) {
    indice.datosCanonicos[
      clave
    ] = {
      skuCanonico:
        sku,

      descripcion:
        '',

      marca:
        '',

      proveedor:
        '',

      fuentes:
        []
    };
  }

  const actual =
    indice.datosCanonicos[
      clave
    ];

  actual.descripcion =
    sidPrimerTexto_(
      actual.descripcion,
      datos &&
      datos.descripcion
    );

  actual.marca =
    sidPrimerTexto_(
      actual.marca,
      datos &&
      datos.marca
    );

  actual.proveedor =
    sidPrimerTexto_(
      actual.proveedor,
      datos &&
      datos.proveedor
    );

  const fuente =
    datos &&
    datos.fuente
      ? datos.fuente
      : '';

  if (
    fuente &&
    !actual.fuentes.includes(
      fuente
    )
  ) {
    actual.fuentes.push(
      fuente
    );
  }

  if (
    !indice.aliasesPorCanonico[
      clave
    ]
  ) {
    indice.aliasesPorCanonico[
      clave
    ] = [];
  }
}


function sidRegistrarAlias_(
  indice,
  alias,
  skuCanonico,
  fuente
) {
  const aliasTexto =
    sidTexto_(alias);

  const canonico =
    sidTexto_(
      skuCanonico
    );

  const claveAlias =
    sidClave_(
      aliasTexto
    );

  const claveCanonica =
    sidClave_(
      canonico
    );

  if (
    !claveAlias ||
    !claveCanonica
  ) {
    return;
  }

  sidRegistrarCanonico_(
    indice,
    canonico,
    {
      fuente:
        fuente
    }
  );

  if (
    !indice.aliasACanonico[
      claveAlias
    ]
  ) {
    indice.aliasACanonico[
      claveAlias
    ] = [];
  }

  /*
   * V6.4.001:
   * Los SKU no son case sensitive.
   *
   * La lista conserva un valor visible original, pero la existencia
   * se compara siempre mediante sidClave_(). Esto evita considerar
   * distintos a:
   *
   *   3M_61753
   *   3m_61753
   */
  const existeCanonico =
    indice.aliasACanonico[
      claveAlias
    ].some(item =>
      sidClave_(item) ===
      claveCanonica
    );

  if (!existeCanonico) {
    indice.aliasACanonico[
      claveAlias
    ].push(
      canonico
    );
  }

  /*
   * Los alias también se deduplican por clave normalizada.
   * Se mantiene la primera representación visible encontrada.
   */
  const existeAlias =
    indice.aliasesPorCanonico[
      claveCanonica
    ].some(item =>
      sidClave_(item) ===
      claveAlias
    );

  if (!existeAlias) {
    indice.aliasesPorCanonico[
      claveCanonica
    ].push(
      aliasTexto
    );
  }
}


/**
 * Registra el alias original y sus variantes seguras.
 *
 * No crea equivalencias por simple semejanza. Una variante reducida
 * solo se registra si coincide con el final del SKU canónico.
 */
function sidRegistrarAliasExpandido_(
  indice,
  alias,
  skuCanonico,
  fuente
) {
  const variantes =
    sidGenerarVariantesAlias_(
      alias,
      skuCanonico
    );

  variantes.forEach(variante => {
    sidRegistrarAlias_(
      indice,
      variante,
      skuCanonico,
      fuente
    );
  });
}


/**
 * Genera variantes conservadoras de un código.
 *
 * Casos admitidos:
 * - valor original;
 * - texto desde el segundo bloque separado por espacios;
 * - texto posterior a separadores como ':' o '=';
 * - sufijo alfanumérico del canónico cuando está contenido en el alias.
 */
function sidGenerarVariantesAlias_(
  alias,
  skuCanonico
) {
  const original =
    sidTexto_(alias);

  const canonico =
    sidTexto_(skuCanonico);

  if (!original) {
    return [];
  }

  const variantes = [];

  function agregar_(valor) {
    const texto =
      sidTexto_(valor);

    if (!texto) {
      return;
    }

    const clave =
      sidClave_(texto);

    if (!clave) {
      return;
    }

    const existe =
      variantes.some(item =>
        sidClave_(item) === clave
      );

    if (!existe) {
      variantes.push(texto);
    }
  }

  agregar_(original);

  const bloques =
    original
      .split(/\s+/)
      .filter(Boolean);

  if (bloques.length > 1) {
    for (
      let i = 1;
      i < bloques.length;
      i++
    ) {
      const candidato =
        bloques.slice(i).join(' ');

      if (
        sidVarianteCompatibleConCanonico_(
          candidato,
          canonico
        )
      ) {
        agregar_(candidato);
      }
    }
  }

  const partesSeparador =
    original.split(/[:=|]/);

  if (partesSeparador.length > 1) {
    partesSeparador
      .slice(1)
      .forEach(parte => {
        if (
          sidVarianteCompatibleConCanonico_(
            parte,
            canonico
          )
        ) {
          agregar_(parte);
        }
      });
  }

  return variantes;
}


/**
 * Una variante reducida es válida cuando:
 * - tiene al menos 4 caracteres alfanuméricos;
 * - es distinta del canónico;
 * - el SKU canónico termina exactamente con esa variante.
 */
function sidVarianteCompatibleConCanonico_(
  variante,
  skuCanonico
) {
  const claveVariante =
    sidClave_(variante);

  const claveCanonica =
    sidClave_(skuCanonico);

  if (
    !claveVariante ||
    !claveCanonica ||
    claveVariante.length < 4 ||
    claveVariante === claveCanonica
  ) {
    return false;
  }

  return claveCanonica.endsWith(
    claveVariante
  );
}


function sidDetectarConflictos_(
  indice
) {
  Object.keys(
    indice.aliasACanonico
  ).forEach(claveAlias => {
    const canonicos =
      sidUnicosPorClave_(
        indice.aliasACanonico[
          claveAlias
        ]
      );

    /*
     * Se reemplaza también la lista original por su versión
     * consolidada para que el resolver nunca reciba falsos ambiguos.
     */
    indice.aliasACanonico[
      claveAlias
    ] = canonicos;

    if (
      canonicos.length > 1
    ) {
      indice.conflictos.push({
        alias:
          claveAlias,

        canonicos:
          canonicos
      });
    }
  });
}


/**************************************************************
 * RESOLUCIÓN POR SUFIJO
 **************************************************************/

/**
 * Resuelve una ambigüedad exacta creada por fuentes con distinto nivel
 * de autoridad. Solo elige automáticamente cuando existe un único SKU
 * operativo más largo cuyo final coincide con la entrada.
 */
function sidSeleccionarCanonicoPreferidoExacto_(
  claveEntrada,
  canonicos,
  indice
) {
  const candidatos =
    (canonicos || [])
      .filter(canonico => {
        const claveCanonica =
          sidClave_(canonico);

        if (
          !claveCanonica ||
          claveCanonica === claveEntrada ||
          !claveCanonica.endsWith(
            claveEntrada
          )
        ) {
          return false;
        }

        const datos =
          indice.datosCanonicos[
            claveCanonica
          ];

        const fuentes =
          datos &&
          Array.isArray(
            datos.fuentes
          )
            ? datos.fuentes
            : [];

        return fuentes.some(fuente =>
          fuente === 'EQUIVALENCIAS_SKU' ||
          fuente === 'PRODUCTOS' ||
          fuente === 'VENTAS' ||
          fuente === 'STOCK'
        );
      });

  const unicos =
    Array.from(
      new Set(candidatos)
    );

  return unicos.length === 1
    ? unicos[0]
    : '';
}


function sidBuscarCanonicoPorSufijo_(
  claveEntrada,
  indice
) {
  const candidatos =
    sidBuscarCandidatosSufijo_(
      claveEntrada,
      indice
    );

  if (
    candidatos.length !== 1
  ) {
    return '';
  }

  return candidatos[0];
}


function sidBuscarCandidatosSufijo_(
  claveEntrada,
  indice
) {
  const candidatos =
    indice.canonicos.filter(
      skuCanonico => {
        const claveCanonica =
          sidClave_(
            skuCanonico
          );

        if (
          !claveCanonica ||
          claveCanonica ===
            claveEntrada ||
          !claveCanonica.endsWith(
            claveEntrada
          ) ||
          (
            claveCanonica.length -
            claveEntrada.length
          ) > 10
        ) {
          return false;
        }

        /*
         * Da prioridad a SKU presentes en fuentes operativas.
         * Evita tomar como destino otro alias aislado.
         */
        const datos =
          indice.datosCanonicos[
            claveCanonica
          ];

        const fuentes =
          datos &&
          Array.isArray(
            datos.fuentes
          )
            ? datos.fuentes
            : [];

        return fuentes.some(
          fuente =>
            fuente === 'STOCK' ||
            fuente === 'VENTAS' ||
            fuente === 'PRODUCTOS' ||
            fuente === 'EQUIVALENCIAS_SKU'
        );
      }
    );

  return Array.from(
    new Set(candidatos)
  );
}


/**************************************************************
 * RESULTADOS
 **************************************************************/

function sidConstruirResultado_(
  entrada,
  skuCanonico,
  indice,
  origen,
  confianza,
  ambiguo,
  candidatos
) {
  const claveCanonica =
    sidClave_(
      skuCanonico
    );

  const datos =
    claveCanonica &&
    indice.datosCanonicos[
      claveCanonica
    ]
      ? indice.datosCanonicos[
          claveCanonica
        ]
      : {
          skuCanonico:
            skuCanonico,

          descripcion:
            '',

          marca:
            '',

          proveedor:
            '',

          fuentes:
            []
        };

  return {
    version:
      SII_SKU_IDENTITY_V64001.VERSION,

    entrada:
      entrada,

    skuCanonico:
      skuCanonico,

    encontrado:
      Boolean(
        skuCanonico &&
        origen !==
          'SIN_EQUIVALENCIA'
      ),

    origen:
      origen,

    confianza:
      confianza,

    ambiguo:
      Boolean(ambiguo),

    candidatos:
      candidatos || [],

    aliases:
      claveCanonica &&
      indice.aliasesPorCanonico[
        claveCanonica
      ]
        ? indice.aliasesPorCanonico[
            claveCanonica
          ]
        : [],

    datos: {
      descripcion:
        datos.descripcion || '',

      marca:
        datos.marca || '',

      proveedor:
        datos.proveedor || '',

      fuentes:
        datos.fuentes || []
    }
  };
}


function sidResultadoVacio_(
  entrada
) {
  return {
    version:
      SII_SKU_IDENTITY_V64001.VERSION,

    entrada:
      entrada,

    skuCanonico:
      '',

    encontrado:
      false,

    origen:
      'ENTRADA_VACIA',

    confianza:
      0,

    ambiguo:
      false,

    candidatos:
      [],

    aliases:
      [],

    datos: {
      descripcion: '',
      marca: '',
      proveedor: '',
      fuentes: []
    }
  };
}


/**************************************************************
 * LECTURA DE HOJAS
 **************************************************************/

function sidLeerHoja_(
  ss,
  nombre
) {
  const sh =
    ss.getSheetByName(
      nombre
    );

  if (!sh) {
    return [];
  }

  const datos =
    sh.getDataRange()
      .getValues();

  if (datos.length < 2) {
    return [];
  }

  const encabezados =
    datos[0].map(
      sidNormalizarEncabezado_
    );

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


function sidNombreHoja_(
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


/**************************************************************
 * UTILIDADES
 **************************************************************/

function sidTexto_(
  valor
) {
  return String(
    valor === null ||
    valor === undefined
      ? ''
      : valor
  ).trim();
}


function sidClave_(
  valor
) {
  return sidTexto_(valor)
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
}


function sidNormalizarEncabezado_(
  valor
) {
  return sidTexto_(valor)
    .normalize('NFD')
    .replace(
      /[\u0300-\u036f]/g,
      ''
    )
    .toUpperCase()
    .replace(/\s+/g, '_');
}



/**
 * Devuelve una lista sin duplicados según la clave normalizada.
 * La primera representación visible de cada SKU se conserva.
 */
function sidUnicosPorClave_(
  valores
) {
  const resultado = [];
  const claves = {};

  (
    Array.isArray(valores)
      ? valores
      : []
  ).forEach(valor => {
    const texto =
      sidTexto_(valor);

    const clave =
      sidClave_(texto);

    if (
      !clave ||
      claves[clave]
    ) {
      return;
    }

    claves[clave] = true;
    resultado.push(texto);
  });

  return resultado;
}


/**
 * Regla central de identidad:
 * dos códigos son iguales cuando su clave normalizada coincide.
 */
function sidMismaClave_(
  codigoA,
  codigoB
) {
  const claveA =
    sidClave_(codigoA);

  const claveB =
    sidClave_(codigoB);

  return Boolean(
    claveA &&
    claveB &&
    claveA === claveB
  );
}


/**
 * Prueba mínima de regresión V6.4.001.
 */
function skuIdentityProbarCaseInsensitiveV64001() {
  skuIdentityLimpiarCache();

  const codigoMayuscula =
    '3M_61753';

  const codigoMinuscula =
    '3m_61753';

  const resultado = {
    mismaClave:
      sidMismaClave_(
        codigoMayuscula,
        codigoMinuscula
      ),

    mayuscula:
      skuIdentityResolver(
        codigoMayuscula
      ),

    minuscula:
      skuIdentityResolver(
        codigoMinuscula
      )
  };

  Logger.log(
    JSON.stringify(
      resultado,
      null,
      2
    )
  );

  if (
    !resultado.mismaClave
  ) {
    throw new Error(
      'Falló la comparación case-insensitive.'
    );
  }

  if (
    resultado.mayuscula.ambiguo ||
    resultado.minuscula.ambiguo
  ) {
    throw new Error(
      'Se detectó una falsa ambigüedad por mayúsculas/minúsculas.'
    );
  }

  SpreadsheetApp
    .getActive()
    .toast(
      'Prueba case-insensitive correcta.',
      'SKU Identity V6.4.001',
      6
    );

  return resultado;
}


function sidPrimerTexto_() {
  for (
    let i = 0;
    i < arguments.length;
    i++
  ) {
    const valor =
      sidTexto_(
        arguments[i]
      );

    if (valor) {
      return valor;
    }
  }

  return '';
}
