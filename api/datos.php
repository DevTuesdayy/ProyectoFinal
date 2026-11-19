<?php
/* CañaData-IA - unificación de los CSV históricos de Infocaña (CONADESUCA) */

const DATA_DIR = __DIR__ . '/../data';

// La zafra 2025-2026 usa nombres de columna distintos a las zafras anteriores.
const COLUMN_ALIASES = [
    'no_s_zafra' => 'semana',
    'azucar_producida_total' => 'azucar_total',
    'azucar_producida_refinada' => 'azucar_refinada',
    'azucar_producida_estandar' => 'azucar_estandar',
    'azucar_producida_blanca_especial' => 'azucar_blanca_especial',
    'azucar_producida_mascabado' => 'azucar_mascabado',
    'eficiencia_en_fabrica' => 'eficiencia_fabrica',
];

const NUMERIC_FIELDS = [
    'semana',
    'cana_molida_bruta',
    'cana_molida_neta',
    'superficie_cosechada',
    'azucar_total',
    'azucar_refinada',
    'azucar_estandar',
    'azucar_blanca_especial',
    'azucar_mascabado',
    'eficiencia_fabrica',
];

// Nombre normalizado (minúsculas, sin acentos) => nombre a mostrar.
// Varios ingenios cambiaron de nombre entre zafras; aquí se agrupan sus variantes.
const MILL_NAMES = [
    'aaron saenz garza' => 'Aarón Sáenz Garza',
    'adolfo lopez mateos' => 'Adolfo López Mateos',
    'alianza popular' => 'Alianza Popular',
    'atencingo' => 'Atencingo',
    'azsuremex' => 'Azsuremex (Tenosique)',
    'azsuremex - tenosique' => 'Azsuremex (Tenosique)',
    'bellavista' => 'Bellavista',
    'calipam' => 'Calipam',
    'central casasano' => 'Central Casasano',
    'central el potrero' => 'Central El Potrero',
    'el potrero' => 'Central El Potrero',
    'central la providencia' => 'Central La Providencia',
    'la providencia' => 'Central La Providencia',
    'la providencia, central' => 'Central La Providencia',
    'central motzorongo' => 'Central Motzorongo',
    'central progreso' => 'Central Progreso',
    'central san miguelito' => 'Central San Miguelito',
    'san miguelito' => 'Central San Miguelito',
    'cia. la fe (pujiltic)' => 'Cía. La Fe (Pujiltic)',
    'pujiltic (cia. la fe)' => 'Cía. La Fe (Pujiltic)',
    'ciasa (cuatotolapam)' => 'CIASA (Cuatotolapam)',
    'cuatotolapam' => 'CIASA (Cuatotolapam)',
    'constancia' => 'Constancia',
    'el carmen' => 'El Carmen',
    'el higo' => 'El Higo',
    'el mante' => 'El Mante',
    'el modelo' => 'El Modelo',
    'el molino' => 'El Molino',
    'el refugio' => 'El Refugio',
    'eldorado' => 'Eldorado',
    'emiliano zapata' => 'Emiliano Zapata',
    'huixtla' => 'Huixtla',
    'jose maria morelos' => 'José María Morelos',
    'jose ma. morelos' => 'José María Morelos',
    'la gloria' => 'La Gloria',
    'la joya' => 'La Joya',
    'la margarita' => 'La Margarita',
    'pablo machado (la margarita)' => 'La Margarita',
    'lazaro cardenas' => 'Lázaro Cárdenas',
    'lazaro cardenas - siembra' => 'Lázaro Cárdenas',
    'mahuixtlan' => 'Mahuixtlán',
    'melchor ocampo' => 'Melchor Ocampo',
    'panuco' => 'Pánuco',
    'pedernales' => 'Pedernales',
    'plan de ayala' => 'Plan de Ayala',
    'plan de san luis' => 'Plan de San Luis',
    'presidente benito juarez' => 'Presidente Benito Juárez',
    'presidente benito juarez-santos' => 'Presidente Benito Juárez',
    'puga' => 'Puga',
    'queseria' => 'Quesería',
    'san cristobal' => 'San Cristóbal',
    'san cristobal zcmx' => 'San Cristóbal',
    'san francisco ameca' => 'San Francisco Ameca',
    'san jose de abajo' => 'San José de Abajo',
    'san miguel del naranjo' => 'San Miguel del Naranjo',
    'san nicolas' => 'San Nicolás',
    'san pedro' => 'San Pedro',
    'san rafael de pucte' => 'San Rafael de Pucté',
    'santa clara' => 'Santa Clara',
    'santa rosalia' => 'Santa Rosalía',
    'serapio' => 'Serapio',
    'tala' => 'Tala',
    'tala - siembra' => 'Tala',
    'jose ma. martinez (tala)' => 'Tala',
    'tamazula' => 'Tamazula',
    'tamazula-saenz' => 'Tamazula',
    'tres valles' => 'Tres Valles',
];

function normalizeText(string $text): string
{
    // Quita caracteres de control mal codificados (p. ej. "San Nicola\u{81}s").
    $text = preg_replace('/[\x{80}-\x{9f}]/u', '', $text);
    $text = strtr(mb_strtolower(trim($text)), ['á' => 'a', 'é' => 'e', 'í' => 'i', 'ó' => 'o', 'ú' => 'u', 'ü' => 'u']);
    return preg_replace('/\s+/', ' ', $text);
}

function millName(string $raw): string
{
    $key = normalizeText($raw);
    return MILL_NAMES[$key] ?? mb_convert_case($key, MB_CASE_TITLE);
}

// Un cero en el denominador o numerador significa dato no reportado, no un rendimiento de 0.
function ratio(?float $numerator, ?float $denominator, float $scale = 1): ?float
{
    return $numerator && $denominator ? round($numerator / $denominator * $scale, 4) : null;
}

/**
 * Un registro por ingenio y zafra. Los CSV traen avances semanales acumulados,
 * así que se conserva la última semana reportada. Los rendimientos se calculan
 * con la misma fórmula en todas las zafras porque 2015-2017 no los incluyen.
 */
function loadRecords(): array
{
    $latest = [];
    foreach (glob(DATA_DIR . '/cana_*.csv') as $file) {
        $handle = fopen($file, 'r');
        $header = array_map(fn ($column) => COLUMN_ALIASES[$column] ?? $column, fgetcsv($handle, escape: ''));
        while (($row = fgetcsv($handle, escape: '')) !== false) {
            if (count($row) !== count($header)) continue;
            $row = array_combine($header, $row);
            $record = ['ingenio' => millName($row['ingenio']), 'zafra' => trim($row['zafra'])];
            foreach (NUMERIC_FIELDS as $field) {
                $record[$field] = is_numeric($row[$field] ?? null) ? (float) $row[$field] : null;
            }
            $key = "{$record['zafra']}|{$record['ingenio']}";
            if (!isset($latest[$key]) || $record['semana'] > $latest[$key]['semana']) $latest[$key] = $record;
        }
        fclose($handle);
    }
    ksort($latest);

    // En eficiencia y caña neta un 0 significa "no reportado"; en los tipos de azúcar es producción real de 0.
    return array_map(fn ($r) => [
        ...$r,
        'eficiencia_fabrica' => $r['eficiencia_fabrica'] ?: null,
        'cana_molida_neta' => $r['cana_molida_neta'] ?: null,
        'rendimiento_campo' => ratio($r['cana_molida_bruta'], $r['superficie_cosechada']),
        'rendimiento_fabrica' => ratio($r['azucar_total'], $r['cana_molida_bruta'], 100),
        'rendimiento_agroindustrial' => ratio($r['azucar_total'], $r['superficie_cosechada']),
    ], array_values($latest));
}
