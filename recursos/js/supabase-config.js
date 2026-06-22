// ============================================================================
// CONFIGURACIÓN DE SUPABASE
// ============================================================================
// 1. Ve a tu proyecto en supabase.com > Project Settings > API
// 2. Copia "Project URL" y pégalo abajo en SUPABASE_URL
// 3. Copia "anon public" key y pégalo abajo en SUPABASE_KEY
// ============================================================================

const SUPABASE_URL = "https://vmedoxmtxabzvabifgnf.supabase.co";   // <-- pon aquí tu Project URL
const SUPABASE_KEY = "sb_publishable_UMKX0Z3NdK5aUUlyBdXjIA_tU8A8Ty2";   // <-- pon aquí tu anon public key

// Se crea el cliente de Supabase una sola vez y se reutiliza en todo el proyecto.
// Requiere haber importado el script CDN de Supabase en cada HTML, ej:
// <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
