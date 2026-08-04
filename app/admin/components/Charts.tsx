/** Dependency-free SVG charts for the admin dashboard: Area, Bars, Donut, Sparkline. */

import { useId, useState } from "react";

const PRIMARY = "rgb(var(--oui-color-primary))";
const PRIMARY_LIGHT = "rgb(var(--oui-color-primary-light))";
const SUCCESS = "rgb(var(--oui-color-success))";
const DANGER = "rgb(var(--oui-color-danger))";

export function Sparkline({
  data,
  width = 120,
  height = 32,
  color = PRIMARY,
}: {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
}) {
  if (data.length < 2) return null;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const pts = data.map(
    (v, i) =>
      `${(i / (data.length - 1)) * width},${height - 2 - ((v - min) / range) * (height - 4)}`
  );
  return (
    <svg width={width} height={height} className="overflow-visible">
      <polyline
        points={pts.join(" ")}
        fill="none"
        stroke={color}
        strokeWidth={1.8}
        strokeLinecap="round"
      />
    </svg>
  );
}

export function AreaChart({
  labels,
  data,
  height = 220,
  color = PRIMARY,
  formatValue = (v: number) => v.toLocaleString(),
  title,
}: {
  labels: string[];
  data: number[];
  height?: number;
  color?: string;
  formatValue?: (v: number) => string;
  title?: string;
}) {
  const gid = useId();
  const [hover, setHover] = useState<number | null>(null);
  const W = 800;
  const H = height;
  const PAD_Y = 14;
  if (data.length === 0) return <div style={{ height }} />;

  const max = Math.max(...data) * 1.08;
  const min = Math.min(...data) * 0.92;
  const range = max - min || 1;
  const x = (i: number) => (i / Math.max(1, data.length - 1)) * W;
  const y = (v: number) => H - PAD_Y - ((v - min) / range) * (H - PAD_Y * 2);

  const line = data.map((v, i) => `${x(i)},${y(v)}`).join(" ");
  const area = `0,${H - PAD_Y} ${line} ${W},${H - PAD_Y}`;
  const labelEvery = Math.ceil(labels.length / 7);

  return (
    <div className="relative w-full">
      {title && <div className="mb-1 text-xs text-white/40">{title}</div>}
      <svg
        viewBox={`0 0 ${W} ${H + 20}`}
        className="w-full"
        onMouseLeave={() => setHover(null)}
        onMouseMove={(e) => {
          const rect = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
          const fx = (e.clientX - rect.left) / rect.width;
          setHover(Math.max(0, Math.min(data.length - 1, Math.round(fx * (data.length - 1)))));
        }}
      >
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.35} />
            <stop offset="100%" stopColor={color} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75].map((f) => (
          <line
            key={f}
            x1={0}
            x2={W}
            y1={H * f}
            y2={H * f}
            stroke="rgba(255,255,255,0.05)"
            strokeDasharray="3 5"
          />
        ))}
        <polygon points={area} fill={`url(#${gid})`} />
        <polyline
          points={line}
          fill="none"
          stroke={color}
          strokeWidth={2.2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {hover !== null && (
          <>
            <line
              x1={x(hover)}
              x2={x(hover)}
              y1={PAD_Y}
              y2={H - PAD_Y}
              stroke="rgba(255,255,255,0.25)"
              strokeDasharray="2 3"
            />
            <circle cx={x(hover)} cy={y(data[hover])} r={4.5} fill={color} stroke="#fff" strokeWidth={1.5} />
          </>
        )}
        {labels.map((l, i) =>
          i % labelEvery === 0 ? (
            <text
              key={i}
              x={x(i)}
              y={H + 14}
              fontSize={10}
              fill="rgba(255,255,255,0.35)"
              textAnchor={i === 0 ? "start" : i > labels.length - labelEvery ? "end" : "middle"}
            >
              {l}
            </text>
          ) : null
        )}
      </svg>
      {hover !== null && (
        <div className="pointer-events-none absolute left-1/2 top-0 -translate-x-1/2 whitespace-nowrap rounded-lg border border-white/10 bg-[rgb(var(--oui-color-base-5))] px-3 py-1.5 text-xs shadow-xl">
          <span className="font-semibold text-white">{formatValue(data[hover])}</span>
          <span className="ml-2 text-white/50">{labels[hover]}</span>
        </div>
      )}
    </div>
  );
}

export function BarChart({
  labels,
  data,
  height = 200,
  color = PRIMARY,
  formatValue = (v: number) => v.toLocaleString(),
}: {
  labels: string[];
  data: number[];
  height?: number;
  color?: string;
  formatValue?: (v: number) => string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 800;
  const H = height;
  const max = Math.max(1, ...data);
  const gap = 4;
  const bw = Math.max(4, W / data.length - gap);
  const labelEvery = Math.ceil(labels.length / 8);

  return (
    <div className="relative w-full">
      <svg viewBox={`0 0 ${W} ${H + 20}`} className="w-full" onMouseLeave={() => setHover(null)}>
        {data.map((v, i) => {
          const h = Math.max(2, (v / max) * (H - 16));
          const bx = i * (bw + gap);
          return (
            <g key={i} onMouseEnter={() => setHover(i)}>
              <rect
                x={bx}
                y={H - h}
                width={bw}
                height={h}
                rx={3}
                fill={hover === i ? PRIMARY_LIGHT : color}
                opacity={0.92}
              />
              <rect x={bx} y={0} width={bw} height={H} fill="transparent" />
              {i % labelEvery === 0 && (
                <text
                  x={bx + bw / 2}
                  y={H + 14}
                  fontSize={10}
                  fill="rgba(255,255,255,0.35)"
                  textAnchor="middle"
                >
                  {labels[i]}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      {hover !== null && (
        <div className="pointer-events-none absolute left-1/2 top-0 -translate-x-1/2 whitespace-nowrap rounded-lg border border-white/10 bg-[rgb(var(--oui-color-base-5))] px-3 py-1.5 text-xs shadow-xl">
          <span className="font-semibold text-white">{formatValue(data[hover])}</span>
          <span className="ml-2 text-white/50">{labels[hover]}</span>
        </div>
      )}
    </div>
  );
}

export function DonutChart({
  segments,
  size = 160,
  centerLabel,
  centerValue,
}: {
  segments: { label: string; value: number; color?: string }[];
  size?: number;
  centerLabel?: string;
  centerValue?: string;
}) {
  const palette = [PRIMARY, SUCCESS, DANGER, "rgb(var(--oui-color-warning))", PRIMARY_LIGHT];
  const total = segments.reduce((s, x) => s + x.value, 0) || 1;
  const R = size / 2 - 8;
  const C = 2 * Math.PI * R;
  let offset = 0;

  return (
    <div className="flex items-center gap-5">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={R} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={14} />
        {segments.map((s, i) => {
          const frac = s.value / total;
          const dash = `${frac * C} ${C}`;
          const off = -offset * C;
          offset += frac;
          return (
            <circle
              key={s.label}
              cx={size / 2}
              cy={size / 2}
              r={R}
              fill="none"
              stroke={s.color || palette[i % palette.length]}
              strokeWidth={14}
              strokeDasharray={dash}
              strokeDashoffset={off}
              transform={`rotate(-90 ${size / 2} ${size / 2})`}
              strokeLinecap="butt"
            >
              <title>{`${s.label}: ${Math.round(frac * 100)}%`}</title>
            </circle>
          );
        })}
        {centerValue && (
          <>
            <text x="50%" y="47%" textAnchor="middle" fontSize={18} fontWeight={700} fill="#fff">
              {centerValue}
            </text>
            <text x="50%" y="60%" textAnchor="middle" fontSize={9.5} fill="rgba(255,255,255,0.4)">
              {centerLabel}
            </text>
          </>
        )}
      </svg>
      <ul className="space-y-1.5">
        {segments.map((s, i) => (
          <li key={s.label} className="flex items-center gap-2 text-xs text-white/60">
            <span
              className="h-2.5 w-2.5 rounded-sm"
              style={{ background: s.color || palette[i % palette.length] }}
            />
            {s.label}
            <span className="font-medium text-white/85">
              {Math.round((s.value / total) * 100)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Horizontal bar list used for "top N" rankings. */
export function RankedBars({
  items,
  formatValue = (v: number) => v.toLocaleString(),
}: {
  items: { label: string; value: number }[];
  formatValue?: (v: number) => string;
}) {
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <ul className="space-y-2.5">
      {items.map((item, i) => (
        <li key={item.label}>
          <div className="mb-1 flex items-center justify-between text-xs">
            <span className="flex items-center gap-2 text-white/70">
              <span className="w-4 text-white/30">{i + 1}.</span>
              {item.label}
            </span>
            <span className="font-medium text-white/85">{formatValue(item.value)}</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-white/5">
            <div
              className="h-full rounded-full bg-[rgb(var(--oui-color-primary))] transition-all"
              style={{ width: `${Math.max(3, (item.value / max) * 100)}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
