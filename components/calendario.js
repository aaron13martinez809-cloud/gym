"use client";

import { useState } from "react";
import { claveDia, grillaMes, hoyClave, NOMBRE_MES } from "../lib/fechas";
import { abrevSesion, sesionDe } from "../lib/rutinas";

const DIAS = ["Lu", "Ma", "Mi", "Ju", "Vi", "Sá", "Do"];

/**
 * dias: Set de claves "YYYY-MM-DD" donde el alumno efectivamente entrenó.
 * programados: Set de claves que el profesor agendó a mano (extras).
 * rutina + sesiones: la plantilla activa, para marcar qué toca cada día.
 */
export function Calendario({ dias, programados, rutina, sesiones }) {
  const ahora = new Date();
  const [anio, setAnio] = useState(ahora.getFullYear());
  const [mes, setMes] = useState(ahora.getMonth());

  const celdas = grillaMes(anio, mes);
  const hoy = hoyClave();

  function mover(delta) {
    const d = new Date(anio, mes + delta, 1);
    setAnio(d.getFullYear());
    setMes(d.getMonth());
  }

  const entrenadosDelMes = celdas.filter(
    (d) => d.getMonth() === mes && dias.has(claveDia(d))
  ).length;

  return (
    <div>
      <div className="row-between" style={{ marginBottom: 12 }}>
        <button
          className="btn btn-ghost btn-sm"
          onClick={() => mover(-1)}
          aria-label="Mes anterior"
        >
          ‹
        </button>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontWeight: 600, fontSize: 14.5 }}>
            {NOMBRE_MES[mes]} {anio}
          </div>
          <div className="muted tiny">
            {entrenadosDelMes}{" "}
            {entrenadosDelMes === 1 ? "día entrenado" : "días entrenados"}
          </div>
        </div>
        <button
          className="btn btn-ghost btn-sm"
          onClick={() => mover(1)}
          aria-label="Mes siguiente"
        >
          ›
        </button>
      </div>

      <div className="cal-grid" style={{ marginBottom: 4 }}>
        {DIAS.map((d) => (
          <div key={d} className="cal-head">
            {d}
          </div>
        ))}
      </div>

      <div className="cal-grid">
        {celdas.map((d) => {
          const clave = claveDia(d);
          const delMes = d.getMonth() === mes;
          const hecho = dias.has(clave);
          const sesion = sesionDe(d, rutina, sesiones);
          const prog = !hecho && (sesion || programados.has(clave));

          const clases = ["cal-day"];
          if (delMes) clases.push("cal-day-mes");
          if (hecho) clases.push("cal-hecho");
          if (prog) clases.push("cal-prog");
          if (clave === hoy) clases.push("cal-hoy");

          const titulo = sesion
            ? `${sesion.nombre}${sesion.grupos ? ` — ${sesion.grupos}` : ""}`
            : hecho
              ? "Entrenaste"
              : programados.has(clave)
                ? "Entrenamiento programado"
                : undefined;

          return (
            <div
              key={clave}
              className={clases.join(" ")}
              style={delMes ? undefined : { opacity: 0.35 }}
              title={titulo}
            >
              <span>{d.getDate()}</span>
              {sesion && (
                <span className="cal-sesion">{abrevSesion(sesion.nombre)}</span>
              )}
            </div>
          );
        })}
      </div>

      <hr className="divider" />

      <div className="cal-leyenda">
        <span className="row" style={{ gap: 6 }}>
          <span
            className="cal-muestra"
            style={{
              background: "linear-gradient(145deg, var(--orchid), var(--orchid-deep))",
            }}
          />
          Entrenado
        </span>
        <span className="row" style={{ gap: 6 }}>
          <span
            className="cal-muestra"
            style={{ border: "1px solid var(--orchid-deep)" }}
          />
          Te toca
        </span>
        <span className="row" style={{ gap: 6 }}>
          <span
            className="cal-muestra"
            style={{ border: "1.5px solid var(--muted)", borderRadius: "50%" }}
          />
          Hoy
        </span>
      </div>
    </div>
  );
}
