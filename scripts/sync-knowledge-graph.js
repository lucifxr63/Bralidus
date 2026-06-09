/**
 * sync-knowledge-graph.js
 * Sube archivos .md locales al Knowledge Graph de ValidateAI.
 *
 * Uso:
 *   node scripts/sync-knowledge-graph.js [directorio] [categoria]
 *
 *   directorio  Ruta a la carpeta con archivos .md (default: ./knowledge)
 *   categoria   normativa | metodologia | mercado (default: metodologia)
 *
 * Requiere variables de entorno (las lee desde .env.local automáticamente):
 *   VITE_SUPABASE_URL         URL del proyecto Supabase
 *   SUPABASE_SERVICE_ROLE_KEY Service role key (nunca el anon key)
 *
 * Ejemplo:
 *   node scripts/sync-knowledge-graph.js ./docs/normativa normativa
 */

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, extname, basename } from 'node:path'

// ── Carga .env.local sin dependencias externas ───────────────────────────────
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
} catch { /* .env.local opcional */ }

// ── Config ───────────────────────────────────────────────────────────────────
const SUPABASE_URL      = process.env.VITE_SUPABASE_URL
const SERVICE_ROLE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY
const INGEST_ENDPOINT   = `${SUPABASE_URL}/functions/v1/api-v1/vault/ingest`

const dir      = process.argv[2] ?? './knowledge'
const category = process.argv[3] ?? 'metodologia'

const VALID_CATS = ['normativa', 'metodologia', 'mercado']

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('❌  Falta VITE_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY')
  console.error('    Agrégalos a .env.local o como variables de entorno.')
  process.exit(1)
}

if (!VALID_CATS.includes(category)) {
  console.error(`❌  Categoría inválida: "${category}". Usa: ${VALID_CATS.join(' | ')}`)
  process.exit(1)
}

// ── Parser (misma lógica que KnowledgeGraph.tsx::parseMdFile) ────────────────
function parseMdFile(filename, raw, cat) {
  const sourceFile = filename.replace(/\.md$/i, '')
  let titulo = sourceFile
  let tags = []
  let body = raw

  const fmMatch = raw.match(/^---\n([\s\S]*?)\n---\n?/)
  if (fmMatch) {
    const fm = fmMatch[1]
    const tMatch = fm.match(/titulo:\s*(.+)/)
    if (tMatch) titulo = tMatch[1].trim()
    const tagsMatch = fm.match(/tags:\s*\[([^\]]*)\]/)
    if (tagsMatch) tags = tagsMatch[1].split(',').map(t => t.trim().replace(/^['"]|['"]$/g, '')).filter(Boolean)
    body = raw.slice(fmMatch[0].length)
  }

  const nodes = []
  const edges = []
  const seenEdges = new Set()
  const sections = body.split(/\n(?=#{2,}\s)/)
  let isFirst = true

  for (const section of sections) {
    const headerMatch = section.match(/^#{2,}\s+(.+)/)
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
      .replace(/[#*_`]/g, '')
      .replace(/\n+/g, ' ')
      .trim()

    if (content.length > 20) {
      nodes.push({ document_title: titulo, header_path: header, content, category: cat, tags, source_file: sourceFile })
    }
    isFirst = false
  }

  return { nodes, edges }
}

// ── Recolecta archivos .md recursivamente ────────────────────────────────────
function collectMdFiles(dirPath) {
  const files = []
  try {
    for (const entry of readdirSync(dirPath)) {
      const full = join(dirPath, entry)
      if (statSync(full).isDirectory()) {
        files.push(...collectMdFiles(full))
      } else if (extname(entry).toLowerCase() === '.md') {
        files.push(full)
      }
    }
  } catch (err) {
    console.error(`❌  No se pudo leer el directorio: ${dirPath}`)
    console.error(`    ${err.message}`)
    process.exit(1)
  }
  return files
}

// ── Main ─────────────────────────────────────────────────────────────────────
const mdFiles = collectMdFiles(dir)

if (mdFiles.length === 0) {
  console.warn(`⚠️  No se encontraron archivos .md en: ${dir}`)
  process.exit(0)
}

console.log(`📂  ${mdFiles.length} archivo(s) encontrado(s) en "${dir}" [categoría: ${category}]`)

const allNodes = []
const allEdges = []

for (const filePath of mdFiles) {
  const raw = readFileSync(filePath, 'utf8')
  const { nodes, edges } = parseMdFile(basename(filePath), raw, category)
  allNodes.push(...nodes)
  allEdges.push(...edges)
  console.log(`   ✓ ${basename(filePath)} → ${nodes.length} secciones, ${edges.length} links`)
}

if (allNodes.length === 0) {
  console.warn('⚠️  Ningún archivo produjo contenido válido (secciones con >20 chars).')
  process.exit(0)
}

console.log(`\n🚀  Subiendo ${allNodes.length} nodos y ${allEdges.length} edges a ${INGEST_ENDPOINT} ...`)

const res = await fetch(INGEST_ENDPOINT, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
  },
  body: JSON.stringify({ nodes: allNodes, edges: allEdges }),
})

const text = await res.text()
let result
try { result = JSON.parse(text) } catch { result = { raw: text } }

if (!res.ok) {
  console.error(`\n❌  Error HTTP ${res.status}:`, result.error ?? result.raw ?? result)
  process.exit(1)
}

console.log(`\n✅  Sincronización completa:`)
console.log(`   Nodos upsertados : ${result.nodes_upserted ?? '?'}`)
console.log(`   Edges upsertados : ${result.edges_upserted ?? '?'}`)
console.log(`   Archivos procesados: ${mdFiles.length}`)
