// ============================================================================
// MÓDULO: PACIENTE
// Cubre: CU-13 (Agendar, Consultar y Cancelar Citas Médicas)
// ============================================================================

let usuarioSesion = null;
let perfilPacienteId = null;

document.addEventListener("DOMContentLoaded", async () => {
  // El paciente no tiene rol en "usuarios" -> usamos su propia verificación
  const { data: { session } } = await supabaseClient.auth.getSession();

  if (!session) {
    window.location.href = "../../auth/login.html";
    return;
  }

  await cargarPerfilPaciente(session.user.id);
  construirLayoutPaciente();

  if (document.getElementById("form-agendar-cita")) {
    await inicializarAgendarCita();
  }

  if (document.getElementById("tabla-mis-citas-body")) {
    await cargarMisCitas();
  }
});

async function cargarPerfilPaciente(authId) {
  const { data: paciente, error } = await supabaseClient
    .from("pacientes")
    .select("*")
    .eq("auth_id", authId)
    .maybeSingle();

  if (error || !paciente) {
    alert("No se encontró tu perfil de paciente. Contacta a admisión.");
    await supabaseClient.auth.signOut();
    window.location.href = "../../auth/login.html";
    return;
  }

  perfilPacienteId = paciente.id;
  window.pacienteActual = paciente;

  const nombreEl = document.querySelector("[data-usuario-nombre]");
  if (nombreEl) nombreEl.textContent = `${paciente.nombres} ${paciente.apellidos}`;
}

function construirLayoutPaciente() {
  const sidebarMount = document.getElementById("sidebar-mount");
  const navbarMount = document.getElementById("navbar-mount");
  if (!sidebarMount) return;

  const paginaActual = window.location.pathname;
  const items = [
    { texto: "Agendar cita", href: "agendar-cita.html", icono: "📅" },
    { texto: "Mi portal", href: "portal-paciente.html", icono: "🏠" },
  ];

  sidebarMount.innerHTML = `
    <aside class="sidebar">
      <div class="sidebar-marca"><div class="icono">+</div> SDGP Salud</div>
      <div class="sidebar-rol">Portal del Paciente</div>
      <ul class="sidebar-menu">
        ${items
          .map(
            (i) => `<li><a href="${i.href}" class="${paginaActual.includes(i.href) ? "activo" : ""}">
              <span>${i.icono}</span> ${i.texto}</a></li>`
          )
          .join("")}
      </ul>
      <div class="sidebar-pie">
        <button class="btn btn-secundario btn-block btn-sm" onclick="cerrarSesion()">Cerrar sesión</button>
      </div>
    </aside>`;

  navbarMount.innerHTML = `
    <header class="navbar">
      <div></div>
      <div class="navbar-usuario">
        <div class="info-usuario" style="text-align:right;">
          <div class="nombre" data-usuario-nombre>Cargando...</div>
          <div class="rol">Paciente</div>
        </div>
      </div>
    </header>`;
}

// ---------------------------------------------------------------------------
// CU-13: Agendar cita
// ---------------------------------------------------------------------------
async function inicializarAgendarCita() {
  await cargarSelectEspecialidadesPaciente();
  await cargarSelectMedicosPaciente();

  document.getElementById("select-especialidad-cita").addEventListener("change", cargarSelectMedicosPaciente);
  document.getElementById("campo-fecha-cita").addEventListener("change", cargarHorariosDisponiblesPaciente);
  document.getElementById("select-medico-cita").addEventListener("change", cargarHorariosDisponiblesPaciente);
  document.getElementById("form-agendar-cita").addEventListener("submit", confirmarAgendarCita);

  // Fecha mínima: hoy
  document.getElementById("campo-fecha-cita").min = new Date().toISOString().split("T")[0];
}

async function cargarSelectEspecialidadesPaciente() {
  const select = document.getElementById("select-especialidad-cita");
  const especialidades = await citaService.listarEspecialidades();
  select.innerHTML = especialidades.map((e) => `<option value="${e.id}">${e.nombre}</option>`).join("");
}

async function cargarSelectMedicosPaciente() {
  const select = document.getElementById("select-medico-cita");
  const medicos = await citaService.listarMedicos();
  select.innerHTML = medicos.map((m) => `<option value="${m.id}">${m.nombre_completo}</option>`).join("");
  await cargarHorariosDisponiblesPaciente();
}

async function cargarHorariosDisponiblesPaciente() {
  const medicoId = document.getElementById("select-medico-cita").value;
  const fecha = document.getElementById("campo-fecha-cita").value;
  const select = document.getElementById("select-horario-cita");

  if (!medicoId || !fecha) {
    select.innerHTML = `<option value="">Selecciona médico y fecha primero</option>`;
    return;
  }

  try {
    const horarios = await citaService.listarHorariosDisponibles(medicoId, fecha);

    if (horarios.length === 0) {
      select.innerHTML = `<option value="">No hay horarios disponibles para esta fecha</option>`;
      return;
    }

    select.innerHTML = horarios.map((h) => `<option value="${h}">${h.slice(0, 5)}</option>`).join("");
  } catch (err) {
    select.innerHTML = `<option value="">Error al cargar horarios</option>`;
  }
}

async function confirmarAgendarCita(event) {
  event.preventDefault();
  ocultarMensajePaciente();

  const datos = {
    pacienteId: perfilPacienteId,
    medicoId: document.getElementById("select-medico-cita").value,
    especialidadId: document.getElementById("select-especialidad-cita").value,
    fecha: document.getElementById("campo-fecha-cita").value,
    hora: document.getElementById("select-horario-cita").value,
  };

  if (!datos.hora) {
    mostrarMensajePaciente("Selecciona un horario disponible.", "error");
    return;
  }

  try {
    await citaService.agendarCita(datos);
    mostrarMensajePaciente("Tu cita fue agendada correctamente.", "exito");
    document.getElementById("form-agendar-cita").reset();
    setTimeout(() => (window.location.href = "portal-paciente.html"), 1500);
  } catch (err) {
    mostrarMensajePaciente("No se pudo agendar la cita: " + err.message, "error");
  }
}

// ---------------------------------------------------------------------------
// CU-13: Consultar y cancelar citas
// ---------------------------------------------------------------------------
async function cargarMisCitas() {
  const tbody = document.getElementById("tabla-mis-citas-body");

  try {
    const citas = await citaService.listarCitasPaciente(perfilPacienteId);

    if (citas.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" class="estado-vacio">No tienes citas programadas. <a href="agendar-cita.html">Agenda una aquí</a>.</td></tr>`;
      return;
    }

    tbody.innerHTML = citas
      .map(
        (c) => `
      <tr>
        <td>${formatearFechaCita(c.fecha)}</td>
        <td>${c.hora.slice(0, 5)}</td>
        <td>${c.especialidades?.nombre || "—"}</td>
        <td>${c.usuarios?.nombre_completo || "—"}</td>
        <td>
          ${badgeEstadoCita(c.estado)}
          ${
            c.estado === "programada"
              ? `<button class="btn btn-peligro btn-sm" style="margin-left:8px;" onclick="cancelarMiCita('${c.id}')">Cancelar</button>`
              : ""
          }
        </td>
      </tr>
    `
      )
      .join("");
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="5" class="estado-vacio">Error al cargar tus citas.</td></tr>`;
  }
}

async function cancelarMiCita(citaId) {
  if (!confirm("¿Seguro que deseas cancelar esta cita?")) return;

  try {
    await citaService.cancelarCita(citaId);
    mostrarMensajePaciente("Cita cancelada. El horario quedó disponible nuevamente.", "exito");
    await cargarMisCitas();
  } catch (err) {
    mostrarMensajePaciente("No se pudo cancelar la cita: " + err.message, "error");
  }
}

function badgeEstadoCita(estado) {
  const mapa = {
    programada: '<span class="badge badge-info">Programada</span>',
    confirmada: '<span class="badge badge-exito">Confirmada</span>',
    cancelada: '<span class="badge badge-error">Cancelada</span>',
    completada: '<span class="badge badge-exito">Completada</span>',
  };
  return mapa[estado] || estado;
}

function formatearFechaCita(fechaIso) {
  const d = new Date(fechaIso + "T00:00:00");
  return d.toLocaleDateString("es-PE", { weekday: "short", day: "2-digit", month: "short" });
}

function mostrarMensajePaciente(texto, tipo) {
  const el = document.getElementById("mensaje-paciente");
  if (!el) return;
  el.textContent = texto;
  el.className = `mensaje visible mensaje-${tipo}`;
}

function ocultarMensajePaciente() {
  const el = document.getElementById("mensaje-paciente");
  if (el) el.classList.remove("visible");
}
