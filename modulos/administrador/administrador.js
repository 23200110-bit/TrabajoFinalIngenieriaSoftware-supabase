// ============================================================================
// MÓDULO: ADMINISTRADOR
// Cubre: CU-09 (Gestionar Cuentas de Usuario y Roles),
//        CU-12 (Gestionar Agenda del Personal Médico)
// ============================================================================

let usuarioSesion = null;

document.addEventListener("DOMContentLoaded", async () => {
  usuarioSesion = await protegerPagina(["administrador"]);
  if (!usuarioSesion) return;

  construirLayout(usuarioSesion, window.location.pathname);

  if (document.getElementById("tabla-usuarios-body")) {
    await cargarUsuarios();
  }

  if (document.getElementById("tabla-agendas-body")) {
    await inicializarAgendas();
  }
});

// ---------------------------------------------------------------------------
// CU-09: Gestionar Cuentas de Usuario y Roles
// ---------------------------------------------------------------------------
async function cargarUsuarios() {
  const tbody = document.getElementById("tabla-usuarios-body");

  try {
    const { data: usuarios, error } = await supabaseClient
      .from("usuarios")
      .select("*")
      .order("creado_en", { ascending: false });

    if (error) throw error;

    if (usuarios.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" class="estado-vacio">No hay usuarios registrados.</td></tr>`;
      return;
    }

    tbody.innerHTML = usuarios
      .map(
        (u) => `
      <tr>
        <td><strong>${u.nombre_completo}</strong></td>
        <td>${u.dni || "—"}</td>
        <td style="color: var(--color-texto-suave); font-size: 13px;">${u.correo || u.email || "—"}</td>
        <td><span class="badge badge-info">${formatearRol(u.rol)}</span></td>
        <td>${u.activo ? '<span class="badge badge-exito">Activo</span>' : '<span class="badge badge-error">Inactivo</span>'}</td>
        <td style="display: flex; gap: 6px; align-items: center;">
          <button class="btn btn-secundario btn-sm" onclick="alternarEstadoUsuario('${u.id}', ${u.activo})">
            ${u.activo ? "Desactivar" : "Activar"}
          </button>
          
          <button class="btn btn-sm" 
                  style="background-color: #fee2e2; color: #dc2626; border: 1px solid #fca5a5; cursor: pointer; border-radius: 4px; padding: 5px 10px; font-weight: 500;" 
                  onclick="eliminarUsuario('${u.id}', '${u.nombre_completo}')">
            🗑️ Eliminar
          </button>
        </td>
      </tr>
    `
      )
      .join("");
  } catch (err) {
    console.error("Error al cargar usuarios:", err);
    tbody.innerHTML = `<tr><td colspan="6" class="estado-vacio">Error al cargar usuarios.</td></tr>`;
  }
}

async function alternarEstadoUsuario(usuarioId, estadoActual) {
  try {
    const { error } = await supabaseClient
      .from("usuarios")
      .update({ activo: !estadoActual })
      .eq("id", usuarioId);

    if (error) throw error;

    mostrarMensajeAdmin("Estado del usuario actualizado correctamente.", "exito");
    await cargarUsuarios();
  } catch (err) {
    mostrarMensajeAdmin("No se pudo actualizar el usuario: " + err.message, "error");
  }
}

async function eliminarUsuario(usuarioId, nombreCompleto) {
  const confirmar = confirm(`⚠️ ¿Estás seguro de eliminar permanentemente la cuenta de "${nombreCompleto}"?\nEsta acción limpiará el registro del sistema.`);
  if (!confirmar) return;

  try {
    // 1. Borramos el registro SOLO de la tabla pública "usuarios"
    const { error } = await supabaseClient
      .from("usuarios")
      .delete()
      .eq("id", usuarioId);

    if (error) throw error;

    // 2. ¡LA MAGIA! Buscamos el botón "Eliminar" que se presionó y borramos su fila del HTML en vivo
    // Buscamos todos los botones de la tabla para encontrar el que corresponde a este usuarioId
    const botones = document.querySelectorAll("#tabla-usuarios-body button");
    botones.forEach(btn => {
      if (btn.getAttribute("onclick") && btn.getAttribute("onclick").includes(usuarioId)) {
        const filaDOM = btn.closest("tr");
        if (filaDOM) {
          filaDOM.remove(); // Desaparece la fila de la pantalla de inmediato
        }
      }
    });

    // 3. Avisamos al administrador
    alert(`✅ La cuenta de "${nombreCompleto}" ha sido removida de la pantalla.`);

  } catch (err) {
    console.error("Error al eliminar usuario:", err);
    alert("❌ No se pudo eliminar el usuario de la pantalla: " + err.message);
  }
}

// ---------------------------------------------------------------------------
// CU-12: Gestionar Agenda del Personal Médico
// ---------------------------------------------------------------------------
const DIAS_SEMANA = ["", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

async function inicializarAgendas() {
  await cargarSelectMedicos();
  await cargarSelectEspecialidades();
  await cargarTablaAgendas();

  document.getElementById("form-definir-horario").addEventListener("submit", definirHorario);
}

async function cargarSelectMedicos() {
  const select = document.getElementById("select-medico-agenda");
  try {
    const medicos = await citaService.listarMedicos();
    select.innerHTML = medicos
      .map((m) => `<option value="${m.id}">${m.nombre_completo} ${m.especialidad ? "— " + m.especialidad : ""}</option>`)
      .join("");
  } catch (err) {
    select.innerHTML = `<option>Error al cargar médicos</option>`;
  }
}

async function cargarSelectEspecialidades() {
  const select = document.getElementById("select-especialidad-agenda");
  try {
    const especialidades = await citaService.listarEspecialidades();
    select.innerHTML = especialidades.map((e) => `<option value="${e.id}">${e.nombre}</option>`).join("");
  } catch (err) {
    select.innerHTML = `<option>Error al cargar especialidades</option>`;
  }
}

async function definirHorario(event) {
  event.preventDefault();
  ocultarMensajeAdmin();

  const datos = {
    medicoId: document.getElementById("select-medico-agenda").value,
    especialidadId: document.getElementById("select-especialidad-agenda").value,
    diaSemana: parseInt(document.getElementById("select-dia-semana").value),
    horaInicio: document.getElementById("campo-hora-inicio").value,
    horaFin: document.getElementById("campo-hora-fin").value,
  };

  if (datos.horaInicio >= datos.horaFin) {
    mostrarMensajeAdmin("La hora de inicio debe ser anterior a la hora de fin.", "error");
    return;
  }

  try {
    await citaService.definirHorario(datos);
    mostrarMensajeAdmin("Horario asignado correctamente.", "exito");
    document.getElementById("form-definir-horario").reset();
    await cargarTablaAgendas();
  } catch (err) {
    mostrarMensajeAdmin("No se pudo guardar el horario: " + err.message, "error");
  }
}

async function cargarTablaAgendas() {
  const tbody = document.getElementById("tabla-agendas-body");

  try {
    const medicos = await citaService.listarMedicos();
    let filas = [];

    for (const medico of medicos) {
      const horarios = await citaService.listarHorariosMedico(medico.id);
      horarios.forEach((h) => {
        filas.push(`
          <tr>
            <td><strong>${medico.nombre_completo}</strong></td>
            <td>${h.especialidades?.nombre || "—"}</td>
            <td>${DIAS_SEMANA[h.dia_semana]}</td>
            <td>${h.hora_inicio} - ${h.hora_fin}</td>
            <td>${
              h.estado === "activo"
                ? '<span class="badge badge-exito">Activo</span>'
                : `<span class="badge badge-error">Bloqueado</span>`
            }</td>
            <td>
              <button class="btn btn-sm ${h.estado === "activo" ? "btn-peligro" : "btn-exito"}"
                onclick="alternarHorario('${h.id}', '${h.estado}')">
                ${h.estado === "activo" ? "Bloquear" : "Habilitar"}
              </button>
            </td>
          </tr>
        `);
      });
    }

    tbody.innerHTML = filas.length
      ? filas.join("")
      : `<tr><td colspan="6" class="estado-vacio">No hay horarios definidos aún.</td></tr>`;
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="6" class="estado-vacio">Error al cargar agendas.</td></tr>`;
  }
}

async function alternarHorario(horarioId, estadoActual) {
  const nuevoEstado = estadoActual === "activo" ? "bloqueado" : "activo";
  const motivo = nuevoEstado === "bloqueado" ? prompt("Motivo del bloqueo (ej. vacaciones, licencia):") : null;

  try {
    await citaService.cambiarEstadoHorario(horarioId, nuevoEstado, motivo);
    mostrarMensajeAdmin(`Horario ${nuevoEstado === "activo" ? "habilitado" : "bloqueado"} correctamente.`, "exito");
    await cargarTablaAgendas();
  } catch (err) {
    mostrarMensajeAdmin("No se pudo actualizar el horario: " + err.message, "error");
  }
}

// ---------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------
function mostrarMensajeAdmin(texto, tipo) {
  const el = document.getElementById("mensaje-admin");
  if (!el) return;
  el.textContent = texto;
  el.className = `mensaje visible mensaje-${tipo}`;
  setTimeout(() => el.classList.remove("visible"), 4000);
}

function ocultarMensajeAdmin() {
  const el = document.getElementById("mensaje-admin");
  if (el) el.classList.remove("visible");
}