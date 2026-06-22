// ============================================================================
// AUTH: Login y Registro
// ============================================================================

function mostrarMensaje(elementoId, texto, tipo = "error") {
  const el = document.getElementById(elementoId);
  if (!el) return;
  el.textContent = texto;
  el.className = `mensaje visible mensaje-${tipo}`;
}

function ocultarMensaje(elementoId) {
  const el = document.getElementById(elementoId);
  if (el) el.classList.remove("visible");
}

// ---------------------------------------------------------------------------
// LOGIN (usado en login.html)
// ---------------------------------------------------------------------------
async function manejarLogin(event) {
  event.preventDefault();
  ocultarMensaje("mensaje-login");

  const email = document.getElementById("login-email").value.trim();
  const password = document.getElementById("login-password").value;
  const btn = document.getElementById("btn-login");

  btn.disabled = true;
  btn.textContent = "Ingresando...";

  try {
    const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
    if (error) throw error;

    const { data: perfil, error: errorPerfil } = await supabaseClient
      .from("usuarios")
      .select("rol")
      .eq("auth_id", data.user.id)
      .single();

    if (errorPerfil || !perfil) {
      throw new Error("Tu cuenta no tiene un perfil asignado. Contacta al administrador.");
    }

    redirigirSegunRol(perfil.rol);
  } catch (err) {
    mostrarMensaje("mensaje-login", traducirErrorAuth(err.message), "error");
    btn.disabled = false;
    btn.textContent = "Ingresar";
  }
}

function redirigirSegunRol(rol) {
  const rutas = {
    admision: "/modulos/admision/registrar-paciente.html",
    enfermeria: "/modulos/enfermeria/triaje.html",
    medico: "/modulos/medico/consulta.html",
    farmacia: "/modulos/farmacia/dispensacion.html",
    administrador: "/modulos/administrador/usuarios.html",
    encargado: "/modulos/paneles-compartidos/dashboard.html",
  };
  window.location.href = rutas[rol] || "/index.html";
}

// ---------------------------------------------------------------------------
// REGISTRO INTERNO (Modal dentro de usuarios.html gestionado por Administrador)
// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// REGISTRO INTERNO (Modal dentro de usuarios.html gestionado por Administrador)
// ---------------------------------------------------------------------------
async function manejarRegistro(event) {
  event.preventDefault();
  ocultarMensaje("mensaje-registro");

  const nombreCompleto = document.getElementById("reg-nombre").value.trim();
  const dni = document.getElementById("reg-dni").value.trim();
  const email = document.getElementById("reg-email").value.trim();
  const password = document.getElementById("reg-password").value;
  const confirmPassword = document.getElementById("reg-confirm-password").value;
  const rol = document.getElementById("reg-rol").value;
  const boldEspecialidad = document.getElementById("reg-especialidad")?.value || null;
  const btn = document.getElementById("btn-registro");

  // Validaciones del formulario
  if (password.length < 6) {
    mostrarMensaje("mensaje-registro", "La contraseña debe tener al menos 6 caracteres.", "error");
    return;
  }

  if (password !== confirmPassword) {
    mostrarMensaje("mensaje-registro", "Las contraseñas ingresadas no coinciden.", "error");
    return;
  }

  // 1. Aquí cambia a estado de carga
  btn.disabled = true;
  btn.textContent = "Creando cuenta...";

  try {
    // 2. Registramos en Supabase Auth guardando el Display Name de inmediato
    const { data: authData, error: authError } = await supabaseClient.auth.signUp({
      email,
      password,
      options: {
        data: {
          displayName: nombreCompleto
        }
      }
    });
    if (authError) throw authError;

    // 3. Insertamos el perfil en la tabla pública usuarios
    const { error: perfilError } = await supabaseClient.from("usuarios").insert([{
      auth_id: authData.user.id,
      nombre_completo: nombreCompleto,
      dni,
      correo: email,
      rol,
      especialidad: rol === "medico" ? boldEspecialidad : null,
    }]);

    if (perfilError) throw perfilError;

    // 4. Éxito: Avisamos visualmente en el panel del administrador sin sacarlo del módulo
    if (typeof mostrarMensajeAdmin === "function") {
      mostrarMensajeAdmin(`✅ Cuenta para "${nombreCompleto}" creada con éxito.`, "exito");
    }

    cerrarModalRegistro(); // Cerramos la ventana flotante

    // 5. Refrescamos la tabla de inmediato para que el nuevo usuario aparezca cargado abajo
    if (typeof cargarUsuarios === "function") {
      await cargarUsuarios();
    }

  } catch (err) {
    mostrarMensaje("mensaje-registro", traducirErrorAuth(err.message), "error");
  } finally {
    // 🪄 ¡ESTA ES LA CLAVE DE LA SOLUCIÓN!
    // Pase lo que pase (éxito o error), el botón vuelve a su estado original listo para otra acción
    btn.disabled = false;
    btn.textContent = "Crear cuenta";
  }
}

function traducirErrorAuth(mensaje) {
  const m = (mensaje || "").toLowerCase();
  if (m.includes("invalid login credentials")) return "Correo o contraseña incorrectos.";
  if (m.includes("already registered")) return "Este correo electrónico ya está registrado.";
  if (m.includes("password")) return "La contraseña no cumple con los requisitos mínimos de Supabase.";
  return mensaje || "Ocurrió un error inesperado al procesar la cuenta.";
}

function alternarCampoEspecialidad() {
  const rol = document.getElementById("reg-rol").value;
  const campo = document.getElementById("grupo-especialidad");
  if (campo) campo.style.display = rol === "medico" ? "block" : "none";
}