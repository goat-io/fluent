/**
 * layoutEngine — the standard layout library for diagrams in this app.
 *
 * Wraps `elkjs` (Eclipse Layout Kernel) so views don't roll their own
 * column / barycenter / handle-slot heuristics. Every view that wants a
 * left-to-right layered diagram should call `layoutLayered(nodes, edges)`
 * and trust the result.
 *
 * What ELK does for us:
 *   - Topological layer assignment (each node → a layer)
 *   - Crossing minimisation between layers (Sugiyama)
 *   - Vertical ordering within each layer (barycenter / median sweep)
 *   - Node-spacing per layer
 *
 * What we still do in the view:
 *   - Render React components (custom nodes, custom edges, labels)
 *   - Decide which handle (l-top/l-mid/l-bot, r-top/...) each edge uses
 *
 * Why ELK (not dagre / cytoscape / hand-rolled):
 *   - It produces deterministic, well-structured output for any topology
 *   - It's the engine behind Eclipse Sirius and every serious tool that
 *     draws layered architecture diagrams
 *   - Single dependency, browser-compatible (no native code)
 */
import ELK from 'elkjs/lib/elk.bundled.js'

const elk = new ELK()

/**
 * Lay out a directed graph in left-to-right layered fashion.
 *
 * @param {Array<{id, width?, height?, layer?, group?}>} nodes
 *        - `layer` (optional): force the node into a specific layer index.
 *          Useful for keeping known boxes (e.g. devices) on the far left
 *          regardless of who points at whom.
 *        - `group` (optional): a string identifier; nodes sharing a group
 *          get a band background. Used by the view, not by ELK.
 * @param {Array<{id, source, target}>} edges
 * @param {Object} opts
 *        - `nodeWidth`/`nodeHeight`: defaults if a node doesn't supply them
 *        - `layerSpacing` (default 220): horizontal gap between layers
 *        - `nodeSpacing` (default 60): vertical gap between nodes within a layer
 *        - `padding` (default 40): canvas padding
 *
 * @returns {Promise<{
 *    nodes: Array<{id, x, y, width, height, layer}>,
 *    edges: Array<{id, source, target}>,
 *    width: number, height: number,
 * }>}
 */
export async function layoutLayered(nodes, edges, opts = {}) {
  const {
    nodeWidth = 220, nodeHeight = 220,
    // Generous defaults: tightly-packed layouts read worse than slightly-
    // spread ones. ELK never adds gratuitous whitespace, so we err on the
    // side of more.
    layerSpacing = 320,         // horizontal gap between layers
    nodeSpacing = 110,          // vertical gap between nodes in a layer
    edgeNodeSpacing = 60,       // gap between an edge and a node it passes
    edgeEdgeSpacing = 40,       // gap between two edges in the same corridor
    padding = 60,
  } = opts

  // Build ELK input. We only ask ELK to position nodes — edge routing is
  // left to ReactFlow so we keep our existing labelled edge type.
  //
  // `partitioning` is the ELK feature that lets us pin a node to a
  // specific layer. When activated, every node's `partitioning.partition`
  // value becomes its layer index — guarantees Hub gets its own column
  // even when Hub and Mobile both have the same out-degree pattern.
  const anyPartitioned = nodes.some(n => n.layer != null)

  const elkGraph = {
    id: 'root',
    layoutOptions: {
      'elk.algorithm': 'layered',
      'elk.direction': 'RIGHT',
      'elk.layered.spacing.nodeNodeBetweenLayers':       String(layerSpacing),
      'elk.spacing.nodeNode':                            String(nodeSpacing),
      'elk.layered.spacing.edgeNodeBetweenLayers':       String(edgeNodeSpacing),
      'elk.layered.spacing.edgeEdgeBetweenLayers':       String(edgeEdgeSpacing),
      'elk.spacing.edgeNode':                            String(edgeNodeSpacing),
      'elk.spacing.edgeEdge':                            String(edgeEdgeSpacing),
      // BRANDES_KOEPF gives a more centred, balanced placement than
      // NETWORK_SIMPLEX on small graphs — less of the "tall stack on the
      // edge" effect.
      'elk.layered.nodePlacement.strategy':              'BRANDES_KOEPF',
      'elk.layered.nodePlacement.bk.fixedAlignment':     'BALANCED',
      'elk.layered.crossingMinimization.strategy':       'LAYER_SWEEP',
      'elk.layered.crossingMinimization.semiInteractive':'true',
      // Higher thoroughness = more iterations on crossing reduction. Fine
      // for our graph size (≪ 100 nodes).
      'elk.layered.thoroughness':                        '10',
      'elk.padding': `[top=${padding},left=${padding},bottom=${padding},right=${padding}]`,
      ...(anyPartitioned ? { 'elk.partitioning.activate': 'true' } : {}),
    },
    children: nodes.map(n => ({
      id: n.id,
      width: n.width || nodeWidth,
      height: n.height || nodeHeight,
      ...(n.layer != null
        ? { layoutOptions: { 'elk.partitioning.partition': String(n.layer) } }
        : {}),
    })),
    edges: edges.map(e => ({
      id: e.id,
      sources: [e.source],
      targets: [e.target],
    })),
  }

  const result = await elk.layout(elkGraph)
  // Find ELK's chosen layer index per node by reading position bands —
  // ELK groups nodes into layers but doesn't expose the layer id back.
  // We approximate from x position.
  const positioned = result.children.map(c => ({
    id: c.id,
    x: c.x,
    y: c.y,
    width: c.width,
    height: c.height,
  }))
  // Cluster x-positions into discrete layer indices.
  const xs = [...new Set(positioned.map(p => Math.round(p.x)))].sort((a, b) => a - b)
  const xToLayer = new Map(xs.map((x, i) => [x, i]))
  positioned.forEach(p => { p.layer = xToLayer.get(Math.round(p.x)) ?? 0 })
  return {
    nodes: positioned,
    edges: edges.map(e => ({ id: e.id, source: e.source, target: e.target })),
    width: result.width,
    height: result.height,
  }
}

