/* Cómo se reparte una plantilla a lo largo del calendario.

   Una plantilla es un ciclo de sesiones (Empuje → Tirón → Pierna). Los días de
   la semana que entrena el alumno son otra cosa. El ciclo avanza un paso por
   cada día entrenado, sin reiniciarse los lunes: así, si el ciclo y la
   frecuencia coinciden (PPL a 3 días, Weider a 5), cada día de la semana cae
   siempre en la misma sesión; y si no coinciden (Full Body A/B a 3 días), rota
   solo, que es como se programa de verdad. */

export const NOMBRE_DIA = [
  "lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo",
];

export const DIA_CORTO = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

export const PRESETS = {
  3: [1, 3, 5], // lunes, miércoles, viernes
  5: [1, 2, 3, 4, 5], // lunes a viernes
};

/** Día ISO: 1 = lunes … 7 = domingo (getDay() da 0 = domingo). */
export function isoDia(d) {
  return ((d.getDay() + 6) % 7) + 1;
}

function aMedianoche(d) {
  const x = d instanceof Date ? new Date(d) : new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

/**
 * Índice de sesión (0-based, sin acotar al largo del ciclo) que le toca a
 * `fecha`, o null si ese día no entrena.
 */
export function indiceSesion(fecha, inicio, diasSemana) {
  if (!diasSemana?.length) return null;

  const f = aMedianoche(fecha);
  const i = aMedianoche(inicio);
  const dias = Math.round((f - i) / 86400000); // round: absorbe los saltos de horario de verano
  if (dias < 0) return null;
  if (!diasSemana.includes(isoDia(f))) return null;

  const isoInicio = isoDia(i);
  let total = 0;
  for (const d of diasSemana) {
    const offset = (d - isoInicio + 7) % 7; // días hasta la primera vez que cae ese día
    if (dias >= offset) total += Math.floor((dias - offset) / 7) + 1;
  }
  return total - 1; // `total` ya cuenta a `fecha`
}

/** La sesión concreta del ciclo para esa fecha, o null si descansa. */
export function sesionDe(fecha, rutina, sesiones) {
  if (!rutina?.plantilla_id || !sesiones?.length) return null;
  const idx = indiceSesion(fecha, rutina.inicio, rutina.dias_semana);
  if (idx == null) return null;
  return sesiones[idx % sesiones.length];
}

/** Próximo día de entrenamiento a partir de `desde` (incluido). */
export function proximoEntrenamiento(desde, rutina, sesiones) {
  if (!rutina?.dias_semana?.length) return null;
  const cursor = aMedianoche(desde);
  for (let i = 0; i < 14; i++) {
    const s = sesionDe(cursor, rutina, sesiones);
    if (s) return { fecha: new Date(cursor), sesion: s };
    cursor.setDate(cursor.getDate() + 1);
  }
  return null;
}

/** Los días de la semana que contiene `fecha`, con su sesión asignada. */
export function semanaDe(fecha, rutina, sesiones) {
  const lunes = aMedianoche(fecha);
  lunes.setDate(lunes.getDate() - (isoDia(lunes) - 1));

  const dias = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(lunes);
    d.setDate(lunes.getDate() + i);
    const s = sesionDe(d, rutina, sesiones);
    if (s) dias.push({ fecha: d, iso: isoDia(d), sesion: s });
  }
  return dias;
}

/** Etiqueta corta para meter en una celda del calendario. */
export function abrevSesion(nombre = "") {
  const letra = nombre.match(/\s([A-Z])$/); // "Cuerpo completo A" → "A"
  if (letra) return letra[1];
  return nombre.split(/[\s·]/)[0].slice(0, 3);
}

/** "Lun · Mié · Vie" a partir de [1,3,5]. */
export function resumenDias(diasSemana = []) {
  return [...diasSemana].sort((a, b) => a - b).map((d) => DIA_CORTO[d - 1]).join(" · ");
}
