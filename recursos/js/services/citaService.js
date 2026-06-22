// ============================================================================
// SERVICIO: CITAS Y TURNOS
// Cubre: CU-02 (Asignar Turno Automático), CU-12 (Agenda Médica),
//        CU-13 (Agendar/Consultar/Cancelar Citas del Paciente)
// ============================================================================

const citaService = {
  // ---------------------------------------------------------------------
  // CU-02: Turnos del día (admisión → triaje)
  // ---------------------------------------------------------------------

  /** Genera el siguiente turno automático del día y deriva al servicio elegido. */
  async generarTurno(pacienteId, servicioSolicitado) {
    const { data: siguienteData, error: errorFn } = await supabaseClient.rpc(
      "siguiente_numero_turno"
    );
    if (errorFn) throw errorFn;

    const { data, error } = await supabaseClient
      .from("turnos")
      .insert([{
        numero_turno: siguienteData,
        paciente_id: pacienteId,
        servicio_solicitado: servicioSolicitado,
        estado: "en_espera",
      }])
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  /** Lista los turnos del día actual, ordenados por número (orden de llegada). */
  async listarTurnosDelDia() {
    const hoy = new Date().toISOString().split("T")[0];
    const { data, error } = await supabaseClient
      .from("turnos")
      .select(`id, numero_turno, servicio_solicitado, estado,
               pacientes:paciente_id ( dni, nombres, apellidos )`)
      .eq("fecha", hoy)
      .order("numero_turno", { ascending: true });

    if (error) throw error;
    return data || [];
  },

  // ---------------------------------------------------------------------
  // CU-12: Agenda del personal médico (administrador)
  // ---------------------------------------------------------------------

  async listarHorariosMedico(medicoId) {
    const { data, error } = await supabaseClient
      .from("horarios_medicos")
      .select("*, especialidades:especialidad_id ( nombre )")
      .eq("medico_id", medicoId)
      .order("dia_semana", { ascending: true });

    if (error) throw error;
    return data || [];
  },

  async listarMedicos() {
    const { data, error } = await supabaseClient
      .from("usuarios")
      .select("id, nombre_completo, especialidad")
      .eq("rol", "medico")
      .eq("activo", true);

    if (error) throw error;
    return data || [];
  },

  async listarEspecialidades() {
    const { data, error } = await supabaseClient.from("especialidades").select("*");
    if (error) throw error;
    return data || [];
  },

  async definirHorario(datos) {
    const { data, error } = await supabaseClient
      .from("horarios_medicos")
      .insert([{
        medico_id: datos.medicoId,
        especialidad_id: datos.especialidadId,
        dia_semana: datos.diaSemana,
        hora_inicio: datos.horaInicio,
        hora_fin: datos.horaFin,
        duracion_cita_minutos: datos.duracion || 20,
      }])
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  /** Bloquea o habilita un horario ante una contingencia. */
  async cambiarEstadoHorario(horarioId, estado, motivo = null) {
    const { error } = await supabaseClient
      .from("horarios_medicos")
      .update({ estado, motivo_bloqueo: motivo })
      .eq("id", horarioId);

    if (error) throw error;
  },

  // ---------------------------------------------------------------------
  // CU-13: Citas del paciente (agendar / consultar / cancelar)
  // ---------------------------------------------------------------------

  async listarHorariosDisponibles(medicoId, fecha) {
    // Trae las citas ya ocupadas de ese médico en esa fecha
    const { data: ocupadas, error: errorOcupadas } = await supabaseClient
      .from("citas")
      .select("hora")
      .eq("medico_id", medicoId)
      .eq("fecha", fecha)
      .neq("estado", "cancelada");

    if (errorOcupadas) throw errorOcupadas;

    const horasOcupadas = (ocupadas || []).map((c) => c.hora);

    // Genera horarios cada 20 min entre 8:00 y 16:00 como ejemplo simple
    const disponibles = [];
    for (let h = 8; h < 16; h++) {
      for (let m = 0; m < 60; m += 20) {
        const hora = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00`;
        if (!horasOcupadas.includes(hora)) disponibles.push(hora);
      }
    }
    return disponibles;
  },

  async agendarCita(datos) {
    const { data, error } = await supabaseClient
      .from("citas")
      .insert([{
        paciente_id: datos.pacienteId,
        medico_id: datos.medicoId,
        especialidad_id: datos.especialidadId,
        fecha: datos.fecha,
        hora: datos.hora,
        estado: "programada",
      }])
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async listarCitasPaciente(pacienteId) {
    const { data, error } = await supabaseClient
      .from("citas")
      .select(`id, fecha, hora, estado,
               usuarios:medico_id ( nombre_completo ),
               especialidades:especialidad_id ( nombre )`)
      .eq("paciente_id", pacienteId)
      .order("fecha", { ascending: true });

    if (error) throw error;
    return data || [];
  },

  async cancelarCita(citaId) {
    const { error } = await supabaseClient
      .from("citas")
      .update({ estado: "cancelada" })
      .eq("id", citaId);

    if (error) throw error;
  },

  // ---------------------------------------------------------------------
  // HU-11: Supervisión en tiempo real (Encargado del Centro)
  // ---------------------------------------------------------------------

  async obtenerIndicadoresDashboard() {
    const { data, error } = await supabaseClient
      .from("dashboard_indicadores")
      .select("*")
      .order("fecha", { ascending: false })
      .limit(30);

    if (error) throw error;
    return data || [];
  },
};
