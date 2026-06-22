# Sistema Digital de Gestión de Salud Primaria (SDGP-VVP)

Centro de Salud Villa Victoria Porvenir — Proyecto del curso Ingeniería de Software I, Universidad ESAN.

## Cómo poner en marcha el proyecto

### 1. Base de datos (Supabase)
1. Crea un proyecto en [supabase.com](https://supabase.com).
2. Ve a **SQL Editor → New query**.
3. Pega el contenido completo de `01_schema_supabase.sql` y dale **Run**.
4. Esto crea las 13 tablas, la vista del dashboard, los triggers automáticos y las políticas de seguridad (RLS).

### 2. Conectar el proyecto a tu Supabase
1. En tu proyecto Supabase, ve a **Project Settings → API**.
2. Copia el **Project URL** y la **anon public key**.
3. Abre `recursos/js/supabase-config.js` y reemplaza:
   ```js
   const SUPABASE_URL = "TU_SUPABASE_URL_AQUI";
   const SUPABASE_KEY = "TU_SUPABASE_KEY_AQUI";
   ```

### 3. Crear el primer usuario administrador
Como el registro normal (`auth/register.html`) requiere estar ya logueado para algunas acciones, crea tu primer administrador así:
1. Entra a `auth/register.html` en el navegador.
2. Completa el formulario eligiendo el rol **Administrador**.
3. Con esa cuenta podrás crear el resto de usuarios (médicos, enfermería, farmacia, admisión) desde el módulo de Administrador.

### 4. Ejecutar el proyecto
Como es HTML/CSS/JS plano, basta con abrir `index.html` con una extensión tipo **Live Server** de VS Code (clic derecho → "Open with Live Server"). No uses doble clic directo en el archivo, porque algunos navegadores bloquean los módulos al abrir con `file://`.

## Estructura del proyecto

```
├── auth/                    Login y registro de personal
├── modulos/
│   ├── administrador/       CU-09 (usuarios y roles), CU-12 (agendas médicas)
│   ├── admision/            CU-01 (registrar paciente), CU-02 (asignar turno)
│   ├── enfermeria/          CU-03 (signos vitales), HU-14 (triaje/prioridad)
│   ├── farmacia/            CU-06 (dispensación), HU-07 (alertas de stock)
│   ├── medico/              CU-04 (historia clínica), CU-05 (diagnóstico/receta)
│   ├── paciente/            CU-13 (agendar/consultar/cancelar citas)
│   └── paneles-compartidos/ Dashboard (HU-10, HU-11), layout compartido
└── recursos/
    ├── css/                 Estilos globales y variables de diseño
    └── js/
        ├── supabase-config.js
        └── services/        Capa de servicios compartidos (pacienteService,
                              citaService, recetaService, authGuard)
```

## Casos de uso cubiertos

| CU | Nombre | Módulo |
|----|--------|--------|
| CU-01 | Registrar Pacientes | admision |
| CU-02 | Asignar Turno Automático | admision |
| CU-03 | Registrar Signos Vitales | enfermeria |
| CU-04 | Visualizar Historia Clínica | medico |
| CU-05 | Registrar Diagnóstico y Receta Digital | medico |
| CU-06 | Validar Stock y Entregar Medicamentos | farmacia |
| CU-09 | Gestionar Usuarios y Roles | administrador |
| CU-12 | Gestionar Agenda del Personal Médico | administrador |
| CU-13 | Agendar, Consultar y Cancelar Citas | paciente |

Adicionalmente se cubrieron HU-07 (alertas de stock bajo), HU-10/HU-11 (dashboard de indicadores) y HU-14 (clasificación de prioridad en triaje).

## Notas técnicas

El proyecto no usa ningún framework (HTML, CSS y JavaScript vanilla) y se conecta a Supabase directamente desde el navegador mediante el SDK `@supabase/supabase-js`. La seguridad de acceso por rol se maneja en dos capas: políticas RLS en la base de datos, y `authGuard.js` en el frontend, que redirige al login si no hay sesión o si el rol no coincide con el módulo.
