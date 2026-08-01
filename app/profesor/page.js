"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "../../lib/supabaseClient";
import { claveDia, desdeClave, hoyClave, parseTimestamp } from "../../lib/fechas";
import { DIA_CORTO, PRESETS, resumenDias } from "../../lib/rutinas";
import {
  Avatar,
  Banner,
  Empty,
  Skeleton,
  Spinner,
  Toast,
  Wordmark,
} from "../../components/ui";

const FILA_VACIA = { nombre: "", series: 3, reps: "10", peso_sugerido: "" };

function haceCuanto(clave) {
  const dias = Math.round((desdeClave(hoyClave()) - desdeClave(clave)) / 86400000);
  if (dias <= 0) return "hoy";
  if (dias === 1) return "ayer";
  if (dias < 7) return `hace ${dias} días`;
  if (dias < 30) return `hace ${Math.floor(dias / 7)} sem`;
  return `hace ${Math.floor(dias / 30)} meses`;
}

function mismosDias(a = [], b = []) {
  return a.length === b.length && [...a].sort().join() === [...b].sort().join();
}

export default function Profesor() {
  const router = useRouter();

  const [alumnos, setAlumnos] = useState([]);
  const [plantillas, setPlantillas] = useState([]);
  const [rutinasPorAlumno, setRutinasPorAlumno] = useState({});
  const [ultimoPorAlumno, setUltimoPorAlumno] = useState({});
  const [sesionesPorAlumno, setSesionesPorAlumno] = useState({});
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [busqueda, setBusqueda] = useState("");

  const [panel, setPanel] = useState(null); // { alumnoId, tipo: 'rutina' | 'agenda' }
  const [modo, setModo] = useState("plantilla"); // 'plantilla' | 'manual'
  const [plantillaSel, setPlantillaSel] = useState(null);
  const [diasSel, setDiasSel] = useState(PRESETS[3]);
  const [nombreRutina, setNombreRutina] = useState("Rutina general");
  const [filas, setFilas] = useState([{ ...FILA_VACIA }]);
  const [guardando, setGuardando] = useState(false);
  const [errorForm, setErrorForm] = useState("");
  const [nuevaFecha, setNuevaFecha] = useState(hoyClave());
  const [toast, setToast] = useState(null);

  const cargar = useCallback(async () => {
    const supabase = supabaseBrowser();
    setError("");

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) return router.replace("/login");

      const { data: yo } = await supabase
        .from("perfiles")
        .select("rol")
        .eq("id", session.user.id)
        .maybeSingle();
      if (yo?.rol !== "profesor") return router.replace("/alumno");

      const [rAlumnos, rRutinas, rRegistros, rSesiones, rPlantillas] =
        await Promise.all([
          supabase.from("perfiles").select("*").eq("rol", "alumno").order("nombre"),
          supabase
            .from("rutinas")
            .select("id, alumno_id, nombre, creado_en, plantilla_id, dias_semana, inicio")
            .order("creado_en", { ascending: false }),
          supabase
            .from("registros")
            .select("alumno_id, hecho_en")
            .order("hecho_en", { ascending: false }),
          supabase
            .from("sesiones_programadas")
            .select("id, alumno_id, fecha")
            .gte("fecha", hoyClave())
            .order("fecha"),
          supabase
            .from("plantillas")
            .select("id, clave, nombre, descripcion, nivel, dias_sugeridos")
            .order("orden"),
        ]);

      for (const r of [rAlumnos, rRutinas, rRegistros, rSesiones, rPlantillas]) {
        if (r.error) throw r.error;
      }

      setAlumnos(rAlumnos.data || []);
      setPlantillas(rPlantillas.data || []);

      const rutinas = {};
      for (const r of rRutinas.data || []) {
        if (!rutinas[r.alumno_id]) rutinas[r.alumno_id] = r;
      }
      setRutinasPorAlumno(rutinas);

      const ultimos = {};
      for (const r of rRegistros.data || []) {
        if (!ultimos[r.alumno_id]) {
          ultimos[r.alumno_id] = claveDia(parseTimestamp(r.hecho_en));
        }
      }
      setUltimoPorAlumno(ultimos);

      const agenda = {};
      for (const s of rSesiones.data || []) {
        (agenda[s.alumno_id] ||= []).push(s);
      }
      setSesionesPorAlumno(agenda);
    } catch (err) {
      setError(
        err?.message
          ? `No pudimos cargar los alumnos: ${err.message}`
          : "No pudimos cargar los alumnos."
      );
    } finally {
      setCargando(false);
    }
  }, [router]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  function abrirPanel(alumnoId, tipo) {
    if (panel?.alumnoId === alumnoId && panel?.tipo === tipo) return setPanel(null);
    setPanel({ alumnoId, tipo });
    setModo("plantilla");
    setPlantillaSel(plantillas[0]?.id ?? null);
    setDiasSel(PRESETS[plantillas[0]?.dias_sugeridos ?? 3] ?? PRESETS[3]);
    setNombreRutina("Rutina general");
    setFilas([{ ...FILA_VACIA }]);
    setNuevaFecha(hoyClave());
    setErrorForm("");
  }

  function elegirPlantilla(p) {
    setPlantillaSel(p.id);
    setDiasSel(PRESETS[p.dias_sugeridos] ?? PRESETS[3]);
  }

  function alternarDia(iso) {
    setDiasSel((prev) =>
      prev.includes(iso) ? prev.filter((d) => d !== iso) : [...prev, iso].sort()
    );
  }

  /* ---------- asignar desde plantilla ---------- */

  async function asignarPlantilla(alumnoId) {
    setErrorForm("");
    if (!plantillaSel) return setErrorForm("Elegí una plantilla.");
    if (diasSel.length === 0) return setErrorForm("Elegí al menos un día.");

    const supabase = supabaseBrowser();
    setGuardando(true);
    try {
      const plantilla = plantillas.find((p) => p.id === plantillaSel);

      // los ejercicios de todas las sesiones de la plantilla, en una consulta
      const { data: pes, error: ep } = await supabase
        .from("plantilla_ejercicios")
        .select(
          "ejercicio_id, series, reps, descanso_seg, orden, plantilla_sesiones!inner(orden, plantilla_id)"
        )
        .eq("plantilla_sesiones.plantilla_id", plantillaSel);
      if (ep) throw ep;
      if (!pes?.length) throw new Error("La plantilla no tiene ejercicios cargados.");

      const {
        data: { session },
      } = await supabase.auth.getSession();

      const { data: rutina, error: er } = await supabase
        .from("rutinas")
        .insert({
          alumno_id: alumnoId,
          nombre: plantilla.nombre,
          creada_por: session.user.id,
          plantilla_id: plantillaSel,
          dias_semana: diasSel,
          inicio: hoyClave(),
        })
        .select()
        .single();
      if (er) throw er;

      const { error: ei } = await supabase.from("rutina_ejercicios").insert(
        pes.map((pe) => ({
          rutina_id: rutina.id,
          ejercicio_id: pe.ejercicio_id,
          series: pe.series,
          reps: pe.reps,
          descanso_seg: pe.descanso_seg,
          orden: pe.orden,
          bloque: pe.plantilla_sesiones.orden,
        }))
      );
      if (ei) throw ei;

      setRutinasPorAlumno((prev) => ({ ...prev, [alumnoId]: rutina }));
      setPanel(null);
      setToast({ tipo: "ok", texto: `${plantilla.nombre} asignada.` });
    } catch (err) {
      setErrorForm(err?.message || "No se pudo asignar la plantilla.");
    } finally {
      setGuardando(false);
    }
  }

  /* ---------- cambiar frecuencia con un click ---------- */

  async function cambiarDias(alumnoId, dias) {
    const rutina = rutinasPorAlumno[alumnoId];
    if (!rutina) return;

    const previo = rutina.dias_semana;
    setRutinasPorAlumno((p) => ({
      ...p,
      [alumnoId]: { ...rutina, dias_semana: dias },
    }));

    const { error } = await supabaseBrowser()
      .from("rutinas")
      .update({ dias_semana: dias })
      .eq("id", rutina.id);

    if (error) {
      setRutinasPorAlumno((p) => ({
        ...p,
        [alumnoId]: { ...rutina, dias_semana: previo },
      }));
      setToast({ tipo: "err", texto: "No se pudo cambiar la frecuencia." });
    } else {
      setToast({ tipo: "ok", texto: `Ahora entrena ${resumenDias(dias)}.` });
    }
  }

  /* ---------- rutina a medida ---------- */

  function actualizarFila(i, campo, valor) {
    setFilas((prev) => prev.map((f, idx) => (idx === i ? { ...f, [campo]: valor } : f)));
  }

  function quitarFila(i) {
    setFilas((prev) =>
      prev.length === 1 ? [{ ...FILA_VACIA }] : prev.filter((_, idx) => idx !== i)
    );
  }

  // Reutiliza el ejercicio si ya existe con ese nombre; antes se creaba una fila
  // nueva en `ejercicios` cada vez y el catálogo se llenaba de duplicados.
  async function obtenerEjercicioId(supabase, nombre) {
    const limpio = nombre.trim();
    const { data: existente } = await supabase
      .from("ejercicios")
      .select("id")
      .ilike("nombre", limpio)
      .limit(1)
      .maybeSingle();
    if (existente) return existente.id;

    const { data: creado, error } = await supabase
      .from("ejercicios")
      .insert({ nombre: limpio })
      .select("id")
      .single();
    if (error) throw error;
    return creado.id;
  }

  async function guardarRutinaManual(alumnoId) {
    const supabase = supabaseBrowser();
    const validas = filas.filter((f) => f.nombre.trim());

    setErrorForm("");
    if (!nombreRutina.trim()) return setErrorForm("Poné un nombre a la rutina.");
    if (validas.length === 0)
      return setErrorForm("Agregá al menos un ejercicio con nombre.");

    setGuardando(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const { data: rutina, error: er } = await supabase
        .from("rutinas")
        .insert({
          alumno_id: alumnoId,
          nombre: nombreRutina.trim(),
          creada_por: session.user.id,
          dias_semana: diasSel.length ? diasSel : PRESETS[3],
          inicio: hoyClave(),
        })
        .select()
        .single();
      if (er) throw er;

      const items = [];
      for (const [i, f] of validas.entries()) {
        const ejercicioId = await obtenerEjercicioId(supabase, f.nombre);
        items.push({
          rutina_id: rutina.id,
          ejercicio_id: ejercicioId,
          series: Number(f.series) || null,
          reps: f.reps || null,
          peso_sugerido: f.peso_sugerido || null,
          orden: i,
          bloque: 0,
        });
      }

      const { error: ei } = await supabase.from("rutina_ejercicios").insert(items);
      if (ei) throw ei;

      setRutinasPorAlumno((prev) => ({ ...prev, [alumnoId]: rutina }));
      setPanel(null);
      setFilas([{ ...FILA_VACIA }]);
      setToast({ tipo: "ok", texto: "Rutina asignada." });
    } catch (err) {
      setErrorForm(err?.message || "No se pudo guardar la rutina.");
    } finally {
      setGuardando(false);
    }
  }

  /* ---------- días sueltos ---------- */

  async function programarDia(alumnoId) {
    setErrorForm("");
    const yaEsta = (sesionesPorAlumno[alumnoId] || []).some(
      (s) => s.fecha === nuevaFecha
    );
    if (yaEsta) return setErrorForm("Ese día ya está programado.");

    const supabase = supabaseBrowser();
    const {
      data: { session },
    } = await supabase.auth.getSession();

    const { data, error } = await supabase
      .from("sesiones_programadas")
      .insert({
        alumno_id: alumnoId,
        fecha: nuevaFecha,
        rutina_id: rutinasPorAlumno[alumnoId]?.id ?? null,
        creada_por: session.user.id,
      })
      .select("id, alumno_id, fecha")
      .single();

    if (error) return setErrorForm(error.message);

    setSesionesPorAlumno((prev) => ({
      ...prev,
      [alumnoId]: [...(prev[alumnoId] || []), data].sort((a, b) =>
        a.fecha.localeCompare(b.fecha)
      ),
    }));
    setToast({ tipo: "ok", texto: "Día extra programado." });
  }

  async function quitarDia(alumnoId, id) {
    const previos = sesionesPorAlumno[alumnoId] || [];
    setSesionesPorAlumno((prev) => ({
      ...prev,
      [alumnoId]: previos.filter((s) => s.id !== id),
    }));

    const { error } = await supabaseBrowser()
      .from("sesiones_programadas")
      .delete()
      .eq("id", id);

    if (error) {
      setSesionesPorAlumno((prev) => ({ ...prev, [alumnoId]: previos }));
      setToast({ tipo: "err", texto: "No se pudo quitar el día." });
    }
  }

  async function salir() {
    await supabaseBrowser().auth.signOut();
    router.replace("/login");
  }

  const visibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return alumnos;
    return alumnos.filter((a) => (a.nombre || "").toLowerCase().includes(q));
  }, [alumnos, busqueda]);

  return (
    <div className="shell" style={{ maxWidth: 760 }}>
      <header className="topbar">
        <Wordmark />
        <button onClick={salir} className="btn btn-ghost" style={{ fontSize: 13 }}>
          Salir
        </button>
      </header>

      <div style={{ marginBottom: 16 }}>
        <h1 className="title">Alumnos</h1>
        <p className="muted small" style={{ margin: "3px 0 0" }}>
          {cargando
            ? "Cargando…"
            : `${alumnos.length} ${alumnos.length === 1 ? "alumno" : "alumnos"} registrados`}
        </p>
      </div>

      {cargando ? (
        <div className="stack">
          <Skeleton alto={120} style={{ borderRadius: 18 }} />
          <Skeleton alto={120} style={{ borderRadius: 18 }} />
          <Skeleton alto={120} style={{ borderRadius: 18 }} />
        </div>
      ) : error ? (
        <div className="stack">
          <Banner>{error}</Banner>
          <button
            className="btn btn-outline"
            onClick={() => {
              setCargando(true);
              cargar();
            }}
          >
            Reintentar
          </button>
        </div>
      ) : alumnos.length === 0 ? (
        <Empty icono="◇" titulo="Todavía no hay alumnos">
          Cuando alguien se registre desde la pantalla de ingreso, va a aparecer acá.
        </Empty>
      ) : (
        <div className="stack fade-up" style={{ gap: 12 }}>
          {alumnos.length > 4 && (
            <input
              className="input"
              placeholder="Buscar alumno…"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              aria-label="Buscar alumno"
            />
          )}

          {visibles.length === 0 && (
            <Empty icono="◌" titulo="Sin resultados">
              Ningún alumno coincide con “{busqueda}”.
            </Empty>
          )}

          {visibles.map((a) => {
            const rutina = rutinasPorAlumno[a.id];
            const ultimo = ultimoPorAlumno[a.id];
            const agenda = sesionesPorAlumno[a.id] || [];
            const abierto = panel?.alumnoId === a.id ? panel.tipo : null;
            const dias = rutina?.dias_semana || [];

            return (
              <article key={a.id} className="card">
                <div className="row" style={{ gap: 12 }}>
                  <Avatar nombre={a.nombre} />
                  <div className="grow" style={{ minWidth: 0 }}>
                    <div className="truncate" style={{ fontWeight: 600, fontSize: 15 }}>
                      {a.nombre || "Sin nombre"}
                    </div>
                    <div className="muted tiny truncate">
                      {a.objetivo || "Sin objetivo definido"}
                    </div>
                  </div>
                </div>

                <div className="row" style={{ gap: 6, marginTop: 11, flexWrap: "wrap" }}>
                  {rutina ? (
                    <span className="pill">{rutina.nombre}</span>
                  ) : (
                    <span className="pill pill-neutral">Sin rutina</span>
                  )}
                  <span className={ultimo ? "pill pill-ok" : "pill pill-warn"}>
                    {ultimo ? `Entrenó ${haceCuanto(ultimo)}` : "Nunca entrenó"}
                  </span>
                  {agenda.length > 0 && (
                    <span className="pill pill-neutral">
                      +{agenda.length} {agenda.length === 1 ? "día extra" : "días extra"}
                    </span>
                  )}
                </div>

                {/* frecuencia: un click cambia entre 3 y 5 días */}
                {rutina && (
                  <div style={{ marginTop: 12 }}>
                    <div className="row-between" style={{ marginBottom: 7 }}>
                      <span className="section-title">Frecuencia</span>
                      <span className="muted tiny">{resumenDias(dias)}</span>
                    </div>
                    <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
                      <button
                        className={
                          mismosDias(dias, PRESETS[3])
                            ? "btn btn-primary btn-sm"
                            : "btn btn-outline btn-sm"
                        }
                        onClick={() => cambiarDias(a.id, PRESETS[3])}
                      >
                        3 días
                      </button>
                      <button
                        className={
                          mismosDias(dias, PRESETS[5])
                            ? "btn btn-primary btn-sm"
                            : "btn btn-outline btn-sm"
                        }
                        onClick={() => cambiarDias(a.id, PRESETS[5])}
                      >
                        5 días
                      </button>
                      <div className="dias" style={{ marginLeft: "auto" }}>
                        {DIA_CORTO.map((d, i) => {
                          const iso = i + 1;
                          const on = dias.includes(iso);
                          return (
                            <button
                              key={d}
                              className={on ? "dia-chip dia-on" : "dia-chip"}
                              onClick={() =>
                                cambiarDias(
                                  a.id,
                                  on
                                    ? dias.filter((x) => x !== iso)
                                    : [...dias, iso].sort()
                                )
                              }
                              aria-pressed={on}
                              style={{ width: 34, fontSize: 11 }}
                            >
                              {d}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}

                <div className="row" style={{ gap: 8, marginTop: 12 }}>
                  <button
                    onClick={() => abrirPanel(a.id, "rutina")}
                    className={
                      abierto === "rutina"
                        ? "btn btn-outline btn-sm grow"
                        : "btn btn-primary btn-sm grow"
                    }
                  >
                    {abierto === "rutina"
                      ? "Cerrar"
                      : rutina
                        ? "Cambiar rutina"
                        : "Asignar rutina"}
                  </button>
                  <button
                    onClick={() => abrirPanel(a.id, "agenda")}
                    className="btn btn-outline btn-sm grow"
                  >
                    {abierto === "agenda" ? "Cerrar" : "Días extra"}
                  </button>
                </div>

                {abierto === "rutina" && (
                  <div className="fade-up">
                    <hr className="divider" />

                    <div className="tabs" style={{ marginBottom: 14 }}>
                      <button
                        className={modo === "plantilla" ? "tab tab-on" : "tab"}
                        onClick={() => setModo("plantilla")}
                      >
                        Desde plantilla
                      </button>
                      <button
                        className={modo === "manual" ? "tab tab-on" : "tab"}
                        onClick={() => setModo("manual")}
                      >
                        A medida
                      </button>
                    </div>

                    {modo === "plantilla" ? (
                      <div className="stack" style={{ gap: 12 }}>
                        <div className="stack" style={{ gap: 8 }}>
                          {plantillas.map((p) => (
                            <button
                              key={p.id}
                              className={
                                p.id === plantillaSel ? "plantilla plantilla-on" : "plantilla"
                              }
                              onClick={() => elegirPlantilla(p)}
                            >
                              <div className="row-between" style={{ marginBottom: 3 }}>
                                <span style={{ fontWeight: 600, fontSize: 14.5 }}>
                                  {p.nombre}
                                </span>
                                <span className="pill pill-neutral">{p.nivel}</span>
                              </div>
                              <div
                                className="muted tiny"
                                style={{ lineHeight: 1.45 }}
                              >
                                {p.descripcion}
                              </div>
                              <div className="muted tiny" style={{ marginTop: 5 }}>
                                Sugerida: {p.dias_sugeridos} días por semana
                              </div>
                            </button>
                          ))}
                        </div>

                        <div className="field">
                          <span className="label">Días que entrena</span>
                          <div className="dias">
                            {DIA_CORTO.map((d, i) => {
                              const iso = i + 1;
                              const on = diasSel.includes(iso);
                              return (
                                <button
                                  key={d}
                                  className={on ? "dia-chip dia-on" : "dia-chip"}
                                  onClick={() => alternarDia(iso)}
                                  aria-pressed={on}
                                >
                                  {d}
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        <Banner tipo="err">{errorForm}</Banner>

                        <button
                          className="btn btn-primary"
                          onClick={() => asignarPlantilla(a.id)}
                          disabled={guardando}
                        >
                          {guardando && <Spinner />}
                          {guardando ? "Asignando…" : "Asignar plantilla"}
                        </button>
                        <p className="muted tiny" style={{ margin: 0 }}>
                          Las sesiones se reparten en orden sobre los días elegidos. El
                          alumno ve solo la del día, con el video de cada ejercicio.
                        </p>
                      </div>
                    ) : (
                      <div className="stack" style={{ gap: 12 }}>
                        <div className="field">
                          <label className="label">Nombre de la rutina</label>
                          <input
                            className="input input-sm"
                            value={nombreRutina}
                            onChange={(e) => setNombreRutina(e.target.value)}
                            placeholder="Ej: Full body — semana 1"
                          />
                        </div>

                        <div className="stack" style={{ gap: 8 }}>
                          <span className="section-title">Ejercicios</span>
                          {filas.map((f, i) => (
                            <div
                              key={i}
                              className="stack"
                              style={{
                                gap: 6,
                                background: "var(--surface-2)",
                                borderRadius: "var(--r-md)",
                                padding: 10,
                              }}
                            >
                              <div className="row" style={{ gap: 6 }}>
                                <input
                                  className="input input-sm grow"
                                  placeholder="Ejercicio"
                                  value={f.nombre}
                                  onChange={(e) =>
                                    actualizarFila(i, "nombre", e.target.value)
                                  }
                                />
                                <button
                                  type="button"
                                  className="btn btn-ghost btn-sm"
                                  onClick={() => quitarFila(i)}
                                  aria-label="Quitar ejercicio"
                                  style={{ flex: "none" }}
                                >
                                  ✕
                                </button>
                              </div>
                              <div className="row" style={{ gap: 6 }}>
                                <input
                                  className="input input-sm grow"
                                  type="number"
                                  min="1"
                                  placeholder="Series"
                                  value={f.series}
                                  onChange={(e) =>
                                    actualizarFila(i, "series", e.target.value)
                                  }
                                />
                                <input
                                  className="input input-sm grow"
                                  placeholder="Reps"
                                  value={f.reps}
                                  onChange={(e) =>
                                    actualizarFila(i, "reps", e.target.value)
                                  }
                                />
                                <input
                                  className="input input-sm grow"
                                  placeholder="Peso"
                                  value={f.peso_sugerido}
                                  onChange={(e) =>
                                    actualizarFila(i, "peso_sugerido", e.target.value)
                                  }
                                />
                              </div>
                            </div>
                          ))}
                        </div>

                        <Banner tipo="err">{errorForm}</Banner>

                        <div className="row" style={{ gap: 8 }}>
                          <button
                            type="button"
                            className="btn btn-outline btn-sm"
                            onClick={() => setFilas((p) => [...p, { ...FILA_VACIA }])}
                          >
                            + Ejercicio
                          </button>
                          <button
                            type="button"
                            className="btn btn-primary btn-sm grow"
                            onClick={() => guardarRutinaManual(a.id)}
                            disabled={guardando}
                          >
                            {guardando && <Spinner />}
                            {guardando ? "Guardando…" : "Guardar rutina"}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {abierto === "agenda" && (
                  <div className="fade-up">
                    <hr className="divider" />
                    <div className="stack" style={{ gap: 12 }}>
                      <span className="section-title">
                        Días sueltos, además de su frecuencia habitual
                      </span>

                      <div className="row" style={{ gap: 8 }}>
                        <input
                          className="input input-sm grow"
                          type="date"
                          value={nuevaFecha}
                          min={hoyClave()}
                          onChange={(e) => setNuevaFecha(e.target.value)}
                        />
                        <button
                          className="btn btn-primary btn-sm"
                          onClick={() => programarDia(a.id)}
                        >
                          Agregar
                        </button>
                      </div>

                      <Banner tipo="err">{errorForm}</Banner>

                      {agenda.length === 0 ? (
                        <p className="muted tiny" style={{ margin: 0 }}>
                          Sin días extra de acá en adelante.
                        </p>
                      ) : (
                        <div className="stack" style={{ gap: 6 }}>
                          {agenda.map((s) => (
                            <div
                              key={s.id}
                              className="row-between"
                              style={{
                                background: "var(--surface-2)",
                                borderRadius: 10,
                                padding: "8px 12px",
                              }}
                            >
                              <span className="small">
                                {desdeClave(s.fecha).toLocaleDateString("es-AR", {
                                  weekday: "long",
                                  day: "numeric",
                                  month: "long",
                                })}
                              </span>
                              <button
                                className="btn btn-ghost btn-sm"
                                onClick={() => quitarDia(a.id, s.id)}
                                aria-label="Quitar día"
                              >
                                ✕
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}

      <Toast mensaje={toast?.texto} tipo={toast?.tipo} onCerrar={() => setToast(null)} />
    </div>
  );
}
