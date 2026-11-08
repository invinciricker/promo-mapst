/* =====================================================================================
   sun.js: sunrise and sunset in Nice, computed in the app (no internet needed), to pick
   the picture of the Accueil window: « aube », « jour », « couchant » or « nuit ».

   The rules (docs/design/README.md):
     aube       from 1 h before sunrise to 2 h after
     couchant   from 1 h 30 before sunset to 45 min after
     jour       the rest of the day
     nuit       from then until 1 h before sunrise
   The formulas are the NOAA ones (accurate to a minute or two), for Nice: 43.70° N, 7.27° E.
   ===================================================================================== */

export const NICE = { lat: 43.70, lon: 7.27 };
export const SKIES = ["aube", "jour", "couchant", "nuit"];

const rad = (deg) => (deg * Math.PI) / 180;
const deg = (r) => (r * 180) / Math.PI;
const MINUTE = 60 * 1000;

/**
 * Sunrise and sunset of a day, as exact moments: { sunrise: Date, sunset: Date }.
 * `date` is any moment of that day (local time of the phone).
 */
export function sunTimes(date = new Date(), { lat, lon } = NICE) {
  const y = date.getFullYear();
  const midnightUTC = Date.UTC(y, date.getMonth(), date.getDate());
  const dayOfYear = Math.round((midnightUTC - Date.UTC(y, 0, 1)) / 86400000) + 1;
  const daysInYear = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0 ? 366 : 365;
  const g = ((2 * Math.PI) / daysInYear) * (dayOfYear - 1);      // the "fractional year", at noon
  const eqTime = 229.18 * (0.000075 + 0.001868 * Math.cos(g) - 0.032077 * Math.sin(g)
    - 0.014615 * Math.cos(2 * g) - 0.040849 * Math.sin(2 * g));      // minutes
  const decl = 0.006918 - 0.399912 * Math.cos(g) + 0.070257 * Math.sin(g) - 0.006758 * Math.cos(2 * g)
    + 0.000907 * Math.sin(2 * g) - 0.002697 * Math.cos(3 * g) + 0.00148 * Math.sin(3 * g);
  // 90.833°: the sun's centre is just under the horizon when its top appears (refraction).
  const cosHa = Math.cos(rad(90.833)) / (Math.cos(rad(lat)) * Math.cos(decl)) - Math.tan(rad(lat)) * Math.tan(decl);
  const ha = deg(Math.acos(Math.max(-1, Math.min(1, cosHa))));
  const sunriseMin = 720 - 4 * (lon + ha) - eqTime;                // minutes after midnight, UTC
  const sunsetMin = 720 - 4 * (lon - ha) - eqTime;
  return {
    sunrise: new Date(midnightUTC + sunriseMin * MINUTE),
    sunset: new Date(midnightUTC + sunsetMin * MINUTE),
  };
}

/** The sky of Nice at a moment: "aube", "jour", "couchant" or "nuit". */
export function skyAt(now = new Date()) {
  const { sunrise, sunset } = sunTimes(now);
  const t = now.getTime();
  const minutes = (n) => n * MINUTE;
  if (t >= sunrise.getTime() - minutes(60) && t < sunrise.getTime() + minutes(120)) return "aube";
  if (t >= sunset.getTime() - minutes(90) && t < sunset.getTime() + minutes(45)) return "couchant";
  if (t >= sunrise.getTime() + minutes(120) && t < sunset.getTime() - minutes(90)) return "jour";
  return "nuit";
}
