import { supabase } from '@/lib/supabase'

// ───────── Tipos ─────────
export type Usuario = { id: string; nombre: string; slug: string; avatar_color: string; avatar_emoji: string; rol: string; activo?: boolean }
export type Etiqueta = { id: string; nombre: string; color: string }
export type Tarea = {
  id: string; titulo: string; descripcion: string | null
  estado: string; prioridad: string; deadline: string
  creado_por: string | null; responsable_id: string | null
  categoria: string | null; campana_id: string | null
  requiere_aprobacion: boolean
  recurrencia: string | null; recurrencia_origen_id: string | null; siguiente_generada: boolean
  horas_dedicadas: number | null
  creado_en: string; actualizado_en: string | null
  enviada_revision_en: string | null; aprobada_en: string | null; finalizada_en: string | null
  asignados: Usuario[]        // todas las personas involucradas (incluye al responsable)
  responsable: Usuario | null
  etiquetas: Etiqueta[]
  subtareas: { total: number; hechas: number }
}

// ───────── Estados ─────────
export const ESTADOS = [
  { key: 'pendiente', label: 'Pendiente', color: '#6b7280', bg: '#f3f4f6' },
  { key: 'en_proceso', label: 'En proceso', color: '#f59e0b', bg: '#fffbeb' },
  { key: 'para_revision', label: 'Para revisión', color: '#8b5cf6', bg: '#f5f3ff' },
  { key: 'correcciones', label: 'Correcciones solicitadas', color: '#ef4444', bg: '#fef2f2' },
  { key: 'finalizada', label: 'Finalizada', color: '#10b981', bg: '#f0fdf4' },
  { key: 'bloqueada', label: 'Bloqueada', color: '#374151', bg: '#e5e7eb' },
] as const

const LEGACY: Record<string, string> = { por_hacer: 'pendiente', en_progreso: 'en_proceso', hecho: 'finalizada' }
export const normEstado = (e: string) => LEGACY[e] || e
export const estadoInfo = (e: string) => ESTADOS.find(s => s.key === normEstado(e)) || ESTADOS[0]
export const estaCerrada = (e: string) => normEstado(e) === 'finalizada'
/** Valores de estado (nuevos y viejos) que cuentan como "cerrada", para filtros de PostgREST */
export const CERRADAS_SQL = '(finalizada,hecho)'

// ───────── Prioridades ─────────
export const PRIORIDADES: Record<string, { label: string; color: string; bg: string; rank: number }> = {
  urgente: { label: '🚨 Urgente', color: '#dc2626', bg: '#fee2e2', rank: 0 },
  alta: { label: '🔴 Alta', color: '#ef4444', bg: '#fef2f2', rank: 1 },
  media: { label: '🟡 Media', color: '#f59e0b', bg: '#fffbeb', rank: 2 },
  baja: { label: '🟢 Baja', color: '#10b981', bg: '#f0fdf4', rank: 3 },
}
export const prioridadInfo = (p: string) => PRIORIDADES[p] || PRIORIDADES.media

export const CATEGORIAS = ['Redes sociales', 'Email marketing', 'Web / SEO', 'Diseño', 'Eventos y cursos', 'Comercial', 'Administración', 'Otro']

export const ROLES: Record<string, string> = { mkt_reporte: 'Coordinación (MKT + Reporte)', mkt: 'Miembro (MKT)', mkt_limitado: 'Limitado' }
export const rolCorto = (r: string) => (r === 'mkt_reporte' ? 'Coordinación' : r === 'mkt_limitado' ? 'Limitado' : 'Marketing')

// ───────── Fechas (hora local de Argentina, no UTC) ─────────
export function isoLocal(d: Date) {
  const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, '0'), day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}
export const hoyISO = () => isoLocal(new Date())
export const sumarDias = (n: number, base = new Date()) => { const d = new Date(base); d.setDate(d.getDate() + n); return isoLocal(d) }
export const fechaCorta = (iso: string) => new Date(iso + 'T12:00:00').toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })
export const fechaLarga = (iso: string) => new Date(iso + 'T12:00:00').toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' })
export const vencida = (t: { deadline: string; estado: string }) => !estaCerrada(t.estado) && t.deadline < hoyISO()

// ───────── Permisos ─────────
export const PERMISOS: Record<string, string> = {
  ver_reportes: 'Ver Reportes',
  ver_dashboard_equipo: 'Ver el dashboard del equipo',
  ver_todas_tareas: 'Ver todas las tareas del equipo',
  asignar_a_otros: 'Asignar tareas a otras personas',
  aprobar_tareas: 'Aprobar / pedir correcciones',
  ver_presupuestos: 'Ver presupuestos y datos administrativos',
  gestionar_campanas: 'Ver y gestionar campañas',
}
const DEFAULT_PERMISOS: Record<string, Record<string, boolean>> = {
  mkt_reporte: { ver_reportes: true, ver_dashboard_equipo: true, ver_todas_tareas: true, asignar_a_otros: true, aprobar_tareas: true, ver_presupuestos: true, gestionar_campanas: true },
  mkt: { ver_reportes: false, ver_dashboard_equipo: true, ver_todas_tareas: true, asignar_a_otros: true, aprobar_tareas: false, ver_presupuestos: false, gestionar_campanas: true },
  mkt_limitado: { ver_reportes: false, ver_dashboard_equipo: false, ver_todas_tareas: false, asignar_a_otros: false, aprobar_tareas: false, ver_presupuestos: false, gestionar_campanas: false },
}
export type Permisos = Record<string, boolean>

// Todos ven y pueden lo mismo. Reportes, presupuestos y vistas de gestión viven solo en /ADMIN.
const PERMISOS_IGUALES: Permisos = { ver_reportes: false, ver_dashboard_equipo: false, ver_presupuestos: false, ver_todas_tareas: true, asignar_a_otros: true, aprobar_tareas: true, gestionar_campanas: true }
export async function cargarPermisos(_rol?: string): Promise<Permisos> {
  return { ...PERMISOS_IGUALES }
}

export async function usuariosConPermiso(permiso: string): Promise<Usuario[]> {
  const { data: roles } = await supabase.from('mkt_permisos').select('rol').eq('permiso', permiso).eq('habilitado', true)
  const rs = (roles || []).map((r: any) => r.rol)
  if (rs.length === 0) return []
  const { data } = await supabase.from('mkt_usuarios').select('*').eq('activo', true).in('rol', rs)
  return data || []
}

// ───────── Carga en lote (reemplaza las consultas por tarea) ─────────
export async function cargarUsuarios(): Promise<Usuario[]> {
  const { data } = await supabase.from('mkt_usuarios').select('*').eq('activo', true).neq('slug', 'admin').order('creado_en', { ascending: true })
  return data || []
}

export async function cargarTareas(opts: { usuarioId?: string; soloMias?: boolean } = {}): Promise<Tarea[]> {
  const [tr, ar, er, etr, ur, sr] = await Promise.all([
    supabase.from('mkt_tareas').select('*').order('deadline', { ascending: true }),
    supabase.from('mkt_tarea_asignados').select('tarea_id, usuario_id'),
    supabase.from('mkt_tarea_etiquetas').select('tarea_id, etiqueta_id'),
    supabase.from('mkt_etiquetas').select('*'),
    supabase.from('mkt_usuarios').select('*'),
    supabase.from('mkt_subtareas').select('tarea_id, completado'),
  ])
  const usuarios: Record<string, Usuario> = Object.fromEntries((ur.data || []).map((u: any) => [u.id, u]))
  const etiquetas: Record<string, Etiqueta> = Object.fromEntries((etr.data || []).map((e: any) => [e.id, e]))
  const asigPorTarea: Record<string, string[]> = {}
  ;(ar.data || []).forEach((a: any) => { (asigPorTarea[a.tarea_id] ||= []).push(a.usuario_id) })
  const etiPorTarea: Record<string, string[]> = {}
  ;(er.data || []).forEach((e: any) => { (etiPorTarea[e.tarea_id] ||= []).push(e.etiqueta_id) })
  const subPorTarea: Record<string, { total: number; hechas: number }> = {}
  ;(sr.data || []).forEach((s: any) => {
    const x = (subPorTarea[s.tarea_id] ||= { total: 0, hechas: 0 })
    x.total++; if (s.completado) x.hechas++
  })

  let tareas: Tarea[] = (tr.data || []).map((t: any) => {
    const ids = new Set<string>(asigPorTarea[t.id] || [])
    if (t.responsable_id) ids.add(t.responsable_id)
    return {
      ...t,
      estado: normEstado(t.estado),
      requiere_aprobacion: !!t.requiere_aprobacion,
      recurrencia: t.recurrencia || null,
      siguiente_generada: !!t.siguiente_generada,
      asignados: [...ids].map(id => usuarios[id]).filter(Boolean),
      responsable: t.responsable_id ? usuarios[t.responsable_id] || null : null,
      etiquetas: (etiPorTarea[t.id] || []).map(id => etiquetas[id]).filter(Boolean),
      subtareas: subPorTarea[t.id] || { total: 0, hechas: 0 },
    }
  })
  if (opts.soloMias && opts.usuarioId) {
    tareas = tareas.filter(t => t.creado_por === opts.usuarioId || t.asignados.some(a => a.id === opts.usuarioId))
  }
  return tareas
}

export const esMia = (t: Tarea, uid: string) => t.responsable_id === uid || t.asignados.some(a => a.id === uid) || t.creado_por === uid

// ───────── Historial y notificaciones ─────────
export async function log(usuarioId: string, tareaId: string | null, titulo: string, accion: string, detalle?: string) {
  await supabase.from('mkt_historial').insert({ usuario_id: usuarioId, tarea_id: tareaId, tarea_titulo: titulo, accion, detalle: detalle || null })
}

export const NOTIF_TIPOS: Record<string, string> = {
  tarea_asignada: 'Me asignan una tarea',
  tarea_reasignada: 'Cambia el responsable de mi tarea',
  tarea_comentario: 'Comentarios en mis tareas',
  mencion: 'Me mencionan (@)',
  revision_solicitada: 'Piden mi revisión / aprobación',
  correcciones_solicitadas: 'Piden correcciones en mi tarea',
  tarea_aprobada: 'Aprueban mi tarea',
  tarea_vence_3dias: 'Tarea por vencer (3 días)',
  tarea_vence_hoy: 'Tarea que vence hoy',
  tarea_vencida: 'Tarea vencida',
}

/** Crea una notificación respetando las preferencias de cada persona. No se notifica a uno mismo. */
export async function notificar(destinos: string[], actorId: string | null, tipo: string, titulo: string, mensaje: string | null, tareaId: string, refTipo: string = 'tarea') {
  const ids = [...new Set(destinos)].filter(id => id && id !== actorId)
  if (ids.length === 0) return
  const { data: prefs } = await supabase.from('mkt_notif_prefs').select('usuario_id').eq('tipo', tipo).eq('activa', false).in('usuario_id', ids)
  const apagadas = new Set((prefs || []).map((p: any) => p.usuario_id))
  const filas = ids.filter(id => !apagadas.has(id)).map(id => ({ usuario_id: id, tipo, titulo, mensaje, referencia_id: tareaId, referencia_tipo: refTipo }))
  if (filas.length > 0) await supabase.from('mkt_notificaciones').insert(filas)
}

/** Avisos de vencimiento: una sola vez por tarea y tipo, para no saturar. */
export async function generarAvisosVencimiento(uid: string, tareas: Tarea[]) {
  const hoy = hoyISO(), en3 = sumarDias(3)
  const mias = tareas.filter(t => !estaCerrada(t.estado) && (t.responsable_id === uid || t.asignados.some(a => a.id === uid)))
  if (mias.length === 0) return
  const { data: prev } = await supabase.from('mkt_notificaciones').select('tipo, referencia_id').eq('usuario_id', uid)
    .in('tipo', ['tarea_vence_hoy', 'tarea_vence_3dias', 'tarea_vencida']).in('referencia_id', mias.map(t => t.id))
  const ya = new Set((prev || []).map((p: any) => `${p.tipo}:${p.referencia_id}`))
  for (const t of mias) {
    let tipo = '', titulo = ''
    if (t.deadline < hoy) { tipo = 'tarea_vencida'; titulo = 'Tarea vencida' }
    else if (t.deadline === hoy) { tipo = 'tarea_vence_hoy'; titulo = 'Vence hoy' }
    else if (t.deadline <= en3) { tipo = 'tarea_vence_3dias'; titulo = 'Vence en pocos días' }
    if (tipo && !ya.has(`${tipo}:${t.id}`)) await notificar([uid], null, tipo, titulo, `${t.titulo} · ${fechaCorta(t.deadline)}`, t.id)
  }
}

// ───────── Acciones de estado y aprobación ─────────
export type Accion = 'mover' | 'finalizar' | 'enviar_revision' | 'aprobar' | 'pedir_correcciones'

export async function aplicarAccion(opts: {
  tarea: Tarea; accion: Accion; actor: Usuario
  nuevoEstado?: string; horas?: number | null; comentario?: string
}) {
  const { tarea, accion, actor, comentario } = opts
  const ahora = new Date().toISOString()
  const base: Record<string, any> = { actualizado_en: ahora }
  const desde = estadoInfo(tarea.estado).label
  let hasta = ''

  if (accion === 'mover') {
    const e = opts.nuevoEstado!
    base.estado = e
    if (e !== 'finalizada') base.finalizada_en = null
    hasta = estadoInfo(e).label
    await supabase.from('mkt_tareas').update(base).eq('id', tarea.id)
    await log(actor.id, tarea.id, tarea.titulo, 'tarea_movida', `${desde} → ${hasta}`)
    return
  }

  if (accion === 'finalizar') {
    base.estado = 'finalizada'; base.finalizada_en = ahora
    if (opts.horas != null) base.horas_dedicadas = opts.horas
    await supabase.from('mkt_tareas').update(base).eq('id', tarea.id)
    await log(actor.id, tarea.id, tarea.titulo, 'tarea_movida', `${desde} → Finalizada`)
    await notificar([tarea.creado_por || ''], actor.id, 'tarea_aprobada', 'Tarea finalizada', tarea.titulo, tarea.id)
    await generarSiguienteRecurrente(tarea, actor)
    return
  }

  if (accion === 'enviar_revision') {
    const { count } = await supabase.from('mkt_tarea_revisiones').select('id', { count: 'exact', head: true }).eq('tarea_id', tarea.id).eq('accion', 'enviada')
    const version = (count || 0) + 1
    base.estado = 'para_revision'; base.enviada_revision_en = ahora
    await supabase.from('mkt_tareas').update(base).eq('id', tarea.id)
    await supabase.from('mkt_tarea_revisiones').insert({ tarea_id: tarea.id, version, accion: 'enviada', comentario: comentario || null, usuario_id: actor.id })
    await log(actor.id, tarea.id, tarea.titulo, 'revision_enviada', `Versión ${version}${comentario ? ' · ' + comentario : ''}`)
    const aprobadores = await usuariosConPermiso('aprobar_tareas')
    await notificar(aprobadores.map(u => u.id), actor.id, 'revision_solicitada', 'Pedido de revisión', `${actor.nombre}: ${tarea.titulo}`, tarea.id)
    return
  }

  if (accion === 'aprobar') {
    const { data: ult } = await supabase.from('mkt_tarea_revisiones').select('version').eq('tarea_id', tarea.id).order('creado_en', { ascending: false }).limit(1)
    base.estado = 'finalizada'; base.aprobada_en = ahora; base.finalizada_en = ahora
    await supabase.from('mkt_tareas').update(base).eq('id', tarea.id)
    await supabase.from('mkt_tarea_revisiones').insert({ tarea_id: tarea.id, version: ult?.[0]?.version || 1, accion: 'aprobada', comentario: comentario || null, usuario_id: actor.id })
    await log(actor.id, tarea.id, tarea.titulo, 'tarea_aprobada', comentario || undefined)
    await notificar(tarea.asignados.map(a => a.id), actor.id, 'tarea_aprobada', 'Tarea aprobada ✅', tarea.titulo, tarea.id)
    await generarSiguienteRecurrente(tarea, actor)
    return
  }

  if (accion === 'pedir_correcciones') {
    const { data: ult } = await supabase.from('mkt_tarea_revisiones').select('version').eq('tarea_id', tarea.id).order('creado_en', { ascending: false }).limit(1)
    base.estado = 'correcciones'; base.aprobada_en = null
    await supabase.from('mkt_tareas').update(base).eq('id', tarea.id)
    await supabase.from('mkt_tarea_revisiones').insert({ tarea_id: tarea.id, version: ult?.[0]?.version || 1, accion: 'correcciones', comentario: comentario || null, usuario_id: actor.id })
    await supabase.from('mkt_tarea_comentarios').insert({ tarea_id: tarea.id, autor_id: actor.id, contenido: `🔁 Correcciones solicitadas: ${comentario || ''}` })
    await log(actor.id, tarea.id, tarea.titulo, 'correcciones_pedidas', comentario || undefined)
    await notificar(tarea.asignados.map(a => a.id), actor.id, 'correcciones_solicitadas', 'Piden correcciones', `${tarea.titulo}: ${comentario || ''}`, tarea.id)
  }
}

/** Cuántas veces fue enviada a revisión (para versionar archivos) */
export async function versionActual(tareaId: string) {
  const { count } = await supabase.from('mkt_tarea_revisiones').select('id', { count: 'exact', head: true }).eq('tarea_id', tareaId).eq('accion', 'enviada')
  return (count || 0) + 1
}

// ───────── Recurrencia, reasignación y reprogramación ─────────
export function proximaFecha(deadline: string, recurrencia: string, anclaISO?: string) {
  const hoy = hoyISO()
  let d = new Date(deadline + 'T12:00:00')
  // Mensual: siempre el día de la tarea original (31 → fin de mes → vuelve al 31 cuando el mes lo permite)
  const dia = anclaISO ? new Date(anclaISO + 'T12:00:00').getDate() : d.getDate()
  let guard = 0
  do {
    if (recurrencia === 'semanal') d.setDate(d.getDate() + 7)
    else {
      const m = d.getMonth() + 1
      d = new Date(d.getFullYear(), m, 1, 12)
      const ultimo = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
      d.setDate(Math.min(dia, ultimo))
    }
  } while (isoLocal(d) < hoy && ++guard < 60)
  return isoLocal(d)
}

/** Al cerrar una tarea recurrente, crea la siguiente (una sola vez). */
export async function generarSiguienteRecurrente(tarea: Tarea, actor: Usuario) {
  if (!tarea.recurrencia || tarea.siguiente_generada) return
  const { data: marca } = await supabase.from('mkt_tareas').update({ siguiente_generada: true }).eq('id', tarea.id).eq('siguiente_generada', false).select('id')
  if (!marca || marca.length === 0) return // otra persona ya la generó
  let ancla = tarea.deadline
  if (tarea.recurrencia_origen_id) {
    const { data: o } = await supabase.from('mkt_tareas').select('deadline').eq('id', tarea.recurrencia_origen_id).maybeSingle()
    if (o?.deadline) ancla = o.deadline
  }
  const { data: nueva } = await supabase.from('mkt_tareas').insert({
    titulo: tarea.titulo, descripcion: tarea.descripcion, prioridad: tarea.prioridad, categoria: tarea.categoria,
    campana_id: tarea.campana_id, creado_por: tarea.creado_por, responsable_id: tarea.responsable_id,
    requiere_aprobacion: tarea.requiere_aprobacion, recurrencia: tarea.recurrencia,
    recurrencia_origen_id: tarea.recurrencia_origen_id || tarea.id, estado: 'pendiente',
    deadline: proximaFecha(tarea.deadline, tarea.recurrencia, ancla),
  }).select().single()
  if (!nueva) return
  const ids = tarea.asignados.map(a => a.id)
  if (ids.length) await supabase.from('mkt_tarea_asignados').insert(ids.map(u => ({ tarea_id: nueva.id, usuario_id: u })))
  if (tarea.etiquetas.length) await supabase.from('mkt_tarea_etiquetas').insert(tarea.etiquetas.map(e => ({ tarea_id: nueva.id, etiqueta_id: e.id })))
  const { data: subs } = await supabase.from('mkt_subtareas').select('texto, orden').eq('tarea_id', tarea.id)
  if (subs && subs.length) await supabase.from('mkt_subtareas').insert(subs.map((x: any) => ({ tarea_id: nueva.id, texto: x.texto, orden: x.orden })))
  await log(actor.id, nueva.id, nueva.titulo, 'tarea_creada', `Recurrente (${tarea.recurrencia})`)
  await notificar(ids, actor.id, 'tarea_asignada', 'Nueva tarea recurrente', `${tarea.titulo} · vence ${fechaCorta(nueva.deadline)}`, nueva.id)
}

export async function reasignarTarea(tarea: Tarea, nuevoId: string, actor: Usuario, nombreNuevo: string) {
  if (tarea.responsable_id === nuevoId) return
  await supabase.from('mkt_tareas').update({ responsable_id: nuevoId, actualizado_en: new Date().toISOString() }).eq('id', tarea.id)
  if (!tarea.asignados.some(a => a.id === nuevoId)) await supabase.from('mkt_tarea_asignados').insert({ tarea_id: tarea.id, usuario_id: nuevoId })
  await log(actor.id, tarea.id, tarea.titulo, 'tarea_reasignada', `${tarea.responsable?.nombre || 'Sin responsable'} → ${nombreNuevo}`)
  await notificar([nuevoId], actor.id, 'tarea_reasignada', 'Te pasaron una tarea', tarea.titulo, tarea.id)
}

export async function reprogramarTarea(tarea: Tarea, nuevaFecha: string, actor: Usuario) {
  if (tarea.deadline === nuevaFecha) return
  await supabase.from('mkt_tareas').update({ deadline: nuevaFecha, actualizado_en: new Date().toISOString() }).eq('id', tarea.id)
  await log(actor.id, tarea.id, tarea.titulo, 'tarea_reprogramada', `${fechaCorta(tarea.deadline)} → ${fechaCorta(nuevaFecha)}`)
}

/** Pasa todas las tareas abiertas de una persona a otra (responsable y colaborador). Nada se borra. */
export async function transferirTareas(desde: Usuario, hacia: Usuario, actor: Usuario): Promise<number> {
  const tareas = await cargarTareas({})
  const abiertas = tareas.filter(t => !estaCerrada(t.estado) && (t.responsable_id === desde.id || t.asignados.some(a => a.id === desde.id)))
  for (const t of abiertas) {
    const eraResp = t.responsable_id === desde.id
    const yaEsta = t.asignados.some(a => a.id === hacia.id)
    if (!yaEsta) await supabase.from('mkt_tarea_asignados').insert({ tarea_id: t.id, usuario_id: hacia.id })
    if (eraResp) await supabase.from('mkt_tareas').update({ responsable_id: hacia.id, actualizado_en: new Date().toISOString() }).eq('id', t.id)
    await supabase.from('mkt_tarea_asignados').delete().eq('tarea_id', t.id).eq('usuario_id', desde.id)
    await log(actor.id, t.id, t.titulo, 'tarea_reasignada', `${desde.nombre} → ${hacia.nombre} (traspaso)`)
  }
  if (abiertas.length > 0) await notificar([hacia.id], actor.id, 'tarea_reasignada', `Te pasaron ${abiertas.length} tarea${abiertas.length > 1 ? 's' : ''}`, `Traspaso desde ${desde.nombre}`, abiertas[0].id)
  return abiertas.length
}
