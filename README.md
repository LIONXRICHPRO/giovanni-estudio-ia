# Giovanni Estudio IA · NODOTO

Aplicación independiente para completar durante la videollamada la guía del Dr. Giovanni Soto. El PDF se convirtió en HTML, CSS y JavaScript con los colores, logotipo y tipografía oficiales de NODOTO. Incluye las siete secciones, 35 campos, guardado automático y manual, recuperación de sesión, checklist y exportación de respuestas. El PDF original continúa disponible para descargar.

## Infraestructura propia

- Repositorio: https://github.com/LIONXRICHPRO/giovanni-estudio-ia
- Sitio: https://lionxrichpro.github.io/giovanni-estudio-ia/
- Proyecto Supabase: **Giovanni Estudio IA**, referencia `yyzbfpjpsmvggkgnmwob`.
- Organización: `usandresleonus@gmail.com`, cuenta NODOTO 2.
- Base Postgres propia en `us-east-1`. No depende de otra aplicación.

El repositorio contiene código y recursos públicos. Las respuestas se almacenan exclusivamente en la base independiente de Supabase; nunca se escriben en GitHub.

## Desarrollo y publicación

Requiere Node 20+ y Python 3 para servir localmente. No hay dependencias npm.

```bash
npm test
npm run build
npm start
```

Abrir http://localhost:4174. `npm run build` prepara `docs/` con `.nojekyll`. GitHub Pages publica la carpeta `/docs` de `main`; cada actualización de esa carpeta dispara un nuevo despliegue. Los imports y recursos son relativos para funcionar bajo la ruta del repositorio.

## Guardado real

`src/config.js` identifica exclusivamente el proyecto nuevo y contiene su clave **publicable**. No contiene contraseñas, claves administrativas ni `service_role`. La migración inicial está en `supabase/migrations/20261030190000_initial_schema.sql`.

La tabla `giovanni_fase1_sessions` tiene RLS y deniega lectura/escritura directa a los roles públicos. Las funciones RPC validan un token de sesión aleatorio de 256 bits; solo su hash SHA-256 queda guardado en la base. El token permanece en el fragmento del enlace y en el navegador. Quien posea el enlace puede consultar y editar esa sesión: compartirlo solo con sus participantes.

Al reabrir la aplicación en el mismo navegador se recupera la última sesión. Para otro dispositivo use **Copiar enlace**. Cada guardado comprueba la revisión para impedir sobrescrituras desde una pestaña antigua. Si falla la conexión queda una copia local pendiente de sincronizar; el estado solo dice **Guardado en línea** tras confirmar la escritura en Supabase. Las respuestas también se exportan como texto.

## Alcance

La aplicación recoge criterios para configurar el asistente de guiones. No entrena por sí misma un modelo ni publica contenido médico. Los materiales se comparten por enlaces o texto; no incluye subida de archivos. La elección de voz no constituye una autorización para clonación. No ingresar datos que identifiquen pacientes ni contraseñas.
