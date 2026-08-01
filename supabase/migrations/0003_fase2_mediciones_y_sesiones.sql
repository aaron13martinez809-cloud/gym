-- Fase 2 — aplicada en Supabase el 2026-08-01.
--
-- Nota de diseño: el HISTORIAL de entrenamientos no vive en una tabla nueva.
-- Sale de `registros`, que ya es la fuente de verdad de lo que el alumno hizo.
-- La tabla nueva guarda solo lo que el profesor agenda a futuro.

-- ============ MEDICIONES (peso corporal + medidas en el tiempo) ============
create table public.mediciones (
  id uuid primary key default gen_random_uuid(),
  alumno_id uuid not null references public.perfiles(id) on delete cascade,
  fecha date not null default current_date,
  peso_kg numeric(5,2) check (peso_kg is null or (peso_kg > 0 and peso_kg < 500)),
  cintura_cm numeric(5,1) check (cintura_cm is null or cintura_cm > 0),
  cadera_cm numeric(5,1) check (cadera_cm is null or cadera_cm > 0),
  pecho_cm numeric(5,1) check (pecho_cm is null or pecho_cm > 0),
  brazo_cm numeric(5,1) check (brazo_cm is null or brazo_cm > 0),
  muslo_cm numeric(5,1) check (muslo_cm is null or muslo_cm > 0),
  nota text,
  creado_en timestamp default now(),
  -- una medición por día por alumno: permite hacer upsert sin duplicar
  unique (alumno_id, fecha)
);

create index mediciones_alumno_fecha_idx on public.mediciones (alumno_id, fecha desc);

alter table public.mediciones enable row level security;

create policy "mediciones lectura propia o profesor" on public.mediciones
  for select to authenticated
  using (alumno_id = auth.uid() or public.es_profesor());
create policy "mediciones inserta propia o profesor" on public.mediciones
  for insert to authenticated
  with check (alumno_id = auth.uid() or public.es_profesor());
create policy "mediciones edita propia o profesor" on public.mediciones
  for update to authenticated
  using (alumno_id = auth.uid() or public.es_profesor())
  with check (alumno_id = auth.uid() or public.es_profesor());
create policy "mediciones borra propia o profesor" on public.mediciones
  for delete to authenticated
  using (alumno_id = auth.uid() or public.es_profesor());

-- ============ SESIONES PROGRAMADAS (el calendario a futuro) ============
create table public.sesiones_programadas (
  id uuid primary key default gen_random_uuid(),
  alumno_id uuid not null references public.perfiles(id) on delete cascade,
  fecha date not null,
  rutina_id uuid references public.rutinas(id) on delete set null,
  nota text,
  creada_por uuid references public.perfiles(id),
  creado_en timestamp default now(),
  unique (alumno_id, fecha)
);

create index sesiones_alumno_fecha_idx on public.sesiones_programadas (alumno_id, fecha);

alter table public.sesiones_programadas enable row level security;

-- el alumno las ve pero no se autoprograma; eso lo decide el profesor
create policy "sesiones lectura propia o profesor" on public.sesiones_programadas
  for select to authenticated
  using (alumno_id = auth.uid() or public.es_profesor());
create policy "sesiones escritura profesor" on public.sesiones_programadas
  for all to authenticated
  using (public.es_profesor()) with check (public.es_profesor());
