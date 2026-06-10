import { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Handle,
  Position,
  BackgroundVariant,
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

// Cluster origins (well separated)
const CLUSTER_ORIGIN: Record<string, [number, number]> = {
  normativa:   [-780, 0],
  metodologia: [  80, 0],
  mercado:     [ 900, 0],
};

// Multi-ring radii and max nodes per ring
const RINGS = [
  { r: 100, max: 6  },
  { r: 200, max: 12 },
  { r: 310, max: 18 },
  { r: 430, max: 26 },
  { r: 570, max: 36 },
  { r: 730, max: 50 },
];

function placeInRings(nodes: Array<{ title: string; degree: number }>, cx: number, cy: number) {
  // Sort descending by degree → hubs in inner rings
  const sorted = [...nodes].sort((a, b) => b.degree - a.degree);
  const positions: Record<string, [number, number]> = {};

  let idx = 0;
  for (const ring of RINGS) {
    if (idx >= sorted.length) break;
    const count = Math.min(ring.max, sorted.length - idx);
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * 2 * Math.PI - Math.PI / 2 + (idx % 2 === 0 ? 0 : Math.PI / count);
      positions[sorted[idx].title] = [
        cx + Math.cos(angle) * ring.r,
        cy + Math.sin(angle) * ring.r,
      ];
      idx++;
    }
  }
  // Overflow: grid fallback
  if (idx < sorted.length) {
    const cols = 8;
    for (; idx < sorted.length; idx++) {
      const r = Math.floor((idx - sorted.length) / cols);
      const c = (idx - sorted.length) % cols;
      positions[sorted[idx].title] = [cx + c * 90, cy + 780 + r * 80];
    }
  }
  return positions;
}

function buildGraph(rawNodes: RawKnNode[], rawEdges: RawKnEdge[], filterCat: string | null) {
  // Deduplicate
  const seen = new Set<string>();
  const unique: RawKnNode[] = [];
  rawNodes.forEach(n => {
    if (!seen.has(n.document_title)) { seen.add(n.document_title); unique.push(n); }
  });

  // Degree map
  const degree = new Map<string, number>();
  unique.forEach(n => degree.set(n.document_title, 0));
  rawEdges.forEach(e => {
    degree.set(e.source_title, (degree.get(e.source_title) ?? 0) + 1);
    degree.set(e.target_title, (degree.get(e.target_title) ?? 0) + 1);
  });

  // Filter by category if requested
  const visibleNodes = filterCat ? unique.filter(n => n.category === filterCat) : unique;
  const visibleIds = new Set(visibleNodes.map(n => n.document_title));

  // Group by category and place
  const byCategory = new Map<string, RawKnNode[]>();
  visibleNodes.forEach(n => {
    const cat = n.category || 'metodologia';
    byCategory.set(cat, [...(byCategory.get(cat) ?? []), n]);
  });

  const positions: Record<string, [number, number]> = {};
  byCategory.forEach((group, cat) => {
    const [cx, cy] = filterCat ? [0, 0] : (CLUSTER_ORIGIN[cat] ?? [0, 0]);
    const placed = placeInRings(
      group.map(n => ({ title: n.document_title, degree: degree.get(n.document_title) ?? 0 })),
      cx, cy,
    );
    Object.assign(positions, placed);
  });

  const maxDegree = Math.max(1, ...Array.from(degree.values()));

  const nodes: Node[] = visibleNodes.map(n => {
    const deg = degree.get(n.document_title) ?? 0;
    const cat = n.category || 'metodologia';
    const color = CAT[cat]?.color ?? '#0EB5C6';
    const isHub = deg >= 4;
    const r = Math.max(9, Math.min(20, 9 + (deg / maxDegree) * 11));
    const [x, y] = positions[n.document_title] ?? [0, 0];
    return {
      id: n.document_title, type: 'doc',
      position: { x: x - 40, y: y - r },
      data: { label: n.document_title, category: cat, degree: deg, color, isHub } satisfies DocNodeData,
      style: { background: 'transparent', border: 'none', boxShadow: 'none', padding: 0, width: 80 },
    };
  });

  // Limit edges: only show cross-cluster OR both ends visible; max 300 for perf
  const validEdges = rawEdges.filter(e => visibleIds.has(e.source_title) && visibleIds.has(e.target_title));
  // Prioritize edges where both ends are hubs
  const sorted = [...validEdges].sort((a, b) => {
    const da = (degree.get(a.source_title) ?? 0) + (degree.get(a.target_title) ?? 0);
    const db = (degree.get(b.source_title) ?? 0) + (degree.get(b.target_title) ?? 0);
    return db - da;
  });

  const edges: Edge[] = sorted.slice(0, 320).map((e, i) => {
    const srcDeg = degree.get(e.source_title) ?? 0;
    const opacity = Math.max(0.06, Math.min(0.28, 0.06 + (srcDeg / maxDegree) * 0.22));
    return {
      id: `ke${i}`, source: e.source_title, target: e.target_title,
      style: { stroke: `rgba(255,255,255,${opacity})`, strokeWidth: 1 },
      animated: false,
    };
  });

  return { nodes, edges };
}

function DocNode({ data }: { data: DocNodeData }) {
  const r = Math.max(9, Math.min(20, 9 + (data.degree / 12) * 11));
  const glow = data.isHub ? `0 0 ${r + 6}px ${data.color}44` : 'none';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
      <Handle type="target" position={Position.Top}    style={{ opacity: 0, width: 1, height: 1 }} />
      <div style={{
        width: r * 2, height: r * 2, borderRadius: '50%',
        background: data.color + (data.isHub ? '33' : '18'),
        border: `${data.isHub ? 2 : 1.5}px solid ${data.color}`,
        boxShadow: glow, flexShrink: 0,
        transition: 'box-shadow 0.2s',
      }} />
      <span style={{
        fontSize: 8.5, color: data.isHub ? '#D1D5DB' : '#6B7280',
        fontWeight: data.isHub ? 600 : 400,
        textAlign: 'center', maxWidth: 76, lineHeight: 1.25,
        display: 'block', wordBreak: 'break-word',
      }}>
        {data.label.length > 26 ? data.label.slice(0, 24) + '…' : data.label}
      </span>
      <Handle type="source" position={Position.Bottom} style={{ opacity: 0, width: 1, height: 1 }} />
    </div>
  );
}

const NODE_TYPES: NodeTypes = { doc: DocNode };

function parseMdFile(filename: string, raw: string, category: string): { nodes: VaultNode[]; edges: VaultEdge[] } {
  const sourceFile = filename.replace(/\.md$/i, '');
  let titulo = sourceFile;
  let tags: string[] = [];
  let body = raw;

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
        seenEdges.add(key)
        edges.push({ source_title: titulo, target_title: target, relation_type: 'MENTIONS' });
      }
    }

    const content = sectionRaw
      .replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, '$2')
      .replace(/\[\[([^\]]+)\]\]/g, '$1')
      .replace(/[#*_`]/g, '')
      .replace(/\n+/g, ' ')
      .trim();

    if (content.length > 20) {
      nodes.push({ document_title: titulo, header_path: header, content, category, tags });
    }
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
        const text = await file.text();
        const { nodes, edges } = parseMdFile(file.name, text, uploadCat);
        allNodes.push(...nodes);
        allEdges.push(...edges);
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
      if (!res.ok) throw new Error((result.error as string) ?? 'Error desconocido');
      toast.success(`${result.nodes_upserted} nodos sincronizados desde ${files.length} archivo${files.length > 1 ? 's' : ''}`);
      await load();
    } catch (err: unknown) {
      toast.error(`Error al subir: ${err instanceof Error ? err.message : String(err)}`);
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
    const seenTitles = new Set<string>();
    const catCount: Record<string, number> = {};
    rawNodes.forEach(n => {
      if (!seenTitles.has(n.document_title)) {
        seenTitles.add(n.document_title);
        catCount[n.category || 'metodologia'] = (catCount[n.category || 'metodologia'] ?? 0) + 1;
      }
    });
    return { totalDocs: seenTitles.size, catCount };
  }, [rawNodes]);

  return (
    <div className="bg-white dark:bg-[#12121A] rounded-2xl border border-gray-100 dark:border-white/5 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-b border-gray-100 dark:border-white/5">
        <div className="flex items-center gap-2 flex-wrap">
          <Network className="w-4 h-4 text-teal-400 shrink-0" />
          <span className="text-sm font-bold text-gray-900 dark:text-white">Knowledge Graph</span>
          {!loading && (
            <span className="text-xs bg-teal-500/10 text-teal-400 px-2 py-0.5 rounded-full font-medium">
              {stats.totalDocs} docs · {rawEdges.length} links
            </span>
          )}

          {/* Category filter pills */}
          <div className="flex items-center gap-1 ml-2">
            <button
              onClick={() => setFilterCat(null)}
              className={`text-xs px-2.5 py-1 rounded-full transition-colors ${
                filterCat === null
                  ? 'bg-white/10 text-white font-medium'
                  : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              Todos
            </button>
            {Object.entries(CAT).map(([key, val]) => (
              <button
                key={key}
                onClick={() => setFilterCat(filterCat === key ? null : key)}
                className={`text-xs px-2.5 py-1 rounded-full transition-colors flex items-center gap-1.5 ${
                  filterCat === key
                    ? 'font-medium text-white'
                    : 'text-gray-500 hover:text-gray-300'
                }`}
                style={filterCat === key ? { background: val.color + '33', border: `1px solid ${val.color}55` } : {}}
              >
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: val.color, display: 'inline-block', flexShrink: 0 }} />
                {val.label}
                {!loading && <span className="opacity-60">({stats.catCount[key] ?? 0})</span>}
              </button>
            ))}
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
            className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-teal-500/10 text-teal-400 hover:bg-teal-500/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
            {uploading ? 'Subiendo…' : 'Subir .md'}
          </button>
        </div>
      </div>

      {/* Graph */}
      {loading ? (
        <div className="h-[620px] flex items-center justify-center gap-2 text-sm text-gray-400">
          <Loader2 className="w-4 h-4 animate-spin" />
          Cargando grafo…
        </div>
      ) : nodes.length === 0 ? (
        <div className="h-[620px] flex flex-col items-center justify-center gap-2 text-gray-400">
          <Network className="w-10 h-10 text-gray-300" />
          <p className="text-sm">Knowledge base vacío</p>
          <code className="text-xs bg-gray-100 dark:bg-white/5 px-3 py-1 rounded-lg font-mono mt-1">npm run sync</code>
        </div>
      ) : (
        <div style={{ height: 620 }}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={NODE_TYPES}
            fitView
            fitViewOptions={{ padding: 0.12 }}
            nodesDraggable={false}
            nodesConnectable={false}
            elementsSelectable={false}
            panOnScroll
            minZoom={0.15}
            maxZoom={4}
            style={{ background: '#07070D' }}
          >
            <Background variant={BackgroundVariant.Dots} gap={32} size={1} color="rgba(255,255,255,0.025)" />
            <Controls
              showInteractive={false}
              style={{ background: '#12121A', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8 }}
            />
            <MiniMap
              nodeColor={(n) => (n.data as DocNodeData).color ?? '#0EB5C6'}
              style={{ background: '#07070D', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8 }}
              maskColor="rgba(7,7,13,0.75)"
            />
          </ReactFlow>
        </div>
      )}
    </div>
  );
}
