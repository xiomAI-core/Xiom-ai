import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
// ──────────────────────────────────────────────────────────────
// XIOM Desktop — World Model Viewer
// D3.js force-directed graph of the Neo4j world model.
// ──────────────────────────────────────────────────────────────
import { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { useAppStore } from '../store/app-store.js';
import { getWorldModelProjection } from '../hooks/useTauri.js';
// ─── Domain colour map ────────────────────────────────────────
const DOMAIN_COLOR = {
    FOUNDATION: '#4a90d9',
    VISION: '#9b6dd9',
    STRATEGY: '#e67e22',
    TACTICS: '#f1c40f',
    EXECUTION: '#2ecc71',
    TRACK: '#7f8c8d',
    SYMBIOSIS: '#ecf0f1',
};
function domainColor(domain) {
    return DOMAIN_COLOR[domain] ?? '#555';
}
// ─── Demo data for dev mode ───────────────────────────────────
const DEMO_NODES = [
    { id: '1', node_type: 'Human', domain: 'FOUNDATION', label: 'You' },
    { id: '2', node_type: 'Goal', domain: 'VISION', label: 'Launch XIOM' },
    { id: '3', node_type: 'Goal', domain: 'TACTICS', label: 'Build MVP' },
    { id: '4', node_type: 'Fact', domain: 'TRACK', label: 'Neo4j is running' },
    { id: '5', node_type: 'Policy', domain: 'FOUNDATION', label: 'No bulk emails' },
    { id: '6', node_type: 'Action', domain: 'EXECUTION', label: 'Write fact to DB' },
    { id: '7', node_type: 'Receipt', domain: 'TRACK', label: 'Receipt #001' },
    { id: '8', node_type: 'Pattern', domain: 'SYMBIOSIS', label: 'Works at night' },
];
const DEMO_EDGES = [
    { from_id: '1', to_id: '2', rel_type: 'HAS_GOAL' },
    { from_id: '1', to_id: '3', rel_type: 'HAS_GOAL' },
    { from_id: '2', to_id: '3', rel_type: 'DEPENDS_ON' },
    { from_id: '1', to_id: '5', rel_type: 'HAS_RULE' },
    { from_id: '6', to_id: '7', rel_type: 'GENERATED_RECEIPT' },
    { from_id: '6', to_id: '5', rel_type: 'GOVERNED_BY' },
    { from_id: '4', to_id: '6', rel_type: 'INFORMS_DECISION' },
    { from_id: '1', to_id: '8', rel_type: 'HAS_PATTERN' },
];
function ForceGraph({ nodes, edges, onNodeClick, domainFilter, searchQuery }) {
    const svgRef = useRef(null);
    const simRef = useRef(null);
    const filtered = nodes.filter((n) => {
        const matchesDomain = !domainFilter || n.domain === domainFilter;
        const matchesSearch = !searchQuery || n.label.toLowerCase().includes(searchQuery.toLowerCase());
        return matchesDomain && matchesSearch;
    });
    const filteredIds = new Set(filtered.map((n) => n.id));
    const filteredEdges = edges.filter((e) => filteredIds.has(e.from_id) && filteredIds.has(e.to_id));
    useEffect(() => {
        if (!svgRef.current)
            return;
        const el = svgRef.current;
        const rect = el.getBoundingClientRect();
        const W = rect.width || 800;
        const H = rect.height || 560;
        // Clear previous render
        d3.select(el).selectAll('*').remove();
        const svg = d3.select(el)
            .attr('width', W)
            .attr('height', H);
        const g = svg.append('g');
        // Zoom + pan
        svg.call(d3.zoom()
            .scaleExtent([0.2, 4])
            .on('zoom', (event) => {
            g.attr('transform', String(event.transform));
        }));
        // Build link data with object references (satisfies SimulationLinkDatum)
        const nodeById = new Map(filtered.map((n) => [n.id, n]));
        const linkData = filteredEdges
            .map((e) => {
            const src = nodeById.get(e.from_id);
            const tgt = nodeById.get(e.to_id);
            if (!src || !tgt)
                return null;
            return { from_id: e.from_id, to_id: e.to_id, rel_type: e.rel_type, source: src, target: tgt };
        })
            .filter((e) => e !== null);
        // Simulation
        if (simRef.current)
            simRef.current.stop();
        const sim = d3.forceSimulation(filtered)
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            .force('link', d3.forceLink(linkData).id((d) => d.id).distance(80).strength(0.4))
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
        const drag = d3.drag()
            .on('start', (event, d) => {
            if (!event.active)
                sim.alphaTarget(0.3).restart();
            d.fx = d.x ?? null;
            d.fy = d.y ?? null;
        })
            .on('drag', (event, d) => { d.fx = event.x; d.fy = event.y; })
            .on('end', (event, d) => {
            if (!event.active)
                sim.alphaTarget(0);
            d.fx = null;
            d.fy = null;
        });
        // Nodes
        const node = g.append('g').attr('class', 'nodes')
            .selectAll('g')
            .data(filtered)
            .join('g')
            .attr('cursor', 'pointer')
            .on('click', (_event, d) => onNodeClick(d))
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            .call(drag);
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
                .attr('x1', (d) => d.source.x ?? 0)
                .attr('y1', (d) => d.source.y ?? 0)
                .attr('x2', (d) => d.target.x ?? 0)
                .attr('y2', (d) => d.target.y ?? 0);
            node.attr('transform', (d) => `translate(${d.x ?? 0},${d.y ?? 0})`);
        });
        return () => { sim.stop(); };
    }, [filtered, filteredEdges, onNodeClick]);
    return _jsx("svg", { ref: svgRef, className: "graph-canvas" });
}
// ─── Page ─────────────────────────────────────────────────────
export default function WorldModelViewer() {
    const projection = useAppStore((s) => s.projection);
    const setProjection = useAppStore((s) => s.setProjection);
    const [nodes, setNodes] = useState(DEMO_NODES);
    const [edges, setEdges] = useState(DEMO_EDGES);
    const [selected, setSelected] = useState(null);
    const [domainFilter, setDomainFilter] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
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
    const domains = [
        'FOUNDATION', 'VISION', 'STRATEGY', 'TACTICS', 'EXECUTION', 'TRACK', 'SYMBIOSIS',
    ];
    return (_jsxs(_Fragment, { children: [_jsxs("div", { className: "topbar", children: [_jsx("span", { className: "topbar__title", children: "World Model" }), _jsxs("div", { className: "topbar__actions", style: { gap: 12 }, children: [_jsxs("span", { style: { fontSize: 11, color: 'rgba(255,255,255,0.4)' }, children: [nodeCount, " nodes \u00B7 ", edgeCount, " edges"] }), _jsx("input", { className: "input", style: { width: 160 }, placeholder: "Search nodes\u2026", value: searchQuery, onChange: (e) => setSearchQuery(e.target.value) }), _jsxs("select", { className: "select", style: { width: 140 }, value: domainFilter, onChange: (e) => setDomainFilter(e.target.value), children: [_jsx("option", { value: "", children: "All domains" }), domains.map((d) => (_jsx("option", { value: d, children: d }, d)))] })] })] }), _jsx("div", { style: {
                    display: 'flex', gap: 12, padding: '8px 20px',
                    borderBottom: '1px solid rgba(255,255,255,0.06)',
                    flexWrap: 'wrap',
                }, children: domains.map((d) => (_jsxs("span", { style: {
                        fontSize: 10, display: 'flex', alignItems: 'center', gap: 4,
                        color: domainFilter === d ? '#fff' : 'rgba(255,255,255,0.4)',
                        cursor: 'pointer',
                    }, onClick: () => setDomainFilter(domainFilter === d ? '' : d), children: [_jsx("span", { style: {
                                width: 8, height: 8, borderRadius: '50%',
                                background: domainColor(d), display: 'inline-block',
                            } }), d] }, d))) }), _jsxs("div", { style: { flex: 1, position: 'relative', overflow: 'hidden', display: 'flex' }, children: [_jsx("div", { style: { flex: 1, position: 'relative' }, children: _jsx(ForceGraph, { nodes: nodes, edges: edges, onNodeClick: setSelected, domainFilter: domainFilter, searchQuery: searchQuery }) }), selected && (_jsxs("div", { className: "node-detail-panel", children: [_jsxs("div", { style: {
                                    display: 'flex', justifyContent: 'space-between',
                                    alignItems: 'center', marginBottom: 14,
                                }, children: [_jsx("span", { style: { fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.4)' }, children: "Node Detail" }), _jsx("button", { className: "btn btn--sm", onClick: () => setSelected(null), style: { padding: '2px 8px' }, children: "\u2715" })] }), _jsxs("div", { style: { marginBottom: 10 }, children: [_jsx("div", { style: {
                                            display: 'inline-block',
                                            padding: '2px 8px',
                                            background: domainColor(selected.domain),
                                            color: '#000',
                                            fontSize: 10,
                                            fontWeight: 600,
                                            letterSpacing: '0.08em',
                                            marginBottom: 8,
                                        }, children: selected.node_type }), _jsx("p", { style: { fontSize: 14, fontWeight: 600, marginBottom: 4 }, children: selected.label }), _jsx("p", { style: { fontSize: 10, color: 'rgba(255,255,255,0.35)' }, children: selected.id })] }), _jsx("hr", { className: "section-divider" }), [
                                ['Domain', selected.domain],
                                ['Type', selected.node_type],
                            ].map(([k, v]) => (_jsxs("div", { style: { display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: 12 }, children: [_jsx("span", { style: { color: 'rgba(255,255,255,0.4)' }, children: k }), _jsx("span", { children: v })] }, k)))] }))] })] }));
}
//# sourceMappingURL=WorldModelViewer.js.map