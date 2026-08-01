"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "../../lib/supabaseClient";
import {
  aNumero,
  claveDia,
  calcularRacha,
  desdeClave,
  hoyClave,
  parseTimestamp,
} from "../../lib/fechas";
import {
  DIA_CORTO,
  NOMBRE_DIA,
  isoDia,
  proximoEntrenamiento,
  resumenDias,
  semanaDe,
  sesionDe,
} from "../../lib/rutinas";
import {
  Avatar,
  Banner,
  Check,
  Empty,
  IconoPlay,
  ModalVideo,
  Ring,
  Skeleton,
  Toast,
  Wordmark,
} from "../../components/ui";
import { GraficoLinea, Stat } from "../../components/charts";
import { Calendario } from "../../components/calendario";

const MEDIDAS = [
  { campo: "peso_kg", etiqueta: "Peso", unidad: "kg" },
  { campo: "cintura_cm", etiqueta: "Cintura", unidad: "cm" },
  { campo: "cadera_cm", etiqueta: "Cadera", unidad: "cm" },
  { campo: "pecho_cm", etiqueta: "Pecho", unidad: "cm" },
  { campo: "brazo_cm", etiqueta: "Brazo", unidad: "cm" },
  { campo: "muslo_cm", etiqueta: "Muslo", unidad: "cm" },
];

const FORM_VACIO = {
  fecha: hoyClave(),
  peso_kg: "",
  cintura_cm: "",
  cadera_cm: "",
  pecho_cm: "",
  brazo_cm: "",
  muslo_cm: "",
};

function inicioDeHoyUTC() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

export default function Alumno() {
  const router = useRouter();

  const [tab, setTab] = useState("hoy");
  const [perfil, setPerfil] = useState(null);
  const [rutina, setRutina] = useState(null);
  const [sesiones, setSesiones] = useState([]);
  const [items, setItems] = useState([]);
  const [registros, setRegistros] = useState([]);
  const [mediciones, setMediciones] = useState([]);
  const [programadas, setProgramadas] = useState([]);

  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState(null);
  const [toast, setToast] = useState(null);
  const [video, setVideo] = useState(null);

  const [form, setForm] = useState(FORM_VACIO);
  const [errorForm, setErrorForm] = useState("");
  const [guardandoMed, setGuardandoMed] = useState(false);
  const [ejercicioSel, setEjercicioSel] = useState(null);

  const cargar = useCallback(async () => {
    const supabase = supabaseBrowser();
    setError("");

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) return router.replace("/login");
      const uid = session.user.id;

      const { data: p, error: ep } = await supabase
        .from("perfiles")
        .select("*")
        .eq("id", uid)
        .maybeSingle();
      if (ep) throw ep;
      setPerfil(p);

      const [rRutinas, rRegistros, rMediciones, rProgramadas] = await Promise.all([
        supabase
          .from("rutinas")
          .select("id, nombre, creado_en, plantilla_id, dias_semana, inicio")
          .eq("alumno_id", uid)
          .order("creado_en", { ascending: false })
          .limit(1),
        supabase
          .from("registros")
          .select(
            "id, hecho_en, peso_usado, rutina_ejercicio_id, rutina_ejercicios(ejercicios(nombre))"
          )
          .eq("alumno_id", uid)
          .order("hecho_en"),
        supabase.from("mediciones").select("*").eq("alumno_id", uid).order("fecha"),
        supabase.from("sesiones_programadas").select("fecha").eq("alumno_id", uid),
      ]);

      for (const r of [rRutinas, rRegistros, rMediciones, rProgramadas]) {
        if (r.error) throw r.error;
      }

      setRegistros(rRegistros.data || []);
      setMediciones(rMediciones.data || []);
      setProgramadas(rProgramadas.data || []);

      const actual = rRutinas.data?.[0] || null;
      setRutina(actual);

      if (!actual) {
        setItems([]);
        setSesiones([]);
        return;
      }

      const [rItems, rSesiones] = await Promise.all([
        supabase
          .from("rutina_ejercicios")
          .select("*, ejercicios(nombre, musculos, video_url)")
          .eq("rutina_id", actual.id)
          .order("bloque")
          .order("orden"),
        actual.plantilla_id
          ? supabase
              .from("plantilla_sesiones")
              .select("orden, nombre, grupos")
              .eq("plantilla_id", actual.plantilla_id)
              .order("orden")
          : Promise.resolve({ data: [], error: null }),
      ]);

      if (rItems.error) throw rItems.error;
      if (rSesiones.error) throw rSesiones.error;

      setItems(rItems.data || []);
      setSesiones(rSesiones.data || []);
    } catch (err) {
      setError(
        err?.message
          ? `No pudimos cargar tus datos: ${err.message}`
          : "No pudimos cargar tus datos."
      );
    } finally {
      setCargando(false);
    }
  }, [router]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  /* ---------- derivados ---------- */

  const hoy = hoyClave();
  const conPlantilla = Boolean(rutina?.plantilla_id && sesiones.length);

  const sesionHoy = useMemo(
    () => (conPlantilla ? sesionDe(new Date(), rutina, sesiones) : null),
    [conPlantilla, rutina, sesiones]
  );

  // Con plantilla mostramos solo la sesión del día; una rutina hecha a mano
  // tiene todo en el bloque 0 y se muestra entera, como antes.
  const itemsHoy = useMemo(() => {
    if (!conPlantilla) return items;
    if (!sesionHoy) return [];
    return items.filter((i) => i.bloque === sesionHoy.orden);
  }, [conPlantilla, items, sesionHoy]);

  const proxima = useMemo(
    () =>
      conPlantilla && !sesionHoy
        ? proximoEntrenamiento(new Date(), rutina, sesiones)
        : null,
    [conPlantilla, sesionHoy, rutina, sesiones]
  );

  const agendaSemana = useMemo(
    () => (conPlantilla ? semanaDe(new Date(), rutina, sesiones) : []),
    [conPlantilla, rutina, sesiones]
  );

  const hechosHoy = useMemo(() => {
    const s = new Set();
    for (const r of registros) {
      if (claveDia(parseTimestamp(r.hecho_en)) === hoy) s.add(r.rutina_ejercicio_id);
    }
    return s;
  }, [registros, hoy]);

  const diasEntrenados = useMemo(
    () => new Set(registros.map((r) => claveDia(parseTimestamp(r.hecho_en)))),
    [registros]
  );

  const diasProgramados = useMemo(
    () => new Set(programadas.map((s) => s.fecha)),
    [programadas]
  );

  const racha = useMemo(() => calcularRacha(diasEntrenados), [diasEntrenados]);

  const seriePeso = useMemo(
    () =>
      mediciones
        .filter((m) => m.peso_kg != null)
        .map((m) => ({ x: desdeClave(m.fecha), y: Number(m.peso_kg) })),
    [mediciones]
  );

  const porEjercicio = useMemo(() => {
    const mapa = new Map();
    for (const r of registros) {
      const nombre = r.rutina_ejercicios?.ejercicios?.nombre;
      const peso = aNumero(r.peso_usado);
      if (!nombre || peso == null) continue;

      if (!mapa.has(nombre)) mapa.set(nombre, new Map());
      const dias = mapa.get(nombre);
      const clave = claveDia(parseTimestamp(r.hecho_en));
      dias.set(clave, Math.max(dias.get(clave) ?? 0, peso));
    }

    return [...mapa.entries()]
      .map(([nombre, dias]) => {
        const puntos = [...dias.entries()]
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([clave, y]) => ({ x: desdeClave(clave), y }));
        return { nombre, puntos, pr: Math.max(...puntos.map((p) => p.y)) };
      })
      .sort((a, b) => b.puntos.length - a.puntos.length);
  }, [registros]);

  const ejercicioActivo =
    porEjercicio.find((e) => e.nombre === ejercicioSel) || porEjercicio[0] || null;

  const total = itemsHoy.length;
  const completos = itemsHoy.filter((i) => hechosHoy.has(i.id)).length;
  const terminado = total > 0 && completos === total;
  const primerNombre = perfil?.nombre?.trim().split(" ")[0];
  const ultimoPeso = seriePeso.at(-1)?.y ?? null;

  /* ---------- acciones ---------- */

  async function alternar(item) {
    if (guardando) return;
    const supabase = supabaseBrowser();
    const estaHecho = hechosHoy.has(item.id);
    setGuardando(item.id);

    if (estaHecho) {
      const previos = registros;
      setRegistros((p) =>
        p.filter(
          (r) =>
            !(
              r.rutina_ejercicio_id === item.id &&
              claveDia(parseTimestamp(r.hecho_en)) === hoy
            )
        )
      );
      const { error } = await supabase
        .from("registros")
        .delete()
        .eq("alumno_id", perfil.id)
        .eq("rutina_ejercicio_id", item.id)
        .gte("hecho_en", inicioDeHoyUTC());
      setGuardando(null);
      if (error) {
        setRegistros(previos);
        setToast({ tipo: "err", texto: "No se pudo deshacer. Probá de nuevo." });
      }
      return;
    }

    const { data, error } = await supabase
      .from("registros")
      .insert({
        alumno_id: perfil.id,
        rutina_ejercicio_id: item.id,
        peso_usado: item.peso_sugerido,
        reps_reales: item.reps,
      })
      .select("id, hecho_en, peso_usado, rutina_ejercicio_id")
      .single();

    setGuardando(null);

    if (error) {
      setToast({ tipo: "err", texto: "No se pudo guardar. Probá de nuevo." });
      return;
    }

    setRegistros((p) => [
      ...p,
      {
        ...data,
        rutina_ejercicios: { ejercicios: { nombre: item.ejercicios?.nombre } },
      },
    ]);
  }

  async function guardarMedicion(e) {
    e.preventDefault();
    setErrorForm("");

    const valores = {};
    for (const { campo, etiqueta } of MEDIDAS) {
      const bruto = form[campo].trim();
      if (!bruto) {
        valores[campo] = null;
        continue;
      }
      const n = aNumero(bruto);
      if (n == null || n <= 0) {
        return setErrorForm(`El valor de ${etiqueta} no es un número válido.`);
      }
      valores[campo] = n;
    }

    if (Object.values(valores).every((v) => v == null)) {
      return setErrorForm("Cargá al menos un dato.");
    }

    setGuardandoMed(true);
    const supabase = supabaseBrowser();
    const { data, error } = await supabase
      .from("mediciones")
      .upsert(
        { alumno_id: perfil.id, fecha: form.fecha, ...valores },
        { onConflict: "alumno_id,fecha" }
      )
      .select()
      .single();
    setGuardandoMed(false);

    if (error) return setErrorForm(error.message);

    setMediciones((p) =>
      [...p.filter((m) => m.fecha !== data.fecha), data].sort((a, b) =>
        a.fecha.localeCompare(b.fecha)
      )
    );
    setForm({ ...FORM_VACIO, fecha: form.fecha });
    setToast({ tipo: "ok", texto: "Medición guardada." });
  }

  async function salir() {
    await supabaseBrowser().auth.signOut();
    router.replace("/login");
  }

  /* ---------- render ---------- */

  if (cargando) {
    return (
      <div className="shell">
        <header className="topbar">
          <Wordmark />
        </header>
        <div className="stack" style={{ gap: 14 }}>
          <Skeleton alto={148} style={{ borderRadius: 18 }} />
          <Skeleton alto={48} />
          <Skeleton alto={62} />
          <Skeleton alto={62} />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="shell">
        <header className="topbar">
          <Wordmark />
          <button onClick={salir} className="btn btn-ghost" style={{ fontSize: 13 }}>
            Salir
          </button>
        </header>
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
      </div>
    );
  }

  return (
    <div className="shell">
      <header className="topbar">
        <Wordmark />
        <button onClick={salir} className="btn btn-ghost" style={{ fontSize: 13 }}>
          Salir
        </button>
      </header>

      <div className="stack fade-up" style={{ gap: 16 }}>
        <section className="card">
          <div className="row" style={{ gap: 16 }}>
            <Avatar nombre={perfil?.nombre} />
            <div className="grow" style={{ minWidth: 0 }}>
              <h1 className="title" style={{ fontSize: 22 }}>
                Hola{primerNombre ? `, ${primerNombre}` : ""}
              </h1>
              <p className="muted small" style={{ margin: "2px 0 0" }}>
                {!rutina
                  ? "Sin rutina activa"
                  : conPlantilla && !sesionHoy
                    ? "Hoy descansás"
                    : total === 0
                      ? "Sin ejercicios cargados"
                      : terminado
                        ? "Entrenamiento completo. Buen trabajo."
                        : `${completos} de ${total} ejercicios hechos hoy`}
              </p>
            </div>
            {total > 0 && <Ring hechos={completos} total={total} />}
          </div>

          <hr className="divider" />

          <div className="stats">
            <Stat
              etiqueta="Racha"
              valor={racha}
              unidad={racha === 1 ? "día" : "días"}
            />
            <Stat etiqueta="Entrenamientos" valor={diasEntrenados.size} />
            {ultimoPeso != null && (
              <Stat etiqueta="Peso actual" valor={ultimoPeso} unidad="kg" />
            )}
          </div>
        </section>

        <nav className="tabs" role="tablist">
          {[
            ["hoy", "Hoy"],
            ["progreso", "Progreso"],
            ["calendario", "Calendario"],
          ].map(([id, texto]) => (
            <button
              key={id}
              role="tab"
              aria-selected={tab === id}
              className={tab === id ? "tab tab-on" : "tab"}
              onClick={() => setTab(id)}
            >
              {texto}
            </button>
          ))}
        </nav>

        {tab === "hoy" && (
          <section className="card fade-up">
            <div className="card-head">
              <div className="grow" style={{ minWidth: 0 }}>
                <div className="section-title">
                  {sesionHoy ? "Hoy te toca" : "Rutina actual"}
                </div>
                <div
                  className="truncate"
                  style={{ fontWeight: 600, fontSize: 16, marginTop: 3 }}
                >
                  {sesionHoy?.nombre || rutina?.nombre || "—"}
                </div>
                {sesionHoy?.grupos && (
                  <div className="muted tiny">{sesionHoy.grupos}</div>
                )}
              </div>
              {terminado && <span className="pill pill-ok">Completa</span>}
            </div>

            {!rutina ? (
              <Empty icono="◇" titulo="Todavía no tenés rutina">
                Cuando tu profesor te asigne una, la vas a ver acá.
              </Empty>
            ) : conPlantilla && !sesionHoy ? (
              <Empty icono="◠" titulo="Hoy es día de descanso">
                {proxima ? (
                  <>
                    Volvés el{" "}
                    <strong style={{ color: "var(--text)" }}>
                      {NOMBRE_DIA[isoDia(proxima.fecha) - 1]}
                    </strong>{" "}
                    con {proxima.sesion.nombre.toLowerCase()}.
                  </>
                ) : (
                  "Descansá y volvé mañana."
                )}
              </Empty>
            ) : total === 0 ? (
              <Empty icono="◇" titulo="Sin ejercicios cargados">
                Tu rutina no tiene ejercicios para hoy.
              </Empty>
            ) : (
              <div className="stack" style={{ gap: 9 }}>
                {itemsHoy.map((it) => {
                  const hecho = hechosHoy.has(it.id);
                  return (
                    <div key={it.id} className={hecho ? "ex ex-done" : "ex"}>
                      <button
                        type="button"
                        className="ex-main"
                        onClick={() => alternar(it)}
                        disabled={guardando === it.id}
                        aria-pressed={hecho}
                      >
                        <Check activo={hecho} />
                        <span className="grow" style={{ minWidth: 0 }}>
                          <span className="ex-name truncate" style={{ display: "block" }}>
                            {it.ejercicios?.nombre || "Ejercicio"}
                          </span>
                          <span
                            className="muted tiny truncate"
                            style={{ display: "block" }}
                          >
                            {it.ejercicios?.musculos || "Sin grupo muscular"}
                          </span>
                        </span>
                        <span
                          className="numeral small"
                          style={{ flex: "none", textAlign: "right" }}
                        >
                          {it.series} × {it.reps}
                          {it.peso_sugerido && (
                            <span className="muted tiny" style={{ display: "block" }}>
                              {it.peso_sugerido}
                            </span>
                          )}
                        </span>
                      </button>

                      <button
                        type="button"
                        className="ex-video"
                        onClick={() => setVideo(it.ejercicios)}
                        aria-label={`Ver cómo se hace ${it.ejercicios?.nombre || "el ejercicio"}`}
                        title="Ver demostración"
                      >
                        <IconoPlay />
                      </button>
                    </div>
                  );
                })}
                <p className="muted tiny" style={{ margin: "4px 2px 0" }}>
                  Tocá un ejercicio para marcarlo como hecho, o el ▷ para ver cómo se
                  hace.
                </p>
              </div>
            )}
          </section>
        )}

        {tab === "progreso" && (
          <div className="stack fade-up" style={{ gap: 16 }}>
            <section className="card">
              <div className="card-head">
                <div className="section-title">Peso corporal</div>
              </div>
              <GraficoLinea datos={seriePeso} unidad="kg" etiquetaY="Peso" />
            </section>

            <section className="card">
              <div className="card-head">
                <div className="section-title">Progresión por ejercicio</div>
              </div>

              {porEjercicio.length === 0 ? (
                <Empty icono="◠" titulo="Todavía no hay marcas">
                  Cuando marques ejercicios con peso, vas a ver acá cómo progresás en
                  cada uno.
                </Empty>
              ) : (
                <div className="stack" style={{ gap: 12 }}>
                  <div className="chips">
                    {porEjercicio.map((e) => (
                      <button
                        key={e.nombre}
                        className={
                          e.nombre === ejercicioActivo?.nombre ? "chip chip-on" : "chip"
                        }
                        onClick={() => setEjercicioSel(e.nombre)}
                      >
                        {e.nombre}
                      </button>
                    ))}
                  </div>

                  {ejercicioActivo && (
                    <>
                      <div className="stats">
                        <Stat etiqueta="Récord" valor={ejercicioActivo.pr} unidad="kg" />
                        <Stat
                          etiqueta="Sesiones"
                          valor={ejercicioActivo.puntos.length}
                        />
                      </div>
                      <GraficoLinea
                        datos={ejercicioActivo.puntos}
                        unidad="kg"
                        etiquetaY="Peso"
                      />
                    </>
                  )}
                </div>
              )}
            </section>

            <section className="card">
              <div className="card-head">
                <div className="section-title">Cargar medición</div>
              </div>

              <form onSubmit={guardarMedicion} className="stack" style={{ gap: 12 }}>
                <div className="field">
                  <label className="label" htmlFor="fecha">
                    Fecha
                  </label>
                  <input
                    id="fecha"
                    className="input input-sm"
                    type="date"
                    value={form.fecha}
                    max={hoy}
                    onChange={(e) => setForm({ ...form, fecha: e.target.value })}
                    required
                  />
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
                    gap: 10,
                  }}
                >
                  {MEDIDAS.map(({ campo, etiqueta, unidad }) => (
                    <div className="field" key={campo}>
                      <label className="label" htmlFor={campo}>
                        {etiqueta} ({unidad})
                      </label>
                      <input
                        id={campo}
                        className="input input-sm"
                        inputMode="decimal"
                        placeholder="—"
                        value={form[campo]}
                        onChange={(e) => setForm({ ...form, [campo]: e.target.value })}
                      />
                    </div>
                  ))}
                </div>

                <Banner tipo="err">{errorForm}</Banner>

                <button type="submit" className="btn btn-primary" disabled={guardandoMed}>
                  {guardandoMed ? "Guardando…" : "Guardar medición"}
                </button>
                <p className="muted tiny" style={{ margin: 0 }}>
                  Dejá en blanco lo que no midas. Si ya cargaste algo en esa fecha, se
                  reemplaza.
                </p>
              </form>
            </section>
          </div>
        )}

        {tab === "calendario" && (
          <div className="stack fade-up" style={{ gap: 16 }}>
            {conPlantilla && (
              <section className="card">
                <div className="card-head">
                  <div className="grow">
                    <div className="section-title">Tu semana</div>
                    <div style={{ fontWeight: 600, fontSize: 15, marginTop: 3 }}>
                      {rutina.dias_semana.length} días · {resumenDias(rutina.dias_semana)}
                    </div>
                  </div>
                </div>

                <div className="stack" style={{ gap: 7 }}>
                  {agendaSemana.map((d) => {
                    const esHoy = claveDia(d.fecha) === hoy;
                    return (
                      <div
                        key={d.iso}
                        className={esHoy ? "agenda-fila agenda-hoy" : "agenda-fila"}
                      >
                        <span className="agenda-dia">{DIA_CORTO[d.iso - 1]}</span>
                        <span className="grow" style={{ minWidth: 0 }}>
                          <span
                            className="truncate"
                            style={{ display: "block", fontWeight: 600, fontSize: 14 }}
                          >
                            {d.sesion.nombre}
                          </span>
                          <span className="muted tiny truncate" style={{ display: "block" }}>
                            {d.sesion.grupos}
                          </span>
                        </span>
                        {esHoy && <span className="pill">Hoy</span>}
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            <section className="card">
              <Calendario
                dias={diasEntrenados}
                programados={diasProgramados}
                rutina={rutina}
                sesiones={sesiones}
              />
            </section>
          </div>
        )}
      </div>

      <ModalVideo ejercicio={video} onCerrar={() => setVideo(null)} />

      <Toast
        mensaje={toast?.texto}
        tipo={toast?.tipo}
        onCerrar={() => setToast(null)}
      />
    </div>
  );
}
