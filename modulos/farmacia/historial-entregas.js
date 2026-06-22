let todasLasEntregas = [];

document.addEventListener("DOMContentLoaded", async () => {
  // 1. Proteger la ruta asegurando el rol adecuado
  const usuarioSesion = await protegerPagina(["farmacia", "administrador"]);
  if (!usuarioSesion) return;
  
  // 2. Construir la barra lateral común
  construirLayout(usuarioSesion, window.location.pathname);
  
  // 3. Escuchar los eventos de búsqueda
  document.getElementById("btn-buscar").addEventListener("click", filtrarEntregas);
  document.getElementById("btn-limpiar").addEventListener("click", limpiarFiltro);
  
  // 4. Cargar los registros desde Supabase
  await cargarHistorialEntregas();
});

async function cargarHistorialEntregas() {
  const tbody = document.getElementById("tabla-historial-body");
  tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:20px; color:var(--color-texto-suave);">Cargando registros...</td></tr>`;

  try {
    // 🎯 REPARACIÓN DE LA CONSULTA: Cambiamos 'cantidad' por 'dosis' y corregimos los joins directos
    const { data, error } = await supabaseClient
      .from("receta_detalle")
      .select(`
        id,
        dosis,
        entregado,
        recetas (
          creado_en,
          pacientes (
            nombres, 
            apellidos, 
            dni
          )
        ),
        medicamentos (
          nombre, 
          presentacion
        )
      `)
      .eq("entregado", true);

    if (error) throw error;

    // Estabilizamos el mapeo limpiando registros que no tengan relaciones válidas
    todasLasEntregas = data.filter(item => item.recetas && item.recetas.pacientes && item.medicamentos);
    
    // Ordenamos manualmente por fecha descendente (la más reciente primero)
    todasLasEntregas.sort((a, b) => new Date(b.recetas.creado_en) - new Date(a.recetas.creado_en));

    renderizarTabla(todasLasEntregas);

  } catch (err) {
    console.error("Detalle completo del error en Supabase:", err);
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:20px; color:var(--color-error);">Error al obtener el historial de dispensación.</td></tr>`;
  }
}

function renderizarTabla(lista) {
  const tbody = document.getElementById("tabla-historial-body");
  
  if (lista.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:20px; color:var(--color-texto-suave);">No existen registros de entregas bajo este criterio.</td></tr>`;
    return;
  }

  tbody.innerHTML = lista.map(item => {
    const paciente = item.recetas.pacientes;
    const fecha = new Date(item.recetas.creado_en).toLocaleString("es-PE", {
      day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit"
    });

    return `
      <tr style="border-bottom: 1px solid var(--color-borde); font-size:14px; color: var(--color-texto);">
        <td style="padding: 12px 8px;">📅 ${fecha}</td>
        <td style="padding: 12px 8px;">
          <strong>${paciente.nombres} ${paciente.apellidos}</strong><br>
          <span style="font-size:12px; color:var(--color-texto-suave);">DNI: ${paciente.dni}</span>
        </td>
        <td style="padding: 12px 8px;">💊 <strong>${item.medicamentos.nombre}</strong> <small style="color:var(--color-texto-suave);">${item.medicamentos.presentacion}</small></td>
        <td style="padding: 12px 8px; text-align:center;"><strong>${item.dosis || "1 u."}</strong></td>
        <td style="padding: 12px 8px;"><span class="badge badge-exito">✓ Entregado</span></td>
      </tr>
    `;
  }).join("");
}

function filtrarEntregas() {
  const dniBuscar = document.getElementById("buscar-dni").value.trim();
  if (!dniBuscar) return;
  
  const filtrados = todasLasEntregas.filter(item => item.recetas.pacientes.dni.includes(dniBuscar));
  renderizarTabla(filtrados);
}

// Limpia el buscador y restablece los datos originales
function limpiarFiltro() {
  document.getElementById("buscar-dni").value = "";
  renderizarTabla(todasLasEntregas);
}