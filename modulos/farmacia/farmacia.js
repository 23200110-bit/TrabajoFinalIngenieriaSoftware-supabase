// ============================================================================
// MÓDULO: FARMACIA
// Cubre: CU-06 (Validar Stock y Entregar Medicamentos), HU-07 (Alertas de stock bajo)
// ============================================================================

let usuarioSesion = null;
let recetaActualId = null;

document.addEventListener("DOMContentLoaded", async () => {
  usuarioSesion = await protegerPagina(["farmacia", "administrador"]);
  if (!usuarioSesion) return;

  construirLayout(usuarioSesion, window.location.pathname);

  if (document.getElementById("form-buscar-receta")) {
    document.getElementById("form-buscar-receta").addEventListener("submit", buscarRecetaPendiente);
  }

  if (document.getElementById("tabla-inventario-body")) {
    await cargarInventario();
  }
});

// ---------------------------------------------------------------------------
// CU-06: Validar stock y entregar medicamentos
// ---------------------------------------------------------------------------
async function buscarRecetaPendiente(event) {
  event.preventDefault();
  const dni = document.getElementById("campo-dni-farmacia").value.trim();
  const contenedor = document.getElementById("resultado-receta");

  contenedor.innerHTML = `<p class="texto-suave">Buscando recetas pendientes...</p>`;

  try {
    const resultado = await recetaService.buscarRecetasPendientesPorDni(dni);

    if (!resultado) {
      contenedor.innerHTML = `<div class="mensaje visible mensaje-error">No se encontró un paciente con ese DNI.</div>`;
      return;
    }

    if (resultado.recetas.length === 0) {
      contenedor.innerHTML = `
        <div class="mensaje visible mensaje-alerta">
          ${resultado.paciente.nombres} ${resultado.paciente.apellidos} no tiene recetas pendientes.
        </div>`;
      return;
    }

    contenedor.innerHTML = resultado.recetas
      .map((receta) => pintarTarjetaReceta(receta, resultado.paciente))
      .join("");
  } catch (err) {
    contenedor.innerHTML = `<div class="mensaje visible mensaje-error">Error: ${err.message}</div>`;
  }
}

function pintarTarjetaReceta(receta, paciente) {
  const filas = receta.receta_detalle
    .map((detalle) => {
      const med = detalle.medicamentos;
      const sinStock = med.stock_actual <= 0;
      const yaEntregado = detalle.entregado;

      return `
        <div class="flex-entre" style="padding:12px 0; border-bottom:1px solid var(--color-borde);">
          <div>
            <strong>${med.nombre}</strong>
            <p class="texto-suave">${detalle.dosis} · ${detalle.frecuencia} · ${detalle.duracion}</p>
            <p class="texto-suave">Stock disponible: ${med.stock_actual}</p>
          </div>
          <div>
            ${
              yaEntregado
                ? `<span class="badge badge-exito">Entregado</span>`
                : sinStock
                ? `<span class="badge badge-error">Sin stock</span>`
                : `<button class="btn btn-exito btn-sm" onclick="entregarMedicamento('${detalle.id}', '${receta.id}')">Confirmar entrega</button>`
            }
          </div>
        </div>
      `;
    })
    .join("");

  return `
    <div class="tarjeta">
      <div class="tarjeta-titulo">💊 Receta de ${paciente.nombres} ${paciente.apellidos}</div>
      <p class="texto-suave mt-16">Emitida: ${formatearFecha(receta.creado_en)}</p>
      <div class="mt-16">${filas}</div>
    </div>
  `;
}

async function entregarMedicamento(detalleId, recetaId) {
  try {
    await recetaService.marcarMedicamentoEntregado(detalleId);
    const completa = await recetaService.cerrarRecetaSiCompleta(recetaId);

    if (completa) {
      mostrarMensajeFarmacia("Receta completa. Todos los medicamentos fueron entregados.", "exito");
    }

    // Re-buscamos para refrescar la vista con el stock actualizado
    const dni = document.getElementById("campo-dni-farmacia").value.trim();
    document.getElementById("form-buscar-receta").dispatchEvent(new Event("submit"));
  } catch (err) {
    mostrarMensajeFarmacia("No se pudo entregar el medicamento: " + err.message, "error");
  }
}

// ---------------------------------------------------------------------------
// HU-07: Inventario y alertas de stock bajo
// ---------------------------------------------------------------------------
async function cargarInventario() {
  const tbody = document.getElementById("tabla-inventario-body");
  const alertaCont = document.getElementById("contenedor-alertas-stock");

  try {
    const medicamentos = await recetaService.listarMedicamentosDisponibles();
    const stockBajo = await recetaService.listarMedicamentosStockBajo();

    // Bloque de alertas (HU-07)
    if (stockBajo.length > 0) {
      alertaCont.innerHTML = `
        <div class="mensaje visible mensaje-alerta">
          ⚠️ ${stockBajo.length} medicamento(s) con stock bajo: 
          ${stockBajo.map((m) => m.nombre).join(", ")}.
          <a href="alertas-stock.html" style="font-weight:700; text-decoration:underline;">Ver detalle y reponer →</a>
        </div>
      `;
    } else {
      alertaCont.innerHTML = "";
    }

    // Tabla completa de inventario
    tbody.innerHTML = medicamentos
      .map((m) => {
        const bajo = m.stock_actual <= m.stock_minimo;
        return `
        <tr>
          <td>${m.nombre}</td>
          <td>${m.presentacion || "—"}</td>
          <td>${m.stock_actual}</td>
          <td>${m.stock_minimo}</td>
          <td>${
            bajo
              ? '<span class="badge badge-error">Stock bajo</span>'
              : '<span class="badge badge-exito">Normal</span>'
          }</td>
          <td>
            <button class="btn btn-secundario btn-sm" onclick="abrirReponerStock('${m.id}', '${m.nombre}', ${m.stock_actual})">
              Reponer
            </button>
          </td>
        </tr>
      `;
      })
      .join("");
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="6" class="estado-vacio">Error al cargar inventario.</td></tr>`;
  }
}

async function abrirReponerStock(medicamentoId, nombre, stockActual) {
  const cantidad = prompt(`Reponer stock de "${nombre}" (actual: ${stockActual}). ¿Cuántas unidades agregar?`);
  const cantidadNum = parseInt(cantidad);

  if (!cantidad || isNaN(cantidadNum) || cantidadNum <= 0) return;

  try {
    await recetaService.actualizarStock(medicamentoId, stockActual + cantidadNum);
    mostrarMensajeFarmacia(`Stock de "${nombre}" actualizado correctamente.`, "exito");
    await cargarInventario();
  } catch (err) {
    mostrarMensajeFarmacia("No se pudo actualizar el stock: " + err.message, "error");
  }
}

// ---------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------
function formatearFecha(fechaIso) {
  return new Date(fechaIso).toLocaleDateString("es-PE", { day: "2-digit", month: "short", year: "numeric" });
}

function mostrarMensajeFarmacia(texto, tipo) {
  const el = document.getElementById("mensaje-farmacia");
  if (!el) return;
  el.textContent = texto;
  el.className = `mensaje visible mensaje-${tipo}`;
  setTimeout(() => el.classList.remove("visible"), 4000);
}
