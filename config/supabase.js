require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL ? process.env.SUPABASE_URL.trim() : '';
const supabaseKey = (
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SECRET_KEY ||
  process.env.SUPABASE_KEY ||
  ''
).trim();

if (!supabaseUrl || !supabaseKey) {
  console.warn(
    '[Supabase Config Warning] SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not configured in .env.\n' +
    'Please add your Supabase credentials to .env to enable database operations.'
  );
}

// Initialize Supabase Client
// We use server-side options (persistSession: false) for Node.js Express server
const supabase = createClient(supabaseUrl || 'https://placeholder.supabase.co', supabaseKey || 'placeholder-key', {
  auth: {
    persistSession: false,
    autoRefreshToken: false
  }
});

/**
 * Tests connection to the Supabase PostgreSQL database
 * @returns {Promise<{ ok: boolean, message: string }>}
 */
async function testConnection(timeoutMs = 5000) {
  if (
    !supabaseUrl ||
    !supabaseKey ||
    supabaseUrl.includes('your-project-ref') ||
    supabaseUrl.includes('placeholder') ||
    supabaseKey.includes('your_supabase_service_role') ||
    supabaseKey.includes('placeholder')
  ) {
    return {
      ok: false,
      message: 'SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is using a placeholder in .env. Please update with your real Supabase project URL and service_role secret key.'
    };
  }

  try {
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Connection timed out after 5 seconds. Check SUPABASE_URL and internet connection.')), timeoutMs)
    );

    const queryPromise = supabase
      .from('salon_settings')
      .select('id')
      .limit(1);

    const { data, error } = await Promise.race([queryPromise, timeoutPromise]);

    if (error) {
      if (
        error.code === '42P01' ||
        error.code === 'PGRST204' ||
        error.code === 'PGRST205' ||
        error.message?.includes('schema cache') ||
        error.message?.includes('relation "salon_settings" does not exist')
      ) {
        return {
          ok: false,
          code: 'TABLES_NOT_FOUND',
          message: 'Connected to Supabase, but required tables were not found. Please execute supabase/schema.sql in the Supabase SQL Editor.'
        };
      }
      return { ok: false, code: error.code, message: error.message };
    }

    return { ok: true, message: 'Connected to Supabase database successfully.' };
  } catch (err) {
    return { ok: false, message: err.message };
  }
}

module.exports = {
  supabase,
  supabaseUrl,
  testConnection
};
