// ============================================================================

// LAYOUT COMPARTIDO: Sidebar + Navbar

// Genera el menú lateral según el rol del usuario logueado y pinta el navbar.

// Se debe llamar a construirLayout() después de protegerPagina().

// ============================================================================



const MENUS_POR_ROL = {

  admision: [

    { texto: "Registrar paciente", href: "/modulos/admision/registrar-paciente.html", icono: "📝" },

    { texto: "Asignar turno", href: "/modulos/admision/asignar-turno.html", icono: "🎫" },

  ],

  enfermeria: [

    { texto: "Triaje", href: "/modulos/enfermeria/triaje.html", icono: "🩺" },

    { texto: "Signos vitales", href: "/modulos/enfermeria/registrar-signos.html", icono: "❤️" },

  ],

  medico: [

    { texto: "Consulta", href: "/modulos/medico/consulta.html", icono: "👨‍⚕️" },

    { texto: "Diagnóstico y receta", href: "/modulos/medico/diagnostico-receta.html", icono: "💊" },

  ],

  farmacia: [

    { texto: "Dispensación", href: "/modulos/farmacia/dispensacion.html", icono: "💊" },

    { texto: "Inventario", href: "/modulos/farmacia/inventario.html", icono: "📦" },

    { texto: "Historial de entregas", href: "/modulos/farmacia/historial-entregas.html", icono: "📋" },

  ],

  administrador: [

    { texto: "Usuarios y roles", href: "/modulos/administrador/usuarios.html", icono: "👥" },

    { texto: "Agendas médicas", href: "/modulos/administrador/agendas.html", icono: "📅" },

    { texto: "Reportes", href: "/modulos/administrador/reportes.html", icono: "📊" },

  ],

  encargado: [

    { texto: "Dashboard", href: "/modulos/paneles-compartidos/dashboard.html", icono: "📊" },

  ],

  paciente: [

    { texto: "Agendar cita", href: "/modulos/paciente/agendar-cita.html", icono: "📅" },

    { texto: "Mi portal", href: "/modulos/paciente/portal-paciente.html", icono: "🏠" },

  ],

};



function construirLayout(usuario, paginaActual) {

  const sidebarMount = document.getElementById("sidebar-mount");

  const navbarMount = document.getElementById("navbar-mount");

  if (!sidebarMount || !navbarMount) return;



  const items = MENUS_POR_ROL[usuario.rol] || [];



  sidebarMount.innerHTML = `

    <aside class="sidebar">

      <div class="sidebar-marca">

        <div class="icono">+</div>

        SDGP Salud

      </div>

      <div class="sidebar-rol">${formatearRol(usuario.rol)}</div>

      <ul class="sidebar-menu">

        ${items

          .map(

            (item) => `

          <li>

            <a href="${item.href}" class="${paginaActual === item.href ? "activo" : ""}">

              <span>${item.icono}</span> ${item.texto}

            </a>

          </li>`

          )

          .join("")}

      </ul>

      <div class="sidebar-pie">

        <button class="btn btn-secundario btn-block btn-sm" onclick="cerrarSesion()">

          Cerrar sesión

        </button>

      </div>

    </aside>

  `;



  navbarMount.innerHTML = `

    <header class="navbar">

      <div></div>

      <div class="navbar-usuario">

        <div class="info-usuario" style="text-align:right;">

          <div class="nombre" data-usuario-nombre>${usuario.nombre_completo}</div>

          <div class="rol" data-usuario-rol>${formatearRol(usuario.rol)}</div>

        </div>

        <div class="avatar" data-usuario-avatar>${obtenerIniciales(usuario.nombre_completo)}</div>

      </div>

    </header>

  `;

}