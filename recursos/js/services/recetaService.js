// ============================================================================
// SERVICIO: RECETAS Y FARMACIA
// Cubre: CU-05 (Diagnóstico y Receta Digital), CU-06 (Validar Stock y Entregar)
// ============================================================================

const recetaService = {
  // ---------------------------------------------------------------------
  // CU-05: Médico - diagnóstico y receta
  // ---------------------------------------------------------------------

  async crearConsulta(datos) {
    const { data, error } = await supabaseClient
      .from("consultas")
      .insert([{
        paciente_id: datos.pacienteId,
        medico_id: datos.medicoId,
        turno_id: datos.turnoId || null,
        cita_id: datos.citaId || null,
        diagnostico: null,
        estado: "abierta",
      }])
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  /** Guarda el diagnóstico. Si está vacío, bloquea (flujo alternativo del CU-05). */
  async guardarDiagnostico(consultaId, diagnostico, observaciones) {
    if (!diagnostico || diagnostico.trim() === "") {
      throw new Error("Debe ingresar un diagnóstico para cerrar la atención");
    }

    const { data, error } = await supabaseClient
      .from("consultas")
      .update({ diagnostico, observaciones, estado: "cerrada" })
      .eq("id", consultaId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async listarMedicamentosDisponibles() {
    const { data, error } = await supabaseClient
      .from("medicamentos")
      .select("*")
      .order("nombre", { ascending: true });

    if (error) throw error;
    return data || [];
  },

  async generarReceta(consultaId, pacienteId, listaMedicamentos) {
    const { data: receta, error: errorReceta } = await supabaseClient
      .from("recetas")
      .insert([{ consulta_id: consultaId, paciente_id: pacienteId, estado: "pendiente" }])
      .select()
      .single();

    if (errorReceta) throw errorReceta;

    const detalles = listaMedicamentos.map((m) => ({
      receta_id: receta.id,
      medicamento_id: m.medicamentoId,
      dosis: m.dosis,
      frecuencia: m.frecuencia,
      duracion: m.duracion,
      entregado: false,
    }));

    const { error: errorDetalle } = await supabaseClient
      .from("receta_detalle")
      .insert(detalles);

    if (errorDetalle) throw errorDetalle;
    return receta;
  },

  // ---------------------------------------------------------------------
  // CU-06: Farmacia - validar stock y entregar
  // ---------------------------------------------------------------------

  async buscarRecetasPendientesPorDni(dni) {
    const { data: paciente, error: errorPaciente } = await supabaseClient
      .from("pacientes")
      .select("id, nombres, apellidos, dni")
      .eq("dni", dni)
      .maybeSingle();

    if (errorPaciente) throw errorPaciente;
    if (!paciente) return null;

    const { data: recetas, error: errorRecetas } = await supabaseClient
      .from("recetas")
      .select(`
        id, estado, creado_en,
        receta_detalle (
          id, dosis, frecuencia, duracion, entregado,
          medicamentos:medicamento_id ( id, nombre, presentacion, stock_actual )
        )
      `)
      .eq("paciente_id", paciente.id)
      .eq("estado", "pendiente")
      .order("creado_en", { ascending: false });

    if (errorRecetas) throw errorRecetas;
    return { paciente, recetas: recetas || [] };
  },

  /** Marca un medicamento de la receta como entregado (el trigger descuenta stock solo). */
  async marcarMedicamentoEntregado(detalleId) {
    const { error } = await supabaseClient
      .from("receta_detalle")
      .update({ entregado: true })
      .eq("id", detalleId);

    if (error) throw error;
  },

  /** Si todos los medicamentos de una receta están entregados, cierra la receta. */
  async cerrarRecetaSiCompleta(recetaId) {
    const { data: detalles, error } = await supabaseClient
      .from("receta_detalle")
      .select("entregado")
      .eq("receta_id", recetaId);

    if (error) throw error;

    const todoEntregado = detalles.every((d) => d.entregado);
    if (todoEntregado) {
      await supabaseClient.from("recetas").update({ estado: "entregada" }).eq("id", recetaId);
    }
    return todoEntregado;
  },

  // ---------------------------------------------------------------------
  // HU-07: Alertas de stock bajo
  // ---------------------------------------------------------------------

  async listarMedicamentosStockBajo() {
    const { data, error } = await supabaseClient
      .from("medicamentos")
      .select("*")
      .order("stock_actual", { ascending: true });

    if (error) throw error;
    // Filtramos en cliente porque comparar dos columnas no es directo en el query builder
    return (data || []).filter((m) => m.stock_actual <= m.stock_minimo);
  },

  async actualizarStock(medicamentoId, nuevoStock) {
    const { error } = await supabaseClient
      .from("medicamentos")
      .update({ stock_actual: nuevoStock })
      .eq("id", medicamentoId);

    if (error) throw error;
  },
};
