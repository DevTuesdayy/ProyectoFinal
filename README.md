# CañaData-IA

Aplicación web responsive para consultar y analizar datos históricos de producción de caña de azúcar en México.

## Ejecutar

Abre el proyecto con un servidor local para que funcionen las peticiones AJAX y la carga de CSV:

```bash
python3 -m http.server 5500
```

Después visita `http://localhost:5500`.

## Ollama

La pantalla de IA intenta usar la API local de Ollama en `http://localhost:11434/api/generate`. Para prepararla:

```bash
ollama serve
ollama pull llama3.2:3b
```

Si tu instalación usa otro nombre de modelo, cambia `model` en `app.js`. La aplicación muestra un mensaje de diagnóstico si Ollama no está disponible.

## CSV

El botón “Cargar CSV” acepta columnas que contengan estos nombres: `zafra`, `estado`, `ingenio`, `superficie`, `produccion` y `rendimiento`. El archivo de demostración está en `data/zafras-demo.csv`.
