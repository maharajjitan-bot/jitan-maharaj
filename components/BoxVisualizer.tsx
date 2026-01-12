
import React from 'react';
import { PortShape, Unit } from '../types';
import { HelpCircle, Info, Wind, Layers, Maximize2 } from 'lucide-react';

interface BoxVisualizerProps {
  length: number;
  width: number; // This is the 'depth' into the screen
  height: number;
  type: string;
  portShape?: PortShape;
  portLength?: number;
  diameter?: number;
  side?: number;
  portWidth?: number;
  portHeight?: number;
  unit: Unit;
}

const BoxVisualizer: React.FC<BoxVisualizerProps> = ({ 
  length, width, height, type, portShape, portLength = 0,
  diameter = 4, side = 4, portWidth = 2, portHeight = 10,
  unit 
}) => {
  // Simple scaling for the SVG viewbox
  const max = Math.max(length, width, height, portLength) || 1;
  const scale = 150 / max;
  
  const l = length * scale;
  const w = width * scale; // Box Depth
  const h = height * scale;

  const isMetric = unit === Unit.METRIC;
  const lengthUnitLabel = isMetric ? "cm" : "in";

  const renderPort = () => {
    if (type !== 'Ported' || !portLength) return null;

    const pLen = portLength * scale;
    const offX = pLen / 3;
    const offY = -pLen / 3;

    const isTooLong = portLength > width;
    const portStroke = isTooLong ? "#f43f5e" : "#fbbf24"; 

    const strokeProps = {
      fill: "none",
      stroke: portStroke,
      strokeWidth: "1.5",
    };

    let faceW = 0;
    let faceH = 0;
    let isRound = false;

    if (portShape === PortShape.ROUND) {
      faceW = (diameter || 4) * scale;
      faceH = (diameter || 4) * scale;
      isRound = true;
    } else if (portShape === PortShape.SQUARE) {
      faceW = (side || 4) * scale;
      faceH = (side || 4) * scale;
    } else if (portShape === PortShape.SLOT) {
      faceW = (portWidth || 2) * scale;
      faceH = (portHeight || 10) * scale;
    }

    const posX = -l / 2 + faceW/2 + (5 * scale);
    const posY = -h / 2 + faceH/2 + (5 * scale);

    const depthVolume = () => {
      if (isRound) {
        const r = faceW / 2;
        return (
          <g>
            <line x1={posX + r} y1={posY} x2={posX + r + offX} y2={posY + offY} {...strokeProps} className="opacity-30" />
            <line x1={posX - r} y1={posY} x2={posX - r + offX} y2={posY + offY} {...strokeProps} className="opacity-30" />
            <line x1={posX} y1={posY + r} x2={posX + offX} y2={posY + r + offY} {...strokeProps} className="opacity-30" />
            <line x1={posX} y1={posY - r} x2={posX + offX} y2={posY - r + offY} {...strokeProps} className="opacity-30" />
            <circle cx={posX + offX} cy={posY + offY} r={r} {...strokeProps} strokeDasharray="3" className="opacity-40" />
            <path 
              d={`M ${posX-r} ${posY} L ${posX-r+offX} ${posY+offY} A ${r} ${r} 0 0 1 ${posX+r+offX} ${posY+offY} L ${posX+r} ${posY} A ${r} ${r} 0 0 0 ${posX-r} ${posY}`}
              fill={portStroke}
              className="opacity-5"
            />
          </g>
        );
      }
      
      const xStart = posX - faceW / 2;
      const yStart = posY - faceH / 2;
      
      return (
        <g>
          <line x1={xStart} y1={yStart} x2={xStart + offX} y2={yStart + offY} {...strokeProps} className="opacity-30" />
          <line x1={xStart + faceW} y1={yStart} x2={xStart + faceW + offX} y2={yStart + offY} {...strokeProps} className="opacity-30" />
          <line x1={xStart} y1={yStart + faceH} x2={xStart + offX} y2={yStart + faceH + offY} {...strokeProps} className="opacity-30" />
          <line x1={xStart + faceW} y1={yStart + faceH} x2={xStart + faceW + offX} y2={yStart + faceH + offY} {...strokeProps} className="opacity-30" />
          <rect x={xStart + offX} y={yStart + offY} width={faceW} height={faceH} {...strokeProps} strokeDasharray="3" className="opacity-40" />
          <polygon points={`${xStart},${yStart} ${xStart+offX},${yStart+offY} ${xStart+offX+faceW},${yStart+offY} ${xStart+faceW},${yStart}`} fill={portStroke} className="opacity-5" />
          <polygon points={`${xStart},${yStart+faceH} ${xStart+offX},${yStart+offY+faceH} ${xStart+offX+faceW},${yStart+offY+faceH} ${xStart+faceW},${yStart+faceH}`} fill={portStroke} className="opacity-5" />
        </g>
      );
    };

    return (
      <g>
        {depthVolume()}
        {isRound ? (
          <circle cx={posX} cy={posY} r={faceW / 2} fill={portStroke} className="opacity-40" />
        ) : (
          <rect x={posX - faceW / 2} y={posY - faceH / 2} width={faceW} height={faceH} fill={portStroke} className="opacity-40" />
        )}
      </g>
    );
  };

  const getEffectiveDiameter = () => {
    if (portShape === PortShape.ROUND) return diameter || 4;
    if (portShape === PortShape.SQUARE) return side || 4;
    if (portShape === PortShape.SLOT) return Math.sqrt((4 * (portWidth || 2) * (portHeight || 10)) / Math.PI);
    return 4;
  };

  const effDiameter = getEffectiveDiameter();
  const clearanceRisk = portLength > (width - effDiameter);

  return (
    <div className="bg-[#0c1224] rounded-[2rem] border border-white/5 p-8 relative overflow-hidden group">
      <div className="flex items-center justify-between mb-4">
        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Acoustic Wireframe</span>
        {type === 'Ported' && (
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${portLength > width ? 'bg-rose-500 animate-pulse' : 'bg-emerald-500'}`} />
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">Spatial Fit Analysis</span>
          </div>
        )}
      </div>

      <div className="flex flex-col md:flex-row items-center gap-8">
        <div className="relative flex-1 flex justify-center items-center">
          <svg width="240" height="240" viewBox="0 0 250 250" className="drop-shadow-[0_0_30px_rgba(99,102,241,0.1)] transition-transform group-hover:scale-105 duration-700">
            <g transform="translate(125, 125)">
              <rect 
                x={-l/2} y={-h/2} width={l} height={h} 
                fill="none" stroke="#6366f1" strokeWidth="2.5" 
                className="opacity-80"
              />
              <line x1={-l/2} y1={-h/2} x2={-l/2 + w/3} y2={-h/2 - w/3} stroke="#6366f1" strokeWidth="1.5" strokeDasharray="4" className="opacity-40" />
              <line x1={l/2} y1={-h/2} x2={l/2 + w/3} y2={-h/2 - w/3} stroke="#6366f1" strokeWidth="1.5" strokeDasharray="4" className="opacity-40" />
              <line x1={-l/2} y1={h/2} x2={-l/2 + w/3} y2={h/2 - w/3} stroke="#6366f1" strokeWidth="1.5" strokeDasharray="4" className="opacity-40" />
              <line x1={l/2} y1={h/2} x2={l/2 + w/3} y2={h/2 - w/3} stroke="#6366f1" strokeWidth="1.5" strokeDasharray="4" className="opacity-40" />
              
              <rect 
                x={-l/2 + w/3} y={-h/2 - w/3} width={l} height={h} 
                fill="none" stroke="#818cf8" strokeWidth="1.5" 
                className="opacity-20"
              />

              {renderPort()}
              
              <circle cx={0} cy={0} r={Math.min(l, h) * 0.35} fill="none" stroke="#94a3b8" strokeWidth="1" className="opacity-20" />
              <circle cx={0} cy={0} r={Math.min(l, h) * 0.1} fill="none" stroke="#94a3b8" strokeWidth="1" className="opacity-10" />
            </g>
          </svg>
        </div>

        {type === 'Ported' && (
          <div className="w-full md:w-48 space-y-4 py-4 md:border-l md:border-white/5 md:pl-8">
            <div className="space-y-2 group/porthelp">
              <div className="flex items-center justify-between">
                <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Port Fitting Lab</p>
                <div className="relative">
                  <HelpCircle className="w-3.5 h-3.5 text-slate-600 cursor-help hover:text-indigo-400 transition-colors" />
                  {/* Tooltip content */}
                  <div className="absolute right-0 bottom-full mb-3 w-64 p-5 bg-slate-900 border border-white/10 rounded-2xl text-[10px] text-slate-300 shadow-2xl opacity-0 invisible group-hover/porthelp:opacity-100 group-hover/porthelp:visible transition-all z-50 pointer-events-none leading-relaxed ring-1 ring-white/10">
                    <p className="font-black text-white uppercase tracking-tighter flex items-center gap-2 mb-3">
                      <Wind className="w-3 h-3 text-indigo-400" /> Port Best Practices
                    </p>
                    <ul className="space-y-3">
                      <li className="flex gap-2">
                        <Maximize2 className="w-3 h-3 text-emerald-400 shrink-0 mt-0.5" />
                        <span><strong>Clearance:</strong> Internal end must be at least one diameter ({effDiameter.toFixed(1)} {lengthUnitLabel}) away from walls to maintain tuning accuracy.</span>
                      </li>
                      <li className="flex gap-2">
                        <Layers className="w-3 h-3 text-amber-400 shrink-0 mt-0.5" />
                        <span><strong>Fitment:</strong> If length > depth, use a 90° elbow. Ensure the centerline length matches the calculated {portLength.toFixed(1)} {lengthUnitLabel}.</span>
                      </li>
                      <li className="flex gap-2">
                        <Info className="w-3 h-3 text-indigo-400 shrink-0 mt-0.5" />
                        <span><strong>Bracing:</strong> Long ports act as levers. Brace the tube to the enclosure wall to prevent vibration.</span>
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
              <div className="h-2 w-full bg-black/40 rounded-full relative overflow-hidden border border-white/5">
                <div 
                  className={`h-full transition-all duration-700 rounded-full ${portLength > width ? 'bg-rose-500' : 'bg-amber-400'}`} 
                  style={{ width: `${Math.min(100, (portLength / Math.max(width, portLength)) * 100)}%` }}
                />
                <div 
                  className="absolute top-0 bottom-0 w-0.5 bg-indigo-500 z-10" 
                  style={{ left: `${(width / Math.max(width, portLength)) * 100}%` }}
                />
              </div>
              <div className="flex justify-between text-[8px] font-bold text-slate-600 uppercase">
                <span>Tube: {portLength.toFixed(1)}</span>
                <span className="text-indigo-400">Box Depth: {width.toFixed(1)}</span>
              </div>
            </div>

            <div className={`p-3 rounded-2xl border ${portLength > width || clearanceRisk ? 'bg-rose-500/5 border-rose-500/20 text-rose-400' : 'bg-indigo-500/5 border-white/5 text-indigo-300'} transition-all duration-500`}>
              <p className="text-[10px] font-black uppercase tracking-tight mb-1">Fit Status</p>
              <p className="text-[9px] font-medium leading-relaxed">
                {portLength > width 
                  ? "Requires an elbow. Port exceeds internal depth."
                  : clearanceRisk
                    ? "Warning: Rear clearance is less than 1x diameter. Tuning may be lowered."
                    : "Fits linearly. Straight port construction possible."}
              </p>
            </div>
          </div>
        )}
        
        {type === 'Sealed' && (
          <div className="w-full md:w-48 space-y-4 py-4 md:border-l md:border-white/5 md:pl-8">
             <div className="p-3 rounded-2xl border bg-emerald-500/5 border-emerald-500/20 text-emerald-400 transition-all duration-500">
              <p className="text-[10px] font-black uppercase tracking-tight mb-1">Sealed Benefits</p>
              <p className="text-[9px] font-medium leading-relaxed">
                Superior transient response and smaller footprint. Use heavy polyfill for an effectively larger volume.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default BoxVisualizer;
