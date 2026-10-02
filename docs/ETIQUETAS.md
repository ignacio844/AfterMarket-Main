# Biblioteca de Etiquetas

La vista `/etiquetas` reúne los archivos base de etiquetas. Todos los usuarios autorizados del portal pueden consultar y descargar los mismos archivos. La carga utiliza la lista de administradores existente de `src/lib/portal-auth.ts`, comprobada nuevamente en el servidor.

## Habilitación

Aplicar `supabase/migrations/011_etiquetas.sql` en el proyecto Supabase del portal. Crea las tablas `portal_aftermarket.etiquetas_files` y `portal_aftermarket.etiquetas_folders`, las funciones de validación/retiro de carpetas y el bucket privado `portal-etiquetas`. No incorpora plantillas inventadas ni modifica recursos de otras áreas.

La migración se entrega preparada; no se aplica automáticamente a servicios de producción. Hasta habilitar la tabla y el bucket, la vista informa que la biblioteca no está disponible y desactiva la publicación. Se utilizan las variables privadas de Supabase ya existentes.

## Archivos

- Un administrador selecciona un archivo, asigna un nombre y opcionalmente una descripción. Se publica al guardar, sin etapa de aprobación adicional.
- Los administradores pueden crear carpetas, modificar su nombre y descripción, y asignar o mover archivos entre carpetas. Los usuarios ven las mismas carpetas compartidas, con filtros por carpeta, todos los archivos o archivos sin carpeta.
- La acción **Modificar** permite editar nombre, descripción y carpeta de un acceso, y opcionalmente reemplazar su archivo. El reemplazo conserva el identificador del acceso y guarda un objeto nuevo; no sobrescribe los bytes del archivo anterior.
- La acción **Eliminar acceso** requiere confirmación en la interfaz y retira el recurso de la biblioteca con `is_active = false`. La ruta de descarga también deja de entregarlo. No se borran físicamente los objetos almacenados.
- Una carpeta sólo puede retirarse cuando no contiene accesos activos. El servidor comprueba esa condición de forma atómica. Se pueden reutilizar nombres de carpetas retiradas.
- Se admite cualquier extensión hasta 4 MiB por archivo. El límite mantiene la carga multipart por debajo del límite del hosting previsto. Los archivos se guardan sin modificar sus bytes.
- Los `.json` se validan sintácticamente en cliente y servidor, sin imponer el esquema de una herramienta de etiquetas que todavía no fue definida.
- Se ofrece vista previa de JSON, texto (`txt`, `csv`, `tsv`, `md`, `xml`, `zpl`) e imágenes (`png`, `jpg`, `jpeg`, `gif`, `webp`, `avif`). PDF y los demás formatos se descargan para abrirlos con su aplicación.
- El acceso a los objetos pasa por una ruta autenticada. El navegador no recibe claves de Supabase ni URLs públicas permanentes. HTML y SVG se entregan como descargas binarias.
- Los archivos con el mismo nombre se conservan como publicaciones independientes; no se sobrescribe un archivo anterior.
- La biblioteca se actualiza al volver a la pestaña y cada 30 segundos mientras está visible.

## Validación local

`node --test tests/etiquetas.test.mjs` comprueba autorización de las rutas, validación JSON y de tamaño, publicación con persistencia simulada, reversión de cargas fallidas, cabeceras de descarga, carpetas, edición, reemplazos y bajas lógicas. No escribe en Supabase.
