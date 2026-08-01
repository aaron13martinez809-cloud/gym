-- Borra TODOS los datos de demo. Correr en Supabase → SQL Editor.
--
-- Se lleva puestos los 4 alumnos inventados (@demo.nucleogym.app) con todo su
-- historial, y limpia lo que se le generó a la cuenta rolyman1977@gmail.com,
-- que se usó como "alumno completo" de la demo.
--
-- NO toca: el profesor, las plantillas, el catálogo de ejercicios, ni las
-- cuentas reales que se hayan registrado por su cuenta.

begin;

-- 1. historial de los alumnos demo
with demo as (
  select u.id from auth.users u
  where u.email like '%@demo.nucleogym.app'
     or u.email = 'rolyman1977@gmail.com'
)
delete from public.registros where alumno_id in (select id from demo);

with demo as (
  select u.id from auth.users u
  where u.email like '%@demo.nucleogym.app'
     or u.email = 'rolyman1977@gmail.com'
)
delete from public.mediciones where alumno_id in (select id from demo);

with demo as (
  select u.id from auth.users u
  where u.email like '%@demo.nucleogym.app'
     or u.email = 'rolyman1977@gmail.com'
)
delete from public.sesiones_programadas where alumno_id in (select id from demo);

with demo as (
  select u.id from auth.users u
  where u.email like '%@demo.nucleogym.app'
     or u.email = 'rolyman1977@gmail.com'
)
delete from public.rutina_ejercicios
where rutina_id in (select id from public.rutinas where alumno_id in (select id from demo));

with demo as (
  select u.id from auth.users u
  where u.email like '%@demo.nucleogym.app'
     or u.email = 'rolyman1977@gmail.com'
)
delete from public.rutinas where alumno_id in (select id from demo);

-- 2. las cuentas inventadas (el perfil se va en cascada)
delete from public.perfiles
where id in (select id from auth.users where email like '%@demo.nucleogym.app');

delete from auth.users where email like '%@demo.nucleogym.app';

commit;

-- Verificación: no debería quedar nada con @demo.nucleogym.app
select count(*) as usuarios_demo_restantes
from auth.users where email like '%@demo.nucleogym.app';
