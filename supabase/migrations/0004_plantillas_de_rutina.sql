-- Plantillas de rutina — aplicada en Supabase el 2026-08-01.
--
-- Tres divisiones estándar de gimnasio, con su catálogo de ejercicios y un
-- video demostrativo por ejercicio.
--
-- Sobre los videos: son embeds de YouTube. NO alojamos ni redistribuimos el
-- archivo; usamos el reproductor oficial, que es el mecanismo previsto para
-- esto. Se descartó una base de GIFs de ejercicios muy difundida porque su
-- propio README aclara que las imágenes fueron extraídas de internet y que el
-- autor no tiene los derechos ni puede cederlos: inservible para un producto
-- que se vende. Los 18 ids fueron verificados contra el endpoint oEmbed.
--
-- Cómo se reparte una plantilla en el calendario: es un CICLO de sesiones que
-- avanza un paso por cada día entrenado, sin reiniciarse los lunes. Si el ciclo
-- y la frecuencia coinciden (PPL a 3 días, Weider a 5), cada día de la semana
-- cae siempre en la misma sesión. Si no coinciden (Full Body A/B a 3 días),
-- rota solo. La lógica vive en `lib/rutinas.js`.

-- ============ COLUMNAS NUEVAS (aditivas, no se renombra nada) ============

-- `bloque` agrupa los ejercicios por sesión del ciclo (0 = primera sesión).
-- Las rutinas hechas a mano quedan todas en el bloque 0 y siguen igual que antes.
alter table public.rutina_ejercicios
  add column if not exists bloque integer not null default 0;

alter table public.rutinas
  add column if not exists plantilla_id uuid,
  -- días ISO de la semana: 1=lunes … 7=domingo
  add column if not exists dias_semana integer[] not null default '{1,3,5}',
  add column if not exists inicio date not null default current_date;

alter table public.ejercicios
  add column if not exists clave text unique;

-- ============ PLANTILLAS ============

create table public.plantillas (
  id uuid primary key default gen_random_uuid(),
  clave text not null unique,
  nombre text not null,
  descripcion text,
  nivel text,
  dias_sugeridos integer not null default 3,
  orden integer not null default 0
);

create table public.plantilla_sesiones (
  id uuid primary key default gen_random_uuid(),
  plantilla_id uuid not null references public.plantillas(id) on delete cascade,
  orden integer not null,
  nombre text not null,
  grupos text,
  unique (plantilla_id, orden)
);

create table public.plantilla_ejercicios (
  id uuid primary key default gen_random_uuid(),
  sesion_id uuid not null references public.plantilla_sesiones(id) on delete cascade,
  ejercicio_id uuid not null references public.ejercicios(id),
  series integer,
  reps text,
  descanso_seg integer,
  orden integer not null
);

alter table public.rutinas
  add constraint rutinas_plantilla_id_fkey
  foreign key (plantilla_id) references public.plantillas(id);

-- catálogo de solo lectura: se siembra por migración, nadie lo edita desde el cliente
alter table public.plantillas enable row level security;
alter table public.plantilla_sesiones enable row level security;
alter table public.plantilla_ejercicios enable row level security;

create policy "plantillas lectura" on public.plantillas
  for select to authenticated using (true);
create policy "plantilla_sesiones lectura" on public.plantilla_sesiones
  for select to authenticated using (true);
create policy "plantilla_ejercicios lectura" on public.plantilla_ejercicios
  for select to authenticated using (true);

-- ============ CATÁLOGO DE EJERCICIOS ============

insert into public.ejercicios (clave, nombre, musculos, video_url, dificultad) values
  ('press_banca',      'Press de banca con barra',      'Pecho · Tríceps · Hombro',        'https://www.youtube.com/embed/fqsTgdTPRQU', 'Intermedio'),
  ('press_inclinado',  'Press inclinado con mancuernas','Pecho superior · Hombro',         'https://www.youtube.com/embed/OhnoqtPEpzM', 'Intermedio'),
  ('press_militar',    'Press militar con barra',       'Hombro · Tríceps',                'https://www.youtube.com/embed/OHxSwnkSxB8', 'Intermedio'),
  ('elev_laterales',   'Elevaciones laterales',         'Deltoide lateral',                'https://www.youtube.com/embed/aVa9ce3SlSA', 'Principiante'),
  ('fondos',           'Fondos en paralelas',           'Pecho · Tríceps',                 'https://www.youtube.com/embed/RDXVyR3eghQ', 'Intermedio'),
  ('ext_triceps',      'Extensión de tríceps en polea', 'Tríceps',                         'https://www.youtube.com/embed/HAS8uy73HqM', 'Principiante'),
  ('dominadas',        'Dominadas',                     'Dorsal · Bíceps',                 'https://www.youtube.com/embed/ICQoykUbkWk', 'Avanzado'),
  ('remo_barra',       'Remo con barra',                'Dorsal · Trapecio · Bíceps',      'https://www.youtube.com/embed/mdtAAzvY9BE', 'Intermedio'),
  ('jalon_pecho',      'Jalón al pecho',                'Dorsal',                          'https://www.youtube.com/embed/TIZbG7Tjbf8', 'Principiante'),
  ('remo_polea',       'Remo en polea baja',            'Dorsal · Trapecio medio',         'https://www.youtube.com/embed/rV2EKsX4P-A', 'Principiante'),
  ('curl_barra',       'Curl de bíceps con barra',      'Bíceps',                          'https://www.youtube.com/embed/uDLZNOqv3EA', 'Principiante'),
  ('sentadilla',       'Sentadilla con barra',          'Cuádriceps · Glúteo',             'https://www.youtube.com/embed/dsCuiccYNGs', 'Intermedio'),
  ('peso_muerto',      'Peso muerto',                   'Femoral · Glúteo · Espalda baja', 'https://www.youtube.com/embed/7KL8SgCP4KQ', 'Avanzado'),
  ('prensa',           'Prensa de piernas',             'Cuádriceps · Glúteo',             'https://www.youtube.com/embed/hl-EJUQ2yuc', 'Principiante'),
  ('zancadas',         'Zancadas con mancuernas',       'Cuádriceps · Glúteo',             'https://www.youtube.com/embed/6SfmtrsF8wQ', 'Principiante'),
  ('curl_femoral',     'Curl femoral tumbado',          'Isquiotibiales',                  'https://www.youtube.com/embed/9xbBr5Ytl8c', 'Principiante'),
  ('gemelos',          'Elevación de talones',          'Gemelo · Sóleo',                  'https://www.youtube.com/embed/_R3TOH-vnF8', 'Principiante'),
  ('plancha',          'Plancha abdominal',             'Core',                            'https://www.youtube.com/embed/TnsqBqlwSxg', 'Principiante')
on conflict (clave) do update
  set nombre = excluded.nombre,
      musculos = excluded.musculos,
      video_url = excluded.video_url,
      dificultad = excluded.dificultad;

-- ============ LAS 3 PLANTILLAS ============
--   Full Body   (3 días) → Cuerpo completo A (5) · Cuerpo completo B (5)
--   PPL         (3 días) → Empuje (6) · Tirón (5) · Pierna (6)
--   Weider      (5 días) → Pecho y tríceps (4) · Espalda y bíceps (4) ·
--                          Pierna (5) · Hombro (3) · Brazos y core (4)

do $$
declare
  p_id uuid; s_id uuid; fila record;
begin
  ---------------------------------------------------------------- FULL BODY
  insert into public.plantillas (clave, nombre, descripcion, nivel, dias_sugeridos, orden)
  values ('full_body', 'Full Body',
          'Todo el cuerpo en cada sesión. La opción estándar para arrancar: más frecuencia por músculo y menos días en el gimnasio.',
          'Principiante', 3, 1)
  returning id into p_id;

  insert into public.plantilla_sesiones (plantilla_id, orden, nombre, grupos)
  values (p_id, 0, 'Cuerpo completo A', 'Pierna · Pecho · Espalda') returning id into s_id;
  for fila in select * from (values
    ('sentadilla',4,'8-10',120,0), ('press_banca',3,'8-10',120,1), ('remo_barra',3,'10',90,2),
    ('press_militar',3,'10',90,3), ('plancha',3,'40 seg',60,4)
  ) as t(clave,series,reps,descanso,orden) loop
    insert into public.plantilla_ejercicios (sesion_id, ejercicio_id, series, reps, descanso_seg, orden)
    select s_id, e.id, fila.series, fila.reps, fila.descanso, fila.orden
    from public.ejercicios e where e.clave = fila.clave;
  end loop;

  insert into public.plantilla_sesiones (plantilla_id, orden, nombre, grupos)
  values (p_id, 1, 'Cuerpo completo B', 'Pierna · Espalda · Pecho') returning id into s_id;
  for fila in select * from (values
    ('peso_muerto',3,'6-8',150,0), ('prensa',3,'12',90,1), ('jalon_pecho',3,'10',90,2),
    ('press_inclinado',3,'10',90,3), ('curl_barra',3,'12',60,4)
  ) as t(clave,series,reps,descanso,orden) loop
    insert into public.plantilla_ejercicios (sesion_id, ejercicio_id, series, reps, descanso_seg, orden)
    select s_id, e.id, fila.series, fila.reps, fila.descanso, fila.orden
    from public.ejercicios e where e.clave = fila.clave;
  end loop;

  ---------------------------------------------------------------- PPL
  insert into public.plantillas (clave, nombre, descripcion, nivel, dias_sugeridos, orden)
  values ('ppl', 'Empuje · Tirón · Pierna',
          'Agrupa por patrón de movimiento en vez de por músculo suelto. El paso natural cuando el full body se queda corto.',
          'Intermedio', 3, 2)
  returning id into p_id;

  insert into public.plantilla_sesiones (plantilla_id, orden, nombre, grupos)
  values (p_id, 0, 'Empuje', 'Pecho · Hombro · Tríceps') returning id into s_id;
  for fila in select * from (values
    ('press_banca',4,'8',120,0), ('press_inclinado',3,'10',90,1), ('press_militar',3,'10',90,2),
    ('elev_laterales',3,'15',60,3), ('fondos',3,'10',90,4), ('ext_triceps',3,'12',60,5)
  ) as t(clave,series,reps,descanso,orden) loop
    insert into public.plantilla_ejercicios (sesion_id, ejercicio_id, series, reps, descanso_seg, orden)
    select s_id, e.id, fila.series, fila.reps, fila.descanso, fila.orden
    from public.ejercicios e where e.clave = fila.clave;
  end loop;

  insert into public.plantilla_sesiones (plantilla_id, orden, nombre, grupos)
  values (p_id, 1, 'Tirón', 'Espalda · Bíceps') returning id into s_id;
  for fila in select * from (values
    ('dominadas',4,'8',120,0), ('remo_barra',4,'8',120,1), ('jalon_pecho',3,'10',90,2),
    ('remo_polea',3,'12',90,3), ('curl_barra',3,'12',60,4)
  ) as t(clave,series,reps,descanso,orden) loop
    insert into public.plantilla_ejercicios (sesion_id, ejercicio_id, series, reps, descanso_seg, orden)
    select s_id, e.id, fila.series, fila.reps, fila.descanso, fila.orden
    from public.ejercicios e where e.clave = fila.clave;
  end loop;

  insert into public.plantilla_sesiones (plantilla_id, orden, nombre, grupos)
  values (p_id, 2, 'Pierna', 'Cuádriceps · Femoral · Gemelo') returning id into s_id;
  for fila in select * from (values
    ('sentadilla',4,'8',150,0), ('peso_muerto',3,'6',150,1), ('prensa',3,'12',90,2),
    ('curl_femoral',3,'12',60,3), ('zancadas',3,'12',60,4), ('gemelos',4,'15',45,5)
  ) as t(clave,series,reps,descanso,orden) loop
    insert into public.plantilla_ejercicios (sesion_id, ejercicio_id, series, reps, descanso_seg, orden)
    select s_id, e.id, fila.series, fila.reps, fila.descanso, fila.orden
    from public.ejercicios e where e.clave = fila.clave;
  end loop;

  ---------------------------------------------------------------- WEIDER
  insert into public.plantillas (clave, nombre, descripcion, nivel, dias_sugeridos, orden)
  values ('weider', 'Weider (por grupo muscular)',
          'Un grupo muscular por día. La división clásica de gimnasio, pensada para cinco días y mucho volumen por sesión.',
          'Intermedio', 5, 3)
  returning id into p_id;

  insert into public.plantilla_sesiones (plantilla_id, orden, nombre, grupos)
  values (p_id, 0, 'Pecho y tríceps', 'Pecho · Tríceps') returning id into s_id;
  for fila in select * from (values
    ('press_banca',4,'10',90,0), ('press_inclinado',3,'12',90,1), ('fondos',3,'10',90,2),
    ('ext_triceps',4,'12',60,3)
  ) as t(clave,series,reps,descanso,orden) loop
    insert into public.plantilla_ejercicios (sesion_id, ejercicio_id, series, reps, descanso_seg, orden)
    select s_id, e.id, fila.series, fila.reps, fila.descanso, fila.orden
    from public.ejercicios e where e.clave = fila.clave;
  end loop;

  insert into public.plantilla_sesiones (plantilla_id, orden, nombre, grupos)
  values (p_id, 1, 'Espalda y bíceps', 'Espalda · Bíceps') returning id into s_id;
  for fila in select * from (values
    ('dominadas',4,'8',120,0), ('remo_barra',4,'10',90,1), ('jalon_pecho',3,'12',90,2),
    ('curl_barra',4,'12',60,3)
  ) as t(clave,series,reps,descanso,orden) loop
    insert into public.plantilla_ejercicios (sesion_id, ejercicio_id, series, reps, descanso_seg, orden)
    select s_id, e.id, fila.series, fila.reps, fila.descanso, fila.orden
    from public.ejercicios e where e.clave = fila.clave;
  end loop;

  insert into public.plantilla_sesiones (plantilla_id, orden, nombre, grupos)
  values (p_id, 2, 'Pierna', 'Cuádriceps · Femoral · Gemelo') returning id into s_id;
  for fila in select * from (values
    ('sentadilla',4,'10',120,0), ('prensa',4,'12',90,1), ('curl_femoral',3,'12',60,2),
    ('zancadas',3,'12',60,3), ('gemelos',4,'20',45,4)
  ) as t(clave,series,reps,descanso,orden) loop
    insert into public.plantilla_ejercicios (sesion_id, ejercicio_id, series, reps, descanso_seg, orden)
    select s_id, e.id, fila.series, fila.reps, fila.descanso, fila.orden
    from public.ejercicios e where e.clave = fila.clave;
  end loop;

  insert into public.plantilla_sesiones (plantilla_id, orden, nombre, grupos)
  values (p_id, 3, 'Hombro', 'Hombro · Trapecio') returning id into s_id;
  for fila in select * from (values
    ('press_militar',4,'10',90,0), ('elev_laterales',4,'15',60,1), ('remo_polea',3,'12',90,2)
  ) as t(clave,series,reps,descanso,orden) loop
    insert into public.plantilla_ejercicios (sesion_id, ejercicio_id, series, reps, descanso_seg, orden)
    select s_id, e.id, fila.series, fila.reps, fila.descanso, fila.orden
    from public.ejercicios e where e.clave = fila.clave;
  end loop;

  insert into public.plantilla_sesiones (plantilla_id, orden, nombre, grupos)
  values (p_id, 4, 'Brazos y core', 'Bíceps · Tríceps · Core') returning id into s_id;
  for fila in select * from (values
    ('curl_barra',4,'12',60,0), ('ext_triceps',4,'12',60,1), ('fondos',3,'12',90,2),
    ('plancha',3,'45 seg',60,3)
  ) as t(clave,series,reps,descanso,orden) loop
    insert into public.plantilla_ejercicios (sesion_id, ejercicio_id, series, reps, descanso_seg, orden)
    select s_id, e.id, fila.series, fila.reps, fila.descanso, fila.orden
    from public.ejercicios e where e.clave = fila.clave;
  end loop;
end $$;
