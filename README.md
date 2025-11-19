# Guía Turística San Martín de la Vega

Esta aplicación es una single-page app en un único archivo `index.html` que ofrece:

- Navegación por categorías (lugares, restaurantes, ocio y historia).
- Búsqueda, filtros y tarjetas expandibles con mapas incrustados.
- Sistema de resenas con autenticación Firebase (Google y Facebook) y moderación de lenguaje.
- Modos de accesibilidad (tercera edad, dislexia y visibilidad reducida con narración y comandos de voz).
- Funcionalidades extra: calendario de eventos, clima en tiempo real, favoritos, descargas GPX y botón de emergencias.

## Puesta en marcha

1. Clona el repositorio y abre el archivo `index.html` en cualquier navegador moderno.
2. Configura las variables globales antes de abrir el archivo o edita el bloque de configuración dentro del script:
   ```html
   <script>
     window.FIREBASE_API_KEY = '...';
     window.FIREBASE_AUTH_DOMAIN = '...';
     window.FIREBASE_PROJECT_ID = '...';
     window.OPENWEATHER_KEY = '...';
     window.GOOGLE_MAPS_API_KEY = '...'; // opcional
   </script>
   ```
3. Asegúrate de tener las colecciones `lugares`, `restaurantes`, `ocio`, `historia`, `eventos` y `resenas` creadas en Firestore con la estructura descrita en el código.

La aplicación funciona en modo offline con datos de respaldo si Firebase no está disponible.

## Flujo de reseñas y moderación automática

- Cada envío guarda la reseña en Firestore con `estado: "pendiente_analisis"`, `moderacionCompletada: false` y metadatos vacíos.
- El cliente ejecuta `analizarContenidoResena`, `analizarImagenesResena` y `moderarResenaConIA` para revisar título, descripción e imágenes antes de publicarla.
- Según el resultado, se actualiza el documento a `estado: "aprobada"`, `"pendiente_revision_humana"` o `"bloqueada"`, junto con `moderacionResultado`, `tieneContenidoSensibile` y `moderacionDetalles`.
- Solo las reseñas con `estado` en `{ "aprobada", "publicada" }` y `moderacionCompletada !== false` se muestran en tarjetas, paneles de lugar o el modal de detalle.
- Las imágenes aprobadas se renderizan en galería con `detalle-resena-galeria` y usan `assets/fallback-review-image.svg` como respaldo si alguna URL falla.
- Al crear una reseña se resuelve el nombre del lugar (`lugarNombre`) a partir del catálogo para que siempre aparezca el sitio correcto vinculado a la experiencia.
