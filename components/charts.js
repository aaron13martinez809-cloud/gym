"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";

const PAD = { izq: 42, der: 18, arr: 14, aba: 24 };
const ALTO_PLOT = 158;

/* Ticks en números redondos (0 / 5 / 10), no en los mínimos crudos del dato. */
function ticksLindos(min, max, cantidad = 4) {
  if (!isFinite(min) || !isFinite(max)) return { ticks: [0, 1], dom: [0, 1] };
  if (min === max) {
    const d = Math.abs(min) > 10 ? 1 : 0.5;
    min -= d;
    max += d;
  }
  const bruto = (max - min) / cantidad;
  const mag = Math.pow(10, Math.floor(Math.log10(bruto)));
  const norm = bruto / mag;
  const paso = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10) * mag;
  const desde = Math.floor(min / paso) * paso;
  const hasta = Math.ceil(max / paso) * paso;

  const ticks = [];
  for (let v = desde; v <= hasta + paso / 1000; v += paso) {
    ticks.push(Number(v.toFixed(6)));
  }
  return { ticks, dom: [desde, hasta] };
}

function fechaCorta(d) {
  return d.toLocaleDateString("es-AR", { day: "numeric", month: "short" });
}

function fechaLarga(d) {
  return d.toLocaleDateString("es-AR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/* Mide el contenedor para dibujar en píxeles reales: si escaláramos el SVG con
   viewBox, el trazo de 2px y el tamaño del texto escalarían con él.
   Devuelve un ref de callback, no un ref normal: al alternar gráfico/tabla el
   div se desmonta, y un ref fijo dejaría al observer mirando un nodo muerto. */
function useAncho() {
  const [ancho, setAncho] = useState(0);
  const nodo = useRef(null);
  const observer = useRef(null);

  const medir = useCallback(() => {
    if (nodo.current) setAncho(nodo.current.getBoundingClientRect().width);
  }, []);

  const ref = useCallback(
    (el) => {
      observer.current?.disconnect();
      nodo.current = el;
      if (!el) return;

      if (typeof ResizeObserver !== "undefined") {
        observer.current = new ResizeObserver(([e]) =>
          setAncho(e.contentRect.width)
        );
        observer.current.observe(el);
      }
      medir();
    },
    [medir]
  );

  // red de seguridad: el ResizeObserver no dispara en todos los entornos
  useEffect(() => {
    window.addEventListener("resize", medir);
    return () => {
      window.removeEventListener("resize", medir);
      observer.current?.disconnect();
    };
  }, [medir]);

  return [ref, ancho];
}

/**
 * Serie única en el tiempo. Sin leyenda a propósito: hay un solo color, el
 * título ya dice qué se está midiendo.
 *
 * datos: [{ x: Date, y: number }] ordenado ascendente
 */
export function GraficoLinea({ datos, unidad = "", etiquetaY = "Valor" }) {
  const [cont, ancho] = useAncho();
  const [activo, setActivo] = useState(null);
  const [verTabla, setVerTabla] = useState(false);
  // useId devuelve ":r0:" y los dos puntos rompen la referencia url(#...)
  const gradId = `g${useId().replace(/:/g, "")}`;

  const hayDatos = datos.length > 0;
  const anchoPlot = Math.max(ancho - PAD.izq - PAD.der, 10);
  const altoTotal = ALTO_PLOT + PAD.arr + PAD.aba;

  const valores = datos.map((d) => d.y);
  const { ticks, dom } = ticksLindos(Math.min(...valores), Math.max(...valores));

  const px = (i) =>
    PAD.izq + (datos.length === 1 ? anchoPlot / 2 : (i / (datos.length - 1)) * anchoPlot);
  const py = (v) =>
    PAD.arr + ALTO_PLOT - ((v - dom[0]) / (dom[1] - dom[0] || 1)) * ALTO_PLOT;

  const puntos = datos.map((d, i) => ({ ...d, cx: px(i), cy: py(d.y) }));
  const linea = puntos.map((p, i) => `${i ? "L" : "M"}${p.cx},${p.cy}`).join(" ");
  const area =
    puntos.length > 1
      ? `${linea} L${puntos.at(-1).cx},${PAD.arr + ALTO_PLOT} L${puntos[0].cx},${
          PAD.arr + ALTO_PLOT
        } Z`
      : "";

  const ultimo = puntos.at(-1);
  const destacado = activo != null ? puntos[activo] : null;

  function moverPuntero(e) {
    if (!puntos.length) return;
    const caja = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - caja.left;
    let mejor = 0;
    let dist = Infinity;
    puntos.forEach((p, i) => {
      const d = Math.abs(p.cx - x);
      if (d < dist) {
        dist = d;
        mejor = i;
      }
    });
    setActivo(mejor);
  }

  if (!hayDatos) {
    return (
      <div className="empty">
        <div className="empty-icon" aria-hidden="true">
          ◠
        </div>
        Todavía no hay datos suficientes para dibujar la curva.
      </div>
    );
  }

  return (
    <div>
      <div className="row-between" style={{ marginBottom: 8 }}>
        <span className="muted tiny">
          {datos.length} {datos.length === 1 ? "registro" : "registros"}
        </span>
        <button
          className="btn btn-ghost btn-sm"
          onClick={() => setVerTabla((v) => !v)}
          style={{ fontSize: 12 }}
        >
          {verTabla ? "Ver gráfico" : "Ver tabla"}
        </button>
      </div>

      {verTabla ? (
        <div className="tabla-wrap">
          <table className="tabla">
            <thead>
              <tr>
                <th scope="col">Fecha</th>
                <th scope="col">
                  {etiquetaY}
                  {unidad && ` (${unidad})`}
                </th>
              </tr>
            </thead>
            <tbody>
              {[...datos].reverse().map((d, i) => (
                <tr key={i}>
                  <td>{fechaLarga(d.x)}</td>
                  <td>{d.y}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="chart" ref={cont}>
          {ancho > 0 && (
            <svg
              width={ancho}
              height={altoTotal}
              role="img"
              aria-label={`${etiquetaY} en el tiempo, ${datos.length} registros`}
            >
              <defs>
                <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--orchid)" stopOpacity="0.16" />
                  <stop offset="100%" stopColor="var(--orchid)" stopOpacity="0" />
                </linearGradient>
              </defs>

              {/* grilla: hairline sólida, un paso por encima del fondo */}
              {ticks.map((t) => (
                <g key={t}>
                  <line
                    className="chart-grid"
                    x1={PAD.izq}
                    x2={ancho - PAD.der}
                    y1={py(t)}
                    y2={py(t)}
                  />
                  <text
                    className="chart-tick"
                    x={PAD.izq - 8}
                    y={py(t)}
                    textAnchor="end"
                    dominantBaseline="middle"
                  >
                    {t}
                  </text>
                </g>
              ))}

              {/* fechas: solo primera y última, para que no colisionen */}
              <text className="chart-tick" x={PAD.izq} y={altoTotal - 7}>
                {fechaCorta(datos[0].x)}
              </text>
              {datos.length > 1 && (
                <text
                  className="chart-tick"
                  x={ancho - PAD.der}
                  y={altoTotal - 7}
                  textAnchor="end"
                >
                  {fechaCorta(datos.at(-1).x)}
                </text>
              )}

              {area && <path d={area} fill={`url(#${gradId})`} />}

              <path
                d={linea}
                fill="none"
                stroke="var(--orchid)"
                strokeWidth="2"
                strokeLinejoin="round"
                strokeLinecap="round"
              />

              {/* cruceta del hover */}
              {destacado && (
                <line
                  className="chart-grid"
                  x1={destacado.cx}
                  x2={destacado.cx}
                  y1={PAD.arr}
                  y2={PAD.arr + ALTO_PLOT}
                />
              )}

              {/* punto final con anillo del color de la superficie */}
              <circle
                cx={ultimo.cx}
                cy={ultimo.cy}
                r="4.5"
                fill="var(--orchid)"
                stroke="var(--surface)"
                strokeWidth="2"
              />
              {destacado && destacado !== ultimo && (
                <circle
                  cx={destacado.cx}
                  cy={destacado.cy}
                  r="4.5"
                  fill="var(--orchid)"
                  stroke="var(--surface)"
                  strokeWidth="2"
                />
              )}

              {/* capa de captura: el objetivo de hover cubre todo el alto */}
              <rect
                x={PAD.izq}
                y={PAD.arr}
                width={anchoPlot}
                height={ALTO_PLOT}
                fill="transparent"
                onPointerMove={moverPuntero}
                onPointerLeave={() => setActivo(null)}
                style={{ touchAction: "none" }}
              />
            </svg>
          )}

          {destacado && (
            <div
              className="chart-tip"
              style={{
                left: Math.min(Math.max(destacado.cx, 54), ancho - 54),
                top: destacado.cy - 12,
              }}
            >
              <div className="chart-tip-val">
                {destacado.y}
                {unidad && ` ${unidad}`}
              </div>
              <div className="muted" style={{ fontSize: 11 }}>
                {fechaCorta(destacado.x)}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* Número suelto: proporcional, no tabular (a tamaño grande el tabular se ve suelto) */
export function Stat({ etiqueta, valor, unidad }) {
  return (
    <div className="stat">
      <div className="stat-label">{etiqueta}</div>
      <div className="stat-value">
        {valor}
        {unidad && <span className="stat-unit">{unidad}</span>}
      </div>
    </div>
  );
}
