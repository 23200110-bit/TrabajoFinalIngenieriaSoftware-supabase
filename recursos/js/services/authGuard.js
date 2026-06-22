// ============================================================================

// AUTH GUARD

// Verifica que haya sesión activa y que el rol del usuario coincida con el

// rol permitido para el módulo actual. Si no, redirige al login.

// Debe ser el PRIMER script que se ejecuta en cada página protegida (después

// de supabase-config.js).

// ============================================================================



/**

 * Protege la página actual: exige sesión activa y, opcionalmente, un rol específico.

 * @param {string[]} rolesPermitidos - lista de roles que pueden ver esta página.

 *                                     Si se omite, solo exige estar logueado.

 * @returns {Promise<object|null>} el usuario (de la tabla "usuarios") si todo OK.

 */

async function protegerPagina(rolesPermitidos = []) {

  const { data: { session } } = await supabaseClient.auth.getSession();



  if (!session) {

    window.location.href = "/auth/login.html";

    return null;

  }



  // Buscamos el perfil del usuario (con su rol) en la tabla "usuarios"

  const { data: usuario, error } = await supabaseClient

    .from("usuarios")

    .select("*")

    .eq("auth_id", session.user.id)

    .single();



  if (error || !usuario) {

    console.error("No se pudo cargar el perfil del usuario:", error);

    window.location.href = "/auth/login.html";

    return null;

  }



  if (!usuario.activo) {

    alert("Tu cuenta está desactivada. Contacta al administrador.");

    await supabaseClient.auth.signOut();

    window.location.href = "/auth/login.html";

    return null;

  }



  if (rolesPermitidos.length > 0 && !rolesPermitidos.includes(usuario.rol)) {

    alert("No tienes permiso para acceder a este módulo.");

    window.location.href = "/index.html";

    return null;

  }



  // Guardamos el usuario en memoria para que otros scripts de la página lo usen

  window.usuarioActual = usuario;



  // Pintamos su nombre/rol en el navbar si existe en la página

  pintarUsuarioEnNavbar(usuario);



  return usuario;

}



function pintarUsuarioEnNavbar(usuario) {

  const nombreEl = document.querySelector("[data-usuario-nombre]");

  const rolEl = document.querySelector("[data-usuario-rol]");

  const avatarEl = document.querySelector("[data-usuario-avatar]");



  if (nombreEl) nombreEl.textContent = usuario.nombre_completo;

  if (rolEl) rolEl.textContent = formatearRol(usuario.rol);

  if (avatarEl) avatarEl.textContent = obtenerIniciales(usuario.nombre_completo);

}



function formatearRol(rol) {

  const nombres = {

    admision: "Admisión",

    enfermeria: "Enfermería",

    medico: "Médico",

    farmacia: "Farmacia",

    administrador: "Administrador",

    encargado: "Encargado del Centro",

  };

  return nombres[rol] || rol;

}



function obtenerIniciales(nombreCompleto) {

  return nombreCompleto

    .split(" ")

    .slice(0, 2)

    .map((p) => p[0])

    .join("")

    .toUpperCase();

}



/** Cierra sesión y redirige al login. Se engancha al botón de logout. */

async function cerrarSesion() {

  await supabaseClient.auth.signOut();

  window.location.href = "/auth/login.html";

}