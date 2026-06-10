import { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  BackgroundVariant,
  ConnectionMode,
  type Node,
  type Edge,
  type NodeTypes,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { supabase } from '@/lib/supabase';
import { Network, Loader2, Upload } from 'lucide-react';
import { toast } from 'sonner';

interface RawKnNode  { document_title: string; category: string }
interface RawKnEdge  { source_title: string; target_title: string }
interface DocNodeData extends Record<string, unknown> {
  label: string; category: string; degree: number; color: string; isHub: boolean;
}
interface VaultNode {
  document_title: string; header_path: string; content: string;
  category: string; tags: string[];
}
interface VaultEdge { source_title: string; target_title: string; relation_type: string }

const CAT: Record<string, { color: string; label: string }> = {
  normativa:   { color: '#3B82F6', label: 'Normativa' },
  metodologia: { color: '#10B981', label: 'Metodología' },
  mercado:     { color: '#F59E0B', label: 'Mercado' },
};

const CLUSTER_ORIGIN: Record<string, [number, number]> = {
  normativa:   [-1200, 0],
  metodologia: [   80, 0],
  mercado:     [ 1600, 0],
};

// Ring sizes and radii — generous spacing so nodes don't overlap
const RINGS = [
  { r: 140, max: 6  },
  { r: 290, max: 12 },
  { r: 460, max: 20 },
  { r: 650, max: 28 },
  { r: 860, max: 38 },
  { r: 1090, max: 50 },
];

function placeInRings(nodes: Array<{ title: string; degree: number }>, cx: number, cy: number) {
  const sorted = [...nodes].sort((a, b) => b.degree - a.degree);
  const positions: Record<string, [number, number]> = {};
  let idx = 0;
  for (const ring of RINGS) {
    if (idx >= sorted.length) break;
    const count = Math.min(ring.max, sorted.length - idx);
    // Offset odd rings by half-step to stagger and reduce visual overlap
    const offset = (idx % 2 === 1) ? Math.PI / count : 0;
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * 2 * Math.PI - Math.PI / 2 + offset;
      positions[sorted[idx].title] = [
        cx + Math.cos(angle) * ring.r,
        cy + Math.sin(angle) * ring.r,
      ];
      idx++;
    }
  }
  // Grid overflow for very large clusters
  for (; idx < sorted.length; idx++) {
    const cols = 10;
    const row = Math.floor(idx / cols);
    const col = idx % cols;
    positions[sorted[idx].title] = [cx - 450 + col * 100, cy + 1150 + row * 90];
  }
  return positions;
}

function buildGraph(rawNodes: RawKnNode[], rawEdges: RawKnEdge[], filterCat: string | null) {
  // Deduplicate by document_title
  const seen = new Set<string>();
  const unique: RawKnNode[] = [];
  rawNodes.forEach(n => {
    if (!seen.has(n.document_title)) { seen.add(n.document_title); unique.push(n); }
  });

  // Degree (count both inbound and outbound)
  const degree = new Map<string, number>();
  unique.forEach(n => degree.set(n.document_title, 0));
  rawEdges.forEach(e => {
    degree.set(e.source_title, (degree.get(e.source_title) ?? 0) + 1);
    degree.set(e.target_title, (degree.get(e.target_title) ?? 0) + 1);
  });

  const visibleNodes = filterCat ? unique.filter(n => n.category === filterCat) : unique;
  const visibleIds   = new Set(visibleNodes.map(n => n.document_title));

  // Group by category
  const byCategory = new Map<string, RawKnNode[]>();
  visibleNodes.forEach(n => {
    const cat = n.category || 'metodologia';
    byCategory.set(cat, [...(byCategory.get(cat) ?? []), n]);
  });

  // Place nodes in rings
  const positions: Record<string, [number, number]> = {};
  byCategory.forEach((group, cat) => {
    const [cx, cy] = filterCat ? [0, 0] : (CLUSTER_ORIGIN[cat] ?? [0, 0]);
    Object.assign(positions, placeInRings(
      group.map(n => ({ title: n.document_title, degree: degree.get(n.document_title) ?? 0 })),
      cx, cy,
    ));
  });

  const maxDeg = Math.max(1, ...Array.from(degree.values()));

  const nodes: Node[] = visibleNodes.map(n => {
    const deg  = degree.get(n.document_title) ?? 0;
    const cat  = n.category || 'metodologia';
    const color = CAT[cat]?.color ?? '#0EB5C6';
    const isHub = deg >= 4;
    const r = Math.max(10, Math.min(22, 10 + (deg / maxDeg) * 12));
    const [x, y] = positions[n.document_title] ?? [0, 0];
    return {
      id: n.document_title,
      type: 'doc',
      // Centre the node precisely at its position
      position: { x: x - 40, y: y - r - 12 },
      data: { label: n.document_title, category: cat, degree: deg, color, isHub } satisfies DocNodeData,
      style: { background: 'transparent', border: 'none', boxShadow: 'none', padding: 0, width: 80 },
    };
  });

  // Edges: keep only pairs where both endpoints are visible
  // Sort by combined degree (strongest relationships first) and cap at 200
  const validEdges = rawEdges
    .filter(e => visibleIds.has(e.source_title) && visibleIds.has(e.target_title))
    .sort((a, b) => {
      const da = (degree.get(a.source_title) ?? 0) + (degree.get(a.target_title) ?? 0);
      const db = (degree.get(b.source_title) ?? 0) + (degree.get(b.target_title) ?? 0);
      return db - da;
    })
    .slice(0, 200);

  const edges: Edge[] = validEdges.map((e, i) => {
    const srcDeg = degree.get(e.source_title) ?? 0;
    const opacity = (0.05 + (srcDeg / maxDeg) * 0.18).toFixed(2);
    return {
      id: `ke${i}`,
      source: e.source_title,
      target: e.target_title,
      // 'straight' draws a direct line between node centres — no bezier curves
      // converging at handle points, which was causing the bright spike
      type: 'straight',
      style: { stroke: `rgba(255,255,255,${opacity})`, strokeWidth: 1 },
    };
  });

  return { nodes, edges };
}

// No Handle components — ReactFlow will connect from the node bounding box centre.
// This eliminates the "all edges converge at Position.Top" spike.
function DocNode({ data }: { data: DocNodeData }) {
  const r = Math.max(10, Math.min(22, 10 + (data.degree / 12) * 12));
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, pointerEvents: 'none' }}>
      <div style={{
        width: r * 2, height: r * 2, borderRadius: '50%',
        background: data.color + (data.isHub ? '30' : '15'),
        border: `${data.isHub ? 2 : 1.5}px solid ${data.color + (data.isHub ? 'CC' : '88')}`,
        boxShadow: data.isHub ? `0 0 ${r + 4}px ${data.color}33` : 'none',
        flexShrink: 0,
      }} />
      <span style={{
        fontSize: 8.5,
        color: data.isHub ? '#C4C9D4' : '#5A6070',
        fontWeight: data.isHub ? 600 : 400,
        textAlign: 'center', maxWidth: 76, lineHeight: 1.25,
        display: 'block', wordBreak: 'break-word',
      }}>
        {data.label.length > 26 ? data.label.slice(0, 24) + '…' : data.label}
      </span>
    </div>
  );
}

const NODE_TYPES: NodeTypes = { doc: DocNode };

function parseMdFile(filename: string, raw: string, category: string): { nodes: VaultNode[]; edges: VaultEdge[] } {
  const sourceFile = filename.replace(/\.md$/i, '');
  let titulo = sourceFile, tags: string[] = [], body = raw;
  const fmMatch = raw.match(/^---\n([\s\S]*?)\n---\n?/);
  if (fmMatch) {
    const fm = fmMatch[1];
    const tMatch = fm.match(/titulo:\s*(.+)/);
    if (tMatch) titulo = tMatch[1].trim();
    const tagsMatch = fm.match(/tags:\s*\[([^\]]*)\]/);
    if (tagsMatch) tags = tagsMatch[1].split(',').map(t => t.trim().replace(/^['"]|['"]$/g, '')).filter(Boolean);
    body = raw.slice(fmMatch[0].length);
  }
  const nodes: VaultNode[] = [];
  const edges: VaultEdge[] = [];
  const seenEdges = new Set<string>();
  const sections = body.split(/\n(?=#{2,}\s)/);
  let isFirst = true;
  for (const section of sections) {
    const headerMatch = section.match(/^#{2,}\s+(.+)/);
    const header = headerMatch ? headerMatch[1].trim() : (isFirst ? 'Introduccion' : 'Contenido');
    const sectionRaw = headerMatch ? section.slice(headerMatch[0].length) : section;
    const wikilinkRe = /\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g;
    let m;
    while ((m = wikilinkRe.exec(sectionRaw)) !== null) {
      const target = m[1].trim();
      const key = `${titulo}::${target}`;
      if (target && target !== titulo && !seenEdges.has(key)) {
        seenEdges.add(key);
        edges.push({ source_title: titulo, target_title: target, relation_type: 'MENTIONS' });
      }
    }
    const content = sectionRaw
      .replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, '$2').replace(/\[\[([^\]]+)\]\]/g, '$1')
      .replace(/[#*_`]/g, '').replace(/\n+/g, ' ').trim();
    if (content.length > 20)
      nodes.push({ document_title: titulo, header_path: header, content, category, tags });
    isFirst = false;
  }
  return { nodes, edges };
}

export function KnowledgeGraph() {
  const [rawNodes, setRawNodes]   = useState<RawKnNode[]>([]);
  const [rawEdges, setRawEdges]   = useState<RawKnEdge[]>([]);
  const [loading,  setLoading]    = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadCat, setUploadCat] = useState<'normativa' | 'metodologia' | 'mercado'>('metodologia');
  const [filterCat, setFilterCat] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [nodesRes, edgesRes] = await Promise.all([
      supabase.from('knowledge_nodes').select('document_title, category'),
      supabase.from('knowledge_edges').select('source_title, target_title'),
    ]);
    if (nodesRes.data) setRawNodes(nodesRes.data as RawKnNode[]);
    if (edgesRes.data) setRawEdges(edgesRes.data as RawKnEdge[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    setUploading(true);
    try {
      const allNodes: VaultNode[] = [];
      const allEdges: VaultEdge[] = [];
      for (const file of files) {
        const { nodes, edges } = parseMdFile(file.name, await file.text(), uploadCat);
        allNodes.push(...nodes); allEdges.push(...edges);
      }
      if (allNodes.length === 0) { toast.error('No se encontró contenido válido'); return; }
      const { data: { session } } = await supabase.auth.getSession();
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
      const res = await fetch(`${supabaseUrl}/functions/v1/api-v1/vault/ingest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
        body: JSON.stringify({ nodes: allNodes, edges: allEdges }),
      });
      const raw2 = await res.text();
      let result: Record<string, unknown>;
      try { result = JSON.parse(raw2) as Record<string, unknown>; } catch { result = { raw: raw2 }; }
      if (!res.ok) throw new Error((result.error as string) ?? 'Error');
      toast.success(`${result.nodes_upserted} nodos sincronizados`);
      await load();
    } catch (err: unknown) {
      toast.error(`Error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }, [uploadCat, load]);

  const { nodes, edges } = useMemo(
    () => rawNodes.length ? buildGraph(rawNodes, rawEdges, filterCat) : { nodes: [], edges: [] },
    [rawNodes, rawEdges, filterCat],
  );

  const stats = useMemo(() => {
    const seen = new Set<string>();
    const catCount: Record<string, number> = {};
    rawNodes.forEach(n => {
      if (!seen.has(n.document_title)) {
        seen.add(n.document_title);
        catCount[n.category || 'metodologia'] = (catCount[n.category || 'metodologia'] ?? 0) + 1;
      }
    });
    return { totalDocs: seen.size, catCount };
  }, [rawNodes]);

  return (
    <div className="bg-white dark:bg-[#12121A] rounded-2xl border border-gray-100 dark:border-white/5 shadow-sm overflow-hidden">
      {/* ── Header ── */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-b border-gray-100 dark:border-white/5">
        <div className="flex items-center gap-2 flex-wrap">
          <Network className="w-4 h-4 text-teal-400 shrink-0" />
          <span className="text-sm font-bold text-gray-900 dark:text-white">Knowledge Graph</span>
          {!loading && (
            <span className="text-xs bg-teal-500/10 text-teal-400 px-2 py-0.5 rounded-full font-medium">
              {stats.totalDocs} docs · {rawEdges.length} links
            </span>
          )}
          {/* Category filter */}
          <div className="flex items-center gap-1 ml-1">
            {(['all', 'normativa', 'metodologia', 'mercado'] as const).map(key => {
              const isAll   = key === 'all';
              const active  = isAll ? filterCat === null : filterCat === key;
              const color   = isAll ? '#6B7280' : CAT[key].color;
              const label   = isAll ? 'Todos' : CAT[key].label;
              const count   = isAll ? stats.totalDocs : (stats.catCount[key] ?? 0);
              return (
                <button
                  key={key}
                  onClick={() => setFilterCat(isAll ? null : (filterCat === key ? null : key))}
                  className="text-xs px-2.5 py-0.5 rounded-full transition-all flex items-center gap-1 cursor-pointer"
                  style={{
                    background: active ? color + '22' : 'transparent',
                    border: `1px solid ${active ? color + '66' : 'transparent'}`,
                    color: active ? '#E5E7EB' : '#6B7280',
                    fontWeight: active ? 600 : 400,
                  }}
                >
                  {!isAll && <span style={{ width: 6, height: 6, borderRadius: '50%', background: color, display: 'inline-block' }} />}
                  {label}
                  {!loading && <span style={{ opacity: 0.55 }}>({count})</span>}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={uploadCat}
            onChange={e => setUploadCat(e.target.value as typeof uploadCat)}
            disabled={uploading}
            className="text-xs bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-lg px-2 py-1.5 text-gray-600 dark:text-gray-300 focus:outline-none focus:ring-1 focus:ring-teal-500 disabled:opacity-50"
          >
            <option value="normativa">Normativa</option>
            <option value="metodologia">Metodología</option>
            <option value="mercado">Mercado</option>
          </select>
          <input ref={fileInputRef} type="file" accept=".md" multiple className="hidden" onChange={handleUpload} />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading || loading}
            className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-teal-500/10 text-teal-400 hover:bg-teal-500/20 transition-colors disabled:opacity-50"
          >
            {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
            {uploading ? 'Subiendo…' : 'Subir .md'}
          </button>
        </div>
      </div>

      {/* ── Graph canvas ── */}
      {loading ? (
        <div className="h-[640px] flex items-center justify-center gap-2 text-sm text-gray-400">
          <Loader2 className="w-4 h-4 animate-spin" /> Cargando grafo…
        </div>
      ) : nodes.length === 0 ? (
        <div className="h-[640px] flex flex-col items-center justify-center gap-2 text-gray-400">
          <Network className="w-10 h-10 text-gray-300" />
          <p className="text-sm">Knowledge base vacío</p>
          <code className="text-xs bg-gray-100 dark:bg-white/5 px-3 py-1 rounded-lg font-mono mt-1">npm run sync</code>
        </div>
      ) : (
        <div style={{ height: 640 }}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={NODE_TYPES}
            // Loose mode: edges connect to node bounding box, not a specific Handle point.
            // This prevents all edges converging at Position.Top causing the bright spike.
            connectionMode={ConnectionMode.Loose}
            fitView
            fitViewOptions={{ padding: 0.08 }}
            nodesDraggable={false}
            nodesConnectable={false}
            elementsSelectable={false}
            panOnScroll
            minZoom={0.08}
            maxZoom={4}
            style={{ background: '#07070D' }}
          >
            <Background variant={BackgroundVariant.Dots} gap={36} size={1} color="rgba(255,255,255,0.02)" />
            <Controls
              showInteractive={false}
              style={{ background: '#12121A', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8 }}
            />
            <MiniMap
              nodeColor={(n) => (n.data as DocNodeData).color ?? '#0EB5C6'}
              style={{ background: '#07070D', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8 }}
              maskColor="rgba(7,7,13,0.8)"
            />
          </ReactFlow>
        </div>
      )}
    </div>
  );
}
