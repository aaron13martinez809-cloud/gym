import { createBrowserClient } from "@supabase/ssr";

let cliente;

// Una sola instancia por pestaña: crear un cliente nuevo en cada render
// duplica los listeners de auth y rompe el realtime más adelante.
export function supabaseBrowser() {
  if (!cliente) {
    cliente = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );
  }
  return cliente;
}
