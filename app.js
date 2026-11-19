/* CañaData-IA - interacción del formulario con el backend mediante jQuery y AJAX */

const API_URL = "api";
const ALL = "Todos"; // Igual que la constante ALL de api/indicadores.php.
const QUESTION_MAX_LENGTH = 300; // Igual que QUESTION_MAX_LENGTH de api/consulta.php.
const REQUEST_TIMEOUT_MS = 130000; // Un poco más que OLLAMA_TIMEOUT_SECONDS de api/ollama.php.
const LARGE_NUMBER = 1000; // Las toneladas y hectáreas se muestran sin decimales.
const CONSULT_BUTTON_LABEL = "✧ &nbsp; Consultar con IA";

// Llama 3B separa su respuesta en "Análisis:" y "Recomendación:", a veces numeradas o en negritas.
const SECTION_HEADING = /^\s*(?:\d\.\s*)?(An[aá]lisis|Recomendaci[oó]n)\s*:?\s*/i;

function showToast(message) {
  $("#toast").text(message).addClass("show");
  setTimeout(() => $("#toast").removeClass("show"), 2800);
}

function formatNumber(value) {
  const fractionDigits = Math.abs(value) >= LARGE_NUMBER ? 0 : 2;
  return value.toLocaleString("es-MX", { maximumFractionDigits: fractionDigits });
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
      addOptions($("#millFilter"), ingenios.map((mill) => [mill, mill]));
      addOptions($("#yearFilter"), zafras.map((harvest) => [harvest, harvest]));
      const period = formatPeriod([zafras[0], zafras.at(-1)]);
      $(`#yearFilter option[value="${ALL}"]`).text(`Todas las zafras (${period})`);
      $("#dataPeriod").text(`Datos: zafras ${period}`);
      addOptions(
        $("#indicatorFilter"),
        Object.entries(indicadores).map(([key, { nombre, unidad }]) => [key, `${nombre} (${unidad})`]),
      );
      $("#consultButton").prop("disabled", false);
    })
    .fail(() => showToast("No se pudieron cargar los datos. Verifica que el servidor PHP esté en ejecución."));
}

function updateQuestionCounter() {
  $("#questionCounter").text(`${$("#queryQuestion").val().length}/${QUESTION_MAX_LENGTH}`);
}

// Los botones de ejemplo llenan la pregunta y ajustan los filtros que necesita.
function applyQuickPrompt() {
  const { zafra, indicador, pregunta } = $(this).data();
  $("#yearFilter").val(zafra);
  $("#indicatorFilter").val(indicador);
  $("#queryQuestion").val(pregunta);
  updateQuestionCounter();
}

function renderKpis(analysis) {
  const { unidad } = analysis.indicador;
  const [best] = analysis.ranking;

  $("#kpiMills").text(analysis.ingenios_analizados);
  showMeasure($("#kpiAverage"), analysis.promedio, unidad);
  if (analysis.posicion === null) {
    $("#kpiHighlightLabel").text(`Mejor ingenio: ${best.ingenio}`);
    showMeasure($("#kpiHighlight"), best.valor, unidad);
  } else {
    $("#kpiHighlightLabel").text(`Posición de ${analysis.ingenio}`);
    $("#kpiHighlight").text(`${analysis.posicion} de ${analysis.ingenios_en_ranking}`);
  }
  $("#kpiPeriod").text(formatPeriod(analysis.periodo));
}

// Las barras se miden contra el primer lugar; la línea vertical marca el promedio nacional.
function renderRanking(analysis) {
  const { nombre, unidad } = analysis.indicador;
  const topValue = analysis.ranking[0].valor;
  const averagePosition = `${(analysis.promedio_nacional / topValue) * 100}%`;

  $("#rankingTitle").text(`Ranking por ${nombre.toLowerCase()}`);
  $("#rankingAverage").text(`▏ Promedio nacional ${formatNumber(analysis.promedio_nacional)} ${unidad}`);
  $("#rankingRows")
    .empty()
    .append(
      analysis.ranking.map((row, index) =>
        $("<div>", { class: "ranking-row" }).append(
          $("<b>").text(index + 1),
          $("<strong>").text(row.ingenio),
          $("<em>").text(`${formatNumber(row.valor)} ${unidad}`),
          $("<mark>").text(formatPercent(row.diferencia_pct)),
          $("<div>", { class: "rank-track" }).append(
            $("<i>", { class: index === 0 ? "rank-fill top" : "rank-fill" }).css("width", `${(row.valor / topValue) * 100}%`),
            $("<span>").css("left", averagePosition),
          ),
        ),
      ),
    );
}

function clearAnalysis() {
  $(".reference-kpis strong").text("—");
  $("#kpiHighlightLabel").text("Mejor ingenio");
  $("#rankingAverage").empty();
  $("#rankingRows").empty();
}

function showRecommendationMessage(message, isError = false) {
  $("#recommendation")
    .empty()
    .append($("<p>", { class: isError ? "recommendation-error" : "results-placeholder" }).text(message));
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
        $callout = $("<div>", { class: "recommendation-callout" }).append($("<strong>").text("RECOMENDACIÓN"));
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
  $("#consultButton")
    .prop("disabled", isLoading)
    .html(isLoading ? "Analizando datos…" : CONSULT_BUTTON_LABEL);
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
      renderKpis(analisis);
      renderRanking(analisis);
      renderRecommendation(recomendacion, analisis);
    })
    .fail((xhr) => {
      // Si solo falló la IA, el backend igual manda los indicadores calculados.
      const response = xhr.responseJSON ?? {};
      if (response.analisis) {
        renderKpis(response.analisis);
        renderRanking(response.analisis);
      } else {
        clearAnalysis();
      }
      showRecommendationMessage(
        response.error ?? "No se pudo completar la consulta. Verifica que el servidor PHP y Ollama estén en ejecución.",
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
  $(".quick-prompts button").on("click", applyQuickPrompt);
  $("#queryForm").on("submit", consult);

  updateQuestionCounter();
  loadCatalogs();
});
