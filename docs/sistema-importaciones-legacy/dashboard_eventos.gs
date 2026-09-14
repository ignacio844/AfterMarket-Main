const DashboardEventos = {

  reservarEspacio(sh){

    sh.getRange("N4:R4")
      .merge()
      .setValue("EVENTOS")
      .setBackground("#1F4E78")
      .setFontColor("white")
      .setFontWeight("bold")
      .setHorizontalAlignment("center");

    sh.getRange("N5:R15")
      .setBorder(
        true,true,true,true,true,true
      );

  }

};
