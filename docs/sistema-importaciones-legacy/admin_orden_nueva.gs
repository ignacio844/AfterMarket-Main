<!DOCTYPE html>
<html>
<head>
  <base target="_top">

  <style>
    body {
      font-family: Arial, sans-serif;
      margin: 0;
      background: #f5f7fa;
      color: #202124;
    }

    .cabecera {
      background: #17365d;
      color: white;
      padding: 18px 22px;
      font-size: 20px;
      font-weight: bold;
    }

    .contenido {
      padding: 22px;
    }

    .grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
    }

    .campo {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    label {
      font-size: 12px;
      font-weight: bold;
      color: #5f6368;
    }

    input,
    select,
    textarea {
      border: 1px solid #d7dce2;
      border-radius: 6px;
      padding: 10px;
      font-size: 14px;
    }

    textarea {
      resize: vertical;
      min-height: 90px;
    }

    .ancho-completo {
      grid-column: 1 / -1;
    }

    .acciones {
      margin-top: 22px;
      display: flex;
      justify-content: flex-end;
      gap: 10px;
    }

    button {
      border: 0;
      border-radius: 6px;
      padding: 10px 18px;
      font-weight: bold;
      cursor: pointer;
    }

    .primario {
      background: #1f4e78;
      color: white;
    }

    .secundario {
      background: #d9eaf7;
      color: #17365d;
    }
  </style>
</head>

<body>
  <div class="cabecera">
    Nueva Orden
  </div>

  <div class="contenido">
    <div class="grid">

      <div class="campo">
        <label>Número PI</label>
        <input id="numeroPi">
      </div>

      <div class="campo">
        <label>Proveedor</label>
        <input id="proveedor">
      </div>

      <div class="campo">
        <label>Marca</label>
        <input id="marca">
      </div>

      <div class="campo">
        <label>Estado</label>
        <select id="estado">
          <option value="">Seleccionar</option>
          <option value="A EMBARCAR">A EMBARCAR</option>
          <option value="EMBARCADO">EMBARCADO</option>
          <option value="EN FABRICA">EN FÁBRICA</option>
          <option value="CERRADO">CERRADO</option>
        </select>
      </div>

      <div class="campo">
        <label>Fecha</label>
        <input id="fecha" type="date">
      </div>

      <div class="campo">
        <label>Importe</label>
        <input id="importe" type="number" step="0.01">
      </div>

      <div class="campo ancho-completo">
        <label>Observaciones</label>
        <textarea id="observaciones"></textarea>
      </div>

    </div>

    <div class="acciones">
      <button
        class="secundario"
        onclick="google.script.host.close()"
      >
        Cancelar
      </button>

      <button
        class="primario"
        onclick="guardar()"
      >
        Guardar
      </button>
    </div>
  </div>

  <script>
    function guardar() {
      const orden = {
        numeroPi:
          document
            .getElementById('numeroPi')
            .value.trim(),

        proveedor:
          document
            .getElementById('proveedor')
            .value.trim(),

        marca:
          document
            .getElementById('marca')
            .value.trim(),

        estado:
          document
            .getElementById('estado')
            .value,

        fecha:
          document
            .getElementById('fecha')
            .value,

        importe:
          document
            .getElementById('importe')
            .value,

        observaciones:
          document
            .getElementById('observaciones')
            .value.trim()
      };

      google.script.run
        .withSuccessHandler(
          function() {
            google.script.host.close();
          }
        )
        .withFailureHandler(
          function(error) {
            alert(
              error && error.message
                ? error.message
                : String(error)
            );
          }
        )
        .aoGuardarOrden(orden);
    }
  </script>
</body>
</html>