"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "../../lib/supabaseClient";
import { Wordmark, Banner, Spinner } from "../../components/ui";

// Supabase devuelve los errores en inglés; los pasamos a algo legible.
function traducir(msg = "") {
  const m = msg.toLowerCase();
  if (m.includes("invalid login credentials")) return "Email o contraseña incorrectos.";
  if (m.includes("email not confirmed")) return "Todavía no confirmaste tu email. Revisá tu casilla.";
  if (m.includes("user already registered") || m.includes("already been registered"))
    return "Ese email ya tiene una cuenta. Probá entrar.";
  if (m.includes("password should be at least"))
    return "La contraseña necesita al menos 6 caracteres.";
  if (m.includes("unable to validate email") || m.includes("invalid email"))
    return "Ese email no parece válido.";
  if (m.includes("rate limit") || m.includes("too many"))
    return "Demasiados intentos seguidos. Esperá un minuto.";
  if (m.includes("fetch") || m.includes("network"))
    return "Sin conexión con el servidor. Revisá tu internet.";
  return msg || "Algo salió mal. Intentá de nuevo.";
}

export default function Login() {
  const router = useRouter();
  const supabase = supabaseBrowser();

  const [modo, setModo] = useState("entrar");
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [nombre, setNombre] = useState("");
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");
  const [cargando, setCargando] = useState(false);

  const registrando = modo === "registrar";

  function cambiarModo() {
    setModo(registrando ? "entrar" : "registrar");
    setError("");
    setAviso("");
  }

  async function enviar(e) {
    e.preventDefault();
    setError("");
    setAviso("");
    setCargando(true);

    try {
      if (registrando) {
        // el nombre viaja en la metadata: el trigger handle_new_user() lo usa
        // para crear la fila en `perfiles` del lado del servidor.
        const { data, error } = await supabase.auth.signUp({
          email,
          password: pass,
          options: { data: { nombre: nombre.trim() } },
        });
        if (error) throw error;

        if (!data.session) {
          // el proyecto pide confirmación por email
          setAviso("Cuenta creada. Confirmá tu email y después entrá.");
          setModo("entrar");
          setPass("");
          return;
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password: pass,
        });
        if (error) throw error;
      }

      router.replace("/");
    } catch (err) {
      setError(traducir(err?.message));
    } finally {
      setCargando(false);
    }
  }

  return (
    <div className="center-screen">
      <form
        onSubmit={enviar}
        className="card fade-up"
        style={{ width: "100%", maxWidth: 372 }}
        noValidate
      >
        <div style={{ marginBottom: 6 }}>
          <Wordmark size={23} />
        </div>
        <p className="muted small" style={{ margin: "0 0 20px" }}>
          {registrando
            ? "Creá tu cuenta para empezar a entrenar."
            : "Entrá para ver tu rutina de hoy."}
        </p>

        <div className="stack" style={{ gap: 13 }}>
          {registrando && (
            <div className="field">
              <label className="label" htmlFor="nombre">
                Nombre y apellido
              </label>
              <input
                id="nombre"
                className="input"
                placeholder="Ana Gómez"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                autoComplete="name"
                required
              />
            </div>
          )}

          <div className="field">
            <label className="label" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              className="input"
              type="email"
              inputMode="email"
              placeholder="vos@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
            />
          </div>

          <div className="field">
            <label className="label" htmlFor="pass">
              Contraseña
            </label>
            <input
              id="pass"
              className="input"
              type="password"
              placeholder="Mínimo 6 caracteres"
              value={pass}
              onChange={(e) => setPass(e.target.value)}
              autoComplete={registrando ? "new-password" : "current-password"}
              required
              minLength={6}
            />
          </div>

          <Banner tipo="err">{error}</Banner>
          <Banner tipo="ok">{aviso}</Banner>

          <button
            type="submit"
            className="btn btn-primary btn-block"
            disabled={cargando}
            style={{ marginTop: 3 }}
          >
            {cargando && <Spinner />}
            {cargando
              ? "Un momento…"
              : registrando
                ? "Crear cuenta"
                : "Entrar"}
          </button>

          <button
            type="button"
            onClick={cambiarModo}
            className="btn btn-ghost btn-block"
            style={{ fontWeight: 500, fontSize: 13 }}
          >
            {registrando ? "¿Ya tenés cuenta? Entrá" : "¿Sos nuevo? Creá tu cuenta"}
          </button>
        </div>
      </form>
    </div>
  );
}
