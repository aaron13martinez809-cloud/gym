"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "../../lib/supabaseClient";

const T = {
  orchid: "#B98CDB", surface: "#1F1A26", surface2: "#28212F",
  line: "#332B3D", text: "#EDE9F1", muted: "#948D9F",
};

export default function Profesor() {
  const router = useRouter();
  const supabase = supabaseBrowser();
  const [alumnos, setAlumnos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [abierto, setAbierto] = useState(null); // id de alumno con el form de rutina abierto
  const [nombreRutina, setNombreRutina] = useState("Rutina general");
  const [ejercicios, setEjercicios] = useState([{ nombre: "", series: 3, reps: "10", peso_sugerido: "" }]);

  useEffect(() => { cargar(); }, []);

  async function cargar() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return router.replace("/login");
    const { data } = await supabase.from("perfiles").select("*").eq("rol", "alumno").order("nombre");
    setAlumnos(data || []);
    setCargando(false);
  }

  function agregarFila() {
    setEjercicios(prev => [...prev, { nombre: "", series: 3, reps: "10", peso_sugerido: "" }]);
  }

  function actualizarFila(i, campo, valor) {
    setEjercicios(prev => prev.map((e, idx) => idx === i ? { ...e, [campo]: valor } : e));
  }

  async function guardarRutina(alumnoId) {
    const { data: { session } } = await supabase.auth.getSession();
    const { data: rutina, error } = await supabase
      .from("rutinas")
      .insert({ alumno_id: alumnoId, nombre: nombreRutina, creada_por: session.user.id })
      .select().single();
    if (error) return alert(error.message);

    for (const [i, ej] of ejercicios.entries()) {
      if (!ej.nombre) continue;
      const { data: ejercicio } = await supabase
        .from("ejercicios").insert({ nombre: ej.nombre }).select().single();
      await supabase.from("rutina_ejercicios").insert({
        rutina_id: rutina.id, ejercicio_id: ejercicio.id,
        series: ej.series, reps: ej.reps, peso_sugerido: ej.peso_sugerido, orden: i,
      });
    }
    setAbierto(null);
    setEjercicios([{ nombre: "", series: 3, reps: "10", peso_sugerido: "" }]);
    alert("Rutina asignada");
  }

  async function salir() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  if (cargando) return <div style={{ padding: 30 }}>Cargando...</div>;

  return (
    <div style={{ maxWidth: 700, margin: "0 auto", padding: "28px 20px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 22 }}>
        <div style={{ fontSize: 18 }}>Panel del profesor</div>
        <button onClick={salir} style={{ background: "none", border: "none", color: T.muted, cursor: "pointer", fontSize: 13 }}>
          Salir
        </button>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {alumnos.map(a => (
          <div key={a.id} style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 16, padding: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{a.nombre}</div>
                <div style={{ color: T.muted, fontSize: 12 }}>{a.objetivo || "Sin objetivo definido"}</div>
              </div>
              <button
                onClick={() => setAbierto(abierto === a.id ? null : a.id)}
                style={{ background: T.orchid, border: "none", borderRadius: 8, padding: "7px 12px", color: "#1A1520", fontWeight: 700, cursor: "pointer", fontSize: 12.5 }}
              >
                {abierto === a.id ? "Cerrar" : "Asignar rutina"}
              </button>
            </div>

            {abierto === a.id && (
              <div style={{ marginTop: 14, borderTop: `1px solid ${T.line}`, paddingTop: 14 }}>
                <input value={nombreRutina} onChange={e => setNombreRutina(e.target.value)}
                  placeholder="Nombre de la rutina"
                  style={{ width: "100%", marginBottom: 10, padding: "8px 10px", borderRadius: 8, background: T.surface2, border: `1px solid ${T.line}`, color: T.text, boxSizing: "border-box" }} />

                {ejercicios.map((ej, i) => (
                  <div key={i} style={{ display: "flex", gap: 6, marginBottom: 6 }}>
                    <input placeholder="Ejercicio" value={ej.nombre} onChange={e => actualizarFila(i, "nombre", e.target.value)}
                      style={{ flex: 2, padding: "7px 9px", borderRadius: 8, background: T.surface2, border: `1px solid ${T.line}`, color: T.text }} />
                    <input placeholder="Series" type="number" value={ej.series} onChange={e => actualizarFila(i, "series", e.target.value)}
                      style={{ flex: 1, padding: "7px 9px", borderRadius: 8, background: T.surface2, border: `1px solid ${T.line}`, color: T.text }} />
                    <input placeholder="Reps" value={ej.reps} onChange={e => actualizarFila(i, "reps", e.target.value)}
                      style={{ flex: 1, padding: "7px 9px", borderRadius: 8, background: T.surface2, border: `1px solid ${T.line}`, color: T.text }} />
                    <input placeholder="Peso" value={ej.peso_sugerido} onChange={e => actualizarFila(i, "peso_sugerido", e.target.value)}
                      style={{ flex: 1, padding: "7px 9px", borderRadius: 8, background: T.surface2, border: `1px solid ${T.line}`, color: T.text }} />
                  </div>
                ))}

                <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                  <button onClick={agregarFila} style={{ background: "none", border: `1px solid ${T.line}`, borderRadius: 8, padding: "7px 12px", color: T.muted, cursor: "pointer", fontSize: 12.5 }}>
                    + Ejercicio
                  </button>
                  <button onClick={() => guardarRutina(a.id)} style={{ background: T.orchid, border: "none", borderRadius: 8, padding: "7px 12px", color: "#1A1520", fontWeight: 700, cursor: "pointer", fontSize: 12.5 }}>
                    Guardar rutina
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}

        {alumnos.length === 0 && (
          <div style={{ color: T.muted, fontSize: 13.5 }}>
            Todavía no hay alumnos registrados. Cuando alguien se registre desde /login va a aparecer acá.
          </div>
        )}
      </div>
    </div>
  );
}
