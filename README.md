# Giovanni Estudio IA · NODOTO

Aplicación independiente para completar durante la videollamada la guía del Dr. Giovanni Soto. El PDF se convirtió en HTML, CSS y JavaScript con los colores, logotipo y tipografía oficiales de NODOTO. Incluye ocho secciones, propuestas de temas, acceso personal, guardado automático y manual, recuperación de sesión, checklist y exportación de respuestas. El PDF original continúa disponible para descargar.

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

## Acceso y guardado

El doctor ingresa con su usuario personal. La validación utiliza Supabase Auth; la contraseña no está en el repositorio ni en el frontend. El registro público y los usuarios anónimos están desactivados. Las credenciales se entregan al propietario por un canal privado.

`src/config.js` solo contiene la URL del proyecto y una clave publicable. Las respuestas se guardan en `giovanni_workspaces`, vinculadas al usuario autenticado, y las propuestas en `giovanni_topic_proposals`. RLS limita todas las operaciones al propietario de cada fila. Las funciones antiguas por enlaces de sesión ya no aceptan acceso público. El enlace de la aplicación no concede acceso a respuestas.

Se puede volver a entrar desde otro dispositivo con las mismas credenciales. El guardado automático conserva una copia local cuando hay cortes de conexión y evita sobrescribir revisiones más recientes. La sección **Temas propuestos** permite agregar, editar y retirar propuestas, con su enfoque y prioridad, para que NODOTO prepare el contenido. La exportación incluye respuestas y temas.

La aplicación tiene ocho secciones. En redes se solicitan únicamente Instagram, TikTok y YouTube. Antes de entregar la versión se retiran de la base los registros de prueba; se conserva únicamente la cuenta del doctor, lista para empezar.

## Alcance

La aplicación recoge criterios para configurar el asistente de guiones. No entrena por sí misma un modelo ni publica contenido médico. Los materiales se comparten por enlaces o texto; no incluye subida de archivos. La elección de voz no constituye una autorización para clonación. No ingresar datos que identifiquen pacientes ni contraseñas.
