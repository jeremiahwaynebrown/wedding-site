// ================================
// Wedding landing page JS
// - Mobile nav toggle
// - Countdown timer
// - RSVP saved to localStorage (temporary, until backend)
// - Download RSVPs as JSON
// - Falling leaves canvas overlay in hero
// ================================

const $ = (sel) => document.querySelector(sel);

// -------------------------------
// Mobile nav toggle
// -------------------------------
const navToggle = $("#navToggle");
const navMenu = $("#navMenu");

if (navToggle && navMenu) {
  navToggle.addEventListener("click", () => {
    const isOpen = navMenu.classList.toggle("is-open");
    navToggle.setAttribute("aria-expanded", String(isOpen));
  });

  // Close menu after clicking a link (mobile)
  navMenu.addEventListener("click", (e) => {
    const target = e.target;
    if (target && target.tagName === "A") {
      navMenu.classList.remove("is-open");
      navToggle.setAttribute("aria-expanded", "false");
    }
  });
}

// -------------------------------
// Footer year
// -------------------------------
const yearEl = $("#year");
if (yearEl) yearEl.textContent = String(new Date().getFullYear());

// -------------------------------
// Countdown (set your wedding date)
// -------------------------------
const WEDDING_DATE_ISO = "2027-04-03T16:30:00"; // <-- CHANGE THIS
const weddingDate = new Date(WEDDING_DATE_ISO);

function pad2(n) {
  return String(n).padStart(2, "0");
}

function updateCountdown() {
  const now = new Date();
  let diffMs = weddingDate.getTime() - now.getTime();

  const done = diffMs <= 0;
  if (done) diffMs = 0;

  const totalSeconds = Math.floor(diffMs / 1000);
  const days = Math.floor(totalSeconds / (3600 * 24));
  const hours = Math.floor((totalSeconds % (3600 * 24)) / 3600);
  const mins = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;

  const d = $("#cdDays");
  const h = $("#cdHours");
  const m = $("#cdMins");
  const s = $("#cdSecs");

  if (d) d.textContent = String(days);
  if (h) h.textContent = pad2(hours);
  if (m) m.textContent = pad2(mins);
  if (s) s.textContent = pad2(secs);

  if (done) {
    const dateText = $("#weddingDateText");
    if (dateText) dateText.textContent = "Today’s the day! 🎉";
  }
}
updateCountdown();
setInterval(updateCountdown, 1000);

// -------------------------------
// RSVP localStorage (temporary)
// -------------------------------
const RSVP_KEY = "wedding_rsvps_v1";

function getRsvps() {
  try {
    return JSON.parse(localStorage.getItem(RSVP_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveRsvp(entry) {
  const list = getRsvps();
  list.push(entry);
  localStorage.setItem(RSVP_KEY, JSON.stringify(list));
}

const rsvpForm = $("#rsvpForm");
const rsvpStatus = $("#rsvpStatus");
const downloadBtn = $("#downloadBtn");

if (rsvpForm) {
  rsvpForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const formData = new FormData(rsvpForm);

    const entry = {
      id: (crypto?.randomUUID ? crypto.randomUUID() : String(Date.now())),
      name: String(formData.get("name") || "").trim(),
      email: String(formData.get("email") || "").trim(),
      attendance: String(formData.get("attendance") || "").trim(),
      guests: Number(formData.get("guests") || 1),
      diet: String(formData.get("diet") || "").trim(),
      message: String(formData.get("message") || "").trim(),
      createdAt: new Date().toISOString()
    };

    // Basic validation
    if (!entry.name || !entry.email || !entry.attendance) {
      if (rsvpStatus) rsvpStatus.textContent = "Please fill out name, email, and attendance.";
      return;
    }

    saveRsvp(entry);
    rsvpForm.reset();

    if (rsvpStatus) rsvpStatus.textContent = "RSVP saved (locally). Thanks!";
  });
}

if (downloadBtn) {
  downloadBtn.addEventListener("click", () => {
    const data = getRsvps();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = "rsvps.json";
    document.body.appendChild(a);
    a.click();
    a.remove();

    URL.revokeObjectURL(url);
  });
}

// ================================
// Falling Leaves (Hero Canvas)
// Requires:
//   <canvas class="hero__leaves" id="leavesCanvas"></canvas>
// ================================
(() => {
  const canvas = document.getElementById("leavesCanvas");
  if (!canvas) return;

  const hero = canvas.closest(".hero");
  if (!hero) return;

  // Respect reduced motion preferences
  const prefersReduced = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
  if (prefersReduced) return;

  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  let w = 0, h = 0, dpr = 1;

  function resize() {
    const rect = hero.getBoundingClientRect();
    dpr = window.devicePixelRatio || 1;
    w = Math.max(1, Math.floor(rect.width));
    h = Math.max(1, Math.floor(rect.height));

    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    canvas.style.width = w + "px";
    canvas.style.height = h + "px";

    // scale drawing to look crisp on high-DPI screens
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  resize();
  window.addEventListener("resize", resize);

  const colors = [
    "rgba(230,199,102,0.95)", // gold-soft
    "rgba(212,175,55,0.90)",  // gold
    "rgba(31,122,90,0.55)",   // emerald hint
    "rgba(246,244,236,0.45)"  // soft cream highlight
  ];

  function rand(min, max) { return Math.random() * (max - min) + min; }

  // Scale count based on width, cap it so it stays light
  function leafCountForWidth(width) {
    return Math.max(20, Math.min(70, Math.floor(width / 16)));
  }

  let leaves = [];

  function initLeaves() {
    const count = leafCountForWidth(w);
    leaves = Array.from({ length: count }, () => ({
      x: rand(0, w),
      y: rand(-h, 0),
      r: rand(4, 10),           // size
      vy: rand(0.6, 1.9),       // fall speed
      vx: rand(-0.25, 0.25),    // drift
      rot: rand(0, Math.PI * 2),
      vrot: rand(-0.02, 0.02),
      sway: rand(0.6, 2.2),
      phase: rand(0, Math.PI * 2),
      color: colors[Math.floor(Math.random() * colors.length)],
      alpha: rand(0.40, 0.90),
    }));
  }

  initLeaves();

  // Re-init on resize so density looks consistent
  let resizeTimer = null;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      resize();
      initLeaves();
    }, 120);
  });

  function drawLeaf(leaf) {
    ctx.save();
    ctx.translate(leaf.x, leaf.y);
    ctx.rotate(leaf.rot);

    // Leaf shape (teardrop-ish)
    ctx.beginPath();
    ctx.moveTo(0, -leaf.r);
    ctx.bezierCurveTo(leaf.r, -leaf.r * 0.6, leaf.r, leaf.r * 0.8, 0, leaf.r);
    ctx.bezierCurveTo(-leaf.r, leaf.r * 0.8, -leaf.r, -leaf.r * 0.6, 0, -leaf.r);
    ctx.closePath();

    ctx.globalAlpha = leaf.alpha;
    ctx.fillStyle = leaf.color;
    ctx.fill();

    // subtle vein highlight
    ctx.globalAlpha = leaf.alpha * 0.30;
    ctx.strokeStyle = "rgba(255,255,255,0.55)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, -leaf.r * 0.65);
    ctx.lineTo(0, leaf.r * 0.55);
    ctx.stroke();

    ctx.restore();
  }

  let t = 0;
  function tick() {
    t += 0.016;

    ctx.clearRect(0, 0, w, h);

    for (const leaf of leaves) {
      const swayX = Math.sin(t * leaf.sway + leaf.phase) * 0.6;

      leaf.x += leaf.vx + swayX;
      leaf.y += leaf.vy;
      leaf.rot += leaf.vrot;

      // Wrap / respawn
      if (leaf.y - leaf.r > h) {
        leaf.y = -leaf.r - rand(0, h * 0.15);
        leaf.x = rand(0, w);
      }
      if (leaf.x < -30) leaf.x = w + 30;
      if (leaf.x > w + 30) leaf.x = -30;

      drawLeaf(leaf);
    }

    requestAnimationFrame(tick);
  }

  tick();
})();