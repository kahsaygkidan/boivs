import { useMemo } from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { isDirectHolder } from '../utils/dashboardModel.js';

const fmtPct = (n) => Math.round((Number(n) || 0) * 100) / 100;

const COLORS = { direct: '#059669', indirect: '#2563eb', other: '#cbd5e1' };

function OwnershipPieChart({ entity }) {
  const tree = entity?.tree;
  const ubos = useMemo(() => (tree?.holders || []).filter((h) => h.ubo), [tree]);

  const chartData = useMemo(() => {
    let directTotal = 0, indirectTotal = 0;
    const directHolders = [], indirectHolders = [];
    ubos.forEach((h) => {
      const pct = Number(h.effectivePercentage) || 0;
      if (pct <= 0) return;
      if (isDirectHolder(h)) { directTotal += pct; directHolders.push({ name: h.fullName, pct }); }
      else { indirectTotal += pct; indirectHolders.push({ name: h.fullName, pct }); }
    });
    const slices = [];
    if (directTotal > 0) slices.push({ name: `Direct (${directHolders.length})`, value: directTotal, kind: 'direct', holders: directHolders });
    if (indirectTotal > 0) slices.push({ name: `Indirect (${indirectHolders.length})`, value: indirectTotal, kind: 'indirect', holders: indirectHolders });
    const total = directTotal + indirectTotal;
    if (total > 0 && total < 100) slices.push({ name: 'Other', value: 100 - total, kind: 'other' });
    return slices;
  }, [ubos]);

  const total = chartData.reduce((s, r) => s + r.value, 0);
  const directSlice = chartData.find((r) => r.kind === 'direct');
  const indirectSlice = chartData.find((r) => r.kind === 'indirect');

  const verifiedCount = ubos.filter((h) => ['VERIFIED', 'APPROVED'].includes(h.status) || h.registered).length;
  const pendingCount = ubos.filter((h) => h.status === 'PENDING').length;

  if (!tree) return <div className="dash-empty-inline">No ownership data loaded yet.</div>;
  if (chartData.length === 0) return <div className="dash-empty-inline">No UBO ownership recorded.</div>;

  const CustomTooltip = ({ active, payload }) => {
    if (!active || !payload || !payload.length) return null;
    const item = payload[0];
    const pct = total > 0 ? ((item.value / total) * 100).toFixed(1) : 0;
    return (
      <div className="dash-pie-tooltip">
        <div className="dash-pie-tooltip__title">{item.name}</div>
        <div className="dash-pie-tooltip__meta">
          <strong style={{ color: item.payload.kind === 'direct' ? COLORS.direct : item.payload.kind === 'indirect' ? COLORS.indirect : 'var(--dash-text-muted)' }}>
            {item.value}%
          </strong>{' '}· {pct}% of total
        </div>
        {item.payload.holders && item.payload.holders.length > 0 && (
          <div className="dash-pie-tooltip__list">
            {item.payload.holders.map((h, i) => (
              <div key={i} className="dash-pie-tooltip__row">
                <span className="dash-pie-tooltip__name">{h.name}</span>
                <strong className="dash-pie-tooltip__pct">{h.pct}%</strong>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="dash-pie-layout">
      <div className="dash-pie-chart">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius={72}
              outerRadius={112}
              paddingAngle={3}
              cornerRadius={6}
              stroke="var(--dash-surface, #fff)"
              strokeWidth={3}
              isAnimationActive
              animationDuration={300}
              labelLine={false}
              label={({ cx, cy, midAngle, innerRadius, outerRadius, percent }) => {
                if (percent < 0.06) return null;
                const RADIAN = Math.PI / 180;
                const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
                const x = cx + radius * Math.cos(-midAngle * RADIAN);
                const y = cy + radius * Math.sin(-midAngle * RADIAN);
                return (
                  <text x={x} y={y} fill="#fff" textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight={700} style={{ pointerEvents: 'none' }}>
                    {`${(percent * 100).toFixed(0)}%`}
                  </text>
                );
              }}
            >
              {chartData.map((entry, i) => <Cell key={`cell-${i}`} fill={COLORS[entry.kind] || COLORS.other} />)}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
          </PieChart>
        </ResponsiveContainer>
        <div className="dash-pie-center">

          <div className="dash-pie-center__sub">{ubos.length} UBO{ubos.length === 1 ? '' : 's'}</div>

        </div>
      </div>

      <div className="dash-pie-legend">
        {directSlice && (
          <div className="dash-pie-legend__card dash-pie-legend__card--direct">
            <div className="dash-pie-legend__row">
              <span className="dash-pie-legend__swatch dash-pie-legend__swatch--direct" />
              <span className="dash-pie-legend__label dash-pie-legend__label--direct">Direct</span>
            </div>
            <div className="dash-pie-legend__value">{fmtPct(directSlice.value)}%</div>
            <div className="dash-pie-legend__names">{directSlice.holders.map((h) => h.name).join(', ')}</div>
          </div>
        )}
        {indirectSlice && (
          <div className="dash-pie-legend__card dash-pie-legend__card--indirect">
            <div className="dash-pie-legend__row">
              <span className="dash-pie-legend__swatch dash-pie-legend__swatch--indirect" />
              <span className="dash-pie-legend__label dash-pie-legend__label--indirect">Indirect</span>
            </div>
            <div className="dash-pie-legend__value">{fmtPct(indirectSlice.value)}%</div>
            <div className="dash-pie-legend__names">{indirectSlice.holders.map((h) => h.name).join(', ')}</div>
          </div>
        )}
      </div>
    </div>
  );
}

export default OwnershipPieChart;
