<?php

const ALL = 'Todos';
const RANKING_SIZE = 5;
const RECENT_HARVESTS = 5;

// Zafra que sigue en curso: sus cifras son parciales y no se comparan con zafras completas.
const HARVEST_IN_PROGRESS = '2025-2026';

const INDICATORS = [
    'rendimiento_campo' => ['nombre' => 'Rendimiento de campo', 'unidad' => 't/ha'],
    'rendimiento_fabrica' => ['nombre' => 'Rendimiento de fábrica', 'unidad' => '%'],
    'rendimiento_agroindustrial' => ['nombre' => 'Rendimiento agroindustrial', 'unidad' => 't azúcar/ha'],
    'eficiencia_fabrica' => ['nombre' => 'Eficiencia en fábrica', 'unidad' => '%'],
    'azucar_total' => ['nombre' => 'Producción de azúcar', 'unidad' => 't'],
    'azucar_refinada' => ['nombre' => 'Azúcar refinada', 'unidad' => 't'],
    'azucar_estandar' => ['nombre' => 'Azúcar estándar', 'unidad' => 't'],
    'azucar_blanca_especial' => ['nombre' => 'Azúcar blanca especial', 'unidad' => 't'],
    'azucar_mascabado' => ['nombre' => 'Azúcar mascabado', 'unidad' => 't'],
    'cana_molida_bruta' => ['nombre' => 'Caña molida bruta', 'unidad' => 't'],
    'cana_molida_neta' => ['nombre' => 'Caña molida neta', 'unidad' => 't'],
    'superficie_cosechada' => ['nombre' => 'Superficie cosechada', 'unidad' => 'ha'],
];

function filterRecords(array $records, string $mill, string $harvest): array{
    return array_filter($records, fn ($record) =>
        ($mill === ALL || $record['ingenio'] === $mill)
        && ($harvest === ALL || $record['zafra'] === $harvest)
    );
}

function indicatorValues(array $records, string $indicator): array{
    return array_filter(array_column($records, $indicator), fn ($value) => $value !== null);
}

function average(array $values): float{
    return array_sum($values) / count($values);
}

function averageBy(array $records, string $indicator, string $groupField): array{
    $groups = [];
    foreach($records as $record){
        if($record[$indicator] !== null){
            $groups[$record[$groupField]][] = $record[$indicator];
        }
    }

    return array_map(average(...), $groups);
}

// Variación porcentual entre dos valores; null si el valor inicial es 0 porque no se puede dividir.
function percentChange(float $from, float $to): ?float
{
    return $from == 0 ? null : round(($to - $from) / $from * 100, 1);
}

function buildAnalysis(array $records, string $mill, string $harvest, string $indicator): ?array{
    $selected = filterRecords($records, $mill, $harvest);
    $values = indicatorValues($selected, $indicator);
    if(!$values){
        return null;
    }

    $reference = filterRecords($records, ALL, $harvest);
    $nationalAverage = average(indicatorValues($reference, $indicator));

    $millAverages = averageBy($reference, $indicator, 'ingenio');
    arsort($millAverages);

    // Un ingenio con 0 (por ejemplo, que no produce azúcar mascabado) no ocupa un lugar del ranking.
    $producingMills = array_filter($millAverages, fn ($value) => $value > 0);

    $ranking = [];
    foreach(array_slice($producingMills, 0, RANKING_SIZE, true) as $millName => $value) {
        $ranking[] = [
            'ingenio' => $millName,
            'valor' => round($value, 2),
            'diferencia_pct' => round(($value - $nationalAverage) / $nationalAverage * 100 , 1),
        ];
    } 

    $trend = averageBy($selected, $indicator, 'zafra');
    ksort($trend);

    // Las zafras completas más recientes responden preguntas como "¿cómo cambió en las últimas cinco zafras?".
    $completeTrend = array_diff_key($trend, [HARVEST_IN_PROGRESS => true]);
    $recentTrend = array_slice($completeTrend, -RECENT_HARVESTS, null, true);

    // Los empates comparten lugar: la posición es 1 + los ingenios con un valor mayor.
    $millValue = $millAverages[$mill] ?? null;
    $position = $millValue === null ? null : 1 + count(array_filter($millAverages, fn ($value) => $value > $millValue));
    $ties = $millValue === null ? 0 : count(array_filter($millAverages, fn ($value) => $value == $millValue)) - 1;

    return[
        'indicador' => ['clave' => $indicator, ...INDICATORS[$indicator]],
        'ingenio' => $mill,
        'zafra' => $harvest,
        'periodo' => [array_key_first($trend), array_key_last($trend)],
        'ingenios_analizados' => count(array_unique(array_column($selected, 'ingenio'))),
        'promedio' => round(average($values), 2),
        'maximo' => round(max($values), 2),
        'minimo' => round(min($values), 2),
        'promedio_nacional' => round($nationalAverage, 2),
        'diferencia_nacional_pct' => percentChange($nationalAverage, average($values)),
        'posicion' => $position,
        'empatados' => $ties,
        'ingenios_en_ranking' => count($millAverages),
        'ranking' => $ranking,
        'tendencia' => array_map(fn ($value) => round($value, 2), $trend),
        'tendencia_reciente' => count($recentTrend) < 2 ? null : [
            'zafras' => count($recentTrend),
            'desde' => array_key_first($recentTrend),
            'hasta' => array_key_last($recentTrend),
            'cambio_pct' => percentChange(reset($recentTrend), end($recentTrend)),
        ],
    ];
}
