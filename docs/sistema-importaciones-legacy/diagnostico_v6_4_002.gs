function probarCompilacionV64002() {
  Logger.log('COMPILACION_OK_V6.4.002');
}

function probarPlanComprasV64002() {
  const parametros = cargarParametrosCompras_();
  Logger.log(JSON.stringify({
    generales: parametros.generales,
    marcas: [...parametros.coberturaPorMarca.entries()]
  }, null, 2));
}
