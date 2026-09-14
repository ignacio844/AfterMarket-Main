/**********************************************************************
 * DASHBOARD RIESGOS V6
 * Sprint B.1.6-B
 *
 * Fuente:
 *   MODELO_COMPRAS
 *
 * Utiliza:
 *   SKU
 *   MARCA
 *   STOCK_TOTAL
 *   PENDIENTE_TOTAL
 *   PROMEDIO_MENSUAL
 *   COBERTURA_ACTUAL
 *   COBERTURA_FUTURA
 *   COBERTURA_OBJETIVO
 *   COMPRA_SUGERIDA
 *   RIESGO
 *   PRIORIDAD
 *
 * No modifica MODELO_COMPRAS.
 **********************************************************************/

const DashboardRiesgos = {

  LIMITE_RANKING: 25,


  /**
   * ============================================================
   * CÁLCULO
   * ============================================================
   */
  calcular: function(plan) {

    if (
      !plan ||
      !plan.headers ||
      !plan.rows
    ) {

      throw new Error(
        "DashboardRiesgos: no se recibieron datos válidos."
      );
    }


    const idx =
      this.obtenerIndices_(
        plan.headers
      );


    const resumen = {

      sinStock: 0,

      urgente: 0,

      comprar: 0,

      revisar: 0,

      ok: 0,

      sinConsumo: 0,

      totalSku: 0,

      skuConCompra: 0,

      unidadesCompra: 0,

      unidadesSinStock: 0,

      unidadesUrgente: 0,

      unidadesComprar: 0,

      unidadesRevisar: 0,

      coberturaFuturaTotal: 0,

      cantidadCobertura: 0,

      coberturaFuturaPromedio: 0
    };


    const ranking = [];


    plan.rows.forEach(
      function(fila) {

        const sku =
          DashboardRiesgos.texto_(
            fila[idx.sku]
          );


        if (!sku) {
          return;
        }


        resumen.totalSku++;


        const marca =
          DashboardRiesgos.texto_(
            fila[idx.marca]
          ) ||
          "SIN MARCA";


        const riesgo =
          DashboardRiesgos.texto_(
            fila[idx.riesgo]
          ).toUpperCase();


        const prioridad =
          DashboardRiesgos.numero_(
            fila[idx.prioridad]
          );


        const promedio =
          DashboardRiesgos.numero_(
            fila[idx.promedio]
          );


        const stock =
          DashboardRiesgos.numero_(
            fila[idx.stock]
          );


        const pendiente =
          DashboardRiesgos.numero_(
            fila[idx.pendiente]
          );


        const compra =
          DashboardRiesgos.numero_(
            fila[idx.compra]
          );


        const objetivo =
          DashboardRiesgos.numero_(
            fila[idx.objetivo]
          );


        const coberturaActual =
          DashboardRiesgos.numeroOpcional_(
            fila[idx.coberturaActual]
          );


        const coberturaFutura =
          DashboardRiesgos.numeroOpcional_(
            fila[idx.coberturaFutura]
          );


        // ======================================================
        // CONTADORES POR RIESGO
        // ======================================================

        switch (riesgo) {

          case "SIN STOCK":

            resumen.sinStock++;

            resumen.unidadesSinStock +=
              compra;

            break;


          case "URGENTE":

            resumen.urgente++;

            resumen.unidadesUrgente +=
              compra;

            break;


          case "COMPRAR":

            resumen.comprar++;

            resumen.unidadesComprar +=
              compra;

            break;


          case "REVISAR":

            resumen.revisar++;

            resumen.unidadesRevisar +=
              compra;

            break;


          case "OK":

            resumen.ok++;
            break;


          case "SIN CONSUMO":

            resumen.sinConsumo++;
            break;
        }


        // ======================================================
        // COMPRA TOTAL
        // ======================================================

        if (compra > 0) {

          resumen.skuConCompra++;

          resumen.unidadesCompra +=
            compra;
        }


        // ======================================================
        // COBERTURA FUTURA PROMEDIO
        // ======================================================

        if (
          coberturaFutura !== null
        ) {

          resumen.coberturaFuturaTotal +=
            coberturaFutura;

          resumen.cantidadCobertura++;
        }


        // ======================================================
        // RANKING OPERATIVO
        // ======================================================

        /*
         * Solamente mostramos SKU que requieren acción.
         */

        if (
          riesgo === "SIN STOCK" ||
          riesgo === "URGENTE" ||
          riesgo === "COMPRAR" ||
          riesgo === "REVISAR"
        ) {

          ranking.push({

            sku: sku,

            marca: marca,

            riesgo: riesgo,

            prioridad: prioridad,

            promedio: promedio,

            stock: stock,

            pendiente: pendiente,

            coberturaActual:
              coberturaActual,

            coberturaFutura:
              coberturaFutura,

            coberturaObjetivo:
              objetivo,

            compraSugerida:
              compra

          });
        }

      }
    );


    // ==========================================================
    // COBERTURA PROMEDIO
    // ==========================================================

    if (
      resumen.cantidadCobertura >
      0
    ) {

      resumen.coberturaFuturaPromedio =
        resumen.coberturaFuturaTotal /
        resumen.cantidadCobertura;
    }


    // ==========================================================
    // ORDEN DEL RANKING
    //
    // 1. PRIORIDAD DESC
    // 2. COBERTURA FUTURA ASC
    // 3. COMPRA SUGERIDA DESC
    // ==========================================================

    ranking.sort(
      function(a, b) {

        if (
          b.prioridad !==
          a.prioridad
        ) {

          return (
            b.prioridad -
            a.prioridad
          );
        }


        const coberturaA =
          a.coberturaFutura === null
            ? 999999
            : a.coberturaFutura;


        const coberturaB =
          b.coberturaFutura === null
            ? 999999
            : b.coberturaFutura;


        if (
          coberturaA !==
          coberturaB
        ) {

          return (
            coberturaA -
            coberturaB
          );
        }


        return (
          b.compraSugerida -
          a.compraSugerida
        );

      }
    );


    return {

      resumen: resumen,

      ranking:
        ranking.slice(
          0,
          this.LIMITE_RANKING
        ),

      cantidadRankingTotal:
        ranking.length

    };
  },


  /**
   * ============================================================
   * DIBUJO PRINCIPAL
   * ============================================================
   */
  /**
   * ============================================================
   * DIBUJO PRINCIPAL
   * ============================================================
   */
  dibujar: function(
    sh,
    datos
  ) {
 
    if (!sh) {
      throw new Error(
        "DashboardRiesgos: no se recibió hoja destino."
      );
    }

    if (
      !datos ||
      !datos.resumen
    ) {
      throw new Error(
        "DashboardRiesgos: no se recibieron resultados."
      );
    }

    /*
    * DashboardMarcas termina aproximadamente
    * en fila 33.
    *
    * Comenzamos directamente con el análisis
    * de impacto, evitando repetir las tarjetas
    * SIN STOCK / URGENTE / COMPRAR / REVISAR
    * que ya aparecen arriba del dashboard.
    */

    const filaInicio =
      Math.max(
        sh.getLastRow() + 2,
        35
      );

    const filaImpactoTitulo =
      filaInicio;

    const filaImpactoEncabezado =
      filaImpactoTitulo + 1;

    const filaImpactoDatos =
      filaImpactoEncabezado + 1;

    const filaRankingTitulo =
      filaImpactoDatos + 6;

    const filaRankingEncabezado =
      filaRankingTitulo + 1;

    const filaRankingDatos =
      filaRankingEncabezado + 1;


    this.dibujarImpacto_(
      sh,
      filaImpactoTitulo,
      filaImpactoEncabezado,
      filaImpactoDatos,
      datos.resumen
    );


    this.dibujarRanking_(
      sh,
      filaRankingTitulo,
      filaRankingEncabezado,
      filaRankingDatos,
      datos
    );
  },


  /**
   * ============================================================
   * TARJETAS
   * ============================================================
   */
  dibujarTarjetas_: function(
    sh,
    fila,
    resumen
  ) {

    this.tarjeta_(
      sh,
      fila,
      1,
      3,
      "SIN STOCK",
      resumen.sinStock,
      "#F4CCCC",
      "#990000"
    );


    this.tarjeta_(
      sh,
      fila,
      4,
      3,
      "URGENTE",
      resumen.urgente,
      "#FCE5CD",
      "#B45F06"
    );


    this.tarjeta_(
      sh,
      fila,
      7,
      3,
      "COMPRAR",
      resumen.comprar,
      "#FFF2CC",
      "#7F6000"
    );


    this.tarjeta_(
      sh,
      fila,
      10,
      3,
      "REVISAR",
      resumen.revisar,
      "#D9EAD3",
      "#274E13"
    );
  },


  tarjeta_: function(
    sh,
    fila,
    columna,
    ancho,
    titulo,
    valor,
    fondo,
    colorTexto
  ) {

    const rangoTitulo =
      sh.getRange(
        fila,
        columna,
        1,
        ancho
      );


    const rangoValor =
      sh.getRange(
        fila + 1,
        columna,
        2,
        ancho
      );


    rangoTitulo
      .merge()
      .setValue(
        titulo
      )
      .setBackground(
        fondo
      )
      .setFontColor(
        colorTexto
      )
      .setFontWeight(
        "bold"
      )
      .setFontSize(10)
      .setHorizontalAlignment(
        "center"
      )
      .setVerticalAlignment(
        "middle"
      );


    rangoValor
      .merge()
      .setValue(
        Number(
          valor || 0
        ).toLocaleString(
          "es-AR"
        )
      )
      .setBackground(
        fondo
      )
      .setFontColor(
        colorTexto
      )
      .setFontWeight(
        "bold"
      )
      .setFontSize(21)
      .setHorizontalAlignment(
        "center"
      )
      .setVerticalAlignment(
        "middle"
      );


    sh.getRange(
      fila,
      columna,
      3,
      ancho
    )
      .setBorder(
        true,
        true,
        true,
        true,
        false,
        false,
        colorTexto,
        SpreadsheetApp
          .BorderStyle
          .SOLID
      );
  },


  /**
   * ============================================================
   * IMPACTO EN UNIDADES
   * ============================================================
   */
  dibujarImpacto_: function(
    sh,
    filaTitulo,
    filaEncabezado,
    filaDatos,
    resumen
  ) {

    sh.getRange(
      filaTitulo,
      1,
      1,
      12
    )
      .merge()
      .setValue(
        "IMPACTO DE COMPRA SUGERIDA"
      )
      .setBackground(
        "#D0E0E3"
      )
      .setFontColor(
        "#134F5C"
      )
      .setFontWeight(
        "bold"
      )
      .setHorizontalAlignment(
        "left"
      );


    const encabezados = [[

      "RIESGO",

      "SKU",

      "UNIDADES SUGERIDAS"

    ]];


    sh.getRange(
      filaEncabezado,
      1,
      1,
      12
    )
      .setBackground(
        "#134F5C"
      )
      .setFontColor(
        "#FFFFFF"
      );


    sh.getRange(
      filaEncabezado,
      1,
      1,
      4
    )
      .merge()
      .setValue(
        "RIESGO"
      );


    sh.getRange(
      filaEncabezado,
      5,
      1,
      4
    )
      .merge()
      .setValue(
        "SKU"
      );


    sh.getRange(
      filaEncabezado,
      9,
      1,
      4
    )
      .merge()
      .setValue(
        "UNIDADES SUGERIDAS"
      );


    sh.getRange(
      filaEncabezado,
      1,
      1,
      12
    )
      .setFontWeight(
        "bold"
      )
      .setHorizontalAlignment(
        "center"
      );


    const filas = [

      [
        "SIN STOCK",
        resumen.sinStock,
        resumen.unidadesSinStock
      ],

      [
        "URGENTE",
        resumen.urgente,
        resumen.unidadesUrgente
      ],

      [
        "COMPRAR",
        resumen.comprar,
        resumen.unidadesComprar
      ],

      [
        "REVISAR",
        resumen.revisar,
        resumen.unidadesRevisar
      ],

      [
        "TOTAL",
        resumen.skuConCompra,
        resumen.unidadesCompra
      ]

    ];


    filas.forEach(
      function(item, posicion) {

        const fila =
          filaDatos +
          posicion;


        sh.getRange(
          fila,
          1,
          1,
          4
        ).merge();


        sh.getRange(
          fila,
          5,
          1,
          4
        ).merge();


        sh.getRange(
          fila,
          9,
          1,
          4
        ).merge();


        sh.getRange(
          fila,
          1
        ).setValue(
          item[0]
        );


        sh.getRange(
          fila,
          5
        ).setValue(
          item[1]
        );


        sh.getRange(
          fila,
          9
        ).setValue(
          item[2]
        );


        let fondo =
          posicion % 2 === 0
            ? "#FFFFFF"
            : "#F3F6F9";


        if (
          item[0] === "TOTAL"
        ) {

          fondo =
            "#D9EAD3";
        }


        sh.getRange(
          fila,
          1,
          1,
          12
        )
          .setBackground(
            fondo
          )
          .setBorder(
            true,
            true,
            true,
            true,
            false,
            false
          )
          .setVerticalAlignment(
            "middle"
          );


        if (
          item[0] === "TOTAL"
        ) {

          sh.getRange(
            fila,
            1,
            1,
            12
          ).setFontWeight(
            "bold"
          );
        }

      }
    );


    sh.getRange(
      filaDatos,
      5,
      filas.length,
      4
    ).setNumberFormat(
      "#,##0"
    );


    sh.getRange(
      filaDatos,
      9,
      filas.length,
      4
    ).setNumberFormat(
      "#,##0"
    );


    sh.getRange(
      filaDatos,
      5,
      filas.length,
      8
    ).setHorizontalAlignment(
      "right"
    );
  },


  /**
   * ============================================================
   * RANKING DE SKU PRIORITARIOS
   * ============================================================
   */
  dibujarRanking_: function(
    sh,
    filaTitulo,
    filaEncabezado,
    filaDatos,
    datos
  ) {

    sh.getRange(
      filaTitulo,
      1,
      1,
      12
    )
      .merge()
      .setValue(
        "SKU PRIORITARIOS" +
        (
          datos.cantidadRankingTotal >
          datos.ranking.length
            ? " — MOSTRANDO " +
              datos.ranking.length +
              " DE " +
              datos.cantidadRankingTotal
            : ""
        )
      )
      .setBackground(
        "#D0E0E3"
      )
      .setFontColor(
        "#134F5C"
      )
      .setFontWeight(
        "bold"
      )
      .setHorizontalAlignment(
        "left"
      );


    const encabezados = [[

      "RIESGO",

      "SKU",

      "MARCA",

      "STOCK",

      "PENDIENTE",

      "COB. ACTUAL",

      "COB. FUTURA",

      "COMPRA"

    ]];


    sh.getRange(
      filaEncabezado,
      1,
      1,
      8
    )
      .setValues(
        encabezados
      )
      .setBackground(
        "#134F5C"
      )
      .setFontColor(
        "#FFFFFF"
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
      .setWrap(true);


    if (
      datos.ranking.length === 0
    ) {

      sh.getRange(
        filaDatos,
        1,
        1,
        8
      )
        .merge()
        .setValue(
          "No existen SKU con recomendación de compra."
        )
        .setBackground(
          "#D9EAD3"
        )
        .setFontColor(
          "#274E13"
        )
        .setFontWeight(
          "bold"
        )
        .setHorizontalAlignment(
          "center"
        );


      return;
    }


    const valores =
      datos.ranking.map(
        function(item) {

          return [

            item.riesgo,

            item.sku,

            item.marca,

            item.stock,

            item.pendiente,

            item.coberturaActual === null
              ? ""
              : item.coberturaActual,

            item.coberturaFutura === null
              ? ""
              : item.coberturaFutura,

            item.compraSugerida

          ];

        }
      );


    const rango =
      sh.getRange(
        filaDatos,
        1,
        valores.length,
        8
      );


    rango
      .setValues(
        valores
      )
      .setFontFamily(
        "Arial"
      )
      .setVerticalAlignment(
        "middle"
      )
      .setBorder(
        true,
        true,
        true,
        true,
        true,
        true,
        "#D9D9D9",
        SpreadsheetApp
          .BorderStyle
          .SOLID
      );


    sh.getRange(
      filaDatos,
      4,
      valores.length,
      2
    ).setNumberFormat(
      "#,##0.00"
    );


    sh.getRange(
      filaDatos,
      6,
      valores.length,
      2
    ).setNumberFormat(
      '0.00'
    );


    sh.getRange(
      filaDatos,
      8,
      valores.length,
      1
    ).setNumberFormat(
      "#,##0"
    );


    // ==========================================================
    // COLOR POR RIESGO
    // ==========================================================

    datos.ranking.forEach(
      function(
        item,
        indice
      ) {

        const filaActual =
          filaDatos +
          indice;


        let fondo =
          "#FFFFFF";


        let texto =
          "#000000";


        if (
          item.riesgo ===
          "SIN STOCK"
        ) {

          fondo =
            "#F4CCCC";

          texto =
            "#990000";

        } else if (
          item.riesgo ===
          "URGENTE"
        ) {

          fondo =
            "#FCE5CD";

          texto =
            "#B45F06";

        } else if (
          item.riesgo ===
          "COMPRAR"
        ) {

          fondo =
            "#FFF2CC";

          texto =
            "#7F6000";

        } else if (
          item.riesgo ===
          "REVISAR"
        ) {

          fondo =
            "#D9EAD3";

          texto =
            "#274E13";
        }


        sh.getRange(
          filaActual,
          1,
          1,
          8
        )
          .setBackground(
            fondo
          )
          .setFontColor(
            texto
          );


        sh.getRange(
          filaActual,
          1
        ).setFontWeight(
          "bold"
        );

      }
    );


    // ==========================================================
    // ANCHOS
    // ==========================================================

    sh.setColumnWidth(
      1,
      110
    );

    sh.setColumnWidth(
      2,
      175
    );

    sh.setColumnWidth(
      3,
      110
    );

    sh.setColumnWidth(
      4,
      100
    );

    sh.setColumnWidth(
      5,
      110
    );

    sh.setColumnWidth(
      6,
      100
    );

    sh.setColumnWidth(
      7,
      100
    );

    sh.setColumnWidth(
      8,
      120
    );
  },


  /**
   * ============================================================
   * ÍNDICES
   * ============================================================
   */
  obtenerIndices_: function(
    headers
  ) {

    const requeridas = {

      sku:
        "SKU",

      marca:
        "MARCA",

      promedio:
        "PROMEDIO_MENSUAL",

      stock:
        "STOCK_TOTAL",

      pendiente:
        "PENDIENTE_TOTAL",

      coberturaActual:
        "COBERTURA_ACTUAL",

      coberturaFutura:
        "COBERTURA_FUTURA",

      objetivo:
        "COBERTURA_OBJETIVO",

      compra:
        "COMPRA_SUGERIDA",

      riesgo:
        "RIESGO",

      prioridad:
        "PRIORIDAD"

    };


    const indices = {};


    Object.keys(
      requeridas
    ).forEach(
      function(clave) {

        const encabezado =
          requeridas[
            clave
          ];


        const indice =
          headers.indexOf(
            encabezado
          );


        if (
          indice === -1
        ) {

          throw new Error(
            "DashboardRiesgos: falta la columna " +
            encabezado +
            " en MODELO_COMPRAS."
          );
        }


        indices[clave] =
          indice;

      }
    );


    return indices;
  },


  /**
   * ============================================================
   * UTILIDADES
   * ============================================================
   */
  texto_: function(
    valor
  ) {

    return String(
      valor === null ||
      valor === undefined
        ? ""
        : valor
    ).trim();
  },


  numero_: function(
    valor
  ) {

    if (
      valor === null ||
      valor === undefined ||
      valor === ""
    ) {

      return 0;
    }


    if (
      typeof valor ===
      "number"
    ) {

      return isFinite(
        valor
      )
        ? valor
        : 0;
    }


    let texto =
      String(valor)
        .trim()
        .replace(
          /\s/g,
          ""
        );


    if (
      texto.includes(",") &&
      texto.includes(".")
    ) {

      const coma =
        texto.lastIndexOf(
          ","
        );


      const punto =
        texto.lastIndexOf(
          "."
        );


      if (
        punto > coma
      ) {

        texto =
          texto.replace(
            /,/g,
            ""
          );

      } else {

        texto =
          texto
            .replace(
              /\./g,
              ""
            )
            .replace(
              ",",
              "."
            );
      }

    } else if (
      texto.includes(",")
    ) {

      texto =
        texto.replace(
          ",",
          "."
        );
    }


    texto =
      texto.replace(
        /[^0-9.-]/g,
        ""
      );


    const numero =
      Number(
        texto
      );


    return isFinite(
      numero
    )
      ? numero
      : 0;
  },


  numeroOpcional_: function(
    valor
  ) {

    if (
      valor === null ||
      valor === undefined ||
      valor === ""
    ) {

      return null;
    }


    const numero =
      this.numero_(
        valor
      );


    return isFinite(
      numero
    )
      ? numero
      : null;
  }

};