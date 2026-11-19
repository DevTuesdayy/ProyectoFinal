<?php

const ALL = 'Todos';
const RANKING_SIZE = 5;

const INDICATORS = [
    'rendimiento_campo' => ['nombre' => 'Rendimiento de campo', 'unidad' => 't/ha'],
    'rendimiento_fabrica' => ['nombre' => 'Rendimiento de fábrica', 'unidad' => '%'],
    'rendimiento_agroindustrial' => ['nombre' => 'Rendimiento agroindustrial', 'unidad' => 't azúcar/ha'],
    'eficiencia_fabrica' => ['nombre' => 'Eficiencia en fábrica', 'unidad' => '%'],
    'azucar_total' => ['nombre' => 'Producción de azúcar', 'unidad' => 't'],
    'cana_molida_bruta' => ['nombre' => 'Caña molida bruta', 'unidad' => 't'],
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

    $ranking = [];
    foreach(array_slice($millAverages, 0, RANKING_SIZE, true) as $millName => $value) {
        $ranking[] = [
            'ingenio' => $millName,
            'valor' => round($value, 2),
            'diferencia_pct' => round(($value - $nationalAverage) / $nationalAverage * 100 , 1),
        ];
    } 

    $trend = averageBy($selected, $indicator, 'zafra');
    ksort($trend);

    $position = array_search($mill, array_keys($millAverages), true);

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
        'posicion' => $position === false ? null : $position + 1,
        'ingenios_en_ranking' => count($millAverages),
        'ranking' => $ranking,
        'tendencia' => array_map(fn ($value) => round($value, 2), $trend),
    ];
}
