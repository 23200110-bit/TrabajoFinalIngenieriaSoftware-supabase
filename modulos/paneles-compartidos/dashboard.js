// ============================================================================
// DASHBOARD: indicadores para el Encargado del Centro
// Cubre: HU-10 (tiempos de espera y atenciones), HU-11 (ocupación en tiempo real)
// ============================================================================

document.addEventListener("DOMContentLoaded", async () => {
  const usuario = await protegerPagina(["encargado", "administrador"]);
  if (!usuario) return;

  construirLayout(usuario, "/modulos/paneles-compartidos/dashboard.html");
  await cargarIndicadores();

  // Refresco automático cada 30s para simular "tiempo real" (HU-11)
  setInterval(cargarIndicadores, 30000);
});

async function cargarIndicadores() {
  try {
    const indicadores = await citaService.obtenerIndicadoresDashboard();
    const turnos = await citaService.listarTurnosDelDia();

    pintarKpis(indicadores, turnos);
    pintarTablaOcupacion(indicadores);
  } catch (err) {
    console.error("Error cargando dashboard:", err);
  }
}

function pintarKpis(indicadores, turnos) {
  const totalCitasHoy = indicadores
    .filter((i) => i.fecha === new Date().toISOString().split("T")[0])
    .reduce((acc, i) => acc + Number(i.total_citas), 0);

  const completadas = indicadores.reduce((acc, i) => acc + Number(i.citas_completadas), 0);
  const canceladas = indicadores.reduce((acc, i) => acc + Number(i.citas_canceladas), 0);
  const enEspera = turnos.filter((t) => t.estado === "en_espera").length;

  document.getElementById("kpi-citas-hoy").textContent = totalCitasHoy;
  document.getElementById("kpi-completadas").textContent = completadas;
  document.getElementById("kpi-canceladas").textContent = canceladas;
  document.getElementById("kpi-en-espera").textContent = enEspera;
}

function pintarTablaOcupacion(indicadores) {
  const tbody = document.getElementById("tabla-ocupacion-body");

  if (indicadores.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" class="estado-vacio">Aún no hay citas registradas.</td></tr>`;
    return;
  }

  tbody.innerHTML = indicadores
    .map(
      (i) => `
    <tr>
      <td>${formatearFecha(i.fecha)}</td>
      <td>${i.especialidad}</td>
      <td>${i.total_citas}</td>
      <td>
        <span class="badge badge-exito">${i.citas_completadas} completadas</span>
        ${i.citas_canceladas > 0 ? `<span class="badge badge-error">${i.citas_canceladas} canceladas</span>` : ""}
      </td>
    </tr>
  `
    )
    .join("");
}

function formatearFecha(fechaIso) {
  const d = new Date(fechaIso + "T00:00:00");
  return d.toLocaleDateString("es-PE", { day: "2-digit", month: "short", year: "numeric" });
}
