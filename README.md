# Núcleo Gym — cómo publicarlo

## 1. Subir este código a GitHub
1. Andá a github.com, creá una cuenta si no tenés.
2. Click en "New repository", nombralo `nucleo-gym`, dejalo público o privado (da igual), no marques ninguna casilla extra, "Create repository".
3. En la página del repo vacío, click en "uploading an existing file" y arrastrá TODA esta carpeta (todos los archivos y subcarpetas). Commit.

## 2. Conectarlo con Vercel
1. Andá a vercel.com, "Sign up" con tu cuenta de GitHub.
2. "Add New..." → "Project" → elegí el repo `nucleo-gym` → "Import".
3. Antes de darle "Deploy", abrí "Environment Variables" y agregá:
   - `NEXT_PUBLIC_SUPABASE_URL` = tu Project URL de Supabase
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = tu anon public key de Supabase
4. Click "Deploy". En 1-2 minutos te da un link tipo `nucleo-gym.vercel.app`.

## 3. Convertir tu primer usuario en profesor
1. Entrá a tu link, "¿Sos nuevo? Creá tu cuenta", registrate con tu email.
2. En Supabase → Table Editor → tabla `auth.users`, copiá el `id` (UUID) de tu usuario.
3. Andá a SQL Editor y corré (reemplazando el UUID):
   ```sql
   update perfiles set rol = 'profesor' where id = 'PEGÁ-ACÁ-EL-UUID';
   ```
4. Recargá la web — ya vas a entrar directo al panel de profesor.
