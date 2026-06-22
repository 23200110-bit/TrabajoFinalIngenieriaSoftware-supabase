// ============================================================================
// SERVICIO: REPORTES
// Cubre: CU-08 (Reportes de producción por servicio y por profesional)
// ============================================================================

const reporteService = {
  /**
   * Trae las consultas cerradas dentro de un rango de fechas, con datos
   * del médico y su especialidad, listas para agrupar por servicio o profesional.
   */
  async obtenerProduccion(fechaInicio, fechaFin) {
    const { data, error } = await supabaseClient
      .from("consultas")
      .select(`
        id, fecha, estado,
        pacientes:paciente_id ( nombres, apellidos ),
        usuarios:medico_id ( nombre_completo, especialidad )
      `)
      .gte("fecha", fechaInicio)
      .lte("fecha", fechaFin + "T23:59:59")
      .order("fecha", { ascending: false });

    if (error) throw error;
    return data || [];
  },

  /** Agrupa la producción por especialidad (servicio). */
  agruparPorServicio(consultas) {
    const grupos = {};
    consultas.forEach((c) => {
      const servicio = c.usuarios?.especialidad || "Sin especialidad";
      if (!grupos[servicio]) grupos[servicio] = { servicio, total: 0, completadas: 0 };
      grupos[servicio].total += 1;
      if (c.estado === "cerrada") grupos[servicio].completadas += 1;
    });
    return Object.values(grupos).sort((a, b) => b.total - a.total);
  },

  /** Agrupa la producción por profesional de salud. */
  agruparPorProfesional(consultas) {
    const grupos = {};
    consultas.forEach((c) => {
      const nombre = c.usuarios?.nombre_completo || "Sin asignar";
      if (!grupos[nombre]) {
        grupos[nombre] = {
          profesional: nombre,
          especialidad: c.usuarios?.especialidad || "—",
          total: 0,
          completadas: 0,
        };
      }
      grupos[nombre].total += 1;
      if (c.estado === "cerrada") grupos[nombre].completadas += 1;
    });
    return Object.values(grupos).sort((a, b) => b.total - a.total);
  },
};
