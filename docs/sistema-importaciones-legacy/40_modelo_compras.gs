/*******************************************************
 * SII - MODELO DE COMPRAS
 * Sprint B.1.1
 * Versión 0.1.100
 *******************************************************/

const SII_MODELO_COMPRAS = {
  VERSION: '0.1.100',
  HOJA: 'MODELO_COMPRAS',
  HOJA_MAPA_SKU: 'MAPA_SKU',
  FILA_GRUPOS: 1,
  FILA_ENCABEZADOS: 2,
  FILA_DATOS: 3,
  COLUMNAS: [
    'SKU','CODIGO_VIEJO','DESCRIPCION',
    'BASE_OCTOSIS','BASE_SISFACTURA','BASE_MELIKOBO','BASE_TORETTOS','BASE_WARNES',
    'ACTIVO_BAM','ACTIVO_WEB',
    'MARCA','PROVEEDOR','FAMILIA',
    'CONSUMO_12M','PROMEDIO_MENSUAL','CONSUMO_3M',
    'STOCK_WARNES','STOCK_ESCOBAR','STOCK_TOTAL',
    'PENDIENTE_TOTAL','EMBARCADO','EN_FABRICA','PROXIMO_ARRIBO',
    'LEAD_TIME','COBERTURA_OBJETIVO',
    'COBERTURA_ACTUAL','COBERTURA_FUTURA','COMPRA_SUGERIDA','RIESGO','PRIORIDAD'
  ]
};

function crearModeloCompras() {
  const inicio = Date.now();
  const ss = SpreadsheetApp.getActive();
  let sh = ss.getSheetByName(SII_MODELO_COMPRAS.HOJA);
  if (!sh) sh = ss.insertSheet(SII_MODELO_COMPRAS.HOJA);

  const filtro = sh.getFilter();
  if (filtro) filtro.remove();

  const columnasNecesarias = SII_MODELO_COMPRAS.COLUMNAS.length;
  if (sh.getMaxColumns() < columnasNecesarias) {
    sh.insertColumnsAfter(sh.getMaxColumns(), columnasNecesarias - sh.getMaxColumns());
  }

  sh.getRange(1,1,2,Math.max(sh.getLastColumn(), columnasNecesarias)).breakApart();

  const ultimaFila = Math.max(sh.getLastRow(), SII_MODELO_COMPRAS.FILA_DATOS);
  const ultimaColumna = Math.max(sh.getLastColumn(), columnasNecesarias);
  sh.getRange(1,1,ultimaFila,ultimaColumna).clearContent().clearFormat();

  mcCrearGrupo_(sh,1,3,'IDENTIFICACIÓN','#1f4e78');
  mcCrearGrupo_(sh,4,8,'BASES','#5b9bd5');
  mcCrearGrupo_(sh,9,10,'ESTADOS','#7f8c8d');
  mcCrearGrupo_(sh,11,13,'DATOS COMERCIALES','#4472c4');
  mcCrearGrupo_(sh,14,16,'VENTAS','#548235');
  mcCrearGrupo_(sh,17,19,'STOCK','#2f75b5');
  mcCrearGrupo_(sh,20,23,'IMPORTACIONES','#8064a2');
  mcCrearGrupo_(sh,24,25,'PARÁMETROS','#bf9000');
  mcCrearGrupo_(sh,26,30,'RESULTADOS','#c65911');

  sh.getRange(SII_MODELO_COMPRAS.FILA_ENCABEZADOS,1,1,columnasNecesarias)
    .setValues([SII_MODELO_COMPRAS.COLUMNAS])
    .setBackground('#17365d')
    .setFontColor('#ffffff')
    .setFontWeight('bold')
    .setHorizontalAlignment('center')
    .setVerticalAlignment('middle')
    .setWrap(true);

  sh.setRowHeight(1,26);
  sh.setRowHeight(2,42);
  sh.setColumnWidth(1,150);
  sh.setColumnWidth(2,150);
  sh.setColumnWidth(3,300);
  sh.setColumnWidths(4,5,115);
  sh.setColumnWidths(9,2,100);
  sh.setColumnWidth(11,140);
  sh.setColumnWidth(12,220);
  sh.setColumnWidth(13,140);
  sh.setColumnWidths(14,3,125);
  sh.setColumnWidths(17,3,115);
  sh.setColumnWidths(20,3,125);
  sh.setColumnWidth(23,135);
  sh.setColumnWidths(24,2,130);
  sh.setColumnWidths(26,5,125);

  sh.setFrozenRows(2);
  sh.setFrozenColumns(0);
  sh.setHiddenGridlines(true);

  sh.getRange(2,1,2,columnasNecesarias).createFilter();
  sh.activate();
  sh.setActiveSelection('A3');
  SpreadsheetApp.flush();

  const resultado = {
    version: SII_MODELO_COMPRAS.VERSION,
    hoja: SII_MODELO_COMPRAS.HOJA,
    columnas: columnasNecesarias,
    duracionMs: Date.now() - inicio
  };
  console.log(JSON.stringify(resultado,null,2));
  return resultado;
}

function mcCrearGrupo_(sh,columnaDesde,columnaHasta,titulo,color) {
  sh.getRange(1,columnaDesde,1,columnaHasta-columnaDesde+1)
    .merge()
    .setValue(titulo)
    .setBackground(color)
    .setFontColor('#ffffff')
    .setFontWeight('bold')
    .setHorizontalAlignment('center')
    .setVerticalAlignment('middle');
}
