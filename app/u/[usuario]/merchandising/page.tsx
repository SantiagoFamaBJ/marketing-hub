'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useSesion } from '@/lib/useSesion'
import { fechaCorta, hoyISO } from '@/lib/tareas'

type Categoria = { id: string; nombre: string; orden: number }
type Item = { id: string; categoria_id: string; nombre: string; descripcion: string | null }
type Mov = { id: string; item_id: string; tipo: 'entrada' | 'ajuste' | 'regalo' | 'prestamo'; cantidad: number; fecha: string; destino: string | null; destinatario: string | null; devuelto_en: string | null; notas: string | null }
type Modal =
  | { t: 'detalle'; item: Item } | { t: 'stock'; item: Item } | { t: 'enviar'; item: Item } | { t: 'item'; item: Item | null }
  | { t: 'categoria'; cat: Categoria | null } | null

const inp: React.CSSProperties = { width: '100%', padding: '0.6rem 0.8rem', border: '1.5px solid var(--border)', borderRadius: 8, fontSize: '0.875rem', outline: 'none', color: 'var(--text)', backgroundColor: 'var(--input-bg)', fontFamily: 'inherit' }
const Campo = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div style={{ marginBottom: '0.8rem', minWidth: 0 }}><label style={{ fontSize: '0.76rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>{label}</label>{children}</div>
)
const btnP: React.CSSProperties = { padding: '0.6rem 1rem', border: 'none', borderRadius: 8, backgroundColor: '#f15922', color: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem' }
const btnS: React.CSSProperties = { padding: '0.6rem 0.9rem', border: '1.5px solid var(--border)', borderRadius: 8, backgroundColor: 'var(--bg-card)', color: 'var(--text)', cursor: 'pointer', fontSize: '0.85rem' }
const TIPO: Record<Mov['tipo'], { label: string; color: string }> = {
  entrada: { label: 'Ingreso de stock', color: '#10b981' }, ajuste: { label: 'Ajuste', color: '#6b7280' },
  regalo: { label: 'Regalo', color: '#ec4899' }, prestamo: { label: 'Préstamo', color: '#3b82f6' },
}
const entero = (v: string) => { const t = v.replace(/[^\d]/g, ''); return t ? parseInt(t, 10) : 0 }

function stockDe(movs: Mov[]) {
  let disponible = 0, prestado = 0, regalado = 0, ingresado = 0
  for (const m of movs) {
    if (m.tipo === 'entrada') { disponible += m.cantidad; ingresado += m.cantidad }
    else if (m.tipo === 'ajuste') disponible += m.cantidad
    else if (m.tipo === 'regalo') { disponible -= m.cantidad; regalado += m.cantidad }
    else if (m.tipo === 'prestamo' && !m.devuelto_en) { disponible -= m.cantidad; prestado += m.cantidad }
  }
  return { disponible, prestado, regalado, ingresado }
}

export default function MerchandisingPage() {
  const { usuario, permisos } = useSesion()
  const puedeEditar = !!permisos?.es_coord
  const [cats, setCats] = useState<Categoria[]>([])
  const [items, setItems] = useState<Item[]>([])
  const [movs, setMovs] = useState<Mov[]>([])
  const [cargando, setCargando] = useState(true)
  const [catSel, setCatSel] = useState('')
  const [modal, setModal] = useState<Modal>(null)
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)
  // formularios
  const [fItem, setFItem] = useState({ nombre: '', descripcion: '', categoria_id: '', stock: '' })
  const [fCat, setFCat] = useState('')
  const [fStock, setFStock] = useState({ modo: 'entrada', cantidad: '', notas: '' })
  const [fEnv, setFEnv] = useState({ tipo: 'regalo', cantidad: '1', fecha: hoyISO(), destino: '', destinatario: '', notas: '' })

  async function cargar() {
    const [c, i, m] = await Promise.all([
      supabase.from('mkt_merch_categorias').select('*').order('orden').order('nombre'),
      supabase.from('mkt_merch_items').select('id, categoria_id, nombre, descripcion').eq('activo', true).order('nombre'),
      supabase.from('mkt_merch_movimientos').select('*').order('fecha', { ascending: false }).order('creado_en', { ascending: false }),
    ])
    setCats((c.data as Categoria[]) || []); setItems((i.data as Item[]) || []); setMovs((m.data as Mov[]) || []); setCargando(false)
  }
  useEffect(() => { cargar() }, [])

  const movsDe = useMemo(() => { const r: Record<string, Mov[]> = {}; movs.forEach(m => (r[m.item_id] ||= []).push(m)); return r }, [movs])
  const stock = (id: string) => stockDe(movsDe[id] || [])
  const total = useMemo(() => items.reduce((a, it) => { const s = stockDe(movsDe[it.id] || []); return { disp: a.disp + s.disponible, pres: a.pres + s.prestado, reg: a.reg + s.regalado } }, { disp: 0, pres: 0, reg: 0 }), [items, movsDe])
  const pendientes = movs.filter(m => m.tipo === 'prestamo' && !m.devuelto_en)
  const visibles = items.filter(i => !catSel || i.categoria_id === catSel)
  const itemNombre = (id: string) => items.find(i => i.id === id)?.nombre || '—'

  function cerrar() { setModal(null); setError('') }
  async function correr(fn: () => PromiseLike<{ error: any }>) {
    if (guardando) return
    setGuardando(true); setError('')
    const { error: e } = await fn()
    setGuardando(false)
    if (e) { setError(e.message?.includes('destino') ? 'Indicá a dónde y a quién va.' : 'No se pudo guardar. ¿Estás con la cuenta de Santiago?'); return false }
    cerrar(); await cargar(); return true
  }

  if (!usuario) return null

  function abrirItem(item: Item | null) {
    setFItem(item ? { nombre: item.nombre, descripcion: item.descripcion || '', categoria_id: item.categoria_id, stock: '' } : { nombre: '', descripcion: '', categoria_id: catSel || cats[0]?.id || '', stock: '' })
    setModal({ t: 'item', item })
  }
  async function guardarItem() {
    if (!modal || modal.t !== 'item' || !fItem.nombre.trim() || !fItem.categoria_id) return
    const base = { nombre: fItem.nombre.trim(), descripcion: fItem.descripcion.trim() || null, categoria_id: fItem.categoria_id, actualizado_en: new Date().toISOString() }
    const it = modal.item
    await correr(async () => {
      if (it) return supabase.from('mkt_merch_items').update(base).eq('id', it.id)
      const { data, error: e } = await supabase.from('mkt_merch_items').insert(base).select('id').single()
      if (e || !data) return { error: e || new Error('sin id') }
      const n = entero(fItem.stock)
      return n > 0 ? supabase.from('mkt_merch_movimientos').insert({ item_id: data.id, tipo: 'entrada', cantidad: n, notas: 'Stock inicial', creado_por: usuario?.id }) : { error: null }
    })
  }
  async function borrarItem(it: Item) {
    if (!confirm(`¿Borrar "${it.nombre}"? También se borra su historial de movimientos.`)) return
    await correr(() => supabase.from('mkt_merch_items').delete().eq('id', it.id))
  }
  async function guardarCategoria() {
    if (!modal || modal.t !== 'categoria' || !fCat.trim()) return
    const cat = modal.cat
    await correr(() => cat ? supabase.from('mkt_merch_categorias').update({ nombre: fCat.trim() }).eq('id', cat.id) : supabase.from('mkt_merch_categorias').insert({ nombre: fCat.trim(), orden: Math.max(0, ...cats.map(c => c.orden)) + 1 }))
  }
  async function borrarCategoria(cat: Categoria) {
    if (items.some(i => i.categoria_id === cat.id)) { setError('Primero mové o borrá los ítems de esta categoría.'); return }
    if (!confirm(`¿Borrar la categoría "${cat.nombre}"?`)) return
    if (await correr(() => supabase.from('mkt_merch_categorias').delete().eq('id', cat.id))) setCatSel('')
  }
  async function guardarStock() {
    if (!modal || modal.t !== 'stock') return
    const n = entero(fStock.cantidad)
    if (n <= 0) { setError('Poné una cantidad mayor a cero.'); return }
    if (fStock.modo === 'quitar' && n > stock(modal.item.id).disponible) { setError('No hay tanto stock disponible para descontar.'); return }
    if (fStock.modo === 'quitar' && !fStock.notas.trim()) { setError('Aclarar el motivo del ajuste en las notas.'); return }
    const it = modal.item
    await correr(() => supabase.from('mkt_merch_movimientos').insert({ item_id: it.id, tipo: fStock.modo === 'entrada' ? 'entrada' : 'ajuste', cantidad: fStock.modo === 'entrada' ? n : -n, notas: fStock.notas.trim() || null, creado_por: usuario?.id }))
  }
  async function guardarEnvio() {
    if (!modal || modal.t !== 'enviar') return
    const n = entero(fEnv.cantidad), disp = stock(modal.item.id).disponible
    if (n <= 0) { setError('Poné una cantidad mayor a cero.'); return }
    if (n > disp) { setError(`Solo hay ${disp} disponible${disp === 1 ? '' : 's'}.`); return }
    if (!fEnv.destino.trim() || !fEnv.destinatario.trim()) { setError('Indicá a dónde va y a quién.'); return }
    const it = modal.item
    await correr(() => supabase.from('mkt_merch_movimientos').insert({ item_id: it.id, tipo: fEnv.tipo, cantidad: n, fecha: fEnv.fecha || hoyISO(), destino: fEnv.destino.trim(), destinatario: fEnv.destinatario.trim(), notas: fEnv.notas.trim() || null, creado_por: usuario?.id }))
  }
  async function devolver(m: Mov) {
    const { error: e } = await supabase.from('mkt_merch_movimientos').update({ devuelto_en: hoyISO() }).eq('id', m.id)
    if (e) setError('No se pudo marcar la devolución.'); else { setError(''); cargar() }
  }
  async function borrarMov(m: Mov) {
    if (!confirm('¿Borrar este movimiento? Se recalcula el stock.')) return
    const { error: e } = await supabase.from('mkt_merch_movimientos').delete().eq('id', m.id)
    if (e) setError('No se pudo borrar.'); else { setError(''); cargar() }
  }

  const overlay = (children: React.ReactNode, ancho = 520) => (
    <div className="modal-overlay" style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '0.75rem' }} onClick={e => { if (e.target === e.currentTarget) cerrar() }}>
      <div className="modal-sheet" style={{ backgroundColor: 'var(--bg-card)', borderRadius: 16, padding: '1.25rem', width: '100%', maxWidth: ancho, maxHeight: '94vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }}>{children}</div>
    </div>
  )
  const acciones = (guardar: () => void, etiqueta = 'Guardar', ok = true) => (
    <div className="modal-actions" style={{ display: 'flex', gap: 10, marginTop: 8 }}>
      <button onClick={cerrar} style={{ ...btnS, flex: 1 }}>Cancelar</button>
      <button onClick={guardar} disabled={!ok || guardando} style={{ ...btnP, flex: 2, opacity: !ok || guardando ? 0.6 : 1 }}>{guardando ? 'Guardando…' : etiqueta}</button>
    </div>
  )
  const err = error && <p role="alert" style={{ color: '#ef4444', fontSize: '0.8rem', margin: '0 0 8px' }}>{error}</p>
  const Kpi = ({ t, v, c }: { t: string; v: number; c: string }) => (
    <div style={{ backgroundColor: 'var(--bg-card)', border: '1.5px solid var(--border)', borderRadius: 12, padding: '0.7rem 0.85rem' }}>
      <p style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 600 }}>{t}</p><p style={{ fontSize: '1.4rem', fontWeight: 800, color: c }}>{v.toLocaleString('es-AR')}</p>
    </div>
  )
  const chip = (activo: boolean): React.CSSProperties => ({ padding: '0.4rem 0.85rem', minHeight: 38, borderRadius: 99, cursor: 'pointer', fontSize: '0.82rem', border: activo ? '2px solid #f15922' : '1.5px solid var(--border)', backgroundColor: activo ? '#f9ddd3' : 'var(--bg-card)', color: activo ? '#c94a1a' : 'var(--text)', fontWeight: activo ? 700 : 500 })
  const catSelObj = cats.find(c => c.id === catSel)

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto' }}>
      <div style={{ marginBottom: '1rem' }}>
        <h1 style={{ fontSize: 'clamp(1.25rem, 4vw, 1.6rem)', fontWeight: 700, color: 'var(--text)' }}>🎁 Merchandising</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Stock disponible y a quién se le entregó cada cosa.{!puedeEditar && ' Solo Santiago puede modificarlo.'}</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 140px), 1fr))', gap: 10, marginBottom: 14 }}>
        <Kpi t="Disponible" v={total.disp} c="#10b981" /><Kpi t="En préstamo" v={total.pres} c="#3b82f6" /><Kpi t="Regalado" v={total.reg} c="#ec4899" />
      </div>

      <div className="chip-row" style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14, alignItems: 'center' }}>
        <button style={chip(!catSel)} onClick={() => setCatSel('')}>Todo</button>
        {cats.map(c => <button key={c.id} style={chip(catSel === c.id)} onClick={() => setCatSel(c.id)}>{c.nombre}</button>)}
        {puedeEditar && <button style={{ ...chip(false), borderStyle: 'dashed' }} onClick={() => { setFCat(''); setModal({ t: 'categoria', cat: null }) }}>+ Categoría</button>}
        {puedeEditar && catSelObj && <>
          <button style={chip(false)} onClick={() => { setFCat(catSelObj.nombre); setModal({ t: 'categoria', cat: catSelObj }) }}>Renombrar</button>
          <button style={{ ...chip(false), color: '#ef4444' }} onClick={() => borrarCategoria(catSelObj)}>Borrar categoría</button>
        </>}
      </div>
      {!modal && err}

      {pendientes.length > 0 && !catSel && (
        <section aria-label="Préstamos pendientes" style={{ backgroundColor: 'var(--bg-card)', border: '1.5px solid #bfdbfe', borderRadius: 12, padding: '0.8rem 1rem', marginBottom: 14 }}>
          <p style={{ fontWeight: 700, color: 'var(--text)', fontSize: '0.88rem', marginBottom: 8 }}>🔄 Préstamos sin devolver ({pendientes.length})</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {pendientes.map(m => (
              <div key={m.id} style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', fontSize: '0.8rem', color: 'var(--text)' }}>
                <span style={{ flex: '1 1 220px', minWidth: 0, overflowWrap: 'anywhere' }}><strong>{m.cantidad} × {itemNombre(m.item_id)}</strong> → {m.destinatario} · {m.destino} <span style={{ color: 'var(--text-muted)' }}>({fechaCorta(m.fecha)})</span></span>
                {puedeEditar && <button onClick={() => devolver(m)} style={{ ...btnS, padding: '0.35rem 0.7rem', minHeight: 36 }}>Marcar devuelto</button>}
              </div>
            ))}
          </div>
        </section>
      )}

      {puedeEditar && <div style={{ marginBottom: 12 }}><button onClick={() => abrirItem(null)} disabled={cats.length === 0} style={btnP}>+ Nuevo ítem</button></div>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 290px), 1fr))', gap: 12 }}>
        {!cargando && visibles.length === 0 && <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-muted)' }}><p style={{ fontSize: '2rem' }}>🎁</p><p style={{ fontWeight: 600 }}>No hay ítems cargados{catSel ? ' en esta categoría' : ''}.</p></div>}
        {visibles.map(it => {
          const s = stock(it.id), cat = cats.find(c => c.id === it.categoria_id)
          return (
            <article key={it.id} style={{ backgroundColor: 'var(--bg-card)', border: '1.5px solid var(--border)', borderRadius: 14, padding: '0.9rem 1rem' }}>
              <p style={{ fontSize: '0.66rem', color: 'var(--text-muted)', fontWeight: 600 }}>{cat?.nombre}</p>
              <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text)', overflowWrap: 'anywhere' }}>{it.nombre}</h3>
              {it.descripcion && <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 2, overflowWrap: 'anywhere' }}>{it.descripcion}</p>}
              <p style={{ margin: '10px 0 2px', fontSize: '1.7rem', fontWeight: 800, color: s.disponible > 0 ? '#10b981' : '#ef4444', lineHeight: 1 }}>{s.disponible}<span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}> disponible{s.disponible === 1 ? '' : 's'}</span></p>
              <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>🔄 {s.prestado} en préstamo · 🎀 {s.regalado} regalado{s.regalado === 1 ? '' : 's'} · 📦 {s.ingresado} ingresado{s.ingresado === 1 ? '' : 's'}</p>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
                <button onClick={() => setModal({ t: 'detalle', item: it })} style={{ ...btnS, minHeight: 38 }}>Historial</button>
                {puedeEditar && <>
                  <button onClick={() => { setFStock({ modo: 'entrada', cantidad: '', notas: '' }); setModal({ t: 'stock', item: it }) }} style={{ ...btnS, minHeight: 38 }}>Stock</button>
                  <button onClick={() => { setFEnv({ tipo: 'regalo', cantidad: '1', fecha: hoyISO(), destino: '', destinatario: '', notas: '' }); setModal({ t: 'enviar', item: it }) }} disabled={s.disponible <= 0} style={{ ...btnP, minHeight: 38, opacity: s.disponible <= 0 ? 0.5 : 1 }}>Entregar</button>
                  <button onClick={() => abrirItem(it)} aria-label={`Editar ${it.nombre}`} style={{ ...btnS, minHeight: 38 }}>✏️</button>
                </>}
              </div>
            </article>
          )
        })}
      </div>

      {modal?.t === 'detalle' && overlay(<>
        <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text)', marginBottom: 2 }}>{modal.item.nombre}</h2>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 12 }}>{stock(modal.item.id).disponible} disponibles · historial completo</p>
        {err}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {(movsDe[modal.item.id] || []).length === 0 && <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Sin movimientos todavía.</p>}
          {(movsDe[modal.item.id] || []).map(m => {
            const tp = TIPO[m.tipo], sale = m.tipo === 'regalo' || m.tipo === 'prestamo'
            return (
              <div key={m.id} style={{ border: '1px solid var(--border)', borderLeft: `3px solid ${tp.color}`, borderRadius: 8, padding: '0.55rem 0.7rem' }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <strong style={{ color: tp.color, fontSize: '0.8rem' }}>{tp.label}</strong>
                  <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text)' }}>{sale ? '−' : m.cantidad > 0 ? '+' : ''}{m.cantidad}</span>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginLeft: 'auto' }}>{fechaCorta(m.fecha)}</span>
                </div>
                {sale && <p style={{ fontSize: '0.8rem', color: 'var(--text)', marginTop: 3, overflowWrap: 'anywhere' }}>A: <strong>{m.destinatario}</strong> · Destino: {m.destino}</p>}
                {m.tipo === 'prestamo' && <p style={{ fontSize: '0.75rem', marginTop: 2, color: m.devuelto_en ? '#10b981' : '#3b82f6', fontWeight: 600 }}>{m.devuelto_en ? `✓ Devuelto el ${fechaCorta(m.devuelto_en)}` : 'Sin devolver'}</p>}
                {m.notas && <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2, overflowWrap: 'anywhere' }}>{m.notas}</p>}
                {puedeEditar && <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                  {m.tipo === 'prestamo' && !m.devuelto_en && <button onClick={() => devolver(m)} style={{ ...btnS, padding: '0.3rem 0.6rem', minHeight: 34, fontSize: '0.75rem' }}>Marcar devuelto</button>}
                  <button onClick={() => borrarMov(m)} style={{ ...btnS, padding: '0.3rem 0.6rem', minHeight: 34, fontSize: '0.75rem', color: '#ef4444' }}>Borrar</button>
                </div>}
              </div>
            )
          })}
        </div>
        <div className="modal-actions" style={{ display: 'flex', gap: 10, marginTop: 12 }}>
          {puedeEditar && <button onClick={() => borrarItem(modal.item)} style={{ ...btnS, color: '#ef4444' }}>Borrar ítem</button>}
          <button onClick={cerrar} style={{ ...btnP, flex: 1 }}>Cerrar</button>
        </div>
      </>, 560)}

      {modal?.t === 'item' && overlay(<>
        <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text)', marginBottom: 12 }}>{modal.item ? 'Editar ítem' : 'Nuevo ítem'}</h2>
        <Campo label="Nombre *"><input value={fItem.nombre} onChange={e => setFItem({ ...fItem, nombre: e.target.value })} placeholder="Ej: Mate con bombilla" style={inp} /></Campo>
        <Campo label="Categoría *"><select value={fItem.categoria_id} onChange={e => setFItem({ ...fItem, categoria_id: e.target.value })} style={inp}>{cats.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}</select></Campo>
        <Campo label="Descripción (opcional)"><textarea value={fItem.descripcion} onChange={e => setFItem({ ...fItem, descripcion: e.target.value })} rows={2} style={{ ...inp, resize: 'vertical' }} /></Campo>
        {!modal.item && <Campo label="Stock inicial disponible"><input inputMode="numeric" value={fItem.stock} onChange={e => setFItem({ ...fItem, stock: e.target.value.replace(/[^\d]/g, '') })} placeholder="0" style={inp} /></Campo>}
        {err}{acciones(guardarItem, 'Guardar', !!fItem.nombre.trim() && !!fItem.categoria_id)}
      </>)}

      {modal?.t === 'categoria' && overlay(<>
        <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text)', marginBottom: 12 }}>{modal.cat ? 'Renombrar categoría' : 'Nueva categoría'}</h2>
        <Campo label="Nombre *"><input value={fCat} onChange={e => setFCat(e.target.value)} placeholder="Ej: Kits de mate" style={inp} /></Campo>
        {err}{acciones(guardarCategoria, 'Guardar', !!fCat.trim())}
      </>, 420)}

      {modal?.t === 'stock' && overlay(<>
        <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text)', marginBottom: 2 }}>Stock · {modal.item.nombre}</h2>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 12 }}>Hoy: {stock(modal.item.id).disponible} disponibles</p>
        <Campo label="Qué querés hacer"><select value={fStock.modo} onChange={e => setFStock({ ...fStock, modo: e.target.value })} style={inp}><option value="entrada">Cargar stock (ingresó mercadería)</option><option value="quitar">Descontar (rotura, pérdida, corrección)</option></select></Campo>
        <Campo label="Cantidad"><input inputMode="numeric" value={fStock.cantidad} onChange={e => setFStock({ ...fStock, cantidad: e.target.value.replace(/[^\d]/g, '') })} style={inp} /></Campo>
        <Campo label={fStock.modo === 'quitar' ? 'Motivo *' : 'Notas (opcional)'}><input value={fStock.notas} onChange={e => setFStock({ ...fStock, notas: e.target.value })} style={inp} /></Campo>
        {err}{acciones(guardarStock, 'Guardar', entero(fStock.cantidad) > 0)}
      </>, 440)}

      {modal?.t === 'enviar' && overlay(<>
        <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text)', marginBottom: 2 }}>Entregar · {modal.item.nombre}</h2>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 12 }}>Hay {stock(modal.item.id).disponible} disponibles</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 150px), 1fr))', gap: '0 12px' }}>
          <Campo label="Tipo"><select value={fEnv.tipo} onChange={e => setFEnv({ ...fEnv, tipo: e.target.value })} style={inp}><option value="regalo">🎀 Regalo</option><option value="prestamo">🔄 Préstamo</option></select></Campo>
          <Campo label="Cantidad"><input inputMode="numeric" value={fEnv.cantidad} onChange={e => setFEnv({ ...fEnv, cantidad: e.target.value.replace(/[^\d]/g, '') })} style={inp} /></Campo>
        </div>
        <Campo label="Fecha"><input type="date" value={fEnv.fecha} onChange={e => setFEnv({ ...fEnv, fecha: e.target.value })} style={inp} /></Campo>
        <Campo label="¿A dónde va? *"><input value={fEnv.destino} onChange={e => setFEnv({ ...fEnv, destino: e.target.value })} placeholder="Ej: Congreso FOUBA, local de Córdoba" style={inp} /></Campo>
        <Campo label="¿A quién? *"><input value={fEnv.destinatario} onChange={e => setFEnv({ ...fEnv, destinatario: e.target.value })} placeholder="Ej: Dr. Pérez, vendedor Juan" style={inp} /></Campo>
        <Campo label="Notas (opcional)"><input value={fEnv.notas} onChange={e => setFEnv({ ...fEnv, notas: e.target.value })} style={inp} /></Campo>
        {err}{acciones(guardarEnvio, fEnv.tipo === 'prestamo' ? 'Registrar préstamo' : 'Registrar regalo', entero(fEnv.cantidad) > 0 && !!fEnv.destino.trim() && !!fEnv.destinatario.trim())}
      </>)}
    </div>
  )
}
