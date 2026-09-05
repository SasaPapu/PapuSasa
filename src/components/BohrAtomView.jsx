import { getElectronShells } from '@/lib/elements';

// Modelo de Bohr: núcleo (protones + neutrones) con capas de electrones.
// Visualización SVG simple y clara, sin impresión 3D.
export default function BohrAtomView({ element, data }) {
  if (!data) return null;
  const { z, mass, name } = data;
  const shells = getElectronShells(z);
  const neutrons = mass - z;

  const size = 200;
  const cx = size / 2;
  const cy = size / 2;
  const nucleusR = 22;
  const shellGap = 20;

  return (
    <div className="flex flex-col items-center gap-1">
      <svg viewBox={`0 0 ${size} ${size}`} className="w-28 h-28">
        <defs>
          <radialGradient id={`nuc-${element}`}>
            <stop offset="0%" stopColor="#f87171" />
            <stop offset="100%" stopColor="#b91c1c" />
          </radialGradient>
        </defs>

        {/* Capas de electrones */}
        {shells.map((count, si) => {
          const r = nucleusR + (si + 1) * shellGap;
          return (
            <g key={si}>
              <circle
                cx={cx}
                cy={cy}
                r={r}
                fill="none"
                stroke="rgba(255,255,255,0.12)"
                strokeWidth="1"
                strokeDasharray="3 2"
              />
              {Array.from({ length: count }).map((_, ei) => {
                const angle = (ei / count) * Math.PI * 2 - Math.PI / 2;
                const ex = cx + Math.cos(angle) * r;
                const ey = cy + Math.sin(angle) * r;
                return (
                  <circle
                    key={ei}
                    cx={ex}
                    cy={ey}
                    r="3.5"
                    fill="#60a5fa"
                    stroke="rgba(96,165,250,0.3)"
                    strokeWidth="2"
                  />
                );
              })}
            </g>
          );
        })}

        {/* Núcleo */}
        <circle cx={cx} cy={cy} r={nucleusR} fill={`url(#nuc-${element})`} />
        <text x={cx} y={cy - 3} textAnchor="middle" fill="white" fontSize="9" fontWeight="bold">
          {z}p⁺
        </text>
        <text x={cx} y={cy + 9} textAnchor="middle" fill="white" fontSize="8" opacity="0.85">
          {neutrons}n
        </text>
      </svg>

      <div className="text-center">
        <span className="text-sm font-bold">{element}</span>
        <span className="text-[10px] text-white/40 ml-1">{name}</span>
      </div>
    </div>
  );
}