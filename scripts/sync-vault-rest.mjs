/**
 * sync-vault-rest.mjs
 * Direct REST API upsert to knowledge_nodes + knowledge_edges (no Edge Function).
 * Use when the vault/ingest edge function auth fails (key mismatch).
 *
 * Usage:
 *   node scripts/sync-vault-rest.mjs <folder> <categoria>
 */

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, extname, basename } from 'node:path'

try {
  const envRaw = readFileSync('.env.local', 'utf8')
  for (const line of envRaw.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eqIdx = trimmed.indexOf('=')
    if (eqIdx < 1) continue
    const key = trimmed.slice(0, eqIdx).trim()
    const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '')
    if (!process.env[key]) process.env[key] = val
  }
} catch { /* optional */ }

const SUPABASE_URL     = process.env.VITE_SUPABASE_URL
const SERVICE_KEY      = process.env.SUPABASE_SERVICE_ROLE_KEY
const dir              = process.argv[2] ?? './knowledge'
const category         = process.argv[3] ?? 'metodologia'

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('❌  Falta VITE_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const HEADERS = {
  'Authorization': `Bearer ${SERVICE_KEY}`,
  'apikey': SERVICE_KEY,
  'Content-Type': 'application/json',
  'Prefer': 'return=minimal',
}

function parseMd(filename, raw, cat) {
  const sourceFile = filename.replace(/\.md$/i, '')
  let titulo = sourceFile
  let tags = []
  let body = raw

  const fmMatch = raw.match(/^---\n([\s\S]*?)\n---\n?/)
  if (fmMatch) {
    const fm = fmMatch[1]
    const tMatch = fm.match(/titulo:\s*"?([^"\n]+)"?/)
    if (tMatch) titulo = tMatch[1].trim()
    const tagsMatch = fm.match(/tags:\s*\[([^\]]*)\]/)
    if (tagsMatch) tags = tagsMatch[1].split(',').map(t => t.trim().replace(/^['"]|['"]$/g, '')).filter(Boolean)
    body = raw.slice(fmMatch[0].length)
  }

  const nodes = []
  const edges = []
  const seenEdges = new Set()
  const sections = body.split(/\n(?=#{1,3}\s)/)
  let isFirst = true

  for (const section of sections) {
    const headerMatch = section.match(/^#{1,3}\s+(.+)/)
    const header = headerMatch ? headerMatch[1].trim() : (isFirst ? 'Introduccion' : 'Contenido')
    const sectionRaw = headerMatch ? section.slice(headerMatch[0].length) : section

    const wikilinkRe = /\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g
    let m
    while ((m = wikilinkRe.exec(sectionRaw)) !== null) {
      const target = m[1].trim()
      const key = `${titulo}::${target}`
      if (target && target !== titulo && !seenEdges.has(key)) {
        seenEdges.add(key)
        edges.push({ source_title: titulo, target_title: target, relation_type: 'MENTIONS' })
      }
    }

    const content = sectionRaw
      .replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, '$2')
      .replace(/\[\[([^\]]+)\]\]/g, '$1')
      .replace(/[#*_`|]/g, '')
      .replace(/\n+/g, ' ')
      .trim()

    if (content.length > 20) {
      nodes.push({ document_title: titulo, header_path: header, content, category: cat, tags })
    }
    isFirst = false
  }

  return { titulo, nodes, edges }
}

function collectMd(dirPath) {
  const files = []
  for (const entry of readdirSync(dirPath)) {
    const full = join(dirPath, entry)
    if (statSync(full).isDirectory()) files.push(...collectMd(full))
    else if (extname(entry).toLowerCase() === '.md') files.push(full)
  }
  return files
}

async function supaDelete(table, filter) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${filter}`, { method: 'DELETE', headers: HEADERS })
  if (!r.ok) console.warn(`  ⚠ DELETE ${table} ${filter}: ${r.status}`)
}

async function supaInsert(table, rows) {
  if (rows.length === 0) return
  const BATCH = 50
  for (let i = 0; i < rows.length; i += BATCH) {
    const chunk = rows.slice(i, i + BATCH)
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
      method: 'POST', headers: HEADERS, body: JSON.stringify(chunk)
    })
    if (!r.ok) {
      const txt = await r.text()
      console.error(`  ❌ INSERT ${table}: ${r.status} ${txt.slice(0, 200)}`)
    }
  }
}

// ── Main ─────────────────────────────────────────────────────────────────────
const mdFiles = collectMd(dir)
console.log(`📂  ${mdFiles.length} archivo(s) en "${dir}" [${category}]\n`)

const allNodes = []
const allEdges = []
const docTitles = new Set()

for (const filePath of mdFiles) {
  const raw = readFileSync(filePath, 'utf8')
  const { titulo, nodes, edges } = parseMd(basename(filePath), raw, category)
  docTitles.add(titulo)
  allNodes.push(...nodes)
  allEdges.push(...edges)
  console.log(`   ✓ ${basename(filePath)} → ${nodes.length} secciones, ${edges.length} links`)
}

console.log(`\n🗑   Limpiando registros anteriores para ${docTitles.size} documentos...`)
for (const title of docTitles) {
  const enc = encodeURIComponent(title)
  await supaDelete('knowledge_nodes', `document_title=eq.${enc}`)
  await supaDelete('knowledge_edges', `source_title=eq.${enc}`)
}

console.log(`🚀  Insertando ${allNodes.length} nodos y ${allEdges.length} edges...`)
await supaInsert('knowledge_nodes', allNodes)
await supaInsert('knowledge_edges', allEdges)

console.log(`\n✅  Sincronización directa completa:`)
console.log(`   Nodos : ${allNodes.length}`)
console.log(`   Edges : ${allEdges.length}`)
console.log(`   Docs  : ${docTitles.size}`)
