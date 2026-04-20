/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
  // adicione outras variáveis aqui se necessário...
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}