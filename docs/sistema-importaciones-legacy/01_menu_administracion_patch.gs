/**********************************************************************
 * SII - INTEGRACIÓN DE MENÚ
 * Sprint A.1
 *
 * IMPORTANTE:
 * No crear un segundo onOpen().
 *
 * Dentro del onOpen() actual, antes de finalizar la función,
 * agregar:
 *
 *   agregarMenuAdministracionSII_(ui);
 **********************************************************************/


function agregarMenuAdministracionSII_(ui) {
  ui.createMenu('Administración')
    .addItem(
      'Órdenes de compra',
      'abrirAdministracionOrdenes'
    )
    .addItem(
      'Stock',
      'abrirAdministracionStock'
    )
    .addItem(
      'Ventas',
      'abrirAdministracionVentas'
    )
    .addToUi();
}



function aoModuloNoDisponible_() {
  SpreadsheetApp
    .getActive()
    .toast(
      'Este módulo se habilitará en un próximo sprint.',
      'Administración',
      5
    );
}


/*
 * EJEMPLO:
 *
 * function onOpen() {
 *   const ui = SpreadsheetApp.getUi();
 *
 *   // Menús actuales...
 *
 *   agregarMenuAdministracionSII_(ui);
 * }
 */
