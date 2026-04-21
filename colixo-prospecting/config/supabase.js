const { createClient } = require('@supabase/supabase-js');

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_KEY;

if (!url || !key) {
  console.warn('[Supabase] Variables manquantes — mode dégradé actif');
}

const supabase = url && key
  ? createClient(url, key, {
      auth: { persistSession: false }
    })
  : null;

module.exports = supabase;
