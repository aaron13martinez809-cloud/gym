"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "../../lib/supabaseClient";

const T = {
  orchid: "#B98CDB", orchidDeep: "#8B5FAE", surface: "#1F1A26", surface2: "#28212F",
  line: "#332B3D", text: "#EDE9F1", muted: "#948D9F", good: "#7FC29B",
};

export default function Alumno() {
  const router = useRouter();
  const supabase = supabaseBrowser();
  const [perfil, setPerfil] = useState(null);
  const [items, setItems] = useState([]); // rutina_ejercicios con datos del ejercicio
  const [cargando, setCargando] = useState(true);

  useEffect(() => { cargar(); }, []);

  async function cargar() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return router.replace("/login");

    const { data: p } = await supabase.from("perfiles").select("*").eq("id", session.user.id).single();
    setPerfil(p);

    const { data: rutinas } = await supabase
      .from("rutinas").select("id").eq("alumno_id", session.user.id)
      .order("creado_en", { ascending: false }).limit(1);

    if (rutinas?.length) {
      const { data: ejs } = await supabase
        .from("rutina_ejercicios")
        .select("*, ejercicios(nombre, musculos)")
        .eq("rutina_id", rutinas[0].id)
        .order("orden");
      setItems(ejs || []);
    }
    setCargando(false);
  }

  async function marcarHecho(item) {
    await supabase.from("registros").insert({
      alumno_id: perfil.id,
      rutina_ejercicio_id: item.id,
      peso_usado: item.peso_sugerido,
      reps_reales: item.reps,
    });
    setItems(prev => prev.map(i => i.id === item.id ? { ...i, hecho: true } : i));
  }

  async function salir() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  if (cargando) return <div style={{ padding: 30 }}>Cargando...</div>;

  return (
    <div style={{ maxWidth: 640, margin: "0 auto", padding: "28px 20px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 22 }}>
        <div style={{ fontSize: 18 }}>Hola, {perfil?.nombre?.split(" ")[0] || "alumno"}</div>
        <button onClick={salir} style={{ background: "none", border: "none", color: T.muted, cursor: "pointer", fontSize: 13 }}>
          Salir
        </button>
      </div>

      <div style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 18, padding: 20 }}>
        <div style={{ fontSize: 15, marginBottom: 14 }}>Rutina actual</div>

        {items.length === 0 && (
          <div style={{ color: T.muted, fontSize: 13.5 }}>
            Todavía no tenés una rutina asignada. Pedile a tu profesor que te cree una.
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {items.map(it => (
            <div key={it.id} onClick={() => !it.hecho && marcarHecho(it)} style={{
              display: "flex", alignItems: "center", gap: 12, padding: "12px 14px",
              background: T.surface2, borderRadius: 14, cursor: it.hecho ? "default" : "pointer",
              opacity: it.hecho ? 0.6 : 1,
            }}>
              <div style={{
                width: 20, height: 20, borderRadius: "50%",
                border: `2px solid ${it.hecho ? T.good : T.muted}`,
                background: it.hecho ? T.good : "transparent",
              }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 14, textDecoration: it.hecho ? "line-through" : "none" }}>
                  {it.ejercicios?.nombre}
                </div>
                <div style={{ color: T.muted, fontSize: 12 }}>{it.ejercicios?.musculos}</div>
              </div>
              <div style={{ fontSize: 13, color: T.text }}>
                {it.series} × {it.reps} · {it.peso_sugerido}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
