async function cargarPacientes() {
  console.log("🔥 cargando pacientes...");

  try {

    const { data: pacientes } = await supabaseClient
      .from("pacientes")
      .select("*");

    const { data: citas } = await supabaseClient
      .from("citas")
      .select("*")
      .order("fecha", { ascending: true });

    const tbody = document.getElementById("tabla-pacientes");
    if (!tbody) return;

    let html = "";

    // =========================
    // 🧠 PACIENTES REALES
    // =========================
    pacientes.forEach(p => {

      const citasPaciente = citas.filter(c => c.paciente_id === p.id);

      const ultima = citasPaciente.length
        ? citasPaciente[citasPaciente.length - 1]
        : null;

      const estado = ultima?.estado || "Sin cita";

      const origen = ultima?.tipo_atencion || "Presencial";

      html += `
        <tr>
          <td>${p.dni}</td>
          <td>${p.nombres} ${p.apellidos}</td>

          <td>
            <span class="badge ${
              origen === "Virtual"
                ? "badge-primario"
                : "badge-info"
            }">
              ${origen}
            </span>
          </td>

          <td>
            <span class="badge ${
              estado === "cancelada"
                ? "badge-error"
                : estado === "programada"
                ? "badge-info"
                : estado === "completada"
                ? "badge-exito"
                : "badge-secundario"
            }">
              ${estado}
            </span>
          </td>

          <td>
            <button class="btn btn-secundario btn-sm">Ver</button>
          </td>
        </tr>
      `;
    });

    // =========================
    // 🌐 CITAS SIN PACIENTE (VIRTUALES PURAS)
    // =========================
    citas.forEach(c => {

      if (!c.paciente_id) {

        html += `
          <tr>
            <td>${c.dni || "—"}</td>
            <td>${c.nombre_paciente || "Paciente virtual"}</td>

            <td>
              <span class="badge badge-primario">
                ${c.tipo_atencion || "Virtual"}
              </span>
            </td>

            <td>
              <span class="badge badge-info">${c.estado}</span>
            </td>

            <td>
              <button class="btn btn-primario btn-sm">Atender</button>
            </td>
          </tr>
        `;
      }
    });

    tbody.innerHTML = html;

  } catch (err) {
    console.error(err);
  }
}

document.addEventListener("DOMContentLoaded", cargarPacientes);