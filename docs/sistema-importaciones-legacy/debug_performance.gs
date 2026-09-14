function perfInicio(nombre){
  return {
    nombre: nombre,
    t: new Date().getTime()
  };
}

function perfFin(p){
  Logger.log(
    '%s : %s ms',
    p.nombre,
    new Date().getTime()-p.t
  );
}
