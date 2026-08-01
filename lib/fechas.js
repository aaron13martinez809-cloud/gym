/* Todo el bucketeo por día se hace en hora local del navegador: así un
   entrenamiento de las 22:00 cuenta para hoy y no para mañana en UTC. */

/**
 * `hecho_en` es `timestamp without time zone` y guarda UTC, pero llega como
 * "2026-08-01T15:04:05" sin la Z. Sin esto, JS lo interpreta como hora local y
 * los entrenamientos se corren varias horas (y a veces de día).
 */
export function parseTimestamp(s) {
  if (s instanceof Date) return s;
  const txt = String(s);
  const tieneZona = /[zZ]$|[+-]\d{2}:?\d{2}$/.test(txt);
  return new Date(tieneZona ? txt : `${txt}Z`);
}

export function claveDia(d) {
  const f = d instanceof Date ? d : new Date(d);
  const mes = String(f.getMonth() + 1).padStart(2, "0");
  const dia = String(f.getDate()).padStart(2, "0");
  return `${f.getFullYear()}-${mes}-${dia}`;
}

export function desdeClave(clave) {
  const [a, m, d] = clave.split("-").map(Number);
  return new Date(a, m - 1, d);
}

export function hoyClave() {
  return claveDia(new Date());
}

/**
 * Días consecutivos entrenando. Si todavía no entrenó hoy, la racha sigue viva
 * mientras haya entrenado ayer: recién se corta cuando pasa un día entero.
 */
export function calcularRacha(dias) {
  if (!dias.size) return 0;

  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);

  const cursor = new Date(hoy);
  if (!dias.has(claveDia(cursor))) {
    cursor.setDate(cursor.getDate() - 1);
    if (!dias.has(claveDia(cursor))) return 0;
  }

  let racha = 0;
  while (dias.has(claveDia(cursor))) {
    racha++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return racha;
}

/** Grilla del mes completa, arrancando en lunes y rellenando ambas puntas. */
export function grillaMes(anio, mes) {
  const primero = new Date(anio, mes, 1);
  // getDay() da 0=domingo; lo corremos para que la semana empiece en lunes
  const offset = (primero.getDay() + 6) % 7;

  const inicio = new Date(anio, mes, 1 - offset);
  const celdas = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(inicio);
    d.setDate(inicio.getDate() + i);
    celdas.push(d);
    // cortamos apenas completamos la semana que contiene el último día del mes
    if (i >= 27 && d.getMonth() !== mes && (i + 1) % 7 === 0) break;
  }
  return celdas;
}

export const NOMBRE_MES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

/** Convierte "20", "20kg", "20,5 kg" en 20 / 20.5. Devuelve null si no hay número. */
export function aNumero(texto) {
  if (texto == null) return null;
  const limpio = String(texto).replace(/[^0-9.,]/g, "").replace(",", ".");
  if (!limpio) return null;
  const n = Number.parseFloat(limpio);
  return Number.isFinite(n) ? n : null;
}
