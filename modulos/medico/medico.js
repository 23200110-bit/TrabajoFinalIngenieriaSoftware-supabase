// ============================================================================
// MÓDULO: MÉDICO
// Cubre: CU-04 (Historia Clínica), CU-05 (Diagnóstico y Receta Digital)
// ============================================================================

let usuarioSesion = null;
let consultaActivaId = null;
let pacienteActivoId = null;
let medicamentosAgregados = [];

document.addEventListener("DOMContentLoaded", async () => {
  usuarioSesion = await protegerPagina(["medico", "administrador"]);
  if (!usuarioSesion) return;

  construirLayout(usuarioSesion, window.location.pathname);

  // CARGA AUTOMÁTICA DE LA COLA MÉDICA
  if (document.getElementById("cola-medica-body")) {
    await cargarColaMedica();
  }

  if (document.getElementById("form-diagnostico")) {
    inicializarDiagnosticoReceta();
  }

  if (document.getElementById("form-buscar-historia")) {
    document.getElementById("form-buscar-historia").addEventListener("submit", buscarHistoriaClinica);
  }
});

// ---------------------------------------------------------------------------
// CU-04: Visualizar Historia Clínica Cronológica (Desde buscador manual antiguo)
// ---------------------------------------------------------------------------
async function buscarHistoriaClinica(event) {
  event.preventDefault();
  const dni = document.getElementById("campo-dni-historia").value.trim();
  const contenedor = document.getElementById("resultado-historia");

  contenedor.innerHTML = `<p class="texto-suave">Buscando...</p>`;

  try {
    const paciente = await pacienteService.buscarPorDni(dni);
    if (!paciente) {
      contenedor.innerHTML = `<div class="mensaje visible mensaje-error">No se encontró un paciente con ese DNI.</div>`;
      return;
    }
    await renderizarHistorialHtml(paciente, contenedor);
  } catch (err) {
    contenedor.innerHTML = `<div class="mensaje visible mensaje-error">Error: ${err.message}</div>`;
  }
}

// ---------------------------------------------------------------------------
// ✨ NUEVO: Abrir Historia Clínica en una Pantalla Flotante (Sub-pantalla modal)
// ---------------------------------------------------------------------------
async function verHistorialEnModal(pacienteId) {
  const modal = document.getElementById("modal-historia");
  const titulo = document.getElementById("modal-historia-titulo");
  const contenido = document.getElementById("modal-historia-contenido");

  contenido.innerHTML = `<p class="texto-suave">Cargando historial médico completo...</p>`;
  modal.style.display = "flex";

  try {
    // Obtenemos los datos del paciente de forma directa a través de tu servicio estructurado
    const { data: paciente, error } = await supabaseClient
      .from("pacientes")
      .select("*")
      .eq("id", pacienteId)
      .single();

    if (error) throw error;

    titulo.textContent = `📋 Historial de ${paciente.nombres} ${paciente.apellidos}`;
    await renderizarHistorialHtml(paciente, contenido);

  } catch (err) {
    contenido.innerHTML = `<div class="mensaje visible mensaje-error">Error al cargar historial: ${err.message}</div>`;
  }
}

function cerrarModalHistoria() {
  document.getElementById("modal-historia").style.display = "none";
}

// Helper para procesar y armar el contenido clínico sin duplicar código
// Helper para procesar y armar el contenido clínico sin duplicar código
async function renderizarHistorialHtml(paciente, elementoDestino) {
  // 1. Jalamos todas las consultas y triajes de la base de datos
  const { consultas: todasLasConsultas, triajes } = await pacienteService.obtenerHistoriaClinica(paciente.id);

  // ✨ FILTRO SENIOR: Filtramos la lista para quedarnos ÚNICAMENTE con las consultas finalizadas ("cerrada")
  const consultas = todasLasConsultas.filter(c => c.estado === "cerrada");

  let seccionConsultasHtml = "";

  // 2. Si después de filtrar la lista quedó vacía, significa que es un paciente nuevo sin consultas completadas
  if (consultas.length === 0) {
    seccionConsultasHtml = `
      <div class="mensaje visible mensaje-alerta" style="margin-top:10px; margin-bottom:14px;">
        ⚠️ Sin historial clínico. El paciente no registra diagnósticos ni recetas previas terminadas en el sistema.
      </div>`;
  } else {
    // 3. Si tiene consultas cerradas, las dibujamos ordenadamente en tarjetas limpias
    seccionConsultasHtml = `
      <div style="display:flex; flex-direction:column; gap:14px; margin-bottom:14px;">
        ${consultas
          .map(
            (c) => `
          <div style="padding:14px; background: #fdfdfd; border:1px solid var(--color-borde); border-radius:6px;">
            <div class="flex-entre" style="margin-bottom:6px;">
              <span style="font-size:12px; color:var(--color-texto-suave);">📅 <strong>${formatearFechaHora(c.fecha)}</strong></span>
              <span class="badge badge-exito">Finalizada</span>
            </div>
            <p style="font-size:13px; margin:2px 0 8px 0; color:var(--color-texto-suave);">Médico: ${c.usuarios?.nombre_completo || "—"}</p>
            <div style="margin-top:6px; font-size:14px;">
              <strong>Diagnóstico:</strong> ${c.diagnostico || "Sin diagnóstico registrado"}
            </div>
            ${c.observaciones ? `<div style="margin-top:4px; font-size:13px; color:var(--color-texto-suave);"><strong>Observaciones:</strong> ${c.observaciones}</div>` : ""}
          </div>
        `
          )
          .join("")}
      </div>`;
  }

  // 4. Cargamos la sección de Signos Vitales (Triaje) de forma independiente abajo
  let seccionTriajeHtml = "";
  if (triajes && triajes.length > 0) {
    seccionTriajeHtml = `
      <div style="padding:12px; background:#f4f7fc; border-radius:6px; border-left: 4px solid var(--color-primario);">
        <strong style="font-size:13px; color:var(--color-primario);">🩺 Últimos Signos Vitales Registrados (Triaje):</strong>
        <p style="font-size:13px; margin:6px 0 0 0; line-height:1.4;">
          Presión Arterial: <strong>${triajes[0].presion_arterial || '—'}</strong> | Temperatura: <strong>${triajes[0].temperatura_c || '—'}°C</strong><br>
          Peso: <strong>${triajes[0].peso_kg || '—'}kg</strong> | Talla: <strong>${triajes[0].talla_cm || '—'}cm</strong> | Prioridad: <strong>${triajes[0].prioridad || 'Baja'}</strong>
        </p>
      </div>`;
  } else {
    seccionTriajeHtml = `
      <div class="mensaje visible mensaje-error" style="margin-top:6px;">
        ❌ No se encontraron signos vitales registrados en triaje para este paciente.
      </div>`;
  }

  // 5. Inyectamos las dos secciones juntas en la pantalla
  elementoDestino.innerHTML = `
    <div style="margin-bottom: 16px; font-size:13px; color:var(--color-texto-suave); border-bottom:1px solid var(--color-borde); padding-bottom:8px;">
      DNI: <strong>${paciente.dni}</strong> · Seguro: <strong>${paciente.tipo_seguro || "No registrado"}</strong>
    </div>
    ${seccionConsultasHtml}
    ${seccionTriajeHtml}
  `;
}

// ---------------------------------------------------------------------------
// FUNCIÓN COLA: Carga los pacientes que ya tienen Triaje hecho
// ---------------------------------------------------------------------------
async function cargarColaMedica() {
  const tbody = document.getElementById("cola-medica-body");
  if (!tbody) return;

  try {
    const hoyStr = new Date().toLocaleDateString('sv-SE');

    const { data: cola, error } = await supabaseClient
      .from("turnos")
      .select(`
        id,
        numero_turno,
        servicio_solicitado,
        estado,
        fecha,
        pacientes (id, nombres, apellidos, dni, tipo_seguro),
        triaje (id, presion_arterial, temperatura_c, peso_kg, talla_cm, prioridad)
      `)
      .eq("fecha", hoyStr)
      .eq("estado", "en_consulta") 
      .order("numero_turno", { ascending: true });

    if (error) throw error;

    if (!cola || cola.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:20px; color:var(--color-texto-suave);">No hay pacientes triados en espera el día de hoy.</td></tr>`;
      return;
    }

    const prioridadEstilos = {
      alta: { clase: "badge-error", texto: "🔴 Alta" },
      media: { clase: "badge-alerta", texto: "🟡 Media" },
      baja: { clase: "badge-exito", texto: "🟢 Baja" }
    };

    tbody.innerHTML = cola
      .map((t) => {
        const triaje = Array.isArray(t.triaje) ? t.triaje[0] : t.triaje;
        if (!triaje) return ""; 

        const prio = prioridadEstilos[triaje.prioridad] || { clase: "", texto: triaje.prioridad || "Baja" };

        return `
          <tr style="border-bottom: 1px solid var(--color-borde); font-size:14px;">
            <td style="padding: 12px 8px;"><strong>#${t.numero_turno}</strong></td>
            <td style="padding: 12px 8px;">
              <strong>${t.pacientes.nombres} ${t.pacientes.apellidos}</strong><br>
              <span style="font-size:11px; color:var(--color-texto-suave);">DNI: ${t.pacientes.dni}</span>
            </td>
            <td style="padding: 12px 8px;">${t.servicio_solicitado}</td>
            <td style="padding: 12px 8px;"><span class="badge ${prio.clase}">${prio.texto}</span></td>
            <td style="padding: 12px 8px; color: var(--color-texto-suave); font-size:12px; line-height: 1.4;">
              P.A.: <strong>${triaje.presion_arterial || '—'}</strong> | T°: <strong>${triaje.temperatura_c || '—'}°C</strong><br>
              Peso: <strong>${triaje.peso_kg || '—'}kg</strong> | Talla: <strong>${triaje.talla_cm || '—'}cm</strong>
            </td>
            <!-- DOS BOTONES AL COSTADO (ACCIÓN) -->
            <td style="padding: 12px 8px; text-align:right; white-space:nowrap;">
              <button type="button" class="btn btn-secundario btn-sm" onclick="verHistorialEnModal('${t.pacientes.id}')" style="margin-right:6px; padding: 6px 10px;">
                📜 Historial
              </button>
              <a href="diagnostico-receta.html?paciente=${t.pacientes.id}" class="btn btn-primario btn-sm" style="padding: 6px 10px;">
                Atender →
              </a>
            </td>
          </tr>
        `;
      })
      .join("");

  } catch (err) {
    console.error("Error cargando cola médica:", err);
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:20px; color:var(--color-error);">Error al cargar la lista.</td></tr>`;
  }
}

// ---------------------------------------------------------------------------
// CU-05: Registrar Diagnóstico y Generar Receta Digital
// ---------------------------------------------------------------------------
async function inicializarDiagnosticoReceta() {
  const params = new URLSearchParams(window.location.search);
  pacienteActivoId = params.get("paciente");

  if (!pacienteActivoId) {
    document.getElementById("alerta-sin-paciente").style.display = "block";
    document.getElementById("form-diagnostico").style.display = "none";
    return;
  }

  try {
    const consulta = await recetaService.crearConsulta({
      pacienteId: pacienteActivoId,
      medicoId: usuarioSesion.id,
    });
    consultaActivaId = consulta.id;
  } catch (err) {
    mostrarMensajeMedico("No se pudo iniciar la atención: " + err.message, "error");
  }

  await cargarMedicamentosDisponibles();

  document.getElementById("form-diagnostico").addEventListener("submit", guardarConsultaYReceta);
  document.getElementById("btn-agregar-medicamento").addEventListener("click", agregarMedicamentoALista);
}

async function cargarMedicamentosDisponibles() {
  try {
    const medicamentos = await recetaService.listarMedicamentosDisponibles();
    const select = document.getElementById("select-medicamento");
    select.innerHTML = medicamentos
      .map((m) => `<option value="${m.id}">${m.nombre} (${m.presentacion}) — Stock: ${m.stock_actual}</option>`)
      .join("");
  } catch (err) {
    console.error("Error cargando medicamentos:", err);
  }
}

function agregarMedicamentoALista() {
  const select = document.getElementById("select-medicamento");
  const medicamentoId = select.value;
  const nombreTexto = select.options[select.selectedIndex].text;
  const dosis = document.getElementById("campo-dosis").value.trim();
  const frecuencia = document.getElementById("campo-frecuencia").value.trim();
  const duracion = document.getElementById("campo-duracion").value.trim();

  if (!dosis || !frecuencia || !duracion) {
    mostrarMensajeMedico("Completa dosis, frecuencia y duración antes de agregar.", "error");
    return;
  }

  medicamentosAgregados.push({ medicamentoId, nombreTexto, dosis, frecuencia, duracion });
  pintarListaMedicamentos();

  document.getElementById("campo-dosis").value = "";
  document.getElementById("campo-frecuencia").value = "";
  document.getElementById("campo-duracion").value = "";
}

function pintarListaMedicamentos() {
  const cont = document.getElementById("lista-medicamentos-receta");

  if (medicamentosAgregados.length === 0) {
    cont.innerHTML = `<p class="texto-suave">Aún no agregaste medicamentos a la receta.</p>`;
    return;
  }

  cont.innerHTML = medicamentosAgregados
    .map(
      (m, idx) => `
    <div class="flex-entre" style="padding:10px 0; border-bottom:1px solid var(--color-borde);">
      <div>
        <strong>${m.nombreTexto.split(" (")[0]}</strong>
        <p class="texto-suave">${m.dosis} · ${m.frecuencia} · ${m.duracion}</p>
      </div>
      <button type="button" class="btn btn-peligro btn-sm" onclick="quitarMedicamento(${idx})">Quitar</button>
    </div>
  `
    )
    .join("");
}

function quitarMedicamento(idx) {
  medicamentosAgregados.splice(idx, 1);
  pintarListaMedicamentos();
}

async function guardarConsultaYReceta(event) {
  event.preventDefault();
  ocultarMensajeMedico();

  const diagnostico = document.getElementById("campo-diagnostico").value.trim();
  const observaciones = document.getElementById("campo-observaciones").value.trim();
  const btn = document.getElementById("btn-guardar-consulta");

  btn.disabled = true;
  btn.textContent = "Guardando...";

  try {
    // 1. Guarda el diagnóstico en la base de datos de manera normal
    await recetaService.guardarDiagnostico(consultaActivaId, diagnostico, observaciones);

    // 2. Si el médico agregó medicamentos, genera la receta digital
    if (medicamentosAgregados.length > 0) {
      await recetaService.generarReceta(consultaActivaId, pacienteActivoId, medicamentosAgregados);
    }

    // ✨ EL CAMBIO CLAVE: Buscamos el turno de hoy de este paciente y lo cambiamos a 'atendido'
    const hoyStr = new Date().toLocaleDateString('sv-SE'); // Obtiene la fecha de hoy en formato YYYY-MM-DD
    const { error: errorTurno } = await supabaseClient
      .from("turnos")
      .update({ estado: "atendido" }) // Cambiamos el estado para que desaparezca de la cola
      .eq("paciente_id", pacienteActivoId)
      .eq("fecha", hoyStr)
      .eq("estado", "en_consulta");

    // Si ocurre un error actualizando el turno, lo muestra en la consola del navegador para revisarlo
    if (errorTurno) console.error("Aviso: No se pudo cambiar el estado del turno:", errorTurno);

    // 3. Mostramos el mensaje de éxito y reiniciamos la página de consultas
    mostrarMensajeMedico("Consulta cerrada con éxito. El paciente fue retirado de la cola y la receta se envió a farmacia.", "exito");
    setTimeout(() => (window.location.href = "consulta.html"), 1800);
  } catch (err) {
    mostrarMensajeMedico(err.message, "error");
  } finally {
    btn.disabled = false;
    btn.textContent = "Cerrar atención y enviar a farmacia";
  }
}

// ---------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------
function formatearFechaHora(fechaIso) {
  const d = new Date(fechaIso);
  return d.toLocaleString("es-PE", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function mostrarMensajeMedico(texto, tipo) {
  const el = document.getElementById("mensaje-medico");
  if (!el) return;
  el.textContent = texto;
  el.className = `mensaje visible mensaje-${tipo}`;
}

function ocultarMensajeMedico() {
  const el = document.getElementById("mensaje-medico");
  if (el) el.classList.remove("visible");
}