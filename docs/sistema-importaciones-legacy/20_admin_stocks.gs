/**********************************************************************
 * SII - ADMINISTRACIÓN DE STOCK
 * Sprint A.3.1
 * Versión 0.3.100
 *
 * IMPORTANTE
 * ----------
 * Este módulo NO reemplaza guardarStockBam().
 * Reutiliza la función existente guardarStockBam(registros, nombreArchivo).
 *
 * Funcionalidad:
 * - Abre la nueva pantalla Administración de Stock.
 * - Lee la hoja STOCK.
 * - Busca por SKU, marca y depósito.
 * - Devuelve información de última importación por depósito.
 **********************************************************************/

const SII_ADMIN_STOCK = {
  VERSION: '0.3.100',
  HOJA_STOCK: 'STOCK',
  HOJA_CONTROL: 'CONTROL_IMPORTACIONES_STOCK',
  LIMITE_RESULTADOS: 500
};


/**
 * Abre la nueva pantalla de Administración de Stock.
 */
function abrirAdministracionStock() {
  const plantilla =
    HtmlService.createTemplateFromFile(
      'admin_stock'
    );

  plantilla.version =
    SII_ADMIN_STOCK.VERSION;

  const html = plantilla
    .evaluate()
    .setWidth(1200)
    .setHeight(720);

  SpreadsheetApp
    .getUi()
    .showModalDialog(
      html,
      'Administración de Stock'
    );
}


/**
 * Datos iniciales de la pantalla.
 */
function asObtenerInicializacion() {
  const ss =
    SpreadsheetApp.getActive();

  const sh =
    ss.getSheetByName(
      SII_ADMIN_STOCK.HOJA_STOCK
    );

  const controles =
    asObtenerControlImportaciones_(
      ss
    );

  if (!sh || sh.getLastRow() < 2) {
    return {
      ok: true,
      version:
        SII_ADMIN_STOCK.VERSION,
      configurada: Boolean(sh),
      hoja:
        sh ? sh.getName() : '',
      marcas: [],
      depositos: [
        'WARNES',
        'ESCOBAR'
      ],
      controles: controles
    };
  }

  const datos =
    asLeerStock_(sh);

  const marcasMap =
    new Map();

  datos.forEach(function(registro) {
    const marca =
      String(
        registro.marca || ''
      ).trim();

    if (!marca) {
      return;
    }

    const clave =
      asNormalizarTexto_(marca);

    if (!marcasMap.has(clave)) {
      marcasMap.set(
        clave,
        marca
      );
    }
  });

  const marcas =
    Array.from(
      marcasMap.values()
    ).sort(function(a, b) {
      return a.localeCompare(
        b,
        'es',
        {
          sensitivity: 'base'
        }
      );
    });

  return {
    ok: true,
    version:
      SII_ADMIN_STOCK.VERSION,
    configurada: true,
    hoja: sh.getName(),
    marcas: marcas,
    depositos: [
      'WARNES',
      'ESCOBAR'
    ],
    controles: controles
  };
}


/**
 * Busca registros en STOCK.
 */
function asBuscarStock(filtros) {
  const inicio =
    Date.now();

  const ss =
    SpreadsheetApp.getActive();

  const sh =
    ss.getSheetByName(
      SII_ADMIN_STOCK.HOJA_STOCK
    );

  if (!sh) {
    return {
      ok: false,
      mensaje:
        'No existe la hoja STOCK.',
      resultados: [],
      total: 0,
      duracionMs:
        Date.now() - inicio
    };
  }

  const registros =
    asLeerStock_(sh);

  const criterios = {
    sku:
      asNormalizarTexto_(
        filtros && filtros.sku
      ),

    marca:
      asNormalizarTexto_(
        filtros && filtros.marca
      ),

    deposito:
      asNormalizarTexto_(
        filtros && filtros.deposito
      )
  };

  const resultados =
    registros
      .filter(function(registro) {

        if (
          criterios.sku &&
          !asNormalizarTexto_(
            registro.sku
          ).includes(
            criterios.sku
          )
        ) {
          return false;
        }

        if (
          criterios.marca &&
          asNormalizarTexto_(
            registro.marca
          ) !==
          criterios.marca
        ) {
          return false;
        }

        if (
          criterios.deposito &&
          asNormalizarTexto_(
            registro.deposito
          ) !==
          criterios.deposito
        ) {
          return false;
        }

        return true;
      })
      .slice(
        0,
        SII_ADMIN_STOCK
          .LIMITE_RESULTADOS
      );

  return {
    ok: true,
    hoja: sh.getName(),
    resultados: resultados,
    total: resultados.length,
    limite:
      SII_ADMIN_STOCK
        .LIMITE_RESULTADOS,
    duracionMs:
      Date.now() - inicio
  };
}


/**
 * Lee STOCK respetando encabezados actuales.
 */
function asLeerStock_(sh) {
  const ultimaFila =
    sh.getLastRow();

  const ultimaColumna =
    sh.getLastColumn();

  if (
    ultimaFila < 2 ||
    ultimaColumna < 1
  ) {
    return [];
  }

  const datos =
    sh.getRange(
      1,
      1,
      ultimaFila,
      ultimaColumna
    ).getDisplayValues();

  const encabezados =
    datos[0].map(
      asNormalizarEncabezado_
    );

  const indices = {
    sku:
      asBuscarIndice_(
        encabezados,
        [
          'SKU',
          'CODIGO_UNICO'
        ]
      ),

    marca:
      asBuscarIndice_(
        encabezados,
        [
          'MARCA'
        ]
      ),

    codigoViejo:
      asBuscarIndice_(
        encabezados,
        [
          'CODIGO_VIEJO',
          'CODIGO_ANTIGUO'
        ]
      ),

    stock:
      asBuscarIndice_(
        encabezados,
        [
          'STOCK',
          'CANTIDAD',
          'STOCK_DISPONIBLE'
        ]
      ),

    deposito:
      asBuscarIndice_(
        encabezados,
        [
          'DEPOSITO'
        ]
      ),

    fechaImportacion:
      asBuscarIndice_(
        encabezados,
        [
          'FECHA_IMPORTACION'
        ]
      ),

    archivoOrigen:
      asBuscarIndice_(
        encabezados,
        [
          'ARCHIVO_ORIGEN'
        ]
      )
  };

  return datos
    .slice(1)
    .map(function(fila) {
      return {
        sku:
          asValor_(
            fila,
            indices.sku
          ),

        marca:
          asValor_(
            fila,
            indices.marca
          ),

        codigoViejo:
          asValor_(
            fila,
            indices.codigoViejo
          ),

        stock:
          asValor_(
            fila,
            indices.stock
          ),

        deposito:
          asValor_(
            fila,
            indices.deposito
          ),

        fechaImportacion:
          asValor_(
            fila,
            indices.fechaImportacion
          ),

        archivoOrigen:
          asValor_(
            fila,
            indices.archivoOrigen
          )
      };
    })
    .filter(function(registro) {
      return Boolean(
        registro.sku
      );
    });
}


/**
 * Devuelve el control de últimas importaciones.
 */
function asObtenerControlImportaciones_(
  ss
) {
  const sh =
    ss.getSheetByName(
      SII_ADMIN_STOCK.HOJA_CONTROL
    );

  const resultado = {
    WARNES: null,
    ESCOBAR: null
  };

  if (
    !sh ||
    sh.getLastRow() < 2
  ) {
    return resultado;
  }

  const datos =
    sh.getRange(
      1,
      1,
      sh.getLastRow(),
      sh.getLastColumn()
    ).getDisplayValues();

  const encabezados =
    datos[0].map(
      asNormalizarEncabezado_
    );

  const iDeposito =
    asBuscarIndice_(
      encabezados,
      ['DEPOSITO']
    );

  const iFecha =
    asBuscarIndice_(
      encabezados,
      ['ULTIMA_IMPORTACION']
    );

  const iArchivo =
    asBuscarIndice_(
      encabezados,
      ['ARCHIVO']
    );

  const iRegistros =
    asBuscarIndice_(
      encabezados,
      ['REGISTROS']
    );

  datos
    .slice(1)
    .forEach(function(fila) {
      const deposito =
        asNormalizarDeposito_(
          asValor_(
            fila,
            iDeposito
          )
        );

      if (
        deposito !== 'WARNES' &&
        deposito !== 'ESCOBAR'
      ) {
        return;
      }

      resultado[deposito] = {
        deposito: deposito,
        fecha:
          asValor_(
            fila,
            iFecha
          ),
        archivo:
          asValor_(
            fila,
            iArchivo
          ),
        registros:
          asValor_(
            fila,
            iRegistros
          )
      };
    });

  return resultado;
}


/**************************************************************
 * UTILIDADES
 **************************************************************/

function asBuscarIndice_(
  encabezados,
  alternativas
) {
  const candidatas =
    alternativas.map(
      asNormalizarEncabezado_
    );

  for (
    let i = 0;
    i < encabezados.length;
    i++
  ) {
    if (
      candidatas.includes(
        encabezados[i]
      )
    ) {
      return i;
    }
  }

  return -1;
}


function asValor_(
  fila,
  indice
) {
  if (
    indice === -1 ||
    indice === undefined
  ) {
    return '';
  }

  return String(
    fila[indice] || ''
  ).trim();
}


function asNormalizarEncabezado_(
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
    .replace(/\s+/g, '_')
    .replace(
      /[^A-Z0-9_]/g,
      ''
    );
}


function asNormalizarTexto_(
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


function asNormalizarDeposito_(
  valor
) {
  const deposito =
    asNormalizarTexto_(valor);

  if (
    deposito.includes('WARNES')
  ) {
    return 'WARNES';
  }

  if (
    deposito.includes('ESCOBAR')
  ) {
    return 'ESCOBAR';
  }

  return deposito;
}
