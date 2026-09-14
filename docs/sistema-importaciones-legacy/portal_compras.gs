/******************************************************************
 * SII - PORTAL DE COMPRAS
 * Sprint B.1.9-D.8.5
 *
 * Dashboard + Gestión de Compras + Bandeja de Compra.
 *
 * Persistencia:
 *   GESTION_COMPRAS
 *
 * Vista operativa:
 *   GESTION_COMPRAS_ACTIVA
 ******************************************************************/

const PORTAL_COMPRAS = {
  hojaModelo: 'MODELO_COMPRAS',
  hojaGestion: 'GESTION_COMPRAS',
  hojaGestionActiva: 'GESTION_COMPRAS_ACTIVA',
  hojaEnviosCompra: 'ENVIOS_COMPRA',
  hojaProcesoCompra: 'COMPRAS_EN_PROCESO',
  hojaMovimientosCompra: 'MOVIMIENTOS_COMPRA',
  hojaConfigMarcas: 'CONFIG_MARCAS_COMPRA',
  hojaPackingList: 'PACKING_LIST',
  hojaPackingListDetalle: 'PACKING_LIST_DETALLE',
  hojaContenedores: 'CONTENEDORES',
  hojaContenedorPacking: 'CONTENEDOR_PACKING_LIST',
  hojaOrdenesCompraPortal: 'ORDENES_COMPRA_PORTAL',
  hojaCotizacionesCompra: 'COTIZACIONES_COMPRA',
  hojaCotizacionesOfertas: 'COTIZACIONES_OFERTAS',

  usuariosPermitidos: [
    'etelias@grupo-aftermarket.com',
    'leonardogalvez@distrimar.com.ar',
    'ignacio@grupo-aftermarket.com',
    'melisa@alemarchina.com',
    'juan@distrimar.com.ar'
  ],

  nombresUsuarios: {
    'etelias@grupo-aftermarket.com': 'EDU',
    'leonardogalvez@distrimar.com.ar': 'LEONARDO',
    'ignacio@grupo-aftermarket.com': 'IGNACIO',
    'melisa@alemarchina.com': 'MELISA',
    'juan@distrimar.com.ar': 'JUAN'
  },

  /*
   * D.8.3 - Permisos de portal.
   * Los usuarios no listados aquí conservan acceso completo.
   */
  permisosUsuarios: {
    'juan@distrimar.com.ar': ['TRANSFERENCIAS']
  },

  estadosGestion: [
    'PENDIENTE',
    'COTIZAR',
    'APROBADO',
    'NO COMPRAR',
    'POSTERGAR',
    'ENVIADO A COMPRA'
  ],

  estadosProcesoCompra: [
    'PENDIENTE',
    'EN GESTION',
    'COMPRA PARCIAL',
    'COMPRA REALIZADA'
  ],

  estadosLogisticos: [
    'EN FÁBRICA',
    'A EMBARCAR',
    'EMBARCADO',
    'A INGRESAR',
    'INGRESADO'
  ]
};


/**
 * ============================================================
 * ACCESO WEB + AUTENTICACIÓN - B.1.9-C.3
 *
 * - Usuarios que Google identifica correctamente:
 *   acceso automático si están en usuariosPermitidos.
 *
 * - Usuarios externos que Google no identifica:
 *   email + código temporal enviado por correo.
 *
 * La sesión alternativa se valida también en cada función
 * del servidor; no depende sólo del HTML.
 * ============================================================
 */

const PORTAL_AUTH = {
  codigoMinutos: 10,
  sesionHoras: 8,
  reenvioSegundos: 60,
  maxIntentosCodigo: 5,
  prefijoCodigo: 'PORTAL_CODIGO_',
  prefijoSesion: 'PORTAL_SESION_',
  prefijoUltimoEnvio: 'PORTAL_ULTIMO_ENVIO_'
};


/**
 * Entrada de la Web App.
 */
function doGet(e) {

  const emailGoogle =
    obtenerEmailGooglePortal_();

  const token =
    e &&
    e.parameter
      ? String(
          e.parameter.t || ''
        ).trim()
      : '';

  let sesion = null;

  if (
    emailGoogle &&
    usuarioAutorizadoPortalCompras_(
      emailGoogle
    )
  ) {

    sesion = {
      email: emailGoogle,
      modo: 'GOOGLE'
    };

  } else if (token) {

    sesion =
      obtenerSesionTokenPortal_(
        token
      );
  }

  if (!sesion) {

    return HtmlService
      .createTemplateFromFile(
        'LoginPortal'
      )
      .evaluate()
      .setTitle(
        'SII - Acceso al Portal de Compras'
      )
      .addMetaTag(
        'viewport',
        'width=device-width, initial-scale=1'
      );
  }

  const template =
    HtmlService
      .createTemplateFromFile(
        'PortalCompras'
      );

  template.tokenPortal =
    sesion.modo === 'TOKEN'
      ? token
      : '';

  template.emailPortal =
    sesion.email || '';

  return template
    .evaluate()
    .setTitle(
      'SII - Portal de Compras'
    )
    .addMetaTag(
      'viewport',
      'width=device-width, initial-scale=1'
    );
}


/**
 * ============================================================
 * SEGURIDAD
 * ============================================================
 */
function obtenerEmailGooglePortal_() {

  try {

    return String(
      Session.getActiveUser()
        .getEmail() || ''
    )
    .trim()
    .toLowerCase();

  } catch (error) {

    return '';
  }
}


function usuarioAutorizadoPortalCompras_(
  email
) {

  const clave =
    String(
      email || ''
    )
    .trim()
    .toLowerCase();

  if (!clave) {
    return false;
  }

  return PORTAL_COMPRAS
    .usuariosPermitidos
    .map(
      function(x) {
        return String(x || '')
          .trim()
          .toLowerCase();
      }
    )
    .includes(
      clave
    );
}


/**
 * Devuelve el usuario real autorizado.
 *
 * 1) intenta identidad Google;
 * 2) si Google no la expone, valida el token temporal.
 */
function resolverUsuarioPortalCompras_(
  tokenPortal
) {
  const emailGoogle =
    obtenerEmailGooglePortal_();

  if (
    emailGoogle &&
    usuarioAutorizadoPortalCompras_(
      emailGoogle
    )
  ) {
    return emailGoogle;
  }

  const sesion =
    obtenerSesionTokenPortal_(
      tokenPortal
    );

  if (
    sesion &&
    usuarioAutorizadoPortalCompras_(
      sesion.email
    )
  ) {
    return sesion.email;
  }

  throw new Error(
    'Sesión no autorizada o vencida. Volvé a ingresar al Portal de Compras.'
  );
}


function obtenerPermisosUsuarioPortal_(email) {
  const clave = String(email || '').trim().toLowerCase();
  const permisos = PORTAL_COMPRAS.permisosUsuarios || {};

  if (!Object.prototype.hasOwnProperty.call(permisos, clave)) {
    return ['*'];
  }

  return (permisos[clave] || []).map(function(x){
    return String(x || '').trim().toUpperCase();
  });
}


function validarAccesoModuloPortal_(
  tokenPortal,
  modulo
) {
  const email = resolverUsuarioPortalCompras_(tokenPortal);
  const permisos = obtenerPermisosUsuarioPortal_(email);
  const requerido = String(modulo || '').trim().toUpperCase();

  if (
    permisos.indexOf('*') >= 0 ||
    permisos.indexOf(requerido) >= 0
  ) {
    return email;
  }

  throw new Error(
    'No tenés permiso para acceder a este módulo.'
  );
}


/**
 * Validador general usado por todos los módulos existentes.
 *
 * D.8.3:
 * un usuario con permisos restringidos NO puede usar funciones
 * generales aunque intente llamarlas desde el navegador.
 */
function validarUsuarioPortalCompras_(
  tokenPortal
) {
  const email = resolverUsuarioPortalCompras_(tokenPortal);
  const permisos = obtenerPermisosUsuarioPortal_(email);

  if (permisos.indexOf('*') >= 0) {
    return email;
  }

  throw new Error(
    'No tenés permiso para acceder a este módulo.'
  );
}


/**
 * Solicita un código de acceso.
 * Sólo se envía si el email ya está en usuariosPermitidos.
 */
function solicitarCodigoPortal(
  emailIngresado
) {

  const email =
    String(
      emailIngresado || ''
    )
    .trim()
    .toLowerCase();

  if (
    !usuarioAutorizadoPortalCompras_(
      email
    )
  ) {
    /*
     * Mensaje intencionalmente genérico para no exponer
     * qué correos existen en la lista blanca.
     */
    throw new Error(
      'El correo no está habilitado para ingresar al portal.'
    );
  }

  const props =
    PropertiesService
      .getScriptProperties();

  const claveEmail =
    hashTextoPortal_(
      email
    );

  const ahora =
    Date.now();

  const claveUltimoEnvio =
    PORTAL_AUTH.prefijoUltimoEnvio +
    claveEmail;

  const ultimoEnvio =
    Number(
      props.getProperty(
        claveUltimoEnvio
      ) || 0
    );

  if (
    ultimoEnvio > 0 &&
    ahora - ultimoEnvio <
      PORTAL_AUTH.reenvioSegundos *
      1000
  ) {

    const faltan =
      Math.ceil(
        (
          PORTAL_AUTH.reenvioSegundos *
          1000 -
          (ahora - ultimoEnvio)
        ) /
        1000
      );

    throw new Error(
      'Esperá ' +
      faltan +
      ' segundos antes de solicitar otro código.'
    );
  }

  const codigo =
    String(
      Math.floor(
        100000 +
        Math.random() *
        900000
      )
    );

  const vence =
    ahora +
    PORTAL_AUTH.codigoMinutos *
    60 *
    1000;

  const registro = {
    email: email,
    hashCodigo:
      hashTextoPortal_(
        email +
        '|' +
        codigo
      ),
    vence: vence,
    intentos: 0
  };

  props.setProperty(
    PORTAL_AUTH.prefijoCodigo +
    claveEmail,
    JSON.stringify(
      registro
    )
  );

  props.setProperty(
    claveUltimoEnvio,
    String(
      ahora
    )
  );

  MailApp.sendEmail({
    to: email,
    subject:
      'Código de acceso - SII Portal de Compras',
    htmlBody:
      '<p>Tu código temporal de acceso al <b>SII - Portal de Compras</b> es:</p>' +
      '<div style="font-size:30px;font-weight:bold;letter-spacing:5px;margin:20px 0;">' +
      escaparHtmlPortal_(
        codigo
      ) +
      '</div>' +
      '<p>El código vence en ' +
      PORTAL_AUTH.codigoMinutos +
      ' minutos.</p>' +
      '<p>Si no solicitaste este acceso, podés ignorar este correo.</p>'
  });

  return {
    ok: true,
    email: email,
    venceMinutos:
      PORTAL_AUTH.codigoMinutos
  };
}


/**
 * Valida el código y crea una sesión temporal.
 */
function validarCodigoPortal(
  emailIngresado,
  codigoIngresado
) {

  const email =
    String(
      emailIngresado || ''
    )
    .trim()
    .toLowerCase();

  const codigo =
    String(
      codigoIngresado || ''
    )
    .trim();

  if (
    !usuarioAutorizadoPortalCompras_(
      email
    )
  ) {
    throw new Error(
      'Acceso no autorizado.'
    );
  }

  if (
    !/^\d{6}$/.test(
      codigo
    )
  ) {
    throw new Error(
      'Ingresá el código de 6 dígitos.'
    );
  }

  const props =
    PropertiesService
      .getScriptProperties();

  const claveEmail =
    hashTextoPortal_(
      email
    );

  const claveCodigo =
    PORTAL_AUTH.prefijoCodigo +
    claveEmail;

  const texto =
    props.getProperty(
      claveCodigo
    );

  if (!texto) {
    throw new Error(
      'No hay un código vigente para ese correo. Solicitá uno nuevo.'
    );
  }

  let registro;

  try {
    registro =
      JSON.parse(
        texto
      );
  } catch (error) {

    props.deleteProperty(
      claveCodigo
    );

    throw new Error(
      'El código ya no es válido. Solicitá uno nuevo.'
    );
  }

  if (
    !registro.vence ||
    Date.now() >
      Number(
        registro.vence
      )
  ) {

    props.deleteProperty(
      claveCodigo
    );

    throw new Error(
      'El código venció. Solicitá uno nuevo.'
    );
  }

  registro.intentos =
    Number(
      registro.intentos || 0
    ) +
    1;

  if (
    registro.intentos >
    PORTAL_AUTH.maxIntentosCodigo
  ) {

    props.deleteProperty(
      claveCodigo
    );

    throw new Error(
      'Se superó la cantidad de intentos. Solicitá un código nuevo.'
    );
  }

  const hashRecibido =
    hashTextoPortal_(
      email +
      '|' +
      codigo
    );

  if (
    hashRecibido !==
    registro.hashCodigo
  ) {

    props.setProperty(
      claveCodigo,
      JSON.stringify(
        registro
      )
    );

    throw new Error(
      'Código incorrecto.'
    );
  }

  props.deleteProperty(
    claveCodigo
  );

  const token =
    Utilities.getUuid()
      .replace(/-/g, '') +
    Utilities.getUuid()
      .replace(/-/g, '');

  const venceSesion =
    Date.now() +
    PORTAL_AUTH.sesionHoras *
    60 *
    60 *
    1000;

  const sesion = {
    email: email,
    vence: venceSesion,
    creada: Date.now()
  };

  props.setProperty(
    PORTAL_AUTH.prefijoSesion +
    hashTextoPortal_(
      token
    ),
    JSON.stringify(
      sesion
    )
  );

  return {
    ok: true,
    token: token,
    email: email,
    venceHoras:
      PORTAL_AUTH.sesionHoras,
    url:
      ScriptApp.getService()
        .getUrl() +
      '?t=' +
      encodeURIComponent(
        token
      )
  };
}


/**
 * Se usa también desde LoginPortal para reutilizar una
 * sesión guardada en el navegador.
 */
function verificarSesionPortal(
  tokenPortal
) {

  const emailGoogle =
    obtenerEmailGooglePortal_();

  if (
    emailGoogle &&
    usuarioAutorizadoPortalCompras_(
      emailGoogle
    )
  ) {

    return {
      ok: true,
      email: emailGoogle,
      modo: 'GOOGLE',
      url:
        ScriptApp.getService()
          .getUrl()
    };
  }

  const sesion =
    obtenerSesionTokenPortal_(
      tokenPortal
    );

  if (!sesion) {

    return {
      ok: false
    };
  }

  return {
    ok: true,
    email: sesion.email,
    modo: 'TOKEN',
    url:
      ScriptApp.getService()
        .getUrl() +
      '?t=' +
      encodeURIComponent(
        String(
          tokenPortal || ''
        )
      )
  };
}


/**
 * Cierra una sesión alternativa.
 */
function cerrarSesionPortal(
  tokenPortal
) {

  const token =
    String(
      tokenPortal || ''
    ).trim();

  if (token) {

    PropertiesService
      .getScriptProperties()
      .deleteProperty(
        PORTAL_AUTH.prefijoSesion +
        hashTextoPortal_(
          token
        )
      );
  }

  return {
    ok: true,
    url:
      ScriptApp.getService()
        .getUrl()
  };
}


function obtenerSesionTokenPortal_(
  tokenPortal
) {

  const token =
    String(
      tokenPortal || ''
    ).trim();

  if (!token) {
    return null;
  }

  const props =
    PropertiesService
      .getScriptProperties();

  const clave =
    PORTAL_AUTH.prefijoSesion +
    hashTextoPortal_(
      token
    );

  const texto =
    props.getProperty(
      clave
    );

  if (!texto) {
    return null;
  }

  let sesion;

  try {
    sesion =
      JSON.parse(
        texto
      );
  } catch (error) {

    props.deleteProperty(
      clave
    );

    return null;
  }

  if (
    !sesion.email ||
    !sesion.vence ||
    Date.now() >
      Number(
        sesion.vence
      )
  ) {

    props.deleteProperty(
      clave
    );

    return null;
  }

  if (
    !usuarioAutorizadoPortalCompras_(
      sesion.email
    )
  ) {

    props.deleteProperty(
      clave
    );

    return null;
  }

  return {
    email:
      String(
        sesion.email
      ).toLowerCase(),
    modo: 'TOKEN'
  };
}


function hashTextoPortal_(
  texto
) {

  const bytes =
    Utilities.computeDigest(
      Utilities.DigestAlgorithm.SHA_256,
      String(
        texto || ''
      ),
      Utilities.Charset.UTF_8
    );

  return bytes
    .map(
      function(b) {

        const n =
          b < 0
            ? b + 256
            : b;

        return (
          '0' +
          n.toString(16)
        ).slice(-2);
      }
    )
    .join('');
}


function nombreUsuarioPortalCompras_(
  email
) {

  const clave =
    String(
      email || ''
    ).toLowerCase();

  return (
    PORTAL_COMPRAS
      .nombresUsuarios[
        clave
      ] ||
    clave ||
    'USUARIO'
  );
}


/**
 * ============================================================
 * DASHBOARD
 * ============================================================
 */
function obtenerDashboardPortalCompras(tokenPortal) {

  validarUsuarioPortalCompras_(tokenPortal);

  const ss =
    SpreadsheetApp.getActiveSpreadsheet();

  const configMarcas =
    obtenerMapaConfigMarcasPortal_(
      ss
    );

  const mapaAlias =
    obtenerMapaAliasPortal_(
      ss
    );

  const sh =
    ss.getSheetByName(
      PORTAL_COMPRAS.hojaModelo
    );

  if (!sh) {
    throw new Error(
      'No existe la hoja ' +
      PORTAL_COMPRAS.hojaModelo
    );
  }

  const FILA_HEADER = 2;

  const ultimaFila =
    sh.getLastRow();

  const ultimaColumna =
    sh.getLastColumn();

  if (
    ultimaFila <=
    FILA_HEADER
  ) {
    throw new Error(
      'MODELO_COMPRAS no contiene datos.'
    );
  }

  const headers =
    sh.getRange(
      FILA_HEADER,
      1,
      1,
      ultimaColumna
    )
    .getDisplayValues()[0]
    .map(
      normalizarPortalCompras_
    );

  const idx = {};

  headers.forEach(
    function(h, i) {
      idx[h] = i;
    }
  );

  const cSku =
    buscarColumnaPortal_(
      idx,
      ['SKU']
    );

  const cMarca =
    buscarColumnaPortal_(
      idx,
      ['MARCA']
    );

  const cRiesgo =
    buscarColumnaPortal_(
      idx,
      ['RIESGO']
    );

  const cStock =
    buscarColumnaPortal_(
      idx,
      ['STOCK_TOTAL']
    );

  const cPendiente =
    buscarColumnaPortal_(
      idx,
      [
        'PENDIENTE_TOTAL',
        'PENDIENTE_RECIBIR'
      ]
    );

  const cPromedio =
    buscarColumnaPortal_(
      idx,
      ['PROMEDIO_MENSUAL']
    );

  const cConsumo12 =
    buscarColumnaPortal_(
      idx,
      [
        'CONSUMO_12_MESES',
        'CONSUMO_12M'
      ]
    );

  const cCompra =
    buscarColumnaPortal_(
      idx,
      [
        'COMPRA_SUGERIDA',
        'CANTIDAD_SUGERIDA'
      ]
    );

  if (
    cSku < 0 ||
    cMarca < 0 ||
    cRiesgo < 0 ||
    cPromedio < 0
  ) {
    throw new Error(
      'No se encontraron SKU, MARCA, RIESGO o PROMEDIO_MENSUAL en MODELO_COMPRAS.'
    );
  }

  const datos =
    sh.getRange(
      FILA_HEADER + 1,
      1,
      ultimaFila - FILA_HEADER,
      ultimaColumna
    )
    .getValues();

  const resultado = {

    actualizado:
      Utilities.formatDate(
        new Date(),
        Session.getScriptTimeZone(),
        'dd/MM/yyyy HH:mm'
      ),

    usuario:
      validarUsuarioPortalCompras_(
        tokenPortal
      ),

    totalSku: 0,

    sinStock: 0,
    urgente: 0,
    comprar: 0,
    revisar: 0,
    ok: 0,
    sinConsumo: 0,

    stock: 0,
    pendiente: 0,
    compraSugerida: 0,

    stockConConsumo: 0,
    promedioTotal: 0,
    coberturaPromedio: 0,

    marcas: {}
  };

  for (
    let f = 0;
    f < datos.length;
    f++
  ) {

    const fila =
      datos[f];

    const sku =
      String(
        fila[cSku] || ''
      ).trim();

    if (!sku) {
      continue;
    }

    resultado.totalSku++;

    const marca =
      String(
        fila[cMarca] ||
        'SIN MARCA'
      ).trim() ||
      'SIN MARCA';

    const cfgMarca =
      obtenerConfigMarcaPortal_(
        marca,
        configMarcas,
        mapaAlias
      );

    const compraHabilitada =
      cfgMarca.compra ===
      'SI';

    const riesgo =
      String(
        fila[cRiesgo] || ''
      )
      .trim()
      .toUpperCase();

    const stock =
      cStock >= 0
        ? numeroPortalCompras_(
            fila[cStock]
          )
        : 0;

    const pendiente =
      cPendiente >= 0
        ? numeroPortalCompras_(
            fila[cPendiente]
          )
        : 0;

    const promedio =
      numeroPortalCompras_(
        fila[cPromedio]
      );

    const consumo12 =
      cConsumo12 >= 0
        ? numeroPortalCompras_(
            fila[cConsumo12]
          )
        : promedio * 12;

    const compra =
      cCompra >= 0
        ? numeroPortalCompras_(
            fila[cCompra]
          )
        : 0;

    /*
     * STOCK y PENDIENTE se mantienen como totales físicos globales.
     * La política COMPRA=NO afecta riesgo y nuevas sugerencias.
     */
    resultado.stock +=
      stock;

    resultado.pendiente +=
      pendiente;

    if (
      compraHabilitada
    ) {

      resultado.compraSugerida +=
        compra;

      if (
        promedio > 0
      ) {
        resultado.stockConConsumo +=
          stock;

        resultado.promedioTotal +=
          promedio;
      }

      switch (riesgo) {

        case 'SIN STOCK':
          resultado.sinStock++;
          break;

        case 'URGENTE':
          resultado.urgente++;
          break;

        case 'COMPRAR':
          resultado.comprar++;
          break;

        case 'REVISAR':
          resultado.revisar++;
          break;

        case 'OK':
          resultado.ok++;
          break;

        case 'SIN CONSUMO':
          resultado.sinConsumo++;
          break;
      }
    }

    if (
      !resultado.marcas[
        marca
      ]
    ) {

      resultado.marcas[
        marca
      ] = {

        marca:
          marca,

        origen:
          cfgMarca.origen,

        compraHabilitada:
          compraHabilitada,

        coberturaObjetivo:
          cfgMarca.objetivo,

        sinStock: 0,
        urgente: 0,
        comprar: 0,
        revisar: 0,

        compra: 0,

        consumo12: 0,
        consumoTrimestralPromedio: 0,

        stockConConsumo: 0,
        promedioTotal: 0,
        coberturaPromedio: 0
      };
    }

    const m =
      resultado.marcas[
        marca
      ];

    if (
      compraHabilitada
    ) {

      switch (riesgo) {

        case 'SIN STOCK':
          m.sinStock++;
          break;

        case 'URGENTE':
          m.urgente++;
          break;

        case 'COMPRAR':
          m.comprar++;
          break;

        case 'REVISAR':
          m.revisar++;
          break;
      }

      m.compra +=
        compra;

      m.consumo12 +=
        consumo12;

      m.consumoTrimestralPromedio =
        m.consumo12 / 4;

      if (
        promedio > 0
      ) {
        m.stockConConsumo +=
          stock;

        m.promedioTotal +=
          promedio;
      }
    }
  }

  if (
    resultado.promedioTotal > 0
  ) {
    resultado.coberturaPromedio =
      resultado.stockConConsumo /
      resultado.promedioTotal;
  }

  const todasMarcas =
    Object.values(
      resultado.marcas
    )
    .map(
      function(m) {

        if (
          m.promedioTotal > 0
        ) {
          m.coberturaPromedio =
            m.stockConConsumo /
            m.promedioTotal;
        }

        return m;
      }
    )
    .sort(
      function(a, b) {

        if (
          b.sinStock !==
          a.sinStock
        ) {
          return (
            b.sinStock -
            a.sinStock
          );
        }

        if (
          b.urgente !==
          a.urgente
        ) {
          return (
            b.urgente -
            a.urgente
          );
        }

        return a.marca.localeCompare(
          b.marca,
          'es'
        );
      }
    );

  resultado.marcasImportadas =
    todasMarcas.filter(
      function(m) {
        return (
          m.compraHabilitada &&
          m.origen ===
          'IMPORTADO'
        );
      }
    );

  resultado.marcasNacionales =
    todasMarcas.filter(
      function(m) {
        return (
          m.compraHabilitada &&
          m.origen ===
          'NACIONAL'
        );
      }
    );

  resultado.marcasNoCompra =
    todasMarcas.filter(
      function(m) {
        return (
          !m.compraHabilitada
        );
      }
    );

  /*
   * Compatibilidad con vistas previas.
   */
  resultado.marcas =
    todasMarcas.filter(
      function(m) {
        return (
          m.compraHabilitada
        );
      }
    )
    .slice(
      0,
      20
    );

  const fuentes =
    obtenerEstadoFuentesDashboardV5_(
      ss
    );

  function prepararFuentePortal_(
    dato
  ) {

    const fecha =
      dato &&
      dato.fecha
        ? dato.fecha
        : null;

    const estado =
      estadoAntiguedadFuenteDashboardV5_(
        fecha
      );

    return {

      fecha:
        fecha
          ? formatearFechaFuenteDashboardV5_(
              fecha
            )
          : 'SIN INFORMACIÓN',

      icono:
        estado.icono,

      color:
        estado.color,

      fontColor:
        estado.fontColor
    };
  }

  resultado.fuentes = {

    stockWarnes:
      prepararFuentePortal_(
        fuentes.stockWarnes
      ),

    stockEscobar:
      prepararFuentePortal_(
        fuentes.stockEscobar
      ),

    ventas:
      prepararFuentePortal_(
        fuentes.ventas
      ),

    ordenes:
      prepararFuentePortal_(
        fuentes.ordenes
      )
  };

  return resultado;
}

/**
 * ============================================================
 * GESTIÓN DE COMPRAS
 * ============================================================
 */
function obtenerGestionComprasPortal(tokenPortal) {

  validarUsuarioPortalCompras_(tokenPortal);

  const ss =
    SpreadsheetApp.getActiveSpreadsheet();

  const configMarcas =
    obtenerMapaConfigMarcasPortal_(
      ss
    );

  const mapaAlias =
    obtenerMapaAliasPortal_(
      ss
    );

  const sh =
    ss.getSheetByName(
      PORTAL_COMPRAS.hojaGestionActiva
    );

  if (!sh) {

    throw new Error(
      'No existe la hoja ' +
      PORTAL_COMPRAS.hojaGestionActiva
    );
  }

  const ultimaFila =
    sh.getLastRow();

  const ultimaColumna =
    sh.getLastColumn();

  if (
    ultimaFila <
    2
  ) {

    return {
      actualizado:
        Utilities.formatDate(
          new Date(),
          Session.getScriptTimeZone(),
          'dd/MM/yyyy HH:mm'
        ),

      registros: [],
      estados:
        PORTAL_COMPRAS.estadosGestion.slice(),
      riesgos: [],
      marcas: []
    };
  }

  /*
   * IMPORTANTE:
   * getValues() conserva COMPRA_SUGERIDA como número real.
   */
  const valores =
    sh.getRange(
      1,
      1,
      ultimaFila,
      ultimaColumna
    )
    .getValues();

  const headers =
    valores[0].map(
      normalizarPortalCompras_
    );

  const idx = {};

  headers.forEach(
    function(h, i) {
      idx[h] = i;
    }
  );

  const cSku =
    buscarColumnaPortal_(
      idx,
      ['SKU']
    );

  const cDescripcion =
    buscarColumnaPortal_(
      idx,
      ['DESCRIPCION']
    );

  const cMarca =
    buscarColumnaPortal_(
      idx,
      ['MARCA']
    );

  const cRiesgo =
    buscarColumnaPortal_(
      idx,
      ['RIESGO']
    );

  const cCompra =
    buscarColumnaPortal_(
      idx,
      ['COMPRA_SUGERIDA']
    );

  const cCoberturaActual =
    buscarColumnaPortal_(
      idx,
      ['COBERTURA_ACTUAL']
    );

  const cEstado =
    buscarColumnaPortal_(
      idx,
      ['ESTADO_GESTION']
    );

  const cCantidad =
    buscarColumnaPortal_(
      idx,
      ['CANTIDAD_DECIDIDA']
    );

  const cResponsable =
    buscarColumnaPortal_(
      idx,
      ['RESPONSABLE']
    );

  const cObservacion =
    buscarColumnaPortal_(
      idx,
      ['OBSERVACION']
    );

  const cFechaDecision =
    buscarColumnaPortal_(
      idx,
      ['FECHA_DECISION']
    );

  if (
    cSku < 0 ||
    cRiesgo < 0 ||
    cCompra < 0 ||
    cEstado < 0
  ) {

    throw new Error(
      'GESTION_COMPRAS_ACTIVA no contiene las columnas requeridas.'
    );
  }

  const registros = [];

  const riesgos =
    new Set();

  const marcas =
    new Set();

  for (
    let f = 1;
    f < valores.length;
    f++
  ) {

    const fila =
      valores[f];

    const sku =
      String(
        fila[cSku] || ''
      ).trim();

    if (!sku) {
      continue;
    }

    const descripcion =
      cDescripcion >= 0
        ? String(
            fila[cDescripcion] ||
            ''
          ).trim()
        : '';

    const marca =
      cMarca >= 0
        ? (
            String(
              fila[cMarca] ||
              'SIN MARCA'
            ).trim() ||
            'SIN MARCA'
          )
        : 'SIN MARCA';

    const cfgMarca =
      obtenerConfigMarcaPortal_(
        marca,
        configMarcas,
        mapaAlias
      );

    const riesgo =
      String(
        fila[cRiesgo] ||
        ''
      )
      .trim()
      .toUpperCase();

    const estado =
      String(
        fila[cEstado] ||
        'PENDIENTE'
      )
      .trim()
      .toUpperCase();

    if (riesgo) {
      riesgos.add(
        riesgo
      );
    }

    marcas.add(
      marca
    );

    registros.push({

      sku:
        sku,

      descripcion:
        descripcion,

      marca:
        marca,

      origen:
        cfgMarca.origen,

      compraHabilitada:
        cfgMarca.compra === 'SI',

      coberturaObjetivo:
        cfgMarca.objetivo,

      coberturaActual:
        cCoberturaActual >= 0
          ? numeroPortalCompras_(
              fila[cCoberturaActual]
            )
          : 0,

      riesgo:
        riesgo,

      compraSugerida:
        numeroPortalCompras_(
          fila[cCompra]
        ),

      estadoGestion:
        estado,

      cantidadDecidida:
        cCantidad >= 0
          ? numeroPortalCompras_(
              fila[cCantidad]
            )
          : 0,

      responsable:
        cResponsable >= 0
          ? String(
              fila[cResponsable] ||
              ''
            ).trim()
          : '',

      observacion:
        cObservacion >= 0
          ? String(
              fila[cObservacion] ||
              ''
            ).trim()
          : '',

      fechaDecision:
        cFechaDecision >= 0
          ? formatearFechaPortalCompras_(
              fila[cFechaDecision]
            )
          : ''
    });
  }

  return {

    actualizado:
      Utilities.formatDate(
        new Date(),
        Session.getScriptTimeZone(),
        'dd/MM/yyyy HH:mm'
      ),

    total:
      registros.length,

    registros:
      registros,

    estados:
      PORTAL_COMPRAS
        .estadosGestion
        .slice(),

    riesgos:
      Array.from(
        riesgos
      ).sort(),

    marcas:
      Array.from(
        marcas
      ).sort(
        function(a, b) {

          return a.localeCompare(
            b
          );
        }
      )
  };
}


/**
 * ============================================================
 * GUARDAR DECISIÓN - B.1.8-B
 * ============================================================
 */
function guardarDecisionCompraPortal(
  datos,
  tokenPortal
) {

  const email =
    validarUsuarioPortalCompras_(tokenPortal);

  if (
    !datos ||
    typeof datos !==
    'object'
  ) {

    throw new Error(
      'No se recibieron datos de la decisión.'
    );
  }

  const sku =
    String(
      datos.sku || ''
    ).trim();

  const estado =
    String(
      datos.estadoGestion ||
      ''
    )
    .trim()
    .toUpperCase();

  const observacion =
    String(
      datos.observacion ||
      ''
    )
    .trim();

  let cantidad =
    datos.cantidadDecidida;

  if (!sku) {

    throw new Error(
      'El SKU es obligatorio.'
    );
  }

  if (
    !PORTAL_COMPRAS
      .estadosGestion
      .includes(
        estado
      )
  ) {

    throw new Error(
      'Estado de gestión no válido.'
    );
  }

  if (
    cantidad === '' ||
    cantidad === null ||
    cantidad === undefined
  ) {

    cantidad =
      0;

  } else {

    cantidad =
      Number(
        cantidad
      );

    if (
      !isFinite(
        cantidad
      ) ||
      cantidad <
      0
    ) {

      throw new Error(
        'La cantidad decidida debe ser un número mayor o igual a cero.'
      );
    }
  }

  if (
    observacion.length >
    1000
  ) {

    throw new Error(
      'La observación no puede superar los 1000 caracteres.'
    );
  }

  const lock =
    LockService.getDocumentLock();

  lock.waitLock(
    30000
  );

  try {

    const ss =
      SpreadsheetApp.getActiveSpreadsheet();

    const shGestion =
      ss.getSheetByName(
        PORTAL_COMPRAS.hojaGestion
      );

    const shActiva =
      ss.getSheetByName(
        PORTAL_COMPRAS.hojaGestionActiva
      );

    if (!shGestion) {

      throw new Error(
        'No existe la hoja ' +
        PORTAL_COMPRAS.hojaGestion
      );
    }

    if (!shActiva) {

      throw new Error(
        'No existe la hoja ' +
        PORTAL_COMPRAS.hojaGestionActiva
      );
    }

    const infoActiva =
      buscarSkuEnHojaPortal_(
        shActiva,
        sku
      );

    if (
      !infoActiva
    ) {

      throw new Error(
        'El SKU ' +
        sku +
        ' no existe en ' +
        PORTAL_COMPRAS.hojaGestionActiva +
        '.'
      );
    }

    const riesgoActual =
      String(
        infoActiva.valor(
          'RIESGO'
        ) || ''
      )
      .trim()
      .toUpperCase();

    const compraActual =
      numeroPortalCompras_(
        infoActiva.valor(
          'COMPRA_SUGERIDA'
        )
      );

    const responsable =
      estado ===
      'PENDIENTE'
        ? ''
        : nombreUsuarioPortalCompras_(
            email
          );

    const fechaDecision =
      estado ===
      'PENDIENTE'
        ? ''
        : new Date();

    const cantidadFinal =
      estado ===
      'PENDIENTE'
        ? ''
        : cantidad;

    const observacionFinal =
      estado ===
      'PENDIENTE'
        ? ''
        : observacion;

    /*
     * ----------------------------------------------------------
     * PERSISTENCIA EN GESTION_COMPRAS
     * ----------------------------------------------------------
     */
    const infoGestion =
      buscarSkuEnHojaPortal_(
        shGestion,
        sku
      );

    if (
      infoGestion
    ) {

      escribirPorEncabezadoPortal_(
        shGestion,
        infoGestion.fila,
        infoGestion.idx,
        {
          ESTADO_GESTION:
            estado,

          CANTIDAD_DECIDIDA:
            cantidadFinal,

          OBSERVACION:
            observacionFinal,

          RESPONSABLE:
            responsable,

          FECHA_DECISION:
            fechaDecision,

          RIESGO_ACTUAL:
            riesgoActual,

          COMPRA_SUGERIDA_ACTUAL:
            compraActual,

          ACTIVO_EN_PLAN:
            'SI',

          ULTIMA_ACTUALIZACION:
            new Date()
        }
      );

    } else {

      appendGestionPortal_(
        shGestion,
        {
          SKU:
            sku,

          ESTADO_GESTION:
            estado,

          CANTIDAD_DECIDIDA:
            cantidadFinal,

          OBSERVACION:
            observacionFinal,

          RESPONSABLE:
            responsable,

          FECHA_DECISION:
            fechaDecision,

          RIESGO_ACTUAL:
            riesgoActual,

          COMPRA_SUGERIDA_ACTUAL:
            compraActual,

          ACTIVO_EN_PLAN:
            'SI',

          ULTIMA_ACTUALIZACION:
            new Date()
        }
      );
    }

    /*
     * ----------------------------------------------------------
     * SINCRONIZACIÓN INMEDIATA DE LA VISTA OPERATIVA
     * ----------------------------------------------------------
     */
    escribirPorEncabezadoPortal_(
      shActiva,
      infoActiva.fila,
      infoActiva.idx,
      {
        ESTADO_GESTION:
          estado,

        CANTIDAD_DECIDIDA:
          cantidadFinal,

        RESPONSABLE:
          responsable,

        OBSERVACION:
          observacionFinal,

        FECHA_DECISION:
          fechaDecision
      }
    );

    SpreadsheetApp.flush();

    return {

      ok:
        true,

      sku:
        sku,

      estadoGestion:
        estado,

      cantidadDecidida:
        cantidadFinal === ''
          ? 0
          : Number(
              cantidadFinal
            ),

      responsable:
        responsable,

      observacion:
        observacionFinal,

      fechaDecision:
        formatearFechaPortalCompras_(
          fechaDecision
        )
    };

  } finally {

    lock.releaseLock();
  }
}


/**
 * Busca un SKU y devuelve fila, encabezados e índice.
 * La hoja debe tener encabezados en la fila 1.
 */
function buscarSkuEnHojaPortal_(
  sh,
  skuBuscado
) {

  const ultimaFila =
    sh.getLastRow();

  const ultimaColumna =
    sh.getLastColumn();

  if (
    ultimaFila <
    1 ||
    ultimaColumna <
    1
  ) {

    return null;
  }

  const headers =
    sh.getRange(
      1,
      1,
      1,
      ultimaColumna
    )
    .getDisplayValues()[0]
    .map(
      normalizarPortalCompras_
    );

  const idx = {};

  headers.forEach(
    function(h, i) {
      idx[h] = i;
    }
  );

  const cSku =
    buscarColumnaPortal_(
      idx,
      ['SKU']
    );

  if (
    cSku <
    0
  ) {

    throw new Error(
      'No se encontró la columna SKU en ' +
      sh.getName() +
      '.'
    );
  }

  if (
    ultimaFila <
    2
  ) {

    return null;
  }

  const skus =
    sh.getRange(
      2,
      cSku + 1,
      ultimaFila - 1,
      1
    )
    .getDisplayValues();

  const clave =
    normalizarClavePortalCompras_(
      skuBuscado
    );

  for (
    let i = 0;
    i < skus.length;
    i++
  ) {

    if (
      normalizarClavePortalCompras_(
        skus[i][0]
      ) ===
      clave
    ) {

      const filaHoja =
        i + 2;

      const filaValores =
        sh.getRange(
          filaHoja,
          1,
          1,
          ultimaColumna
        )
        .getValues()[0];

      return {

        fila:
          filaHoja,

        idx:
          idx,

        headers:
          headers,

        valor:
          function(nombre) {

            const col =
              idx[
                nombre
              ];

            return (
              col ===
              undefined
            )
              ? ''
              : filaValores[
                  col
                ];
          }
      };
    }
  }

  return null;
}


/**
 * Escribe sólo columnas existentes.
 */
function escribirPorEncabezadoPortal_(
  sh,
  fila,
  idx,
  cambios
) {

  Object.keys(
    cambios
  ).forEach(
    function(nombre) {

      if (
        Object.prototype
          .hasOwnProperty
          .call(
            idx,
            nombre
          )
      ) {

        sh.getRange(
          fila,
          idx[nombre] + 1
        )
        .setValue(
          cambios[nombre]
        );
      }
    }
  );
}


/**
 * Agrega registro respetando el orden real de encabezados.
 */
function appendGestionPortal_(
  sh,
  datos
) {

  const ultimaColumna =
    sh.getLastColumn();

  const headers =
    sh.getRange(
      1,
      1,
      1,
      ultimaColumna
    )
    .getDisplayValues()[0]
    .map(
      normalizarPortalCompras_
    );

  const fila =
    headers.map(
      function(h) {

        return Object.prototype
          .hasOwnProperty
          .call(
            datos,
            h
          )
          ? datos[h]
          : '';
      }
    );

  sh.appendRow(
    fila
  );
}




/**
 * ============================================================
 * GESTIÓN MASIVA - B.1.8-C
 *
 * Aplica a varios SKU:
 *   - ESTADO_GESTION
 *   - RESPONSABLE automático
 *   - FECHA_DECISION automática
 *   - OBSERVACION común sólo si el usuario lo solicita
 *
 * La CANTIDAD_DECIDIDA NO se modifica en forma masiva.
 * ============================================================
 */
function guardarGestionMasivaPortal(datos, tokenPortal) {

  const email =
    validarUsuarioPortalCompras_(tokenPortal);

  if (
    !datos ||
    typeof datos !==
    'object'
  ) {
    throw new Error(
      'No se recibieron datos para la gestión masiva.'
    );
  }

  const skus =
    Array.isArray(datos.skus)
      ? datos.skus
          .map(function(sku) {
            return String(sku || '').trim();
          })
          .filter(function(sku) {
            return !!sku;
          })
      : [];

  const skusUnicos =
    Array.from(
      new Set(
        skus.map(
          normalizarClavePortalCompras_
        )
      )
    );

  const estado =
    String(
      datos.estadoGestion || ''
    )
    .trim()
    .toUpperCase();

  const aplicarObservacion =
    datos.aplicarObservacion === true;

  const observacion =
    String(
      datos.observacion || ''
    ).trim();

  if (
    skusUnicos.length === 0
  ) {
    throw new Error(
      'No hay SKU seleccionados.'
    );
  }

  if (
    !PORTAL_COMPRAS
      .estadosGestion
      .includes(estado)
  ) {
    throw new Error(
      'Estado de gestión no válido.'
    );
  }

  if (
    observacion.length > 1000
  ) {
    throw new Error(
      'La observación no puede superar los 1000 caracteres.'
    );
  }

  const responsable =
    estado === 'PENDIENTE'
      ? ''
      : nombreUsuarioPortalCompras_(email);

  const fechaDecision =
    estado === 'PENDIENTE'
      ? ''
      : new Date();

  const lock =
    LockService.getDocumentLock();

  lock.waitLock(30000);

  try {

    const ss =
      SpreadsheetApp.getActiveSpreadsheet();

    const shGestion =
      ss.getSheetByName(
        PORTAL_COMPRAS.hojaGestion
      );

    const shActiva =
      ss.getSheetByName(
        PORTAL_COMPRAS.hojaGestionActiva
      );

    if (!shGestion) {
      throw new Error(
        'No existe la hoja ' +
        PORTAL_COMPRAS.hojaGestion
      );
    }

    if (!shActiva) {
      throw new Error(
        'No existe la hoja ' +
        PORTAL_COMPRAS.hojaGestionActiva
      );
    }

    const indiceActiva =
      construirIndiceSkuPortal_(
        shActiva
      );

    const indiceGestion =
      construirIndiceSkuPortal_(
        shGestion
      );

    const datosActiva =
      shActiva
        .getDataRange()
        .getValues();

    const filasActiva = [];
    const filasGestion = [];
    const faltantesGestion = [];
    const noEncontrados = [];

    skusUnicos.forEach(
      function(claveSku) {

        const filaActiva =
          indiceActiva.filasPorSku.get(
            claveSku
          );

        if (!filaActiva) {
          noEncontrados.push(
            claveSku
          );
          return;
        }

        filasActiva.push(
          filaActiva
        );

        const filaGestion =
          indiceGestion.filasPorSku.get(
            claveSku
          );

        if (filaGestion) {
          filasGestion.push(
            filaGestion
          );
        } else {
          faltantesGestion.push({
            claveSku: claveSku,
            filaActiva: filaActiva
          });
        }
      }
    );

    if (
      noEncontrados.length > 0
    ) {
      throw new Error(
        'Hay ' +
        noEncontrados.length +
        ' SKU que ya no existen en GESTION_COMPRAS_ACTIVA. Recargá la pantalla e intentá nuevamente.'
      );
    }

    /*
     * ----------------------------------------------------------
     * ACTUALIZA GESTION_COMPRAS_ACTIVA
     * ----------------------------------------------------------
     */
    aplicarValorMasivoPortal_(
      shActiva,
      filasActiva,
      indiceActiva.idx,
      'ESTADO_GESTION',
      estado
    );

    aplicarValorMasivoPortal_(
      shActiva,
      filasActiva,
      indiceActiva.idx,
      'RESPONSABLE',
      responsable
    );

    aplicarValorMasivoPortal_(
      shActiva,
      filasActiva,
      indiceActiva.idx,
      'FECHA_DECISION',
      fechaDecision
    );

    if (aplicarObservacion) {
      aplicarValorMasivoPortal_(
        shActiva,
        filasActiva,
        indiceActiva.idx,
        'OBSERVACION',
        observacion
      );
    }

    /*
     * ----------------------------------------------------------
     * ACTUALIZA GESTION_COMPRAS
     * ----------------------------------------------------------
     */
    aplicarValorMasivoPortal_(
      shGestion,
      filasGestion,
      indiceGestion.idx,
      'ESTADO_GESTION',
      estado
    );

    aplicarValorMasivoPortal_(
      shGestion,
      filasGestion,
      indiceGestion.idx,
      'RESPONSABLE',
      responsable
    );

    aplicarValorMasivoPortal_(
      shGestion,
      filasGestion,
      indiceGestion.idx,
      'FECHA_DECISION',
      fechaDecision
    );

    aplicarValorMasivoPortal_(
      shGestion,
      filasGestion,
      indiceGestion.idx,
      'ACTIVO_EN_PLAN',
      'SI'
    );

    aplicarValorMasivoPortal_(
      shGestion,
      filasGestion,
      indiceGestion.idx,
      'ULTIMA_ACTUALIZACION',
      new Date()
    );

    if (aplicarObservacion) {
      aplicarValorMasivoPortal_(
        shGestion,
        filasGestion,
        indiceGestion.idx,
        'OBSERVACION',
        observacion
      );
    }

    /*
     * Si por alguna razón un SKU activo todavía no existe en
     * GESTION_COMPRAS, lo incorpora respetando su estructura.
     */
    faltantesGestion.forEach(
      function(item) {

        const filaActivaValores =
          datosActiva[
            item.filaActiva - 1
          ];

        const valorActiva =
          function(nombre) {

            const col =
              indiceActiva.idx[nombre];

            return col === undefined
              ? ''
              : filaActivaValores[col];
          };

        appendGestionPortal_(
          shGestion,
          {
            SKU: valorActiva('SKU'),
            ESTADO_GESTION: estado,
            CANTIDAD_DECIDIDA: '',
            OBSERVACION:
              aplicarObservacion
                ? observacion
                : '',
            RESPONSABLE: responsable,
            FECHA_DECISION: fechaDecision,
            RIESGO_ACTUAL: valorActiva('RIESGO'),
            COMPRA_SUGERIDA_ACTUAL:
              numeroPortalCompras_(
                valorActiva('COMPRA_SUGERIDA')
              ),
            ACTIVO_EN_PLAN: 'SI',
            ULTIMA_ACTUALIZACION: new Date()
          }
        );
      }
    );

    SpreadsheetApp.flush();

    return {
      ok: true,
      cantidad: skusUnicos.length,
      skus: skusUnicos,
      estadoGestion: estado,
      responsable: responsable,
      fechaDecision:
        formatearFechaPortalCompras_(
          fechaDecision
        ),
      aplicarObservacion:
        aplicarObservacion,
      observacion:
        aplicarObservacion
          ? observacion
          : null
    };

  } finally {
    lock.releaseLock();
  }
}


/**
 * Índice de filas por SKU para una hoja con encabezados en fila 1.
 */
function construirIndiceSkuPortal_(sh) {

  const ultimaFila =
    sh.getLastRow();

  const ultimaColumna =
    sh.getLastColumn();

  const headers =
    sh.getRange(
      1,
      1,
      1,
      ultimaColumna
    )
    .getDisplayValues()[0]
    .map(
      normalizarPortalCompras_
    );

  const idx = {};

  headers.forEach(
    function(h, i) {
      idx[h] = i;
    }
  );

  const cSku =
    buscarColumnaPortal_(
      idx,
      ['SKU']
    );

  if (cSku < 0) {
    throw new Error(
      'No se encontró la columna SKU en ' +
      sh.getName() +
      '.'
    );
  }

  const filasPorSku =
    new Map();

  if (
    ultimaFila >= 2
  ) {

    const skus =
      sh.getRange(
        2,
        cSku + 1,
        ultimaFila - 1,
        1
      )
      .getDisplayValues();

    skus.forEach(
      function(fila, i) {

        const clave =
          normalizarClavePortalCompras_(
            fila[0]
          );

        if (clave) {
          filasPorSku.set(
            clave,
            i + 2
          );
        }
      }
    );
  }

  return {
    idx: idx,
    headers: headers,
    filasPorSku: filasPorSku
  };
}


/**
 * Aplica un mismo valor a una columna para varias filas.
 * No hace nada si la columna no existe.
 */
function aplicarValorMasivoPortal_(
  sh,
  filas,
  idx,
  encabezado,
  valor
) {

  if (
    !filas ||
    filas.length === 0 ||
    !Object.prototype
      .hasOwnProperty
      .call(
        idx,
        encabezado
      )
  ) {
    return;
  }

  const columna =
    idx[encabezado] + 1;

  const letra =
    columnaALetraPortal_(
      columna
    );

  const rangos =
    filas.map(
      function(fila) {
        return letra + fila;
      }
    );

  sh.getRangeList(
    rangos
  ).setValue(
    valor
  );
}


function columnaALetraPortal_(columna) {

  let resultado = '';
  let n = columna;

  while (n > 0) {

    const resto =
      (n - 1) % 26;

    resultado =
      String.fromCharCode(
        65 + resto
      ) +
      resultado;

    n =
      Math.floor(
        (n - 1) / 26
      );
  }

  return resultado;
}




/**
 * ============================================================
 * B.1.9-D.8 - BANDEJA DE COTIZACIÓN
 *
 * Sólo aplica a productos IMPORTADOS.
 *
 * Flujo:
 *   COTIZAR -> lote CT -> una o más ofertas -> proveedor elegido
 *   -> APROBADO -> Bandeja de Compra.
 * ============================================================
 */

function obtenerHojaCotizacionesCompraPortal_(ss) {
  let sh = ss.getSheetByName(PORTAL_COMPRAS.hojaCotizacionesCompra);

  const headers = [
    'NRO_COTIZACION',
    'FECHA_COTIZACION',
    'ESTADO_COTIZACION',
    'SKU',
    'DESCRIPCION',
    'MARCA',
    'CANTIDAD',
    'USUARIO_CREA',
    'PROVEEDOR_SELECCIONADO',
    'FECHA_APROBACION',
    'USUARIO_APROBACION'
  ];

  if (!sh) {
    sh = ss.insertSheet(PORTAL_COMPRAS.hojaCotizacionesCompra);
  }

  if (sh.getLastRow() === 0 || sh.getLastColumn() === 0) {
    sh.getRange(1,1,1,headers.length)
      .setValues([headers])
      .setFontWeight('bold')
      .setBackground('#123d6a')
      .setFontColor('white');
    sh.setFrozenRows(1);
  }

  return sh;
}


function obtenerHojaCotizacionesOfertasPortal_(ss) {
  let sh = ss.getSheetByName(PORTAL_COMPRAS.hojaCotizacionesOfertas);
  const headers = ['NRO_COTIZACION','PROVEEDOR','SKU','PRECIO','MONEDA','OBSERVACION','FECHA_OFERTA','USUARIO','CODIGO_PROVEEDOR'];

  if (!sh) sh = ss.insertSheet(PORTAL_COMPRAS.hojaCotizacionesOfertas);

  if (sh.getLastRow() === 0 || sh.getLastColumn() === 0) {
    sh.getRange(1,1,1,headers.length).setValues([headers])
      .setFontWeight('bold').setBackground('#123d6a').setFontColor('white');
    sh.setFrozenRows(1);
    return sh;
  }

  const actuales = sh.getRange(1,1,1,sh.getLastColumn()).getDisplayValues()[0]
    .map(normalizarPortalCompras_);

  headers.forEach(function(h){
    if (actuales.indexOf(normalizarPortalCompras_(h)) >= 0) return;
    const c = sh.getLastColumn()+1;
    sh.getRange(1,c).setValue(h).setFontWeight('bold')
      .setBackground('#123d6a').setFontColor('white');
    actuales.push(normalizarPortalCompras_(h));
  });

  sh.setFrozenRows(1);
  return sh;
}


function generarNumeroCotizacionPortal_(sh, fecha) {
  const prefijo =
    'CT-' +
    Utilities.formatDate(
      fecha,
      Session.getScriptTimeZone(),
      'yyyyMMdd'
    ) +
    '-';

  let maximo = 0;

  if (sh.getLastRow() >= 2) {
    sh.getRange(2,1,sh.getLastRow()-1,1)
      .getDisplayValues()
      .forEach(function(f) {
        const nro = String(f[0] || '').trim();
        if (nro.indexOf(prefijo) !== 0) return;

        const n = Number(
          nro.substring(prefijo.length)
        );

        if (!isNaN(n) && n > maximo) {
          maximo = n;
        }
      });
  }

  return prefijo +
    String(maximo + 1).padStart(4,'0');
}


/**
 * Devuelve sólo SKU IMPORTADOS con estado COTIZAR.
 * Los que ya están dentro de una cotización ABIERTA no vuelven
 * a aparecer como pendientes.
 */
function obtenerBandejaCotizacionPortal(tokenPortal) {
  validarUsuarioPortalCompras_(tokenPortal);

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(PORTAL_COMPRAS.hojaGestionActiva);

  if (!sh) {
    throw new Error(
      'No existe la hoja ' + PORTAL_COMPRAS.hojaGestionActiva + '.'
    );
  }

  const lastRow = sh.getLastRow();
  const lastCol = sh.getLastColumn();

  if (lastRow < 2 || lastCol < 1) {
    return {
      registros: [],
      resumen: { sku:0, unidades:0, marcas:0 }
    };
  }

  /*
   * D.8.1:
   * Primero se leen solamente los encabezados.
   * Después se trae un único bloque de GESTION_COMPRAS_ACTIVA.
   * Ya no se llama a obtenerCotizacionesPortal() desde esta función.
   */
  const headers = sh.getRange(1,1,1,lastCol)
    .getDisplayValues()[0]
    .map(normalizarPortalCompras_);

  const idx = {};
  headers.forEach(function(h,i){ idx[h]=i; });

  const cSku = buscarColumnaPortal_(idx,['SKU']);
  const cDescripcion = buscarColumnaPortal_(idx,['DESCRIPCION']);
  const cMarca = buscarColumnaPortal_(idx,['MARCA']);
  const cOrigen = buscarColumnaPortal_(idx,['ORIGEN']);
  const cRiesgo = buscarColumnaPortal_(idx,['RIESGO']);
  const cCompra = buscarColumnaPortal_(idx,['COMPRA_SUGERIDA']);
  const cEstado = buscarColumnaPortal_(idx,['ESTADO_GESTION']);
  const cCantidad = buscarColumnaPortal_(idx,['CANTIDAD_DECIDIDA']);
  const cResponsable = buscarColumnaPortal_(idx,['RESPONSABLE']);
  const cObservacion = buscarColumnaPortal_(idx,['OBSERVACION']);
  const cFecha = buscarColumnaPortal_(idx,['FECHA_DECISION']);

  if (
    cSku < 0 ||
    cMarca < 0 ||
    cEstado < 0 ||
    cCantidad < 0
  ) {
    throw new Error(
      'GESTION_COMPRAS_ACTIVA no contiene las columnas necesarias para Cotizaciones.'
    );
  }

  const columnasNecesarias = [
    cSku, cDescripcion, cMarca, cOrigen, cRiesgo, cCompra,
    cEstado, cCantidad, cResponsable, cObservacion, cFecha
  ].filter(function(c){ return c >= 0; });

  const minCol = Math.min.apply(null, columnasNecesarias);
  const maxCol = Math.max.apply(null, columnasNecesarias);

  const valores = sh.getRange(
    2,
    minCol + 1,
    lastRow - 1,
    maxCol - minCol + 1
  ).getValues();

  function valorFila_(fila, col) {
    return col >= 0 ? fila[col - minCol] : '';
  }

  /*
   * Los SKU que ya están dentro de una CT ABIERTA se excluyen.
   * Esta hoja es pequeña, por lo que se lee sólo si ya existe.
   */
  const enCotizacionAbierta = new Set();
  const shCot = ss.getSheetByName(PORTAL_COMPRAS.hojaCotizacionesCompra);

  if (shCot && shCot.getLastRow() >= 2) {
    const lc = shCot.getLastColumn();
    const hc = shCot.getRange(1,1,1,lc)
      .getDisplayValues()[0]
      .map(normalizarPortalCompras_);

    const ic = {};
    hc.forEach(function(h,i){ ic[h]=i; });

    if (
      ic.SKU !== undefined &&
      ic.ESTADO_COTIZACION !== undefined
    ) {
      const inicio = Math.min(ic.SKU, ic.ESTADO_COTIZACION);
      const fin = Math.max(ic.SKU, ic.ESTADO_COTIZACION);

      const vc = shCot.getRange(
        2,
        inicio + 1,
        shCot.getLastRow() - 1,
        fin - inicio + 1
      ).getDisplayValues();

      vc.forEach(function(fila){
        const estado = String(
          fila[ic.ESTADO_COTIZACION - inicio] || ''
        ).trim().toUpperCase();

        if (estado !== 'ABIERTA') return;

        const sku = normalizarClavePortalCompras_(
          fila[ic.SKU - inicio]
        );

        if (sku) enCotizacionAbierta.add(sku);
      });
    }
  }

  /*
   * ORIGEN ya forma parte de GESTION_COMPRAS_ACTIVA en el modelo actual.
   * Sólo si faltara esa columna se consulta la configuración de marcas.
   */
  let configMarcas = null;
  let mapaAlias = null;

  if (cOrigen < 0) {
    configMarcas = obtenerMapaConfigMarcasPortal_(ss);
    mapaAlias = obtenerMapaAliasPortal_(ss);
  }

  const registros = [];
  const marcas = new Set();
  let unidades = 0;

  valores.forEach(function(fila){
    const sku = String(valorFila_(fila,cSku) || '').trim();
    if (!sku) return;

    const estado = String(
      valorFila_(fila,cEstado) || ''
    ).trim().toUpperCase();

    if (estado !== 'COTIZAR') return;

    const cantidad = numeroPortalCompras_(
      valorFila_(fila,cCantidad)
    );

    if (cantidad <= 0) return;

    const marca = String(
      valorFila_(fila,cMarca) || 'SIN MARCA'
    ).trim() || 'SIN MARCA';

    let origen = '';

    if (cOrigen >= 0) {
      origen = String(
        valorFila_(fila,cOrigen) || ''
      ).trim().toUpperCase();
    } else {
      origen = obtenerConfigMarcaPortal_(
        marca,
        configMarcas,
        mapaAlias
      ).origen;
    }

    if (origen !== 'IMPORTADO') return;

    if (
      enCotizacionAbierta.has(
        normalizarClavePortalCompras_(sku)
      )
    ) return;

    marcas.add(marca);
    unidades += cantidad;

    registros.push({
      sku: sku,
      descripcion:
        cDescripcion >= 0
          ? String(valorFila_(fila,cDescripcion) || '')
          : '',
      marca: marca,
      origen: origen,
      riesgo:
        cRiesgo >= 0
          ? String(valorFila_(fila,cRiesgo) || '')
          : '',
      compraSugerida:
        cCompra >= 0
          ? numeroPortalCompras_(valorFila_(fila,cCompra))
          : 0,
      cantidadDecidida: cantidad,
      responsable:
        cResponsable >= 0
          ? String(valorFila_(fila,cResponsable) || '')
          : '',
      observacion:
        cObservacion >= 0
          ? String(valorFila_(fila,cObservacion) || '')
          : '',
      fechaDecision:
        cFecha >= 0
          ? formatearFechaPortalCompras_(valorFila_(fila,cFecha))
          : ''
    });
  });

  registros.sort(function(a,b){
    const m = a.marca.localeCompare(b.marca,'es');
    return m !== 0 ? m : a.sku.localeCompare(b.sku,'es');
  });

  return {
    registros: registros,
    resumen: {
      sku: registros.length,
      unidades: unidades,
      marcas: marcas.size
    }
  };
}

/**
 * Crea un lote CT con varios SKU importados.
 */
function crearCotizacionPortal(skus, tokenPortal) {
  const email = validarUsuarioPortalCompras_(tokenPortal);

  const claves = Array.from(
    new Set(
      (Array.isArray(skus) ? skus : [])
        .map(normalizarClavePortalCompras_)
        .filter(Boolean)
    )
  );

  if (!claves.length) {
    throw new Error(
      'Seleccioná al menos un SKU para crear la cotización.'
    );
  }

  const lock = LockService.getDocumentLock();
  lock.waitLock(30000);

  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const shActiva = ss.getSheetByName(PORTAL_COMPRAS.hojaGestionActiva);

    if (!shActiva) {
      throw new Error(
        'No existe la hoja ' + PORTAL_COMPRAS.hojaGestionActiva + '.'
      );
    }

    const configMarcas = obtenerMapaConfigMarcasPortal_(ss);
    const mapaAlias = obtenerMapaAliasPortal_(ss);

    const valores = shActiva.getDataRange().getValues();
    const headers = valores[0].map(normalizarPortalCompras_);
    const idx = {};
    headers.forEach(function(h,i){ idx[h]=i; });

    const cSku = buscarColumnaPortal_(idx,['SKU']);
    const cDescripcion = buscarColumnaPortal_(idx,['DESCRIPCION']);
    const cMarca = buscarColumnaPortal_(idx,['MARCA']);
    const cEstado = buscarColumnaPortal_(idx,['ESTADO_GESTION']);
    const cCantidad = buscarColumnaPortal_(idx,['CANTIDAD_DECIDIDA']);

    const encontrados = {};
    for (let r=1; r<valores.length; r++) {
      const clave = normalizarClavePortalCompras_(valores[r][cSku]);
      if (clave) encontrados[clave] = valores[r];
    }

    const invalidos = [];
    const items = [];

    claves.forEach(function(clave){
      const fila = encontrados[clave];

      if (!fila) {
        invalidos.push(clave + ' (no encontrado)');
        return;
      }

      const estado = String(fila[cEstado] || '').trim().toUpperCase();
      const cantidad = numeroPortalCompras_(fila[cCantidad]);
      const marca = String(fila[cMarca] || '').trim();

      const cfg = obtenerConfigMarcaPortal_(
        marca,
        configMarcas,
        mapaAlias
      );

      if (cfg.origen !== 'IMPORTADO') {
        invalidos.push(clave + ' (no es IMPORTADO)');
        return;
      }

      if (estado !== 'COTIZAR' || cantidad <= 0) {
        invalidos.push(clave + ' (no está COTIZAR con cantidad > 0)');
        return;
      }

      items.push({
        sku: String(fila[cSku] || '').trim(),
        descripcion: cDescripcion >= 0 ? String(fila[cDescripcion] || '') : '',
        marca: marca,
        cantidad: cantidad
      });
    });

    if (invalidos.length) {
      throw new Error(
        'No se creó la cotización:\n' + invalidos.join('\n')
      );
    }

    const shCot = obtenerHojaCotizacionesCompraPortal_(ss);

    // Evita que un SKU quede en dos cotizaciones abiertas.
    if (shCot.getLastRow() >= 2) {
      const vc = shCot.getDataRange().getDisplayValues();
      const hc = vc[0].map(normalizarPortalCompras_);
      const ic = {};
      hc.forEach(function(h,i){ ic[h]=i; });

      const abiertos = {};
      for (let r=1; r<vc.length; r++) {
        if (
          String(vc[r][ic.ESTADO_COTIZACION] || '').trim().toUpperCase() !==
          'ABIERTA'
        ) continue;

        abiertos[
          normalizarClavePortalCompras_(vc[r][ic.SKU])
        ] = String(vc[r][ic.NRO_COTIZACION] || '');
      }

      const repetidos = claves.filter(function(k){ return abiertos[k]; });

      if (repetidos.length) {
        throw new Error(
          'Hay SKU que ya pertenecen a una cotización abierta: ' +
          repetidos.join(', ')
        );
      }
    }

    const ahora = new Date();
    const nro = generarNumeroCotizacionPortal_(shCot, ahora);
    const usuario = nombreUsuarioPortalCompras_(email);

    const filas = items.map(function(i){
      return [
        nro,
        ahora,
        'ABIERTA',
        i.sku,
        i.descripcion,
        i.marca,
        i.cantidad,
        usuario,
        '',
        '',
        ''
      ];
    });

    shCot.getRange(
      shCot.getLastRow()+1,
      1,
      filas.length,
      filas[0].length
    ).setValues(filas);

    SpreadsheetApp.flush();

    return {
      ok: true,
      nroCotizacion: nro,
      sku: items.length
    };

  } finally {
    lock.releaseLock();
  }
}


/**
 * Devuelve lotes CT con sus ofertas agrupadas por proveedor.
 */
function obtenerCotizacionesPortal(tokenPortal) {
  validarUsuarioPortalCompras_(tokenPortal);

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const shCot = obtenerHojaCotizacionesCompraPortal_(ss);
  const shOf = obtenerHojaCotizacionesOfertasPortal_(ss);

  const lotes = {};

  if (shCot.getLastRow() >= 2) {
    const vc = shCot.getDataRange().getValues();
    const hc = vc[0].map(normalizarPortalCompras_);
    const ic = {};
    hc.forEach(function(h,i){ ic[h]=i; });

    for (let r=1; r<vc.length; r++) {
      const nro = String(vc[r][ic.NRO_COTIZACION] || '').trim();
      if (!nro) continue;

      if (!lotes[nro]) {
        lotes[nro] = {
          nroCotizacion: nro,
          fecha: formatearFechaPortalCompras_(vc[r][ic.FECHA_COTIZACION]),
          estado: String(vc[r][ic.ESTADO_COTIZACION] || '').trim().toUpperCase(),
          proveedorSeleccionado: String(vc[r][ic.PROVEEDOR_SELECCIONADO] || '').trim(),
          items: [],
          ofertas: []
        };
      }

      lotes[nro].items.push({
        sku: String(vc[r][ic.SKU] || ''),
        descripcion: String(vc[r][ic.DESCRIPCION] || ''),
        marca: String(vc[r][ic.MARCA] || ''),
        cantidad: numeroPortalCompras_(vc[r][ic.CANTIDAD])
      });
    }
  }

  if (shOf.getLastRow() >= 2) {
    const vo = shOf.getDataRange().getValues();
    const ho = vo[0].map(normalizarPortalCompras_);
    const io = {};
    ho.forEach(function(h,i){ io[h]=i; });

    const ofertasMap = {};

    for (let r=1; r<vo.length; r++) {
      const nro = String(vo[r][io.NRO_COTIZACION] || '').trim();
      if (!nro || !lotes[nro]) continue;

      const proveedor = String(vo[r][io.PROVEEDOR] || '').trim();
      const clave = nro + '|' + proveedor.toUpperCase();

      if (!ofertasMap[clave]) {
        ofertasMap[clave] = {
          nroCotizacion: nro,
          proveedor: proveedor,
          moneda: String(vo[r][io.MONEDA] || '').trim().toUpperCase(),
          observacion: String(vo[r][io.OBSERVACION] || ''),
          items: [],
          total: 0
        };
      }

      const precio = numeroPortalCompras_(vo[r][io.PRECIO]);
      const sku = String(vo[r][io.SKU] || '').trim();

      const itemCot = lotes[nro].items.find(function(x){
        return normalizarClavePortalCompras_(x.sku) ===
          normalizarClavePortalCompras_(sku);
      });

      const cantidad = itemCot ? itemCot.cantidad : 0;

      ofertasMap[clave].items.push({
        sku: sku,
        codigoProveedor: io.CODIGO_PROVEEDOR !== undefined
          ? String(vo[r][io.CODIGO_PROVEEDOR] || '').trim()
          : '',
        precio: precio,
        cantidad: cantidad,
        subtotal: precio * cantidad
      });

      ofertasMap[clave].total += precio * cantidad;
    }

    Object.keys(ofertasMap).forEach(function(clave){
      const o = ofertasMap[clave];
      lotes[o.nroCotizacion].ofertas.push(o);
    });
  }

  const cotizaciones = Object.values(lotes)
    .sort(function(a,b){
      return b.nroCotizacion.localeCompare(a.nroCotizacion);
    });

  return {
    cotizaciones: cotizaciones
  };
}


/**
 * Guarda o reemplaza una oferta de un proveedor para un lote CT.
 * La moneda es común para toda la oferta.
 */
function guardarOfertaCotizacionPortal(datos, tokenPortal) {
  const email = validarUsuarioPortalCompras_(tokenPortal);

  datos = datos || {};

  const nro = String(datos.nroCotizacion || '').trim();
  const proveedor = String(datos.proveedor || '').trim();
  const moneda = String(datos.moneda || '').trim().toUpperCase();
  const observacion = String(datos.observacion || '').trim();
  const items = Array.isArray(datos.items) ? datos.items : [];

  if (!nro) throw new Error('Falta el número de cotización.');
  if (!proveedor) throw new Error('Indicá el proveedor.');
  if (!moneda) throw new Error('Indicá la moneda.');
  if (!items.length) throw new Error('No hay ítems para guardar.');

  const normalizados = items.map(function(i){
    const sku = String(i.sku || '').trim();
    const precio = Number(i.precio);

    if (!sku || !isFinite(precio) || precio <= 0) {
      throw new Error(
        'Todos los SKU deben tener un precio mayor a cero.'
      );
    }

    return {
      sku: sku,
      codigoProveedor: String(i.codigoProveedor || sku).trim() || sku,
      precio: precio
    };
  });

  const lock = LockService.getDocumentLock();
  lock.waitLock(30000);

  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const shCot = obtenerHojaCotizacionesCompraPortal_(ss);
    const shOf = obtenerHojaCotizacionesOfertasPortal_(ss);

    // Verifica que la cotización exista y siga abierta.
    const vc = shCot.getDataRange().getDisplayValues();
    const hc = vc[0].map(normalizarPortalCompras_);
    const ic = {};
    hc.forEach(function(h,i){ ic[h]=i; });

    let existe = false;
    let abierta = false;
    const skusCot = new Set();

    for (let r=1; r<vc.length; r++) {
      if (String(vc[r][ic.NRO_COTIZACION] || '').trim() !== nro) continue;

      existe = true;

      if (
        String(vc[r][ic.ESTADO_COTIZACION] || '').trim().toUpperCase() ===
        'ABIERTA'
      ) abierta = true;

      skusCot.add(
        normalizarClavePortalCompras_(vc[r][ic.SKU])
      );
    }

    if (!existe) throw new Error('No se encontró la cotización ' + nro + '.');
    if (!abierta) throw new Error('La cotización ya no está abierta.');

    normalizados.forEach(function(i){
      if (!skusCot.has(normalizarClavePortalCompras_(i.sku))) {
        throw new Error(
          'El SKU ' + i.sku + ' no pertenece a la cotización.'
        );
      }
    });

    /*
     * Reemplazo completo de la oferta del mismo proveedor:
     * borra sus filas anteriores y vuelve a escribirlas.
     */
    if (shOf.getLastRow() >= 2) {
      const vo = shOf.getDataRange().getDisplayValues();
      const ho = vo[0].map(normalizarPortalCompras_);
      const io = {};
      ho.forEach(function(h,i){ io[h]=i; });

      const borrar = [];

      for (let r=1; r<vo.length; r++) {
        if (
          String(vo[r][io.NRO_COTIZACION] || '').trim() === nro &&
          String(vo[r][io.PROVEEDOR] || '').trim().toUpperCase() ===
            proveedor.toUpperCase()
        ) {
          borrar.push(r+1);
        }
      }

      borrar.sort(function(a,b){ return b-a; })
        .forEach(function(f){ shOf.deleteRow(f); });
    }

    const ahora = new Date();
    const usuario = nombreUsuarioPortalCompras_(email);

    const hOf = shOf.getRange(1,1,1,shOf.getLastColumn())
      .getDisplayValues()[0].map(normalizarPortalCompras_);
    const iOf = {};
    hOf.forEach(function(h,i){ iOf[h]=i; });

    const filas = normalizados.map(function(i){
      const fila = new Array(hOf.length).fill('');
      fila[iOf.NRO_COTIZACION] = nro;
      fila[iOf.PROVEEDOR] = proveedor;
      fila[iOf.SKU] = i.sku;
      fila[iOf.PRECIO] = i.precio;
      fila[iOf.MONEDA] = moneda;
      fila[iOf.OBSERVACION] = observacion;
      fila[iOf.FECHA_OFERTA] = ahora;
      fila[iOf.USUARIO] = usuario;
      fila[iOf.CODIGO_PROVEEDOR] = i.codigoProveedor;
      return fila;
    });

    shOf.getRange(shOf.getLastRow()+1,1,filas.length,hOf.length)
      .setValues(filas);

    SpreadsheetApp.flush();

    return {
      ok: true,
      nroCotizacion: nro,
      proveedor: proveedor
    };

  } finally {
    lock.releaseLock();
  }
}


/**
 * Selecciona una oferta ganadora.
 * Exige que el proveedor tenga precio cargado para TODOS los SKU
 * del lote. Luego pasa esos SKU a APROBADO.
 */
function aprobarOfertaCotizacionPortal(
  nroCotizacion,
  proveedor,
  tokenPortal
) {
  const email = validarUsuarioPortalCompras_(tokenPortal);

  nroCotizacion = String(nroCotizacion || '').trim();
  proveedor = String(proveedor || '').trim();

  if (!nroCotizacion) throw new Error('Falta la cotización.');
  if (!proveedor) throw new Error('Falta el proveedor.');

  const lock = LockService.getDocumentLock();
  lock.waitLock(30000);

  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const shCot = obtenerHojaCotizacionesCompraPortal_(ss);
    const shOf = obtenerHojaCotizacionesOfertasPortal_(ss);

    const vc = shCot.getDataRange().getValues();
    const hc = vc[0].map(normalizarPortalCompras_);
    const ic = {};
    hc.forEach(function(h,i){ ic[h]=i; });

    const filasCot = [];
    const skus = [];

    for (let r=1; r<vc.length; r++) {
      if (
        String(vc[r][ic.NRO_COTIZACION] || '').trim() !==
        nroCotizacion
      ) continue;

      const estado = String(
        vc[r][ic.ESTADO_COTIZACION] || ''
      ).trim().toUpperCase();

      if (estado !== 'ABIERTA') {
        throw new Error(
          'La cotización ' + nroCotizacion + ' ya no está abierta.'
        );
      }

      filasCot.push(r+1);
      skus.push(
        String(vc[r][ic.SKU] || '').trim()
      );
    }

    if (!filasCot.length) {
      throw new Error(
        'No se encontró la cotización ' + nroCotizacion + '.'
      );
    }

    const vo = shOf.getDataRange().getDisplayValues();
    const ho = vo[0].map(normalizarPortalCompras_);
    const io = {};
    ho.forEach(function(h,i){ io[h]=i; });

    const ofertados = new Set();

    for (let r=1; r<vo.length; r++) {
      if (
        String(vo[r][io.NRO_COTIZACION] || '').trim() !==
        nroCotizacion
      ) continue;

      if (
        String(vo[r][io.PROVEEDOR] || '').trim().toUpperCase() !==
        proveedor.toUpperCase()
      ) continue;

      if (numeroPortalCompras_(vo[r][io.PRECIO]) <= 0) continue;

      ofertados.add(
        normalizarClavePortalCompras_(vo[r][io.SKU])
      );
    }

    const faltantes = skus.filter(function(s){
      return !ofertados.has(normalizarClavePortalCompras_(s));
    });

    if (faltantes.length) {
      throw new Error(
        'El proveedor no tiene precio para todos los SKU. Faltan: ' +
        faltantes.join(', ')
      );
    }

    const ahora = new Date();
    const usuario = nombreUsuarioPortalCompras_(email);

    // Cierra la cotización.
    filasCot.forEach(function(fila){
      shCot.getRange(fila, ic.ESTADO_COTIZACION + 1)
        .setValue('APROBADA');

      shCot.getRange(fila, ic.PROVEEDOR_SELECCIONADO + 1)
        .setValue(proveedor);

      shCot.getRange(fila, ic.FECHA_APROBACION + 1)
        .setValue(ahora);

      shCot.getRange(fila, ic.USUARIO_APROBACION + 1)
        .setValue(usuario);
    });

    /*
     * Lleva los SKU a APROBADO en gestión.
     * Conserva CANTIDAD_DECIDIDA.
     */
    const shActiva = ss.getSheetByName(PORTAL_COMPRAS.hojaGestionActiva);
    const shGestion = ss.getSheetByName(PORTAL_COMPRAS.hojaGestion);

    if (!shActiva || !shGestion) {
      throw new Error(
        'No se encontraron las hojas de gestión.'
      );
    }

    const ia = construirIndiceSkuPortal_(shActiva);
    const ig = construirIndiceSkuPortal_(shGestion);

    const filasActiva = [];
    const filasGestion = [];

    skus.forEach(function(sku){
      const clave = normalizarClavePortalCompras_(sku);
      const fa = ia.filasPorSku.get(clave);
      const fg = ig.filasPorSku.get(clave);

      if (fa) filasActiva.push(fa);
      if (fg) filasGestion.push(fg);
    });

    [
      [shActiva, filasActiva, ia.idx],
      [shGestion, filasGestion, ig.idx]
    ].forEach(function(x){
      aplicarValorMasivoPortal_(
        x[0], x[1], x[2],
        'ESTADO_GESTION',
        'APROBADO'
      );

      aplicarValorMasivoPortal_(
        x[0], x[1], x[2],
        'RESPONSABLE',
        usuario
      );

      aplicarValorMasivoPortal_(
        x[0], x[1], x[2],
        'FECHA_DECISION',
        ahora
      );

      aplicarValorMasivoPortal_(
        x[0], x[1], x[2],
        'OBSERVACION',
        'Cotización ' +
          nroCotizacion +
          ' · Proveedor: ' +
          proveedor
      );
    });

    aplicarValorMasivoPortal_(
      shGestion,
      filasGestion,
      ig.idx,
      'ULTIMA_ACTUALIZACION',
      ahora
    );

    SpreadsheetApp.flush();

    return {
      ok: true,
      nroCotizacion: nroCotizacion,
      proveedor: proveedor,
      sku: skus.length
    };

  } finally {
    lock.releaseLock();
  }
}



/**
 * ============================================================
 * BANDEJA DE COMPRA - B.1.8-F.2
 * ============================================================
 */
function obtenerMapaCotizacionAprobadaPortal_(ss) {
  const mapa = new Map();
  const shCot = ss.getSheetByName(PORTAL_COMPRAS.hojaCotizacionesCompra);
  const shOf = ss.getSheetByName(PORTAL_COMPRAS.hojaCotizacionesOfertas);
  if (!shCot || !shOf || shCot.getLastRow()<2 || shOf.getLastRow()<2) return mapa;

  const vc=shCot.getDataRange().getDisplayValues();
  const hc=vc[0].map(normalizarPortalCompras_), ic={};
  hc.forEach(function(h,i){ic[h]=i;});
  const aprobadas=new Map();

  for(let r=1;r<vc.length;r++){
    if(String(vc[r][ic.ESTADO_COTIZACION]||'').trim().toUpperCase()!=='APROBADA') continue;
    const nro=String(vc[r][ic.NRO_COTIZACION]||'').trim();
    const sku=normalizarClavePortalCompras_(vc[r][ic.SKU]);
    const prov=String(vc[r][ic.PROVEEDOR_SELECCIONADO]||'').trim();
    if(nro&&sku&&prov) aprobadas.set(nro+'|'+sku,prov);
  }

  const vo=shOf.getDataRange().getDisplayValues();
  const ho=vo[0].map(normalizarPortalCompras_), io={};
  ho.forEach(function(h,i){io[h]=i;});

  for(let r=1;r<vo.length;r++){
    const nro=String(vo[r][io.NRO_COTIZACION]||'').trim();
    const sku=normalizarClavePortalCompras_(vo[r][io.SKU]);
    const prov=String(vo[r][io.PROVEEDOR]||'').trim();
    const elegido=aprobadas.get(nro+'|'+sku);
    if(!elegido || elegido.toUpperCase()!==prov.toUpperCase()) continue;
    mapa.set(sku,{
      nroCotizacion:nro,
      proveedor:prov,
      codigoProveedor:io.CODIGO_PROVEEDOR!==undefined
        ? String(vo[r][io.CODIGO_PROVEEDOR]||'').trim() : ''
    });
  }
  return mapa;
}


function obtenerBandejaCompraPortal(tokenPortal) {

  validarUsuarioPortalCompras_(tokenPortal);

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(PORTAL_COMPRAS.hojaGestionActiva);

  if (!sh) {
    throw new Error('No existe la hoja ' + PORTAL_COMPRAS.hojaGestionActiva);
  }

  if (sh.getLastRow() < 2) {
    return { registros: [], resumen: { sku: 0, unidades: 0, marcas: 0 } };
  }

  const valores = sh.getDataRange().getValues();
  const headers = valores[0].map(normalizarPortalCompras_);
  const idx = {};
  headers.forEach(function(h, i) { idx[h] = i; });

  const col = function(nombres) {
    return buscarColumnaPortal_(idx, nombres);
  };

  const cSku = col(['SKU']);
  const cDescripcion = col(['DESCRIPCION']);
  const cMarca = col(['MARCA']);
  const cRiesgo = col(['RIESGO']);
  const cCompra = col(['COMPRA_SUGERIDA']);
  const cEstado = col(['ESTADO_GESTION']);
  const cCantidad = col(['CANTIDAD_DECIDIDA']);
  const cResponsable = col(['RESPONSABLE']);
  const cObservacion = col(['OBSERVACION']);
  const cFecha = col(['FECHA_DECISION']);

  if (cSku < 0 || cEstado < 0 || cCantidad < 0) {
    throw new Error(
      'GESTION_COMPRAS_ACTIVA no contiene SKU, ESTADO_GESTION o CANTIDAD_DECIDIDA.'
    );
  }

  const registros = [];
  const marcas = new Set();
  let unidades = 0;

  for (let f = 1; f < valores.length; f++) {

    const fila = valores[f];
    const sku = String(fila[cSku] || '').trim();
    if (!sku) continue;

    const estado = String(fila[cEstado] || '').trim().toUpperCase();
    const cantidad = numeroPortalCompras_(fila[cCantidad]);

    if (estado !== 'APROBADO' || cantidad <= 0) continue;

    const marca =
      cMarca >= 0
        ? (String(fila[cMarca] || 'SIN MARCA').trim() || 'SIN MARCA')
        : 'SIN MARCA';

    marcas.add(marca);
    unidades += cantidad;

    registros.push({
      sku: sku,
      descripcion: cDescripcion >= 0 ? String(fila[cDescripcion] || '') : '',
      marca: marca,
      riesgo: cRiesgo >= 0 ? String(fila[cRiesgo] || '') : '',
      compraSugerida: cCompra >= 0 ? numeroPortalCompras_(fila[cCompra]) : 0,
      cantidadDecidida: cantidad,
      responsable: cResponsable >= 0 ? String(fila[cResponsable] || '') : '',
      observacion: cObservacion >= 0 ? String(fila[cObservacion] || '') : '',
      fechaDecision: cFecha >= 0 ? formatearFechaPortalCompras_(fila[cFecha]) : ''
    });
  }

  const mapaCot = obtenerMapaCotizacionAprobadaPortal_(ss);
  registros.forEach(function(r){
    const c = mapaCot.get(normalizarClavePortalCompras_(r.sku));
    r.proveedor = c ? c.proveedor : '';
    r.codigoProveedor = c ? c.codigoProveedor : '';
    r.nroCotizacion = c ? c.nroCotizacion : '';
  });

  registros.sort(function(a, b) {
    const porMarca = a.marca.localeCompare(b.marca, 'es');
    return porMarca !== 0 ? porMarca : a.sku.localeCompare(b.sku, 'es');
  });

  return {
    registros: registros,
    resumen: {
      sku: registros.length,
      unidades: unidades,
      marcas: marcas.size
    }
  };
}


function enviarACompraPortal(skus, tokenPortal) {

  const email = validarUsuarioPortalCompras_(tokenPortal);

  const claves = Array.from(
    new Set(
      (Array.isArray(skus) ? skus : [])
        .map(function(sku) { return normalizarClavePortalCompras_(sku); })
        .filter(Boolean)
    )
  );

  if (claves.length === 0) {
    throw new Error('No hay SKU seleccionados para enviar a compra.');
  }

  const lock = LockService.getDocumentLock();
  lock.waitLock(30000);

  try {

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const shActiva = ss.getSheetByName(PORTAL_COMPRAS.hojaGestionActiva);
    const shGestion = ss.getSheetByName(PORTAL_COMPRAS.hojaGestion);

    if (!shActiva || !shGestion) {
      throw new Error('No se encontraron las hojas de gestión.');
    }

    const ia = construirIndiceSkuPortal_(shActiva);
    const ig = construirIndiceSkuPortal_(shGestion);

    const cEstado = buscarColumnaPortal_(ia.idx, ['ESTADO_GESTION']);
    const cCantidad = buscarColumnaPortal_(ia.idx, ['CANTIDAD_DECIDIDA']);

    if (cEstado < 0 || cCantidad < 0) {
      throw new Error(
        'GESTION_COMPRAS_ACTIVA no contiene ESTADO_GESTION o CANTIDAD_DECIDIDA.'
      );
    }

    const datos = shActiva.getDataRange().getValues();
    const filasActiva = [];
    const filasGestion = [];
    const invalidos = [];

    claves.forEach(function(clave) {

      const fa = ia.filasPorSku.get(clave);
      const fg = ig.filasPorSku.get(clave);

      if (!fa || !fg) {
        invalidos.push(clave + ' (no encontrado)');
        return;
      }

      const fila = datos[fa - 1];
      const estado = String(fila[cEstado] || '').trim().toUpperCase();
      const cantidad = numeroPortalCompras_(fila[cCantidad]);

      if (estado !== 'APROBADO' || cantidad <= 0) {
        invalidos.push(clave + ' (ya no está APROBADO con cantidad > 0)');
        return;
      }

      filasActiva.push(fa);
      filasGestion.push(fg);
    });

    if (invalidos.length > 0) {
      throw new Error(
        'No se realizó ningún envío. Actualizá la bandeja e intentá nuevamente:\n' +
        invalidos.join('\n')
      );
    }

    const responsable = nombreUsuarioPortalCompras_(email);
    const fecha = new Date();

    // Foto histórica antes de cambiar el estado.
    const shEnvios = obtenerHojaEnviosCompraPortal_(ss);
    const nroEnvio = generarNumeroEnvioCompraPortal_(shEnvios, fecha);
    const h = ia.idx;

    const valor = function(fila, nombre) {
      const c = h[nombre];
      return c === undefined ? '' : datos[fila - 1][c];
    };

    const filasHistorial = filasActiva.map(function(fila) {
      return [
        nroEnvio,
        fecha,
        email,
        valor(fila,'SKU'),
        valor(fila,'DESCRIPCION'),
        valor(fila,'MARCA'),
        valor(fila,'RIESGO'),
        numeroPortalCompras_(valor(fila,'COMPRA_SUGERIDA')),
        numeroPortalCompras_(valor(fila,'CANTIDAD_DECIDIDA')),
        valor(fila,'RESPONSABLE'),
        valor(fila,'OBSERVACION'),
        valor(fila,'FECHA_DECISION')
      ];
    });

    shEnvios.getRange(
      shEnvios.getLastRow()+1,
      1,
      filasHistorial.length,
      filasHistorial[0].length
    ).setValues(filasHistorial);

    [
      [shActiva, filasActiva, ia.idx],
      [shGestion, filasGestion, ig.idx]
    ].forEach(function(x) {
      aplicarValorMasivoPortal_(x[0], x[1], x[2], 'ESTADO_GESTION', 'ENVIADO A COMPRA');
      aplicarValorMasivoPortal_(x[0], x[1], x[2], 'RESPONSABLE', responsable);
      aplicarValorMasivoPortal_(x[0], x[1], x[2], 'FECHA_DECISION', fecha);
    });

    aplicarValorMasivoPortal_(
      shGestion, filasGestion, ig.idx, 'ULTIMA_ACTUALIZACION', fecha
    );

    SpreadsheetApp.flush();

    return {
      ok: true,
      cantidad: claves.length,
      estadoGestion: 'ENVIADO A COMPRA',
      nroEnvio: nroEnvio,
      responsable: responsable,
      fecha: formatearFechaPortalCompras_(fecha)
    };

  } finally {
    lock.releaseLock();
  }
}



/**
 * ============================================================
 * TRAZABILIDAD DE ENVÍOS A COMPRA - B.1.8-F.2
 * ============================================================
 */
function obtenerHojaEnviosCompraPortal_(ss) {
  let sh = ss.getSheetByName(PORTAL_COMPRAS.hojaEnviosCompra);

  const headers = [
    'NRO_ENVIO','FECHA_ENVIO','USUARIO_ENVIO','SKU','DESCRIPCION',
    'MARCA','RIESGO','COMPRA_SUGERIDA','CANTIDAD_DECIDIDA',
    'RESPONSABLE_DECISION','OBSERVACION','FECHA_DECISION'
  ];

  if (!sh) {
    sh = ss.insertSheet(PORTAL_COMPRAS.hojaEnviosCompra);
    sh.getRange(1,1,1,headers.length)
      .setValues([headers])
      .setFontWeight('bold')
      .setBackground('#123d6a')
      .setFontColor('white');
    sh.setFrozenRows(1);
  }

  return sh;
}


function generarNumeroEnvioCompraPortal_(sh, fecha) {
  const prefijo =
    'EC-' +
    Utilities.formatDate(fecha, Session.getScriptTimeZone(), 'yyyyMMdd') +
    '-';

  let maximo = 0;

  if (sh.getLastRow() >= 2) {
    sh.getRange(2,1,sh.getLastRow()-1,1)
      .getDisplayValues()
      .forEach(function(f) {
        const nro = String(f[0] || '').trim();
        if (nro.indexOf(prefijo) !== 0) return;
        const n = Number(nro.substring(prefijo.length));
        if (!isNaN(n) && n > maximo) maximo = n;
      });
  }

  return prefijo + String(maximo + 1).padStart(4,'0');
}


function obtenerEnviosCompraPortal(tokenPortal) {
  validarUsuarioPortalCompras_(tokenPortal);

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = obtenerHojaEnviosCompraPortal_(ss);

  if (sh.getLastRow() < 2) {
    return {envios:[], resumen:{envios:0,sku:0,unidades:0}};
  }

  const v = sh.getDataRange().getValues();
  const headers = v[0].map(normalizarPortalCompras_);
  const idx = {};
  headers.forEach(function(h,i){ idx[h]=i; });

  const grupos = {};

  for (let f=1; f<v.length; f++) {
    const fila = v[f];
    const nro = String(fila[idx.NRO_ENVIO] || '').trim();
    if (!nro) continue;

    if (!grupos[nro]) {
      grupos[nro] = {
        nroEnvio:nro,
        fechaEnvio:formatearFechaPortalCompras_(fila[idx.FECHA_ENVIO]),
        usuarioEnvio:String(fila[idx.USUARIO_ENVIO] || ''),
        sku:0, unidades:0, marcas:{}, detalle:[], ocs:[]
      };
    }

    const g = grupos[nro];
    const cantidad = numeroPortalCompras_(fila[idx.CANTIDAD_DECIDIDA]);
    const marca = String(fila[idx.MARCA] || 'SIN MARCA').trim() || 'SIN MARCA';

    g.sku++;
    g.unidades += cantidad;
    g.marcas[marca] = true;

    g.detalle.push({
      sku:String(fila[idx.SKU] || ''),
      descripcion:String(fila[idx.DESCRIPCION] || ''),
      marca:marca,
      riesgo:String(fila[idx.RIESGO] || ''),
      compraSugerida:numeroPortalCompras_(fila[idx.COMPRA_SUGERIDA]),
      cantidadDecidida:cantidad,
      responsableDecision:String(fila[idx.RESPONSABLE_DECISION] || ''),
      observacion:String(fila[idx.OBSERVACION] || ''),
      fechaDecision:formatearFechaPortalCompras_(fila[idx.FECHA_DECISION])
    });
  }

  const shOc = ss.getSheetByName(PORTAL_COMPRAS.hojaOrdenesCompraPortal);

  if (shOc && shOc.getLastRow() >= 2) {
    const vo = shOc.getDataRange().getDisplayValues();
    const ho = vo[0].map(normalizarPortalCompras_);
    const io = {};
    ho.forEach(function(h,i){ io[h]=i; });

    const vistos = {};

    for (let r=1; r<vo.length; r++) {
      const nroEnvio = String(vo[r][io.NRO_ENVIO] || '').trim();
      const nroOc = String(vo[r][io.NRO_OC] || '').trim();
      const proveedor = String(vo[r][io.PROVEEDOR] || '').trim();

      if (!nroEnvio || !nroOc || !grupos[nroEnvio]) continue;

      const clave = nroEnvio + '|' + nroOc;
      if (vistos[clave]) continue;
      vistos[clave] = true;

      grupos[nroEnvio].ocs.push({
        nroOc:nroOc,
        proveedor:proveedor
      });
    }
  }

  const envios = Object.values(grupos).map(function(g){
    g.marcas = Object.keys(g.marcas).length;
    g.ocs.sort(function(a,b){ return a.nroOc.localeCompare(b.nroOc); });
    return g;
  }).sort(function(a,b){
    return b.nroEnvio.localeCompare(a.nroEnvio);
  });

  let sku=0, unidades=0;
  envios.forEach(function(e){ sku += e.sku; unidades += e.unidades; });

  return {
    envios:envios,
    resumen:{
      envios:envios.length,
      sku:sku,
      unidades:unidades
    }
  };
}





/**
 * ============================================================
 * B.1.9-D.6 - GENERACIÓN Y PERSISTENCIA DE OC
 * ============================================================
 */
function obtenerHojaOrdenesCompraPortal_(ss) {
  let sh = ss.getSheetByName(PORTAL_COMPRAS.hojaOrdenesCompraPortal);
  const headers = [
    'NRO_OC','FECHA_OC','NRO_ENVIO','PROVEEDOR','SKU','DESCRIPCION',
    'MARCA','CANTIDAD','OBSERVACION','USUARIO','ULTIMA_ACTUALIZACION'
  ];
  if (!sh) sh = ss.insertSheet(PORTAL_COMPRAS.hojaOrdenesCompraPortal);
  if (sh.getLastRow() === 0 || sh.getLastColumn() === 0) {
    sh.getRange(1,1,1,headers.length).setValues([headers])
      .setFontWeight('bold').setBackground('#123d6a').setFontColor('white');
    sh.setFrozenRows(1);
  }
  return sh;
}

function siguienteNumeroOcPortal_(ss) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const sh = obtenerHojaOrdenesCompraPortal_(ss);
    const anio = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy');
    let maximo = 0;
    if (sh.getLastRow() >= 2) {
      const valores = sh.getRange(2,1,sh.getLastRow()-1,1).getDisplayValues();
      const re = new RegExp('^OC-' + anio + '-(\\d+)$');
      valores.forEach(function(f) {
        const m = String(f[0] || '').trim().match(re);
        if (m) maximo = Math.max(maximo, Number(m[1]) || 0);
      });
    }
    return 'OC-' + anio + '-' + String(maximo + 1).padStart(4,'0');
  } finally {
    lock.releaseLock();
  }
}

function obtenerProveedoresOcPortal(tokenPortal) {
  validarUsuarioPortalCompras_(tokenPortal);
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const proveedores = {};
  [
    PORTAL_COMPRAS.hojaProcesoCompra,
    PORTAL_COMPRAS.hojaOrdenesCompraPortal
  ].forEach(function(nombre) {
    const sh = ss.getSheetByName(nombre);
    if (!sh || sh.getLastRow() < 2) return;
    const v = sh.getDataRange().getDisplayValues();
    const h = v[0].map(normalizarPortalCompras_);
    const c = h.indexOf('PROVEEDOR');
    if (c < 0) return;
    for (let i=1; i<v.length; i++) {
      const p = String(v[i][c] || '').trim();
      if (p) proveedores[p.toUpperCase()] = p;
    }
  });
  return Object.keys(proveedores).sort().map(function(k){ return proveedores[k]; });
}

function obtenerOcsDeEnvioPortal(nroEnvio, tokenPortal) {
  validarUsuarioPortalCompras_(tokenPortal);
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = obtenerHojaOrdenesCompraPortal_(ss);
  if (sh.getLastRow() < 2) return {ocs:[], skusAsignados:[]};
  const v = sh.getDataRange().getDisplayValues();
  const h = v[0].map(normalizarPortalCompras_);
  const idx = {}; h.forEach(function(x,i){idx[x]=i;});
  const mapa = {}, skus = {};
  for (let r=1; r<v.length; r++) {
    if (String(v[r][idx.NRO_ENVIO] || '').trim() !== String(nroEnvio || '').trim()) continue;
    const nro = String(v[r][idx.NRO_OC] || '').trim();
    if (!mapa[nro]) mapa[nro] = {
      nroOc:nro, fecha:String(v[r][idx.FECHA_OC]||''), proveedor:String(v[r][idx.PROVEEDOR]||''),
      sku:0, unidades:0
    };
    mapa[nro].sku++;
    mapa[nro].unidades += numeroPortalCompras_(v[r][idx.CANTIDAD]);
    skus[normalizarClavePortalCompras_(v[r][idx.SKU])] = nro;
  }
  return {ocs:Object.values(mapa).sort(function(a,b){return b.nroOc.localeCompare(a.nroOc);}), skusAsignados:skus};
}

function generarOrdenCompraPortal(datos, tokenPortal) {
  const email = validarUsuarioPortalCompras_(tokenPortal);
  datos = datos || {};
  const nroEnvio = String(datos.nroEnvio || '').trim();
  const proveedor = String(datos.proveedor || '').trim();
  const skusSolicitados = (datos.skus || []).map(normalizarClavePortalCompras_).filter(Boolean);
  if (!nroEnvio) throw new Error('Falta el número de envío.');
  if (!proveedor) throw new Error('Seleccioná o ingresá un proveedor.');
  if (!skusSolicitados.length) throw new Error('Seleccioná al menos un SKU.');

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const shOc = obtenerHojaOrdenesCompraPortal_(ss);
    const existentes = {};
    if (shOc.getLastRow() >= 2) {
      const vv = shOc.getDataRange().getDisplayValues();
      const hh = vv[0].map(normalizarPortalCompras_);
      const ii = {}; hh.forEach(function(x,i){ii[x]=i;});
      for (let r=1; r<vv.length; r++) {
        if (String(vv[r][ii.NRO_ENVIO]||'').trim() === nroEnvio)
          existentes[normalizarClavePortalCompras_(vv[r][ii.SKU])] = String(vv[r][ii.NRO_OC]||'');
      }
    }
    const repetidos = skusSolicitados.filter(function(s){return existentes[s];});
    if (repetidos.length) throw new Error('Hay SKU que ya pertenecen a una OC: ' + repetidos.join(', '));

    const shEnv = obtenerHojaEnviosCompraPortal_(ss);
    const env = shEnv.getDataRange().getValues();
    const he = env[0].map(normalizarPortalCompras_);
    const ie = {}; he.forEach(function(x,i){ie[x]=i;});
    const solicitados = new Set(skusSolicitados);
    const items = [];
    for (let r=1; r<env.length; r++) {
      if (String(env[r][ie.NRO_ENVIO]||'').trim() !== nroEnvio) continue;
      const sku = normalizarClavePortalCompras_(env[r][ie.SKU]);
      if (!solicitados.has(sku)) continue;
      items.push({
        sku:String(env[r][ie.SKU]||'').trim(),
        descripcion:String(env[r][ie.DESCRIPCION]||'').trim(),
        marca:String(env[r][ie.MARCA]||'').trim(),
        cantidad:numeroPortalCompras_(env[r][ie.CANTIDAD_DECIDIDA]),
        observacion:String(env[r][ie.OBSERVACION]||'').trim()
      });
    }
    if (items.length !== skusSolicitados.length)
      throw new Error('No se encontraron todos los SKU seleccionados dentro del envío.');

    // El correlativo se calcula dentro del mismo lock.
    const anio = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy');
    let maximo = 0;
    if (shOc.getLastRow() >= 2) {
      const nums = shOc.getRange(2,1,shOc.getLastRow()-1,1).getDisplayValues();
      const re = new RegExp('^OC-' + anio + '-(\\d+)$');
      nums.forEach(function(f){const m=String(f[0]||'').match(re); if(m) maximo=Math.max(maximo,Number(m[1])||0);});
    }
    const nroOc = 'OC-' + anio + '-' + String(maximo+1).padStart(4,'0');
    const ahora = new Date();
    const fechaTxt = Utilities.formatDate(ahora, Session.getScriptTimeZone(), 'dd/MM/yyyy HH:mm');
    const usuario = nombreUsuarioPortalCompras_(email);
    const filas = items.map(function(i){
      return [nroOc,fechaTxt,nroEnvio,proveedor,i.sku,i.descripcion,i.marca,i.cantidad,i.observacion,usuario,ahora];
    });
    shOc.getRange(shOc.getLastRow()+1,1,filas.length,filas[0].length).setValues(filas);

    // Deja proveedor asociado también en COMPRAS_EN_PROCESO.
    const shP = obtenerHojaProcesoCompraPortal_(ss);
    if (shP.getLastRow() >= 2) {
      const vp = shP.getDataRange().getValues();
      const hp = vp[0].map(normalizarPortalCompras_);
      const ip = {}; hp.forEach(function(x,i){ip[x]=i;});
      for (let r=1; r<vp.length; r++) {
        if (String(vp[r][ip.NRO_ENVIO]||'').trim() !== nroEnvio) continue;
        if (!solicitados.has(normalizarClavePortalCompras_(vp[r][ip.SKU]))) continue;
        shP.getRange(r+1,ip.PROVEEDOR+1).setValue(proveedor);
        shP.getRange(r+1,ip.ULTIMA_ACTUALIZACION+1).setValue(ahora);
      }
    }
    return {ok:true,nroOc:nroOc,nroEnvio:nroEnvio,proveedor:proveedor,sku:items.length};
  } finally {
    lock.releaseLock();
  }
}

function obtenerOrdenCompraPorNumeroPortal(nroOc, tokenPortal) {
  validarUsuarioPortalCompras_(tokenPortal);
  nroOc = String(nroOc || '').trim();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = obtenerHojaOrdenesCompraPortal_(ss);
  if (sh.getLastRow() < 2) throw new Error('No hay órdenes de compra registradas.');
  const v = sh.getDataRange().getDisplayValues();
  const h = v[0].map(normalizarPortalCompras_);
  const idx={}; h.forEach(function(x,i){idx[x]=i;});
  const items=[]; let cab=null;
  for(let r=1;r<v.length;r++){
    if(String(v[r][idx.NRO_OC]||'').trim()!==nroOc) continue;
    if(!cab) cab={nroOc:nroOc,fecha:String(v[r][idx.FECHA_OC]||''),nroEnvio:String(v[r][idx.NRO_ENVIO]||''),proveedor:String(v[r][idx.PROVEEDOR]||''),usuario:String(v[r][idx.USUARIO]||'')};
    items.push({sku:String(v[r][idx.SKU]||''),descripcion:String(v[r][idx.DESCRIPCION]||''),marca:String(v[r][idx.MARCA]||''),cantidad:numeroPortalCompras_(v[r][idx.CANTIDAD]),observacion:String(v[r][idx.OBSERVACION]||'')});
  }
  if(!cab) throw new Error('No se encontró la OC ' + nroOc + '.');

  /*
   * D.8.4 - Si el Packing List ya fue importado y vinculado con
   * esta OC, se muestra automáticamente al reimprimir la OC.
   * No se duplica el dato en ORDENES_COMPRA_PORTAL.
   */
  const packing = new Set();
  const shPlDet = ss.getSheetByName(PORTAL_COMPRAS.hojaPackingListDetalle);
  if (shPlDet && shPlDet.getLastRow() >= 2) {
    const vp = shPlDet.getDataRange().getDisplayValues();
    const hp = vp[0].map(normalizarPortalCompras_);
    const ip = {}; hp.forEach(function(x,i){ip[x]=i;});
    const cOcInterna = buscarColumnaPortal_(ip,['OC_INTERNA']);
    const cIdPl = buscarColumnaPortal_(ip,['ID_PL','PACKING_LIST']);
    if (cOcInterna >= 0 && cIdPl >= 0) {
      for (let r=1; r<vp.length; r++) {
        if (String(vp[r][cOcInterna] || '').trim() !== nroOc) continue;
        const pl = String(vp[r][cIdPl] || '').trim();
        if (pl) packing.add(pl);
      }
    }
  }

  cab.packingList = Array.from(packing).sort().join(', ');
  cab.items=items; cab.unidades=items.reduce(function(a,x){return a+x.cantidad;},0);
  cab.generado=Utilities.formatDate(new Date(),Session.getScriptTimeZone(),'dd/MM/yyyy HH:mm');
  return cab;
}


/**
 * ============================================================
 * B.1.9-D.5 - ORDEN DE COMPRA IMPRIMIBLE DESDE ENVIADOS A COMPRA
 * ============================================================
 *
 * La OC no incluye precio, moneda ni importes.
 *
 * Fuente principal:
 *   ENVIOS_COMPRA -> foto histórica del lote EC.
 *
 * Complemento:
 *   COMPRAS_EN_PROCESO -> proveedor y observación operativa,
 *   si ya fueron informados.
 *
 * Si un mismo EC contiene más de un proveedor, el resultado se
 * separa en una página/grupo por proveedor.
 * ============================================================
 */
function obtenerOrdenCompraEnvioPortal(
  nroEnvio,
  tokenPortal
) {

  validarUsuarioPortalCompras_(
    tokenPortal
  );

  nroEnvio =
    String(
      nroEnvio || ''
    ).trim();

  if (!nroEnvio) {
    throw new Error(
      'Falta el número de envío.'
    );
  }

  const ss =
    SpreadsheetApp.getActiveSpreadsheet();

  const shEnvios =
    obtenerHojaEnviosCompraPortal_(
      ss
    );

  if (
    shEnvios.getLastRow() < 2
  ) {
    throw new Error(
      'No hay envíos registrados.'
    );
  }

  const env =
    shEnvios.getRange(
      1,
      1,
      shEnvios.getLastRow(),
      shEnvios.getLastColumn()
    )
    .getValues();

  const he =
    env[0].map(
      normalizarPortalCompras_
    );

  const ie = {};

  he.forEach(
    function(h, i) {
      ie[h] = i;
    }
  );

  const detalleEnvio = [];
  let fechaEnvio = '';
  let usuarioEnvio = '';

  for (
    let r = 1;
    r < env.length;
    r++
  ) {

    if (
      String(
        env[r][ie.NRO_ENVIO] || ''
      ).trim() !== nroEnvio
    ) {
      continue;
    }

    fechaEnvio =
      fechaEnvio ||
      formatearFechaPortalCompras_(
        env[r][ie.FECHA_ENVIO]
      );

    usuarioEnvio =
      usuarioEnvio ||
      String(
        env[r][ie.USUARIO_ENVIO] || ''
      ).trim();

    detalleEnvio.push({
      sku:
        String(
          env[r][ie.SKU] || ''
        ).trim(),
      descripcion:
        String(
          env[r][ie.DESCRIPCION] || ''
        ).trim(),
      marca:
        String(
          env[r][ie.MARCA] || ''
        ).trim(),
      cantidad:
        numeroPortalCompras_(
          env[r][ie.CANTIDAD_DECIDIDA]
        ),
      responsable:
        String(
          env[r][ie.RESPONSABLE_DECISION] || ''
        ).trim(),
      observacion:
        String(
          env[r][ie.OBSERVACION] || ''
        ).trim()
    });
  }

  if (
    detalleEnvio.length === 0
  ) {
    throw new Error(
      'No se encontró el envío ' +
      nroEnvio +
      '.'
    );
  }

  /*
   * Complementamos con proveedor y observación desde
   * COMPRAS_EN_PROCESO. No exigimos que ya estén cargados.
   */
  const proveedorPorSku = {};
  const observacionProcesoPorSku = {};

  const shProceso =
    ss.getSheetByName(
      PORTAL_COMPRAS.hojaProcesoCompra
    );

  if (
    shProceso &&
    shProceso.getLastRow() >= 2
  ) {

    const proc =
      shProceso.getRange(
        1,
        1,
        shProceso.getLastRow(),
        shProceso.getLastColumn()
      )
      .getValues();

    const hp =
      proc[0].map(
        normalizarPortalCompras_
      );

    const ip = {};

    hp.forEach(
      function(h, i) {
        ip[h] = i;
      }
    );

    for (
      let r = 1;
      r < proc.length;
      r++
    ) {

      if (
        String(
          proc[r][ip.NRO_ENVIO] || ''
        ).trim() !== nroEnvio
      ) {
        continue;
      }

      const sku =
        normalizarClavePortalCompras_(
          proc[r][ip.SKU]
        );

      if (!sku) {
        continue;
      }

      proveedorPorSku[sku] =
        String(
          proc[r][ip.PROVEEDOR] || ''
        ).trim();

      observacionProcesoPorSku[sku] =
        String(
          proc[r][ip.OBSERVACION_COMPRA] || ''
        ).trim();
    }
  }

  /*
   * Agrupa por proveedor. Los SKU sin proveedor quedan bajo
   * "A DEFINIR" para poder imprimir igualmente el documento.
   */
  const gruposMap = {};

  detalleEnvio.forEach(
    function(item) {

      const claveSku =
        normalizarClavePortalCompras_(
          item.sku
        );

      const proveedor =
        proveedorPorSku[
          claveSku
        ] ||
        'A DEFINIR';

      if (
        !gruposMap[proveedor]
      ) {
        gruposMap[proveedor] = {
          proveedor:
            proveedor,
          items:
            [],
          unidades:
            0
        };
      }

      const observacionProceso =
        observacionProcesoPorSku[
          claveSku
        ] || '';

      gruposMap[proveedor]
        .items
        .push({
          sku:
            item.sku,
          descripcion:
            item.descripcion,
          marca:
            item.marca,
          cantidad:
            item.cantidad,
          responsable:
            item.responsable,
          observacion:
            observacionProceso ||
            item.observacion
        });

      gruposMap[proveedor]
        .unidades +=
          item.cantidad;
    }
  );

  const grupos =
    Object.keys(
      gruposMap
    )
    .sort(
      function(a, b) {
        if (a === 'A DEFINIR') return 1;
        if (b === 'A DEFINIR') return -1;
        return a.localeCompare(
          b,
          'es'
        );
      }
    )
    .map(
      function(proveedor, i) {

        const grupo =
          gruposMap[
            proveedor
          ];

        grupo.nroOrden =
          gruposMap &&
          Object.keys(
            gruposMap
          ).length > 1
            ? nroEnvio +
              '-' +
              String(
                i + 1
              ).padStart(
                2,
                '0'
              )
            : nroEnvio;

        return grupo;
      }
    );

  let unidadesTotal = 0;

  grupos.forEach(
    function(g) {
      unidadesTotal +=
        g.unidades;
    }
  );

  return {
    ok:
      true,

    nroEnvio:
      nroEnvio,

    fecha:
      fechaEnvio,

    usuario:
      usuarioEnvio,

    sku:
      detalleEnvio.length,

    unidades:
      unidadesTotal,

    grupos:
      grupos,

    generado:
      Utilities.formatDate(
        new Date(),
        Session.getScriptTimeZone(),
        'dd/MM/yyyy HH:mm'
      )
  };
}


/**
 * ============================================================
 * COMPRAS EN PROCESO - B.1.9-C
 *
 * El lote EC sigue siendo una solicitud.
 * La gestión se lleva por SKU dentro del lote para permitir
 * distintos proveedores y, más adelante, varias OC por EC.
 * ============================================================
 */
function obtenerHojaProcesoCompraPortal_(ss) {

  let sh =
    ss.getSheetByName(
      PORTAL_COMPRAS.hojaProcesoCompra
    );

  const headers = [
    'NRO_ENVIO',
    'FECHA_ENVIO',
    'USUARIO_ENVIO',
    'SKU',
    'DESCRIPCION',
    'MARCA',
    'CANTIDAD_SOLICITADA',
    'ESTADO_COMPRA',
    'PROVEEDOR',
    'CANTIDAD_COMPRADA',
    'OBSERVACION_COMPRA',
    'RESPONSABLE_COMPRA',
    'FECHA_GESTION',
    'FECHA_COMPRA',
    'ULTIMA_ACTUALIZACION'
  ];

  if (!sh) {

    sh =
      ss.insertSheet(
        PORTAL_COMPRAS.hojaProcesoCompra
      );

    sh.getRange(
      1,
      1,
      1,
      headers.length
    )
    .setValues([
      headers
    ])
    .setFontWeight(
      'bold'
    )
    .setBackground(
      '#123d6a'
    )
    .setFontColor(
      'white'
    );

    sh.setFrozenRows(1);
  }

  return sh;
}


/**
 * Incorpora automáticamente a COMPRAS_EN_PROCESO los SKU que
 * existan en ENVIOS_COMPRA y todavía no estén registrados.
 */
function sincronizarProcesoComprasPortal_(ss) {

  const shEnvios =
    obtenerHojaEnviosCompraPortal_(
      ss
    );

  const shProceso =
    obtenerHojaProcesoCompraPortal_(
      ss
    );

  if (
    shEnvios.getLastRow() <
    2
  ) {
    return 0;
  }

  const datosEnvios =
    shEnvios
      .getDataRange()
      .getValues();

  const headersEnvios =
    datosEnvios[0]
      .map(
        normalizarPortalCompras_
      );

  const ie = {};

  headersEnvios.forEach(
    function(h, i) {
      ie[h] = i;
    }
  );

  const existentes =
    new Set();

  if (
    shProceso.getLastRow() >=
    2
  ) {

    const datosProceso =
      shProceso
        .getDataRange()
        .getDisplayValues();

    const hp =
      datosProceso[0]
        .map(
          normalizarPortalCompras_
        );

    const ip = {};

    hp.forEach(
      function(h, i) {
        ip[h] = i;
      }
    );

    for (
      let f = 1;
      f < datosProceso.length;
      f++
    ) {

      const nro =
        String(
          datosProceso[f][
            ip.NRO_ENVIO
          ] || ''
        ).trim();

      const sku =
        normalizarClavePortalCompras_(
          datosProceso[f][
            ip.SKU
          ]
        );

      if (
        nro &&
        sku
      ) {
        existentes.add(
          nro + '|' + sku
        );
      }
    }
  }

  const nuevas = [];

  for (
    let f = 1;
    f < datosEnvios.length;
    f++
  ) {

    const fila =
      datosEnvios[f];

    const nro =
      String(
        fila[
          ie.NRO_ENVIO
        ] || ''
      ).trim();

    const sku =
      normalizarClavePortalCompras_(
        fila[
          ie.SKU
        ]
      );

    if (
      !nro ||
      !sku
    ) {
      continue;
    }

    const clave =
      nro +
      '|' +
      sku;

    if (
      existentes.has(
        clave
      )
    ) {
      continue;
    }

    nuevas.push([
      nro,
      fila[
        ie.FECHA_ENVIO
      ],
      fila[
        ie.USUARIO_ENVIO
      ],
      fila[
        ie.SKU
      ],
      fila[
        ie.DESCRIPCION
      ],
      fila[
        ie.MARCA
      ],
      numeroPortalCompras_(
        fila[
          ie.CANTIDAD_DECIDIDA
        ]
      ),
      'PENDIENTE',
      '',
      '',
      '',
      '',
      '',
      '',
      new Date()
    ]);

    existentes.add(
      clave
    );
  }

  if (
    nuevas.length >
    0
  ) {

    shProceso.getRange(
      shProceso.getLastRow() + 1,
      1,
      nuevas.length,
      nuevas[0].length
    )
    .setValues(
      nuevas
    );
  }

  return nuevas.length;
}


/**
 * Devuelve toda la bandeja operativa posterior al envío EC.
 */
function obtenerComprasEnProcesoPortal(tokenPortal) {

  validarUsuarioPortalCompras_(tokenPortal);

  const ss =
    SpreadsheetApp.getActiveSpreadsheet();

  sincronizarProcesoComprasPortal_(
    ss
  );

  const sh =
    obtenerHojaProcesoCompraPortal_(
      ss
    );

  if (
    sh.getLastRow() <
    2
  ) {

    return {
      actualizado:
        Utilities.formatDate(
          new Date(),
          Session.getScriptTimeZone(),
          'dd/MM/yyyy HH:mm'
        ),
      registros: [],
      estados:
        PORTAL_COMPRAS
          .estadosProcesoCompra
          .slice(),
      marcas: [],
      proveedores: [],
      resumen: {
        lotes: 0,
        sku: 0,
        unidadesSolicitadas: 0,
        unidadesCompradas: 0
      }
    };
  }

  const valores =
    sh.getDataRange()
      .getValues();

  const headers =
    valores[0]
      .map(
        normalizarPortalCompras_
      );

  const idx = {};

  headers.forEach(
    function(h, i) {
      idx[h] = i;
    }
  );

  const registros = [];
  const lotes =
    new Set();
  const marcas =
    new Set();
  const proveedores =
    new Set();

  let unidadesSolicitadas =
    0;

  let unidadesCompradas =
    0;

  for (
    let f = 1;
    f < valores.length;
    f++
  ) {

    const fila =
      valores[f];

    const nroEnvio =
      String(
        fila[
          idx.NRO_ENVIO
        ] || ''
      ).trim();

    const sku =
      String(
        fila[
          idx.SKU
        ] || ''
      ).trim();

    if (
      !nroEnvio ||
      !sku
    ) {
      continue;
    }

    const marca =
      String(
        fila[
          idx.MARCA
        ] || 'SIN MARCA'
      ).trim() ||
      'SIN MARCA';

    const proveedor =
      String(
        fila[
          idx.PROVEEDOR
        ] || ''
      ).trim();

    const cantidadSolicitada =
      numeroPortalCompras_(
        fila[
          idx.CANTIDAD_SOLICITADA
        ]
      );

    const cantidadComprada =
      numeroPortalCompras_(
        fila[
          idx.CANTIDAD_COMPRADA
        ]
      );

    lotes.add(
      nroEnvio
    );

    marcas.add(
      marca
    );

    if (
      proveedor
    ) {
      proveedores.add(
        proveedor
      );
    }

    unidadesSolicitadas +=
      cantidadSolicitada;

    unidadesCompradas +=
      cantidadComprada;

    registros.push({
      nroEnvio:
        nroEnvio,

      fechaEnvio:
        formatearFechaPortalCompras_(
          fila[
            idx.FECHA_ENVIO
          ]
        ),

      usuarioEnvio:
        String(
          fila[
            idx.USUARIO_ENVIO
          ] || ''
        ),

      sku:
        sku,

      descripcion:
        String(
          fila[
            idx.DESCRIPCION
          ] || ''
        ),

      marca:
        marca,

      cantidadSolicitada:
        cantidadSolicitada,

      estadoCompra:
        String(
          fila[
            idx.ESTADO_COMPRA
          ] || 'PENDIENTE'
        )
        .trim()
        .toUpperCase(),

      proveedor:
        proveedor,

      cantidadComprada:
        cantidadComprada,

      saldoPendiente:
        Math.max(
          cantidadSolicitada -
          cantidadComprada,
          0
        ),

      observacionCompra:
        String(
          fila[
            idx.OBSERVACION_COMPRA
          ] || ''
        ),

      responsableCompra:
        String(
          fila[
            idx.RESPONSABLE_COMPRA
          ] || ''
        ),

      fechaGestion:
        formatearFechaPortalCompras_(
          fila[
            idx.FECHA_GESTION
          ]
        ),

      fechaCompra:
        formatearFechaPortalCompras_(
          fila[
            idx.FECHA_COMPRA
          ]
        )
    });
  }

  registros.sort(
    function(a, b) {

      const lote =
        b.nroEnvio
          .localeCompare(
            a.nroEnvio
          );

      if (
        lote !==
        0
      ) {
        return lote;
      }

      return a.sku
        .localeCompare(
          b.sku,
          'es'
        );
    }
  );

  return {
    actualizado:
      Utilities.formatDate(
        new Date(),
        Session.getScriptTimeZone(),
        'dd/MM/yyyy HH:mm'
      ),

    registros:
      registros,

    estados:
      PORTAL_COMPRAS
        .estadosProcesoCompra
        .slice(),

    marcas:
      Array.from(
        marcas
      ).sort(
        function(a, b) {
          return a.localeCompare(
            b,
            'es'
          );
        }
      ),

    proveedores:
      Array.from(
        proveedores
      ).sort(
        function(a, b) {
          return a.localeCompare(
            b,
            'es'
          );
        }
      ),

    resumen: {
      lotes:
        lotes.size,
      sku:
        registros.length,
      unidadesSolicitadas:
        unidadesSolicitadas,
      unidadesCompradas:
        unidadesCompradas
    }
  };
}


/**
 * Guarda la gestión operativa de un SKU dentro de un lote EC.
 */
function guardarProcesoCompraPortal(
  datos,
  tokenPortal
) {

  const email =
    validarUsuarioPortalCompras_(tokenPortal);

  if (
    !datos ||
    typeof datos !==
    'object'
  ) {
    throw new Error(
      'No se recibieron datos de la compra.'
    );
  }

  const nroEnvio =
    String(
      datos.nroEnvio || ''
    ).trim();

  const sku =
    String(
      datos.sku || ''
    ).trim();

  const estado =
    String(
      datos.estadoCompra || ''
    )
    .trim()
    .toUpperCase();

  const proveedor =
    String(
      datos.proveedor || ''
    ).trim();

  const observacion =
    String(
      datos.observacionCompra || ''
    ).trim();

  let cantidadMovimiento =
    datos.cantidadMovimiento;

  if (
    !nroEnvio ||
    !sku
  ) {
    throw new Error(
      'El lote y el SKU son obligatorios.'
    );
  }

  if (
    !PORTAL_COMPRAS
      .estadosProcesoCompra
      .includes(
        estado
      )
  ) {
    throw new Error(
      'Estado de compra no válido.'
    );
  }

  if (
    cantidadMovimiento === '' ||
    cantidadMovimiento === null ||
    cantidadMovimiento === undefined
  ) {
    cantidadMovimiento = 0;
  } else {

    cantidadMovimiento =
      Number(
        cantidadMovimiento
      );

    if (
      !isFinite(
        cantidadMovimiento
      ) ||
      cantidadMovimiento <
      0
    ) {
      throw new Error(
        'La cantidad de esta compra debe ser un número mayor o igual a cero.'
      );
    }
  }

  if (
    observacion.length >
    1000
  ) {
    throw new Error(
      'La observación no puede superar los 1000 caracteres.'
    );
  }

  const lock =
    LockService.getDocumentLock();

  lock.waitLock(
    30000
  );

  try {

    const ss =
      SpreadsheetApp.getActiveSpreadsheet();

    sincronizarProcesoComprasPortal_(
      ss
    );

    const sh =
      obtenerHojaProcesoCompraPortal_(
        ss
      );

    const valores =
      sh.getDataRange()
        .getValues();

    const headers =
      valores[0]
        .map(
          normalizarPortalCompras_
        );

    const idx = {};

    headers.forEach(
      function(h, i) {
        idx[h] = i;
      }
    );

    let filaEncontrada =
      -1;

    const claveSku =
      normalizarClavePortalCompras_(
        sku
      );

    for (
      let f = 1;
      f < valores.length;
      f++
    ) {

      const nroFila =
        String(
          valores[f][
            idx.NRO_ENVIO
          ] || ''
        ).trim();

      const skuFila =
        normalizarClavePortalCompras_(
          valores[f][
            idx.SKU
          ]
        );

      if (
        nroFila === nroEnvio &&
        skuFila === claveSku
      ) {

        filaEncontrada =
          f + 1;

        break;
      }
    }

    if (
      filaEncontrada <
      0
    ) {
      throw new Error(
        'No se encontró el SKU dentro del lote seleccionado.'
      );
    }

    const filaActual =
      valores[
        filaEncontrada - 1
      ];

    const cantidadSolicitada =
      numeroPortalCompras_(
        filaActual[
          idx.CANTIDAD_SOLICITADA
        ]
      );

    const cantidadAcumuladaAnterior =
      numeroPortalCompras_(
        filaActual[
          idx.CANTIDAD_COMPRADA
        ]
      );

    const nuevoAcumulado =
      cantidadAcumuladaAnterior +
      cantidadMovimiento;

    if (
      cantidadSolicitada > 0 &&
      nuevoAcumulado >
      cantidadSolicitada
    ) {
      throw new Error(
        'La cantidad de esta compra supera el saldo pendiente. Saldo disponible: ' +
        Math.max(
          cantidadSolicitada -
          cantidadAcumuladaAnterior,
          0
        ) +
        '.'
      );
    }

    const saldoResultante =
      Math.max(
        cantidadSolicitada -
        nuevoAcumulado,
        0
      );

    if (
      estado ===
      'COMPRA PARCIAL'
    ) {

      if (
        !proveedor
      ) {
        throw new Error(
          'Para marcar COMPRA PARCIAL debés indicar el proveedor.'
        );
      }

      if (
        cantidadMovimiento <= 0
      ) {
        throw new Error(
          'Para registrar una COMPRA PARCIAL la cantidad de esta compra debe ser mayor a cero.'
        );
      }

      /*
       * Si con esta compra se completa exactamente el saldo,
       * el backend cerrará automáticamente la gestión.
       */
    }

    if (
      estado ===
      'COMPRA REALIZADA'
    ) {

      if (
        !proveedor
      ) {
        throw new Error(
          'Para marcar COMPRA REALIZADA debés indicar el proveedor.'
        );
      }

      if (
        nuevoAcumulado <= 0
      ) {
        throw new Error(
          'Para marcar COMPRA REALIZADA debe existir al menos una unidad comprada.'
        );
      }
    }

    let estadoFinal =
      estado;

    if (
      cantidadSolicitada > 0 &&
      nuevoAcumulado ===
      cantidadSolicitada
    ) {
      estadoFinal =
        'COMPRA REALIZADA';
    }

    const ahora =
      new Date();

    const responsable =
      estado ===
      'PENDIENTE'
        ? ''
        : nombreUsuarioPortalCompras_(
            email
          );

    const fechaGestion =
      estadoFinal ===
      'PENDIENTE'
        ? ''
        : ahora;

    const fechaCompra =
      estadoFinal ===
      'COMPRA REALIZADA'
        ? ahora
        : '';

    escribirPorEncabezadoPortal_(
      sh,
      filaEncontrada,
      idx,
      {
        ESTADO_COMPRA:
          estadoFinal,

        PROVEEDOR:
          proveedor,

        CANTIDAD_COMPRADA:
          nuevoAcumulado > 0
            ? nuevoAcumulado
            : '',

        OBSERVACION_COMPRA:
          observacion,

        RESPONSABLE_COMPRA:
          responsable,

        FECHA_GESTION:
          fechaGestion,

        FECHA_COMPRA:
          fechaCompra,

        ULTIMA_ACTUALIZACION:
          ahora
      }
    );

    let nroMovimiento =
      '';

    if (
      cantidadMovimiento >
      0
    ) {

      const shMov =
        obtenerHojaMovimientosCompraPortal_(
          ss
        );

      nroMovimiento =
        generarNumeroMovimientoCompraPortal_(
          shMov,
          ahora
        );

      shMov.appendRow([
        nroMovimiento,
        ahora,
        email,
        nroEnvio,
        sku,
        estadoFinal,
        proveedor,
        cantidadMovimiento,
        nuevoAcumulado,
        saldoResultante,
        observacion
      ]);
    }

    SpreadsheetApp.flush();

    return {
      ok:
        true,

      nroEnvio:
        nroEnvio,

      sku:
        sku,

      estadoCompra:
        estadoFinal,

      proveedor:
        proveedor,

      cantidadMovimiento:
        cantidadMovimiento,

      cantidadComprada:
        nuevoAcumulado,

      saldoPendiente:
        saldoResultante,

      nroMovimiento:
        nroMovimiento,

      observacionCompra:
        observacion,

      responsableCompra:
        responsable,

      fechaGestion:
        formatearFechaPortalCompras_(
          fechaGestion
        ),

      fechaCompra:
        formatearFechaPortalCompras_(
          fechaCompra
        )
    };

  } finally {

    lock.releaseLock();
  }
}



/**
 * ============================================================
 * MOVIMIENTOS DE COMPRA - B.1.9-C
 *
 * Cada compra parcial/realizada se registra como un movimiento.
 * COMPRAS_EN_PROCESO conserva el total acumulado.
 * ============================================================
 */
function obtenerHojaMovimientosCompraPortal_(ss) {

  let sh =
    ss.getSheetByName(
      PORTAL_COMPRAS.hojaMovimientosCompra
    );

  const headers = [
    'NRO_MOVIMIENTO',
    'FECHA_MOVIMIENTO',
    'USUARIO',
    'NRO_ENVIO',
    'SKU',
    'ESTADO_RESULTANTE',
    'PROVEEDOR',
    'CANTIDAD_MOVIMIENTO',
    'CANTIDAD_ACUMULADA',
    'SALDO_RESULTANTE',
    'OBSERVACION'
  ];

  if (!sh) {

    sh =
      ss.insertSheet(
        PORTAL_COMPRAS.hojaMovimientosCompra
      );

    sh.getRange(
      1,
      1,
      1,
      headers.length
    )
    .setValues([
      headers
    ])
    .setFontWeight(
      'bold'
    )
    .setBackground(
      '#123d6a'
    )
    .setFontColor(
      'white'
    );

    sh.setFrozenRows(1);
  }

  return sh;
}


function generarNumeroMovimientoCompraPortal_(
  sh,
  fecha
) {

  const prefijo =
    'MC-' +
    Utilities.formatDate(
      fecha,
      Session.getScriptTimeZone(),
      'yyyyMMdd'
    ) +
    '-';

  let maximo = 0;

  if (
    sh.getLastRow() >=
    2
  ) {

    sh.getRange(
      2,
      1,
      sh.getLastRow() - 1,
      1
    )
    .getDisplayValues()
    .forEach(
      function(f) {

        const nro =
          String(
            f[0] || ''
          ).trim();

        if (
          nro.indexOf(
            prefijo
          ) !== 0
        ) {
          return;
        }

        const n =
          Number(
            nro.substring(
              prefijo.length
            )
          );

        if (
          !isNaN(n) &&
          n > maximo
        ) {
          maximo = n;
        }
      }
    );
  }

  return (
    prefijo +
    String(
      maximo + 1
    ).padStart(
      4,
      '0'
    )
  );
}


function obtenerMovimientosCompraSkuPortal(
  nroEnvio,
  sku,
  tokenPortal
) {

  validarUsuarioPortalCompras_(tokenPortal);

  const ss =
    SpreadsheetApp.getActiveSpreadsheet();

  const sh =
    obtenerHojaMovimientosCompraPortal_(
      ss
    );

  if (
    sh.getLastRow() <
    2
  ) {
    return [];
  }

  const valores =
    sh.getDataRange()
      .getValues();

  const headers =
    valores[0]
      .map(
        normalizarPortalCompras_
      );

  const idx = {};

  headers.forEach(
    function(h, i) {
      idx[h] = i;
    }
  );

  const claveSku =
    normalizarClavePortalCompras_(
      sku
    );

  const movimientos = [];

  for (
    let f = 1;
    f < valores.length;
    f++
  ) {

    const fila =
      valores[f];

    if (
      String(
        fila[
          idx.NRO_ENVIO
        ] || ''
      ).trim() !==
      String(
        nroEnvio || ''
      ).trim()
    ) {
      continue;
    }

    if (
      normalizarClavePortalCompras_(
        fila[
          idx.SKU
        ]
      ) !==
      claveSku
    ) {
      continue;
    }

    movimientos.push({
      nroMovimiento:
        String(
          fila[
            idx.NRO_MOVIMIENTO
          ] || ''
        ),

      fecha:
        formatearFechaPortalCompras_(
          fila[
            idx.FECHA_MOVIMIENTO
          ]
        ),

      usuario:
        String(
          fila[
            idx.USUARIO
          ] || ''
        ),

      estado:
        String(
          fila[
            idx.ESTADO_RESULTANTE
          ] || ''
        ),

      proveedor:
        String(
          fila[
            idx.PROVEEDOR
          ] || ''
        ),

      cantidadMovimiento:
        numeroPortalCompras_(
          fila[
            idx.CANTIDAD_MOVIMIENTO
          ]
        ),

      cantidadAcumulada:
        numeroPortalCompras_(
          fila[
            idx.CANTIDAD_ACUMULADA
          ]
        ),

      saldo:
        numeroPortalCompras_(
          fila[
            idx.SALDO_RESULTANTE
          ]
        ),

      observacion:
        String(
          fila[
            idx.OBSERVACION
          ] || ''
        )
    });
  }

  movimientos.sort(
    function(a, b) {
      return a.nroMovimiento
        .localeCompare(
          b.nroMovimiento
        );
    }
  );

  return movimientos;
}



/**
 * ============================================================
 * HISTORIAL POR SKU - B.1.9-C
 *
 * Fuentes:
 *   - GESTION_COMPRAS: última decisión registrada
 *   - ENVIOS_COMPRA: cada envío EC
 *   - COMPRAS_EN_PROCESO: estado operativo actual
 *   - MOVIMIENTOS_COMPRA: cada compra parcial/realizada
 *
 * Nota: GESTION_COMPRAS conserva estado actual/última decisión,
 * no todas las modificaciones históricas anteriores.
 * ============================================================
 */
function obtenerHistorialSkuPortal(
  skuBuscado,
  tokenPortal
) {

  validarUsuarioPortalCompras_(tokenPortal);

  const sku =
    String(
      skuBuscado || ''
    ).trim();

  if (!sku) {
    throw new Error(
      'Ingresá un SKU.'
    );
  }

  const claveSku =
    normalizarClavePortalCompras_(
      sku
    );

  const ss =
    SpreadsheetApp.getActiveSpreadsheet();

  const configMarcas =
    obtenerMapaConfigMarcasPortal_(
      ss
    );

  const mapaAlias =
    obtenerMapaAliasPortal_(
      ss
    );

  const resultado = {
    sku: sku,
    descripcion: '',
    marca: '',
    origen: '',
    compraHabilitada: false,
    coberturaActual: 0,
    coberturaObjetivo: 0,
    estadoActual: '',
    cantidadSolicitada: 0,
    cantidadComprada: 0,
    saldoPendiente: 0,
    stockWarnes: 0,
    stockEscobar: 0,
    stockTotal: 0,
    promedioMensual: 0,
    pendienteTotal: 0,
    proveedorActual: '',
    responsableActual: '',
    eventos: []
  };

  /*
   * ----------------------------------------------------------
   * STOCK ACTUAL - GESTION_COMPRAS_ACTIVA
   * ----------------------------------------------------------
   * Se muestra como dato actual, no como evento histórico.
   */
  const shGestionActiva =
    ss.getSheetByName(
      PORTAL_COMPRAS.hojaGestionActiva
    );

  if (
    shGestionActiva &&
    shGestionActiva.getLastRow() >= 2
  ) {

    const infoActiva =
      buscarSkuEnHojaPortal_(
        shGestionActiva,
        sku
      );

    if (infoActiva) {

      resultado.stockWarnes =
        numeroPortalCompras_(
          infoActiva.valor(
            'STOCK_WARNES'
          )
        );

      resultado.stockEscobar =
        numeroPortalCompras_(
          infoActiva.valor(
            'STOCK_ESCOBAR'
          )
        );

      resultado.stockTotal =
        numeroPortalCompras_(
          infoActiva.valor(
            'STOCK_TOTAL'
          )
        );

      /*
       * En el modelo actual el consumo se expresa como
       * PROMEDIO_MENSUAL.
       */
      resultado.promedioMensual =
        numeroPortalCompras_(
          infoActiva.valor(
            'PROMEDIO_MENSUAL'
          )
        );

      resultado.pendienteTotal =
        numeroPortalCompras_(
          infoActiva.valor(
            'PENDIENTE_TOTAL'
          )
        );

      resultado.coberturaActual =
        numeroPortalCompras_(
          infoActiva.valor(
            'COBERTURA_ACTUAL'
          )
        );

      /*
       * Si STOCK_TOTAL no estuviera disponible en alguna versión
       * de la hoja, lo reconstruimos con los dos depósitos.
       */
      if (
        !resultado.stockTotal &&
        (
          resultado.stockWarnes ||
          resultado.stockEscobar
        )
      ) {
        resultado.stockTotal =
          resultado.stockWarnes +
          resultado.stockEscobar;
      }

      /*
       * Respaldo: si la hoja operativa no tuviera COBERTURA_ACTUAL,
       * la reconstruimos con STOCK_TOTAL / PROMEDIO_MENSUAL.
       */
      if (
        resultado.coberturaActual <= 0 &&
        resultado.promedioMensual > 0
      ) {
        resultado.coberturaActual =
          resultado.stockTotal /
          resultado.promedioMensual;
      }

      if (!resultado.descripcion) {
        resultado.descripcion =
          String(
            infoActiva.valor(
              'DESCRIPCION'
            ) || ''
          ).trim();
      }

      if (!resultado.marca) {
        resultado.marca =
          String(
            infoActiva.valor(
              'MARCA'
            ) || ''
          ).trim();
      }
    }
  }

  const cfgHistorial =
    obtenerConfigMarcaPortal_(
      resultado.marca,
      configMarcas,
      mapaAlias
    );

  resultado.origen =
    cfgHistorial.origen;

  resultado.compraHabilitada =
    cfgHistorial.compra ===
    'SI';

  resultado.coberturaObjetivo =
    cfgHistorial.objetivo;


  /*
   * ----------------------------------------------------------
   * 1. GESTION_COMPRAS - última decisión
   * ----------------------------------------------------------
   */
  const shGestion =
    ss.getSheetByName(
      PORTAL_COMPRAS.hojaGestion
    );

  if (
    shGestion &&
    shGestion.getLastRow() >= 2
  ) {

    const info =
      buscarSkuEnHojaPortal_(
        shGestion,
        sku
      );

    if (info) {

      const estadoGestion =
        String(
          info.valor(
            'ESTADO_GESTION'
          ) || ''
        ).trim();

      const cantidadDecidida =
        numeroPortalCompras_(
          info.valor(
            'CANTIDAD_DECIDIDA'
          )
        );

      const responsable =
        String(
          info.valor(
            'RESPONSABLE'
          ) || ''
        ).trim();

      const observacion =
        String(
          info.valor(
            'OBSERVACION'
          ) || ''
        ).trim();

      const fechaDecision =
        info.valor(
          'FECHA_DECISION'
        );

      if (
        fechaDecision ||
        estadoGestion
      ) {

        resultado.eventos.push({
          tipo: 'GESTION',
          fechaOrden:
            fechaDecision
              ? new Date(fechaDecision).getTime()
              : 0,
          fecha:
            formatearFechaPortalCompras_(
              fechaDecision
            ),
          titulo:
            'Decisión de compra',
          estado:
            estadoGestion,
          detalle:
            cantidadDecidida > 0
              ? 'Cantidad decidida: ' +
                cantidadDecidida
              : '',
          responsable:
            responsable,
          observacion:
            observacion,
          referencia:
            ''
        });
      }
    }
  }

  /*
   * ----------------------------------------------------------
   * 2. ENVIOS_COMPRA - todos los lotes EC del SKU
   * ----------------------------------------------------------
   */
  const shEnvios =
    ss.getSheetByName(
      PORTAL_COMPRAS.hojaEnviosCompra
    );

  if (
    shEnvios &&
    shEnvios.getLastRow() >= 2
  ) {

    const v =
      shEnvios
        .getDataRange()
        .getValues();

    const headers =
      v[0].map(
        normalizarPortalCompras_
      );

    const idx = {};

    headers.forEach(
      function(h, i) {
        idx[h] = i;
      }
    );

    for (
      let f = 1;
      f < v.length;
      f++
    ) {

      const fila =
        v[f];

      if (
        normalizarClavePortalCompras_(
          fila[
            idx.SKU
          ]
        ) !==
        claveSku
      ) {
        continue;
      }

      const fecha =
        fila[
          idx.FECHA_ENVIO
        ];

      if (
        !resultado.descripcion
      ) {
        resultado.descripcion =
          String(
            fila[
              idx.DESCRIPCION
            ] || ''
          );
      }

      if (
        !resultado.marca
      ) {
        resultado.marca =
          String(
            fila[
              idx.MARCA
            ] || ''
          );
      }

      const cantidad =
        numeroPortalCompras_(
          fila[
            idx.CANTIDAD_DECIDIDA
          ]
        );

      resultado.eventos.push({
        tipo: 'ENVIO',
        fechaOrden:
          fecha
            ? new Date(fecha).getTime()
            : 0,
        fecha:
          formatearFechaPortalCompras_(
            fecha
          ),
        titulo:
          'Enviado a Compra',
        estado:
          'ENVIADO A COMPRA',
        detalle:
          'Cantidad enviada: ' +
          cantidad,
        responsable:
          String(
            fila[
              idx.USUARIO_ENVIO
            ] || ''
          ),
        observacion:
          String(
            fila[
              idx.OBSERVACION
            ] || ''
          ),
        referencia:
          String(
            fila[
              idx.NRO_ENVIO
            ] || ''
          )
      });
    }
  }

  /*
   * ----------------------------------------------------------
   * 3. COMPRAS_EN_PROCESO - estado actual
   * ----------------------------------------------------------
   */
  const shProceso =
    ss.getSheetByName(
      PORTAL_COMPRAS.hojaProcesoCompra
    );

  if (
    shProceso &&
    shProceso.getLastRow() >= 2
  ) {

    const v =
      shProceso
        .getDataRange()
        .getValues();

    const headers =
      v[0].map(
        normalizarPortalCompras_
      );

    const idx = {};

    headers.forEach(
      function(h, i) {
        idx[h] = i;
      }
    );

    let ultimaFila =
      null;

    for (
      let f = 1;
      f < v.length;
      f++
    ) {

      if (
        normalizarClavePortalCompras_(
          v[f][
            idx.SKU
          ]
        ) ===
        claveSku
      ) {
        ultimaFila =
          v[f];
      }
    }

    if (
      ultimaFila
    ) {

      resultado.descripcion =
        resultado.descripcion ||
        String(
          ultimaFila[
            idx.DESCRIPCION
          ] || ''
        );

      resultado.marca =
        resultado.marca ||
        String(
          ultimaFila[
            idx.MARCA
          ] || ''
        );

      resultado.estadoActual =
        String(
          ultimaFila[
            idx.ESTADO_COMPRA
          ] || ''
        );

      resultado.cantidadSolicitada =
        numeroPortalCompras_(
          ultimaFila[
            idx.CANTIDAD_SOLICITADA
          ]
        );

      resultado.cantidadComprada =
        numeroPortalCompras_(
          ultimaFila[
            idx.CANTIDAD_COMPRADA
          ]
        );

      resultado.saldoPendiente =
        Math.max(
          resultado.cantidadSolicitada -
          resultado.cantidadComprada,
          0
        );

      resultado.proveedorActual =
        String(
          ultimaFila[
            idx.PROVEEDOR
          ] || ''
        );

      resultado.responsableActual =
        String(
          ultimaFila[
            idx.RESPONSABLE_COMPRA
          ] || ''
        );
    }
  }

  /*
   * ----------------------------------------------------------
   * 4. MOVIMIENTOS_COMPRA - compras acumulativas
   * ----------------------------------------------------------
   */
  const shMov =
    ss.getSheetByName(
      PORTAL_COMPRAS.hojaMovimientosCompra
    );

  if (
    shMov &&
    shMov.getLastRow() >= 2
  ) {

    const v =
      shMov
        .getDataRange()
        .getValues();

    const headers =
      v[0].map(
        normalizarPortalCompras_
      );

    const idx = {};

    headers.forEach(
      function(h, i) {
        idx[h] = i;
      }
    );

    for (
      let f = 1;
      f < v.length;
      f++
    ) {

      const fila =
        v[f];

      if (
        normalizarClavePortalCompras_(
          fila[
            idx.SKU
          ]
        ) !==
        claveSku
      ) {
        continue;
      }

      const fecha =
        fila[
          idx.FECHA_MOVIMIENTO
        ];

      const cantidadMovimiento =
        numeroPortalCompras_(
          fila[
            idx.CANTIDAD_MOVIMIENTO
          ]
        );

      const acumulada =
        numeroPortalCompras_(
          fila[
            idx.CANTIDAD_ACUMULADA
          ]
        );

      const saldo =
        numeroPortalCompras_(
          fila[
            idx.SALDO_RESULTANTE
          ]
        );

      resultado.eventos.push({
        tipo: 'COMPRA',
        fechaOrden:
          fecha
            ? new Date(fecha).getTime()
            : 0,
        fecha:
          formatearFechaPortalCompras_(
            fecha
          ),
        titulo:
          'Movimiento de compra',
        estado:
          String(
            fila[
              idx.ESTADO_RESULTANTE
            ] || ''
          ),
        detalle:
          'Compra: ' +
          cantidadMovimiento +
          ' · Acumulado: ' +
          acumulada +
          ' · Saldo: ' +
          saldo,
        responsable:
          String(
            fila[
              idx.USUARIO
            ] || ''
          ),
        observacion:
          String(
            fila[
              idx.OBSERVACION
            ] || ''
          ),
        referencia:
          String(
            fila[
              idx.NRO_MOVIMIENTO
            ] || ''
          ) +
          (
            fila[
              idx.NRO_ENVIO
            ]
              ? ' · ' +
                String(
                  fila[
                    idx.NRO_ENVIO
                  ]
                )
              : ''
          ),
        proveedor:
          String(
            fila[
              idx.PROVEEDOR
            ] || ''
          )
      });
    }
  }

  resultado.eventos.sort(
    function(a, b) {
      return (
        a.fechaOrden -
        b.fechaOrden
      );
    }
  );

  if (
    resultado.eventos.length ===
    0
  ) {
    throw new Error(
      'No se encontró historial para el SKU ' +
      sku +
      '.'
    );
  }

  return resultado;
}




/**
 * ============================================================
 * PACKING LIST - B.1.9-D.1
 *
 * Primera etapa del circuito logístico posterior a la compra.
 *
 * Hojas:
 *   PACKING_LIST
 *   PACKING_LIST_DETALLE
 *
 * En D.1 se crea la estructura y la vista de consulta.
 * La importación automática del XLSX se incorpora en D.2.
 * ============================================================
 */
function obtenerHojaPackingListPortal_(ss) {

  let sh =
    ss.getSheetByName(
      PORTAL_COMPRAS.hojaPackingList
    );

  const headers = [
    'ID_PL',
    'PI',
    'PROVEEDOR',
    'FECHA_PL',
    'ESTADO_LOGISTICO',
    'TOTAL_SKU',
    'TOTAL_UNIDADES',
    'TOTAL_CAJAS',
    'PESO_BRUTO_TOTAL',
    'PESO_NETO_TOTAL',
    'CBM_TOTAL',
    'ARCHIVO_ORIGEN',
    'OBSERVACION',
    'FECHA_CARGA',
    'USUARIO_CARGA'
  ];

  if (!sh) {
    sh =
      ss.insertSheet(
        PORTAL_COMPRAS.hojaPackingList
      );
  }

  /*
   * D.1.1:
   * Si la hoja ya existía pero estaba completamente vacía,
   * la versión D.1 no escribía encabezados.
   */
  if (
    sh.getLastRow() === 0 ||
    sh.getLastColumn() === 0
  ) {

    sh.getRange(
      1,
      1,
      1,
      headers.length
    )
    .setValues([headers])
    .setFontWeight('bold')
    .setBackground('#123d6a')
    .setFontColor('white');

    sh.setFrozenRows(1);
  }

  return sh;
}


function obtenerHojaPackingListDetallePortal_(ss) {

  let sh =
    ss.getSheetByName(
      PORTAL_COMPRAS.hojaPackingListDetalle
    );

  const headers = [
    'ID_PL',
    'PI',
    'NRO_ENVIO',
    'OC_PROVEEDOR',
    'OC_INTERNA',
    'SKU',
    'DESCRIPCION',
    'CANTIDAD_COMPRADA',
    'CANTIDAD_PL',
    'DIFERENCIA',
    'UNIDAD',
    'QTY_CAJA',
    'CAJAS',
    'RANGO_CAJAS',
    'PESO_BRUTO',
    'PESO_NETO',
    'CBM_CAJA',
    'CBM_TOTAL',
    'OBSERVACION',
    'ESTADO_ITEM',
    'FECHA_ESTADO',
    'RESPONSABLE_ESTADO',
    'OBSERVACION_ESTADO'
  ];

  if (!sh) {
    sh =
      ss.insertSheet(
        PORTAL_COMPRAS.hojaPackingListDetalle
      );
  }

  /*
   * D.1.1:
   * Repara también una hoja preexistente pero vacía.
   */
  if (
    sh.getLastRow() === 0 ||
    sh.getLastColumn() === 0
  ) {

    sh.getRange(
      1,
      1,
      1,
      headers.length
    )
    .setValues([headers])
    .setFontWeight('bold')
    .setBackground('#123d6a')
    .setFontColor('white');

    sh.setFrozenRows(1);
  }

  /*
   * D.8.5 - Separamos definitivamente ambos conceptos:
   *   OC_PROVEEDOR = DETALLE_IMPORTACIONES.ID_ORDEN
   *   OC_INTERNA   = ORDENES_COMPRA_PORTAL.NRO_OC
   *
   * Migración compatible: si la hoja histórica tenía la columna OC,
   * se renombra a OC_PROVEEDOR y se inserta OC_INTERNA inmediatamente
   * después para conservar el orden físico usado por la importación.
   */
  if (sh.getLastColumn() > 0) {
    const encabezadosActuales = sh.getRange(1, 1, 1, sh.getLastColumn())
      .getDisplayValues()[0]
      .map(normalizarPortalCompras_);

    const posOcVieja = encabezadosActuales.indexOf('OC');
    const posOcProveedor = encabezadosActuales.indexOf('OC_PROVEEDOR');

    if (posOcVieja >= 0 && posOcProveedor < 0) {
      sh.getRange(1, posOcVieja + 1).setValue('OC_PROVEEDOR');
    }

    const encabezadosMigrados = sh.getRange(1, 1, 1, sh.getLastColumn())
      .getDisplayValues()[0]
      .map(normalizarPortalCompras_);
    const posProveedorMigrado = encabezadosMigrados.indexOf('OC_PROVEEDOR');

    if (
      posProveedorMigrado >= 0 &&
      encabezadosMigrados.indexOf('OC_INTERNA') < 0
    ) {
      sh.insertColumnAfter(posProveedorMigrado + 1);
      sh.getRange(1, posProveedorMigrado + 2)
        .setValue('OC_INTERNA')
        .setFontWeight('bold')
        .setBackground('#123d6a')
        .setFontColor('white');
    }
  }

  // Agrega cualquier columna faltante si la hoja ya existía.
  const actuales = sh.getLastColumn() > 0
    ? sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(normalizarPortalCompras_)
    : [];

  headers.forEach(function(h) {
    if (actuales.indexOf(normalizarPortalCompras_(h)) === -1) {
      const col = sh.getLastColumn() + 1;
      sh.getRange(1, col).setValue(h)
        .setFontWeight('bold')
        .setBackground('#123d6a')
        .setFontColor('white');
      actuales.push(normalizarPortalCompras_(h));
    }
  });

  return sh;
}


/**
 * Lectura acotada con reintento para el servicio Spreadsheet.
 *
 * Evita getDataRange() y, si Google devuelve un timeout
 * transitorio, reintenta hasta 3 veces.
 */
function leerHojaPackingSeguro_(
  sh
) {

  const maxIntentos = 3;

  for (
    let intento = 1;
    intento <= maxIntentos;
    intento++
  ) {

    try {

      const ultimaFila =
        sh.getLastRow();

      const ultimaColumna =
        sh.getLastColumn();

      if (
        ultimaFila <= 0 ||
        ultimaColumna <= 0
      ) {
        return [];
      }

      return sh.getRange(
        1,
        1,
        ultimaFila,
        ultimaColumna
      )
      .getValues();

    } catch (error) {

      if (
        intento >=
        maxIntentos
      ) {
        throw error;
      }

      Utilities.sleep(
        500 * intento
      );
    }
  }

  return [];
}


/**
 * Inicializa las hojas del módulo.
 */
function inicializarPackingListPortal(
  tokenPortal
) {

  validarUsuarioPortalCompras_(
    tokenPortal
  );

  const ss =
    SpreadsheetApp.getActiveSpreadsheet();

  obtenerHojaPackingListPortal_(
    ss
  );

  obtenerHojaPackingListDetallePortal_(
    ss
  );

  return {
    ok: true,
    hojas: [
      PORTAL_COMPRAS.hojaPackingList,
      PORTAL_COMPRAS.hojaPackingListDetalle
    ]
  };
}


/**
 * Repara/inicializa la estructura de Packing List.
 * Ejecutar una vez desde el editor después de instalar D.1.1.
 */
function repararPackingListD11() {

  const ss =
    SpreadsheetApp.getActiveSpreadsheet();

  const shCab =
    obtenerHojaPackingListPortal_(
      ss
    );

  const shDet =
    obtenerHojaPackingListDetallePortal_(
      ss
    );

  SpreadsheetApp.flush();

  const resultado = {
    packingList: {
      filas:
        shCab.getLastRow(),
      columnas:
        shCab.getLastColumn()
    },
    packingListDetalle: {
      filas:
        shDet.getLastRow(),
      columnas:
        shDet.getLastColumn()
    }
  };

  Logger.log(
    JSON.stringify(
      resultado,
      null,
      2
    )
  );

  return resultado;
}



/**
 * Importa un Packing List ya interpretado en el navegador.
 *
 * El XLSX se procesa del lado cliente para evitar enviar el archivo
 * binario completo a Apps Script. El backend recibe sólo datos.
 *
 * payload:
 * {
 *   archivo, pi, fechaPl, proveedor,
 *   compras: [{sku, descripcion, cantidad, unidad}],
 *   lineas:  [{sku, cantidad, unidad, qtyCaja, cajas,
 *              rangoCajas, pesoBruto, pesoNeto,
 *              cbmCaja, cbmTotal}]
 * }
 */

/**
 * ============================================================
 * B.1.9-D.4.1 - VINCULACIÓN PL -> OC -> ITEM
 * ============================================================
 *
 * Fuentes existentes:
 *   EMBARQUES:
 *     ID_ORDEN | PACKING_LIST | ...
 *
 *   DETALLE_IMPORTACIONES:
 *     ID_ORDEN | ITEM | PACKING_LIST | STATUS_LINEA | ...
 *
 * Regla:
 * 1) prioridad a coincidencia exacta PACKING_LIST + ITEM;
 * 2) si no existe y EMBARQUES tiene una única OC para ese PL,
 *    se usa esa OC;
 * 3) si hay más de una posibilidad, no se fuerza la OC.
 */
function construirMapaOcPackingD41_(ss) {

  /*
   * D.8.5 - Fuente única para OC PROVEEDOR:
   * DETALLE_IMPORTACIONES.ID_ORDEN.
   *
   * No usamos EMBARQUES.ID_ORDEN como fallback porque ese dato no debe
   * confundirse con la OC del proveedor.
   */
  var resultado = {
    porPlSku: {},
    estadoPorOcSku: {}
  };

  var shDet = ss.getSheetByName('DETALLE_IMPORTACIONES');

  if (
    !shDet ||
    shDet.getLastRow() < 2 ||
    shDet.getLastColumn() < 1
  ) {
    return resultado;
  }

  var det = shDet.getRange(
    1,
    1,
    shDet.getLastRow(),
    shDet.getLastColumn()
  ).getValues();

  var hd = det[0].map(normalizarPortalCompras_);
  var id = {};
  hd.forEach(function(h, i) { id[h] = i; });

  if (
    id.ID_ORDEN === undefined ||
    id.ITEM === undefined ||
    id.PACKING_LIST === undefined
  ) {
    return resultado;
  }

  for (var d = 1; d < det.length; d++) {
    var ocProveedor = String(
      det[d][id.ID_ORDEN] || ''
    ).trim();

    var sku = normalizarClavePortalCompras_(
      det[d][id.ITEM]
    );

    var pl = normalizarClavePortalCompras_(
      det[d][id.PACKING_LIST]
    );

    var estado = id.STATUS_LINEA !== undefined
      ? String(det[d][id.STATUS_LINEA] || '').trim().toUpperCase()
      : '';

    if (!ocProveedor || !sku || !pl) {
      continue;
    }

    var clavePlSkuOc =
      pl + '|' + sku + '|' +
      normalizarClavePortalCompras_(ocProveedor);

    /*
     * El estado se conserva por PL + ITEM + OC. De esta forma una misma
     * OC/ITEM presente en más de un Packing List no pisa el estado de otra
     * línea. Si hay estados distintos dentro de la misma combinación,
     * conservamos el menos avanzado para no adelantar el flujo logístico.
     */
    if (!resultado.estadoPorOcSku[clavePlSkuOc]) {
      resultado.estadoPorOcSku[clavePlSkuOc] = estado;
    } else if (estado && resultado.estadoPorOcSku[clavePlSkuOc] !== estado) {
      var ordenEstados = estadosLogisticosD4_();
      var anteriorIdx = ordenEstados.indexOf(resultado.estadoPorOcSku[clavePlSkuOc]);
      var nuevoIdx = ordenEstados.indexOf(estado);
      if (anteriorIdx < 0 || (nuevoIdx >= 0 && nuevoIdx < anteriorIdx)) {
        resultado.estadoPorOcSku[clavePlSkuOc] = estado;
      }
    }

    var clavePlSku = pl + '|' + sku;
    if (!resultado.porPlSku[clavePlSku]) {
      resultado.porPlSku[clavePlSku] = {};
    }

    resultado.porPlSku[clavePlSku][ocProveedor] = true;
  }

  return resultado;
}


function resolverOcPackingD41_(
  mapa,
  packingList,
  sku
) {

  var pl = normalizarClavePortalCompras_(packingList);
  var item = normalizarClavePortalCompras_(sku);

  var exactos = mapa.porPlSku[
    pl + '|' + item
  ] || {};

  var ocsExactas = Object.keys(exactos);

  if (ocsExactas.length === 1) {
    var ocProveedor = ocsExactas[0];

    return {
      oc: ocProveedor,
      ocProveedor: ocProveedor,
      ambiguo: false,
      origen: 'DETALLE_IMPORTACIONES',
      estado: mapa.estadoPorOcSku[
        pl + '|' + item + '|' +
        normalizarClavePortalCompras_(ocProveedor)
      ] || ''
    };
  }

  if (ocsExactas.length > 1) {
    return {
      oc: '',
      ocProveedor: '',
      ambiguo: true,
      origen: 'DETALLE_IMPORTACIONES',
      estado: ''
    };
  }

  return {
    oc: '',
    ocProveedor: '',
    ambiguo: false,
    origen: '',
    estado: ''
  };
}


function estadoLogisticoFuenteD41_(
  estado
) {

  var valor =
    String(
      estado || ''
    )
    .trim()
    .toUpperCase();

  return estadosLogisticosD4_()
    .indexOf(
      valor
    ) >= 0
      ? valor
      : '';
}


/**
 * Vincula Packing List ya importados.
 *
 * Se puede ejecutar una vez desde el editor después de instalar D.4.1.
 */
function vincularOcsPackingD41() {

  var ss =
    SpreadsheetApp.getActiveSpreadsheet();

  var sh =
    obtenerHojaPackingListDetallePortal_(
      ss
    );

  if (
    sh.getLastRow() < 2
  ) {
    return {
      ok: true,
      vinculados: 0,
      ambiguos: 0,
      sinRelacion: 0
    };
  }

  var mapa =
    construirMapaOcPackingD41_(
      ss
    );

  var vals =
    leerHojaPackingSeguro_(
      sh
    );

  var headers =
    vals[0].map(
      normalizarPortalCompras_
    );

  var idx = {};

  headers.forEach(
    function(h, i) {
      idx[h] = i;
    }
  );

  var cOcProveedor =
    idx.OC_PROVEEDOR !== undefined
      ? idx.OC_PROVEEDOR
      : idx.OC;

  if (cOcProveedor === undefined) {
    throw new Error('PACKING_LIST_DETALLE no contiene OC_PROVEEDOR. Ejecutá repararPackingListD11().');
  }

  var vinculados = 0;
  var ambiguos = 0;
  var sinRelacion = 0;

  for (
    var r = 1;
    r < vals.length;
    r++
  ) {

    var pi =
      String(
        vals[r][idx.PI] || ''
      ).trim();

    var sku =
      String(
        vals[r][idx.SKU] || ''
      ).trim();

    var ocActual =
      String(
        vals[r][cOcProveedor] || ''
      ).trim();

    if (
      !pi ||
      !sku
    ) {
      continue;
    }

    var rel =
      resolverOcPackingD41_(
        mapa,
        pi,
        sku
      );

    if (
      !ocActual &&
      rel.oc
    ) {

      vals[r][cOcProveedor] =
        rel.oc;

      vinculados++;
    } else if (
      !ocActual &&
      rel.ambiguo
    ) {

      ambiguos++;
    } else if (
      !ocActual
    ) {

      sinRelacion++;
    }

    /*
     * Si el ítem todavía no tenía estado propio,
     * aprovechamos STATUS_LINEA de DETALLE_IMPORTACIONES.
     */
    if (
      idx.ESTADO_ITEM !== undefined &&
      !String(
        vals[r][idx.ESTADO_ITEM] || ''
      ).trim()
    ) {

      var est =
        estadoLogisticoFuenteD41_(
          rel.estado
        );

      if (est) {
        vals[r][idx.ESTADO_ITEM] =
          est;
      }
    }
  }

  sh.getRange(
    1,
    1,
    vals.length,
    vals[0].length
  )
  .setValues(
    vals
  );

  /*
   * Recalcula los estados generales de los PL tocados.
   */
  var ids = {};

  for (
    var x = 1;
    x < vals.length;
    x++
  ) {

    var idPl =
      String(
        vals[x][idx.ID_PL] || ''
      ).trim();

    if (idPl) {
      ids[idPl] = true;
    }
  }

  recalcularEstadoCabeceraPackingD4_(
    ss,
    Object.keys(
      ids
    )
  );

  SpreadsheetApp.flush();

  var resultado = {
    ok: true,
    vinculados: vinculados,
    ambiguos: ambiguos,
    sinRelacion: sinRelacion
  };

  Logger.log(
    JSON.stringify(
      resultado,
      null,
      2
    )
  );

  return resultado;
}


function importarPackingListPortal(
  payload,
  tokenPortal
) {

  const email =
    validarUsuarioPortalCompras_(
      tokenPortal
    );

  if (
    !payload ||
    typeof payload !== 'object'
  ) {
    throw new Error(
      'No se recibieron datos del Packing List.'
    );
  }

  const pi =
    String(
      payload.pi || ''
    )
    .trim();

  const proveedor =
    String(
      payload.proveedor || ''
    )
    .trim();

  const archivo =
    String(
      payload.archivo || ''
    )
    .trim();

  const lineas =
    Array.isArray(
      payload.lineas
    )
      ? payload.lineas
      : [];

  const compras =
    Array.isArray(
      payload.compras
    )
      ? payload.compras
      : [];

  if (!pi) {
    throw new Error(
      'No se pudo identificar el PI No. del archivo.'
    );
  }

  if (
    lineas.length === 0
  ) {
    throw new Error(
      'No se encontraron líneas válidas en la hoja PL.'
    );
  }

  const comprasPorSku =
    new Map();

  compras.forEach(
    function(item) {

      const sku =
        normalizarClavePortalCompras_(
          item.sku
        );

      if (!sku) {
        return;
      }

      if (
        !comprasPorSku.has(
          sku
        )
      ) {
        comprasPorSku.set(
          sku,
          {
            cantidad: 0,
            descripcion:
              String(
                item.descripcion || ''
              ).trim(),
            unidad:
              String(
                item.unidad || ''
              ).trim()
          }
        );
      }

      const dato =
        comprasPorSku.get(
          sku
        );

      dato.cantidad +=
        numeroPortalCompras_(
          item.cantidad
        );

      if (
        !dato.descripcion &&
        item.descripcion
      ) {
        dato.descripcion =
          String(
            item.descripcion
          ).trim();
      }
    }
  );

  /*
   * Totales del PL por SKU.
   * Conservamos cada línea física del Packing List en detalle,
   * pero la diferencia contra la compra se calcula a nivel SKU.
   */
  const plPorSku =
    new Map();

  lineas.forEach(
    function(item) {

      const sku =
        normalizarClavePortalCompras_(
          item.sku
        );

      if (!sku) {
        return;
      }

      plPorSku.set(
        sku,
        (
          plPorSku.get(
            sku
          ) || 0
        ) +
        numeroPortalCompras_(
          item.cantidad
        )
      );
    }
  );

  const idPl =
    'PL-' +
    pi
      .toUpperCase()
      .replace(
        /[^A-Z0-9_-]+/g,
        '-'
      );

  const ahora =
    new Date();

  let fechaPl =
    payload.fechaPl
      ? new Date(
          payload.fechaPl
        )
      : ahora;

  if (
    isNaN(
      fechaPl.getTime()
    )
  ) {
    fechaPl =
      ahora;
  }

  const lock =
    LockService.getDocumentLock();

  lock.waitLock(
    30000
  );

  try {

    const ss =
      SpreadsheetApp.getActiveSpreadsheet();

    const shCab =
      obtenerHojaPackingListPortal_(
        ss
      );

    const shDet =
      obtenerHojaPackingListDetallePortal_(
        ss
      );

    /*
     * D.4.1:
     * Resolvemos automáticamente OC PROVEEDOR y estado exclusivamente desde
     * DETALLE_IMPORTACIONES.
     */
    const mapaOcPackingD41 =
      construirMapaOcPackingD41_(
        ss
      );

    /*
     * Importación idempotente:
     * si vuelve a cargarse el mismo PI, reemplaza su versión anterior.
     */
    eliminarPackingListExistente_(
      shCab,
      shDet,
      idPl
    );

    let totalUnidades = 0;
    let totalCajas = 0;
    let pesoBrutoTotal = 0;
    let pesoNetoTotal = 0;
    let cbmTotalGeneral = 0;

    const skusUnicos =
      new Set();

    const primeraLineaSku =
      new Set();

    const filasDetalle = [];

    let ocVinculadasD41 = 0;
    let ocAmbiguasD41 = 0;
    let ocSinRelacionD41 = 0;

    let indiceEstadoMinimoD41 =
      estadosLogisticosD4_()
        .indexOf(
          'INGRESADO'
        );

    lineas.forEach(
      function(item) {

        const skuOriginal =
          String(
            item.sku || ''
          ).trim();

        const sku =
          normalizarClavePortalCompras_(
            skuOriginal
          );

        if (!sku) {
          return;
        }

        const compra =
          comprasPorSku.get(
            sku
          ) || {
            cantidad: 0,
            descripcion: '',
            unidad: ''
          };

        const cantidadLinea =
          numeroPortalCompras_(
            item.cantidad
          );

        const cantidadPlSku =
          numeroPortalCompras_(
            plPorSku.get(
              sku
            )
          );

        const cantidadCompradaSku =
          numeroPortalCompras_(
            compra.cantidad
          );

        const diferenciaSku =
          cantidadPlSku -
          cantidadCompradaSku;

        const esPrimera =
          !primeraLineaSku.has(
            sku
          );

        primeraLineaSku.add(
          sku
        );

        const cajas =
          numeroPortalCompras_(
            item.cajas
          );

        const pesoBruto =
          numeroPortalCompras_(
            item.pesoBruto
          );

        const pesoNeto =
          numeroPortalCompras_(
            item.pesoNeto
          );

        const cbmTotal =
          numeroPortalCompras_(
            item.cbmTotal
          );

        totalUnidades +=
          cantidadLinea;

        totalCajas +=
          cajas;

        pesoBrutoTotal +=
          pesoBruto;

        pesoNetoTotal +=
          pesoNeto;

        cbmTotalGeneral +=
          cbmTotal;

        skusUnicos.add(
          sku
        );

        /*
         * D.4.1:
         * La OC PROVEEDOR se obtiene por coincidencia exacta
         * PACKING_LIST + ITEM en DETALLE_IMPORTACIONES.
         * No se usa EMBARQUES como fallback.
         */
        const relacionOcD41 =
          resolverOcPackingD41_(
            mapaOcPackingD41,
            pi,
            skuOriginal
          );

        if (
          relacionOcD41.oc
        ) {
          ocVinculadasD41++;
        } else if (
          relacionOcD41.ambiguo
        ) {
          ocAmbiguasD41++;
        } else {
          ocSinRelacionD41++;
        }

        let estadoItemD41 =
          estadoLogisticoFuenteD41_(
            relacionOcD41.estado
          );

        if (!estadoItemD41) {
          estadoItemD41 =
            'A EMBARCAR';
        }

        const indiceEstadoD41 =
          estadosLogisticosD4_()
            .indexOf(
              estadoItemD41
            );

        if (
          indiceEstadoD41 >= 0 &&
          indiceEstadoD41 <
            indiceEstadoMinimoD41
        ) {
          indiceEstadoMinimoD41 =
            indiceEstadoD41;
        }

        /*
         * CANTIDAD_COMPRADA y DIFERENCIA se guardan sólo en la
         * primera línea física del SKU para no duplicar totales.
         * CANTIDAD_PL conserva la cantidad real de cada línea del PL.
         */
        filasDetalle.push([
          idPl,
          pi,
          '',
          relacionOcD41.ocProveedor || relacionOcD41.oc || '',
          '',
          skuOriginal,
          String(
            item.descripcion ||
            compra.descripcion ||
            ''
          ).trim(),
          esPrimera
            ? cantidadCompradaSku
            : '',
          cantidadLinea,
          esPrimera
            ? diferenciaSku
            : '',
          String(
            item.unidad ||
            compra.unidad ||
            ''
          ).trim(),
          numeroPortalCompras_(
            item.qtyCaja
          ),
          cajas,
          String(
            item.rangoCajas || ''
          ).trim(),
          pesoBruto,
          pesoNeto,
          numeroPortalCompras_(
            item.cbmCaja
          ),
          cbmTotal,
          String(
            item.observacion || ''
          ).trim(),
          estadoItemD41,
          ahora,
          email,
          relacionOcD41.ambiguo
            ? 'OC AMBIGUA - REVISAR'
            : (
                relacionOcD41.oc
                  ? 'OC VINCULADA AUTOMÁTICAMENTE'
                  : 'OC NO ENCONTRADA'
              )
        ]);
      }
    );

    if (
      filasDetalle.length === 0
    ) {
      throw new Error(
        'No quedaron líneas válidas para guardar.'
      );
    }

    shDet.getRange(
      shDet.getLastRow() + 1,
      1,
      filasDetalle.length,
      filasDetalle[0].length
    )
    .setValues(
      filasDetalle
    );

    const estadoCabeceraInicialD41 =
      estadosLogisticosD4_()[
        Math.max(
          0,
          indiceEstadoMinimoD41
        )
      ] || 'A EMBARCAR';

    shCab.appendRow([
      idPl,
      pi,
      proveedor,
      fechaPl,
      estadoCabeceraInicialD41,
      skusUnicos.size,
      totalUnidades,
      totalCajas,
      pesoBrutoTotal,
      pesoNetoTotal,
      cbmTotalGeneral,
      archivo,
      '',
      ahora,
      email
    ]);

    SpreadsheetApp.flush();

    let diferenciasSku = 0;
    let unidadesDiferencia = 0;
    let sinCompra = 0;

    plPorSku.forEach(
      function(cantidadPl, sku) {

        const compra =
          comprasPorSku.get(
            sku
          );

        if (!compra) {
          sinCompra++;
          diferenciasSku++;
          unidadesDiferencia +=
            numeroPortalCompras_(
              cantidadPl
            );
          return;
        }

        const diferencia =
          numeroPortalCompras_(
            cantidadPl
          ) -
          numeroPortalCompras_(
            compra.cantidad
          );

        if (
          diferencia !== 0
        ) {
          diferenciasSku++;
          unidadesDiferencia +=
            diferencia;
        }
      }
    );

    /*
     * También detectamos SKU comprados que no aparecen en PL.
     */
    comprasPorSku.forEach(
      function(compra, sku) {

        if (
          !plPorSku.has(
            sku
          )
        ) {
          diferenciasSku++;
          unidadesDiferencia -=
            numeroPortalCompras_(
              compra.cantidad
            );
        }
      }
    );

    return {
      ok: true,
      idPl: idPl,
      pi: pi,
      proveedor: proveedor,
      lineas:
        filasDetalle.length,
      sku:
        skusUnicos.size,
      unidades:
        totalUnidades,
      cajas:
        totalCajas,
      cbm:
        cbmTotalGeneral,
      diferenciasSku:
        diferenciasSku,
      diferenciaUnidades:
        unidadesDiferencia,
      skuSinCompraPi:
        sinCompra,
      estadoLogistico:
        estadoCabeceraInicialD41,
      ocVinculadas:
        ocVinculadasD41,
      ocAmbiguas:
        ocAmbiguasD41,
      ocSinRelacion:
        ocSinRelacionD41
    };

  } finally {

    lock.releaseLock();
  }
}


/**
 * Elimina un PL anterior por ID para permitir reimportarlo.
 */
function eliminarPackingListExistente_(
  shCab,
  shDet,
  idPl
) {

  const clave =
    String(
      idPl || ''
    ).trim();

  if (!clave) {
    return;
  }

  [
    shDet,
    shCab
  ].forEach(
    function(sh) {

      if (
        !sh ||
        sh.getLastRow() < 2
      ) {
        return;
      }

      const valores =
        sh.getRange(
          1,
          1,
          sh.getLastRow(),
          sh.getLastColumn()
        )
        .getDisplayValues();

      const headers =
        valores[0]
          .map(
            normalizarPortalCompras_
          );

      const cId =
        headers.indexOf(
          'ID_PL'
        );

      if (
        cId < 0
      ) {
        return;
      }

      const filas = [];

      for (
        let f = 1;
        f < valores.length;
        f++
      ) {

        if (
          String(
            valores[f][cId] || ''
          ).trim() ===
          clave
        ) {
          filas.push(
            f + 1
          );
        }
      }

      /*
       * Se borra de abajo hacia arriba para no desplazar índices.
       */
      filas
        .sort(
          function(a, b) {
            return b - a;
          }
        )
        .forEach(
          function(fila) {
            sh.deleteRow(
              fila
            );
          }
        );
    }
  );
}


/**
 * Devuelve cabeceras y detalle para la solapa Packing List.
 */
function obtenerPackingListPortal(
  tokenPortal
) {

  validarUsuarioPortalCompras_(
    tokenPortal
  );

  const ss =
    SpreadsheetApp.getActiveSpreadsheet();

  const shCab =
    obtenerHojaPackingListPortal_(
      ss
    );

  const shDet =
    obtenerHojaPackingListDetallePortal_(
      ss
    );

  const cabeceras = [];
  const detalles = [];
  const proveedores =
    new Set();

  const estados =
    new Set(
      PORTAL_COMPRAS
        .estadosLogisticos
    );

  if (
    shCab.getLastRow() >= 2
  ) {

    const v =
      leerHojaPackingSeguro_(
        shCab
      );

    const headers =
      v[0].map(
        normalizarPortalCompras_
      );

    const idx = {};

    headers.forEach(
      function(h, i) {
        idx[h] = i;
      }
    );

    for (
      let f = 1;
      f < v.length;
      f++
    ) {

      const fila =
        v[f];

      const idPl =
        String(
          fila[
            idx.ID_PL
          ] || ''
        ).trim();

      if (!idPl) {
        continue;
      }

      const proveedor =
        String(
          fila[
            idx.PROVEEDOR
          ] || ''
        ).trim();

      const estado =
        String(
          fila[
            idx.ESTADO_LOGISTICO
          ] || 'EN FÁBRICA'
        )
        .trim()
        .toUpperCase();

      if (proveedor) {
        proveedores.add(
          proveedor
        );
      }

      if (estado) {
        estados.add(
          estado
        );
      }

      cabeceras.push({
        idPl: idPl,
        pi:
          String(
            fila[idx.PI] || ''
          ).trim(),
        proveedor: proveedor,
        fechaPl:
          formatearFechaPortalCompras_(
            fila[idx.FECHA_PL]
          ),
        estadoLogistico:
          estado,
        totalSku:
          numeroPortalCompras_(
            fila[idx.TOTAL_SKU]
          ),
        totalUnidades:
          numeroPortalCompras_(
            fila[idx.TOTAL_UNIDADES]
          ),
        totalCajas:
          numeroPortalCompras_(
            fila[idx.TOTAL_CAJAS]
          ),
        pesoBrutoTotal:
          numeroPortalCompras_(
            fila[idx.PESO_BRUTO_TOTAL]
          ),
        pesoNetoTotal:
          numeroPortalCompras_(
            fila[idx.PESO_NETO_TOTAL]
          ),
        cbmTotal:
          numeroPortalCompras_(
            fila[idx.CBM_TOTAL]
          ),
        archivoOrigen:
          String(
            fila[idx.ARCHIVO_ORIGEN] || ''
          ).trim(),
        observacion:
          String(
            fila[idx.OBSERVACION] || ''
          ).trim(),
        estadoItem:
          String(
            fila[idx.ESTADO_ITEM] || estadoCabeceraPorId_(cabeceras, idPl) || 'EN FÁBRICA'
          ).trim().toUpperCase(),
        fechaEstado:
          formatearFechaPortalCompras_(fila[idx.FECHA_ESTADO]),
        responsableEstado:
          String(fila[idx.RESPONSABLE_ESTADO] || '').trim(),
        observacionEstado:
          String(fila[idx.OBSERVACION_ESTADO] || '').trim()
      });
    }
  }

  if (
    shDet.getLastRow() >= 2
  ) {

    const v =
      leerHojaPackingSeguro_(
        shDet
      );

    const headers =
      v[0].map(
        normalizarPortalCompras_
      );

    const idx = {};

    headers.forEach(
      function(h, i) {
        idx[h] = i;
      }
    );


    const cOcProveedor =
      idx.OC_PROVEEDOR !== undefined
        ? idx.OC_PROVEEDOR
        : idx.OC;

    const cOcInterna =
      idx.OC_INTERNA !== undefined
        ? idx.OC_INTERNA
        : -1;

    for (
      let f = 1;
      f < v.length;
      f++
    ) {

      const fila =
        v[f];

      const idPl =
        String(
          fila[
            idx.ID_PL
          ] || ''
        ).trim();

      const sku =
        String(
          fila[
            idx.SKU
          ] || ''
        ).trim();

      if (
        !idPl ||
        !sku
      ) {
        continue;
      }

      detalles.push({
        idPl: idPl,
        pi:
          String(
            fila[idx.PI] || ''
          ).trim(),
        nroEnvio:
          String(
            fila[idx.NRO_ENVIO] || ''
          ).trim(),
        // Compatibilidad: oc conserva la OC del proveedor para código cliente previo.
        oc:
          cOcProveedor >= 0
            ? String(fila[cOcProveedor] || '').trim()
            : '',
        ocProveedor:
          cOcProveedor >= 0
            ? String(fila[cOcProveedor] || '').trim()
            : '',
        ocInterna:
          cOcInterna >= 0
            ? String(fila[cOcInterna] || '').trim()
            : '',
        sku: sku,
        descripcion:
          String(
            fila[idx.DESCRIPCION] || ''
          ).trim(),
        cantidadComprada:
          numeroPortalCompras_(
            fila[idx.CANTIDAD_COMPRADA]
          ),
        cantidadPl:
          numeroPortalCompras_(
            fila[idx.CANTIDAD_PL]
          ),
        diferencia:
          numeroPortalCompras_(
            fila[idx.DIFERENCIA]
          ),
        unidad:
          String(
            fila[idx.UNIDAD] || ''
          ).trim(),
        qtyCaja:
          numeroPortalCompras_(
            fila[idx.QTY_CAJA]
          ),
        cajas:
          numeroPortalCompras_(
            fila[idx.CAJAS]
          ),
        rangoCajas:
          String(
            fila[idx.RANGO_CAJAS] || ''
          ).trim(),
        pesoBruto:
          numeroPortalCompras_(
            fila[idx.PESO_BRUTO]
          ),
        pesoNeto:
          numeroPortalCompras_(
            fila[idx.PESO_NETO]
          ),
        cbmCaja:
          numeroPortalCompras_(
            fila[idx.CBM_CAJA]
          ),
        cbmTotal:
          numeroPortalCompras_(
            fila[idx.CBM_TOTAL]
          ),
        observacion:
          String(
            fila[idx.OBSERVACION] || ''
          ).trim()
      });
    }
  }

  let unidadesPl = 0;
  let diferencias = 0;

  detalles.forEach(
    function(d) {
      unidadesPl +=
        d.cantidadPl;

      diferencias +=
        d.diferencia;
    }
  );

  return {
    actualizado:
      Utilities.formatDate(
        new Date(),
        Session.getScriptTimeZone(),
        'dd/MM/yyyy HH:mm'
      ),

    cabeceras:
      cabeceras,

    detalles:
      detalles,

    proveedores:
      Array.from(
        proveedores
      ).sort(
        function(a, b) {
          return a.localeCompare(
            b,
            'es'
          );
        }
      ),

    estados:
      Array.from(
        estados
      ),

    resumen: {
      packingLists:
        cabeceras.length,
      sku:
        detalles.length,
      unidadesPl:
        unidadesPl,
      diferencias:
        diferencias
    }
  };
}


/**
 * ============================================================
 * TRANSFERENCIAS ENTRE DEPÓSITOS - B.1.9-C
 *
 * Objetivo:
 *   WARNES  10%
 *   ESCOBAR 90%
 *
 * Tolerancia:
 *   WARNES entre 7% y 13%.
 *   ESCOBAR entre 87% y 93%.
 *
 * Si el SKU queda fuera de banda, propone llevarlo al punto
 * central 10% / 90%, respetando unidades enteras.
 * ============================================================
 */
function obtenerTransferenciasStockPortal(tokenPortal) {

  validarAccesoModuloPortal_(tokenPortal, 'TRANSFERENCIAS');

  const ss =
    SpreadsheetApp.getActiveSpreadsheet();

  const sh =
    ss.getSheetByName(
      PORTAL_COMPRAS.hojaGestionActiva
    );

  if (!sh) {
    throw new Error(
      'No existe la hoja ' +
      PORTAL_COMPRAS.hojaGestionActiva +
      '.'
    );
  }

  if (sh.getLastRow() < 2) {
    return {
      actualizado:
        Utilities.formatDate(
          new Date(),
          Session.getScriptTimeZone(),
          'dd/MM/yyyy HH:mm'
        ),
      registros: [],
      marcas: [],
      resumen: {
        skuTransferir: 0,
        unidadesEscobarWarnes: 0,
        unidadesWarnesEscobar: 0,
        dentroTolerancia: 0,
        sinStock: 0
      }
    };
  }

  const valores =
    sh.getDataRange()
      .getValues();

  const headers =
    valores[0]
      .map(
        normalizarPortalCompras_
      );

  const idx = {};

  headers.forEach(
    function(h, i) {
      idx[h] = i;
    }
  );

  const cSku =
    buscarColumnaPortal_(
      idx,
      ['SKU']
    );

  const cDescripcion =
    buscarColumnaPortal_(
      idx,
      ['DESCRIPCION']
    );

  const cMarca =
    buscarColumnaPortal_(
      idx,
      ['MARCA']
    );

  const cWarnes =
    buscarColumnaPortal_(
      idx,
      ['STOCK_WARNES']
    );

  const cEscobar =
    buscarColumnaPortal_(
      idx,
      ['STOCK_ESCOBAR']
    );

  if (
    cSku < 0 ||
    cWarnes < 0 ||
    cEscobar < 0
  ) {
    throw new Error(
      'GESTION_COMPRAS_ACTIVA debe contener SKU, STOCK_WARNES y STOCK_ESCOBAR.'
    );
  }

  const registros = [];
  const marcas = new Set();

  let dentroTolerancia = 0;
  let sinStock = 0;
  let unidadesEscobarWarnes = 0;
  let unidadesWarnesEscobar = 0;

  for (
    let f = 1;
    f < valores.length;
    f++
  ) {

    const fila =
      valores[f];

    const sku =
      String(
        fila[cSku] || ''
      ).trim();

    if (!sku) {
      continue;
    }

    const stockWarnes =
      Math.max(
        0,
        numeroPortalCompras_(
          fila[cWarnes]
        )
      );

    const stockEscobar =
      Math.max(
        0,
        numeroPortalCompras_(
          fila[cEscobar]
        )
      );

    const total =
      stockWarnes +
      stockEscobar;

    if (total <= 0) {
      sinStock++;
      continue;
    }

    const porcentajeWarnes =
      stockWarnes /
      total;

    if (
      porcentajeWarnes >= 0.07 &&
      porcentajeWarnes <= 0.13
    ) {
      dentroTolerancia++;
      continue;
    }

    const objetivoWarnes =
      calcularObjetivoWarnesTransferencia_(
        total
      );

    const cantidad =
      Math.abs(
        objetivoWarnes -
        stockWarnes
      );

    if (cantidad <= 0) {
      continue;
    }

    let direccion = '';

    if (
      objetivoWarnes >
      stockWarnes
    ) {
      direccion =
        'ESCOBAR → WARNES';

      unidadesEscobarWarnes +=
        cantidad;

    } else {
      direccion =
        'WARNES → ESCOBAR';

      unidadesWarnesEscobar +=
        cantidad;
    }

    const marca =
      cMarca >= 0
        ? (
            String(
              fila[cMarca] ||
              'SIN MARCA'
            ).trim() ||
            'SIN MARCA'
          )
        : 'SIN MARCA';

    marcas.add(
      marca
    );

    const pctWarnesFinal =
      objetivoWarnes /
      total;

    registros.push({
      sku:
        sku,

      descripcion:
        cDescripcion >= 0
          ? String(
              fila[cDescripcion] || ''
            ).trim()
          : '',

      marca:
        marca,

      stockWarnes:
        stockWarnes,

      stockEscobar:
        stockEscobar,

      stockTotal:
        total,

      porcentajeWarnes:
        porcentajeWarnes,

      porcentajeEscobar:
        stockEscobar /
        total,

      direccion:
        direccion,

      cantidadTransferir:
        cantidad,

      warnesFinal:
        objetivoWarnes,

      escobarFinal:
        total -
        objetivoWarnes,

      porcentajeWarnesFinal:
        pctWarnesFinal,

      porcentajeEscobarFinal:
        1 -
        pctWarnesFinal,

      aproximado:
        !(
          pctWarnesFinal >= 0.07 &&
          pctWarnesFinal <= 0.13
        )
    });
  }

  registros.sort(
    function(a, b) {

      if (
        b.cantidadTransferir !==
        a.cantidadTransferir
      ) {
        return (
          b.cantidadTransferir -
          a.cantidadTransferir
        );
      }

      return a.sku.localeCompare(
        b.sku,
        'es'
      );
    }
  );

  return {
    actualizado:
      Utilities.formatDate(
        new Date(),
        Session.getScriptTimeZone(),
        'dd/MM/yyyy HH:mm'
      ),

    registros:
      registros,

    marcas:
      Array.from(
        marcas
      ).sort(
        function(a, b) {
          return a.localeCompare(
            b,
            'es'
          );
        }
      ),

    resumen: {
      skuTransferir:
        registros.length,
      unidadesEscobarWarnes:
        unidadesEscobarWarnes,
      unidadesWarnesEscobar:
        unidadesWarnesEscobar,
      dentroTolerancia:
        dentroTolerancia,
      sinStock:
        sinStock
    }
  };
}


function calcularObjetivoWarnesTransferencia_(
  stockTotal
) {

  const total =
    Math.max(
      0,
      Math.round(
        numeroPortalCompras_(
          stockTotal
        )
      )
    );

  if (total <= 0) {
    return 0;
  }

  const teorico =
    total *
    0.10;

  const candidatos = [
    Math.max(
      0,
      Math.floor(
        teorico
      )
    ),
    Math.min(
      total,
      Math.ceil(
        teorico
      )
    )
  ];

  let mejor =
    candidatos[0];

  let mejorDesvio =
    Math.abs(
      mejor /
      total -
      0.10
    );

  candidatos.forEach(
    function(cantidad) {

      const desvio =
        Math.abs(
          cantidad /
          total -
          0.10
        );

      if (
        desvio <
        mejorDesvio
      ) {
        mejor =
          cantidad;
        mejorDesvio =
          desvio;
      }
    }
  );

  return mejor;
}


/**
 * ============================================================
 * CONFIGURACIÓN DE MARCAS - B.1.9-C
 * ============================================================
 */
function obtenerMapaConfigMarcasPortal_(
  ss
) {

  const sh =
    ss.getSheetByName(
      PORTAL_COMPRAS.hojaConfigMarcas
    );

  const mapa =
    new Map();

  if (
    !sh ||
    sh.getLastRow() < 2
  ) {
    return mapa;
  }

  const datos =
    sh.getDataRange()
      .getValues();

  const headers =
    datos[0]
      .map(
        normalizarPortalCompras_
      );

  const idx = {};

  headers.forEach(
    function(h, i) {
      idx[h] = i;
    }
  );

  const cMarca =
    buscarColumnaPortal_(
      idx,
      ['MARCA']
    );

  if (
    cMarca < 0
  ) {
    return mapa;
  }

  const cCompra =
    buscarColumnaPortal_(
      idx,
      ['COMPRA']
    );

  const cOrigen =
    buscarColumnaPortal_(
      idx,
      ['ORIGEN']
    );

  const cObjetivo =
    buscarColumnaPortal_(
      idx,
      ['COBERTURA_OBJETIVO']
    );

  for (
    let f = 1;
    f < datos.length;
    f++
  ) {

    const marca =
      claveMarcaPortal_(
        datos[f][
          cMarca
        ]
      );

    if (!marca) {
      continue;
    }

    mapa.set(
      marca,
      {
        compra:
          cCompra >= 0
            ? String(
                datos[f][
                  cCompra
                ] || 'NO'
              )
              .trim()
              .toUpperCase()
            : 'NO',

        origen:
          cOrigen >= 0
            ? String(
                datos[f][
                  cOrigen
                ] || 'SIN CONFIGURAR'
              )
              .trim()
              .toUpperCase()
            : 'SIN CONFIGURAR',

        objetivo:
          cObjetivo >= 0
            ? numeroPortalCompras_(
                datos[f][
                  cObjetivo
                ]
              )
            : 0
      }
    );
  }

  return mapa;
}



/**
 * Devuelve la configuración aplicable a una marca, resolviendo
 * primero ALIAS_MARCAS_COMPRA si el módulo B.1.9-A.2 está cargado.
 */
function obtenerConfigMarcaPortal_(
  marca,
  configMarcas,
  mapaAlias
) {

  const original =
    String(
      marca || ''
    ).trim();

  const resuelta =
    typeof resolverMarcaCompra_ ===
    'function'
      ? resolverMarcaCompra_(
          original,
          mapaAlias
        )
      : original;

  return (
    configMarcas.get(
      claveMarcaPortal_(
        resuelta
      )
    ) || {
      compra: 'NO',
      origen: 'SIN CONFIGURAR',
      objetivo: 0
    }
  );
}


function obtenerMapaAliasPortal_(
  ss
) {

  return (
    typeof obtenerMapaAliasMarcasCompra_ ===
    'function'
      ? obtenerMapaAliasMarcasCompra_(
          ss
        )
      : new Map()
  );
}



function claveMarcaPortal_(
  valor
) {

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


/**
 * ============================================================
 * UTILIDADES
 * ============================================================
 */
function buscarColumnaPortal_(
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

      return idx[
        nombre
      ];
    }
  }

  return -1;
}


function normalizarPortalCompras_(
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


function normalizarClavePortalCompras_(
  valor
) {

  return String(
    valor || ''
  )
    .trim()
    .toUpperCase();
}


function numeroPortalCompras_(
  valor
) {

  if (
    typeof valor ===
    'number'
  ) {

    return valor;
  }

  let texto =
    String(
      valor || ''
    ).trim();

  if (!texto) {
    return 0;
  }

  texto =
    texto.replace(
      /\s/g,
      ''
    );

  if (
    texto.includes(
      ','
    ) &&
    texto.includes(
      '.'
    )
  ) {

    if (
      texto.lastIndexOf(
        ','
      ) >
      texto.lastIndexOf(
        '.'
      )
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
    texto.includes(
      ','
    )
  ) {

    texto =
      texto.replace(
        ',',
        '.'
      );
  }

  const numero =
    Number(
      texto
    );

  return isNaN(
    numero
  )
    ? 0
    : numero;
}


function formatearFechaPortalCompras_(
  valor
) {

  if (!valor) {
    return '';
  }

  let fecha =
    valor;

  if (
    Object.prototype
      .toString
      .call(
        fecha
      ) !==
      '[object Date]'
  ) {

    fecha =
      new Date(
        valor
      );
  }

  if (
    isNaN(
      fecha.getTime()
    )
  ) {

    return String(
      valor
    );
  }

  return Utilities.formatDate(
    fecha,
    Session.getScriptTimeZone(),
    'dd/MM/yyyy HH:mm'
  );
}


function escaparHtmlPortal_(
  texto
) {

  return String(
    texto || ''
  )
    .replace(
      /&/g,
      '&amp;'
    )
    .replace(
      /</g,
      '&lt;'
    )
    .replace(
      />/g,
      '&gt;'
    )
    .replace(
      /"/g,
      '&quot;'
    )
    .replace(
      /'/g,
      '&#039;'
    );
}


/** B.1.9-D.3 - Contenedores */
function obtenerHojaContenedoresPortal_(ss) {
  let sh=ss.getSheetByName(PORTAL_COMPRAS.hojaContenedores);
  const headers=['NRO_CONTENEDOR','FECHA_EMBARQUE','ETA','ESTADO','OBSERVACION','FECHA_CARGA','USUARIO_CARGA'];
  if(!sh) sh=ss.insertSheet(PORTAL_COMPRAS.hojaContenedores);
  if(sh.getLastRow()===0){sh.getRange(1,1,1,headers.length).setValues([headers]).setFontWeight('bold').setBackground('#123d6a').setFontColor('white');sh.setFrozenRows(1);}
  return sh;
}
function obtenerHojaContenedorPackingPortal_(ss) {
  let sh=ss.getSheetByName(PORTAL_COMPRAS.hojaContenedorPacking);
  const headers=['NRO_CONTENEDOR','ID_PL','FECHA_ASOCIACION','USUARIO'];
  if(!sh) sh=ss.insertSheet(PORTAL_COMPRAS.hojaContenedorPacking);
  if(sh.getLastRow()===0){sh.getRange(1,1,1,headers.length).setValues([headers]).setFontWeight('bold').setBackground('#123d6a').setFontColor('white');sh.setFrozenRows(1);}
  return sh;
}
function guardarContenedorPortal(datos,tokenPortal){
  validarUsuarioPortalCompras_(tokenPortal);
  datos=datos||{}; const numero=String(datos.numero||'').trim().toUpperCase(); if(!numero) throw new Error('Falta el número de contenedor.');
  const ss=SpreadsheetApp.getActiveSpreadsheet(), sh=obtenerHojaContenedoresPortal_(ss);
  const vals=sh.getDataRange().getValues(); let row=0; for(let i=1;i<vals.length;i++){if(String(vals[i][0]||'').trim().toUpperCase()===numero){row=i+1;break;}}
  const email=Session.getActiveUser().getEmail()||'';
  const nueva=[numero,datos.fechaEmbarque||'',datos.eta||'',String(datos.estado||'EMBARCADO').toUpperCase(),datos.observacion||'',new Date(),email];
  if(row) sh.getRange(row,1,1,nueva.length).setValues([nueva]); else sh.appendRow(nueva);
  return {ok:true,numero:numero};
}
function asociarPackingListContenedorPortal(numero,idPl,tokenPortal){
  validarUsuarioPortalCompras_(tokenPortal); numero=String(numero||'').trim().toUpperCase(); idPl=String(idPl||'').trim(); if(!numero||!idPl) throw new Error('Falta contenedor o Packing List.');
  const ss=SpreadsheetApp.getActiveSpreadsheet(), sh=obtenerHojaContenedorPackingPortal_(ss), vals=sh.getDataRange().getValues();
  for(let i=1;i<vals.length;i++){if(String(vals[i][1]||'').trim()===idPl){sh.getRange(i+1,1).setValue(numero);sh.getRange(i+1,3).setValue(new Date());return {ok:true};}}
  sh.appendRow([numero,idPl,new Date(),Session.getActiveUser().getEmail()||'']); return {ok:true};
}
function obtenerContenedoresPortal(tokenPortal){
  validarUsuarioPortalCompras_(tokenPortal); const ss=SpreadsheetApp.getActiveSpreadsheet(), shC=obtenerHojaContenedoresPortal_(ss), shA=obtenerHojaContenedorPackingPortal_(ss);
  const packing=obtenerPackingListPortal(tokenPortal), cab={}; packing.cabeceras.forEach(x=>cab[x.idPl]=x);
  const contenedores=[]; if(shC.getLastRow()>=2){const v=shC.getDataRange().getValues();for(let i=1;i<v.length;i++){if(!v[i][0])continue;contenedores.push({numero:String(v[i][0]),fechaEmbarque:formatearFechaPortalCompras_(v[i][1]),eta:formatearFechaPortalCompras_(v[i][2]),estado:String(v[i][3]||''),observacion:String(v[i][4]||'')});}}
  const asociaciones=[]; const usados=new Set(); if(shA.getLastRow()>=2){const v=shA.getDataRange().getValues();for(let i=1;i<v.length;i++){const numero=String(v[i][0]||''),idPl=String(v[i][1]||'');if(!numero||!idPl)continue; usados.add(idPl);const c=cab[idPl]||{};asociaciones.push({numero:numero,idPl:idPl,pi:c.pi||'',proveedor:c.proveedor||'',unidades:Number(c.totalUnidades||0),cajas:Number(c.totalCajas||0),cbm:Number(c.cbmTotal||0)});}}
  let cajas=0,cbm=0; asociaciones.forEach(a=>{cajas+=a.cajas;cbm+=a.cbm;});
  return {actualizado:Utilities.formatDate(new Date(),Session.getScriptTimeZone(),'dd/MM/yyyy HH:mm'),contenedores:contenedores,asociaciones:asociaciones,packingDisponibles:packing.cabeceras.filter(x=>!usados.has(x.idPl)),resumen:{contenedores:contenedores.length,packingLists:asociaciones.length,cajas:cajas,cbm:cbm}};
}


/** Seguimiento gráfico de contenedores - V1.3 - 2026-09-10 */
function obtenerSeguimientoContenedoresPortal(tokenPortal) {
  validarUsuarioPortalCompras_(tokenPortal);

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName('ORDENES');

  if (!sh) {
    throw new Error('No existe la hoja ORDENES.');
  }

  var ahora = new Date();
  var tz = Session.getScriptTimeZone();

  if (sh.getLastRow() < 2) {
    return {
      actualizado: Utilities.formatDate(ahora, tz, 'dd/MM/yyyy HH:mm'),
      registros: [],
      errores: [],
      resumen: {
        enSeguimiento: 0,
        enFabrica: 0,
        aEmbarcar: 0,
        embarcado: 0,
        aIngresar: 0,
        ingresado: 0,
        demorados: 0,
        errores: 0
      }
    };
  }

  var v = sh.getDataRange().getValues();

  function norm(x) {
    return String(x || '')
      .trim()
      .toUpperCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }

  function keyHeader(x) {
    return norm(x).replace(/\s+/g, '_');
  }

  var h = v[0].map(keyHeader);
  var ix = {};
  h.forEach(function(x, i) {
    ix[x] = i;
  });

  function col() {
    for (var i = 0; i < arguments.length; i++) {
      var k = keyHeader(arguments[i]);
      if (ix[k] !== undefined) return ix[k];
    }
    return -1;
  }

  function get(row) {
    for (var i = 1; i < arguments.length; i++) {
      var c = col(arguments[i]);
      if (c >= 0) return row[c];
    }
    return '';
  }

  function fechaObj(x) {
    if (!x) return null;

    if (x instanceof Date && !isNaN(x)) {
      return new Date(x.getTime());
    }

    var s = String(x).trim();
    var m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2}))?/);

    if (m) {
      return new Date(
        Number(m[3]),
        Number(m[2]) - 1,
        Number(m[1]),
        Number(m[4] || 0),
        Number(m[5] || 0),
        0,
        0
      );
    }

    var d = new Date(x);
    return isNaN(d) ? null : d;
  }

  function fmt(x) {
    var d = fechaObj(x);
    return d ? Utilities.formatDate(d, tz, 'dd/MM/yyyy') : String(x || '');
  }

  function diasDesde(d) {
    if (!d) return null;

    var a = new Date(ahora.getTime());
    var b = new Date(d.getTime());

    a.setHours(0, 0, 0, 0);
    b.setHours(0, 0, 0, 0);

    return Math.max(
      0,
      Math.floor((a.getTime() - b.getTime()) / 86400000)
    );
  }

  function contenedorDe(s) {
    return String(s || '')
      .trim()
      .replace(/^CONTENEDOR\s*/i, '')
      .trim();
  }

  /*
   * V1.6:
   * La fecha de estado NO se deriva de FECHA_ORDEN.
   * Sólo se usa una fecha si existe evidencia de un cambio real
   * al STATUS actual en HISTORIAL_ESTADOS_LOGISTICA.
   */
  var historialPorClave = {};
  var shHist = ss.getSheetByName('HISTORIAL_ESTADOS_LOGISTICA');

  if (shHist && shHist.getLastRow() >= 2) {
    var hv = shHist.getDataRange().getValues();
    var hh = hv[0].map(keyHeader);
    var hi = {};
    hh.forEach(function(x, i) {
      hi[x] = i;
    });

    function hval(row, nombre) {
      var c = hi[keyHeader(nombre)];
      return c === undefined ? '' : row[c];
    }

    for (var hr = 1; hr < hv.length; hr++) {
      var hrow = hv[hr];

      var fechaH = fechaObj(hval(hrow, 'FECHA'));
      var estadoH = norm(hval(hrow, 'ESTADO_NUEVO'));
      var piH = String(hval(hrow, 'PI') || '').trim();
      var ocH = String(hval(hrow, 'OC') || '').trim();
      var plH = String(hval(hrow, 'ID_PL') || '').trim();

      if (!fechaH || !estadoH) continue;

      [
        piH ? 'PI|' + norm(piH) : '',
        ocH ? 'OC|' + norm(ocH) : '',
        plH ? 'PL|' + norm(plH) : ''
      ].forEach(function(clave) {
        if (!clave) return;

        var k = clave + '|' + estadoH;

        if (
          !historialPorClave[k] ||
          fechaH.getTime() > historialPorClave[k].getTime()
        ) {
          historialPorClave[k] = fechaH;
        }
      });
    }
  }

  function fechaEstadoHistorial(orden, pl, estado) {
    var en = norm(estado);

    var candidatos = [
      orden ? historialPorClave['PI|' + norm(orden) + '|' + en] : null,
      orden ? historialPorClave['OC|' + norm(orden) + '|' + en] : null,
      pl ? historialPorClave['PL|' + norm(pl) + '|' + en] : null
    ].filter(Boolean);

    if (!candidatos.length) return null;

    candidatos.sort(function(a, b) {
      return b.getTime() - a.getTime();
    });

    return candidatos[0];
  }

  var grupos = {};
  var errores = [];

  var validos = {
    'EN FABRICA': 'EN FÁBRICA',
    'A EMBARCAR': 'A EMBARCAR',
    'EMBARCADO': 'EMBARCADO',
    'A INGRESAR': 'A INGRESAR',
    'INGRESADO': 'INGRESADO'
  };

  for (var r = 1; r < v.length; r++) {
    var row = v[r];

    var orden = String(
      get(
        row,
        'ID_ORDEN',
        'ORDEN',
        'NUMERO_ORDEN',
        'NUMERO_PI',
        'PI'
      ) || ''
    ).trim();

    var proveedor = String(
      get(row, 'PROVEEDOR') || ''
    ).trim();

    var statusRaw = String(
      get(row, 'STATUS', 'ESTADO') || ''
    ).trim();

    var stN = norm(statusRaw);

    if (!validos[stN]) continue;

    var estado = validos[stN];

    var situacion = String(
      get(row, 'SITUACION') || ''
    ).trim();

    var sitN = norm(situacion);

    var pl = String(
      get(row, 'PACKING_LIST', 'PACKING LIST') || ''
    ).trim();

    var fEmb = get(
      row,
      'FECHA_EMBARQUE',
      'FECHA EMBARQUE'
    );

    var eta = get(
      row,
      'FECHA_ESTIMADA_ARRIBO',
      'FECHA ESTIMADA ARRIBO',
      'ETA'
    );

    var fArr = get(
      row,
      'FECHA_ARRIBO',
      'FECHA ARRIBO'
    );

    var fIng = get(
      row,
      'FECHA_INGRESO',
      'FECHA INGRESO'
    );

    var unidades = Number(
      get(row, 'UNIDADES')
    ) || 0;

    var lineas = Number(
      get(row, 'LINEAS')
    ) || 0;

    var esPost =
      estado === 'EMBARCADO' ||
      estado === 'A INGRESAR' ||
      estado === 'INGRESADO';

    var incons = '';

    if (
      esPost &&
      sitN.indexOf('EN FABRICA') >= 0
    ) {
      incons =
        'Un contenedor no puede estar EN FABRICA cuando STATUS = ' +
        estado +
        '.';
    } else if (
      esPost &&
      sitN.indexOf('CONTENEDOR') !== 0
    ) {
      incons =
        'STATUS ' +
        estado +
        ' requiere una SITUACION que identifique el CONTENEDOR.';
    } else if (
      estado === 'EN FÁBRICA' &&
      sitN.indexOf('CONTENEDOR') === 0
    ) {
      incons =
        'Una orden EN FABRICA no debería estar asignada a un contenedor.';
    }

    if (incons) {
      errores.push({
        fila: r + 1,
        orden: orden,
        status: statusRaw,
        situacion: situacion,
        proveedor: proveedor,
        motivo: incons
      });

      continue;
    }

    var numero = esPost
      ? contenedorDe(situacion)
      : '';

    var clave = esPost
      ? 'C|' + norm(numero)
      : 'P|' + norm(pl || orden || ('FILA ' + (r + 1)));

    var fechaEstadoReal = fechaEstadoHistorial(
      orden,
      pl,
      estado
    );

    if (!grupos[clave]) {
      grupos[clave] = {
        tipo: esPost ? 'CONTENEDOR' : 'ORDEN',
        numero: numero,
        idPl: pl,
        pi: orden,
        ordenes: [],
        packingLists: [],
        proveedores: [],
        proveedor: proveedor,
        estado: estado,
        situacion: situacion,

        fechaEstado: fechaEstadoReal
          ? fmt(fechaEstadoReal)
          : '',

        fechaEstadoFuente: fechaEstadoReal
          ? 'HISTORIAL_ESTADOS_LOGISTICA'
          : '',

        fechaEstadoObj: fechaEstadoReal,

        fechaEmbarque: fmt(fEmb),
        eta: fmt(eta),
        fechaArribo: fmt(fArr),
        fechaIngreso: fmt(fIng),

        diasEstado: fechaEstadoReal
          ? diasDesde(fechaEstadoReal)
          : null,

        unidades: 0,
        lineas: 0,
        cajas: 0,
        cbm: 0,
        observacion: '',
        ocProveedor: '',
        filas: []
      };
    }

    var g = grupos[clave];

    if (g.estado !== estado) {
      errores.push({
        fila: r + 1,
        orden: orden,
        status: statusRaw,
        situacion: situacion,
        proveedor: proveedor,
        motivo:
          'El mismo contenedor/agrupación tiene más de un STATUS (' +
          g.estado +
          ' / ' +
          estado +
          ').'
      });
    }

    if (
      fechaEstadoReal &&
      (
        !g.fechaEstadoObj ||
        fechaEstadoReal.getTime() > g.fechaEstadoObj.getTime()
      )
    ) {
      g.fechaEstadoObj = fechaEstadoReal;
      g.fechaEstado = fmt(fechaEstadoReal);
      g.fechaEstadoFuente = 'HISTORIAL_ESTADOS_LOGISTICA';
      g.diasEstado = diasDesde(fechaEstadoReal);
    }

    if (
      orden &&
      g.ordenes.indexOf(orden) < 0
    ) {
      g.ordenes.push(orden);
    }

    if (
      pl &&
      g.packingLists.indexOf(pl) < 0
    ) {
      g.packingLists.push(pl);
    }

    if (
      proveedor &&
      g.proveedores.indexOf(proveedor) < 0
    ) {
      g.proveedores.push(proveedor);
    }

    g.unidades += unidades;
    g.lineas += lineas;
    g.filas.push(r + 1);

    if (!g.fechaEmbarque && fEmb) {
      g.fechaEmbarque = fmt(fEmb);
    }

    if (!g.eta && eta) {
      g.eta = fmt(eta);
    }

    if (!g.fechaArribo && fArr) {
      g.fechaArribo = fmt(fArr);
    }

    if (!g.fechaIngreso && fIng) {
      g.fechaIngreso = fmt(fIng);
    }
  }

  /*
   * Regla de demora V1.6:
   *
   * - EN FÁBRICA / A EMBARCAR:
   *   no se marca demora hasta definir un SLA/fecha objetivo.
   *
   * - EMBARCADO / A INGRESAR:
   *   demora sólo si ETA es una fecha válida, ya venció
   *   y todavía no existe FECHA_INGRESO.
   *
   * - INGRESADO:
   *   nunca figura como demorado.
   */
  function esDemorado(g) {
    if (
      g.estado !== 'EMBARCADO' &&
      g.estado !== 'A INGRESAR'
    ) {
      return false;
    }

    if (g.fechaIngreso) {
      return false;
    }

    var etaObj = fechaObj(g.eta);

    if (!etaObj) {
      return false;
    }

    var hoy = new Date(ahora.getTime());
    hoy.setHours(0, 0, 0, 0);
    etaObj.setHours(0, 0, 0, 0);

    return etaObj.getTime() < hoy.getTime();
  }

  var registros = Object.keys(grupos).map(function(k) {
    var g = grupos[k];

    g.pi = g.ordenes.join(', ');
    g.idPl = g.packingLists.join(', ');
    g.proveedor = g.proveedores.join(' / ');
    g.cantidadOrdenes = g.ordenes.length;
    g.cantidadPackingLists = g.packingLists.length;
    g.cantidadProveedores = g.proveedores.length;
    g.demora = esDemorado(g);

    delete g.fechaEstadoObj;

    return g;
  });

  var resumen = {
    enSeguimiento: 0,
    activos: 0,
    enFabrica: 0,
    aEmbarcar: 0,
    embarcado: 0,
    aIngresar: 0,
    ingresado: 0,
    demorados: 0,
    errores: errores.length
  };

  registros.forEach(function(x) {
    if (x.estado !== 'INGRESADO') {
      resumen.enSeguimiento++;
      resumen.activos++;
    }

    if (x.estado === 'EN FÁBRICA') {
      resumen.enFabrica++;
    }

    if (x.estado === 'A EMBARCAR') {
      resumen.aEmbarcar++;
    }

    if (x.estado === 'EMBARCADO') {
      resumen.embarcado++;
    }

    if (x.estado === 'A INGRESAR') {
      resumen.aIngresar++;
    }

    if (x.estado === 'INGRESADO') {
      resumen.ingresado++;
    }

    if (x.demora) {
      resumen.demorados++;
    }
  });

  return {
    actualizado: Utilities.formatDate(
      ahora,
      tz,
      'dd/MM/yyyy HH:mm'
    ),
    registros: registros,
    errores: errores,
    resumen: resumen
  };
}

/** Detalle y trazabilidad de una tarjeta del seguimiento. */
function obtenerDetalleSeguimientoContenedorPortal(referencia,tipo,tokenPortal){
  validarUsuarioPortalCompras_(tokenPortal);
  referencia=String(referencia||'').trim(); tipo=String(tipo||'').trim().toUpperCase();
  var seg=obtenerSeguimientoContenedoresPortal(tokenPortal), reg=null;
  (seg.registros||[]).some(function(x){var ok=tipo==='CONTENEDOR'?String(x.numero||'')===referencia:String(x.idPl||x.pi||'')===referencia;if(ok){reg=x;return true;}return false;});
  if(!reg) throw new Error('No se encontró el registro seleccionado.');
  var packing=obtenerPackingListPortal(tokenPortal), pls=String(reg.idPl||'').split(',').map(function(x){return x.trim();}).filter(Boolean);
  var items=(packing.detalles||[]).filter(function(d){return pls.indexOf(String(d.idPl||''))>=0;}).map(function(d){return {ocProveedor:d.ocProveedor||d.oc||'',sku:d.sku||'',descripcion:d.descripcion||'',cantidadPl:Number(d.cantidadPl||0),cajas:Number(d.cajas||0),estado:reg.estado||''};});
  return {registro:reg,items:items,historial:[],fuente:'ORDENES'};
}


/** Seguimiento operativo de contenedores - V1.4 - 2026-09-10 */
function cambiarEstadoSeguimientoContenedorPortal(datos, tokenPortal) {
  validarUsuarioPortalCompras_(tokenPortal);
  throw new Error('Desde V1.5 el seguimiento se obtiene de ORDENES (STATUS + SITUACION). Actualizá esos campos en ORDENES; no se mantiene un estado paralelo.');
}

/* ============================================================
 * B.1.9-D.4.1 - ESTADOS LOGISTICOS POR OC E ITEM
 * ============================================================ */
function estadoCabeceraPorId_(cabeceras, idPl) {
  for (var i = 0; i < cabeceras.length; i++) {
    if (cabeceras[i].idPl === idPl) return cabeceras[i].estadoLogistico || 'EN FÁBRICA';
  }
  return 'EN FÁBRICA';
}

function estadosLogisticosD4_() {
  return ['EN FÁBRICA','A EMBARCAR','EMBARCADO','A INGRESAR','INGRESADO'];
}

function obtenerHojaHistorialEstadosLogistica_(ss) {
  var nombre = 'HISTORIAL_ESTADOS_LOGISTICA';
  var sh = ss.getSheetByName(nombre);
  var headers = ['FECHA','OC','ID_PL','PI','SKU','ESTADO_ANTERIOR','ESTADO_NUEVO','USUARIO','OBSERVACION'];
  if (!sh) sh = ss.insertSheet(nombre);
  if (sh.getLastRow() === 0) {
    sh.getRange(1,1,1,headers.length).setValues([headers])
      .setFontWeight('bold').setBackground('#123d6a').setFontColor('white');
    sh.setFrozenRows(1);
  }
  return sh;
}

function validarEstadoLogisticoD4_(estado) {
  estado = String(estado || '').trim().toUpperCase();
  if (estadosLogisticosD4_().indexOf(estado) === -1) {
    throw new Error('Estado logístico inválido: ' + estado);
  }
  return estado;
}

function cambiarEstadoOcPackingPortal(oc, estadoNuevo, observacion, tokenPortal) {
  validarUsuarioPortalCompras_(tokenPortal);
  oc = String(oc || '').trim();
  if (!oc) throw new Error('Indicá una OC.');
  estadoNuevo = validarEstadoLogisticoD4_(estadoNuevo);
  return actualizarEstadosPackingD4_({tipo:'OC', oc:oc, estado:estadoNuevo, observacion:observacion}, tokenPortal);
}

function cambiarEstadoItemsPackingPortal(items, estadoNuevo, observacion, tokenPortal) {
  validarUsuarioPortalCompras_(tokenPortal);
  if (!Array.isArray(items) || !items.length) throw new Error('Seleccioná al menos un ítem.');
  estadoNuevo = validarEstadoLogisticoD4_(estadoNuevo);
  return actualizarEstadosPackingD4_({tipo:'ITEMS', items:items, estado:estadoNuevo, observacion:observacion}, tokenPortal);
}

function actualizarEstadosPackingD4_(req, tokenPortal) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = obtenerHojaPackingListDetallePortal_(ss);
  if (sh.getLastRow() < 2) throw new Error('No hay detalle de Packing List cargado.');
  var vals = leerHojaPackingSeguro_(sh);
  var headers = vals[0].map(normalizarPortalCompras_);
  var idx = {}; headers.forEach(function(h,i){idx[h]=i;});
  var cOcProveedor = idx.OC_PROVEEDOR !== undefined ? idx.OC_PROVEEDOR : idx.OC;
  if (cOcProveedor === undefined) throw new Error('No existe la columna OC_PROVEEDOR en PACKING_LIST_DETALLE.');
  var usuario = validarUsuarioPortalCompras_(tokenPortal);
  var ahora = new Date();
  var hist = [];
  var tocados = {};
  var cambios = 0;
  var cambiosFuenteD41 = [];

  function coincide(fila) {
    if (req.tipo === 'OC') return String(fila[cOcProveedor] || '').trim() === req.oc || String(fila[idx.PI] || '').trim() === req.oc;
    var idPl = String(fila[idx.ID_PL] || '').trim();
    var oc = String(fila[cOcProveedor] || '').trim();
    var sku = String(fila[idx.SKU] || '').trim();
    return req.items.some(function(x){
      return String(x.idPl||'').trim()===idPl && String(x.oc||'').trim()===oc && String(x.sku||'').trim()===sku;
    });
  }

  for (var r=1; r<vals.length; r++) {
    var fila=vals[r];
    if (!coincide(fila)) continue;
    var anterior=String(fila[idx.ESTADO_ITEM] || '').trim().toUpperCase();
    if (!anterior) anterior='EN FÁBRICA';
    if (anterior === req.estado) continue;
    fila[idx.ESTADO_ITEM]=req.estado;
    fila[idx.FECHA_ESTADO]=ahora;
    fila[idx.RESPONSABLE_ESTADO]=usuario;
    fila[idx.OBSERVACION_ESTADO]=String(req.observacion||'').trim();
    var idPl=String(fila[idx.ID_PL]||'').trim();
    tocados[idPl]=true;
    hist.push([ahora,String(fila[cOcProveedor]||'').trim(),idPl,String(fila[idx.PI]||'').trim(),String(fila[idx.SKU]||'').trim(),anterior,req.estado,usuario,String(req.observacion||'').trim()]);

    cambiosFuenteD41.push({
      oc:
        String(
          fila[cOcProveedor] || ''
        ).trim(),
      sku:
        String(
          fila[idx.SKU] || ''
        ).trim(),
      packingList:
        String(
          fila[idx.PI] || ''
        ).trim(),
      estado:
        req.estado
    });

    cambios++;
  }
  if (!cambios) throw new Error(req.tipo==='OC' ? 'No se encontraron ítems para la OC indicada o ya tienen ese estado.' : 'Los ítems seleccionados ya tienen ese estado.');
  sh.getRange(1,1,vals.length,vals[0].length).setValues(vals);
  if (hist.length) {
    var shHist=obtenerHojaHistorialEstadosLogistica_(ss);
    shHist.getRange(shHist.getLastRow()+1,1,hist.length,hist[0].length).setValues(hist);
  }
  var sincronizadosFuenteD41 =
    sincronizarStatusDetalleImportacionesD41_(
      ss,
      cambiosFuenteD41
    );

  recalcularEstadoCabeceraPackingD4_(ss, Object.keys(tocados));
  SpreadsheetApp.flush();

  return {
    ok:true,
    cambios:cambios,
    estado:req.estado,
    detalleImportacionesActualizados:
      sincronizadosFuenteD41
  };
}


/**
 * Sincroniza el estado del ítem con DETALLE_IMPORTACIONES.STATUS_LINEA.
 *
 * Sólo actualiza coincidencias exactas:
 * ID_ORDEN + ITEM + PACKING_LIST (cuando está disponible).
 */
function sincronizarStatusDetalleImportacionesD41_(
  ss,
  cambios
) {

  if (
    !Array.isArray(
      cambios
    ) ||
    !cambios.length
  ) {
    return 0;
  }

  var sh =
    ss.getSheetByName(
      'DETALLE_IMPORTACIONES'
    );

  if (
    !sh ||
    sh.getLastRow() < 2
  ) {
    return 0;
  }

  var vals =
    sh.getRange(
      1,
      1,
      sh.getLastRow(),
      sh.getLastColumn()
    )
    .getValues();

  var headers =
    vals[0].map(
      normalizarPortalCompras_
    );

  var idx = {};

  headers.forEach(
    function(h, i) {
      idx[h] = i;
    }
  );

  if (
    idx.ID_ORDEN === undefined ||
    idx.ITEM === undefined ||
    idx.STATUS_LINEA === undefined
  ) {
    return 0;
  }

  var mapa = {};

  cambios.forEach(
    function(c) {

      var oc =
        normalizarClavePortalCompras_(
          c.oc
        );

      var sku =
        normalizarClavePortalCompras_(
          c.sku
        );

      if (
        !oc ||
        !sku
      ) {
        return;
      }

      var pl =
        normalizarClavePortalCompras_(
          c.packingList
        );

      mapa[
        oc +
        '|' +
        sku +
        '|' +
        pl
      ] =
        c.estado;
    }
  );

  var actualizados = 0;

  for (
    var r = 1;
    r < vals.length;
    r++
  ) {

    var ocFila =
      normalizarClavePortalCompras_(
        vals[r][idx.ID_ORDEN]
      );

    var skuFila =
      normalizarClavePortalCompras_(
        vals[r][idx.ITEM]
      );

    var plFila =
      idx.PACKING_LIST !== undefined
        ? normalizarClavePortalCompras_(
            vals[r][idx.PACKING_LIST]
          )
        : '';

    var clave =
      ocFila + '|' + skuFila + '|' + plFila;

    if (
      !mapa[clave]
    ) {
      continue;
    }

    vals[r][idx.STATUS_LINEA] =
      mapa[clave];

    actualizados++;
  }

  if (
    actualizados > 0
  ) {

    sh.getRange(
      1,
      1,
      vals.length,
      vals[0].length
    )
    .setValues(
      vals
    );
  }

  return actualizados;
}


function recalcularEstadoCabeceraPackingD4_(ss, idsPl) {
  if (!idsPl || !idsPl.length) return;
  var orden=estadosLogisticosD4_();
  var shDet=obtenerHojaPackingListDetallePortal_(ss);
  var det=leerHojaPackingSeguro_(shDet);
  var hd=det[0].map(normalizarPortalCompras_), id={}; hd.forEach(function(h,i){id[h]=i;});
  var minPor={};
  for(var r=1;r<det.length;r++){
    var pl=String(det[r][id.ID_PL]||'').trim();
    if(idsPl.indexOf(pl)===-1) continue;
    var est=String(det[r][id.ESTADO_ITEM]||'EN FÁBRICA').trim().toUpperCase();
    var n=orden.indexOf(est); if(n<0)n=0;
    if(minPor[pl]===undefined || n<minPor[pl]) minPor[pl]=n;
  }
  var shCab=obtenerHojaPackingListPortal_(ss);
  var cab=leerHojaPackingSeguro_(shCab);
  var hc=cab[0].map(normalizarPortalCompras_), ic={}; hc.forEach(function(h,i){ic[h]=i;});
  for(var x=1;x<cab.length;x++){
    var pl=String(cab[x][ic.ID_PL]||'').trim();
    if(minPor[pl]!==undefined) cab[x][ic.ESTADO_LOGISTICO]=orden[minPor[pl]];
  }
  shCab.getRange(1,1,cab.length,cab[0].length).setValues(cab);
}

function probarEnvioMailPortal() {
  MailApp.sendEmail({
    to: "etelias@gmail.com",
    subject: "Prueba autorización SII",
    body: "Prueba de autorización de MailApp."
  });
}