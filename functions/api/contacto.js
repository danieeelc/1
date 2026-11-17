const TO_DEFAULT = 'rs.danielcampos@gmail.com';

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });

export async function onRequestPost({ request, env }) {
  const origin = request.headers.get('Origin');
  if (origin && new URL(origin).host !== new URL(request.url).host) return json({ ok: false, error: 'origin' }, 403);

  let d;
  try { d = await request.json(); } catch { return json({ ok: false, error: 'bad_json' }, 400); }

  if (d.website) return json({ ok: true });

  const one = (v, n) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, n);
  const f = {
    nombre: one(d.nombre, 100),
    email: one(d.email, 150),
    telefono: one(d.telefono, 50),
    pais: one(d.pais, 80),
    negocio: one(d.negocio, 120),
    servicio: one(d.servicio, 80),
    mensaje: String(d.mensaje ?? '').replace(/\r/g, '').trim().slice(0, 4000),
    idioma: d.idioma === 'en' ? 'Inglés' : 'Español',
  };
  if (!f.nombre || !f.mensaje || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email)) return json({ ok: false, error: 'invalid' }, 400);
  if (!env.RESEND_API_KEY) return json({ ok: false, error: 'config' }, 500);

  const rows = [
    ['Nombre', f.nombre], ['Correo', f.email], ['WhatsApp / teléfono', f.telefono || '—'],
    ['País', f.pais || '—'], ['Negocio', f.negocio || '—'], ['Servicio', f.servicio || '—'],
    ['Idioma del cliente', f.idioma],
  ];
  const html =
    '<h2>Nueva solicitud de proyecto</h2><table cellpadding="6" style="border-collapse:collapse">' +
    rows.map(([k, v]) => `<tr><td><b>${esc(k)}</b></td><td>${esc(v)}</td></tr>`).join('') +
    `</table><h3>Mensaje</h3><p style="white-space:pre-wrap">${esc(f.mensaje)}</p>`;
  const text = rows.map(([k, v]) => `${k}: ${v}`).join('\n') + `\n\nMensaje:\n${f.mensaje}`;

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: 'Daniel Campos Web <onboarding@resend.dev>',
      to: [env.TO_EMAIL || TO_DEFAULT],
      reply_to: f.email,
      subject: `Nueva solicitud de ${f.nombre}`,
      html,
      text,
    }),
  });
  if (!res.ok) {
    console.error('Resend error', res.status, await res.text());
    return json({ ok: false, error: 'send' }, 502);
  }
  return json({ ok: true });
}
