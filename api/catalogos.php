<?php

require_once __DIR__ . '/datos.php';
require_once __DIR__ . '/indicadores.php';

header('Content-Type: application/json; charset=utf-8');

$records = loadRecords();

$mills = array_values(array_unique(array_column($records, 'ingenio')));
$harvests = array_values(array_unique(array_column($records, 'zafra')));

(new Collator('es_MX'))->sort($mills);
sort($harvests);

echo json_encode([
    'ingenios' => $mills,
    'zafras' => $harvests,
    'indicadores' => INDICATORS,
], JSON_UNESCAPED_UNICODE);

