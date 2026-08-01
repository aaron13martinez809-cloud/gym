-- Fase 1 — aplicada en Supabase el 2026-08-01.
--
-- Problema que resuelve: las 6 tablas tenían RLS habilitado y CERO políticas,
-- así que el cliente del navegador no podía leer ni escribir nada. Había 2
-- usuarios en auth.users y 0 filas en perfiles: el insert del registro fallaba
-- en silencio.

-- Helpers SECURITY DEFINER: evitan recursión infinita en las policies de perfiles
create or replace function public.es_profesor()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.perfiles
    where id = auth.uid() and rol = 'profesor'
  );
$$;

create or replace function public.mi_gimnasio()
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select gimnasio_id from public.perfiles where id = auth.uid();
$$;

-- Crear el perfil automáticamente al registrarse
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.perfiles (id, nombre, rol)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data->>'nombre', ''), split_part(new.email, '@', 1)),
    'alumno'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Backfill de los usuarios que quedaron sin perfil
insert into public.perfiles (id, nombre, rol)
select u.id,
       coalesce(nullif(u.raw_user_meta_data->>'nombre', ''), split_part(u.email, '@', 1)),
       'alumno'
from auth.users u
left join public.perfiles p on p.id = u.id
where p.id is null;

-- ============ POLICIES ============

create policy "perfil propio o profesor lee" on public.perfiles
  for select to authenticated
  using (id = auth.uid() or public.es_profesor());

create policy "crea su propio perfil" on public.perfiles
  for insert to authenticated
  with check (id = auth.uid());

create policy "edita su perfil o profesor edita" on public.perfiles
  for update to authenticated
  using (id = auth.uid() or public.es_profesor())
  with check (id = auth.uid() or public.es_profesor());

create policy "gimnasios lectura" on public.gimnasios
  for select to authenticated using (true);
create policy "gimnasios escritura profesor" on public.gimnasios
  for all to authenticated
  using (public.es_profesor()) with check (public.es_profesor());

create policy "ejercicios lectura" on public.ejercicios
  for select to authenticated using (true);
create policy "ejercicios escritura profesor" on public.ejercicios
  for all to authenticated
  using (public.es_profesor()) with check (public.es_profesor());

create policy "rutinas lectura propia o profesor" on public.rutinas
  for select to authenticated
  using (alumno_id = auth.uid() or public.es_profesor());
create policy "rutinas escritura profesor" on public.rutinas
  for all to authenticated
  using (public.es_profesor()) with check (public.es_profesor());

create policy "items lectura de su rutina o profesor" on public.rutina_ejercicios
  for select to authenticated
  using (
    public.es_profesor()
    or exists (
      select 1 from public.rutinas r
      where r.id = rutina_ejercicios.rutina_id and r.alumno_id = auth.uid()
    )
  );
create policy "items escritura profesor" on public.rutina_ejercicios
  for all to authenticated
  using (public.es_profesor()) with check (public.es_profesor());

create policy "registros lectura propia o profesor" on public.registros
  for select to authenticated
  using (alumno_id = auth.uid() or public.es_profesor());
create policy "registros inserta propio" on public.registros
  for insert to authenticated
  with check (alumno_id = auth.uid());
create policy "registros edita propio" on public.registros
  for update to authenticated
  using (alumno_id = auth.uid()) with check (alumno_id = auth.uid());
create policy "registros borra propio" on public.registros
  for delete to authenticated
  using (alumno_id = auth.uid());
