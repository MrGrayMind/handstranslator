import { createClient } from '@supabase/supabase-js'

// ============================================================
// 🔧 CONFIGURA TU SUPABASE AQUÍ
// ============================================================
// Reemplaza estos valores con los de tu proyecto de Supabase
// Los encuentras en: https://supabase.com/dashboard → Tu Proyecto → Settings → API
// ============================================================

const SUPABASE_URL = 'https://vxqjsqhoryjqojffbdtu.supabase.co' // ← URL de tu proyecto Supabase
const SUPABASE_ANON_KEY = 'sb_publishable_G_PRU91mgyErnxd9u6baag_t4TbGXke'           // ← Anon (public) key de tu proyecto

// ============================================================

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
