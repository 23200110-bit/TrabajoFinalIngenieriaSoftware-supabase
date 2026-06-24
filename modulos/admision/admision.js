// ============================================================================
// MÓDULO: ADMISIÓN
// Cubre: CU-01 (Registrar Pacientes), CU-02 (Asignar Turno Automático)
// ============================================================================

let usuarioSesion = null;

document.addEventListener("DOMContentLoaded", async () => {
  usuarioSesion = await protegerPagina(["admision", "administrador"]);
  if (!usuarioSesion) return;

  const paginaActual = window.location.pathname;
  construirLayout(usuarioSesion, paginaActual);

  if (document.getElementById("form-registrar-paciente")) {
    inicializarRegistroPaciente();
  }
  if (document.getElementById("form-asignar-turno")) {
    inicializarAsignarTurno();
  }
});

// ---------------------------------------------------------------------------
// CU-01: Registrar Pacientes
// ---------------------------------------------------------------------------
function inicializarRegistroPaciente() {
  document.getElementById("form-registrar-paciente").addEventListener("submit", registrarPaciente);
  document.getElementById("btn-buscar-dni").addEventListener("click", buscarPacientePorDni);
}

async function buscarPacientePorDni() {
  const dni = document.getElementById("campo-dni").value.trim();
  ocultarMensajeAdmision();

  if (dni.length !== 8 || isNaN(dni)) {
    mostrarMensajeAdmision("El DNI debe tener 8 dígitos numéricos.", "error");
    return;
  }

  try {
    const pacienteLocal = await pacienteService.buscarPorDni(dni);

    if (pacienteLocal) {
      mostrarMensajeAdmision(
        `Este paciente ya está registrado localmente. Redirigiendo a turnos...`,
        "alerta"
      );
      localStorage.setItem("paciente_reciente", JSON.stringify(pacienteLocal));
      setTimeout(() => { window.location.href = "asignar-turno.html"; }, 1500);
      return;
    }

    const instanciaSupabase = typeof supabaseClient !== 'undefined' ? supabaseClient : supabase;

    const { data: persona, error } = await instanciaSupabase
      .from('padron_reniec_susalud')
      .select('*')
      .eq('dni', dni)
      .single();

    if (error || !persona) {
      mostrarMensajeAdmision("DNI no válido o no encontrado en el padrón nacional de RENIEC.", "error");
      document.getElementById("seccion-datos-paciente").style.display = "none";
      return;
    }

    document.getElementById("campo-nombres").value = persona.nombres;
    document.getElementById("campo-apellidos").value = persona.apellidos;
    document.getElementById("campo-fecha-nacimiento").value = persona.fecha_nacimiento || '';
    document.getElementById("campo-sexo").value = persona.sexo === 'M' ? 'Masculino' : 'Femenino';
    document.getElementById("campo-telefono").value = persona.telefono || '';
    document.getElementById("campo-direccion").value = persona.direccion || '';
    document.getElementById("campo-tipo-seguro").value = persona.tipo_seguro || 'NINGUNO';
    document.getElementById("campo-seguro-vigencia").value = persona.seguro_vigente_hasta || '';

    const contenedorAlerta = document.getElementById('alerta-seguro-contenedor');
    const inputTieneSeguro = document.getElementById('campo-tiene-seguro');
    
    const hoy = new Date();
    const fechaVencimiento = persona.seguro_vigente_hasta ? new Date(persona.seguro_vigente_hasta) : null;

    if (persona.tiene_seguro && fechaVencimiento && fechaVencimiento >= hoy) {
      if (inputTieneSeguro) inputTieneSeguro.value = "Sí";
      if (contenedorAlerta) {
        contenedorAlerta.innerHTML = `<span style="color: #28a745; font-size: 13px; font-weight: bold;">● Seguro Vigente y Activo</span>`;
      }
      mostrarMensajeAdmision("DNI verificado externamente. Cobertura de seguro activa.", "exito");
    } else {
      if (inputTieneSeguro) inputTieneSeguro.value = "No";
      if (contenedorAlerta) {
        contenedorAlerta.innerHTML = `
          <div style="background-color: #f8d7da; color: #721c24; padding: 8px 12px; border-radius: 4px; border: 1px solid #f5c6cb; font-size: 12.5px; font-weight: bold; margin-top: 5px; display: inline-block; width: 100%; box-sizing: border-box;">
            ⚠️ ALERTA: El paciente no cuenta con cobertura de seguro activa en SUSALUD.
          </div>
        `;
      }
      mostrarMensajeAdmision("DNI verificado. Atención: El seguro se encuentra inactivo o vencido.", "alerta");
    }

    document.getElementById("seccion-datos-paciente").style.display = "block";

  } catch (err) {
    mostrarMensajeAdmision("Error al procesar la validación de identidad: " + err.message, "error");
  }
}

async function registrarPaciente(event) {
  event.preventDefault();
  ocultarMensajeAdmision();

  const btn = document.getElementById("btn-registrar");
  btn.disabled = true;
  btn.textContent = "Guardando...";

  try {
    const textoSexo = document.getElementById("campo-sexo").value;
    const tieneSeguroTexto = document.getElementById("campo-tiene-seguro").value;

    const datos = {
      dni: document.getElementById("campo-dni").value.trim(),
      nombres: document.getElementById("campo-nombres").value.trim(),
      apellidos: document.getElementById("campo-apellidos").value.trim(),
      fecha_nacimiento: document.getElementById("campo-fecha-nacimiento").value || null, 
      sexo: textoSexo === 'Masculino' ? 'M' : 'F',
      telefono: document.getElementById("campo-telefono").value || null,
      direccion: document.getElementById("campo-direccion").value || null,
      tiene_seguro: tieneSeguroTexto === "Sí",
      tipo_seguro: document.getElementById("campo-tipo-seguro").value,
      seguro_vigente_hasta: document.getElementById("campo-seguro-vigencia").value || null,
    };

    const paciente = await pacienteService.registrarPaciente(datos);

    mostrarMensajeAdmision(
      `Paciente registrado correctamente. Redirigiendo a asignación de turnos...`,
      "exito"
    );

    localStorage.setItem("paciente_reciente", JSON.stringify(paciente));

    document.getElementById("campo-dni").value = "";
    document.getElementById("form-registrar-paciente").reset();
    document.getElementById("seccion-datos-paciente").style.display = "none";
    
    setTimeout(() => {
      ocultarMensajeAdmision();
      window.location.href = "asignar-turno.html";
    }, 1500);

  } catch (err) {
    mostrarMensajeAdmision("No se pudo registrar al paciente localmente: " + err.message, "error");
  } finally {
    btn.disabled = false;
    btn.textContent = "Registrar paciente";
  }
  
}

// ---------------------------------------------------------------------------
// CU-02: Asignar Turno Automático y Derivar a Triaje
// ---------------------------------------------------------------------------
let pacienteSeleccionadoGlobal = null;

function inicializarAsignarTurno() {
  document.getElementById("form-asignar-turno").addEventListener("submit", asignarTurno);
  
  const datosPacienteRaw = localStorage.getItem("paciente_reciente");
  if (datosPacienteRaw) {
    pacienteSeleccionadoGlobal = JSON.parse(datosPacienteRaw);
    
    document.getElementById("campo-dni-turno").value = pacienteSeleccionadoGlobal.dni;
    document.getElementById("campo-nombre-completo-turno").value = `${pacienteSeleccionadoGlobal.nombres} ${pacienteSeleccionadoGlobal.apellidos}`;
  } else {
    mostrarMensajeAdmision("No hay ningún paciente seleccionado recientemente. Registre uno primero.", "alerta");
    document.getElementById("btn-asignar-turno").disabled = true;
  }

  cargarTurnosDelDia();
}

async function asignarTurno(event) {
  event.preventDefault();
  ocultarMensajeAdmision();

  if (!pacienteSeleccionadoGlobal) {
    mostrarMensajeAdmision("Falta la referencia del paciente.", "error");
    return;
  }

  // CORREGIDO: Mapeo exacto al ID del select HTML ("campo-servicio")
  const servicio = document.getElementById("campo-servicio").value;
  const btn = document.getElementById("btn-asignar-turno");

  btn.disabled = true;
  btn.textContent = "Generar turno y derivar";

  try {
    // 1. VALIDACIÓN FLUX ALTERNATIVO: Verifica cupos actuales del día
    const totalCuposHoy = await pacienteService.contarTurnosPorServicio(servicio);
    
    if (totalCuposHoy >= 5) {
      mostrarMensajeAdmision(`⚠️ El servicio de ${servicio} no tiene cupos disponibles para el día de hoy (Máximo 5).`, "error");
      btn.disabled = false;
      btn.textContent = "Generar turno y derivar";
      return; // Detiene el guardado por completo
    }

    // 2. Si pasa el candado, inserta el registro normalmente
    const turno = await citaService.generarTurno(pacienteSeleccionadoGlobal.id, servicio);

    document.getElementById("resultado-turno").classList.add("visible");
    document.getElementById("numero-turno-generado").textContent = turno.numero_turno;
    document.getElementById("nombre-paciente-turno").textContent = `${pacienteSeleccionadoGlobal.nombres} ${pacienteSeleccionadoGlobal.apellidos}`;
    document.getElementById("servicio-turno").textContent = servicio;

    localStorage.removeItem("paciente_reciente");
    pacienteSeleccionadoGlobal = null;
    document.getElementById("form-asignar-turno").reset();
    document.getElementById("campo-dni-turno").value = "";
    document.getElementById("campo-nombre-completo-turno").value = "";
    btn.disabled = true;

    cargarTurnosDelDia();
  } catch (err) {
    mostrarMensajeAdmision("No se pudo generar el turno: " + err.message, "error");
    btn.disabled = false;
    btn.textContent = "Generar turno y derivar";
  }
}

async function cargarTurnosDelDia() {
  const tbody = document.getElementById("tabla-turnos-body");
  if (!tbody) return;

  try {
    const turnos = await citaService.listarTurnosDelDia();

    if (turnos.length === 0) {
      tbody.innerHTML = `<tr><td colspan="4" class="estado-vacio">Aún no hay turnos generados hoy.</td></tr>`;
      return;
    }

    tbody.innerHTML = turnos
      .map(
        (t) => `
      <tr>
        <td><strong>#${t.numero_turno}</strong></td>
        <td>${t.pacientes.nombres} ${t.pacientes.apellidos}</td>
        <td>${t.servicio_solicitado}</td>
        <td>${badgeEstadoTurno(t.estado)}</td>
      </tr>
    `
      )
      .join("");
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="4" class="estado-vacio">Error al cargar turnos.</td></tr>`;
  }
}

function badgeEstadoTurno(estado) {
  const mapa = {
    en_espera: '<span class="badge badge-alerta">En espera</span>',
    en_triaje: '<span class="badge badge-info">En triaje</span>',
    en_consulta: '<span class="badge badge-info">En consulta</span>',
    atendido: '<span class="badge badge-exito">Atendido</span>',
    cancelado: '<span class="badge badge-error">Cancelado</span>',
  };
  return mapa[estado] || estado;
}

// Funciones utilitarias estables
function mostrarMensajeAdmision(texto, tipo) {
  const el = document.getElementById("mensaje-admision");
  if (!el) return;
  el.textContent = texto;
  el.className = `mensaje visible mensaje-${tipo}`;
}

function ocultarMensajeAdmision() {
  const el = document.getElementById("mensaje-admision");
  if (el) el.classList.remove("visible");
}

inicializarRegistroPaciente();