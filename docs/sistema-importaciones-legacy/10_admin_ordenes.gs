/**********************************************************************
 * SII - ADMINISTRACIÓN DE ÓRDENES
 * Sprint A.1 - Versión 0.1.002
 *
 * Incluye:
 * - Ventana modal HTML.
 * - Filtros iniciales.
 * - Consulta en modo solo lectura.
 *
 * Ajustes V0.1.001:
 * - La hoja principal pasa a ser ORDENES.
 * - ID_ORDEN es la clave principal mostrada.
 * - STATUS se reconoce como estado.
 * - FECHA_ORDEN se prioriza como fecha.
 * - IMPORTE_TOTAL se prioriza como importe.
 *
 * No incluye todavía:
 * - Alta, modificación, eliminación ni auditoría.
 **********************************************************************/

const SII_ADMIN_ORDENES = {
  VERSION: '0.1.002',
  HOJA_ORDENES: 'ORDENES',

  HOJAS_ALTERNATIVAS: [
    'ORDENES_COMPRA',
    'ORDENES_IMPORTADAS',
    'Status órdenes importadas',
    'STATUS ORDENES IMPORTADAS'
  ],

  FILA_ENCABEZADOS: 1,
  LIMITE_RESULTADOS: 300,

  CAMPOS: {
    numeroPi: [
      'ID_ORDEN',
      'NUMERO_ORDEN',
      'NUMERO_PI',
      'NRO_PI',
      'ORDEN',
      'PI'
    ],
    proveedor: [
      'PROVEEDOR'
    ],
    marca: [
      'MARCA'
    ],
    estado: [
      'STATUS',
      'ESTADO',
      'ESTADO_COMPRA'
    ],
    fecha: [
      'FECHA_ORDEN',
      'FECHA',
      'FECHA_CREACION',
      'FECHA_AUTORIZADA'
    ],
    importe: [
      'IMPORTE_TOTAL',
      'IMPORTE',
      'IMPORTE_ORDEN',
      'IMPORTE_OC'
    ]
  }
};


function abrirAdministracionOrdenes() {
  const plantilla = HtmlService
    .createTemplateFromFile('admin_ordenes');

  plantilla.version =
    SII_ADMIN_ORDENES.VERSION;

  const html = plantilla
    .evaluate()
    .setWidth(1200)
    .setHeight(720);

  SpreadsheetApp
    .getUi()
    .showModalDialog(
      html,
      'Administración de Órdenes'
    );
}


function aoObtenerInicializacion() {
  const ss = SpreadsheetApp.getActive();
  const sh = aoObtenerHojaOrdenes_(ss);

  if (!sh) {
    return {
      ok: true,
      version: SII_ADMIN_ORDENES.VERSION,
      configurada: false,
      hoja: '',
      mensaje:
        'Todavía no se configuró la hoja definitiva de órdenes.',
      proveedores: [],
      marcas: [],
      estados: []
    };
  }

  const estructura =
    aoLeerEstructura_(sh);

  const registros =
    aoConstruirRegistros_(
      estructura
    );

  return {
    ok: true,
    version: SII_ADMIN_ORDENES.VERSION,
    configurada: true,
    hoja: sh.getName(),
    mensaje: '',
    proveedores:
      aoValoresUnicos_(
        registros,
        'proveedor'
      ),
    marcas:
      aoValoresUnicos_(
        registros,
        'marca'
      ),
    estados:
      aoValoresUnicos_(
        registros,
        'estado'
      )
  };
}


function aoBuscarOrdenes(filtros) {
  const inicio = Date.now();

  const ss = SpreadsheetApp.getActive();
  const sh = aoObtenerHojaOrdenes_(ss);

  if (!sh) {
    return {
      ok: false,
      mensaje:
        'No se encontró una hoja de órdenes. ' +
        'Revisá SII_ADMIN_ORDENES.HOJA_ORDENES.',
      resultados: [],
      total: 0,
      duracionMs: Date.now() - inicio
    };
  }

  const estructura =
    aoLeerEstructura_(sh);

  const registros =
    aoConstruirRegistros_(
      estructura
    );

  const criterios = {
    numeroPi:
      aoNormalizarTexto_(
        filtros && filtros.numeroPi
      ),
    proveedor:
      aoNormalizarTexto_(
        filtros && filtros.proveedor
      ),
    marca:
      aoNormalizarTexto_(
        filtros && filtros.marca
      ),
    estado:
      aoNormalizarTexto_(
        filtros && filtros.estado
      )
  };

  const resultados = registros
    .filter(function(registro) {
      if (
        criterios.numeroPi &&
        !aoNormalizarTexto_(
          registro.numeroPi
        ).includes(criterios.numeroPi)
      ) {
        return false;
      }

      if (
        criterios.proveedor &&
        aoNormalizarTexto_(
          registro.proveedor
        ) !== criterios.proveedor
      ) {
        return false;
      }

      if (
        criterios.marca &&
        aoNormalizarTexto_(
          registro.marca
        ) !== criterios.marca
      ) {
        return false;
      }

      if (
        criterios.estado &&
        aoNormalizarTexto_(
          registro.estado
        ) !== criterios.estado
      ) {
        return false;
      }

      return true;
    })
    .slice(
      0,
      SII_ADMIN_ORDENES.LIMITE_RESULTADOS
    );

  return {
    ok: true,
    mensaje: '',
    hoja: sh.getName(),
    resultados: resultados,
    total: resultados.length,
    limite:
      SII_ADMIN_ORDENES
        .LIMITE_RESULTADOS,
    duracionMs: Date.now() - inicio
  };
}


function aoObtenerOrdenPorFila(numeroFila) {
  throw new Error(
    'La edición de órdenes se habilitará en el Sprint A.2.'
  );
}


function aoGuardarOrden(orden) {
  throw new Error(
    'El alta y la modificación se habilitarán en el Sprint A.2.'
  );
}


function aoObtenerHojaOrdenes_(ss) {
  const nombres = [
    SII_ADMIN_ORDENES.HOJA_ORDENES
  ].concat(
    SII_ADMIN_ORDENES.HOJAS_ALTERNATIVAS
  );

  for (
    let i = 0;
    i < nombres.length;
    i++
  ) {
    const nombre = nombres[i];

    if (!nombre) {
      continue;
    }

    const sh = ss.getSheetByName(nombre);

    if (sh) {
      return sh;
    }
  }

  return null;
}


function aoLeerEstructura_(sh) {
  const ultimaFila = sh.getLastRow();
  const ultimaColumna = sh.getLastColumn();

  if (
    ultimaFila <
      SII_ADMIN_ORDENES.FILA_ENCABEZADOS ||
    ultimaColumna < 1
  ) {
    return {
      encabezados: [],
      filas: [],
      filaInicialDatos:
        SII_ADMIN_ORDENES
          .FILA_ENCABEZADOS + 1
    };
  }

  const datos = sh.getRange(
    SII_ADMIN_ORDENES.FILA_ENCABEZADOS,
    1,
    ultimaFila -
      SII_ADMIN_ORDENES
        .FILA_ENCABEZADOS + 1,
    ultimaColumna
  ).getDisplayValues();

  return {
    encabezados:
      datos[0].map(
        aoNormalizarEncabezado_
      ),
    filas: datos.slice(1),
    filaInicialDatos:
      SII_ADMIN_ORDENES
        .FILA_ENCABEZADOS + 1
  };
}


function aoConstruirRegistros_(estructura) {
  const encabezados =
    estructura.encabezados;

  const indices = {
    numeroPi:
      aoBuscarIndiceCampo_(
        encabezados,
        SII_ADMIN_ORDENES
          .CAMPOS.numeroPi
      ),
    proveedor:
      aoBuscarIndiceCampo_(
        encabezados,
        SII_ADMIN_ORDENES
          .CAMPOS.proveedor
      ),
    marca:
      aoBuscarIndiceCampo_(
        encabezados,
        SII_ADMIN_ORDENES
          .CAMPOS.marca
      ),
    estado:
      aoBuscarIndiceCampo_(
        encabezados,
        SII_ADMIN_ORDENES
          .CAMPOS.estado
      ),
    fecha:
      aoBuscarIndiceCampo_(
        encabezados,
        SII_ADMIN_ORDENES
          .CAMPOS.fecha
      ),
    importe:
      aoBuscarIndiceCampo_(
        encabezados,
        SII_ADMIN_ORDENES
          .CAMPOS.importe
      )
  };

  return estructura.filas
    .map(function(fila, indice) {
      return {
        fila:
          estructura.filaInicialDatos +
          indice,
        numeroPi:
          aoValorIndice_(
            fila,
            indices.numeroPi
          ),
        proveedor:
          aoValorIndice_(
            fila,
            indices.proveedor
          ),
        marca:
          aoValorIndice_(
            fila,
            indices.marca
          ),
        estado:
          aoValorIndice_(
            fila,
            indices.estado
          ),
        fecha:
          aoValorIndice_(
            fila,
            indices.fecha
          ),
        importe:
          aoValorIndice_(
            fila,
            indices.importe
          )
      };
    })
    .filter(function(registro) {
      return (
        registro.numeroPi ||
        registro.proveedor ||
        registro.marca ||
        registro.estado
      );
    });
}


function aoBuscarIndiceCampo_(
  encabezados,
  candidatos
) {
  for (
    let i = 0;
    i < candidatos.length;
    i++
  ) {
    const candidato =
      aoNormalizarEncabezado_(
        candidatos[i]
      );

    const indice =
      encabezados.indexOf(
        candidato
      );

    if (indice !== -1) {
      return indice;
    }
  }

  return -1;
}


function aoValorIndice_(fila, indice) {
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


function aoValoresUnicos_(
  registros,
  campo
) {
  const mapa = new Map();

  registros.forEach(function(registro) {
    const valor = String(
      registro[campo] || ''
    ).trim();

    const clave =
      aoNormalizarTexto_(valor);

    if (
      valor &&
      !mapa.has(clave)
    ) {
      mapa.set(clave, valor);
    }
  });

  return Array.from(
    mapa.values()
  ).sort(function(a, b) {
    return a.localeCompare(
      b,
      'es',
      {
        sensitivity: 'base'
      }
    );
  });
}


function aoNormalizarEncabezado_(valor) {
  return String(valor || '')
    .trim()
    .normalize('NFD')
    .replace(
      /[\u0300-\u036f]/g,
      ''
    )
    .toUpperCase()
    .replace(/\s+/g, '_')
    .replace(/[^A-Z0-9_]/g, '');
}


function aoNormalizarTexto_(valor) {
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
