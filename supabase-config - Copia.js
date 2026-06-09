// ╔════════════════════════════════════════════════════════════════╗
// ║         CONFIGURAÇÃO DO SUPABASE                               ║
// ╚════════════════════════════════════════════════════════════════╝

const SUPABASE_URL = 'https://ovsgcgmfpmalqwuxwdgk.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im92c2djZ21mcG1hbHF3dXh3ZGdrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMwNjA4MzYsImV4cCI6MjA4ODYzNjgzNn0.UtuPwvW-yfIDCsHzsFwGitbECiuVyN1tivtsgMi1izU';

// O CDN registra window.supabase automaticamente.
// Criamos o cliente com nome diferente para não colidir.
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

console.log('✅ Supabase inicializado com sucesso!');
