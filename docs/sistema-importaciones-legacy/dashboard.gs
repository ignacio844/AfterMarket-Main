/********************************************************************
 * DASHBOARD V4.5.1 
 ********************************************************************/
function generarDashboard_() {

  const ss = SpreadsheetApp.getActive();

  let sh = ss.getSheetByName("DASHBOARD");

  if (!sh) {
    sh = ss.insertSheet("DASHBOARD");
  }

  sh.clear();
  sh.clearFormats();
  sh.clearConditionalFormatRules();
  sh.getCharts().forEach(chart => sh.removeChart(chart));
  sh.setHiddenGridlines(true);

  const plan = ss.getSheetByName("PLAN_COMPRAS");

  if (!plan)
    throw new Error("No existe PLAN_COMPRAS");

  const datos = plan.getDataRange().getValues();

  if (datos.length <= 1)
    return;

  const cab = datos[0];

  const idx = {};

  cab.forEach((c,i)=>{
    idx[String(c).trim().toUpperCase()] = i;
  });

  function col(nombre){

    if(idx[nombre]===undefined)
      throw new Error("No existe columna: "+nombre);

    return idx[nombre];

  }

  const cEstado=col("ESTADO_COMPRA");
  const cStock=col("STOCK_TOTAL");
  const cPend=col("PENDIENTE_RECIBIR");
  const cSug=col("CANTIDAD_SUGERIDA");
  const cCob=col("COBERTURA_ACTUAL_MESES");

  let urgentes=0;
  let comprar=0;
  let revisar=0;
  let ok=0;

  let stock=0;
  let pendiente=0;
  let compra=0;

  let sumaCob=0;
  let cantCob=0;

  for(let i=1;i<datos.length;i++){

      const f=datos[i];

      switch(String(f[cEstado]).trim().toUpperCase()){

        case "URGENTE":
          urgentes++;
          break;

        case "COMPRAR":
          comprar++;
          break;

        case "REVISAR":
          revisar++;
          break;

        case "OK":
          ok++;
          break;

      }

      stock+=Number(f[cStock])||0;
      pendiente+=Number(f[cPend])||0;
      compra+=Number(f[cSug])||0;

      const cob=Number(f[cCob]);

      if(!isNaN(cob)){

          sumaCob+=cob;
          cantCob++;

      }

  }

  const total=urgentes+comprar+revisar+ok;

  const indicadores={

      urgentes,

      comprar,

      revisar,

      ok,

      porcUrgentes:total?urgentes*100/total:0,

      porcComprar:total?comprar*100/total:0,

      porcRevisar:total?revisar*100/total:0,

      porcOk:total?ok*100/total:0,

      stock,

      pendiente,

      compra,

      cobertura:cantCob?(sumaCob/cantCob):0

  };

  escribirCabeceraDashboard_(sh,indicadores);

  //
  // siguientes módulos
  //

  escribirTopSkuCriticos_(sh, datos, idx);

  escribirTopProveedores_(sh, datos, idx);

  escribirTopMarcas_(sh, datos, idx);

  // crearGraficosDashboard_(sh);

}

function escribirCabeceraDashboard_(sh,kpi){

  sh.setFrozenRows(3);

  sh.setColumnWidths(1,12,135);

  sh.setRowHeights(1,20,32);

  sh.getRange("A1:L2")
    .merge()
    .setValue("PLAN DE COMPRAS - DASHBOARD EJECUTIVO")
    .setBackground("#0B5394")
    .setFontColor("white")
    .setFontWeight("bold")
    .setFontSize(20)
    .setHorizontalAlignment("center")
    .setVerticalAlignment("middle");

  sh.getRange("A3:L3")
    .merge()
    .setValue(
      "Última actualización: "+
      Utilities.formatDate(
        new Date(),
        Session.getScriptTimeZone(),
        "dd/MM/yyyy HH:mm"
      )
    )
    .setBackground("#D9EAD3")
    .setFontWeight("bold")
    .setHorizontalAlignment("center");

  crearTarjeta_(
      sh,
      5,
      1,
      "🔴 CRÍTICOS",
      kpi.urgentes,
      kpi.porcUrgentes,
      "#C62828"
  );

  crearTarjeta_(
      sh,
      5,
      4,
      "🟠 COMPRAR",
      kpi.comprar,
      kpi.porcComprar,
      "#EF6C00"
  );

  crearTarjeta_(
      sh,
      5,
      7,
      "🟡 REVISAR",
      kpi.revisar,
      kpi.porcRevisar,
      "#F9A825"
  );

  crearTarjeta_(
      sh,
      5,
      10,
      "🟢 OK",
      kpi.ok,
      kpi.porcOk,
      "#2E7D32"
  );

  crearTarjetaInventario_(
      sh,
      11,
      1,
      "📦 STOCK",
      kpi.stock,
      "#1565C0"
  );

  crearTarjetaInventario_(
      sh,
      11,
      5,
      "🚢 PENDIENTE",
      kpi.pendiente,
      "#0D47A1"
  );

  crearTarjetaInventario_(
      sh,
      11,
      9,
      "📈 COBERTURA",
      Utilities.formatString("%.2f meses",kpi.cobertura),
      "#00838F"
  );

}

function crearTarjeta_(sh, fila, col, titulo, valor, porcentaje, color) {

  const rango = sh.getRange(fila, col, 4, 3);
  const textoValor = Math.round(Number(valor)).toLocaleString("es-AR");

  rango
    .merge()
    .setBackground(color)
    .setFontColor("white")
    .setBorder(true, true, true, true, true, true)
    .setHorizontalAlignment("center")
    .setVerticalAlignment("middle");

  rango.setValue(
      titulo +
      "\n\n" + 
      Math.round(Number(valor)).toLocaleString("es-AR") +
      "\n\n" +
      Utilities.formatString("%.1f %%", porcentaje)
  );

  rango.setFontWeight("bold");
  rango.setFontSize(15);

}

function crearTarjetaInventario_(sh, fila, col, titulo, valor, color) {

  const rango = sh.getRange(fila, col, 3, 3);

  let textoValor;

  if (typeof valor === "number") {

    textoValor = valor.toLocaleString(
      "es-AR",
      {
        maximumFractionDigits:0
      }
    );

  } else {

    textoValor = valor;

  }

  rango
    .merge()
    .setBackground(color)
    .setFontColor("white")
    .setBorder(true,true,true,true,true,true)
    .setHorizontalAlignment("center")
    .setVerticalAlignment("middle");

  rango.setValue(

      titulo +

      "\n\n" +

      textoValor

  );

  rango.setFontWeight("bold");
  rango.setFontSize(15);

} 

function generarDashboard() {
  generarDashboard_();
}

function obtenerIndiceDashboard_(idx, nombres, obligatorio) {

  for (let i = 0; i < nombres.length; i++) {

    const nombre = String(nombres[i]).trim().toUpperCase();

    if (idx[nombre] !== undefined) {
      return idx[nombre];
    }

  }

  if (obligatorio) {
    throw new Error(
      "No se encontró ninguna de estas columnas: " +
      nombres.join(", ")
    );
  }

  return -1;

}

function escribirTopMarcas_(sh, datos, idx) {

  const cEstado = obtenerIndiceDashboard_(
    idx,
    ["ESTADO_COMPRA", "ESTADO COMPRA", "ESTADO"],
    true
  );

  const cMarca = obtenerIndiceDashboard_(
    idx,
    ["MARCA"],
    true
  );

  const cSugerida = obtenerIndiceDashboard_(
    idx,
    ["CANTIDAD_SUGERIDA", "CANTIDAD SUGERIDA", "COMPRA_SUGERIDA"],
    true
  );

  const agrupado = {};

  for (let i = 1; i < datos.length; i++) {

    const fila = datos[i];
    const marca = String(fila[cMarca] || "").trim();

    if (!marca) {
      continue;
    }

    if (!agrupado[marca]) {

      agrupado[marca] = {
        marca: marca,
        criticos: 0,
        comprar: 0,
        sugerida: 0
      };

    }

    const estado = String(fila[cEstado]).trim().toUpperCase();

    if (
      estado === "URGENTE" ||
      estado === "CRITICO" ||
      estado === "CRÍTICO"
    ) {
      agrupado[marca].criticos++;
    }

    if (estado === "COMPRAR") {
      agrupado[marca].comprar++;
    }

    agrupado[marca].sugerida +=
      Number(fila[cSugerida]) || 0;

  }

  const ranking = Object.keys(agrupado)
    .map(function(clave) {
      return agrupado[clave];
    })
    .sort(function(a, b) {

      if (b.criticos !== a.criticos) {
        return b.criticos - a.criticos;
      }

      return b.sugerida - a.sugerida;

    })
    .slice(0, 10);

  sh.getRange("G30:L30")
    .merge()
    .setValue("TOP 10 MARCAS")
    .setBackground("#0B5394")
    .setFontColor("white")
    .setFontWeight("bold")
    .setFontSize(13)
    .setHorizontalAlignment("center");

  sh.getRange("G31:I31")
    .merge()
    .setValue("MARCA");

  sh.getRange("J31")
    .setValue("CRÍTICOS");

  sh.getRange("K31")
    .setValue("COMPRAR");

  sh.getRange("L31")
    .setValue("SUGERIDA");

  sh.getRange("G31:L31")
    .setBackground("#D9EAF7")
    .setFontWeight("bold")
    .setHorizontalAlignment("center")
    .setBorder(true, true, true, true, true, true);

  for (let i = 0; i < 10; i++) {

    const filaHoja = 32 + i;
    const reg = ranking[i];

    sh.getRange(filaHoja, 7, 1, 3).merge();

    if (reg) {

      sh.getRange(filaHoja, 7).setValue(reg.marca);
      sh.getRange(filaHoja, 10).setValue(reg.criticos);
      sh.getRange(filaHoja, 11).setValue(reg.comprar);
      sh.getRange(filaHoja, 12).setValue(reg.sugerida);

    }

    sh.getRange(filaHoja, 7, 1, 6)
      .setBackground(i % 2 === 0 ? "#FFFFFF" : "#F3F6F9")
      .setBorder(true, true, true, true, false, false)
      .setVerticalAlignment("middle");

  }

  sh.getRange("J32:L41")
    .setNumberFormat("#,##0")
    .setHorizontalAlignment("right");

  sh.getRange("G32:I41").setWrap(true);
  sh.setRowHeights(32, 10, 28);

}

function escribirTopSkuCriticos_(sh, datos, idx) {

  const cSku        = idx["SKU"];
  const cMarca      = idx["MARCA"];
  const cProveedor  = idx["PROVEEDOR"];
  const cCobertura  = idx["COBERTURA_ACTUAL_MESES"];
  const cSugerida   = idx["CANTIDAD_SUGERIDA"];
  const cEstado     = idx["ESTADO_COMPRA"];
  const cPrioridad  = idx["PRIORIDAD"];

  const lista = [];

  for (let i = 1; i < datos.length; i++) {

    const f = datos[i];

    if (String(f[cEstado]).toUpperCase() != "URGENTE")
      continue;

    lista.push({

      sku: f[cSku],

      marca: f[cMarca],

      proveedor: f[cProveedor],

      cobertura: Number(f[cCobertura]) || 0,

      sugerida: Number(f[cSugerida]) || 0,

      prioridad: Number(f[cPrioridad]) || 0

    });

  }

  lista.sort(function(a,b){

      if(a.cobertura!=b.cobertura)
        return a.cobertura-b.cobertura;

      return b.sugerida-a.sugerida;

  });

  const top=lista.slice(0,10);

  sh.getRange("A16:L16")
    .merge()
    .setValue("TOP 10 SKU CRÍTICOS")
    .setBackground("#0B5394")
    .setFontColor("white")
    .setFontWeight("bold")
    .setHorizontalAlignment("center");

  sh.getRange("A17:B17").merge().setValue("SKU");
  sh.getRange("C17:D17").merge().setValue("MARCA");
  sh.getRange("E17:H17").merge().setValue("PROVEEDOR");
  sh.getRange("I17:J17").merge().setValue("COBERTURA");
  sh.getRange("K17").setValue("COMPRA");
  sh.getRange("L17").setValue("PRIORIDAD");

  sh.getRange("A17:L17")
    .setBackground("#D9EAF7")
    .setFontWeight("bold")
    .setHorizontalAlignment("center");

  for(let i=0;i<10;i++){

      const fila=18+i;

      sh.getRange(fila,1,1,2).merge();
      sh.getRange(fila,3,1,2).merge();
      sh.getRange(fila,5,1,4).merge();
      sh.getRange(fila,9,1,2).merge();

      if(i<top.length){

          sh.getRange(fila,1).setValue(top[i].sku);
          sh.getRange(fila,3).setValue(top[i].marca);
          sh.getRange(fila,5).setValue(top[i].proveedor);
          sh.getRange(fila,9).setValue(top[i].cobertura);
          sh.getRange(fila,11).setValue(top[i].sugerida);
          sh.getRange(fila,12).setValue(top[i].prioridad);

      }

      sh.getRange(fila,1,1,12)
        .setBorder(true,true,true,true,false,false)
        .setBackground(i%2==0?"white":"#F6F8FA");

  }

  sh.getRange("I18:J27")
    .setNumberFormat("0.00");

  sh.getRange("K18:L27")
    .setNumberFormat("#,##0");

}

function escribirTopProveedores_(sh, datos, idx) {

  const cEstado = obtenerIndiceDashboard_(
    idx,
    ["ESTADO_COMPRA", "ESTADO COMPRA", "ESTADO"],
    true
  );

  const cProveedor = obtenerIndiceDashboard_(
    idx,
    ["PROVEEDOR", "NOMBRE_PROVEEDOR", "NOMBRE PROVEEDOR"],
    true
  );

  const cSugerida = obtenerIndiceDashboard_(
    idx,
    ["CANTIDAD_SUGERIDA", "CANTIDAD SUGERIDA", "COMPRA_SUGERIDA"],
    true
  );

  const agrupado = {};

  for (let i = 1; i < datos.length; i++) {

    const fila = datos[i];
    const proveedor = String(fila[cProveedor] || "").trim();

    if (!proveedor) {
      continue;
    }

    if (!agrupado[proveedor]) {

      agrupado[proveedor] = {
        proveedor: proveedor,
        criticos: 0,
        comprar: 0,
        sugerida: 0
      };

    }

    const estado = String(fila[cEstado]).trim().toUpperCase();

    if (
      estado === "URGENTE" ||
      estado === "CRITICO" ||
      estado === "CRÍTICO"
    ) {
      agrupado[proveedor].criticos++;
    }

    if (estado === "COMPRAR") {
      agrupado[proveedor].comprar++;
    }

    agrupado[proveedor].sugerida +=
      Number(fila[cSugerida]) || 0;

  }

  const ranking = Object.keys(agrupado)
    .map(function(clave) {
      return agrupado[clave];
    })
    .sort(function(a, b) {

      if (b.criticos !== a.criticos) {
        return b.criticos - a.criticos;
      }

      return b.sugerida - a.sugerida;

    })
    .slice(0, 10);

  sh.getRange("A30:F30")
    .merge()
    .setValue("TOP 10 PROVEEDORES")
    .setBackground("#0B5394")
    .setFontColor("white")
    .setFontWeight("bold")
    .setFontSize(13)
    .setHorizontalAlignment("center");

  sh.getRange("A31:C31")
    .merge()
    .setValue("PROVEEDOR");

  sh.getRange("D31")
    .setValue("CRÍTICOS");

  sh.getRange("E31")
    .setValue("COMPRAR");

  sh.getRange("F31")
    .setValue("SUGERIDA");

  sh.getRange("A31:F31")
    .setBackground("#D9EAF7")
    .setFontWeight("bold")
    .setHorizontalAlignment("center")
    .setBorder(true, true, true, true, true, true);

  for (let i = 0; i < 10; i++) {

    const filaHoja = 32 + i;
    const reg = ranking[i];

    sh.getRange(filaHoja, 1, 1, 3).merge();

    if (reg) {

      sh.getRange(filaHoja, 1).setValue(reg.proveedor);
      sh.getRange(filaHoja, 4).setValue(reg.criticos);
      sh.getRange(filaHoja, 5).setValue(reg.comprar);
      sh.getRange(filaHoja, 6).setValue(reg.sugerida);

    }

    sh.getRange(filaHoja, 1, 1, 6)
      .setBackground(i % 2 === 0 ? "#FFFFFF" : "#F3F6F9")
      .setBorder(true, true, true, true, false, false)
      .setVerticalAlignment("middle");

  }

  sh.getRange("D32:F41")
    .setNumberFormat("#,##0")
    .setHorizontalAlignment("right");

  sh.getRange("A32:C41").setWrap(true);
  sh.setRowHeights(32, 10, 28);

}