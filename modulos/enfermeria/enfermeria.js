// ============================================================================
// MÓDULO: ENFERMERÍA
// Cubre: CU-03 (Registrar Signos Vitales), HU-14 (Clasificación de Triaje)
// ============================================================================

let usuarioSesion = null;
let turnoSeleccionado = null;

document.addEventListener("DOMContentLoaded", async () => {
  usuarioSesion = await protegerPagina(["enfermeria", "administrador"]);
  if (!usuarioSesion) return;

  construirLayout(usuarioSesion, window.location.pathname);

  if (document.getElementById("cola-triaje-body")) {
    await cargarColaTriaje();
  }
  if (document.getElementById("form-signos-vitales")) {
    document.getElementById("form-signos-vitales").addEventListener("submit", registrarTriajeCompleto);
    calcularPrioridadEnVivo();
  }
});

// ---------------------------------------------------------------------------
// Cola de pacientes esperando triaje (vista triaje.html)
// ---------------------------------------------------------------------------
async function cargarColaTriaje() {
  const tbody = document.getElementById("cola-triaje-body");

  try {
    const cola = await pacienteService.listarColaTriaje();

    if (cola.length === 0) {
      tbody.innerHTML = `<tr><td colspan="4" class="estado-vacio">No hay pacientes en espera de triaje.</td></tr>`;
      return;
    }

    tbody.innerHTML = cola
      .map(
        (t) => `
      <tr>
        <td><strong>#${t.numero_turno}</strong></td>
        <td>${t.pacientes.nombres} ${t.pacientes.apellidos}</td>
        <td>${t.servicio_solicitado}</td>
        <td>
          <button class="btn btn-acento btn-sm"
            onclick="irARegistrarSignos('${t.id}', '${t.pacientes.id}', '${t.pacientes.nombres} ${t.pacientes.apellidos}')">
            Tomar signos vitales
          </button>
        </td>
      </tr>
    `
      )
      .join("");
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="4" class="estado-vacio">Error al cargar la cola.</td></tr>`;
  }
}

function irARegistrarSignos(turnoId, pacienteId, nombrePaciente) {
  // Guardamos referencia en sessionStorage para pasarla a la otra página
  sessionStorage.setItem("triaje_turnoId", turnoId);
  sessionStorage.setItem("triaje_pacienteId", pacienteId);
  sessionStorage.setItem("triaje_nombrePaciente", nombrePaciente);
  window.location.href = "registrar-signos.html";
}

// ---------------------------------------------------------------------------
// CU-03: Registrar signos vitales + HU-14: clasificación de prioridad
// ---------------------------------------------------------------------------
function inicializarDatosPacienteSeleccionado() {
  const nombre = sessionStorage.getItem("triaje_nombrePaciente");
  const elNombre = document.getElementById("nombre-paciente-signos");

  if (!nombre) {
    elNombre.textContent = "Ningún paciente seleccionado. Vuelve a la cola de triaje.";
    document.getElementById("form-signos-vitales").querySelectorAll("input, select, button")
      .forEach((el) => (el.disabled = true));
    return;
  }
  elNombre.textContent = nombre;
}

/** Calcula la prioridad sugerida en vivo, según signos vitales ingresados (HU-14). */
function calcularPrioridadEnVivo() {
  const inputs = ["campo-presion", "campo-temperatura"];
  inputs.forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.addEventListener("input", sugerirPrioridad);
  });
}

function sugerirPrioridad() {
  const temperatura = parseFloat(document.getElementById("campo-temperatura").value) || 0;
  const presion = document.getElementById("campo-presion").value;
  const badge = document.getElementById("prioridad-sugerida");

  let prioridad = "baja";

  // Regla simple de ejemplo (para fines académicos, no es un protocolo clínico real)
  if (temperatura >= 39) prioridad = "alta";
  else if (temperatura >= 37.5) prioridad = "media";

  if (presion) {
    const sistolica = parseInt(presion.split("/")[0]) || 0;
    if (sistolica >= 160 || sistolica <= 90) prioridad = "alta";
  }

  document.getElementById("campo-prioridad").value = prioridad;

  const colores = { alta: "badge-error", media: "badge-alerta", baja: "badge-exito" };
  const textos = { alta: "🔴 Prioridad Alta", media: "🟡 Prioridad Media", baja: "🟢 Prioridad Baja" };

  badge.className = `badge ${colores[prioridad]}`;
  badge.textContent = textos[prioridad];
}

async function registrarTriajeCompleto(event) {
  event.preventDefault();
  ocultarMensajeEnfermeria();

  const turnoId = sessionStorage.getItem("triaje_turnoId");
  const pacienteId = sessionStorage.getItem("triaje_pacienteId");

  if (!turnoId || !pacienteId) {
    mostrarMensajeEnfermeria("No hay un paciente seleccionado. Vuelve a la cola.", "error");
    return;
  }

  const btn = document.getElementById("btn-guardar-signos");
  btn.disabled = true;
  btn.textContent = "Guardando...";

  try {
    const datos = {
      turnoId,
      pacienteId,
      enfermeroId: usuarioSesion.id,
      presionArterial: document.getElementById("campo-presion").value,
      pesoKg: parseFloat(document.getElementById("campo-peso").value) || null,
      tallaCm: parseFloat(document.getElementById("campo-talla").value) || null,
      temperaturaC: parseFloat(document.getElementById("campo-temperatura").value) || null,
      motivoConsulta: document.getElementById("campo-motivo").value,
      prioridad: document.getElementById("campo-prioridad").value,
    };

    await pacienteService.registrarSignosVitales(datos);

    mostrarMensajeEnfermeria("Signos vitales registrados. El paciente queda en cola para el médico.", "exito");
    document.getElementById("form-signos-vitales").reset();

    sessionStorage.removeItem("triaje_turnoId");
    sessionStorage.removeItem("triaje_pacienteId");
    sessionStorage.removeItem("triaje_nombrePaciente");

    setTimeout(() => (window.location.href = "triaje.html"), 1500);

  } catch (err) {
    console.error("Error capturado en Triaje:", err);

    // =========================================================================
    // ✨ EL CAMBIO ESTÁ AQUÍ: Controlar el error numérico para el usuario
    // =========================================================================
    if (err.message && err.message.includes("numeric field overflow")) {
      mostrarMensajeEnfermeria(
        "⚠️ Los valores ingresados en Peso, Talla o Temperatura son demasiado altos o inválidos. Por favor, verifique los datos.", 
        "error"
      );
    } else {
      // Cualquier otro error común (conexión, base de datos, etc.)
      mostrarMensajeEnfermeria("No se pudo guardar el registro: " + err.message, "error");
    }

  } finally {
    btn.disabled = false;
    btn.textContent = "Guardar y enviar a consulta";
  }
}

function mostrarMensajeEnfermeria(texto, tipo) {
  const el = document.getElementById("mensaje-enfermeria");
  if (!el) return;
  el.textContent = texto;
  el.className = `mensaje visible mensaje-${tipo}`;
}

function ocultarMensajeEnfermeria() {
  const el = document.getElementById("mensaje-enfermeria");
  if (el) el.classList.remove("visible");
}
