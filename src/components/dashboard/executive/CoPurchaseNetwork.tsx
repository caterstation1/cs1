'use client'

import { useMemo, useState } from 'react'
import {
  forceCenter,
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  type SimulationLinkDatum,
  type SimulationNodeDatum,
} from 'd3-force'
import { ChartCard } from './primitives/ChartCard'
import { useChartColors } from './primitives/chart-colors'
import { formatValue } from '@/lib/format'

interface PairRow {
  left: string
  right: string
  count: number
}

interface NetworkNode extends SimulationNodeDatum {
  id: string
  revenue: number
  radius: number
}

interface NetworkLink extends SimulationLinkDatum<NetworkNode> {
  count: number
}

const WIDTH = 720
const HEIGHT = 420
const TOP_EDGES = 20

/**
 * D4: products commonly bought together as a force-directed network.
 * Nodes sized by product revenue, edges weighted by co-buy count.
 */
export function CoPurchaseNetwork({
  pairs,
  productRevenue,
}: {
  pairs?: PairRow[]
  productRevenue: Map<string, number>
}) {
  const palette = useChartColors()
  const [hovered, setHovered] = useState<string | null>(null)

  const { nodes, links } = useMemo(() => {
    const topPairs = (pairs || []).slice(0, TOP_EDGES)
    if (!topPairs.length) return { nodes: [] as NetworkNode[], links: [] as NetworkLink[] }

    const names = Array.from(new Set(topPairs.flatMap((pair) => [pair.left, pair.right])))
    const revenues = names.map((name) => productRevenue.get(name) || 0)
    const maxRevenue = Math.max(1, ...revenues)
    const nodes: NetworkNode[] = names.map((name) => {
      const revenue = productRevenue.get(name) || 0
      return {
        id: name,
        revenue,
        radius: 8 + Math.sqrt(revenue / maxRevenue) * 20,
      }
    })
    const nodeById = new Map(nodes.map((node) => [node.id, node]))
    const links: NetworkLink[] = topPairs.map((pair) => ({
      source: nodeById.get(pair.left)!,
      target: nodeById.get(pair.right)!,
      count: pair.count,
    }))

    const simulation = forceSimulation(nodes)
      .force('charge', forceManyBody().strength(-320))
      .force(
        'link',
        forceLink<NetworkNode, NetworkLink>(links)
          .id((d) => d.id)
          .distance(110)
          .strength(0.4)
      )
      .force('center', forceCenter(WIDTH / 2, HEIGHT / 2))
      .force('collide', forceCollide<NetworkNode>().radius((d) => d.radius + 14))
      .stop()
    for (let i = 0; i < 300; i++) simulation.tick()

    // Clamp nodes inside the frame after the layout settles.
    for (const node of nodes) {
      node.x = Math.max(node.radius + 4, Math.min(WIDTH - node.radius - 4, node.x || WIDTH / 2))
      node.y = Math.max(node.radius + 12, Math.min(HEIGHT - node.radius - 12, node.y || HEIGHT / 2))
    }
    return { nodes, links }
  }, [pairs, productRevenue])

  if (!nodes.length) return null

  const maxCount = Math.max(1, ...links.map((link) => link.count))
  const neighbours = new Set<string>()
  if (hovered) {
    neighbours.add(hovered)
    for (const link of links) {
      const source = (link.source as NetworkNode).id
      const target = (link.target as NetworkNode).id
      if (source === hovered) neighbours.add(target)
      if (target === hovered) neighbours.add(source)
    }
  }

  return (
    <ChartCard
      title="Products commonly bought together"
      subtitle={`Top ${TOP_EDGES} co-purchase pairs — node size = product revenue, line thickness = co-buy count. Hover a product to highlight its neighbourhood.`}
      data={(pairs || []).slice(0, 30).map((pair) => ({ ...pair }))}
      columns={[
        { key: 'left', label: 'Product A' },
        { key: 'right', label: 'Product B' },
        { key: 'count', label: 'Co-buy count', format: 'count' },
      ]}
      height={HEIGHT}
    >
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="h-full w-full" role="img" aria-label="Product co-purchase network">
        {links.map((link, index) => {
          const source = link.source as NetworkNode
          const target = link.target as NetworkNode
          const active = !hovered || source.id === hovered || target.id === hovered
          return (
            <line
              key={index}
              x1={source.x}
              y1={source.y}
              x2={target.x}
              y2={target.y}
              stroke={palette.ink.axis}
              strokeOpacity={active ? 0.45 : 0.08}
              strokeWidth={1 + (link.count / maxCount) * 5}
            >
              <title>{`${source.id} + ${target.id}: ${link.count} orders`}</title>
            </line>
          )
        })}
        {nodes.map((node) => {
          const active = !hovered || neighbours.has(node.id)
          return (
            <g
              key={node.id}
              transform={`translate(${node.x},${node.y})`}
              opacity={active ? 1 : 0.2}
              onMouseEnter={() => setHovered(node.id)}
              onMouseLeave={() => setHovered(null)}
              style={{ cursor: 'default' }}
            >
              {/* Hit target larger than the visible mark */}
              <circle r={node.radius + 8} fill="transparent" />
              <circle
                r={node.radius}
                fill={palette.semantic.revenue}
                fillOpacity={0.85}
                stroke="var(--card)"
                strokeWidth={1.5}
              />
              <title>{`${node.id} — revenue ${formatValue(node.revenue, 'currencyCompact')}`}</title>
              <text
                y={node.radius + 12}
                textAnchor="middle"
                fontSize={10}
                fill={palette.ink.axis}
                style={{ pointerEvents: 'none' }}
              >
                {node.id.length > 24 ? `${node.id.slice(0, 22)}…` : node.id}
              </text>
            </g>
          )
        })}
      </svg>
    </ChartCard>
  )
}
