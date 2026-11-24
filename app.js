/* CañaData-IA - interacción del formulario con el backend mediante jQuery y AJAX */

const API_URL = "api";
const ALL = "Todos"; // Igual que la constante ALL de api/indicadores.php.
const QUESTION_MAX_LENGTH = 300; // Igual que QUESTION_MAX_LENGTH de api/consulta.php.
const REQUEST_TIMEOUT_MS = 130000; // Un poco más que OLLAMA_TIMEOUT_SECONDS de api/ollama.php.
const LARGE_NUMBER = 1000; // Las toneladas y hectáreas se muestran sin decimales.
const CONSULT_BUTTON_LABEL = "✧ &nbsp; Consultar con IA";
const DEFAULT_QUESTION =
  "¿Qué ingenios presentan mejor rendimiento de campo y cómo se comparan con el promedio histórico?";
let lastAnalysis = null;
let loadingTimer = null;
const LOADING_MESSAGES = [
  "Calculando indicadores…",
  "Consultando Llama 3B…",
  "Preparando resultados…",
];

// Llama 3B separa su respuesta en "Análisis:" y "Recomendación:", a veces numeradas o en negritas.
const SECTION_HEADING =
  /^\s*(?:\d\.\s*)?(An[aá]lisis|Recomendaci[oó]n)\s*:?\s*/i;

function showToast(message) {
  $("#toast").text(message).addClass("show");
  setTimeout(() => $("#toast").removeClass("show"), 2800);
}

function formatNumber(value) {
  const fractionDigits = Math.abs(value) >= LARGE_NUMBER ? 0 : 2;
  return value.toLocaleString("es-MX", {
    maximumFractionDigits: fractionDigits,
  });
}

// Mismo formato que formatPercent() de api/ollama.php: "+5.2 %" o "-3.1 %".
function formatPercent(percent) {
  return `${percent >= 0 ? "+" : ""}${percent.toFixed(1)} %`;
}

function formatPeriod([from, to]) {
  return from === to ? from : `${from} a ${to}`;
}

// Muestra un número con su unidad en letra pequeña, como en el diseño original.
function showMeasure($element, value, unit) {
  $element.empty().append(formatNumber(value), " ", $("<small>").text(unit));
}

// Agrega opciones a un <select> a partir de pares [valor, texto visible].
function addOptions($select, entries) {
  entries.forEach(([value, label]) => {
    $select.append($("<option>").val(value).text(label));
  });
}

function loadCatalogs() {
  return $.getJSON(`${API_URL}/catalogos.php`)
    .done(({ ingenios, zafras, indicadores }) => {
      addOptions(
        $("#millFilter"),
        ingenios.map((mill) => [mill, mill]),
      );
      addOptions(
        $("#yearFilter"),
        zafras.map((harvest) => [harvest, harvest]),
      );
      const period = formatPeriod([zafras[0], zafras.at(-1)]);
      $(`#yearFilter option[value="${ALL}"]`).text(
        `Todas las zafras (${period})`,
      );
      $("#dataPeriod").text(`Datos: zafras ${period}`);
      addOptions(
        $("#indicatorFilter"),
        Object.entries(indicadores).map(([key, { nombre, unidad }]) => [
          key,
          `${nombre} (${unidad})`,
        ]),
      );
      $("#consultButton").prop("disabled", false);
      ["#millFilter", "#yearFilter", "#indicatorFilter"].forEach(updateSelectTitle);
      updatePartialNotice();
    })
    .fail(() =>
      showToast(
        "No se pudieron cargar los datos. Verifica que el servidor PHP esté en ejecución.",
      ),
    );
}

function updateSelectTitle(selector) {
  const $select = $(selector);
  $select.attr("title", $select.find("option:selected").text());
}

function updatePartialNotice() {
  const isPartial = $("#yearFilter").val() === "2025-2026";
  $("#partialNotice").prop("hidden", !isPartial);
}

function updateQuestionCounter() {
  $("#questionCounter").text(
    `${$("#queryQuestion").val().length}/${QUESTION_MAX_LENGTH}`,
  );
}

// Los botones de ejemplo llenan la pregunta y ajustan los filtros que necesita.
function applyQuickPrompt() {
  const { zafra, indicador, pregunta } = $(this).data();
  $("#yearFilter").val(zafra);
  $("#indicatorFilter").val(indicador);
  $("#queryQuestion").val(pregunta);
  updateQuestionCounter();
  updatePartialNotice();
}

function renderKpis(analysis) {
  const { unidad } = analysis.indicador;
  const [best] = analysis.ranking;

  $("#kpiMills").text(analysis.ingenios_analizados);
  showMeasure($("#kpiAverage"), analysis.promedio, unidad);
  if (analysis.posicion === null && best) {
    $("#kpiHighlightLabel").text(`Mejor ingenio: ${best.ingenio}`);
    showMeasure($("#kpiHighlight"), best.valor, unidad);
  } else if (analysis.posicion === null) {
    $("#kpiHighlightLabel").text("Mejor ingenio");
    $("#kpiHighlight").text("Sin datos");
  } else {
    const ties =
      analysis.empatados > 0 ? ` (empate con ${analysis.empatados})` : "";
    $("#kpiHighlightLabel").text(`Posición de ${analysis.ingenio}${ties}`);
    $("#kpiHighlight").text(
      `${analysis.posicion} de ${analysis.ingenios_en_ranking}`,
    );
  }
  $("#kpiPeriod").text(formatPeriod(analysis.periodo));
}

// Las barras se miden contra el primer lugar; la línea vertical marca el promedio nacional.
function renderRanking(analysis) {
  const { nombre, unidad } = analysis.indicador;
  const topValue = analysis.ranking[0].valor;
  const averagePosition = `${(analysis.promedio_nacional / topValue) * 100}%`;

  $("#rankingTitle").text(`Ranking por ${nombre.toLowerCase()}`);
  if (!analysis.ranking.length) {
    $("#rankingAverage").empty();
    $("#rankingRows").html(
      '<p class="results-placeholder">No hay ingenios con producción reportada para este indicador.</p>',
    );
    return;
  }
  $("#rankingAverage").text(
    `▏ Promedio nacional ${formatNumber(analysis.promedio_nacional)} ${unidad}`,
  );
  $("#rankingRows")
    .empty()
    .append(
      analysis.ranking.map((row, index) =>
        $("<div>", { class: "ranking-row" }).append(
          $("<b>", { class: index < 3 ? "rank-medal" : "" }).text(
            index < 3 ? ["🥇", "🥈", "🥉"][index] : index + 1,
          ),
          $("<strong>").text(row.ingenio),
          $("<em>").text(`${formatNumber(row.valor)} ${unidad}`),
          $("<mark>").text(formatPercent(row.diferencia_pct)),
          $("<div>", { class: "rank-track" }).append(
            $("<i>", {
              class: index === 0 ? "rank-fill top" : "rank-fill",
            }).css("width", `${(row.valor / topValue) * 100}%`),
            $("<span>").css("left", averagePosition),
          ),
        ),
      ),
    );
}

function renderTrend(analysis) {
  const { unidad } = analysis.indicador;
  const entries = Object.entries(analysis.tendencia ?? {}).slice(-5);
  const values = entries.map(([, value]) => value);
  const maxValue = Math.max(...values, 0);
  const $rows = $("#trendRows").empty();

  $("#trendUnit").text(
    entries.length > 1 ? `Últimas ${entries.length} zafras · ${unidad}` : unidad,
  );
  if (!entries.length || maxValue <= 0) {
    $rows.append(
      $("<p>", {
        class: "results-placeholder",
        text: "No hay suficientes datos para mostrar una tendencia.",
      }),
    );
    return;
  }

  entries.forEach(([harvest, value]) => {
    const width = `${Math.max((value / maxValue) * 100, 2)}%`;
    $rows.append(
      $("<div>", { class: "trend-row" }).append(
        $("<span>").text(harvest),
        $("<div>", { class: "trend-track" }).append(
          $("<i>").css("width", width),
        ),
        $("<strong>").text(`${formatNumber(value)} ${unidad}`),
      ),
    );
  });
}

function renderInsight(analysis) {
  const [best] = analysis.ranking;
  const recent = analysis.tendencia_reciente;
  let message = `${analysis.ingenios_analizados} ingenios tienen datos válidos para ${analysis.indicador.nombre.toLowerCase()}.`;

  if (best) {
    message += ` ${best.ingenio} lidera con ${formatNumber(best.valor)} ${analysis.indicador.unidad}, ${formatPercent(best.diferencia_pct)} frente al promedio.`;
  }
  if (recent?.cambio_pct !== null && recent?.cambio_pct !== undefined) {
    message += ` En las últimas ${recent.zafras} zafras, la tendencia ${recent.cambio_pct >= 0 ? "subió" : "bajó"} ${formatPercent(recent.cambio_pct)}.`;
  }

  $("#insightText").text(message);
  $("#insightCard").prop("hidden", false);
}

function csvCell(value) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

function exportAnalysis() {
  if (!lastAnalysis) return;

  const { indicador, ranking, tendencia } = lastAnalysis;
  const rows = [["Tipo", "Periodo", "Ingenio", "Valor", "Unidad", "Diferencia"]];
  ranking.forEach((row) =>
    rows.push(["Ranking", lastAnalysis.zafra, row.ingenio, row.valor, indicador.unidad, `${row.diferencia_pct}%`]),
  );
  Object.entries(tendencia ?? {}).forEach(([harvest, value]) =>
    rows.push(["Tendencia", harvest, "Promedio", value, indicador.unidad, ""]),
  );

  const csv = "\\uFEFF" + rows.map((row) => row.map(csvCell).join(",")).join("\\n");
  const link = document.createElement("a");
  link.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  link.download = `canadata-${indicador.clave}-${lastAnalysis.zafra}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
  showToast("Resultados exportados correctamente.");
}

function clearAnalysis() {
  lastAnalysis = null;
  $("#exportButton").prop("disabled", true);
  $("#insightCard").prop("hidden", true);
  $(".reference-kpis strong").text("—");
  $("#kpiHighlightLabel").text("Mejor ingenio");
  $("#rankingTitle").text("Ranking de ingenios");
  $("#rankingAverage").empty();
  $("#rankingRows").html(
    '<p class="results-placeholder">Elige los parámetros y presiona «Consultar con IA» para calcular los indicadores.</p>',
  );
  $("#trendUnit").empty();
  $("#trendRows").html(
    '<p class="results-placeholder">La tendencia aparecerá después de consultar.</p>',
  );
}

function resetQuery() {
  $("#millFilter").val(ALL);
  $("#yearFilter").val(ALL);
  $("#indicatorFilter").prop("selectedIndex", 0);
  $("#queryQuestion").val(DEFAULT_QUESTION);
  updateQuestionCounter();
  updatePartialNotice();
  $("select").each(function () {
    updateSelectTitle(`#${this.id}`);
  });
  clearAnalysis();
  showRecommendationMessage(
    "Aquí aparecerá la explicación y la recomendación generada con IA local.",
  );
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function showRecommendationMessage(message, isError = false) {
  $("#recommendation")
    .empty()
    .append(
      $("<p>", {
        class: isError ? "recommendation-error" : "results-placeholder",
      }).text(message),
    );
}

// El análisis va en párrafos normales y la recomendación en el recuadro amarillo.
function renderRecommendation(text, analysis) {
  const $body = $("#recommendation").empty();
  const millCount = analysis.ingenios_analizados;
  let $callout = null;

  text
    .replaceAll("**", "")
    .split(/\n+/)
    .forEach((line) => {
      const heading = line.match(SECTION_HEADING);
      const content = line.slice(heading ? heading[0].length : 0).trim();
      if (heading && heading[1].toLowerCase().startsWith("recomend")) {
        $callout = $("<div>", { class: "recommendation-callout" }).append(
          $("<strong>").text("RECOMENDACIÓN"),
        );
        $body.append($callout);
      }
      if (content) {
        ($callout ?? $body).append($("<p>").text(content));
      }
    });

  $body.append(
    $("<small>", { class: "recommendation-source" }).text(
      `Generada con Llama 3B a partir de los indicadores calculados de ${millCount} ` +
        `${millCount === 1 ? "ingenio" : "ingenios"} (periodo ${formatPeriod(analysis.periodo)}). ` +
        "Fuente: CONADESUCA, datos.gob.mx.",
    ),
  );
}

function setLoading(isLoading) {
  const $button = $("#consultButton");
  clearInterval(loadingTimer);
  $button.prop("disabled", isLoading).toggleClass("is-loading", isLoading);
  if (!isLoading) {
    $button.html(CONSULT_BUTTON_LABEL);
    return;
  }

  let phase = 0;
  const updateLoadingLabel = () =>
    $button.html(
      `<span class="button-spinner" aria-hidden="true"></span> ${LOADING_MESSAGES[phase]}`,
    );
  updateLoadingLabel();
  loadingTimer = setInterval(() => {
    phase = (phase + 1) % LOADING_MESSAGES.length;
    updateLoadingLabel();
  }, 1800);
}

function consult(event) {
  event.preventDefault();
  const question = $("#queryQuestion").val().trim();
  if (!question) {
    showToast("Escribe una pregunta para consultar.");
    return;
  }

  setLoading(true);
  showRecommendationMessage("Llama 3B está analizando los datos calculados…");

  $.ajax({
    url: `${API_URL}/consulta.php`,
    method: "POST",
    contentType: "application/json",
    dataType: "json",
    timeout: REQUEST_TIMEOUT_MS,
    data: JSON.stringify({
      ingenio: $("#millFilter").val(),
      zafra: $("#yearFilter").val(),
      indicador: $("#indicatorFilter").val(),
      pregunta: question,
    }),
    })
    .done(({ analisis, recomendacion }) => {
      lastAnalysis = analisis;
      $("#exportButton").prop("disabled", false);
      renderKpis(analisis);
      renderRanking(analisis);
      renderTrend(analisis);
      renderInsight(analisis);
      renderRecommendation(recomendacion, analisis);
    })
    .fail((xhr) => {
      // Si solo falló la IA, el backend igual manda los indicadores calculados.
      const response = xhr.responseJSON ?? {};
      if (response.analisis) {
        lastAnalysis = response.analisis;
        $("#exportButton").prop("disabled", false);
        renderKpis(response.analisis);
        renderRanking(response.analisis);
        renderTrend(response.analisis);
        renderInsight(response.analisis);
      } else {
        clearAnalysis();
      }
      showRecommendationMessage(
        response.error ??
          "No se pudo completar la consulta. Verifica que el servidor PHP y Ollama estén en ejecución.",
        true,
      );
    })
    .always(() => setLoading(false));
}

function showView(view) {
  const $button = $(`.nav-item[data-view="${view}"]`);
  $(".page").addClass("hidden");
  $(`#view-${view}`).removeClass("hidden");
  $(".nav-item").removeClass("active");
  $button.addClass("active");
  // El último nodo del botón es el texto; el primero es el ícono.
  $("#pageTitle").text($button.contents().last().text().trim());
  $("#sidebar").removeClass("open");
}

$(function () {
  $(".nav-item").on("click", function () {
    showView($(this).data("view"));
  });
  $("#menuToggle").on("click", () => $("#sidebar").toggleClass("open"));
  $("#queryQuestion").on("input", updateQuestionCounter);
  $("#resetButton").on("click", resetQuery);
  $("#exportButton").on("click", exportAnalysis);
  $("#yearFilter").on("change", updatePartialNotice);
  $("select").on("change", function () {
    updateSelectTitle(`#${this.id}`);
  });
  $(".quick-prompts button").on("click", applyQuickPrompt);
  $("#queryForm").on("submit", consult);

  updateQuestionCounter();
  loadCatalogs();
});
