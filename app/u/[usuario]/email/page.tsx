'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useSesion } from '@/lib/useSesion'
import { Usuario, cargarUsuarios, fechaCorta } from '@/lib/tareas'

type Envio = {
  id: string; asunto: string; estado: 'borrador' | 'programado' | 'enviado'; fecha_envio: string | null; canal: 'mayorista' | 'minorista' | null
  segmento: string | null; plataforma: string | null; campana_id: string | null; responsable_id: string | null
  enviados: number | null; entregados: number | null; aperturas: number | null; clicks: number | null; rebotes: number | null; bajas: number | null
  conversiones: number | null; ventas_ars: number | null; link: string | null; notas: string | null
}
type CampanaMin = { id: string; nombre: string }

const ESTADOS = { borrador: { label: 'Borrador', color: '#6b7280' }, programado: { label: 'Programado', color: '#f59e0b' }, enviado: { label: 'Enviado', color: '#10b981' } } as const
const METRICAS = [
  { k: 'enviados', label: 'Enviados' }, { k: 'entregados', label: 'Entregados' }, { k: 'aperturas', label: 'Aperturas' }, { k: 'clicks', label: 'Clics' },
  { k: 'rebotes', label: 'Rebotes' }, { k: 'bajas', label: 'Bajas' }, { k: 'conversiones', label: 'Conversiones' },
] as const
type FormT = { asunto: string; estado: string; fecha_envio: string; canal: string; segmento: string; plataforma: string; campana_id: string; responsable_id: string; link: string; notas: string; ventas_ars: string } & Record<(typeof METRICAS)[number]['k'], string>

const inp: React.CSSProperties = { width: '100%', padding: '0.6rem 0.8rem', border: '1.5px solid var(--border)', borderRadius: 8, fontSize: '0.875rem', outline: 'none', color: 'var(--text)', backgroundColor: 'var(--input-bg)', fontFamily: 'inherit' }
const Campo = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div style={{ marginBottom: '0.8rem', minWidth: 0 }}><label style={{ fontSize: '0.76rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>{label}</label>{children}</div>
)
const vacio = (): FormT => ({ asunto: '', estado: 'enviado', fecha_envio: '', canal: '', segmento: '', plataforma: '', campana_id: '', responsable_id: '', link: '', notas: '', ventas_ars: '', enviados: '', entregados: '', aperturas: '', clicks: '', rebotes: '', bajas: '', conversiones: '' })
const num = (v: string) => { const t = v.replace(/[^\d]/g, ''); return t === '' ? null : parseInt(t, 10) }
const nf = (n: number | null) => (n == null ? '—' : n.toLocaleString('es-AR'))
const pct = (a: number | null, b: number | null) => (a == null || !b ? null : (a / b) * 100)
const pf = (p: number | null) => (p == null ? '—' : `${p.toFixed(p >= 10 ? 1 : 2).replace('.', ',')}%`)
const pesos = (n: number | null) => (n == null ? '—' : n.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }))
// Base de las tasas: entregados si está cargado; si no, enviados
const base = (e: Pick<Envio, 'entregados' | 'enviados'>) => e.entregados ?? e.enviados

export default function EmailPage() {
  const { usuario } = useSesion()
  const [envios, setEnvios] = useState<Envio[]>([])
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [campanas, setCampanas] = useState<CampanaMin[]>([])
  const [cargando, setCargando] = useState(true)
  const [q, setQ] = useState('')
  const [canal, setCanal] = useState('')
  const [estado, setEstado] = useState('')
  const [editando, setEditando] = useState<Envio | 'nuevo' | null>(null)
  const [f, setF] = useState<FormT>(vacio())
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  async function cargar() {
    const [e, us, c] = await Promise.all([
      supabase.from('mkt_email_envios').select('*').order('fecha_envio', { ascending: false, nullsFirst: true }).order('creado_en', { ascending: false }),
      cargarUsuarios(), supabase.from('mkt_campanas').select('id, nombre').neq('estado', 'archivada').order('nombre'),
    ])
    setEnvios((e.data as Envio[]) || []); setUsuarios(us); setCampanas((c.data as CampanaMin[]) || []); setCargando(false)
  }
  useEffect(() => { cargar() }, [])

  const visibles = useMemo(() => envios.filter(e =>
    (!canal || e.canal === canal) && (!estado || e.estado === estado) &&
    (!q || [e.asunto, e.segmento, e.plataforma].some(x => (x || '').toLowerCase().includes(q.toLowerCase())))
  ), [envios, canal, estado, q])

  const kpi = useMemo(() => {
    const env = visibles.filter(e => e.estado === 'enviado')
    const suma = (k: keyof Envio, solo?: (e: Envio) => boolean) => env.filter(e => e[k] != null && (!solo || solo(e))).reduce((s, e) => s + (e[k] as number), 0)
    const conAp = env.filter(e => e.aperturas != null && base(e))
    const conCl = env.filter(e => e.clicks != null && base(e))
    const apert = conAp.length ? pct(conAp.reduce((s, e) => s + (e.aperturas as number), 0), conAp.reduce((s, e) => s + (base(e) as number), 0)) : null
    const clic = conCl.length ? pct(conCl.reduce((s, e) => s + (e.clicks as number), 0), conCl.reduce((s, e) => s + (base(e) as number), 0)) : null
    return { n: env.length, enviados: suma('enviados'), apert, clic, conv: suma('conversiones'), ventas: suma('ventas_ars') }
  }, [visibles])

  function abrir(e: Envio | 'nuevo') {
    setError('')
    if (e === 'nuevo') setF({ ...vacio(), responsable_id: usuario?.id || '' })
    else setF({
      asunto: e.asunto, estado: e.estado, fecha_envio: e.fecha_envio || '', canal: e.canal || '', segmento: e.segmento || '', plataforma: e.plataforma || '', campana_id: e.campana_id || '',
      responsable_id: e.responsable_id || '', link: e.link || '', notas: e.notas || '', ventas_ars: e.ventas_ars == null ? '' : String(e.ventas_ars),
      enviados: e.enviados == null ? '' : String(e.enviados), entregados: e.entregados == null ? '' : String(e.entregados), aperturas: e.aperturas == null ? '' : String(e.aperturas),
      clicks: e.clicks == null ? '' : String(e.clicks), rebotes: e.rebotes == null ? '' : String(e.rebotes), bajas: e.bajas == null ? '' : String(e.bajas), conversiones: e.conversiones == null ? '' : String(e.conversiones),
    })
    setEditando(e)
  }

  async function guardar() {
    if (!editando || !f.asunto.trim() || guardando) return
    const m = Object.fromEntries(METRICAS.map(x => [x.k, num(f[x.k])])) as Record<string, number | null>
    if (f.estado === 'enviado' && !f.fecha_envio) { setError('Poné la fecha en que se envió.'); return }
    if (m.entregados != null && m.enviados != null && m.entregados > m.enviados) { setError('Los entregados no pueden ser más que los enviados.'); return }
    if (m.aperturas != null && base({ enviados: m.enviados, entregados: m.entregados }) != null && m.aperturas > (base({ enviados: m.enviados, entregados: m.entregados }) as number)) { setError('Las aperturas no pueden superar a los entregados.'); return }
    const ventas = f.ventas_ars.trim() === '' ? null : Number(f.ventas_ars.replace(/\./g, '').replace(',', '.'))
    if (ventas != null && (!isFinite(ventas) || ventas < 0)) { setError('Revisá el monto de ventas.'); return }
    setGuardando(true); setError('')
    const payload = {
      asunto: f.asunto.trim(), estado: f.estado, fecha_envio: f.fecha_envio || null, canal: f.canal || null, segmento: f.segmento.trim() || null, plataforma: f.plataforma.trim() || null,
      campana_id: f.campana_id || null, responsable_id: f.responsable_id || null, link: f.link.trim() || null, notas: f.notas.trim() || null, ventas_ars: ventas, ...m, actualizado_en: new Date().toISOString(),
    }
    const { error: e } = editando === 'nuevo'
      ? await supabase.from('mkt_email_envios').insert({ ...payload, creado_por: usuario?.id })
      : await supabase.from('mkt_email_envios').update(payload).eq('id', editando.id)
    setGuardando(false)
    if (e) { setError('No se pudo guardar. Probá de nuevo.'); return }
    setEditando(null); cargar()
  }

  async function borrar() {
    if (!editando || editando === 'nuevo' || !confirm('¿Borrar este envío?')) return
    await supabase.from('mkt_email_envios').delete().eq('id', editando.id)
    setEditando(null); cargar()
  }

  if (!usuario) return null
  const nombre = (id: string | null) => usuarios.find(u => u.id === id)?.nombre
  const Kpi = ({ t, v, s }: { t: string; v: string; s?: string }) => (
    <div style={{ backgroundColor: 'var(--bg-card)', border: '1.5px solid var(--border)', borderRadius: 12, padding: '0.7rem 0.85rem', minWidth: 0 }}>
      <p style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 600 }}>{t}</p>
      <p style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text)', overflowWrap: 'anywhere' }}>{v}</p>
      {s && <p style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>{s}</p>}
    </div>
  )
  const Dato = ({ t, v, c }: { t: string; v: string; c?: string }) => (
    <div style={{ minWidth: 0 }}><p style={{ fontSize: '0.62rem', color: 'var(--text-muted)' }}>{t}</p><p style={{ fontSize: '0.9rem', fontWeight: 700, color: c || 'var(--text)' }}>{v}</p></div>
  )

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h1 style={{ fontSize: 'clamp(1.25rem, 4vw, 1.6rem)', fontWeight: 700, color: 'var(--text)' }}>✉️ Email marketing</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Qué se envió, cuándo y cómo le fue.</p>
        </div>
        <button onClick={() => abrir('nuevo')} style={{ padding: '0.55rem 1rem', border: 'none', borderRadius: 8, backgroundColor: '#f15922', color: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: '0.875rem' }}>+ Nuevo envío</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 140px), 1fr))', gap: 10, marginBottom: 14 }}>
        <Kpi t="Envíos realizados" v={String(kpi.n)} />
        <Kpi t="Mails enviados" v={nf(kpi.enviados)} />
        <Kpi t="Apertura" v={pf(kpi.apert)} s="sobre entregados" />
        <Kpi t="Clics" v={pf(kpi.clic)} s="sobre entregados" />
        <Kpi t="Conversiones" v={nf(kpi.conv)} />
        <Kpi t="Ventas atribuidas" v={pesos(kpi.ventas || null)} />
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar asunto, base o plataforma…" aria-label="Buscar" style={{ ...inp, flex: '1 1 200px', width: 'auto' }} />
        <select value={canal} onChange={e => setCanal(e.target.value)} aria-label="Público" style={{ ...inp, width: 'auto' }}><option value="">Mayoristas y minoristas</option><option value="mayorista">Mayoristas</option><option value="minorista">Minoristas</option></select>
        <select value={estado} onChange={e => setEstado(e.target.value)} aria-label="Estado" style={{ ...inp, width: 'auto' }}><option value="">Todos los estados</option>{Object.entries(ESTADOS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {!cargando && visibles.length === 0 && <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-muted)' }}><p style={{ fontSize: '2rem' }}>✉️</p><p style={{ fontWeight: 600 }}>{envios.length ? 'No hay envíos con estos filtros.' : 'Todavía no hay envíos cargados.'}</p></div>}
        {visibles.map(e => {
          const es = ESTADOS[e.estado]; const b = base(e)
          return (
            <article key={e.id} style={{ backgroundColor: 'var(--bg-card)', border: '1.5px solid var(--border)', borderLeft: `4px solid ${es.color}`, borderRadius: 12, padding: '0.85rem 1rem' }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontWeight: 700, color: 'var(--text)', fontSize: '0.95rem', overflowWrap: 'anywhere' }}>{e.asunto}</p>
                  <p style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: 2, overflowWrap: 'anywhere' }}>
                    📅 {e.fecha_envio ? fechaCorta(e.fecha_envio) : 'Sin fecha'}{e.canal ? ` · ${e.canal === 'mayorista' ? 'Mayoristas' : 'Minoristas'}` : ''}{e.segmento ? ` · ${e.segmento}` : ''}{e.plataforma ? ` · ${e.plataforma}` : ''}{nombre(e.responsable_id) ? ` · ${nombre(e.responsable_id)}` : ''}
                  </p>
                  {e.campana_id && <p style={{ fontSize: '0.72rem', color: '#f15922', fontWeight: 600, marginTop: 2 }}>📣 {campanas.find(c => c.id === e.campana_id)?.nombre}</p>}
                </div>
                <span style={{ fontSize: '0.66rem', fontWeight: 700, padding: '2px 9px', borderRadius: 99, backgroundColor: es.color + '22', color: es.color, whiteSpace: 'nowrap' }}>{es.label}</span>
                <button onClick={() => abrir(e)} aria-label={`Editar ${e.asunto}`} style={{ minWidth: 36, minHeight: 36, border: '1.5px solid var(--border)', borderRadius: 8, background: 'var(--bg-card)', cursor: 'pointer' }}>✏️</button>
              </div>
              {e.estado === 'enviado' && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 78px), 1fr))', gap: 8, marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
                  <Dato t="Enviados" v={nf(e.enviados)} />
                  <Dato t="Apertura" v={pf(pct(e.aperturas, b))} c="#10b981" />
                  <Dato t="Clics" v={pf(pct(e.clicks, b))} c="#3b82f6" />
                  <Dato t="Rebotes" v={pf(pct(e.rebotes, e.enviados))} />
                  <Dato t="Bajas" v={pf(pct(e.bajas, b))} />
                  <Dato t="Conversiones" v={nf(e.conversiones)} />
                  {e.ventas_ars != null && <Dato t="Ventas" v={pesos(e.ventas_ars)} />}
                </div>
              )}
              {e.notas && <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 8, overflowWrap: 'anywhere', whiteSpace: 'pre-wrap' }}>{e.notas}</p>}
              {e.link && /^https?:\/\//i.test(e.link) && <a href={e.link} target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.75rem', color: '#f15922', display: 'inline-block', marginTop: 6 }}>Ver pieza ↗</a>}
            </article>
          )
        })}
      </div>

      {editando && (
        <div className="modal-overlay" style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '0.75rem' }} onClick={ev => { if (ev.target === ev.currentTarget) setEditando(null) }}>
          <div className="modal-sheet" style={{ backgroundColor: 'var(--bg-card)', borderRadius: 16, padding: '1.25rem', width: '100%', maxWidth: 560, maxHeight: '94vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }}>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1rem', color: 'var(--text)' }}>{editando === 'nuevo' ? 'Nuevo envío' : 'Editar envío'}</h2>
            <Campo label="Asunto *"><input value={f.asunto} onChange={e => setF({ ...f, asunto: e.target.value })} placeholder="Asunto del mail" style={inp} /></Campo>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 150px), 1fr))', gap: '0 12px' }}>
              <Campo label="Estado"><select value={f.estado} onChange={e => setF({ ...f, estado: e.target.value })} style={inp}>{Object.entries(ESTADOS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select></Campo>
              <Campo label={f.estado === 'programado' ? 'Fecha programada' : 'Fecha de envío'}><input type="date" value={f.fecha_envio} onChange={e => setF({ ...f, fecha_envio: e.target.value })} style={inp} /></Campo>
              <Campo label="Público"><select value={f.canal} onChange={e => setF({ ...f, canal: e.target.value })} style={inp}><option value="">Sin definir</option><option value="mayorista">Mayoristas</option><option value="minorista">Minoristas</option></select></Campo>
              <Campo label="Responsable"><select value={f.responsable_id} onChange={e => setF({ ...f, responsable_id: e.target.value })} style={inp}><option value="">—</option>{usuarios.map(u => <option key={u.id} value={u.id}>{u.nombre}</option>)}</select></Campo>
              <Campo label="Base / segmento"><input value={f.segmento} onChange={e => setF({ ...f, segmento: e.target.value })} placeholder="Ej: Odontólogos CABA" style={inp} /></Campo>
              <Campo label="Plataforma"><input list="plataformas-email" value={f.plataforma} onChange={e => setF({ ...f, plataforma: e.target.value })} placeholder="Emblue, HubSpot…" style={inp} /><datalist id="plataformas-email"><option value="Emblue" /><option value="HubSpot" /><option value="Gmail" /></datalist></Campo>
            </div>
            <Campo label="Campaña (opcional)"><select value={f.campana_id} onChange={e => setF({ ...f, campana_id: e.target.value })} style={inp}><option value="">Sin campaña</option>{campanas.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}</select></Campo>

            <p style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text)', margin: '0.4rem 0 0.5rem' }}>Resultados <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>(dejá vacío lo que no tengas)</span></p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 120px), 1fr))', gap: '0 12px' }}>
              {METRICAS.map(x => <Campo key={x.k} label={x.label}><input inputMode="numeric" value={f[x.k]} onChange={e => setF({ ...f, [x.k]: e.target.value.replace(/[^\d]/g, '') })} placeholder="—" style={inp} /></Campo>)}
              <Campo label="Ventas atribuidas ($)"><input inputMode="decimal" value={f.ventas_ars} onChange={e => setF({ ...f, ventas_ars: e.target.value.replace(/[^\d.,]/g, '') })} placeholder="—" style={inp} /></Campo>
            </div>
            <Campo label="Link a la pieza (opcional)"><input value={f.link} onChange={e => setF({ ...f, link: e.target.value })} placeholder="https://…" style={inp} /></Campo>
            <Campo label="Notas / aprendizajes"><textarea value={f.notas} onChange={e => setF({ ...f, notas: e.target.value })} rows={3} style={{ ...inp, resize: 'vertical' }} /></Campo>
            {error && <p role="alert" style={{ color: '#ef4444', fontSize: '0.8rem', margin: '0 0 8px' }}>{error}</p>}
            <div className="modal-actions" style={{ display: 'flex', gap: 10 }}>
              {editando !== 'nuevo' && <button onClick={borrar} style={{ padding: '0.65rem 0.9rem', border: '1.5px solid #fecaca', borderRadius: 8, background: 'var(--bg-card)', color: '#ef4444', cursor: 'pointer', fontSize: '0.875rem' }}>Borrar</button>}
              <button onClick={() => setEditando(null)} style={{ flex: 1, padding: '0.65rem', border: '1.5px solid var(--border)', borderRadius: 8, backgroundColor: 'var(--bg-card)', cursor: 'pointer', fontSize: '0.875rem', color: 'var(--text)' }}>Cancelar</button>
              <button onClick={guardar} disabled={!f.asunto.trim() || guardando} style={{ flex: 2, padding: '0.65rem', border: 'none', borderRadius: 8, backgroundColor: '#f15922', color: '#fff', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 600, opacity: !f.asunto.trim() || guardando ? 0.6 : 1 }}>{guardando ? 'Guardando…' : 'Guardar'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
