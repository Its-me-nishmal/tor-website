/* ─── Particle Background ──────────────────────────────────────────── */
(function spawnParticles() {
  const container = document.getElementById('particles');
  const colors = ['#7c5cfc', '#00e5ff', '#9d6fff', '#22d3a5'];
  const count = 28;

  for (let i = 0; i < count; i++) {
    const el = document.createElement('div');
    el.className = 'particle';
    const size = Math.random() * 80 + 20;
    el.style.cssText = `
      width: ${size}px;
      height: ${size}px;
      left: ${Math.random() * 100}vw;
      background: ${colors[Math.floor(Math.random() * colors.length)]};
      animation-duration: ${Math.random() * 20 + 12}s;
      animation-delay: ${Math.random() * -25}s;
      filter: blur(${Math.random() * 6 + 2}px);
    `;
    container.appendChild(el);
  }
})();

/* ─── Live API Info Panel ─────────────────────────────────────────── */
async function fetchInfo() {
  const el = document.getElementById('api-response');
  const btn = document.getElementById('refresh-btn');

  el.textContent = 'Fetching…';
  btn.disabled = true;
  btn.style.opacity = '0.5';

  try {
    const res = await fetch('/api/info');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    el.textContent = JSON.stringify(data, null, 2);
    colorizeJson(el);
  } catch (err) {
    el.textContent = `Error: ${err.message}`;
  } finally {
    btn.disabled = false;
    btn.style.opacity = '1';
  }
}

/* Simple JSON colorizer */
function colorizeJson(pre) {
  pre.innerHTML = pre.textContent.replace(
    /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g,
    (match) => {
      let cls = 'color:#22d3a5'; // number
      if (/^"/.test(match)) {
        cls = /:$/.test(match) ? 'color:#00e5ff' : 'color:#e2e8f0';
      } else if (/true|false/.test(match)) {
        cls = 'color:#9d6fff';
      } else if (/null/.test(match)) {
        cls = 'color:#64748b';
      }
      return `<span style="${cls}">${match}</span>`;
    }
  );
}

// Auto-load on page ready
fetchInfo();
