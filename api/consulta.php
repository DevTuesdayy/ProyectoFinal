<?php
/* CañaData-IA - endpoint principal: valida la consulta, calcula indicadores y pide la recomendación a Llama 3B */

require_once __DIR__ . '/datos.php';
require_once __DIR__ . '/indicadores.php';
require_once __DIR__ . '/ollama.php';

const QUESTION_MAX_LENGTH = 300;

function respondJson(int $status, array $data): never
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

// Lee un campo de texto del JSON recibido; cualquier otro tipo se trata como vacío.
function textField(array $input, string $name, string $default = ''): string
{
    $value = $input[$name] ?? $default;
    return is_string($value) ? trim($value) : '';
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    respondJson(405, ['error' => 'Esta dirección solo acepta consultas por POST.']);
}

$input = json_decode(file_get_contents('php://input'), true);
if (!is_array($input)) {
    respondJson(400, ['error' => 'La consulta debe enviarse como JSON.']);
}

$mill = textField($input, 'ingenio', ALL);
$harvest = textField($input, 'zafra', ALL);
$indicator = textField($input, 'indicador');
$question = textField($input, 'pregunta');

$records = loadRecords();

$errors = [];
if ($mill !== ALL && !in_array($mill, array_column($records, 'ingenio'), true)) {
    $errors[] = 'El ingenio seleccionado no existe.';
}
if ($harvest !== ALL && !in_array($harvest, array_column($records, 'zafra'), true)) {
    $errors[] = 'La zafra seleccionada no existe.';
}
if (!array_key_exists($indicator, INDICATORS)) {
    $errors[] = 'El indicador seleccionado no es válido.';
}
if ($question === '' || mb_strlen($question) > QUESTION_MAX_LENGTH) {
    $errors[] = 'Escribe una pregunta de 1 a ' . QUESTION_MAX_LENGTH . ' caracteres.';
}
if ($errors) {
    respondJson(422, ['error' => implode(' ', $errors)]);
}

$analysis = buildAnalysis($records, $mill, $harvest, $indicator);
if ($analysis === null) {
    respondJson(404, ['error' => 'No hay datos de ese indicador para el ingenio y la zafra elegidos.']);
}

try {
    $recommendation = askOllama(buildPrompt($analysis, $question));
} catch (RuntimeException $exception) {
    error_log($exception->getMessage());
    respondJson(503, [
        'error' => 'La IA local no está disponible. Verifica que Ollama esté en ejecución.',
        'analisis' => $analysis,
    ]);
}

respondJson(200, ['analisis' => $analysis, 'recomendacion' => $recommendation]);
