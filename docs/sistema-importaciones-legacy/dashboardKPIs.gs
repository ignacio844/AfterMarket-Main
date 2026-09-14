/**********************************************************************
 * DASHBOARD KPIs V6
 * Sprint B.1.6-C
 *
 * Fuente:
 *   MODELO_COMPRAS
 *
 * Cambios:
 * - Incorpora SIN STOCK como KPI principal.
 * - Cobertura global ponderada:
 *
 *     STOCK TOTAL / PROMEDIO MENSUAL TOTAL
 *
 **********************************************************************/

const DashboardKPIs = {

  calcular(plan) {

    const idx = {};

    plan.headers.forEach(
      (h, i) =>
        idx[
          String(h)
            .trim()
            .toUpperCase()
        ] = i
    );


    const cRiesgo =
      idx["RIESGO"];

    const cStock =
      idx["STOCK_TOTAL"];

    const cPendiente =
      idx["PENDIENTE_TOTAL"];

    const cPromedio =
      idx["PROMEDIO_MENSUAL"];

    const cCompra =
      idx["COMPRA_SUGERIDA"];


    const r = {

      sinStock: 0,

      urgentes: 0,

      comprar: 0,

      revisar: 0,

      ok: 0,

      sinConsumo: 0,

      stock: 0,

      pendiente: 0,

      compraSugerida: 0,

      stockConConsumo: 0,

      promedioTotal: 0,

      cobertura: 0,

      cantidadSKU:
        plan.rows.length

    };


    plan.rows.forEach(f => {

      const riesgo =
        String(
          f[cRiesgo] || ""
        )
          .trim()
          .toUpperCase();


      switch (riesgo) {

        case "SIN STOCK":

          r.sinStock++;
          break;


        case "URGENTE":

          r.urgentes++;
          break;


        case "COMPRAR":

          r.comprar++;
          break;


        case "REVISAR":

          r.revisar++;
          break;


        case "OK":

          r.ok++;
          break;


        case "SIN CONSUMO":

          r.sinConsumo++;
          break;
      }


      const stock =
        Number(
          f[cStock]
        ) || 0;


      const pendiente =
        Number(
          f[cPendiente]
        ) || 0;


      const promedio =
        Number(
          f[cPromedio]
        ) || 0;


      const compra =
        Number(
          f[cCompra]
        ) || 0;


      r.stock += stock;

      r.pendiente += pendiente;

      r.compraSugerida += compra;


      /*
       * Para cobertura ponderada
       * usamos solamente SKU con consumo.
       */
      if (
        promedio > 0
      ) {

        r.stockConConsumo +=
          stock;

        r.promedioTotal +=
          promedio;
      }

    });


    /*
     * COBERTURA GLOBAL PONDERADA
     */
    if (
      r.promedioTotal > 0
    ) {

      r.cobertura =
        r.stockConConsumo /
        r.promedioTotal;
    }


    return r;
  },


  dibujar(sh, kpi) {

    /*
     * ==========================================================
     * FILA PRINCIPAL DE RIESGO
     * ==========================================================
     */

    this.tarjeta(
      sh,
      4,
      1,
      "🔴 SIN STOCK",
      kpi.sinStock,
      "#990000"
    );


    this.tarjeta(
      sh,
      4,
      4,
      "🟠 URGENTES",
      kpi.urgentes,
      "#D32F2F"
    );


    this.tarjeta(
      sh,
      4,
      7,
      "🟡 COMPRAR",
      kpi.comprar,
      "#F57C00"
    );


    this.tarjeta(
      sh,
      4,
      10,
      "🟢 REVISAR",
      kpi.revisar,
      "#FBC02D"
    );


    /*
     * ==========================================================
     * KPIs OPERATIVOS
     * ==========================================================
     */

    this.tarjeta(
      sh,
      8,
      1,
      "📦 STOCK",
      this.n(
        kpi.stock
      ),
      "#1565C0"
    );


    this.tarjeta(
      sh,
      8,
      4,
      "🚢 PENDIENTE",
      this.n(
        kpi.pendiente
      ),
      "#1565C0"
    );


    this.tarjeta(
      sh,
      8,
      7,
      "📈 COBERTURA",
      kpi.cobertura.toFixed(
        2
      ),
      "#1565C0"
    );


    this.tarjeta(
      sh,
      8,
      10,
      "🛒 COMPRA",
      this.n(
        kpi.compraSugerida
      ),
      "#1565C0"
    );

  },


  tarjeta(
    sh,
    fila,
    col,
    titulo,
    valor,
    color
  ) {

    sh.getRange(
      fila,
      col,
      1,
      3
    )
      .merge()
      .setValue(
        titulo
      )
      .setBackground(
        color
      )
      .setFontColor(
        "white"
      )
      .setFontWeight(
        "bold"
      )
      .setHorizontalAlignment(
        "center"
      );


    sh.getRange(
      fila + 1,
      col,
      2,
      3
    )
      .merge()
      .setValue(
        valor
      )
      .setFontSize(
        18
      )
      .setFontWeight(
        "bold"
      )
      .setHorizontalAlignment(
        "center"
      )
      .setVerticalAlignment(
        "middle"
      )
      .setBorder(
        true,
        true,
        true,
        true,
        false,
        false
      );

  },


  n(v) {

    return Math.round(
      v
    ).toLocaleString(
      "es-AR"
    );

  }

};