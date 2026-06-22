// ============================================================================
// MÓDULO: REPORTES DE PRODUCCIÓN
// Cubre: CU-08 (Reportes de producción por servicio y por profesional)
// ============================================================================

let usuarioSesion = null;
let ultimoReporte = { tipo: null, filas: [], fechaInicio: null, fechaFin: null };

// Instancias globales para controlar la destrucción y redibujado de gráficos
let instanciaBarras = null;
let instanciaDona = null;

document.addEventListener("DOMContentLoaded", async () => {
  usuarioSesion = await protegerPagina(["administrador"]);
  if (!usuarioSesion) return;

  construirLayout(usuarioSesion, window.location.pathname);

  // Rango por defecto: últimos 30 días
  const hoy = new Date();
  const hace30 = new Date();
  hace30.setDate(hoy.getDate() - 30);

  document.getElementById("campo-fecha-inicio").value = hace30.toISOString().split("T")[0];
  document.getElementById("campo-fecha-fin").value = hoy.toISOString().split("T")[0];

  // 🪄 Pintar gráficos por primera vez (En cero / Vacíos)
  inicializarGraficosVacios();

  document.getElementById("form-generar-reporte").addEventListener("submit", generarReporte);
  document.getElementById("btn-exportar-pdf").addEventListener("click", exportarPDF);
  document.getElementById("btn-exportar-excel").addEventListener("click", exportarExcel);
});

async function generarReporte(event) {
  event.preventDefault();
  ocultarMensajeReporte();

  const tipo = document.getElementById("select-tipo-reporte").value;
  const fechaInicio = document.getElementById("campo-fecha-inicio").value;
  const fechaFin = document.getElementById("campo-fecha-fin").value;
  const btn = document.getElementById("btn-generar");

  if (fechaInicio > fechaFin) {
    mostrarMensajeReporte("La fecha de inicio no puede ser mayor que la fecha fin.", "error");
    return;
  }

  btn.disabled = true;
  btn.textContent = "Generando...";

  try {
    const consultas = await reporteService.obtenerProduccion(fechaInicio, fechaFin);

    if (consultas.length === 0) {
      document.getElementById("contenedor-resultado-reporte").innerHTML = `
        <div class="estado-vacio">No se encontraron atenciones en el rango seleccionado.</div>`;
      document.getElementById("acciones-exportar").style.display = "none";
      
      // Si la consulta vino vacía, reseteamos los gráficos visuales a cero
      inicializarGraficosVacios();
      return;
    }

    const filas =
      tipo === "servicio"
        ? reporteService.agruparPorServicio(consultas)
        : reporteService.agruparPorProfesional(consultas);

    ultimoReporte = { tipo, filas, fechaInicio, fechaFin };

    pintarTablaReporte(tipo, filas);
    actualizarGraficos(tipo, filas); // ⚡ Actualiza los gráficos con data viva
    document.getElementById("acciones-exportar").style.display = "flex";
  } catch (err) {
    mostrarMensajeReporte("No se pudo generar el reporte: " + err.message, "error");
  } finally {
    btn.disabled = false;
    btn.textContent = "Generar reporte";
  }
}

function pintarTablaReporte(tipo, filas) {
  const cont = document.getElementById("contenedor-resultado-reporte");

  const encabezados =
    tipo === "servicio"
      ? ["Servicio / Especialidad", "Total de atenciones", "Completadas"]
      : ["Profesional de salud", "Especialidad", "Total de atenciones", "Completadas"];

  const filasHtml = filas
    .map((f) =>
      tipo === "servicio"
        ? `<tr><td><strong>${f.servicio}</strong></td><td>${f.total}</td><td>${f.completadas}</td></tr>`
        : `<tr><td><strong>${f.profesional}</strong></td><td>${f.especialidad}</td><td>${f.total}</td><td>${f.completadas}</td></tr>`
    )
    .join("");

  cont.innerHTML = `
    <table class="tabla-datos">
      <thead><tr>${encabezados.map((e) => `<th>${e}</th>`).join("")}</tr></thead>
      <tbody>${filasHtml}</tbody>
    </table>
  `;
}

// ============================================================================
// LÓGICA DE CONTROL DE CHART.JS (Pintado dinámico y estados vacíos)
// ============================================================================

function inicializarGraficosVacios() {
  const ctxBarras = document.getElementById("chartBarras").getContext("2d");
  const ctxDona = document.getElementById("chartDona").getContext("2d");

  if (instanciaBarras) instanciaBarras.destroy();
  if (instanciaDona) instanciaDona.destroy();

  // Gráfico de Barras por defecto (Sin datos)
  instanciaBarras = new Chart(ctxBarras, {
    type: "bar",
    data: {
      labels: ["Sin registros"],
      datasets: [{
        label: "Atenciones",
        data: [0],
        backgroundColor: "rgba(203, 213, 225, 0.5)",
        borderColor: "rgba(148, 163, 184, 1)",
        borderWidth: 1
      }]
    },
    options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true, max: 5 } } }
  });

  // Gráfico de Dona por defecto (Sin datos)
  instanciaDona = new Chart(ctxDona, {
    type: "doughnut",
    data: {
      labels: ["Pendientes", "Completadas"],
      datasets: [{
        data: [0, 0],
        backgroundColor: ["#e2e8f0", "#cbd5e1"]
      }]
    },
    options: { responsive: true, maintainAspectRatio: false }
  });
}

function actualizarGraficos(tipo, filas) {
  const ctxBarras = document.getElementById("chartBarras").getContext("2d");
  const ctxDona = document.getElementById("chartDona").getContext("2d");

  if (instanciaBarras) instanciaBarras.destroy();
  if (instanciaDona) instanciaDona.destroy();

  // Procesar etiquetas y datos
  const etiquetas = filas.map(f => tipo === "servicio" ? f.servicio : f.profesional);
  const totales = filas.map(f => f.total);
  
  const totalCompletadas = filas.reduce((acc, f) => acc + (f.completadas || 0), 0);
  const totalAtenciones = filas.reduce((acc, f) => acc + f.total, 0);
  const totalPendientes = Math.max(0, totalAtenciones - totalCompletadas);

  // Re-dibujar Barras con la data procesada
  instanciaBarras = new Chart(ctxBarras, {
    type: "bar",
    data: {
      labels: etiquetas,
      datasets: [{
        label: "Cantidad de Atenciones",
        data: totales,
        backgroundColor: "rgba(21, 101, 192, 0.75)",
        borderColor: "rgba(21, 101, 192, 1)",
        borderWidth: 1
      }]
    },
    options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true } } }
  });

  // Re-dibujar Dona con estados reales
  instanciaDona = new Chart(ctxDona, {
    type: "doughnut",
    data: {
      labels: ["Pendientes", "Completadas"],
      datasets: [{
        data: [totalPendientes, totalCompletadas],
        backgroundColor: ["#f59e0b", "#10b981"] // Ámbar para pendientes, Esmeralda para listos
      }]
    },
    options: { responsive: true, maintainAspectRatio: false }
  });
}

// ---------------------------------------------------------------------------
// Exportación a PDF (jsPDF)
// ---------------------------------------------------------------------------
function exportarPDF() {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();

  doc.setFontSize(14);
  doc.text("Reporte de Producción - SDGP Villa Victoria Porvenir", 14, 18);

  doc.setFontSize(10);
  doc.text(`Tipo: ${ultimoReporte.tipo === "servicio" ? "Por servicio" : "Por profesional"}`, 14, 26);
  doc.text(`Periodo: ${ultimoReporte.fechaInicio} al ${ultimoReporte.fechaFin}`, 14, 32);

  const columnas =
    ultimoReporte.tipo === "servicio"
      ? ["Servicio", "Total", "Completadas"]
      : ["Profesional", "Especialidad", "Total", "Completadas"];

  const filas = ultimoReporte.filas.map((f) =>
    ultimoReporte.tipo === "servicio"
      ? [f.servicio, f.total, f.completadas]
      : [f.profesional, f.especialidad, f.total, f.completadas]
  );

  doc.autoTable({
    head: [columnas],
    body: filas,
    startY: 38,
    headStyles: { fillColor: [21, 101, 192] },
  });

  doc.save(`reporte-produccion-${ultimoReporte.fechaInicio}-a-${ultimoReporte.fechaFin}.pdf`);
}

// ---------------------------------------------------------------------------
// Exportación a Excel (SheetJS)
// ---------------------------------------------------------------------------
function exportarExcel() {
  const datos = ultimoReporte.filas.map((f) =>
    ultimoReporte.tipo === "servicio"
      ? { Servicio: f.servicio, "Total de atenciones": f.total, Completadas: f.completadas }
      : {
          Profesional: f.profesional,
          Especialidad: f.especialidad,
          "Total de atenciones": f.total,
          Completadas: f.completadas,
        }
  );

  const hoja = XLSX.utils.json_to_sheet(datos);
  const libro = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(libro, hoja, "Reporte");

  XLSX.writeFile(libro, `reporte-produccion-${ultimoReporte.fechaInicio}-a-${ultimoReporte.fechaFin}.xlsx`);
}

function mostrarMensajeReporte(texto, tipo) {
  const el = document.getElementById("mensaje-reporte");
  if (!el) return;
  el.textContent = texto;
  el.className = `mensaje visible mensaje-${tipo}`;
}

function ocultarMensajeReporte() {
  const el = document.getElementById("mensaje-reporte");
  if (el) el.classList.remove("visible");
}