/** A small person icon (head and body) centred on x/y, drawn at a fixed screen size. */
export default function PersonIcon({ x, y, color = '#8e4ec6', highlight = false }: { x: number; y: number; color?: string; highlight?: boolean }) {
  return (
    <g transform={`translate(${x}, ${y})`}>
      {highlight && <circle r={13} fill="#dc2626" fillOpacity={0.18} stroke="#dc2626" strokeWidth={1.5} />}
      <circle cx={0} cy={-6} r={3.6} fill={color} stroke="white" strokeWidth={1.2} />
      <path d="M -6 7 C -6 0 -3.5 -1.6 0 -1.6 C 3.5 -1.6 6 0 6 7 Z" fill={color} stroke="white" strokeWidth={1.2} strokeLinejoin="round" />
    </g>
  );
}
