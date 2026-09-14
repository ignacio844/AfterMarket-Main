function listarSolapasSII() {
  const ss = SpreadsheetApp.getActive();

  const nombres = ss
    .getSheets()
    .map(sh => sh.getName());

  Logger.log(
    JSON.stringify(
      nombres,
      null,
      2
    )
  );

  SpreadsheetApp
    .getUi()
    .alert(
      'Solapas encontradas',
      nombres.join('\n'),
      SpreadsheetApp.getUi().ButtonSet.OK
    );
}
