// supabase-config.example.js
// Copie este arquivo para `supabase-config.js` apenas para desenvolvimento local.
// NÃO comite `supabase-config.js` com chaves reais no repositório.

(function () {
  // Substitua pelos valores do seu projeto Supabase para testes locais.
  const SUPABASE_URL = 'https://your-project.supabase.co';
  const SUPABASE_ANON_KEY = 'public-anon-key-goes-here';

  if (!window.supabase) {
    console.warn('Supabase CDN não encontrado. Verifique se você incluiu o script do Supabase.');
    return;
  }

  window.supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      storageKey: 'multilive_auth',
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
    },
  });

  window.dispatchEvent(new Event('supabase-ready'));
  console.log('Supabase client inicializado a partir de supabase-config.example.js (dev apenas)');
})();