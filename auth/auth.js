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
// REGISTRO DINÁMICO (PACIENTES Y PERSONAL ADMINISTRATIVO / MÉDICOS)
// ---------------------------------------------------------------------------
async function manejarRegistro(event) {
  event.preventDefault();
  ocultarMensaje("mensaje-registro");

  // --- CAPTURA DE CAMPOS BLINDADA (Si el elemento no existe, se asigna null de forma segura) ---
  const elNombres = document.getElementById("reg-nombres") || document.getElementById("reg-nombre");
  const elApellidos = document.getElementById("reg-apellidos");
  const elDni = document.getElementById("reg-dni");
  const elFechaNac = document.getElementById("reg-fecha-nac");
  const elSexo = document.getElementById("reg-sexo");
  const elTelefono = document.getElementById("reg-telefono");
  const elDireccion = document.getElementById("reg-direccion");
  const elTipoSeguro = document.getElementById("reg-tipo-seguro");
  const elRol = document.getElementById("reg-rol");
  const elEspecialidad = document.getElementById("reg-especialidad");
  
  const email = document.getElementById("reg-email").value.trim();
  const password = document.getElementById("reg-password").value;
  const btn = document.getElementById("btn-registro");

  if (password.length < 6) {
    mostrarMensaje("mensaje-registro", "La contraseña debe tener al menos 6 caracteres.", "error");
    return;
  }

  btn.disabled = true;
  btn.textContent = "Guardando datos en el sistema...";

  try {
    // 1. Identificar de manera automática qué tipo de registro se está procesando
    const esRegistroDePersonal = (elRol !== null);

    // 2. Creación del usuario en Supabase Auth
    const nombreCompletoAuth = esRegistroDePersonal 
      ? elNombres.value.trim() 
      : `${elNombres.value.trim()} ${(elApellidos ? elApellidos.value.trim() : "")}`;

    const { data: authData, error: authError } = await supabaseClient.auth.signUp({
      email,
      password,
      options: { data: { displayName: nombreCompletoAuth } }
    });
    if (authError) throw authError;

    // 3. Bifurcación del guardado según el Formulario de Origen
    if (esRegistroDePersonal) {
      // REGISTRO DE PERSONAL (Médicos, Admisión, Enfermería, etc. -> va a la tabla 'usuarios')
      const { error: usuarioError } = await supabaseClient.from("usuarios").insert([{
        id: authData.user.id, // Vinculación directa con Auth ID
        auth_id: authData.user.id, // Mantiene redundancia segura por si se migró la columna
        dni: elDni ? elDni.value.trim() : null,
        nombre_completo: nombreCompletoAuth,
        correo: email,
        rol: elRol.value,
        especialidad: elRol.value === "medico" && elEspecialidad ? elEspecialidad.value.trim() : null,
        activo: true
      }]);

      if (usuarioError) throw usuarioError;

      alert(`🎉 Cuenta de personal (${elRol.value}) creada con éxito.`);
      
      // Limpiar formulario y cerrar modal de manera segura si la función existe en el contexto global
      document.getElementById("form-registro")?.reset();
      if (typeof cerrarModalRegistro === "function") {
        cerrarModalRegistro();
      }
      if (typeof cargarUsuarios === "function") {
        await cargarUsuarios();
      }

    } else {
      // REGISTRO DE PACIENTES NATAL (Público -> va a la tabla 'pacientes')
      let tipoSeguro = elTipoSeguro ? elTipoSeguro.value : "NINGUNO";
      let tieneSeguro = (tipoSeguro !== "NINGUNO");
      let seguroVigenteHasta = null;

      if (tipoSeguro === "SIS" || window.afiliacionSISAceptada === true) {
        tieneSeguro = true;
        tipoSeguro = "SIS";
        const unAnioMas = new Date();
        unAnioMas.setFullYear(unAnioMas.getFullYear() + 1);
        seguroVigenteHasta = unAnioMas.toISOString().split('T')[0];
      }

      const { error: pacienteError } = await supabaseClient.from("pacientes").insert([{
        auth_id: authData.user.id,
        dni: elDni ? elDni.value.trim() : null,
        nombres: elNombres.value.trim(),
        apellidos: elApellidos ? elApellidos.value.trim() : "",
        fecha_nacimiento: elFechaNac ? elFechaNac.value || null : null,
        sexo: elSexo ? elSexo.value : null,
        telefono: elTelefono ? elTelefono.value.trim() : null,
        direccion: elDireccion ? elDireccion.value.trim() : null,
        tiene_seguro: tieneSeguro,
        tipo_seguro: tipoSeguro,
        seguro_vigente_hasta: seguroVigenteHasta
      }]);

      if (pacienteError) throw pacienteError;

      alert("🎉 ¡Registro finalizado con éxito! Tus datos se guardaron en la Posta Médica y tu cuenta del portal está lista.");
      window.location.href = "login.html";
    }

  } catch (err) {
    console.error("Error completo atrapado en Auth:", err);
    mostrarMensaje("mensaje-registro", traducirErrorAuth(err.message), "error");
  } finally {
    btn.disabled = false;
    btn.textContent = elRol ? "Crear cuenta" : "Finalizar Registro de Paciente";
  }
}

function traducirErrorAuth(mensaje) {
  const m = (mensaje || "").toLowerCase();
  if (m.includes("invalid login credentials")) return "Correo o contraseña incorrectos.";
  if (m.includes("already registered")) return "Este correo electrónico ya está registrado.";
  if (m.includes("duplicate key value violates unique constraint")) return "El número de DNI ingresado ya se encuentra registrado.";
  return mensaje || "Ocurrió un error inesperado al procesar la cuenta.";
}