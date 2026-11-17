/* CañaData-IA - capa de interacción con jQuery, AJAX y Ollama */
const DEMO_DATA = [
  ["2023", "Veracruz", "Ingenio La Gloria", "18200", "1456000", "80.0"],
  ["2023", "Jalisco", "Ingenio Tamazula", "12100", "968000", "80.0"],
  [
    "2023",
    "San Luis Potosí",
    "Ingenio Plan de Ayala",
    "10800",
    "799200",
    "74.0",
  ],
  ["2023", "Oaxaca", "Ingenio El Refugio", "8200", "582200", "71.0"],
  ["2023", "Tamaulipas", "Ingenio El Mante", "7500", "547500", "73.0"],
  ["2022", "Veracruz", "Ingenio La Gloria", "17500", "1365000", "78.0"],
  ["2022", "Jalisco", "Ingenio Tamazula", "12000", "936000", "78.0"],
  [
    "2022",
    "San Luis Potosí",
    "Ingenio Plan de Ayala",
    "10600",
    "763200",
    "72.0",
  ],
  ["2022", "Oaxaca", "Ingenio El Refugio", "8000", "552000", "69.0"],
  ["2022", "Tamaulipas", "Ingenio El Mante", "7300", "518300", "71.0"],
  ["2021", "Veracruz", "Ingenio La Gloria", "16800", "1276800", "76.0"],
  ["2021", "Jalisco", "Ingenio Tamazula", "11800", "908600", "77.0"],
  [
    "2021",
    "San Luis Potosí",
    "Ingenio Plan de Ayala",
    "10000",
    "710000",
    "71.0",
  ],
  ["2020", "Veracruz", "Ingenio La Gloria", "15100", "1057000", "70.0"],
  ["2020", "Jalisco", "Ingenio Tamazula", "11000", "792000", "72.0"],
  ["2019", "Veracruz", "Ingenio La Gloria", "16000", "1248000", "78.0"],
  ["2019", "Jalisco", "Ingenio Tamazula", "11500", "908500", "79.0"],
];
let records = DEMO_DATA.map(toRecord),
  filteredRecords = records.slice();
function toRecord(r) {
  return {
    year: r[0],
    state: r[1],
    mill: r[2],
    area: +r[3],
    production: +r[4],
    yield: +r[5],
  };
}
function money(n) {
  return new Intl.NumberFormat("es-MX", { maximumFractionDigits: 0 }).format(n);
}
function unique(key) {
  return [...new Set(records.map((r) => r[key]))].sort();
}
function showToast(msg) {
  $("#toast").text(msg).addClass("show");
  setTimeout(() => $("#toast").removeClass("show"), 2800);
}
function populateFilters() {
  unique("state").forEach((v) =>
    $("#stateFilter").append(`<option>${v}</option>`),
  );
  unique("mill").forEach((v) =>
    $("#millFilter").append(`<option>${v}</option>`),
  );
  unique("year").forEach((v) =>
    $("#yearFilter").append(`<option>${v}</option>`),
  );
}
function applyFilters() {
  const s = $("#stateFilter").length ? $("#stateFilter").val() : "Todos",
    m = $("#millFilter").val(),
    y = $("#yearFilter").val();
  filteredRecords = records.filter(
    (r) =>
      (s === "Todos" || r.state === s) &&
      (m === "Todos" || r.mill === m) &&
      (y === "Todos" || r.year === y),
  );
  renderAll();
  showToast(`${filteredRecords.length} registros encontrados`);
}
function renderStats() {
  const total = filteredRecords.reduce((a, r) => a + r.production, 0),
    avg = filteredRecords.length
      ? filteredRecords.reduce((a, r) => a + r.yield, 0) /
        filteredRecords.length
      : 0,
    years = {};
  filteredRecords.forEach(
    (r) => (years[r.year] = (years[r.year] || 0) + r.production),
  );
  const best = Object.entries(years).sort((a, b) => b[1] - a[1])[0];
  $("#totalProduction").text(money(total));
  $("#avgYield").first().html(`${avg.toFixed(1)} <small>t/ha</small>`);
  $("#stateCount").first().text(new Set(filteredRecords.map((r) => r.mill)).size || 49);
  $("#bestYear").text(best ? best[0] : "—");
  $("#bestYearValue").text(
    best ? `${money(best[1])} toneladas` : "sin registros",
  );
  $("#productionTrend").text("8.4%");
  $("#yieldTrend").text("3.1%");
}
function renderTable() {
  const q = ($("#tableSearch").val() || "").toLowerCase();
  const rows = filteredRecords.filter((r) =>
    `${r.state} ${r.mill} ${r.year}`.toLowerCase().includes(q),
  );
  $("#dataTable").html(
    rows
      .map(
        (r) =>
          `<tr><td>${r.year}</td><td>${r.state}</td><td>${r.mill}</td><td>${money(r.area)}</td><td>${money(r.production)}</td><td>${r.yield.toFixed(1)}</td></tr>`,
      )
      .join("") || '<tr><td colspan="6">No se encontraron registros.</td></tr>',
  );
  $("#rowCount").text(`${rows.length} registros`);
}
function renderChart() {
  const canvas = document.getElementById("productionChart"),
    ctx = canvas.getContext("2d"),
    box = canvas.getBoundingClientRect(),
    dpr = window.devicePixelRatio || 1;
  canvas.width = box.width * dpr;
  canvas.height = box.height * dpr;
  ctx.scale(dpr, dpr);
  const w = box.width,
    h = box.height,
    years = [...new Set(filteredRecords.map((r) => r.year))].sort(),
    vals = years.map((y) =>
      filteredRecords
        .filter((r) => r.year === y)
        .reduce((a, r) => a + r.production, 0),
    ),
    max = Math.max(...vals, 1),
    pad = 25;
  ctx.strokeStyle = "#edf1ed";
  ctx.lineWidth = 1;
  for (let i = 0; i < 4; i++) {
    const y = pad + (i * (h - pad * 2)) / 3;
    ctx.beginPath();
    ctx.moveTo(pad, y);
    ctx.lineTo(w - pad, y);
    ctx.stroke();
  }
  if (!vals.length) return;
  ctx.beginPath();
  vals.forEach((v, i) => {
    const x = pad + (i * (w - pad * 2)) / Math.max(years.length - 1, 1),
      y = h - pad - (v / max) * (h - pad * 2);
    i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
  });
  ctx.strokeStyle = "#256b4a";
  ctx.lineWidth = 3;
  ctx.stroke();
  vals.forEach((v, i) => {
    const x = pad + (i * (w - pad * 2)) / Math.max(years.length - 1, 1),
      y = h - pad - (v / max) * (h - pad * 2);
    ctx.beginPath();
    ctx.arc(x, y, 4, 0, Math.PI * 2);
    ctx.fillStyle = "#c7e970";
    ctx.fill();
    ctx.strokeStyle = "#256b4a";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = "#95a098";
    ctx.font = "10px DM Sans";
    ctx.textAlign = "center";
    ctx.fillText(years[i], x, h - 4);
  });
}
function renderAnalysis() {
  const byState = {};
  filteredRecords.forEach(
    (r) => (byState[r.state] = (byState[r.state] || 0) + r.production),
  );
  const top = Object.entries(byState).sort((a, b) => b[1] - a[1]);
  const max = top[0]?.[1] || 1;
  $("#stateBars").html(
    top
      .slice(0, 6)
      .map(
        ([name, v]) =>
          `<div class="bar-group"><strong class="bar-value">${(v / 1000000).toFixed(1)}M</strong><div class="bar" style="height:${Math.max((v / max) * 82, 5)}%"></div><span>${name.split(" ")[0]}</span></div>`,
      )
      .join(""),
  );
  $("#rankingList").html(
    top
      .slice(0, 5)
      .map(
        ([name, v], i) =>
          `<div class="rank-row"><span class="rank-number">0${i + 1}</span><span class="rank-name">${name}</span><span class="rank-value">${(v / 1000000).toFixed(2)}M t</span></div>`,
      )
      .join(""),
  );
}
function renderAll() {
  renderStats();
  renderTable();
  renderChart();
  renderAnalysis();
}
function navigate(view) {
  $(".page").addClass("hidden");
  $(`#view-${view}`).removeClass("hidden");
  $(".nav-item")
    .removeClass("active")
    .filter(`[data-view="${view}"]`)
    .addClass("active");
  $("#pageTitle").text($(`[data-view="${view}"]`).first().text().trim());
  $("#sidebar").removeClass("open");
  if (view === "dashboard") setTimeout(renderChart, 30);
}
function csvToRecords(text) {
  const lines = text
    .trim()
    .split(/\r?\n/)
    .map((l) => l.split(",").map((x) => x.trim().replace(/^"|"$/g, "")));
  const header = lines.shift().map((x) => x.toLowerCase());
  const find = (names) =>
    header.findIndex((x) => names.some((n) => x.includes(n)));
  const ix = {
    year: find(["zafra", "año", "ano"]),
    state: find(["estado"]),
    mill: find(["ingenio"]),
    area: find(["superficie", "hect"]),
    production: find(["producción", "produccion", "toneladas"]),
    yield: find(["rendimiento"]),
  };
  return lines
    .filter((r) => r.length >= 3)
    .map((r) =>
      toRecord([
        r[ix.year] || "",
        r[ix.state] || "",
        r[ix.mill] || "",
        r[ix.area] || 0,
        r[ix.production] || 0,
        r[ix.yield] || 0,
      ]),
    );
}
async function askOllama(question) {
  const context = filteredRecords
    .slice(0, 30)
    .map(
      (r) => `${r.year}|${r.state}|${r.mill}|${r.production}t|${r.yield}t/ha`,
    )
    .join("\n");
  const prompt = `Eres un analista agrícola. Responde en español, con claridad y máximo 120 palabras. Usa únicamente este contexto histórico:\n${context}\n\nPregunta: ${question}`;
  try {
    const res = await $.ajax({
      url: "http://localhost:11434/api/generate",
      method: "POST",
      contentType: "application/json",
      data: JSON.stringify({ model: "llama3.2:3b", prompt, stream: false }),
    });
    return res.response || "Ollama no devolvió una respuesta.";
  } catch (e) {
    return `No pude conectar con Ollama. Verifica que esté ejecutándose en http://localhost:11434 y que el modelo esté disponible. Mientras tanto, con los datos actuales puedo señalar que ${$("#bestYear").text()} fue la mejor zafra registrada.`;
  }
}
$(function () {
  populateFilters();
  renderAll();
  $("#applyFilters").on("click", applyFilters);
  $("#millFilter,#yearFilter").on("change", applyFilters);
  $("#tableSearch").on("input", renderTable);
  $(".nav-item,[data-view]").on("click", function () {
    const v = $(this).data("view");
    if (v) navigate(v);
  });
  $("#menuToggle").on("click", () => $("#sidebar").toggleClass("open"));
  $("#themeToggle").on("click", () => showToast("Tema claro activo"));
  $(".quick-prompts button").on("click", function () {
    const text = $(this).text();
    $("#queryQuestion").val(text);
  });
  $("#queryQuestion").on("input", function () {
    $(this).closest(".query-panel").find(".question-label span").text(`${this.value.length}/300`);
  });
  $("#consultButton").on("click", async function () {
    const button = $(this), question = $("#queryQuestion").val().trim();
    if (!question) return showToast("Escribe una pregunta para consultar");
    button.prop("disabled", true).text("Analizando datos...");
    const answer = await askOllama(question);
    $(".recommendation-body").prepend(`<p class="ai-answer"><strong>Respuesta de Llama 3B:</strong> ${$("<div>").text(answer).html()}</p>`);
    button.prop("disabled", false).html("✧ &nbsp; Consultar con IA");
  });
  $(window).on("resize", () => {
    if (!$("#view-dashboard").hasClass("hidden")) renderChart();
  });
  $("#csvUpload").on("change", function (e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        records = csvToRecords(reader.result);
        filteredRecords = records.slice();
        populateFilters();
        renderAll();
        showToast("CSV cargado correctamente");
      } catch (err) {
        showToast("No se pudo leer el CSV");
      }
    };
    reader.readAsText(file, "UTF-8");
  });
  $(".suggestion").on("click", function () {
    $("#questionInput").val($(this).text()).focus();
  });
  $("#chatForm").on("submit", async function (e) {
    e.preventDefault();
    const input = $("#questionInput"),
      q = input.val().trim();
    if (!q) return;
    $("#chatMessages").append(
      `<div class="message user"><div class="message-avatar">CD</div><div>${$("<div>").text(q).html()}</div></div>`,
    );
    input.val("");
    const id = `ai-${Date.now()}`;
    $("#chatMessages").append(
      `<div class="message assistant" id="${id}"><div class="message-avatar">✦</div><div>Analizando los datos...</div></div>`,
    );
    const answer = await askOllama(q);
    $(`#${id} div:last-child`).text(answer);
  });
});
