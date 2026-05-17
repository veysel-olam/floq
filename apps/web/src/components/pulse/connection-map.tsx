'use client'

import { useEffect, useRef, useMemo } from 'react'
import {
  forceSimulation,
  forceLink,
  forceManyBody,
  forceCenter,
  forceCollide,
  type SimulationNodeDatum,
  type SimulationLinkDatum,
} from 'd3-force'
import type { PulseConnection } from '@/lib/api'

interface MapNode extends SimulationNodeDatum {
  id: string
  label: string
  radius: number
  isSelf: boolean
}

interface MapLink extends SimulationLinkDatum<MapNode> {
  value: number
}

interface Props {
  connections: PulseConnection[]
  selfDomain: string
  width?: number
  height?: number
}

export function ConnectionMap({ connections, selfDomain, width = 600, height = 420 }: Props) {
  const svgRef = useRef<SVGSVGElement>(null)

  const { nodes, links } = useMemo(() => {
    const self: MapNode = { id: selfDomain, label: selfDomain, radius: 20, isSelf: true }
    const remotes: MapNode[] = connections.slice(0, 30).map((c) => ({
      id: c.domain,
      label: c.domain,
      radius: Math.max(6, Math.min(16, 4 + Math.sqrt(c.total) * 2)),
      isSelf: false,
    }))
    const nodes: MapNode[] = [self, ...remotes]
    const links: MapLink[] = remotes.map((n) => ({
      source: selfDomain,
      target: n.id,
      value: connections.find((c) => c.domain === n.id)?.total ?? 1,
    }))
    return { nodes, links }
  }, [connections, selfDomain])

  useEffect(() => {
    const svg = svgRef.current
    if (!svg || nodes.length < 2) return

    const nodesCopy: MapNode[] = nodes.map((n) => ({ ...n }))
    const linksCopy: MapLink[] = links.map((l) => ({ ...l }))

    const sim = forceSimulation<MapNode>(nodesCopy)
      .force('link', forceLink<MapNode, MapLink>(linksCopy).id((d) => d.id).distance((l) => {
        const val = (l as MapLink).value
        return Math.max(80, 160 - val * 8)
      }).strength(0.6))
      .force('charge', forceManyBody<MapNode>().strength(-120))
      .force('center', forceCenter(width / 2, height / 2))
      .force('collide', forceCollide<MapNode>().radius((d) => d.radius + 6))

    // Render loop
    const render = () => {
      // Clear
      while (svg.firstChild) svg.removeChild(svg.firstChild)

      const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs')
      const grad = document.createElementNS('http://www.w3.org/2000/svg', 'linearGradient')
      grad.setAttribute('id', 'link-grad')
      grad.setAttribute('gradientUnits', 'userSpaceOnUse')
      ;['#E8593C', '#F2845C'].forEach((c, i) => {
        const stop = document.createElementNS('http://www.w3.org/2000/svg', 'stop')
        stop.setAttribute('offset', i === 0 ? '0%' : '100%')
        stop.setAttribute('stop-color', c)
        grad.appendChild(stop)
      })
      defs.appendChild(grad)
      svg.appendChild(defs)

      // Links
      for (const l of linksCopy) {
        const src = l.source as MapNode
        const tgt = l.target as MapNode
        if (!src.x || !tgt.x) continue
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line')
        line.setAttribute('x1', String(src.x))
        line.setAttribute('y1', String(src.y))
        line.setAttribute('x2', String(tgt.x))
        line.setAttribute('y2', String(tgt.y))
        line.setAttribute('stroke', 'url(#link-grad)')
        line.setAttribute('stroke-width', String(Math.max(1, Math.min(3, l.value * 0.5))))
        line.setAttribute('stroke-opacity', '0.4')
        svg.appendChild(line)
      }

      // Nodes
      for (const n of nodesCopy) {
        if (!n.x) continue
        const g = document.createElementNS('http://www.w3.org/2000/svg', 'g')
        g.setAttribute('transform', `translate(${n.x},${n.y})`)

        const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle')
        circle.setAttribute('r', String(n.radius))
        circle.setAttribute('fill', n.isSelf ? '#E8593C' : '#F2845C')
        circle.setAttribute('fill-opacity', n.isSelf ? '1' : '0.75')
        circle.setAttribute('stroke', n.isSelf ? '#D44A2E' : '#E8593C')
        circle.setAttribute('stroke-width', n.isSelf ? '2.5' : '1.5')
        g.appendChild(circle)

        const label = document.createElementNS('http://www.w3.org/2000/svg', 'text')
        label.setAttribute('y', String(n.radius + 11))
        label.setAttribute('text-anchor', 'middle')
        label.setAttribute('font-size', n.isSelf ? '11' : '9')
        label.setAttribute('font-family', 'var(--font-dm-sans, sans-serif)')
        label.setAttribute('fill', 'currentColor')
        label.setAttribute('opacity', '0.7')
        // Truncate long domains
        const short = n.label.length > 18 ? n.label.slice(0, 16) + '…' : n.label
        label.textContent = short
        g.appendChild(label)

        svg.appendChild(g)
      }
    }

    sim.on('tick', render)
    sim.on('end', render)

    return () => { sim.stop() }
  }, [nodes, links, width, height])

  return (
    <svg
      ref={svgRef}
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="w-full h-auto text-(--color-text-tertiary)"
    />
  )
}
