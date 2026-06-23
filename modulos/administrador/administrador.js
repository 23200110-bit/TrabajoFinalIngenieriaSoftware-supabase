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

  if (document.getElementById("calendario-semanal-body")) {
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
        <td><span class="badge badge-info">${u.rol}</span></td>
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
    const { error } = await supabaseClient
      .from("usuarios")
      .delete()
      .eq("id", usuarioId);

    if (error) throw error;
    await cargarUsuarios();
    alert(`✅ La cuenta de "${nombreCompleto}" ha sido removida.`);
  } catch (err) {
    console.error("Error al eliminar usuario:", err);
    alert("❌ No se pudo eliminar el usuario: " + err.message);
  }
}

// ---------------------------------------------------------------------------
// CU-12: Gestionar Agenda del Personal Médico (Múltiple Selección & Vista Matriz)
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
    const { data: especialidades } = await supabaseClient.from("especialidades").select("*");
    select.innerHTML = especialidades.map((e) => `<option value="${e.id}">${e.nombre}</option>`).join("");
  } catch (err) {
    select.innerHTML = `<option>Error al cargar especialidades</option>`;
  }
}

async function definirHorario(event) {
  event.preventDefault();
  ocultarMensajeAdmin();

  const checkboxes = document.querySelectorAll('input[name="dias-agenda"]:checked');
  const diasSeleccionados = Array.from(checkboxes).map(cb => parseInt(cb.value));

  if (diasSeleccionados.length === 0) {
    mostrarMensajeAdmin("❌ Debes seleccionar al menos un día para configurar el horario.", "error");
    return;
  }

  const horaInicio = document.getElementById("campo-hora-inicio").value;
  const horaFin = document.getElementById("campo-hora-fin").value;

  if (horaInicio >= horaFin) {
    mostrarMensajeAdmin("La hora de inicio debe ser anterior a la hora de fin.", "error");
    return;
  }

  const medicoId = document.getElementById("select-medico-agenda").value;
  const especialidadId = document.getElementById("select-especialidad-agenda").value;

  try {
    // 1. OBTENER HORARIOS EXISTENTES DEL MÉDICO PARA VALIDAR CONFLICTOS
    const { data: horariosExistentes, error: errorFetch } = await supabaseClient
      .from("horarios_medicos")
      .select("dia_semana, hora_inicio, hora_fin")
      .eq("medico_id", medicoId);

    if (errorFetch) throw errorFetch;

    // Helper para convertir "HH:MM" a minutos totales del día
    const aMinutos = (h) => {
      const [horas, minutos] = h.split(':').map(Number);
      return horas * 60 + minutos;
    };

    const nuevoInicio = aMinutos(horaInicio);
    const nuevoFin = aMinutos(horaFin);

    // 2. COMPROBAR CRUCE DE HORARIOS DÍA POR DÍA
    let diasConConflicto = [];

    for (const dia of diasSeleccionados) {
      const tieneConflicto = horariosExistentes.some(h => {
        if (h.dia_semana !== dia) return false;

        const existenteInicio = aMinutos(h.hora_inicio);
        const existenteFin = aMinutos(h.hora_fin);

        // Fórmula matemática clásica de solapamiento de rangos de tiempo:
        // El nuevo rango inicia antes de que termine el viejo Y termina después de que inicie el viejo
        return nuevoInicio < existenteFin && nuevoFin > existenteInicio;
      });

      if (tieneConflicto) {
        diasConConflicto.push(DIAS_SEMANA[dia]);
      }
    }

    // 3. SI HAY CONFLICTOS, DETENER EL FLUJO Y MOSTRAR ALERTA (Requerimiento)
    if (diasConConflicto.length > 0) {
      alert(`🚨 ¡Conflicto de programación detectado!\n\nEl médico seleccionado ya tiene turnos asignados que se cruzan con el rango ${horaInicio} - ${horaFin} los siguientes días:\n• ${diasConConflicto.join("\n• ")}\n\nPor favor, corrija la programación.`);
      mostrarMensajeAdmin("❌ Conflicto de horarios. Por favor revise el calendario.", "error");
      return;
    }

    // 4. SI NO HAY CONFLICTOS, PROCEDER CON LA INSERCIÓN LIMPIA
    for (const dia of diasSeleccionados) {
      await supabaseClient.from("horarios_medicos").insert([{
        medico_id: medicoId,
        especialidad_id: especialidadId,
        dia_semana: dia,
        hora_inicio: horaInicio,
        hora_fin: horaFin
      }]);
    }

    mostrarMensajeAdmin(`✅ Combinación de horarios asignada correctamente para ${diasSeleccionados.length} días.`, "exito");
    document.getElementById("form-definir-horario").reset();
    
    await cargarTablaAgendas();
  } catch (err) {
    mostrarMensajeAdmin("No se pudo guardar la configuración: " + err.message, "error");
  }
}

async function cargarTablaAgendas() {
  const tbody = document.getElementById("calendario-semanal-body");
  if (!tbody) return;

  try {
    const { data: todosLosHorarios, error } = await supabaseClient
      .from("horarios_medicos")
      .select(`
        id, dia_semana, hora_inicio, hora_fin, estado,
        usuarios ( nombre_completo ),
        especialidades ( nombre )
      `);

    if (error) throw error;

    const tituloTarjeta = tbody.closest('.tarjeta')?.querySelector('.tarjeta-titulo') || document.querySelector('.tarjeta-titulo');
    if (tituloTarjeta) {
      tituloTarjeta.style.display = "flex";
      tituloTarjeta.style.justifyContent = "space-between";
      tituloTarjeta.style.alignItems = "center";
      
      tituloTarjeta.innerHTML = `<span>🗓️ Calendario Semanal y Distribución de Bloques</span>`;
      
      const botonLimpiar = document.createElement("button");
      botonLimpiar.id = "btn-limpiar-todo";
      botonLimpiar.type = "button";
      botonLimpiar.className = "btn";
      botonLimpiar.style.cssText = "background-color: #fee2e2; color: #dc2626; border: 1px solid #fca5a5; padding: 4px 10px; font-size: 12px; cursor: pointer; border-radius: 4px; font-weight: 500;";
      botonLimpiar.innerText = "💥 Limpiar Horario Completo";
      
      botonLimpiar.addEventListener("click", (e) => {
        e.preventDefault();
        eliminarTodasLasAgendas();
      });
      
      tituloTarjeta.appendChild(botonLimpiar);
    }

    const bloquesHorarios = [
      { etiqueta: "08:00 - 09:00", inicio: "08:00", fin: "09:00" },
      { etiqueta: "09:00 - 10:00", inicio: "09:00", fin: "10:00" },
      { etiqueta: "10:00 - 11:00", inicio: "10:00", fin: "11:00" },
      { etiqueta: "11:00 - 12:00", inicio: "11:00", fin: "12:00" },
      { etiqueta: "12:00 - 13:00", inicio: "12:00", fin: "13:00" },
      { etiqueta: "13:00 - 14:00", inicio: "13:00", fin: "14:00" },
      { etiqueta: "14:00 - 15:00", inicio: "14:00", fin: "15:00" },
      { etiqueta: "15:00 - 16:00", inicio: "15:00", fin: "16:00" },
      { etiqueta: "16:00 - 17:00", inicio: "16:00", fin: "17:00" },
      { etiqueta: "17:00 - 18:00", inicio: "17:00", fin: "18:00" },
      { etiqueta: "18:00 - 19:00", inicio: "18:00", fin: "19:00" },
      { etiqueta: "19:00 - 20:00", inicio: "19:00", fin: "20:00" }
    ];

    tbody.innerHTML = "";

    bloquesHorarios.forEach(bloque => {
      const fila = document.createElement("tr");
      fila.style.borderBottom = "1px solid var(--color-borde)";

      const celdaHora = document.createElement("td");
      celdaHora.style.cssText = "padding: 10px; text-align: center; background-color: #f8fafc; font-weight: bold; border-right: 1px solid var(--color-borde); color: var(--color-primario); font-size: 13px;";
      celdaHora.innerText = block => bloque.etiqueta; // Corrección menor para consistencia
      celdaHora.innerText = bloque.etiqueta;
      fila.appendChild(celdaHora);

      for (let dia = 1; dia <= 7; dia++) {
        const agendasEnCelda = todosLosHorarios.filter(a => {
          if (a.dia_semana !== dia) return false;
          
          const parsearAMinutos = (h) => {
            const [horas, minutos] = h.split(':').map(Number);
            return horas * 60 + minutos; // <-- ¡Fijo en español "minutos"!
          };

          const medicoInicio = parsearAMinutos(a.hora_inicio);
          const medicoFin = parsearAMinutos(a.hora_fin);
          const bloqueInicio = parsearAMinutos(bloque.inicio);
          const bloqueFin = parsearAMinutos(bloque.fin);

          return medicoInicio < bloqueFin && medicoFin > bloqueInicio;
        });

        const celdaDia = document.createElement("td");
        celdaDia.className = "celda-dia";
        celdaDia.style.cssText = `background-color: ${agendasEnCelda.length > 0 ? (agendasEnCelda[0].estado === 'bloqueado' ? '#f1f5f9' : '#f0fdf4') : 'white'}; padding: 5px; height: auto;`;

        if (agendasEnCelda.length > 0) {
          agendasEnCelda.forEach(a => {
            const esBloqueado = a.estado === 'bloqueado';
            const contenedorTarjeta = document.createElement("div");
            contenedorTarjeta.className = "bloque-tarjeta-medico";
            contenedorTarjeta.style.cssText = `border-left: 3px solid ${esBloqueado ? '#94a3b8' : 'var(--color-primario)'}; margin-bottom: 4px; padding: 6px; background-color: ${esBloqueado ? '#f8fafc' : '#ffffff'}; border-radius: 4px; box-shadow: 0 1px 2px rgba(0,0,0,0.05); ${esBloqueado ? 'opacity: 0.85;' : ''}`;

            contenedorTarjeta.innerHTML = `
              <strong style="color: ${esBloqueado ? '#64748b' : '#0f172a'}; font-size: 11px; display: block; ${esBloqueado ? 'text-decoration: line-through;' : ''}">${a.usuarios?.nombre_completo || 'Médico'}</strong>
              <span style="color: #64748b; font-size: 10px; display: block;">🩺 ${a.especialidades?.nombre || "—"}</span>
              <span style="color: #475569; font-size: 10px; display: block; margin: 2px 0;">🕒 ${a.hora_inicio.substring(0,5)} - ${a.hora_fin.substring(0,5)}</span>
              ${esBloqueado ? '<span style="color: #ef4444; font-size: 9px; font-weight: bold; display: block; margin-bottom: 2px;">⚠️ BLOQUEADO</span>' : ''}
            `;

            const filaAcciones = document.createElement("div");
            filaAcciones.style.cssText = "display: flex; gap: 4px; margin-top: 5px;";

            const botonBloquear = document.createElement("button");
            botonBloquear.type = "button";
            botonBloquear.className = "btn";
            botonBloquear.style.cssText = `flex: 1; font-size: 9px; padding: 3px 4px; background-color: ${esBloqueado ? '#e0f2fe' : '#fef3c7'}; color: ${esBloqueado ? '#0369a1' : '#b45309'}; border: 1px solid ${esBloqueado ? '#7dd3fc' : '#fde68a'}; cursor: pointer; border-radius: 3px; font-weight: 600;`;
            botonBloquear.innerText = esBloqueado ? "🔓 Activar" : "🚫 Bloquear";
            botonBloquear.addEventListener("click", () => {
              alternarBloqueoHorario(a.id, a.estado);
            });

            const botonEliminar = document.createElement("button");
            botonEliminar.type = "button";
            botonEliminar.className = "btn";
            botonEliminar.style.cssText = "flex: 1; font-size: 9px; padding: 3px 4px; background-color: #fee2e2; color: #dc2626; border: 1px solid #fca5a5; cursor: pointer; border-radius: 3px; font-weight: 600;";
            botonEliminar.innerText = "🗑️ Quitar";
            botonEliminar.addEventListener("click", () => {
              eliminarHorarioUnico(a.id, a.usuarios?.nombre_completo || 'Médico');
            });

            filaAcciones.appendChild(botonBloquear);
            filaAcciones.appendChild(botonEliminar);
            contenedorTarjeta.appendChild(filaAcciones);
            celdaDia.appendChild(contenedorTarjeta);
          });
        } else {
          celdaDia.innerHTML = `<span style="color: #cbd5e1; font-size: 11px; display: block; text-align: center; margin-top: 5px;">—</span>`;
        }
        fila.appendChild(celdaDia);
      }
      tbody.appendChild(fila);
    });

  } catch (err) {
    console.error("Error al generar matriz de horarios:", err);
    tbody.innerHTML = `<tr><td colspan="8" class="estado-vacio">Error al procesar el calendario semanal.</td></tr>`;
  }
}

async function alternarBloqueoHorario(horarioId, estadoActual) {
  const nuevoEstado = estadoActual === 'bloqueado' ? 'disponible' : 'bloqueado';
  const mensajeAccion = nuevoEstado === 'bloqueado' 
    ? "⚠️ ¿Deseas bloquear temporalmente este turno por contingencia (licencia/vacaciones/emergencia)?" 
    : "🔓 ¿Deseas levantar el bloqueo de contingencia de este turno?";

  if (!confirm(mensajeAccion)) return;

  try {
    const { error } = await supabaseClient
      .from("horarios_medicos")
      .update({ estado: nuevoEstado })
      .eq("id", horarioId);

    if (error) throw error;
    mostrarMensajeAdmin(`Turno ${nuevoEstado === 'bloqueado' ? 'bloqueado' : 'reactivado'} con éxito.`, "exito");
    await cargarTablaAgendas();
  } catch (err) {
    alert("No se pudo modificar el estado del turno: " + err.message);
  }
}

async function eliminarHorarioUnico(horarioId, medicoNombre) {
  const confirmar = confirm(`⚠️ ¿Estás seguro de eliminar este horario?`);
  if (!confirmar) return;

  try {
    const { error } = await supabaseClient
      .from("horarios_medicos") 
      .delete()
      .eq("id", horarioId);

    if (error) throw error;
    mostrarMensajeAdmin("Horario eliminado correctamente.", "exito");
    await cargarTablaAgendas(); 
  } catch (err) {
    alert("No se pudo eliminar: " + err.message);
  }
}

async function eliminarTodasLasAgendas() {
  const confirmar = confirm("🚨 ¿Estás seguro de borrar TODO el horario semanal?");
  if (!confirmar) return;

  try {
    const { error } = await supabaseClient
      .from("horarios_medicos")
      .delete()
      .neq("id", "00000000-0000-0000-0000-000000000000");

    if (error) throw error;
    alert("🗑️ Todo el horario semanal ha sido limpiado.");
    await cargarTablaAgendas();
  } catch (err) {
    alert("❌ Error al limpiar los horarios: " + err.message);
  }
}

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