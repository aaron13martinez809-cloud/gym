"use client";

import { useEffect, useRef } from "react";

/* Marca */

export function Wordmark({ size }) {
  return (
    <div className="wordmark" style={size ? { fontSize: size } : undefined}>
      Núcleo <em>Gym</em>
    </div>
  );
}

/* Inicial del alumno/profesor como avatar */

export function Avatar({ nombre }) {
  const inicial = (nombre || "?").trim().charAt(0).toUpperCase() || "?";
  return <div className="avatar">{inicial}</div>;
}

/* Feedback */

export function Spinner({ grande }) {
  return <span className={grande ? "spinner spinner-lg" : "spinner"} />;
}

export function Skeleton({ alto = 60, style }) {
  return <div className="skeleton" style={{ height: alto, ...style }} />;
}

export function Banner({ tipo = "err", children }) {
  if (!children) return null;
  return (
    <div className={`banner banner-${tipo}`} role="alert">
      <span aria-hidden="true">{tipo === "err" ? "⚠" : "✓"}</span>
      <span>{children}</span>
    </div>
  );
}

export function Empty({ icono = "◇", titulo, children }) {
  return (
    <div className="empty">
      <div className="empty-icon" aria-hidden="true">
        {icono}
      </div>
      {titulo && (
        <div style={{ color: "var(--text)", fontWeight: 600, marginBottom: 4 }}>
          {titulo}
        </div>
      )}
      {children}
    </div>
  );
}

/* Toast que se cierra solo — reemplaza los alert() */

export function Toast({ mensaje, tipo = "ok", onCerrar, ms = 3200 }) {
  // guardamos el callback en un ref: si dependiéramos de él, cada render del
  // padre reiniciaría el temporizador y el toast no se cerraría nunca.
  const cerrarRef = useRef(onCerrar);
  cerrarRef.current = onCerrar;

  useEffect(() => {
    if (!mensaje) return;
    const t = setTimeout(() => cerrarRef.current?.(), ms);
    return () => clearTimeout(t);
  }, [mensaje, ms]);

  if (!mensaje) return null;
  return (
    <div className={`toast toast-${tipo}`} role="status" onClick={onCerrar}>
      {mensaje}
    </div>
  );
}

/* Tilde del ejercicio completado */

export function Check({ activo }) {
  return (
    <span className={activo ? "check check-on" : "check"} aria-hidden="true">
      {activo && (
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
          <path
            d="M2.5 6.2 4.8 8.5 9.5 3.8"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )}
    </span>
  );
}

/* Video de demostración. Se embebe con el reproductor oficial de YouTube:
   no alojamos ni redistribuimos el archivo. */

/** youtube.com/embed/ID → youtube.com/watch?v=ID (deja pasar cualquier otra cosa). */
function urlDeVideo(url = "") {
  const m = url.match(/youtube\.com\/embed\/([\w-]+)/);
  return m ? `https://www.youtube.com/watch?v=${m[1]}` : url;
}

export function ModalVideo({ ejercicio, onCerrar }) {
  useEffect(() => {
    if (!ejercicio) return;
    const alTecla = (e) => e.key === "Escape" && onCerrar();
    window.addEventListener("keydown", alTecla);
    // el fondo no debe scrollear detrás del modal
    const previo = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", alTecla);
      document.body.style.overflow = previo;
    };
  }, [ejercicio, onCerrar]);

  if (!ejercicio) return null;

  return (
    <div
      className="modal-fondo"
      onClick={onCerrar}
      role="dialog"
      aria-modal="true"
      aria-label={`Cómo hacer ${ejercicio.nombre}`}
    >
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="card-head">
          <div className="grow" style={{ minWidth: 0 }}>
            <div className="truncate" style={{ fontWeight: 600, fontSize: 15 }}>
              {ejercicio.nombre}
            </div>
            <div className="muted tiny truncate">{ejercicio.musculos}</div>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={onCerrar} aria-label="Cerrar">
            ✕
          </button>
        </div>

        {ejercicio.video_url ? (
          <>
            <div className="video-marco">
              <iframe
                src={ejercicio.video_url}
                title={`Demostración de ${ejercicio.nombre}`}
                allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                loading="lazy"
                referrerPolicy="strict-origin-when-cross-origin"
              />
            </div>
            {/* salida de emergencia: si el dueño del video deshabilitó el embed,
                el reproductor de arriba muestra un error y este link igual sirve */}
            <a
              className="btn btn-ghost btn-block"
              style={{ marginTop: 8, fontSize: 12.5, fontWeight: 500 }}
              href={urlDeVideo(ejercicio.video_url)}
              target="_blank"
              rel="noopener noreferrer"
            >
              ¿No se ve? Abrir en YouTube ↗
            </a>
          </>
        ) : (
          <Empty icono="▷" titulo="Sin video todavía">
            Este ejercicio no tiene demostración cargada.
          </Empty>
        )}
      </div>
    </div>
  );
}

export function IconoPlay() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="8" cy="8" r="6.6" stroke="currentColor" strokeWidth="1.4" />
      <path d="M6.6 5.4 10.6 8l-4 2.6V5.4Z" fill="currentColor" />
    </svg>
  );
}

/* Anillo de progreso: hechos / total */

export function Ring({ hechos, total }) {
  const pct = total > 0 ? Math.round((hechos / total) * 100) : 0;
  return (
    <div
      className="ring"
      style={{ "--pct": pct }}
      role="img"
      aria-label={`${hechos} de ${total} ejercicios completados`}
    >
      <span className="ring-inner">{pct}%</span>
    </div>
  );
}
