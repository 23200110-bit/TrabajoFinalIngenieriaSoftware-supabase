// ============================================================================
// AUTH: Registro Dinámico con Lógica de Seguro y Estructura Pacientes Nativa
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
// LOGIN (Mantiene soporte cruzado)
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

    const { data: perfil } = await supabaseClient
      .from("usuarios")
      .select("rol")
      .eq("auth_id", data.user.id)
      .maybeSingle();

    if (perfil) {
      redirigirSegunRol(perfil.rol);
      return;
    }

    const { data: paciente } = await supabaseClient
      .from("pacientes")
      .select("id")
      .eq("auth_id", data.user.id)
      .maybeSingle();

    if (paciente) {
      redirigirSegunRol("paciente");
      return;
    }

    throw new Error("Tu cuenta no tiene un perfil asignado.");
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
    paciente: "/modulos/paciente/portal-paciente.html"
  };
  window.location.href = rutas[rol] || "/index.html";
}

// ---------------------------------------------------------------------------
// REGISTRO DE PACIENTE CON VALIDACIÓN CLÍNICA DE SEGUROS
// ---------------------------------------------------------------------------
async function manejarRegistro(event) {
  event.preventDefault();
  ocultarMensaje("mensaje-registro");

  const nombres = document.getElementById("reg-nombres").value.trim();
  const apellidos = document.getElementById("reg-apellidos").value.trim();
  const dni = document.getElementById("reg-dni").value.trim();
  const fechaNacimiento = document.getElementById("reg-fecha-nac").value;
  const sexo = document.getElementById("reg-sexo").value;
  const telefono = document.getElementById("reg-telefono").value.trim();
  const direccion = document.getElementById("reg-direccion").value.trim();
  let tipoSeguro = document.getElementById("reg-tipo-seguro").value;
  
  const email = document.getElementById("reg-email").value.trim();
  const password = document.getElementById("reg-password").value;
  const btn = document.getElementById("btn-registro");

  if (password.length < 6) {
    mostrarMensaje("mensaje-registro", "La contraseña debe tener al menos 6 caracteres.", "error");
    return;
  }

  btn.disabled = true;
  btn.textContent = "Guardando datos de filiación...";

  try {
    // 1. Creación del usuario en Supabase Auth
    const { data: authData, error: authError } = await supabaseClient.auth.signUp({
      email,
      password,
      options: { data: { displayName: `${nombres} ${apellidos}` } }
    });
    if (authError) throw authError;

    // 2. Establecer variables condicionales para el seguro clínico
    let tieneSeguro = (tipoSeguro !== "NINGUNO");
    let seguroVigenteHasta = null;

    // Si el usuario simuló y aceptó afiliarse al SIS en el modal, o seleccionó SIS directamente
    if (tipoSeguro === "SIS" || window.afiliacionSISAceptada === true) {
      tieneSeguro = true;
      tipoSeguro = "SIS";
      // Añadimos 1 año de vigencia simulada
      const unAnioMas = new Date();
      unAnioMas.setFullYear(unAnioMas.getFullYear() + 1);
      seguroVigenteHasta = unAnioMas.toISOString().split('T')[0];
    }

    // 3. Inserción directa respetando las columnas de la Base de Datos
    const { error: pacienteError } = await supabaseClient.from("pacientes").insert([{
      auth_id: authData.user.id,
      dni,
      nombres,
      apellidos,
      fecha_nacimiento: fechaNacimiento || null,
      sexo,
      telefono,
      direccion,
      tiene_seguro: tieneSeguro,
      tipo_seguro: tipoSeguro,
      seguro_vigente_hasta: seguroVigenteHasta
    }]);

    if (pacienteError) throw pacienteError;

    alert("🎉 ¡Registro finalizado con éxito! Tus datos se guardaron en la Posta Médica y tu cuenta del portal está lista.");
    window.location.href = "login.html";

  } catch (err) {
    mostrarMensaje("mensaje-registro", traducirErrorAuth(err.message), "error");
  } finally {
    btn.disabled = false;
    btn.textContent = "Finalizar Registro de Paciente";
  }
}

function traducirErrorAuth(mensaje) {
  const m = (mensaje || "").toLowerCase();
  if (m.includes("invalid login credentials")) return "Correo o contraseña incorrectos.";
  if (m.includes("already registered")) return "Este correo electrónico ya está registrado.";
  if (m.includes("duplicate key value violates unique constraint")) return "El número de DNI ingresado ya se encuentra registrado.";
  return mensaje || "Ocurrió un error inesperado al procesar la cuenta.";
}