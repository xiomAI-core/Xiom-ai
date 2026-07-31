// ──────────────────────────────────────────────────────────────
// XIOM Desktop — World Model Viewer
// D3.js force-directed graph of the Neo4j world model.
// ──────────────────────────────────────────────────────────────
import { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { useAppStore } from '../store/app-store.js';
import { getWorldModelProjection } from '../hooks/useTauri.js';
import type { GraphEdge, GraphNode, WorldModelDomain } from '../types/index.js';

// D3 link — structurally satisfies SimulationLinkDatum<GraphNode>
interface D3Link {
  source: GraphNode;
  target: GraphNode;
  index?: number;
  from_id: string;
  to_id: string;
  rel_type: string;
}

// ─── Domain colour map ────────────────────────────────────────

const DOMAIN_COLOR: Record<WorldModelDomain, string> = {
  FOUNDATION: '#4a90d9',
  VISION:     '#9b6dd9',
  STRATEGY:   '#e67e22',
  TACTICS:    '#f1c40f',
  EXECUTION:  '#2ecc71',
  TRACK:      '#7f8c8d',
  SYMBIOSIS:  '#ecf0f1',
};

function domainColor(domain: string): string {
  return DOMAIN_COLOR[domain as WorldModelDomain] ?? '#555';
}

// ─── Demo data for dev mode ───────────────────────────────────

const DEMO_NODES: GraphNode[] = [
  { id: '1', node_type: 'Human',   domain: 'FOUNDATION', label: 'You' },
  { id: '2', node_type: 'Goal',    domain: 'VISION',     label: 'Launch XIOM' },
  { id: '3', node_type: 'Goal',    domain: 'TACTICS',    label: 'Build MVP' },
  { id: '4', node_type: 'Fact',    domain: 'TRACK',      label: 'Neo4j is running' },
  { id: '5', node_type: 'Policy',  domain: 'FOUNDATION', label: 'No bulk emails' },
  { id: '6', node_type: 'Action',  domain: 'EXECUTION',  label: 'Write fact to DB' },
  { id: '7', node_type: 'Receipt', domain: 'TRACK',      label: 'Receipt #001' },
  { id: '8', node_type: 'Pattern', domain: 'SYMBIOSIS',  label: 'Works at night' },
];

const DEMO_EDGES: GraphEdge[] = [
  { from_id: '1', to_id: '2', rel_type: 'HAS_GOAL' },
  { from_id: '1', to_id: '3', rel_type: 'HAS_GOAL' },
  { from_id: '2', to_id: '3', rel_type: 'DEPENDS_ON' },
  { from_id: '1', to_id: '5', rel_type: 'HAS_RULE' },
  { from_id: '6', to_id: '7', rel_type: 'GENERATED_RECEIPT' },
  { from_id: '6', to_id: '5', rel_type: 'GOVERNED_BY' },
  { from_id: '4', to_id: '6', rel_type: 'INFORMS_DECISION' },
  { from_id: '1', to_id: '8', rel_type: 'HAS_PATTERN' },
];

// ─── Graph component ──────────────────────────────────────────

interface GraphProps {
  nodes: GraphNode[];
  edges: GraphEdge[];
  onNodeClick: (node: GraphNode) => void;
  domainFilter: string;
  searchQuery: string;
}

function ForceGraph({ nodes, edges, onNodeClick, domainFilter, searchQuery }: GraphProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const simRef = useRef<d3.Simulation<GraphNode, D3Link> | null>(null);

  const filtered = nodes.filter((n) => {
    const matchesDomain = !domainFilter || n.domain === domainFilter;
    const matchesSearch =
      !searchQuery || n.label.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesDomain && matchesSearch;
  });

  const filteredIds = new Set(filtered.map((n) => n.id));
  const filteredEdges = edges.filter(
    (e) => filteredIds.has(e.from_id) && filteredIds.has(e.to_id)
  );

  useEffect(() => {
    if (!svgRef.current) return;

    const el   = svgRef.current;
    const rect = el.getBoundingClientRect();
    const W    = rect.width  || 800;
    const H    = rect.height || 560;

    // Clear previous render
    d3.select(el).selectAll('*').remove();

    const svg = d3.select(el)
      .attr('width', W)
      .attr('height', H);

    const g = svg.append('g');

    // Zoom + pan
    svg.call(
      d3.zoom<SVGSVGElement, unknown>()
        .scaleExtent([0.2, 4])
        .on('zoom', (event: d3.D3ZoomEvent<SVGSVGElement, unknown>) => {
          g.attr('transform', String(event.transform));
        })
    );

    // Build link data with object references (satisfies SimulationLinkDatum)
    const nodeById = new Map(filtered.map((n) => [n.id, n]));
    const linkData: D3Link[] = filteredEdges
      .map((e): D3Link | null => {
        const src = nodeById.get(e.from_id);
        const tgt = nodeById.get(e.to_id);
        if (!src || !tgt) return null;
        return { from_id: e.from_id, to_id: e.to_id, rel_type: e.rel_type, source: src, target: tgt };
      })
      .filter((e): e is D3Link => e !== null);

    // Simulation
    if (simRef.current) simRef.current.stop();
    const sim = d3.forceSimulation<GraphNode>(filtered)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .force('link', (d3.forceLink<GraphNode, any>(linkData) as d3.ForceLink<GraphNode, D3Link>).id((d) => d.id).distance(80).strength(0.4))
      .force('charge', d3.forceManyBody().strength(-200))
      .force('center', d3.forceCenter(W / 2, H / 2))
      .force('collision', d3.forceCollide(20));
    simRef.current = sim;

    // Edges
    const link = g.append('g').attr('class', 'links')
      .selectAll('line')
      .data(linkData)
      .join('line')
      .attr('stroke', 'rgba(255,255,255,0.12)')
      .attr('stroke-width', 1);

    // Drag behaviour
    const drag = d3.drag<SVGGElement, GraphNode>()
      .on('start', (event, d) => {
        if (!event.active) sim.alphaTarget(0.3).restart();
        d.fx = d.x ?? null; d.fy = d.y ?? null;
      })
      .on('drag', (event, d) => { d.fx = event.x; d.fy = event.y; })
      .on('end', (event, d) => {
        if (!event.active) sim.alphaTarget(0);
        d.fx = null; d.fy = null;
      });

    // Nodes
    const node = g.append('g').attr('class', 'nodes')
      .selectAll('g')
      .data(filtered)
      .join('g')
      .attr('cursor', 'pointer')
      .on('click', (_event, d) => onNodeClick(d))
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .call(drag as any);

    node.append('circle')
      .attr('r', 8)
      .attr('fill', (d) => domainColor(d.domain))
      .attr('fill-opacity', 0.85)
      .attr('stroke', (d) => domainColor(d.domain))
      .attr('stroke-width', 1.5)
      .attr('stroke-opacity', 0.5);

    node.append('text')
      .attr('x', 12)
      .attr('y', 4)
      .attr('font-size', 10)
      .attr('font-family', 'Inter, sans-serif')
      .attr('fill', 'rgba(255,255,255,0.7)')
      .text((d) => d.label.slice(0, 22));

    // Tick
    sim.on('tick', () => {
      link
        .attr('x1', (d) => (d.source as GraphNode).x ?? 0)
        .attr('y1', (d) => (d.source as GraphNode).y ?? 0)
        .attr('x2', (d) => (d.target as GraphNode).x ?? 0)
        .attr('y2', (d) => (d.target as GraphNode).y ?? 0);

      node.attr('transform', (d) => `translate(${d.x ?? 0},${d.y ?? 0})`);
    });

    return () => { sim.stop(); };
  }, [filtered, filteredEdges, onNodeClick]);

  return <svg ref={svgRef} className="graph-canvas" />;
}

// ─── Page ─────────────────────────────────────────────────────

export default function WorldModelViewer() {
  const projection    = useAppStore((s) => s.projection);
  const setProjection = useAppStore((s) => s.setProjection);

  const [nodes, setNodes]           = useState<GraphNode[]>(DEMO_NODES);
  const [edges, setEdges]           = useState<GraphEdge[]>(DEMO_EDGES);
  const [selected, setSelected]     = useState<GraphNode | null>(null);
  const [domainFilter, setDomainFilter] = useState('');
  const [searchQuery, setSearchQuery]   = useState('');

  useEffect(() => {
    getWorldModelProjection()
      .then((proj) => {
        setProjection(proj);
      })
      .catch(() => {
        // dev mode — use demo data
        setNodes(DEMO_NODES);
        setEdges(DEMO_EDGES);
      });
  }, [setProjection]);

  const nodeCount = projection?.node_count ?? nodes.length;
  const edgeCount = projection?.edge_count ?? edges.length;

  const domains: WorldModelDomain[] = [
    'FOUNDATION', 'VISION', 'STRATEGY', 'TACTICS', 'EXECUTION', 'TRACK', 'SYMBIOSIS',
  ];

  return (
    <>
      <div className="topbar">
        <span className="topbar__title">World Model</span>
        <div className="topbar__actions" style={{ gap: 12 }}>
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>
            {nodeCount} nodes · {edgeCount} edges
          </span>
          <input
            className="input"
            style={{ width: 160 }}
            placeholder="Search nodes…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <select
            className="select"
            style={{ width: 140 }}
            value={domainFilter}
            onChange={(e) => setDomainFilter(e.target.value)}
          >
            <option value="">All domains</option>
            {domains.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Domain legend */}
      <div style={{
        display: 'flex', gap: 12, padding: '8px 20px',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        flexWrap: 'wrap',
      }}>
        {domains.map((d) => (
          <span
            key={d}
            style={{
              fontSize: 10, display: 'flex', alignItems: 'center', gap: 4,
              color: domainFilter === d ? '#fff' : 'rgba(255,255,255,0.4)',
              cursor: 'pointer',
            }}
            onClick={() => setDomainFilter(domainFilter === d ? '' : d)}
          >
            <span style={{
              width: 8, height: 8, borderRadius: '50%',
              background: domainColor(d), display: 'inline-block',
            }} />
            {d}
          </span>
        ))}
      </div>

      <div style={{ flex: 1, position: 'relative', overflow: 'hidden', display: 'flex' }}>
        {/* Graph */}
        <div style={{ flex: 1, position: 'relative' }}>
          <ForceGraph
            nodes={nodes}
            edges={edges}
            onNodeClick={setSelected}
            domainFilter={domainFilter}
            searchQuery={searchQuery}
          />
        </div>

        {/* Node detail panel */}
        {selected && (
          <div className="node-detail-panel">
            <div style={{
              display: 'flex', justifyContent: 'space-between',
              alignItems: 'center', marginBottom: 14,
            }}>
              <span style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.4)' }}>
                Node Detail
              </span>
              <button
                className="btn btn--sm"
                onClick={() => setSelected(null)}
                style={{ padding: '2px 8px' }}
              >
                ✕
              </button>
            </div>

            <div style={{ marginBottom: 10 }}>
              <div style={{
                display: 'inline-block',
                padding: '2px 8px',
                background: domainColor(selected.domain),
                color: '#000',
                fontSize: 10,
                fontWeight: 600,
                letterSpacing: '0.08em',
                marginBottom: 8,
              }}>
                {selected.node_type}
              </div>
              <p style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>{selected.label}</p>
              <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)' }}>{selected.id}</p>
            </div>

            <hr className="section-divider" />

            {[
              ['Domain', selected.domain],
              ['Type',   selected.node_type],
            ].map(([k, v]) => (
              <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: 12 }}>
                <span style={{ color: 'rgba(255,255,255,0.4)' }}>{k}</span>
                <span>{v}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
