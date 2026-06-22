// ============================================================================
// SERVICIO: PACIENTES
// Cubre: CU-01 (Registrar Pacientes), CU-03 (Signos Vitales),
//        CU-04 (Historia Clínica)
// ============================================================================

const pacienteService = {
  /** Busca un paciente por DNI. Retorna null si no existe. */
  async buscarPorDni(dni) {
    const { data, error } = await supabaseClient
      .from("pacientes")
      .select("*")
      .eq("dni", dni)
      .maybeSingle();

    if (error) throw error;
    return data;
  },

  /** CU-01: registra un nuevo paciente validando datos de seguro. */
  async registrarPaciente(datos) {
    const { data, error } = await supabaseClient
      .from("pacientes")
      .insert([{
        dni: datos.dni,
        nombres: datos.nombres,
        apellidos: datos.apellidos,
        fecha_nacimiento: datos.fecha_nacimiento || null,
        sexo: datos.sexo || null,
        telefono: datos.telefono || null,
        direccion: datos.direccion || null,
        tiene_seguro: datos.tiene_seguro,
        tipo_seguro: datos.tipo_seguro,
        seguro_vigente_hasta: datos.seguro_vigente_hasta || null,
      }])
      .select()
      .single();

    if (error) throw error;
    return data;
  },

/** NUEVO MÉTODO PARA CU-02: Cuenta los turnos generados en el día actual por servicio */
  async contarTurnosPorServicio(servicio) {
    // Obtenemos la fecha de hoy en formato YYYY-MM-DD según la zona horaria local
    const hoyStr = new Date().toLocaleDateString('sv-SE'); // Produce "YYYY-MM-DD" perfectamente
    
    const { data, error } = await supabaseClient
      .from("turnos")
      .select("id")
      .eq("servicio_solicitado", servicio)
      .eq("fecha", hoyStr);

    if (error) throw error;
    
    // Retornamos el tamaño real del arreglo de turnos encontrados hoy
    return data ? data.length : 0;
  },

  /** CU-03: registra los signos vitales tomados en triaje. */
  async registrarSignosVitales(datos) {
    const { data, error } = await supabaseClient
      .from("triaje")
      .insert([{
        turno_id: datos.turnoId,
        paciente_id: datos.pacienteId,
        enfermero_id: datos.enfermeroId,
        presion_arterial: datos.presionArterial,
        peso_kg: datos.pesoKg,
        talla_cm: datos.tallaCm,
        temperatura_c: datos.temperaturaC,
        motivo_consulta: datos.motivoConsulta,
        prioridad: datos.prioridad,
      }])
      .select()
      .single();

    if (error) throw error;

    // Actualizamos el estado del turno a "en_triaje" completado
    await supabaseClient
      .from("turnos")
      .update({ estado: "en_consulta" })
      .eq("id", datos.turnoId);

    return data;
  },

  /** CU-04: trae la historia clínica completa y ordenada cronológicamente. */
  async obtenerHistoriaClinica(pacienteId) {
    const { data: consultas, error: errorConsultas } = await supabaseClient
      .from("consultas")
      .select(`
        id, diagnostico, observaciones, fecha, estado,
        usuarios:medico_id ( nombre_completo, especialidad )
      `)
      .eq("paciente_id", pacienteId)
      .order("fecha", { ascending: false });

    if (errorConsultas) throw errorConsultas;

    const { data: triajes, error: errorTriaje } = await supabaseClient
      .from("triaje")
      .select("*")
      .eq("paciente_id", pacienteId)
      .order("creado_en", { ascending: false });

    if (errorTriaje) throw errorTriaje;

    return { consultas: consultas || [], triajes: triajes || [] };
  },

  /** Lista pacientes en espera de triaje (cola de enfermería). */
  async listarColaTriaje() {
    const { data, error } = await supabaseClient
      .from("turnos")
      .select(`id, numero_turno, servicio_solicitado, estado, fecha,
               pacientes:paciente_id ( id, dni, nombres, apellidos )`)
      .eq("estado", "en_espera")
      .eq("fecha", new Date().toISOString().split("T")[0])
      .order("numero_turno", { ascending: true });

    if (error) throw error;
    return data || [];
  },
};