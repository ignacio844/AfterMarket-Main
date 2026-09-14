/**********************************************************************
 * DASHBOARD MARCAS V6
 * Sprint B.1.6-A
 *
 * Fuente:
 *   MODELO_COMPRAS
 *
 * Responsabilidades:
 * - Agrupar por MARCA.
 * - Contar SKU por riesgo.
 * - Sumar compra sugerida.
 * - Calcular cobertura promedio.
 * - Dibujar ranking de marcas.
 *
 * No modifica MODELO_COMPRAS.
 **********************************************************************/

const DashboardMarcas = {

  /**
   * ============================================================
   * CALCULAR INDICADORES POR MARCA
   * ============================================================
   */
  calcular(plan) {

    const idx =
      this.crearIndices_(
        plan.headers
      );

    this.validarColumnas_(idx);

    const agrupado = {};


    plan.rows.forEach(fila => {

      let marca =
        this.texto_(
          fila[idx["MARCA"]]
        );

      if (marca === "") {
        marca = "SIN MARCA";
      }


      const riesgo =
        this.texto_(
          fila[idx["RIESGO"]]
        ).toUpperCase();


      const compraSugerida =
        this.numero_(
          fila[
            idx["COMPRA_SUGERIDA"]
          ]
        );


      const valorCobertura =
        fila[
          idx["COBERTURA_ACTUAL"]
        ];


      if (!agrupado[marca]) {

        agrupado[marca] = {

          marca: marca,

          totalSku: 0,

          sinStock: 0,

          urgentes: 0,

          comprar: 0,

          revisar: 0,

          ok: 0,

          sinConsumo: 0,

          otrosEstados: 0,

          compraSugerida: 0,

          sumaCobertura: 0,

          cantidadCobertura: 0,

          coberturaPromedio: 0

        };
      }


      const item =
        agrupado[marca];


      item.totalSku++;


      switch (riesgo) {

        case "SIN STOCK":

          item.sinStock++;
          break;


        case "URGENTE":

          item.urgentes++;
          break;


        case "COMPRAR":

          item.comprar++;
          break;


        case "REVISAR":

          item.revisar++;
          break;


        case "OK":

          item.ok++;
          break;


        case "SIN CONSUMO":

          item.sinConsumo++;
          break;


        default:

          item.otrosEstados++;
          break;
      }


      item.compraSugerida +=
        compraSugerida;


      /*
       * Cobertura 0 es válida.
       *
       * Sólo excluimos valores realmente
       * vacíos, que corresponden por ejemplo
       * a SKU sin consumo.
       */
      if (
        valorCobertura !== "" &&
        valorCobertura !== null &&
        valorCobertura !== undefined
      ) {

        const cobertura =
          this.numero_(
            valorCobertura
          );

        item.sumaCobertura +=
          cobertura;

        item.cantidadCobertura++;
      }

    });


    // ==========================================================
    // COBERTURA PROMEDIO
    // ==========================================================

    const marcas =
      Object.keys(
        agrupado
      ).map(
        marca => {

          const item =
            agrupado[marca];


          item.coberturaPromedio =
            item.cantidadCobertura > 0
              ? item.sumaCobertura /
                item.cantidadCobertura
              : 0;


          return item;
        }
      );


    // ==========================================================
    // ORDEN
    //
    // 1. SIN STOCK
    // 2. URGENTES
    // 3. COMPRAR
    // 4. COMPRA SUGERIDA
    // ==========================================================

    marcas.sort(
      (a, b) => {

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
          b.urgentes !==
          a.urgentes
        ) {

          return (
            b.urgentes -
            a.urgentes
          );
        }


        if (
          b.comprar !==
          a.comprar
        ) {

          return (
            b.comprar -
            a.comprar
          );
        }


        if (
          b.compraSugerida !==
          a.compraSugerida
        ) {

          return (
            b.compraSugerida -
            a.compraSugerida
          );
        }


        return a.marca.localeCompare(
          b.marca,
          "es"
        );
      }
    );


    return marcas;
  },


  /**
   * ============================================================
   * DIBUJAR PANEL
   * ============================================================
   *
   * Distribución:
   *
   * A:C   MARCA
   * D     SIN STOCK
   * E     URGENTE
   * F     COMPRAR
   * G     REVISAR
   * H:J   COMPRA SUGERIDA
   * K:L   COBERTURA
   *
   * No mostramos OK como columna porque el objetivo
   * de este bloque es priorizar gestión de compra.
   */
  dibujar(sh, marcas) {

    const filaTitulo = 12;
    const filaCabecera = 13;
    const filaInicial = 14;

    const cantidadMostrar = 20;


    const topMarcas =
      marcas.slice(
        0,
        cantidadMostrar
      );


    // ==========================================================
    // TÍTULO
    // ==========================================================

    sh.getRange(
      filaTitulo,
      1,
      1,
      12
    )
      .merge()
      .setValue(
        "ANÁLISIS POR MARCA"
      )
      .setBackground(
        "#0B5394"
      )
      .setFontColor(
        "#FFFFFF"
      )
      .setFontWeight(
        "bold"
      )
      .setFontSize(12)
      .setHorizontalAlignment(
        "center"
      )
      .setVerticalAlignment(
        "middle"
      );


    // ==========================================================
    // ENCABEZADOS
    // ==========================================================

    sh.getRange(
      filaCabecera,
      1,
      1,
      3
    )
      .merge()
      .setValue(
        "MARCA"
      );


    sh.getRange(
      filaCabecera,
      4
    ).setValue(
      "SIN STOCK"
    );


    sh.getRange(
      filaCabecera,
      5
    ).setValue(
      "URGENTE"
    );


    sh.getRange(
      filaCabecera,
      6
    ).setValue(
      "COMPRAR"
    );


    sh.getRange(
      filaCabecera,
      7
    ).setValue(
      "REVISAR"
    );


    sh.getRange(
      filaCabecera,
      8,
      1,
      3
    )
      .merge()
      .setValue(
        "COMPRA SUGERIDA"
      );


    sh.getRange(
      filaCabecera,
      11,
      1,
      2
    )
      .merge()
      .setValue(
        "COBERTURA ACTUAL"
      );


    sh.getRange(
      filaCabecera,
      1,
      1,
      12
    )
      .setBackground(
        "#CFE2F3"
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
        true,
        true
      );


    // ==========================================================
    // FILAS
    // ==========================================================

    for (
      let posicion = 0;
      posicion < cantidadMostrar;
      posicion++
    ) {

      const fila =
        filaInicial +
        posicion;


      /*
       * El dashboard se limpia en cada
       * ejecución, por lo que recreamos
       * combinaciones.
       */

      sh.getRange(
        fila,
        1,
        1,
        3
      ).merge();


      sh.getRange(
        fila,
        8,
        1,
        3
      ).merge();


      sh.getRange(
        fila,
        11,
        1,
        2
      ).merge();


      if (
        posicion <
        topMarcas.length
      ) {

        const item =
          topMarcas[
            posicion
          ];


        sh.getRange(
          fila,
          1
        ).setValue(
          item.marca
        );


        sh.getRange(
          fila,
          4
        ).setValue(
          item.sinStock
        );


        sh.getRange(
          fila,
          5
        ).setValue(
          item.urgentes
        );


        sh.getRange(
          fila,
          6
        ).setValue(
          item.comprar
        );


        sh.getRange(
          fila,
          7
        ).setValue(
          item.revisar
        );


        sh.getRange(
          fila,
          8
        ).setValue(
          item.compraSugerida
        );


        sh.getRange(
          fila,
          11
        ).setValue(
          item.coberturaPromedio
        );
      }


      const fondo =
        posicion % 2 === 0
          ? "#FFFFFF"
          : "#F3F6F9";


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


      sh.getRange(
        fila,
        4,
        1,
        4
      ).setHorizontalAlignment(
        "center"
      );


      sh.getRange(
        fila,
        8,
        1,
        5
      ).setHorizontalAlignment(
        "right"
      );

    }


    // ==========================================================
    // FORMATOS NUMÉRICOS
    // ==========================================================

    sh.getRange(
      filaInicial,
      4,
      cantidadMostrar,
      4
    ).setNumberFormat(
      "#,##0"
    );


    sh.getRange(
      filaInicial,
      8,
      cantidadMostrar,
      3
    ).setNumberFormat(
      "#,##0"
    );


    sh.getRange(
      filaInicial,
      11,
      cantidadMostrar,
      2
    ).setNumberFormat(
      '0.00 "meses"'
    );


    // ==========================================================
    // COLORES ENCABEZADOS
    // ==========================================================

    sh.getRange(
      filaCabecera,
      4
    )
      .setBackground(
        "#990000"
      )
      .setFontColor(
        "#FFFFFF"
      );


    sh.getRange(
      filaCabecera,
      5
    )
      .setBackground(
        "#C62828"
      )
      .setFontColor(
        "#FFFFFF"
      );


    sh.getRange(
      filaCabecera,
      6
    )
      .setBackground(
        "#EF6C00"
      )
      .setFontColor(
        "#FFFFFF"
      );


    sh.getRange(
      filaCabecera,
      7
    )
      .setBackground(
        "#F9A825"
      )
      .setFontColor(
        "#FFFFFF"
      );


    // ==========================================================
    // FORMATO CONDICIONAL SIN STOCK
    // ==========================================================

    const rangoSinStock =
      sh.getRange(
        filaInicial,
        4,
        cantidadMostrar,
        1
      );


    const reglasExistentes =
      sh.getConditionalFormatRules();


    const reglasNuevas = [

      SpreadsheetApp
        .newConditionalFormatRule()
        .whenNumberGreaterThan(0)
        .setBackground(
          "#F4CCCC"
        )
        .setFontColor(
          "#990000"
        )
        .setBold(true)
        .setRanges([
          rangoSinStock
        ])
        .build()

    ];


    sh.setConditionalFormatRules(
      reglasExistentes.concat(
        reglasNuevas
      )
    );


    // ==========================================================
    // DIMENSIONES
    // ==========================================================

    sh.setRowHeight(
      filaTitulo,
      28
    );


    sh.setRowHeight(
      filaCabecera,
      26
    );


    sh.setColumnWidth(
      1,
      110
    );

    sh.setColumnWidth(
      2,
      80
    );

    sh.setColumnWidth(
      3,
      80
    );


    sh.setColumnWidth(
      4,
      95
    );

    sh.setColumnWidth(
      5,
      90
    );

    sh.setColumnWidth(
      6,
      90
    );

    sh.setColumnWidth(
      7,
      90
    );


    sh.setColumnWidth(
      8,
      100
    );

    sh.setColumnWidth(
      9,
      80
    );

    sh.setColumnWidth(
      10,
      80
    );


    sh.setColumnWidth(
      11,
      100
    );

    sh.setColumnWidth(
      12,
      90
    );
  },


  /**
   * ============================================================
   * UTILIDADES
   * ============================================================
   */

  crearIndices_(
    headers
  ) {

    const idx = {};


    headers.forEach(
      (
        header,
        posicion
      ) => {

        const nombre =
          String(
            header || ""
          )
            .trim()
            .toUpperCase();


        if (nombre !== "") {

          idx[nombre] =
            posicion;
        }

      }
    );


    return idx;
  },


  validarColumnas_(
    idx
  ) {

    const obligatorias = [

      "MARCA",

      "RIESGO",

      "COMPRA_SUGERIDA",

      "COBERTURA_ACTUAL"

    ];


    const faltantes =
      obligatorias.filter(
        columna =>
          idx[columna] ===
          undefined
      );


    if (
      faltantes.length > 0
    ) {

      throw new Error(
        "DashboardMarcas: faltan columnas en MODELO_COMPRAS:\n\n" +
        faltantes.join("\n")
      );
    }
  },


  texto_(
    valor
  ) {

    if (
      valor === null ||
      valor === undefined
    ) {

      return "";
    }


    return String(
      valor
    ).trim();
  },


  numero_(
    valor
  ) {

    if (
      valor === "" ||
      valor === null ||
      valor === undefined
    ) {

      return 0;
    }


    if (
      typeof valor ===
      "number"
    ) {

      return isNaN(
        valor
      )
        ? 0
        : valor;
    }


    let texto =
      String(valor)
        .trim()
        .replace(
          /\s/g,
          ""
        );


    if (
      texto.indexOf(".") >= 0 &&
      texto.indexOf(",") >= 0
    ) {

      if (
        texto.lastIndexOf(",") >
        texto.lastIndexOf(".")
      ) {

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

      } else {

        texto =
          texto.replace(
            /,/g,
            ""
          );
      }

    } else if (
      texto.indexOf(",") >= 0
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


    return isNaN(
      numero
    )
      ? 0
      : numero;
  }

};