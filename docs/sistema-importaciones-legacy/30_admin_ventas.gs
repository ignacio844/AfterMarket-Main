/**********************************************************************
 * SII - ADMINISTRACIÓN DE VENTAS
 * Sprint A.4.1
 * Versión 0.4.100
 *
 * IMPORTANTE
 * ----------
 * Este módulo NO reemplaza importarVentasNuevoFormato().
 * Reutiliza la función existente importarVentasNuevoFormato(payload).
 *
 * Funcionalidad:
 * - Abre Administración de Ventas.
 * - Lee la hoja VENTAS.
 * - Busca por SKU, descripción y marca.
 * - La marca se obtiene desde STOCK por SKU.
 * - Informa la última importación detectada en VENTAS.
 **********************************************************************/

const SII_ADMIN_VENTAS = {
  VERSION: '0.4.100',
  HOJA_VENTAS: 'VENTAS',
  HOJA_STOCK: 'STOCK',
  LIMITE_RESULTADOS: 500
};


function abrirAdministracionVentas() {
  const plantilla =
    HtmlService.createTemplateFromFile(
      'admin_ventas'
    );

  plantilla.version =
    SII_ADMIN_VENTAS.VERSION;

  const html = plantilla
    .evaluate()
    .setWidth(1200)
    .setHeight(720);

  SpreadsheetApp
    .getUi()
    .showModalDialog(
      html,
      'Administración de Ventas'
    );
}


function avObtenerInicializacion() {
  const ss =
    SpreadsheetApp.getActive();

  const shVentas =
    ss.getSheetByName(
      SII_ADMIN_VENTAS.HOJA_VENTAS
    );

  const mapaMarcas =
    avConstruirMapaMarcaPorSku_(ss);

  const marcasMap =
    new Map();

  mapaMarcas.forEach(function(marca) {
    const texto =
      String(marca || '').trim();

    if (!texto) {
      return;
    }

    const clave =
      avNormalizarTexto_(texto);

    if (!marcasMap.has(clave)) {
      marcasMap.set(
        clave,
        texto
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
      SII_ADMIN_VENTAS.VERSION,
    configurada:
      Boolean(shVentas),
    hoja:
      shVentas
        ? shVentas.getName()
        : '',
    marcas: marcas,
    ultimaImportacion:
      avObtenerUltimaImportacion_(
        shVentas
      )
  };
}


function avBuscarVentas(filtros) {
  const inicio =
    Date.now();

  const ss =
    SpreadsheetApp.getActive();

  const sh =
    ss.getSheetByName(
      SII_ADMIN_VENTAS.HOJA_VENTAS
    );

  if (!sh) {
    return {
      ok: false,
      mensaje:
        'No existe la hoja VENTAS.',
      resultados: [],
      total: 0,
      duracionMs:
        Date.now() - inicio
    };
  }

  const marcaPorSku =
    avConstruirMapaMarcaPorSku_(ss);

  const registros =
    avLeerVentas_(
      sh,
      marcaPorSku
    );

  const criterios = {
    sku:
      avNormalizarTexto_(
        filtros && filtros.sku
      ),

    descripcion:
      avNormalizarTexto_(
        filtros && filtros.descripcion
      ),

    marca:
      avNormalizarTexto_(
        filtros && filtros.marca
      )
  };

  const resultados =
    registros
      .filter(function(registro) {

        if (
          criterios.sku &&
          !avNormalizarTexto_(
            registro.sku
          ).includes(
            criterios.sku
          )
        ) {
          return false;
        }

        if (
          criterios.descripcion &&
          !avNormalizarTexto_(
            registro.descripcion
          ).includes(
            criterios.descripcion
          )
        ) {
          return false;
        }

        if (
          criterios.marca &&
          avNormalizarTexto_(
            registro.marca
          ) !==
          criterios.marca
        ) {
          return false;
        }

        return true;
      })
      .slice(
        0,
        SII_ADMIN_VENTAS
          .LIMITE_RESULTADOS
      );

  return {
    ok: true,
    hoja: sh.getName(),
    resultados: resultados,
    total: resultados.length,
    limite:
      SII_ADMIN_VENTAS
        .LIMITE_RESULTADOS,
    duracionMs:
      Date.now() - inicio
  };
}


function avLeerVentas_(
  sh,
  marcaPorSku
) {
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
      avNormalizarEncabezado_
    );

  const iCodigo =
    avBuscarIndice_(
      encabezados,
      ['CODIGO']
    );

  const iSku =
    avBuscarIndice_(
      encabezados,
      [
        'COD_BAM',
        'CODBAM',
        'SKU'
      ]
    );

  const iDescripcion =
    avBuscarIndice_(
      encabezados,
      [
        'DESCRIPCION'
      ]
    );

  const iTotalUnidades =
    avBuscarIndice_(
      encabezados,
      [
        'TOTAL_UNIDADES_NETAS'
      ]
    );

  const iTotalFacturado =
    avBuscarIndice_(
      encabezados,
      [
        'TOTAL_FACTURADO_NETO_S_IVA'
      ]
    );

  const iArchivo =
    avBuscarIndice_(
      encabezados,
      [
        'ARCHIVO_ORIGEN'
      ]
    );

  const iFecha =
    avBuscarIndice_(
      encabezados,
      [
        'FECHA_IMPORTACION'
      ]
    );

  const meses =
    encabezados
      .map(function(encabezado, indice) {
        const match =
          encabezado.match(
            /^(ENE|FEB|MAR|ABR|MAY|JUN|JUL|AGO|SEP|OCT|NOV|DIC)_(\d{4})$/
          );

        return match
          ? {
              encabezado:
                encabezado,
              indice:
                indice,
              orden:
                avOrdenPeriodo_(
                  encabezado
                )
            }
          : null;
      })
      .filter(Boolean)
      .sort(function(a, b) {
        return a.orden - b.orden;
      });

  const ultimos12 =
    meses.slice(
      Math.max(
        meses.length - 12,
        0
      )
    );

  return datos
    .slice(1)
    .map(function(fila) {
      const sku =
        avValor_(
          fila,
          iSku
        );

      if (!sku) {
        return null;
      }

      let consumo12 = 0;
      let mesesConDato = 0;

      ultimos12.forEach(
        function(mes) {
          const valor =
            avNumero_(
              fila[
                mes.indice
              ]
            );

          consumo12 += valor;

          if (
            String(
              fila[
                mes.indice
              ] || ''
            ).trim() !== ''
          ) {
            mesesConDato++;
          }
        }
      );

      const promedio =
        mesesConDato > 0
          ? consumo12 /
            mesesConDato
          : 0;

      const claveSku =
        avNormalizarClaveSku_(
          sku
        );

      return {
        codigo:
          avValor_(
            fila,
            iCodigo
          ),

        sku: sku,

        marca:
          marcaPorSku.get(
            claveSku
          ) || '',

        descripcion:
          avValor_(
            fila,
            iDescripcion
          ),

        consumo12:
          consumo12,

        promedioMensual:
          promedio,

        totalUnidades:
          avValor_(
            fila,
            iTotalUnidades
          ),

        totalFacturado:
          avValor_(
            fila,
            iTotalFacturado
          ),

        archivo:
          avValor_(
            fila,
            iArchivo
          ),

        fechaImportacion:
          avValor_(
            fila,
            iFecha
          )
      };
    })
    .filter(Boolean);
}


function avConstruirMapaMarcaPorSku_(
  ss
) {
  const mapa =
    new Map();

  const sh =
    ss.getSheetByName(
      SII_ADMIN_VENTAS.HOJA_STOCK
    );

  if (
    !sh ||
    sh.getLastRow() < 2
  ) {
    return mapa;
  }

  const datos =
    sh.getDataRange()
      .getDisplayValues();

  const encabezados =
    datos[0].map(
      avNormalizarEncabezado_
    );

  const iSku =
    avBuscarIndice_(
      encabezados,
      [
        'SKU',
        'CODIGO_UNICO'
      ]
    );

  const iMarca =
    avBuscarIndice_(
      encabezados,
      [
        'MARCA'
      ]
    );

  if (
    iSku === -1 ||
    iMarca === -1
  ) {
    return mapa;
  }

  datos
    .slice(1)
    .forEach(function(fila) {
      const sku =
        avValor_(
          fila,
          iSku
        );

      const marca =
        avValor_(
          fila,
          iMarca
        );

      if (
        !sku ||
        !marca
      ) {
        return;
      }

      const clave =
        avNormalizarClaveSku_(
          sku
        );

      if (!mapa.has(clave)) {
        mapa.set(
          clave,
          marca
        );
      }
    });

  return mapa;
}


function avObtenerUltimaImportacion_(
  sh
) {
  if (
    !sh ||
    sh.getLastRow() < 2
  ) {
    return null;
  }

  const encabezados =
    sh.getRange(
      1,
      1,
      1,
      sh.getLastColumn()
    ).getDisplayValues()[0]
      .map(
        avNormalizarEncabezado_
      );

  const iArchivo =
    avBuscarIndice_(
      encabezados,
      [
        'ARCHIVO_ORIGEN'
      ]
    );

  const iFecha =
    avBuscarIndice_(
      encabezados,
      [
        'FECHA_IMPORTACION'
      ]
    );

  const cantidad =
    sh.getLastRow() - 1;

  const fila =
    sh.getRange(
      2,
      1,
      1,
      sh.getLastColumn()
    ).getDisplayValues()[0];

  return {
    archivo:
      avValor_(
        fila,
        iArchivo
      ),

    fecha:
      avValor_(
        fila,
        iFecha
      ),

    registros:
      cantidad
  };
}


/**************************************************************
 * UTILIDADES
 **************************************************************/

function avBuscarIndice_(
  encabezados,
  alternativas
) {
  const candidatas =
    alternativas.map(
      avNormalizarEncabezado_
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


function avValor_(
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


function avNumero_(
  valor
) {
  if (
    valor === null ||
    valor === undefined ||
    String(valor).trim() === ''
  ) {
    return 0;
  }

  let texto =
    String(valor)
      .trim()
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
        texto.replace(
          /,/g,
          ''
        );
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


function avNormalizarEncabezado_(
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


function avNormalizarTexto_(
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
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ');
}


function avNormalizarClaveSku_(
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
    .replace(
      /[^A-Z0-9]/g,
      ''
    );
}


function avOrdenPeriodo_(
  encabezado
) {
  const match =
    encabezado.match(
      /^(ENE|FEB|MAR|ABR|MAY|JUN|JUL|AGO|SEP|OCT|NOV|DIC)_(\d{4})$/
    );

  if (!match) {
    return 999999;
  }

  const meses = {
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

  return (
    Number(match[2]) *
    100 +
    meses[match[1]]
  );
}
