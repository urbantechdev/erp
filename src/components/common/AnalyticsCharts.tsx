import React, { useState, useMemo } from 'react';
import {
  BarChart3,
  PieChart as PieChartIcon,
  TrendingUp,
  DollarSign,
  Package,
  Layers,
  ArrowUpRight,
  Maximize2,
  Minimize2,
  Info,
} from 'lucide-react';
import { formatKes } from '../../erpUtils';

// ==========================================
// 1. REUSABLE PROFESSIONAL BAR GRAPH
// ==========================================

export interface BarChartDataPoint {
  label: string;
  value: number;
  formattedValue?: string;
  color?: string;
  secondaryLabel?: string;
}

interface BarGraphProps {
  title: string;
  subtitle?: string;
  data: BarChartDataPoint[];
  height?: number;
  valueFormatter?: (val: number) => string;
  badge?: string;
  emptyMessage?: string;
  activeColor?: string;
}

export const BarGraph: React.FC<BarGraphProps> = ({
  title,
  subtitle,
  data,
  height = 240,
  valueFormatter = formatKes,
  badge,
  emptyMessage = 'No transaction data available yet',
  activeColor = '#0A006E',
}) => {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const maxValue = useMemo(() => {
    const max = Math.max(...data.map((d) => d.value), 0);
    return max > 0 ? max * 1.15 : 100;
  }, [data]);

  const total = useMemo(() => data.reduce((acc, curr) => acc + curr.value, 0), [data]);

  // Generate 4 Y-axis ticks
  const yTicks = useMemo(() => {
    return [0, 0.33, 0.66, 1].map((pct) => ({
      pct,
      val: maxValue * pct,
      formatted: valueFormatter(maxValue * pct),
    }));
  }, [maxValue, valueFormatter]);

  const chartPadding = { top: 25, bottom: 45, left: 60, right: 20 };
  const chartWidth = 520;
  const usableWidth = chartWidth - chartPadding.left - chartPadding.right;
  const usableHeight = height - chartPadding.top - chartPadding.bottom;
  const barSpacing = data.length > 0 ? usableWidth / data.length : usableWidth;
  const barWidth = Math.max(14, Math.min(36, barSpacing * 0.58));

  if (!data || data.length === 0 || total === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <div className="text-xs font-montserrat font-black text-[#0A006E] uppercase tracking-wider">
              {title}
            </div>
            {subtitle && <p className="text-[11px] text-slate-500 mt-0.5">{subtitle}</p>}
          </div>
          {badge && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-[#FFDE00] text-[#0A006E]">
              {badge}
            </span>
          )}
        </div>
        <div className="h-44 flex flex-col items-center justify-center text-slate-400 gap-2">
          <BarChart3 className="w-8 h-8 stroke-1 text-slate-300" />
          <p className="text-xs font-medium">{emptyMessage}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-3 flex flex-col justify-between">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-montserrat font-black text-[#0A006E] uppercase tracking-wider">
              {title}
            </span>
            {badge && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-[#FFDE00] text-[#0A006E] shadow-2xs">
                {badge}
              </span>
            )}
          </div>
          {subtitle && <p className="text-[11px] text-slate-500 mt-0.5">{subtitle}</p>}
        </div>
        <div className="text-right">
          <div className="text-[10px] font-montserrat font-bold text-slate-400 uppercase">
            Total Metric
          </div>
          <div className="text-sm font-montserrat font-black text-[#0A006E] font-mono-tabular">
            {valueFormatter(total)}
          </div>
        </div>
      </div>

      {/* SVG Responsive Chart Viewport */}
      <div className="relative w-full overflow-x-auto">
        <svg
          viewBox={`0 0 ${chartWidth} ${height}`}
          className="w-full h-auto min-w-[320px] select-none"
        >
          {/* Background Grid Lines & Y-Axis Labels */}
          {yTicks.map((tick, i) => {
            const yPos = chartPadding.top + usableHeight - tick.pct * usableHeight;
            return (
              <g key={i}>
                <line
                  x1={chartPadding.left}
                  y1={yPos}
                  x2={chartWidth - chartPadding.right}
                  y2={yPos}
                  stroke="#E2E8F0"
                  strokeDasharray={i === 0 ? '0' : '4 3'}
                  strokeWidth="1"
                />
                <text
                  x={chartPadding.left - 8}
                  y={yPos + 3.5}
                  textAnchor="end"
                  className="text-[9px] fill-slate-400 font-mono-tabular font-medium"
                >
                  {tick.formatted}
                </text>
              </g>
            );
          })}

          {/* Vertical Bars */}
          {data.map((item, idx) => {
            const barHeight = Math.max(4, (item.value / maxValue) * usableHeight);
            const xPos =
              chartPadding.left +
              idx * barSpacing +
              (barSpacing - barWidth) / 2;
            const yPos = chartPadding.top + usableHeight - barHeight;
            const isHovered = hoveredIdx === idx;
            const fill = item.color || (isHovered ? '#FFDE00' : activeColor);
            const pctOfTotal = total > 0 ? ((item.value / total) * 100).toFixed(1) : '0';

            return (
              <g
                key={idx}
                className="cursor-pointer transition-all duration-150"
                onMouseEnter={() => setHoveredIdx(idx)}
                onMouseLeave={() => setHoveredIdx(null)}
              >
                {/* Hover backdrop column indicator */}
                {isHovered && (
                  <rect
                    x={chartPadding.left + idx * barSpacing + 2}
                    y={chartPadding.top}
                    width={barSpacing - 4}
                    height={usableHeight}
                    fill="#F1F5F9"
                    rx="6"
                  />
                )}

                {/* The Bar */}
                <rect
                  x={xPos}
                  y={yPos}
                  width={barWidth}
                  height={barHeight}
                  fill={fill}
                  rx="6"
                  ry="6"
                  stroke={isHovered ? '#0A006E' : 'none'}
                  strokeWidth={isHovered ? '2' : '0'}
                  className="transition-all duration-200"
                />

                {/* Top value badge when hovered or if primary */}
                {(isHovered || data.length <= 6) && (
                  <text
                    x={xPos + barWidth / 2}
                    y={Math.max(chartPadding.top - 6, yPos - 5)}
                    textAnchor="middle"
                    className={`text-[9px] font-montserrat font-bold font-mono-tabular ${
                      isHovered ? 'fill-[#0A006E] font-black' : 'fill-slate-600'
                    }`}
                  >
                    {item.formattedValue || (item.value >= 1000 ? `${(item.value / 1000).toFixed(0)}k` : item.value)}
                  </text>
                )}

                {/* X-Axis Category Label */}
                <text
                  x={xPos + barWidth / 2}
                  y={chartPadding.top + usableHeight + 16}
                  textAnchor="middle"
                  className={`text-[10px] font-montserrat font-bold ${
                    isHovered ? 'fill-[#0A006E]' : 'fill-slate-600'
                  }`}
                >
                  {item.label.length > 9 ? `${item.label.slice(0, 8)}…` : item.label}
                </text>

                {/* Secondary subtitle under X-axis */}
                <text
                  x={xPos + barWidth / 2}
                  y={chartPadding.top + usableHeight + 28}
                  textAnchor="middle"
                  className="text-[8.5px] fill-slate-400 font-mono-tabular"
                >
                  {item.secondaryLabel || `${pctOfTotal}%`}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* Dynamic Hover Tooltip / Status Footer */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 flex items-center justify-between text-xs">
        {hoveredIdx !== null && data[hoveredIdx] ? (
          <>
            <div className="flex items-center gap-2">
              <span
                className="w-2.5 h-2.5 rounded-full"
                style={{ backgroundColor: data[hoveredIdx].color || activeColor }}
              />
              <span className="font-montserrat font-bold text-slate-800">
                {data[hoveredIdx].label}:
              </span>
              <strong className="text-[#0A006E] font-mono-tabular">
                {valueFormatter(data[hoveredIdx].value)}
              </strong>
            </div>
            <span className="text-[11px] font-mono-tabular font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
              {total > 0 ? ((data[hoveredIdx].value / total) * 100).toFixed(1) : 0}% of Total
            </span>
          </>
        ) : (
          <div className="flex items-center gap-2 text-slate-500 text-[11px]">
            <Info className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span>Hover or tap on any bar above to inspect detailed contribution.</span>
          </div>
        )}
      </div>
    </div>
  );
};

// ==========================================
// 2. REUSABLE PROFESSIONAL DONUT / PIE CHART
// ==========================================

export interface PieChartDataPoint {
  label: string;
  value: number;
  color: string;
  sublabel?: string;
}

interface PieChartProps {
  title: string;
  subtitle?: string;
  data: PieChartDataPoint[];
  size?: number;
  innerRadiusRatio?: number; // 0 for pie, 0.55 for modern donut
  valueFormatter?: (val: number) => string;
  centerMetricLabel?: string;
  badge?: string;
  emptyMessage?: string;
}

export const PieChart: React.FC<PieChartProps> = ({
  title,
  subtitle,
  data,
  size = 220,
  innerRadiusRatio = 0.58,
  valueFormatter = formatKes,
  centerMetricLabel = 'Total Value',
  badge,
  emptyMessage = 'No distribution data available',
}) => {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const validData = useMemo(() => data.filter((d) => d.value > 0), [data]);
  const total = useMemo(() => validData.reduce((acc, curr) => acc + curr.value, 0), [validData]);

  // SVG dimensions
  const center = size / 2;
  const radius = size * 0.42;
  const innerRadius = radius * innerRadiusRatio;

  // Build SVG arc paths
  const slices = useMemo(() => {
    if (total === 0 || validData.length === 0) return [];

    let accumulatedAngle = -Math.PI / 2; // Start at 12 o'clock

    return validData.map((item, index) => {
      const sliceAngle = (item.value / total) * 2 * Math.PI;
      const startAngle = accumulatedAngle;
      const endAngle = accumulatedAngle + sliceAngle;
      accumulatedAngle += sliceAngle;

      // Handle single item taking 100%
      const isFullCircle = validData.length === 1;

      const x1 = center + radius * Math.cos(startAngle);
      const y1 = center + radius * Math.sin(startAngle);
      const x2 = center + radius * Math.cos(endAngle);
      const y2 = center + radius * Math.sin(endAngle);

      const ix1 = center + innerRadius * Math.cos(startAngle);
      const iy1 = center + innerRadius * Math.sin(startAngle);
      const ix2 = center + innerRadius * Math.cos(endAngle);
      const iy2 = center + innerRadius * Math.sin(endAngle);

      const largeArcFlag = sliceAngle > Math.PI ? 1 : 0;

      let pathD = '';
      if (isFullCircle) {
        // Draw double arc or donut circle
        pathD = `
          M ${center} ${center - radius}
          A ${radius} ${radius} 0 1 0 ${center} ${center + radius}
          A ${radius} ${radius} 0 1 0 ${center} ${center - radius}
          M ${center} ${center - innerRadius}
          A ${innerRadius} ${innerRadius} 0 1 1 ${center} ${center + innerRadius}
          A ${innerRadius} ${innerRadius} 0 1 1 ${center} ${center - innerRadius}
          Z
        `;
      } else if (innerRadius > 0) {
        pathD = `
          M ${x1} ${y1}
          A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2} ${y2}
          L ${ix2} ${iy2}
          A ${innerRadius} ${innerRadius} 0 ${largeArcFlag} 0 ${ix1} ${iy1}
          Z
        `;
      } else {
        pathD = `
          M ${center} ${center}
          L ${x1} ${y1}
          A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2} ${y2}
          Z
        `;
      }

      const pct = (item.value / total) * 100;

      return {
        ...item,
        pathD,
        pct,
        index,
      };
    });
  }, [validData, total, center, radius, innerRadius]);

  const activeSlice = hoveredIdx !== null && slices[hoveredIdx] ? slices[hoveredIdx] : null;

  if (validData.length === 0 || total === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <div className="text-xs font-montserrat font-black text-[#0A006E] uppercase tracking-wider">
              {title}
            </div>
            {subtitle && <p className="text-[11px] text-slate-500 mt-0.5">{subtitle}</p>}
          </div>
          {badge && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-[#FFDE00] text-[#0A006E]">
              {badge}
            </span>
          )}
        </div>
        <div className="h-44 flex flex-col items-center justify-center text-slate-400 gap-2">
          <PieChartIcon className="w-8 h-8 stroke-1 text-slate-300" />
          <p className="text-xs font-medium">{emptyMessage}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-3 flex flex-col justify-between">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-montserrat font-black text-[#0A006E] uppercase tracking-wider">
              {title}
            </span>
            {badge && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-[#FFDE00] text-[#0A006E] shadow-2xs">
                {badge}
              </span>
            )}
          </div>
          {subtitle && <p className="text-[11px] text-slate-500 mt-0.5">{subtitle}</p>}
        </div>
        <div className="text-right">
          <div className="text-[10px] font-montserrat font-bold text-slate-400 uppercase">
            Total Slices
          </div>
          <div className="text-sm font-montserrat font-black text-[#0A006E] font-mono-tabular">
            {validData.length} Segments
          </div>
        </div>
      </div>

      {/* SVG Donut / Pie Viewport + Side Legend */}
      <div className="flex flex-col sm:flex-row items-center justify-center gap-6 py-2">
        {/* SVG Graphic */}
        <div className="relative shrink-0 flex items-center justify-center">
          <svg
            width={size}
            height={size}
            viewBox={`0 0 ${size} ${size}`}
            className="select-none filter drop-shadow-xs"
          >
            {slices.map((slice) => {
              const isHovered = hoveredIdx === slice.index;
              return (
                <path
                  key={slice.index}
                  d={slice.pathD}
                  fill={slice.color}
                  stroke="#FFFFFF"
                  strokeWidth="2.5"
                  className="cursor-pointer transition-all duration-200 hover:opacity-90"
                  style={{
                    transformOrigin: `${center}px ${center}px`,
                    transform: isHovered ? 'scale(1.04)' : 'scale(1)',
                    filter: isHovered ? 'drop-shadow(0 4px 6px rgba(10,0,110,0.25))' : 'none',
                  }}
                  onMouseEnter={() => setHoveredIdx(slice.index)}
                  onMouseLeave={() => setHoveredIdx(null)}
                />
              );
            })}
          </svg>

          {/* Center metric inside Donut Hole */}
          {innerRadiusRatio > 0 && (
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center px-4">
              <span className="text-[10px] font-montserrat font-bold text-slate-500 uppercase leading-tight line-clamp-1">
                {activeSlice ? activeSlice.label : centerMetricLabel}
              </span>
              <span className="text-sm sm:text-base font-montserrat font-black text-[#0A006E] font-mono-tabular leading-tight mt-0.5">
                {activeSlice
                  ? valueFormatter(activeSlice.value)
                  : valueFormatter(total)}
              </span>
              <span className="text-[10px] font-mono-tabular font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded-full mt-0.5">
                {activeSlice
                  ? `${activeSlice.pct.toFixed(1)}%`
                  : '100%'}
              </span>
            </div>
          )}
        </div>

        {/* Legend List */}
        <div className="flex-1 w-full space-y-1.5 max-h-48 overflow-y-auto pr-1">
          {slices.map((slice) => {
            const isHovered = hoveredIdx === slice.index;
            return (
              <div
                key={slice.index}
                onMouseEnter={() => setHoveredIdx(slice.index)}
                onMouseLeave={() => setHoveredIdx(null)}
                className={`p-2 rounded-xl border flex items-center justify-between text-xs cursor-pointer transition ${
                  isHovered
                    ? 'bg-[#0A006E] text-white border-[#0A006E] shadow-sm'
                    : 'bg-slate-50 hover:bg-slate-100 text-slate-800 border-slate-200'
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className="w-3 h-3 rounded-full shrink-0 border border-white"
                    style={{ backgroundColor: slice.color }}
                  />
                  <div className="min-w-0">
                    <div
                      className={`font-montserrat font-bold truncate ${
                        isHovered ? 'text-white' : 'text-slate-900'
                      }`}
                    >
                      {slice.label}
                    </div>
                    {slice.sublabel && (
                      <div
                        className={`text-[10px] truncate ${
                          isHovered ? 'text-slate-200' : 'text-slate-500'
                        }`}
                      >
                        {slice.sublabel}
                      </div>
                    )}
                  </div>
                </div>

                <div className="text-right shrink-0 ml-2">
                  <div
                    className={`font-mono-tabular font-black ${
                      isHovered ? 'text-[#FFDE00]' : 'text-[#0A006E]'
                    }`}
                  >
                    {valueFormatter(slice.value)}
                  </div>
                  <div
                    className={`text-[10px] font-mono-tabular font-bold ${
                      isHovered ? 'text-emerald-300' : 'text-slate-500'
                    }`}
                  >
                    {slice.pct.toFixed(1)}%
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Dynamic Info Footer */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 flex items-center justify-between text-xs">
        <div className="flex items-center gap-2 text-slate-600 text-[11px]">
          <span className="w-2 h-2 rounded-full bg-emerald-500" />
          <span>Calculated live from active ERP ledger and bonded inventory stock.</span>
        </div>
        <span className="text-[11px] font-mono-tabular font-black text-[#0A006E]">
          {valueFormatter(total)} Total
        </span>
      </div>
    </div>
  );
};

// ==========================================
// 3. EXECUTIVE SPLIT ANALYTICS COMMAND PANEL
// ==========================================

interface ExecutiveVisualAnalyticsProps {
  branchData: BarChartDataPoint[];
  channelData: PieChartDataPoint[];
  assetData: PieChartDataPoint[];
  topSkusData: BarChartDataPoint[];
}

export const ExecutiveVisualAnalytics: React.FC<ExecutiveVisualAnalyticsProps> = ({
  branchData,
  channelData,
  assetData,
  topSkusData,
}) => {
  const [activeTab, setActiveTab] = useState<'commercial' | 'inventory'>('commercial');

  return (
    <div className="bg-[#F8FAFC] border-2 border-slate-300 rounded-3xl p-5 sm:p-6 shadow-md space-y-5">
      {/* Visual Analytics Header & Tab Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#0A006E] text-[#FFDE00] text-[11px] font-montserrat font-black uppercase tracking-wider mb-1.5 shadow-xs">
            <TrendingUp className="w-3.5 h-3.5 text-[#FFDE00]" />
            Executive Visual Analytics Center
          </div>
          <h2 className="text-xl sm:text-2xl font-montserrat font-black italic text-[#0A006E]">
            Interactive Charts &amp; Graphical Performance Metrics
          </h2>
          <p className="text-xs text-slate-600 max-w-2xl mt-0.5">
            Real-time visual telemetry converting commercial transactions and warehouse inventory into comparative bar graphs and proportional pie charts.
          </p>
        </div>

        {/* Tab switch buttons */}
        <div className="flex items-center gap-2 bg-slate-200/80 p-1.5 rounded-2xl border border-slate-300 shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('commercial')}
            className={`px-3.5 py-1.5 rounded-xl font-montserrat font-black text-xs flex items-center gap-1.5 cursor-pointer transition ${
              activeTab === 'commercial'
                ? 'bg-[#0A006E] text-[#FFDE00] shadow-sm'
                : 'text-slate-700 hover:text-[#0A006E]'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            Commercial &amp; Channels
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('inventory')}
            className={`px-3.5 py-1.5 rounded-xl font-montserrat font-black text-xs flex items-center gap-1.5 cursor-pointer transition ${
              activeTab === 'inventory'
                ? 'bg-[#0A006E] text-[#FFDE00] shadow-sm'
                : 'text-slate-700 hover:text-[#0A006E]'
            }`}
          >
            <PieChartIcon className="w-3.5 h-3.5" />
            Assets &amp; Top SKUs
          </button>
        </div>
      </div>

      {/* Grid of Charts */}
      {activeTab === 'commercial' ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Chart 1: Bar Graph of Branch Sales */}
          <BarGraph
            title="Regional Branch Revenue Comparison"
            subtitle="Commercial sales performance across active depots & branches"
            data={branchData}
            badge="Live Bar Graph"
            activeColor="#0A006E"
          />

          {/* Chart 2: Pie/Donut Chart of Sales Channel Mix */}
          <PieChart
            title="Sales Channel Revenue Contribution"
            subtitle="Proportional split between Retail Counter POS, B2B, and Online Store"
            data={channelData}
            badge="Live Pie Chart"
            centerMetricLabel="Gross Turnover"
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Chart 3: Pie/Donut Chart of Asset Valuation Distribution */}
          <PieChart
            title="Balance Sheet Asset Allocation"
            subtitle="Working capital split across Bonded Stock, A/R, and Reserves"
            data={assetData}
            badge="Asset Pie Chart"
            centerMetricLabel="Total Assets"
          />

          {/* Chart 4: Bar Graph of Top Performing SKUs */}
          <BarGraph
            title="Top Velocity SKU Revenue"
            subtitle="Leading liquor and beverage products by logged turnover"
            data={topSkusData}
            badge="Top Products Bar"
            activeColor="#34D186"
          />
        </div>
      )}
    </div>
  );
};
