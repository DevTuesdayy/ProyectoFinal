<?php

require_once __DIR__ . '/indicadores.php';

const OLLAMA_URL = 'http://localhost:11434/api/generate';
const OLLAMA_MODEL = 'llama3.2:3b';
const OLLAMA_TIMEOUT_SECONDS = 120;

const OLLAMA_TEMPERATURE = 0.2;

const SYSTEM_PROMPT = <<<'TEXT'
    Eres un analista agroindustrial experto en la producción de caña de azúcar en México.
    Responde siempre en español, en un máximo de 150 palabras.
    Usa ÚNICAMENTE los datos calculados que se te proporcionan; no inventes cifras ni ingenios.
    No hagas cálculos propios: cita solo las cifras y porcentajes que aparecen en los datos.
    Las zafras marcadas como "datos parciales" no son comparables con zafras completas; si las mencionas, aclara que son preliminares.
    Si los datos no alcanzan para responder, dilo claramente.
    Estructura tu respuesta en dos partes:
    1. Análisis: explica los resultados citando las cifras con sus unidades.
    2. Recomendación: una acción concreta basada en esos resultados.
    TEXT;

function formatPercent(float $percent): string
{
    return sprintf('%+.1f %%', $percent);
}

function formatAnalysis(array $analysis): string
{
    $unit = $analysis['indicador']['unidad'];
    [$from, $to] = $analysis['periodo'];

    $lines = [
        "Indicador: {$analysis['indicador']['nombre']} ({$unit})",
        "Ingenio seleccionado: {$analysis['ingenio']}",
        "Periodo analizado: {$from} a {$to}",
        "Ingenios analizados: {$analysis['ingenios_analizados']}",
        "Promedio de la selección: {$analysis['promedio']} {$unit}",
        "Máximo: {$analysis['maximo']} {$unit} | Mínimo: {$analysis['minimo']} {$unit}",
        "Promedio nacional de referencia: {$analysis['promedio_nacional']} {$unit}",
    ];
    if ($analysis['posicion'] !== null) {
        $lines[] = "Posición del ingenio: {$analysis['posicion']} de {$analysis['ingenios_en_ranking']}";
    }

    $lines[] = 'Ranking de ingenios (promedio del periodo):';
    foreach ($analysis['ranking'] as $index => $row) {
        $position = $index + 1;
        $difference = formatPercent($row['diferencia_pct']);
        $lines[] = "{$position}. {$row['ingenio']}: {$row['valor']} {$unit} ({$difference} vs. promedio nacional)";
    }

    $lines[] = 'Promedio por zafra:';
    $previous = null;
    foreach ($analysis['tendencia'] as $harvest => $value) {
        $percent = $previous === null ? null : percentChange($previous, $value);
        $change = $percent === null ? '' : ' (' . formatPercent($percent) . ' vs. zafra anterior)';
        $note = $harvest === HARVEST_IN_PROGRESS ? ' [zafra en curso, datos parciales]' : '';
        $lines[] = "- {$harvest}: {$value} {$unit}{$change}{$note}";
        $previous = $value;
    }

    $recent = $analysis['tendencia_reciente'];
    if ($recent !== null && $recent['cambio_pct'] !== null) {
        $lines[] = "Últimas {$recent['zafras']} zafras completas (úsalas si preguntan por las zafras más recientes): "
            . "de {$recent['desde']} a {$recent['hasta']}, cambio total " . formatPercent($recent['cambio_pct']);
    }

    return implode("\n", $lines);
}

function buildPrompt(array $analysis, string $question): string
{
    return "Datos calculados a partir de los CSV de CONADESUCA:\n"
        . formatAnalysis($analysis)
        . "\n\nPregunta del usuario: {$question}";
}


function askOllama(string $prompt): string
{
    $curl = curl_init(OLLAMA_URL);
    curl_setopt_array($curl, [
        CURLOPT_POST => true,
        CURLOPT_HTTPHEADER => ['Content-Type: application/json'],
        CURLOPT_POSTFIELDS => json_encode([
            'model' => OLLAMA_MODEL,
            'system' => SYSTEM_PROMPT,
            'prompt' => $prompt,
            'stream' => false,
            'options' => ['temperature' => OLLAMA_TEMPERATURE],
        ]),
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => OLLAMA_TIMEOUT_SECONDS,
    ]);
    $body = curl_exec($curl);
    $status = curl_getinfo($curl, CURLINFO_RESPONSE_CODE);
    $error = curl_error($curl);

    if ($body === false) {
        throw new RuntimeException("No se pudo conectar con Ollama: {$error}");
    }
    $response = json_decode($body, true);
    if ($status !== 200 || !isset($response['response'])) {
        throw new RuntimeException('Ollama respondió con un error: ' . ($response['error'] ?? "HTTP {$status}"));
    }

    return trim($response['response']);
}
