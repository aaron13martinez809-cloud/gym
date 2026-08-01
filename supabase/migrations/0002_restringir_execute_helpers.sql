-- Fase 1 — aplicada en Supabase el 2026-08-01.
--
-- Las funciones SECURITY DEFINER quedaban expuestas en /rest/v1/rpc/ para anon.
-- Ojo: `authenticated` SÍ necesita EXECUTE en los helpers, porque las expresiones
-- de las policies se evalúan con los privilegios de quien consulta, no del owner.
-- Si se revoca a authenticated, todas las policies que los usan empiezan a fallar.

revoke execute on function public.es_profesor() from public, anon;
revoke execute on function public.mi_gimnasio() from public, anon;
grant execute on function public.es_profesor() to authenticated;
grant execute on function public.mi_gimnasio() to authenticated;

-- handle_new_user() solo corre como trigger; nadie la llama directo.
revoke execute on function public.handle_new_user() from public, anon, authenticated;
