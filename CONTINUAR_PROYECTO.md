# Continuidad del Portal Grupo Aftermarket

Este documento contiene el contexto necesario para continuar el desarrollo en un nuevo chat sin reconstruir toda la conversación anterior.

## Ubicación del proyecto

```text
C:\Users\Auditoria\Documents\Codex\2026-09-01\pod\work\portal-grupo-aftermarket
```

Trabajar siempre desde esta carpeta y preservar los cambios existentes.

## Contexto del proyecto

Se está desarrollando un portal interno empresarial para **Grupo Aftermarket**. Su objetivo es centralizar accesos a documentación, herramientas y desarrollos internos de las distintas áreas de la compañía.

El portal debe ser una página de uso cotidiano, moderna, profesional, clara y rápida. No debe sentirse como un catálogo saturado de tarjetas ni como una réplica del Google Sites anterior. El Google Sites se utilizó únicamente como referencia para recuperar enlaces y comprender la estructura de información.

### Stack definido

- Next.js con React y TypeScript.
- Tailwind CSS.
- Node.js.
- Supabase como base de datos.
- Google OAuth configurado desde Google Cloud mediante Auth.js.
- Despliegue final previsto en Vercel.

## Forma de trabajo solicitada

El desarrollo debe realizarse **paso a paso y por etapas**.

- No adelantarse a secciones o funcionalidades que Ignacio todavía no haya indicado.
- Antes de una decisión visual relevante, conversar brevemente la propuesta cuando existan alternativas reales.
- Implementar una etapa concreta, observarla, corregirla y recién después avanzar.
- Priorizar análisis de interfaz y funcionamiento visible.
- No ejecutar compilaciones completas, builds, lint o suites de pruebas de manera repetitiva.
- Realizar sólo la comprobación técnica mínima necesaria para detectar errores reales de la etapa trabajada.
- No convertir cada pequeño cambio en un proceso pesado de validaciones.
- Mantener un ciclo de trabajo ligero: **hacer → observar → corregir → continuar**.
- No agregar funcionalidades especulativas.
- No modificar contenido o páginas fuera del alcance de la etapa actual.
- Preservar siempre los cambios existentes y no reemplazar decisiones visuales aprobadas.
- Evitar explicaciones excesivamente técnicas; comunicar resultados, decisiones y bloqueos de forma directa.

## Preferencias de Ignacio

- Prefiere una estética empresarial moderna, limpia y profesional.
- La identidad visual utiliza azul oscuro, azul distintivo, fondos claros y bordes suaves.
- Prefiere composiciones amplias pero compactas verticalmente.
- No quiere abusar de tarjetas ni llenar la interfaz con componentes repetidos.
- Prefiere navegación clara y accesos prácticos antes que contenido decorativo.
- Las animaciones deben ser sutiles, fluidas y funcionales.
- No desea una sección de “últimos accesos” porque el portal no tendrá suficientes opciones para justificarla.
- Las páginas de áreas deben estar desarrolladas gradualmente y habilitarse de a una.
- Ante acciones administrativas, prefiere publicación inmediata al guardar.
- No necesita historial de cambios para los recursos WMS.
- Para retirar módulos o enlaces se utiliza ocultamiento/desactivación, evitando borrados definitivos.

## Navegación general

La navegación superior abre páginas independientes; no lleva a secciones internas de la página principal.

Orden actual:

1. Inicio
2. IT
3. WMS
4. Auditoría
5. Ventas
6. Compras
7. COMEX
8. Capital Humano

La barra posee una píldora animada que se desliza hacia la opción seleccionada y ajusta su ancho.

## Página de inicio

La página principal incluye:

- Recepción personalizada del usuario.
- Horario en tiempo real sin segundos.
- Tarjetas de áreas seleccionables u ocultables.
- Preferencias de accesos conservadas entre recargas.

La personalización actual utiliza almacenamiento local. En una etapa futura puede migrarse a persistencia por usuario si Ignacio lo solicita.

No incluir en Inicio:

- Catálogo.
- Facturador.
- Procesos.
- Tareas.
- Presentaciones.
- Chat.
- Calendario.
- Últimos accesos.

## Página de IT

Contiene tarjetas de acceso para las siguientes aplicaciones:

- Facturador: https://facturador-aftermarket.vercel.app/
- Mapa Comercial: https://mapa-comercial-aftermarket.vercel.app/
- Auditoría: https://auditoria-pro-nachin1.vercel.app/
- Códigos Máster: https://codigosmasteraftermarket.vercel.app/
- Project Tracker: https://after-market-project-tracker.vercel.app/

Las tarjetas utilizan íconos azules y una animación de brillo horizontal al pasar el cursor.

## Página de WMS

Ruta:

```text
/areas/wms
```

La cabecera contiene:

- Tarjeta azul de implementación WMS.
- Cuenta regresiva en días hasta el 2 de noviembre de 2026.
- Acceso visual al sistema WMS:
  https://wms.grupo-aftermarket.com:4446/SGLWMS_DISTRIMAR_PROD/hinicio.aspx

### Explorador de recursos

La documentación WMS se presenta mediante una barra exploradora lateral y un panel de contenido a la derecha.

Módulos iniciales:

1. Plan de capacitación.
2. Funcionalidades.
3. Lanzamiento.
4. Operaciones logísticas.
5. Proyecto SGL.
6. Manuales de usuario.
7. Otros documentos.

Cada encabezado de módulo usa un fondo celeste personalizado, ícono vectorial relacionado y detalles gráficos suaves. Los botones laterales utilizan una animación ripple.

### Administración WMS

El explorador posee un botón **Administrar recursos**, visible sólo para editores autorizados.

Permite:

- Crear módulos.
- Modificar nombre, descripción e ícono de módulos.
- Ocultar módulos.
- Crear accesos.
- Modificar nombre, URL y tipo de los accesos.
- Definir un acceso principal.
- Ocultar accesos.
- Publicar cada cambio inmediatamente al guardar.

No existe historial de cambios y no se realizan eliminaciones físicas desde la interfaz.

Editores autorizados, comparados sin distinguir mayúsculas:

- ignacio@grupo-aftermarket.com
- etelias@grupo-aftermarket.com
- jpajon@grupo-aftermarket.com

## Autenticación

Google OAuth ya está integrado y probado correctamente.

- El portal completo requiere iniciar sesión.
- Actualmente el acceso general admite cuentas del dominio `@grupo-aftermarket.com`.
- La edición WMS se limita a los tres correos indicados anteriormente.
- Más adelante debe definirse la lista fija completa de usuarios generales si Ignacio decide abandonar la autorización por dominio.
- La pantalla de acceso mantiene la identidad visual del portal.

Google Cloud debe conservar estas URL para desarrollo:

```text
Origen autorizado: http://localhost:3000
URI de redirección: http://localhost:3000/api/auth/callback/google
```

## Supabase

Supabase ya está conectado y probado.

Se creó y ejecutó la migración:

```text
supabase/migrations/001_portal_aftermarket_wms.sql
```

La información del portal vive en el esquema independiente:

```text
portal_aftermarket
```

Este esquema fue agregado a los **Exposed schemas** de la Data API sin quitar los esquemas existentes.

Tablas creadas:

- `portal_aftermarket.wms_modules`
- `portal_aftermarket.wms_resources`

La migración fue diseñada para no sobrescribir información existente del proyecto Supabase:

- No utiliza `DROP`, `TRUNCATE`, `DELETE` ni actualizaciones sobre tablas ajenas.
- Utiliza `CREATE IF NOT EXISTS`.
- Los datos iniciales utilizan `ON CONFLICT DO NOTHING`.
- El navegador no recibe permisos directos de escritura.
- Las operaciones pasan por rutas del servidor y verifican primero la sesión y el correo editor.

## Variables de entorno

El archivo local se encuentra en:

```text
.env.local
```

Las credenciales ya fueron completadas. Nunca mostrar, copiar al chat ni incorporar sus valores al repositorio.

Variables relevantes:

```text
AUTH_SECRET
AUTH_GOOGLE_ID
AUTH_GOOGLE_SECRET
AUTH_TRUST_HOST
SUPABASE_URL
SUPABASE_SECRET_KEY
PORTAL_ALLOWED_DOMAIN
PORTAL_ALLOWED_EMAILS
PORTAL_EDITOR_EMAILS
```

`.env.local` está ignorado por Git. `.env.example` contiene únicamente la estructura y valores públicos o vacíos.

## Estado comprobado

- Inicio de sesión con Google funcionando.
- Restricción del portal antes del inicio de sesión funcionando.
- Sesión de Ignacio reconocida correctamente.
- Lectura de módulos y enlaces desde Supabase funcionando.
- Botón administrativo visible para Ignacio.
- Modo de edición renderizado correctamente.
- Guardado real contra Supabase confirmado.
- La prueba de guardado no cambió contenido visible; sólo volvió a guardar el módulo con sus valores existentes.
- TypeScript fue comprobado sin errores después de integrar autenticación y administración.

## Archivos principales

```text
src/auth.ts
src/app/layout.tsx
src/app/page.tsx
src/app/it/page.tsx
src/app/areas/wms/page.tsx
src/app/api/auth/[...nextauth]/route.ts
src/app/api/wms/admin/route.ts
src/components/access-gate.tsx
src/components/site-header.tsx
src/components/wms-hero.tsx
src/components/wms-resource-explorer.tsx
src/lib/portal-auth.ts
src/lib/supabase-admin.ts
src/lib/wms-data.ts
src/lib/wms-seed.ts
src/lib/wms-types.ts
supabase/migrations/001_portal_aftermarket_wms.sql
```

## Consideraciones para continuar

- Leer este documento antes de editar el proyecto.
- Revisar el estado actual de la interfaz antes de proponer un rediseño.
- No reconstruir componentes que ya están aprobados.
- No mover secretos al cliente ni utilizar variables `NEXT_PUBLIC_` para claves privadas.
- Toda autorización administrativa debe comprobarse nuevamente en el servidor; ocultar un botón no es una medida de seguridad suficiente.
- Mantener Supabase como fuente de verdad para los recursos WMS.
- Conservar los datos semilla únicamente como respaldo de visualización si la conexión no está disponible.
- No probar guardados creando registros basura. Para una comprobación técnica, reutilizar datos existentes sin modificar su contenido y explicar la acción.
- Antes de ocultar un módulo o acceso real, solicitar confirmación dentro de la interfaz.
- No desplegar todavía en Vercel salvo indicación explícita de Ignacio.

## Próximas decisiones posibles

No ejecutar todas estas tareas automáticamente. Elegir sólo la siguiente que Ignacio indique.

- Revisar y ajustar visualmente el modo de administración WMS.
- Incorporar ordenamiento manual de módulos y accesos si resulta necesario.
- Definir la lista fija completa de usuarios con acceso general.
- Trabajar en otra página de área.
- Revisar la adaptación móvil.
- Preparar variables y configuración de producción en Vercel.
- Realizar el despliegue final cuando el portal esté aprobado.

## Mensaje sugerido para iniciar el próximo chat

```text
Continuemos con el Portal Grupo Aftermarket ubicado en:
C:\Users\Auditoria\Documents\Codex\2026-09-01\pod\work\portal-grupo-aftermarket

Lee primero CONTINUAR_PROYECTO.md y respeta su forma de trabajo. No avances a una etapa nueva hasta que te indique cuál sigue.
```
