/* =====================================================================================
   confetti.js: a burst of confetti in CAPA Sports' colours at the end of a lesson.
   Drawn on a <canvas> for 2 seconds, then removed. People who asked their phone for less
   motion don't get it.
   ===================================================================================== */

const COLOURS = ["#00E6BF", "#F09000", "#1070B0", "#FFFFFF", "#FFC94D"];

export function launchConfetti(host = document.body) {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const canvas = document.createElement("canvas");
  canvas.className = "confetti";
  canvas.setAttribute("aria-hidden", "true");
  host.appendChild(canvas);
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  const width = host.clientWidth || window.innerWidth;
  const height = host.clientHeight || window.innerHeight;
  canvas.width = width * ratio;
  canvas.height = height * ratio;
  const ctx = canvas.getContext("2d");
  ctx.scale(ratio, ratio);

  // Two bursts, from the bottom left and bottom right corners.
  const pieces = [];
  for (let i = 0; i < 140; i++) {
    const left = i % 2 === 0;
    const angle = (left ? -60 : -120) + (Math.random() * 40 - 20);
    const speed = 9 + Math.random() * 8;
    pieces.push({
      x: left ? width * 0.08 : width * 0.92,
      y: height * 0.78,
      vx: Math.cos((angle * Math.PI) / 180) * speed,
      vy: Math.sin((angle * Math.PI) / 180) * speed,
      size: 5 + Math.random() * 6,
      colour: COLOURS[i % COLOURS.length],
      spin: Math.random() * Math.PI,
      spinSpeed: (Math.random() - 0.5) * 0.4,
      round: Math.random() < 0.3,
    });
  }

  const start = performance.now();
  function frame(now) {
    const elapsed = now - start;
    ctx.clearRect(0, 0, width, height);
    for (const p of pieces) {
      p.vy += 0.32;            // gravity
      p.vx *= 0.99;            // air
      p.x += p.vx;
      p.y += p.vy;
      p.spin += p.spinSpeed;
      ctx.save();
      ctx.globalAlpha = Math.max(0, 1 - elapsed / 2200);
      ctx.translate(p.x, p.y);
      ctx.rotate(p.spin);
      ctx.fillStyle = p.colour;
      if (p.round) {
        ctx.beginPath();
        ctx.arc(0, 0, p.size / 2.4, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
      }
      ctx.restore();
    }
    if (elapsed < 2200) requestAnimationFrame(frame);
    else canvas.remove();
  }
  requestAnimationFrame(frame);
}
