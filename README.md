# CañaData-IA

Aplicación web, adaptable a dispositivos móviles, para consultar y analizar la producción histórica de caña de azúcar en México y obtener recomendaciones generadas con un modelo de IA local (Llama 3B mediante Ollama).

Proyecto final de Desarrollo de aplicaciones web y móviles (LIDTS 7°A, UNACH).

## Cómo funciona

```
Formulario (HTML/CSS) → jQuery + AJAX (JSON) → backend PHP → API de Ollama → Llama 3B
                      ← jQuery actualiza la vista ← respuesta JSON ←
```

1. El usuario elige ingenio, zafra e indicador y escribe una pregunta.
2. jQuery envía la consulta en JSON a `api/consulta.php`.
3. PHP lee los 11 CSV, filtra los datos y calcula promedios, máximos, mínimos, ranking y tendencia por zafra.
4. PHP envía esos resultados ya calculados a Llama 3B, que solo los explica y formula una recomendación.
5. La respuesta regresa en JSON y jQuery muestra los indicadores, el ranking y la recomendación.

Los cálculos se hacen con código convencional y no con el modelo de lenguaje, como pide la sección 7 del proyecto.

## Requisitos

- **PHP 8.1 o superior** con las extensiones `curl`, `intl` y `mbstring` (vienen incluidas en el PHP de Homebrew).
- **Ollama** con el modelo `llama3.2:3b` (unos 2 GB de descarga).
- Un navegador web moderno.

En macOS con Homebrew:

```bash
brew install php ollama
```

## Instalación

Descarga el modelo una sola vez. Ollama lo guarda en `~/.ollama/models`, fuera del proyecto:

```bash
ollama serve
```

En otra terminal:

```bash
ollama pull llama3.2:3b
```

## Ejecución

Se necesitan dos terminales abiertas al mismo tiempo.

**Terminal 1: Ollama.** Si responde `address already in use`, Ollama ya está corriendo y puedes seguir.

```bash
ollama serve
```

**Terminal 2: servidor PHP**, desde la carpeta del proyecto:

```bash
php -S localhost:8000
```

Abre http://localhost:8000 en el navegador.

> No uses `python3 -m http.server` ni abras `index.html` con doble clic: esos métodos no ejecutan PHP y la aplicación no podrá cargar los datos.

La primera consulta tarda más porque Ollama carga el modelo en memoria; en las pruebas, cada respuesta tardó entre 3 y 10 segundos.

Para comprobar que Ollama está listo:

```bash
curl http://localhost:11434/api/tags
```

Debe responder un JSON que mencione `llama3.2:3b`.

## Estructura del proyecto

```
ProyectoFinal/
├── index.html           Interfaz: formulario de consulta y resultados
├── styles.css           Estilos y diseño adaptable
├── app.js               jQuery: carga catálogos, envía la consulta y pinta resultados
├── api/
│   ├── datos.php        Lee y unifica los 11 CSV
│   ├── indicadores.php  Filtros, promedios, ranking y tendencia
│   ├── ollama.php       Arma el prompt y consulta a Llama 3B
│   ├── catalogos.php    GET: lista de ingenios, zafras e indicadores
│   └── consulta.php     POST: valida la consulta y responde análisis + recomendación
└── data/
    └── cana_2015_2016.csv … cana_2025_2026.csv
```

## Datos

Fuente: [Avance de la producción de caña y azúcar (Infocaña)](https://www.datos.gob.mx/dataset/avance_produccion_cana_azucar_infocana), publicado por CONADESUCA en datos.gob.mx. Se usan 11 archivos CSV, de la zafra 2015-2016 a la 2025-2026.

Al leerlos, `api/datos.php` resuelve estas diferencias entre archivos:

- **Columnas:** la zafra 2025-2026 usa otros nombres de columna (`no_s_zafra`, `azucar_producida_total`…); se traducen al formato de las otras zafras.
- **Nombres de ingenio:** los 106 nombres distintos (mayúsculas, acentos, cambios de nombre) se agrupan en 52 ingenios.
- **Valores acumulados:** cada CSV trae avances semanales acumulados, así que por ingenio y zafra se toma la última semana reportada.
- **Rendimientos:** se calculan con la misma fórmula en todas las zafras porque 2015-2016 y 2016-2017 no los incluyen:
  - rendimiento de campo = caña molida bruta ÷ superficie cosechada (t/ha);
  - rendimiento de fábrica = azúcar total ÷ caña molida bruta × 100 (%);
  - rendimiento agroindustrial = azúcar total ÷ superficie cosechada (t azúcar/ha).
- **Datos no reportados:** en eficiencia en fábrica y caña molida neta, un 0 se trata como dato faltante.

La zafra 2025-2026 sigue en curso (datos hasta la semana 14), por lo que sus cifras son preliminares y no se comparan con zafras completas.

## API

### `GET api/catalogos.php`

Devuelve las opciones de los selectores:

```json
{ "ingenios": ["Aarón Sáenz Garza", "..."], "zafras": ["2015-2016", "..."], "indicadores": { "rendimiento_campo": { "nombre": "Rendimiento de campo", "unidad": "t/ha" } } }
```

### `POST api/consulta.php`

Cuerpo en JSON (`"Todos"` significa sin filtro):

```json
{ "ingenio": "Todos", "zafra": "2025-2026", "indicador": "rendimiento_campo", "pregunta": "¿Qué ingenios tuvieron el mejor rendimiento de campo?" }
```

Ejemplo desde la terminal:

```bash
curl -X POST http://localhost:8000/api/consulta.php -d '{"ingenio":"Todos","zafra":"2025-2026","indicador":"rendimiento_campo","pregunta":"¿Qué ingenios tuvieron el mejor rendimiento de campo?"}'
```

| Código | Significado |
|---|---|
| 200 | `analisis` (indicadores calculados) y `recomendacion` (texto de Llama 3B) |
| 400 | El cuerpo no es JSON |
| 404 | No hay datos para esa combinación de ingenio, zafra e indicador |
| 405 | Se usó un método distinto de POST |
| 422 | Ingenio, zafra, indicador o pregunta no válidos |
| 503 | Ollama no está disponible; se devuelve `analisis` sin recomendación |

## Configuración

Los valores principales están como constantes al inicio de `api/ollama.php`:

| Constante | Valor | Uso |
|---|---|---|
| `OLLAMA_URL` | `http://localhost:11434/api/generate` | Dirección de la API de Ollama |
| `OLLAMA_MODEL` | `llama3.2:3b` | Modelo que se consulta |
| `OLLAMA_TEMPERATURE` | `0.2` | Valores bajos hacen que el modelo se apegue a los datos |
| `OLLAMA_TIMEOUT_SECONDS` | `120` | Tiempo máximo de espera de la respuesta |

## Limitaciones conocidas

- Llama 3B es un modelo pequeño: a veces excede el límite de 150 palabras o escribe mal algún nombre. Las cifras siempre provienen de los cálculos de PHP.
- Cada consulta analiza un indicador a la vez.
- En los tipos de azúcar (refinada, mascabado…), pocos ingenios producen cada tipo, así que la diferencia contra el promedio nacional puede ser muy grande.
