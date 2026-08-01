# Núcleo Gym

Plataforma de gestión de gimnasios. Next.js (App Router) + Supabase.

## Correr en local

```bash
npm install
npm run dev
```

Necesitás un `.env.local` con:

```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

Están en Supabase → Project Settings → API. El archivo está en `.gitignore`:
nunca lo subas al repo.

Antes de deployar:

```bash
npm run build
```

**Ojo:** no corras `npm run build` con `npm run dev` levantado. Comparten la
carpeta `.next` y el build de producción pisa la de desarrollo, dejando el server
tirando `TypeError: e[o] is not a function`. Si pasa: parar el dev, borrar
`.next` y volver a levantarlo.

## Sobre la versión de Next

Está fijado en **14.2.35**, el último parche de la línea 14.x. `npm audit` sigue
marcando avisos porque su corrección solo existe en Next 16, que son dos majors
de distancia (requiere React 19 y cambia las APIs de request y el caché).

Se revisó uno por uno y **ninguno aplica a esta app**: son de `next/image`,
middleware, Server Actions, rewrites, i18n, nonces de CSP y `beforeInteractive`,
y el proyecto no usa nada de eso (son cinco páginas cliente estáticas que hablan
con Supabase desde el navegador, en Vercel, no self-hosted). Los avisos de
PostCSS son de tiempo de build, no de runtime.

Subir a Next 16 conviene hacerlo como tarea propia, con tiempo para probar el
login y las tres vistas, no colgado de una entrega de features.

## Publicar

### 1. Subir a GitHub

1. github.com → "New repository" → nombralo `nucleo-gym` → "Create repository".
2. En el repo vacío, "uploading an existing file" y arrastrá toda la carpeta
   (menos `node_modules` y `.next`). Commit.

### 2. Conectar con Vercel

1. vercel.com → "Sign up" con GitHub.
2. "Add New..." → "Project" → elegí `nucleo-gym` → "Import".
3. Antes de "Deploy", en "Environment Variables" agregá `NEXT_PUBLIC_SUPABASE_URL`
   y `NEXT_PUBLIC_SUPABASE_ANON_KEY` con los mismos valores del `.env.local`.
4. "Deploy".

## Base de datos

Tablas: `gimnasios`, `perfiles`, `ejercicios`, `rutinas`, `rutina_ejercicios`,
`registros`, `mediciones`, `sesiones_programadas`. Las migraciones están en
`supabase/migrations/`.

Row Level Security está activo en las 8 tablas, con estas reglas:

- **perfiles** — cada uno ve y edita el suyo; el profesor ve y edita todos.
- **rutinas / rutina_ejercicios** — el alumno ve solo las suyas; solo el profesor
  crea y edita.
- **registros** — el alumno escribe solo los propios; el profesor los lee todos.
- **mediciones** — el alumno carga y ve las suyas; el profesor también (mide en
  el gimnasio).
- **sesiones_programadas** — el alumno las ve pero no se autoprograma; las agenda
  el profesor.
- **ejercicios / gimnasios** — lectura para cualquier usuario logueado, escritura
  solo del profesor.

El **historial** de entrenamientos no tiene tabla propia: sale de `registros`,
que ya es la fuente de verdad de lo que el alumno hizo. `sesiones_programadas`
guarda solo días sueltos que el profesor agrega además de la frecuencia habitual.

### Plantillas de rutina

`plantillas` → `plantilla_sesiones` → `plantilla_ejercicios`. Hay tres cargadas:
Full Body (3 días), Empuje · Tirón · Pierna (3 días) y Weider (5 días).

Una plantilla es un **ciclo de sesiones** que avanza un paso por cada día
entrenado y **no se reinicia los lunes**. Si el ciclo y la frecuencia coinciden
(PPL a 3 días, Weider a 5), cada día de la semana cae siempre en la misma sesión.
Si no coinciden (Full Body A/B a 3 días), rota solo — que es como se programa de
verdad. La lógica está en `lib/rutinas.js` y `rutinas.dias_semana` guarda los días
ISO (1 = lunes). El profesor cambia de 3 a 5 días con un click y el calendario del
alumno se reacomoda.

`rutina_ejercicios.bloque` dice a qué sesión del ciclo pertenece cada ejercicio.
Las rutinas hechas a mano quedan todas en el bloque 0 y se muestran enteras.

### Videos de los ejercicios

`ejercicios.video_url` guarda un embed de YouTube. **No alojamos ni
redistribuimos ningún video**: usamos el reproductor oficial, que es el mecanismo
previsto para esto. Se descartó usar una base de GIFs de ejercicios muy difundida
porque su propio README aclara que las imágenes fueron extraídas de internet y
que el autor no tiene los derechos ni puede cederlos.

Los 18 ids fueron verificados contra el endpoint oEmbed de YouTube. Lo que no se
puede verificar automáticamente es si el dueño de cada video permite embeberlo en
sitios de terceros, así que el modal siempre muestra además un link "Abrir en
YouTube": si un embed queda bloqueado, el alumno igual llega al video.

### Zonas horarias

`registros.hecho_en` es `timestamp without time zone` y guarda UTC, pero llega al
cliente sin la `Z`. `parseTimestamp()` en `lib/fechas.js` se la agrega: sin eso,
JS lo lee como hora local y un entrenamiento de las 22:00 cuenta para el día
siguiente, rompiendo la racha y el calendario.

El perfil se crea solo al registrarse, vía el trigger `on_auth_user_created`
sobre `auth.users`. El nombre sale de la metadata que manda el formulario de
registro; si viene vacío, usa la parte del email antes de la arroba.

## Convertir un usuario en profesor

Supabase → SQL Editor:

```sql
update perfiles set rol = 'profesor'
where id = (select id from auth.users where email = 'mail@delprofesor.com');
```

## Sistema de diseño

Los tokens (colores, radios, transiciones) viven como variables CSS en
`app/globals.css`. Las clases reutilizables (`.card`, `.btn`, `.input`, `.pill`,
`.ex`, `.empty`, `.banner`, `.toast`, `.skeleton`) también. Los componentes
compartidos están en `components/ui.js`.

Tipografías: Fraunces para títulos y números, Inter para el resto.
Mobile-first: se diseña primero para celular.
