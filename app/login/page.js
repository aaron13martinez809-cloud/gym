"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "../../lib/supabaseClient";

const T = {
  orchid: "#B98CDB", orchidDeep: "#8B5FAE", surface: "#1F1A26",
  line: "#332B3D", text: "#EDE9F1", muted: "#948D9F",
};

export default function Login() {
  const router = useRouter();
  const supabase = supabaseBrowser();
  const [modo, setModo] = useState("entrar");
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [nombre, setNombre] = useState("");
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);

  async function entrar(e) {
    e.preventDefault();
    setError(""); setCargando(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password: pass });
    setCargando(false);
    if (error) return setError(error.message);
    router.replace("/");
  }

  async function registrar(e) {
    e.preventDefault();
    setError(""); setCargando(true);
    const { data, error } = await supabase.auth.signUp({ email, password: pass });
    if (error) { setCargando(false); return setError(error.message); }
    // crea el perfil asociado (rol alumno por defecto; el profesor se promueve luego desde Supabase)
    if (data.user) {
      await supabase.from("perfiles").insert({ id: data.user.id, nombre, rol: "alumno" });
    }
    setCargando(false);
    router.replace("/");
  }

  const inputStyle = {
    width: "100%", padding: "10px 12px", borderRadius: 10, marginBottom: 12,
    background: "#28212F", border: `1px solid ${T.line}`, color: T.text, fontSize: 14, boxSizing: "border-box",
  };

  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", padding: 20 }}>
      <form onSubmit={modo === "entrar" ? entrar : registrar} style={{
        width: 340, background: T.surface, border: `1px solid ${T.line}`, borderRadius: 18, padding: 26,
      }}>
        <div style={{ fontSize: 20, marginBottom: 18 }}>
          Núcleo <span style={{ color: T.orchid }}>Gym</span>
        </div>

        {modo === "registrar" && (
          <input style={inputStyle} placeholder="Nombre y apellido" value={nombre}
            onChange={e => setNombre(e.target.value)} required />
        )}
        <input style={inputStyle} type="email" placeholder="Email" value={email}
          onChange={e => setEmail(e.target.value)} required />
        <input style={inputStyle} type="password" placeholder="Contraseña" value={pass}
          onChange={e => setPass(e.target.value)} required minLength={6} />

        {error && <div style={{ color: "#D97A7A", fontSize: 13, marginBottom: 10 }}>{error}</div>}

        <button type="submit" disabled={cargando} style={{
          width: "100%", padding: "11px", borderRadius: 10, border: "none",
          background: T.orchid, color: "#1A1520", fontWeight: 700, cursor: "pointer", marginBottom: 10,
        }}>
          {cargando ? "Un momento..." : modo === "entrar" ? "Entrar" : "Crear cuenta"}
        </button>

        <div
          onClick={() => setModo(modo === "entrar" ? "registrar" : "entrar")}
          style={{ color: T.muted, fontSize: 13, textAlign: "center", cursor: "pointer" }}
        >
          {modo === "entrar" ? "¿Sos nuevo? Creá tu cuenta" : "¿Ya tenés cuenta? Entrá"}
        </div>
      </form>
    </div>
  );
}
