# Instruções rápidas — Desenvolvimento com chaves seguras

1. Recomendado: executar serverless local com Vercel

Instale o CLI do Vercel e rode o ambiente local:

```bash
npm install -g vercel
vercel login
vercel dev
```

Defina as variáveis de ambiente no painel do Vercel ou localmente (ex: `.env.local`) com:

- `SUPABASE_URL` — URL do projeto Supabase
- `SUPABASE_KEY` — chave anon/public (não commitar)
- `ALLOWED_ORIGIN` — opcional, domínio permitido para `/api/config`

2. Teste rápido sem Vercel (apenas desenvolvimento local)

Copie `supabase-config.example.js` para `supabase-config.js` na raiz do projeto e preencha com suas chaves de desenvolvimento.
Lembre-se: este arquivo contém chaves no cliente — NÃO comite.

```bash
cp supabase-config.example.js supabase-config.js
# editar supabase-config.js para adicionar seus valores locais
```

3. Boas práticas de segurança

- Nunca commite `supabase-config.js` com chaves reais.
- Ative Row-Level Security (RLS) no Supabase e configure políticas usando `auth.uid()`.
- Use `ALLOWED_ORIGIN` no servidor para restringir quem pode buscar as chaves.
