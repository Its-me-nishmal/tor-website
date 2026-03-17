/* ─── Particles ──────────────────────────────────────────────────────────── */
(function spawnParticles() {
  const container = document.getElementById('particles');
  const colors = ['#7c5cfc', '#00e5ff', '#ff6ff1', '#a87fff', '#22d3a5'];
  for (let i = 0; i < 26; i++) {
    const p = document.createElement('div');
    p.className = 'particle';
    const size = Math.random() * 120 + 20;
    p.style.cssText = `
      width: ${size}px; height: ${size}px;
      left: ${Math.random() * 100}%;
      background: ${colors[Math.floor(Math.random() * colors.length)]};
      animation-duration: ${Math.random() * 22 + 18}s;
      animation-delay: ${Math.random() * -25}s;
    `;
    container.appendChild(p);
  }
})();

/* ─── Nav scroll effect ───────────────────────────────────────────────────── */
window.addEventListener('scroll', () => {
  const nav = document.getElementById('nav');
  if (window.scrollY > 20) nav.classList.add('scrolled');
  else nav.classList.remove('scrolled');
}, { passive: true });

/* ─── Scroll-revealed fade-in ─────────────────────────────────────────────── */
const observer = new IntersectionObserver((entries) => {
  entries.forEach(e => {
    if (e.isIntersecting) {
      e.target.classList.add('visible');
      observer.unobserve(e.target);
    }
  });
}, { threshold: 0.1 });

// Inject reveal animation style
const revealStyle = document.createElement('style');
revealStyle.textContent = `
  .reveal {
    opacity: 0;
    transform: translateY(32px);
    transition: opacity 0.7s cubic-bezier(.4,0,.2,1), transform 0.7s cubic-bezier(.4,0,.2,1);
  }
  .reveal.visible {
    opacity: 1;
    transform: translateY(0);
  }
`;
document.head.appendChild(revealStyle);

document.querySelectorAll([
  '.hero-label', '.hero-title', '.hero-sub', '.hero-cta',
  '.section-header', '.about-text', '.skills-grid',
  '.project-card', '.timeline-item', '.tor-info-card', '.api-panel',
  '.contact-card',
].join(',')).forEach((el, i) => {
  el.classList.add('reveal');
  el.style.transitionDelay = `${(i % 6) * 0.08}s`;
  observer.observe(el);
});

/* ─── Fetch /api/info ─────────────────────────────────────────────────────── */
async function fetchInfo() {
  const responseEl = document.getElementById('api-response');
  const btn = document.getElementById('refresh-btn');

  btn.textContent = '↻ Loading…';
  btn.disabled = true;

  try {
    const res = await fetch('/api/info');
    const data = await res.json();

    // Pretty-print JSON with syntax highlighting
    const pretty = JSON.stringify(data, null, 2);
    responseEl.innerHTML = syntaxHighlight(pretty);

    // Propagate onion address everywhere
    const addr = data.onion || '';
    setOnionAddress(addr);

    // Update uptime & timestamp
    const uptimeEl = document.getElementById('uptime-display');
    const tsEl     = document.getElementById('timestamp-display');
    if (uptimeEl) uptimeEl.textContent = formatUptime(data.uptime);
    if (tsEl)     tsEl.textContent     = data.timestamp ? new Date(data.timestamp).toLocaleString() : '—';

  } catch (err) {
    responseEl.textContent = `// Error fetching /api/info\n// ${err.message}`;
  } finally {
    btn.innerHTML = '↻ Refresh';
    btn.disabled = false;
  }
}

/* ─── Propagate onion address to all placeholders ────────────────────────── */
function setOnionAddress(addr) {
  const display = addr && addr !== 'null' ? addr : 'Connecting to Tor…';
  const ids = ['onion-addr-hero', 'onion-addr-display', 'footer-onion'];
  ids.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = display;
  });

  // Badge dot: green = connected, amber = pending
  const dot = document.getElementById('badge-dot');
  if (dot) {
    dot.style.background = addr && !addr.includes('Connecting') ? 'var(--green)' : '#f59e0b';
  }
}

/* ─── Uptime formatter ────────────────────────────────────────────────────── */
function formatUptime(seconds) {
  if (!seconds && seconds !== 0) return '—';
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

/* ─── JSON syntax highlight ───────────────────────────────────────────────── */
function syntaxHighlight(json) {
  const colors = {
    string:  '#22d3a5',
    number:  '#00e5ff',
    boolean: '#a87fff',
    null:    '#ff6ff1',
    key:     '#e2e8f0',
  };
  return json.replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g, (match) => {
    let cls = 'number', col = colors.number;
    if (/^"/.test(match)) {
      if (/:$/.test(match)) { cls = 'key'; col = colors.key; }
      else { cls = 'string'; col = colors.string; }
    } else if (/true|false/.test(match)) { cls = 'boolean'; col = colors.boolean; }
    else if (/null/.test(match)) { cls = 'null'; col = colors.null; }
    return `<span style="color:${col}">${match}</span>`;
  });
}

/* ─── Boot ────────────────────────────────────────────────────────────────── */
fetchInfo();
// Auto-refresh every 30 s
setInterval(fetchInfo, 30000);
