# Esquema propuesto para Firebase Firestore

Este documento describe las colecciones y la estructura de documentos sugeridas para la guía turística de San Martín de la Vega. Los campos `Timestamp` se deben establecer desde el SDK/Admin de Firebase usando `serverTimestamp()` o valores de fecha válidos.

## 1. Colección `lugares`

- **Total recomendado:** 30 documentos
- **Campos obligatorios por documento:**

```json
{
  "id": "parque-warner",
  "nombre": "Parque Warner Madrid",
  "descripcion": "Atracciones tematizadas y espectáculos...",
  "imagen": "https://mrdaniel7.github.io/Guia-turistica-San-Martin-de-la-Vega/images/lugares/parque-warner-1.jpg",
  "galeria": [
    "https://mrdaniel7.github.io/Guia-turistica-San-Martin-de-la-Vega/images/lugares/parque-warner-1.jpg",
    "https://mrdaniel7.github.io/Guia-turistica-San-Martin-de-la-Vega/images/lugares/parque-warner-2.jpg"
  ],
  "etiquetas": ["familia", "aventura"],
  "direccion": "Carretera M-506, salida Parque Warner",
  "coordenadas": [40.23432, -3.58723],
  "enlace": "https://www.parquewarner.com",
  "horario": "10:00-20:00",
  "precio": "30-50€",
  "contacto": "+34 912 345 678",
  "creado": "<Timestamp>",
  "actualizado": "<Timestamp>"
}
```

- **Etiquetas disponibles:** `naturaleza`, `cultural`, `familia`, `aventura`, `agua`, `historia`

## 2. Colección `restaurantes`

- **Total recomendado:** 10 documentos
- **Campos obligatorios por documento:**

```json
{
  "id": "el-lindero",
  "nombre": "Mesón El Lindero",
  "descripcion": "Cocina tradicional con horno de leña...",
  "imagen": "https://mrdaniel7.github.io/Guia-turistica-San-Martin-de-la-Vega/images/restaurantes/el-lindero-1.jpg",
  "galeria": [
    "https://mrdaniel7.github.io/Guia-turistica-San-Martin-de-la-Vega/images/restaurantes/el-lindero-1.jpg",
    "https://mrdaniel7.github.io/Guia-turistica-San-Martin-de-la-Vega/images/restaurantes/el-lindero-2.jpg"
  ],
  "etiquetas": ["tradicional", "asador", "terraza", "km0"],
  "tipo": "asador",
  "especialidad": "Cordero asado",
  "direccion": "Calle Mayor, 24",
  "coordenadas": [40.20596, -3.56824],
  "enlace": "https://restaurantesanmartindelavega.es/lindero",
  "horario": {
    "lunes": "cerrado",
    "martes-viernes": "13:00-16:00, 20:00-23:00",
    "sabado-domingo": "13:00-23:00"
  },
  "precioMedio": "25-35€",
  "menuDia": "12€",
  "contacto": "+34 918 123 456",
  "reservas": true,
  "terraza": true,
  "creado": "<Timestamp>",
  "actualizado": "<Timestamp>"
}
```

- **Etiquetas disponibles:** `tradicional`, `tapas`, `asador`, `terraza`, `veg-friendly`, `sin-gluten`, `km0`

## 3. Colección `ocio`

- **Estructura idéntica a `lugares`**
- **Ejemplo:**

```json
{
  "id": "karting-jarama",
  "nombre": "Karting Circuito del Jarama",
  "descripcion": "Trazado homologado...",
  "imagen": "https://mrdaniel7.github.io/Guia-turistica-San-Martin-de-la-Vega/images/ocio/karting-jarama-1.jpg",
  "galeria": [
    "https://mrdaniel7.github.io/Guia-turistica-San-Martin-de-la-Vega/images/ocio/karting-jarama-1.jpg",
    "https://mrdaniel7.github.io/Guia-turistica-San-Martin-de-la-Vega/images/ocio/karting-jarama-2.jpg"
  ],
  "etiquetas": ["aventura", "deportes"],
  "direccion": "Camino del Río Jarama",
  "coordenadas": [40.2124, -3.5733],
  "enlace": "https://turismo.sanmartindelavega.es/karting",
  "creado": "<Timestamp>",
  "actualizado": "<Timestamp>"
}
```

- **Etiquetas disponibles:** `aventura`, `agua`, `deportes`, `naturaleza`, `cultural`

## 4. Colección `historia`

```json
{
  "id": "hist-1574",
  "anio": 1574,
  "titulo": "Otorgamiento del título de villa",
  "descripcion": "Felipe II concede a San Martín de la Vega...",
  "creado": "<Timestamp>"
}
```

## 5. Colección `eventos`

```json
{
  "id": "romeria",
  "titulo": "Romería de la Virgen",
  "descripcion": "Procesión hasta la ermita con actuaciones folclóricas.",
  "fecha": "<Timestamp>",
  "tipo": "fiestalocal",
  "enlace": "https://turismo.sanmartindelavega.es/romeria",
  "creado": "<Timestamp>"
}
```

## 6. Colección `resenas`

```json
{
  "id": "resena-abc123",
  "itemId": "parque-warner",
  "tipoSeccion": "lugares",
  "titulo": "Visita obligada",
  "texto": "La iglesia mudéjar es preciosa...",
  "rating": 5,
  "imagenes": [],
  "usuario": "uid-del-usuario",
  "autor": "María G.",
  "usuarioFoto": null,
  "fechaVisita": "<Timestamp>",
  "creado": "<Timestamp>",
  "ipPublica": "192.168.1.10",
  "userAgent": "Mozilla/5.0...",
  "geolocalizacion": {
    "lat": 40.20732,
    "lng": -3.57013
  },
  "estado": "publicada",
  "reportes": 0,
  "motivoBaneo": null,
  "moderadoPor": null,
  "likes": 0,
  "util": 0
}
```

## 7. Colección `usuarios_baneados`

```json
{
  "id": "ban-abc123",
  "ipPublica": "192.168.1.10",
  "usuarioId": "uid-usuario",
  "motivo": "Contenido inapropiado repetido",
  "fechaBaneo": "<Timestamp>",
  "baneadoPor": "uid-admin",
  "permanente": true,
  "fechaExpiracion": null,
  "intentosAcceso": 0
}
```

## 8. Colección `configuracion`

```json
{
  "id": "global",
  "gpx": "https://turismo.sanmartindelavega.es/rutas/ruta-humedales.gpx",
  "mapa": {
    "q": [40.20732, -3.57013]
  },
  "proxyIp": null,
  "actualizado": "<Timestamp>"
}
```

> **Nota:** Sustituye `"<Timestamp>"` por el tipo `Timestamp` de Firebase al momento de crear o actualizar documentos. Ajusta descripciones, enlaces, precios y coordenadas según la información oficial del municipio.
