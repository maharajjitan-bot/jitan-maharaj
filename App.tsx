
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Unit, BoxType, PortShape, Subwoofer, BoxDimensions, CalculationResults, BracingDimensions, PortSpecs, PortBraceDimensions, SavedProject } from './types';
import { STANDARD_SUBS, CONVERSION_IN_TO_CF, CONVERSION_CM_TO_L, CF_TO_LITERS } from './constants';
import { getEnclosureAdvice, getPortOptimizationAdvice } from './services/geminiService';
import BoxVisualizer from './components/BoxVisualizer';
import { 
  Calculator, 
  Settings2, 
  Volume2, 
  Package, 
  Layers, 
  Cpu,
  Info,
  ChevronDown,
  RotateCcw,
  Sparkles,
  Boxes,
  Wind,
  Anchor,
  Maximize,
  AlertTriangle,
  CheckCircle2,
  Sliders,
  Construction,
  Hash,
  HelpCircle,
  Activity,
  Circle,
  Square,
  RectangleHorizontal,
  Music4,
  Zap,
  Dna,
  RefreshCw,
  Scale,
  Target,
  Wand2,
  Gauge,
  Microchip,
  MoveHorizontal,
  Scissors,
  ClipboardList,
  Waves,
  CornerDownRight,
  ShieldCheck,
  ZapOff,
  Lock,
  Unlock,
  Save,
  Download,
  Trash2,
  FolderHeart,
  FileDown,
  X
} from 'lucide-react';

const App: React.FC = () => {
  // State
  const [unit, setUnit] = useState<Unit>(Unit.IMPERIAL);
  const [boxType, setBoxType] = useState<BoxType>(BoxType.SEALED);
  const [showCutSheet, setShowCutSheet] = useState<boolean>(true);
  const [dimensions, setDimensions] = useState<BoxDimensions>({
    length: 24,
    width: 15,
    height: 12,
    thickness: 0.75
  });
  const [bracing, setBracing] = useState<BracingDimensions>({
    count: 0,
    length: 12,
    width: 1,
    height: 1
  });
  const [portBracing, setPortBraceDimensions] = useState<PortBraceDimensions>({
    count: 0,
    length: 10,
    width: 2,
    thickness: 0.75
  });
  const [mountingDisp, setMountingDisp] = useState<number>(0.02); 
  const [portSpecs, setPortSpecs] = useState<PortSpecs>({
    shape: PortShape.ROUND,
    count: 1,
    targetFb: 35,
    diameter: 4,
    side: 4,
    width: 2,
    height: 10,
    physicalDepth: 0,
    calculatedLength: 0,
    endCorrection: 0.732 // Default for one flanged end
  });

  const [selectedSub, setSelectedSub] = useState<Subwoofer>(STANDARD_SUBS[3]); // 12"
  const [subCount, setSubCount] = useState<number>(1);
  const [customXmax, setCustomXmax] = useState<number>(15); // mm
  const [customFs, setCustomFs] = useState<number>(28);
  const [customQts, setCustomQts] = useState<number>(0.48);
  const [customQes, setCustomQes] = useState<number>(0.52);
  const [customQms, setCustomQms] = useState<number>(6.5);
  const [customVas, setCustomVas] = useState<number>(62.1); // Liters
  const [manualDisplacement, setManualDisplacement] = useState<number>(0.08); 
  const [displacementUnit, setDisplacementUnit] = useState<Unit>(Unit.IMPERIAL);
  
  const [results, setResults] = useState<CalculationResults>({
    grossVolume: 0,
    netVolume: 0,
    subDisplacement: 0,
    bracingDisplacement: 0,
    portDisplacement: 0,
    portBraceDisplacement: 0,
    mountingDisplacement: 0,
    portVelocity: 0,
    isStable: false
  });
  const [aiAdvice, setAiAdvice] = useState<string>("");
  const [portAdvice, setPortAdvice] = useState<string>("");
  const [isLoadingAdvice, setIsLoadingAdvice] = useState<boolean>(false);
  const [isLoadingPortAdvice, setIsLoadingPortAdvice] = useState<boolean>(false);

  // Persistence State
  const [savedProjects, setSavedProjects] = useState<SavedProject[]>([]);
  const [isProjectsModalOpen, setIsProjectsModalOpen] = useState(false);
  const [projectName, setProjectName] = useState("New Enclosure Project");

  const isMetric = unit === Unit.METRIC;
  const isDispMetric = displacementUnit === Unit.METRIC;
  const PORT_LENGTH_THRESHOLD = isMetric ? 50 : 20;

  // Load saved projects on mount
  useEffect(() => {
    const stored = localStorage.getItem('subbox_pro_projects');
    if (stored) {
      try {
        setSavedProjects(JSON.parse(stored));
      } catch (e) {
        console.error("Failed to load projects", e);
      }
    }
  }, []);

  // Save projects to localStorage when they change
  useEffect(() => {
    localStorage.setItem('subbox_pro_projects', JSON.stringify(savedProjects));
  }, [savedProjects]);

  // EBP Calculation (Fs / Qes)
  const ebp = useMemo(() => customFs / (customQes || 0.1), [customFs, customQes]);

  /**
   * T/S Parameter based calculations for "Ideal" Enclosures
   */
  const tsTargets = useMemo(() => {
    const qts = customQts;
    const vas = customVas;
    const fs = customFs;
    
    // Total Vas for multiple subs
    const totalVas = vas * subCount;
    
    // Ideal Sealed (Qtc = 0.707)
    const sealedVbLiters = totalVas / (Math.pow(0.707 / qts, 2) - 1);
    
    // Ideal Ported (Vb = 20 * Qts^3.3 * Vas)
    const portedVbLiters = 20 * Math.pow(qts, 3.3) * totalVas;
    const portedFb = Math.pow(totalVas / portedVbLiters, 0.31) * fs;
    
    return {
      sealedVb: isMetric ? sealedVbLiters : sealedVbLiters / CF_TO_LITERS,
      portedVb: isMetric ? portedVbLiters : portedVbLiters / CF_TO_LITERS,
      portedFb: portedFb
    };
  }, [customQts, customVas, customFs, subCount, isMetric]);

  const activeTargetVb = boxType === BoxType.SEALED ? tsTargets.sealedVb : tsTargets.portedVb;

  /**
   * Calculates port length based on area and end correction factor.
   */
  const calculatePortGeometry = (totalArea: number, volume: number, fb: number, k: number) => {
    if (volume <= 0 || totalArea <= 0 || fb <= 0) return 0;
    const dEff = Math.sqrt((4 * totalArea) / Math.PI);
    const l = (23562 * Math.pow(dEff, 2)) / (volume * Math.pow(fb, 2)) - (k * dEff);
    return Math.max(0, l);
  };

  /**
   * Calculates Peak Port Air Velocity (m/s)
   */
  const calculateAirVelocity = (fb: number, sD: number, xMax: number, subCount: number, totalAreaInches: number) => {
    if (totalAreaInches <= 0) return 0;
    const sD_m2 = (sD * subCount) / 10000; // cm2 to m2
    const xMax_m = xMax / 1000; // mm to m
    const vD_m3 = sD_m2 * xMax_m;
    const area_m2 = totalAreaInches * 0.00064516; // sq in to m2
    const velocity = (2 * Math.PI * fb * vD_m3) / area_m2;
    return velocity;
  };

  const calculate = useCallback(() => {
    const { length, width, height, thickness } = dimensions;
    const volumeUnitFactor = isMetric ? CONVERSION_CM_TO_L : CONVERSION_IN_TO_CF;

    const intL = Math.max(0, length - (2 * thickness));
    const intW = Math.max(0, width - (2 * thickness));
    const intH = Math.max(0, height - (2 * thickness));
    const grossFinal = (intL * intW * intH) / volumeUnitFactor;

    const braceVol = (bracing.length * bracing.width * bracing.height * bracing.count) / volumeUnitFactor;
    
    let subDispSingleStandard = manualDisplacement;
    if (unit === Unit.IMPERIAL && displacementUnit === Unit.METRIC) {
      subDispSingleStandard = manualDisplacement / CF_TO_LITERS;
    } else if (unit === Unit.METRIC && displacementUnit === Unit.IMPERIAL) {
      subDispSingleStandard = manualDisplacement * CF_TO_LITERS;
    }

    const subDispTotal = subDispSingleStandard * subCount;
    const mountingDispTotal = mountingDisp;

    let calculatedPDisp = 0;
    let finalPortLength = 0;
    let velocity = 0;
    let pBraceDisp = 0;
    
    if (boxType === BoxType.PORTED) {
      let singleAreaInches = 0;
      if (portSpecs.shape === PortShape.ROUND) {
        singleAreaInches = Math.PI * Math.pow(isMetric ? portSpecs.diameter / 2.54 / 2 : portSpecs.diameter / 2, 2);
      } else if (portSpecs.shape === PortShape.SQUARE) {
        singleAreaInches = Math.pow(isMetric ? portSpecs.side / 2.54 : portSpecs.side, 2);
      } else if (portSpecs.shape === PortShape.SLOT) {
        const wIn = isMetric ? portSpecs.width / 2.54 : portSpecs.width;
        const hIn = isMetric ? portSpecs.height / 2.54 : portSpecs.height;
        singleAreaInches = wIn * hIn;
      }

      const totalAreaInches = singleAreaInches * portSpecs.count;
      const baseNetForPort = isMetric ? grossFinal / 28.317 : grossFinal; 
      const lengthInches = calculatePortGeometry(totalAreaInches, baseNetForPort, portSpecs.targetFb, portSpecs.endCorrection);
      finalPortLength = isMetric ? lengthInches * 2.54 : lengthInches;

      const areaActual = isMetric ? totalAreaInches * Math.pow(2.54, 2) : totalAreaInches;
      
      const dispDepth = portSpecs.physicalDepth > 0 ? portSpecs.physicalDepth : finalPortLength;
      calculatedPDisp = (areaActual * dispDepth * 1.1) / volumeUnitFactor;

      velocity = calculateAirVelocity(portSpecs.targetFb, selectedSub.sD, customXmax, subCount, totalAreaInches);

      pBraceDisp = (portBracing.count * portBracing.length * portBracing.width * portBracing.thickness) / volumeUnitFactor;
    }

    const netFinal = grossFinal - subDispTotal - braceVol - mountingDispTotal - calculatedPDisp - pBraceDisp;

    setPortSpecs(prev => ({ ...prev, calculatedLength: finalPortLength }));
    setResults({
      grossVolume: grossFinal,
      netVolume: netFinal,
      subDisplacement: subDispTotal,
      bracingDisplacement: braceVol,
      portDisplacement: calculatedPDisp,
      portBraceDisplacement: pBraceDisp,
      mountingDisplacement: mountingDispTotal,
      portVelocity: velocity,
      isStable: netFinal > 0
    });
  }, [dimensions, selectedSub, subCount, customXmax, manualDisplacement, displacementUnit, boxType, bracing, portBracing, mountingDisp, portSpecs, isMetric, unit]);

  useEffect(() => {
    calculate();
  }, [calculate]);

  /**
   * Subwoofer selection effect.
   */
  useEffect(() => {
    setCustomXmax(selectedSub.xMax);
    setCustomFs(selectedSub.fS);
    setCustomQts(selectedSub.qTS);
    setCustomVas(selectedSub.vAS);
    setCustomQes(selectedSub.qTS * 1.1);
    setCustomQms(6.5);
    
    const industryDispFt3 = selectedSub.displacement;
    if (displacementUnit === Unit.METRIC) {
      setManualDisplacement(industryDispFt3 * CF_TO_LITERS);
    } else {
      setManualDisplacement(industryDispFt3);
    }
  }, [selectedSub, displacementUnit]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setDimensions(prev => ({ ...prev, [name]: parseFloat(value) || 0 }));
  };

  const handleBracingChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setBracing(prev => ({ ...prev, [name]: parseFloat(value) || 0 }));
  };

  const handlePortBracingChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setPortBraceDimensions(prev => ({ ...prev, [name]: parseFloat(value) || 0 }));
  };

  const handlePortChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setPortSpecs(prev => ({ ...prev, [name]: parseFloat(value) || 0 }));
  };

  const handleDisplacementUnitChange = (newUnit: Unit) => {
    if (newUnit === displacementUnit) return;
    
    let newValue = manualDisplacement;
    if (newUnit === Unit.METRIC) {
      newValue = manualDisplacement * CF_TO_LITERS;
    } else {
      newValue = manualDisplacement / CF_TO_LITERS;
    }
    
    setManualDisplacement(newValue);
    setDisplacementUnit(newUnit);
  };

  const handleApplyIdealFb = () => {
    if (boxType === BoxType.PORTED) {
      setPortSpecs(prev => ({ ...prev, targetFb: Math.round(tsTargets.portedFb) }));
    }
  };

  const handleAskGemini = async () => {
    setIsLoadingAdvice(true);
    setAiAdvice("");
    const advice = await getEnclosureAdvice(
      boxType, 
      results.netVolume, 
      unit, 
      subCount, 
      selectedSub.size
    );
    setAiAdvice(advice || "No advice available.");
    setIsLoadingAdvice(false);
  };

  const handleOptimizePort = async () => {
    if (boxType !== BoxType.PORTED || portSpecs.calculatedLength <= 0) return;
    setIsLoadingPortAdvice(true);
    setPortAdvice("");
    
    let area = 0;
    if (portSpecs.shape === PortShape.ROUND) area = Math.PI * Math.pow(portSpecs.diameter / 2, 2);
    else if (portSpecs.shape === PortShape.SQUARE) area = Math.pow(portSpecs.side, 2);
    else if (portSpecs.shape === PortShape.SLOT) area = portSpecs.width * portSpecs.height;

    const advice = await getPortOptimizationAdvice(
      portSpecs.calculatedLength,
      area * portSpecs.count,
      portSpecs.targetFb,
      results.portVelocity,
      unit
    );
    setPortAdvice(advice || "Port configuration seems standard.");
    setIsLoadingPortAdvice(false);
  };

  const reset = () => {
    const isM = unit === Unit.METRIC;
    setDimensions(isM ? { length: 60, width: 40, height: 35, thickness: 1.9 } : { length: 24, width: 15, height: 12, thickness: 0.75 });
    setSubCount(1);
    setBracing({ count: 0, length: isM ? 30 : 12, width: isM ? 2.5 : 1, height: isM ? 2.5 : 1 });
    setPortBraceDimensions({ count: 0, length: isM ? 30 : 10, width: isM ? 5 : 2, thickness: isM ? 1.9 : 0.75 });
    setMountingDisp(isM ? 0.5 : 0.02);
    setAiAdvice("");
    setPortAdvice("");
    setPortSpecs(prev => ({ ...prev, count: 1, endCorrection: 0.732, physicalDepth: 0 }));
  };

  // Project Management Functions
  const saveProject = () => {
    const newProject: SavedProject = {
      id: crypto.randomUUID(),
      name: projectName,
      timestamp: Date.now(),
      unit,
      boxType,
      dimensions,
      bracing,
      portBracing,
      mountingDisp,
      portSpecs,
      selectedSubId: selectedSub.id,
      subCount,
      manualDisplacement,
      displacementUnit
    };
    setSavedProjects(prev => [newProject, ...prev]);
    alert("Project saved successfully!");
  };

  const loadProject = (project: SavedProject) => {
    setUnit(project.unit);
    setBoxType(project.boxType);
    setDimensions(project.dimensions);
    setBracing(project.bracing);
    setPortBraceDimensions(project.portBracing);
    setMountingDisp(project.mountingDisp);
    setPortSpecs(project.portSpecs);
    setSubCount(project.subCount);
    setManualDisplacement(project.manualDisplacement);
    setDisplacementUnit(project.displacementUnit);
    
    const sub = STANDARD_SUBS.find(s => s.id === project.selectedSubId);
    if (sub) setSelectedSub(sub);
    
    setIsProjectsModalOpen(false);
    setProjectName(project.name);
  };

  const deleteProject = (id: string) => {
    if (window.confirm("Are you sure you want to delete this project?")) {
      setSavedProjects(prev => prev.filter(p => p.id !== id));
    }
  };

  const exportBuildReport = () => {
    const lUnit = isMetric ? "cm" : "in";
    const vUnit = isMetric ? "L" : "ft³";
    
    let report = `SUBBOX PRO BUILD REPORT: ${projectName}\n`;
    report += `==============================================\n`;
    report += `DATE: ${new Date().toLocaleString()}\n\n`;
    
    report += `SYSTEM SPECIFICATIONS\n`;
    report += `----------------------------------------------\n`;
    report += `Enclosure Type: ${boxType}\n`;
    report += `Subwoofer: ${subCount} x ${selectedSub.size}" (${selectedSub.id} Preset)\n`;
    report += `Net Internal Volume: ${results.netVolume.toFixed(2)} ${vUnit}\n`;
    report += `Gross Volume: ${results.grossVolume.toFixed(2)} ${vUnit}\n`;
    if (boxType === BoxType.PORTED) {
      report += `Tuning Frequency (Fb): ${portSpecs.targetFb} Hz\n`;
      report += `Port Area: ${portSpecs.count}x shape:${portSpecs.shape}\n`;
      report += `Port Length: ${portSpecs.calculatedLength.toFixed(2)} ${lUnit}\n`;
      report += `Peak Air Velocity: ${results.portVelocity.toFixed(1)} m/s\n`;
    }
    report += `\n`;
    
    report += `EXTERNAL DIMENSIONS\n`;
    report += `----------------------------------------------\n`;
    report += `Length: ${dimensions.length} ${lUnit}\n`;
    report += `Width: ${dimensions.width} ${lUnit}\n`;
    report += `Height: ${dimensions.height} ${lUnit}\n`;
    report += `Material Thickness: ${dimensions.thickness} ${lUnit}\n`;
    report += `\n`;
    
    report += `MASTER CUT LIST\n`;
    report += `----------------------------------------------\n`;
    cutSheet.forEach(panel => {
      report += `${panel.name}: ${panel.qty}x [ ${panel.dim} ${lUnit} ]\n`;
    });
    report += `\n`;
    
    report += `DISPLACEMENT DATA\n`;
    report += `----------------------------------------------\n`;
    report += `Drivers: ${results.subDisplacement.toFixed(3)} ${vUnit}\n`;
    report += `Bracing: ${results.bracingDisplacement.toFixed(3)} ${vUnit}\n`;
    report += `Port Assembly: ${results.portDisplacement.toFixed(3)} ${vUnit}\n`;
    report += `Hardware/Mounting: ${results.mountingDisplacement.toFixed(3)} ${vUnit}\n`;
    report += `\n`;
    
    report += `AI DESIGN ADVICE SUMMARY\n`;
    report += `----------------------------------------------\n`;
    report += aiAdvice || "No design advice was generated for this session.\n";
    report += `\n`;
    
    report += `==============================================\n`;
    report += `Report generated by SubBox Pro lab. (c) ${new Date().getFullYear()}\n`;

    const blob = new Blob([report], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Build_Report_${projectName.replace(/\s+/g, '_')}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const volUnitLabel = isMetric ? "Liters" : "ft³";
  const dispUnitLabel = isDispMetric ? "L" : "ft³";
  const lengthUnitLabel = isMetric ? "cm" : "in";

  // Refined Port Velocity Logic
  const velocityValue = results.portVelocity;
  const velocityStatus = velocityValue < 17 ? 'safe' : velocityValue < 26 ? 'warning' : 'danger';
  const velocityLabel = velocityStatus === 'safe' ? 'Laminar (SQ)' : velocityStatus === 'warning' ? 'Turbulent (High Output)' : 'Critical Chuffing';
  const velocityColor = velocityStatus === 'safe' ? 'text-cyan-400' : velocityStatus === 'warning' ? 'text-amber-500' : 'text-rose-500';
  const velocityBg = velocityStatus === 'safe' ? 'bg-cyan-500/5 border-cyan-500/10' : velocityStatus === 'warning' ? 'bg-amber-500/5 border-amber-500/10' : 'bg-rose-500/5 border-rose-500/10';
  const velocityBadge = velocityStatus === 'safe' ? 'bg-cyan-500/20 text-cyan-300' : velocityStatus === 'warning' ? 'bg-amber-500/20 text-amber-300' : 'bg-rose-500/20 text-rose-300';
  const velocityBarColor = velocityStatus === 'safe' ? 'bg-cyan-400' : velocityStatus === 'warning' ? 'bg-amber-500' : 'bg-rose-500 shadow-[0_0_15px_rgba(244,63,94,0.4)]';

  const needsPortBracing = portSpecs.calculatedLength > PORT_LENGTH_THRESHOLD;
  const maxInternalDim = Math.max(dimensions.length, dimensions.width, dimensions.height) - (2 * dimensions.thickness);
  const isPortTooLong = portSpecs.calculatedLength > maxInternalDim;
  
  const resonanceFreq = (unit === Unit.IMPERIAL ? 13500 : 34300) / (2 * portSpecs.calculatedLength);
  const isResonanceRisk = resonanceFreq < 220 && boxType === BoxType.PORTED;

  const fbMin = Math.round(customFs * 0.9);
  const fbMax = Math.round(customFs * 1.25);
  const isFbInOptimalRange = portSpecs.targetFb >= fbMin && portSpecs.targetFb <= fbMax;

  const getShapeIcon = (shape: PortShape) => {
    switch (shape) {
      case PortShape.ROUND: return <Circle className="w-3 h-3" />;
      case PortShape.SQUARE: return <Square className="w-3 h-3" />;
      case PortShape.SLOT: return <RectangleHorizontal className="w-3 h-3" />;
    }
  };

  const volDiff = results.netVolume - activeTargetVb;
  const volDiffPct = (results.netVolume / activeTargetVb) * 100;

  // Cut Sheet Logic (Standard 6-panel box)
  const cutSheet = useMemo(() => {
    const { length: L, width: W, height: H, thickness: T } = dimensions;
    if (L <= 0 || W <= 0 || H <= 0 || T <= 0) return [];

    return [
      { name: "Top / Bottom", qty: 2, dim: `${L.toFixed(2)} x ${W.toFixed(2)}` },
      { name: "Front / Back", qty: 2, dim: `${L.toFixed(2)} x ${(H - 2 * T).toFixed(2)}` },
      { name: "Left / Right Sides", qty: 2, dim: `${(W - 2 * T).toFixed(2)} x ${(H - 2 * T).toFixed(2)}` }
    ];
  }, [dimensions]);

  return (
    <div className="min-h-screen bg-[#0a0f1e] text-slate-100 font-sans p-4 md:p-8 selection:bg-indigo-500/30">
      {/* Projects Modal */}
      {isProjectsModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setIsProjectsModalOpen(false)}></div>
          <div className="relative w-full max-w-2xl bg-slate-900 border border-white/10 rounded-[3rem] p-8 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-3">
                <FolderHeart className="w-6 h-6 text-indigo-400" />
                <h2 className="text-2xl font-black">Project Vault</h2>
              </div>
              <button onClick={() => setIsProjectsModalOpen(false)} className="p-2 hover:bg-white/5 rounded-full transition-colors">
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
              {savedProjects.length === 0 ? (
                <div className="text-center py-12 text-slate-500 italic">No saved projects found. Spec one out and save it!</div>
              ) : (
                savedProjects.map(project => (
                  <div key={project.id} className="group bg-black/20 border border-white/5 p-6 rounded-3xl flex items-center justify-between hover:border-indigo-500/30 transition-all">
                    <div>
                      <h3 className="text-lg font-black text-slate-100 mb-1">{project.name}</h3>
                      <p className="text-[10px] font-black uppercase text-slate-500 tracking-widest">
                        {project.boxType} &bull; {project.subCount} Subs &bull; {new Date(project.timestamp).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={() => loadProject(project)}
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-black uppercase rounded-xl transition-all shadow-lg shadow-indigo-600/20"
                      >
                        Load
                      </button>
                      <button 
                        onClick={() => deleteProject(project.id)}
                        className="p-2 text-rose-500 hover:bg-rose-500/10 rounded-xl transition-all"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      <header className="max-w-7xl mx-auto mb-10 flex flex-col md:flex-row items-center justify-between gap-6 border-b border-white/5 pb-8">
        <div className="flex items-center gap-4 group">
          <div className="bg-indigo-600 p-4 rounded-3xl shadow-[0_0_20px_rgba(79,70,229,0.3)] transition-transform group-hover:scale-105 duration-300">
            <Volume2 className="w-8 h-8 text-white" />
          </div>
          <div>
            <h1 className="text-4xl font-black tracking-tight bg-gradient-to-br from-white via-slate-200 to-slate-500 bg-clip-text text-transparent">
              SUBBOX PRO
            </h1>
            <p className="text-indigo-400/60 text-xs font-black uppercase tracking-[0.2em] mt-1">Advanced Audio Enclosure Lab</p>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
           <div className="flex items-center gap-2 bg-slate-900/40 p-1.5 rounded-2xl border border-white/5 backdrop-blur-xl">
            <button 
              onClick={() => { setUnit(Unit.IMPERIAL); reset(); }}
              className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${unit === Unit.IMPERIAL ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-600/20' : 'text-slate-500 hover:text-slate-300'}`}
            >
              Imperial (In)
            </button>
            <button 
              onClick={() => { setUnit(Unit.METRIC); reset(); }}
              className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${unit === Unit.METRIC ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-600/20' : 'text-slate-500 hover:text-slate-300'}`}
            >
              Metric (Cm)
            </button>
          </div>
          <button 
            onClick={() => setIsProjectsModalOpen(true)}
            className="p-4 bg-slate-900 border border-white/10 rounded-2xl text-slate-400 hover:text-indigo-400 transition-all hover:scale-105 relative"
          >
            <FolderHeart className="w-6 h-6" />
            {savedProjects.length > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-rose-500 text-white text-[8px] font-black flex items-center justify-center rounded-full ring-2 ring-slate-900">
                {savedProjects.length}
              </span>
            )}
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <div className="lg:col-span-6 space-y-8">
          {/* Box & Driver Specifications Card */}
          <section className="bg-slate-900/40 rounded-[2.5rem] p-8 border border-white/5 shadow-2xl backdrop-blur-2xl relative overflow-hidden ring-1 ring-white/5">
            <div className="absolute top-0 right-0 p-12 opacity-5 pointer-events-none">
              <Microchip className="w-48 h-48" />
            </div>

            <div className="flex items-center justify-between mb-8">
               <div className="flex items-center gap-3">
                 <div className="bg-indigo-500/10 p-2 rounded-xl">
                   <Settings2 className="w-5 h-5 text-indigo-400" />
                 </div>
                 <h2 className="text-xl font-black tracking-tight">System Specification</h2>
               </div>
               <div className="flex items-center gap-2 px-4 py-1.5 bg-indigo-500/10 rounded-full border border-indigo-500/20">
                 <Scale className="w-3.5 h-3.5 text-indigo-400" />
                 <span className="text-[10px] font-black text-indigo-300 uppercase tracking-tighter">Target Vb: {activeTargetVb.toFixed(2)}</span>
               </div>
            </div>

            <div className="mb-8 space-y-2">
               <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Project Name</label>
               <div className="flex gap-2">
                  <input 
                    type="text" 
                    value={projectName} 
                    onChange={(e) => setProjectName(e.target.value)}
                    className="flex-1 bg-[#0c1224] border border-white/10 rounded-2xl px-5 py-3.5 font-bold text-slate-100 outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
                  />
                  <button 
                    onClick={saveProject}
                    className="p-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl transition-all shadow-xl shadow-indigo-600/20"
                    title="Save Project"
                  >
                    <Save className="w-5 h-5" />
                  </button>
               </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-8">
              <button 
                onClick={() => setBoxType(BoxType.SEALED)}
                className={`group flex flex-col items-center justify-center p-5 rounded-3xl border-2 transition-all duration-300 ${boxType === BoxType.SEALED ? 'border-indigo-500 bg-indigo-500/10 shadow-[0_0_20px_rgba(79,70,229,0.1)]' : 'border-white/5 hover:border-white/10 bg-white/5'}`}
              >
                <Package className={`w-6 h-6 mb-2 transition-colors ${boxType === BoxType.SEALED ? 'text-indigo-400' : 'text-slate-500 group-hover:text-slate-300'}`} />
                <span className={`font-black uppercase text-[10px] tracking-widest ${boxType === BoxType.SEALED ? 'text-indigo-300' : 'text-slate-500'}`}>Sealed</span>
              </button>
              <button 
                onClick={() => setBoxType(BoxType.PORTED)}
                className={`group flex flex-col items-center justify-center p-5 rounded-3xl border-2 transition-all duration-300 ${boxType === BoxType.PORTED ? 'border-indigo-500 bg-indigo-500/10 shadow-[0_0_20_rgba(79,70,229,0.1)]' : 'border-white/5 hover:border-white/10 bg-white/5'}`}
              >
                <RotateCcw className={`w-6 h-6 mb-2 transition-colors ${boxType === BoxType.PORTED ? 'text-indigo-400' : 'text-slate-500 group-hover:text-slate-300'}`} />
                <span className={`font-black uppercase text-[10px] tracking-widest ${boxType === BoxType.PORTED ? 'text-indigo-300' : 'text-slate-500'}`}>Ported</span>
              </button>
            </div>

            <div className="mb-10">
              <div className="flex items-center gap-2 mb-4 ml-1">
                <Target className="w-3 h-3 text-indigo-400" />
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.15em]">Quick Driver Preset</label>
              </div>
              <div className="grid grid-cols-5 md:grid-cols-9 gap-2">
                {STANDARD_SUBS.map(sub => (
                  <button 
                    key={sub.id}
                    onClick={() => setSelectedSub(sub)}
                    className={`p-2.5 rounded-xl border transition-all duration-300 text-center ${selectedSub.id === sub.id ? 'bg-indigo-600 border-indigo-400 text-white shadow-lg shadow-indigo-600/30 scale-105' : 'bg-white/5 border-white/5 text-slate-400 hover:bg-white/10 hover:border-white/20'}`}
                  >
                    <p className="text-xs font-black">{sub.size}"</p>
                  </button>
                ))}
              </div>
            </div>

            <div className="mb-10 space-y-6">
              <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-indigo-400" />
                  <h3 className="text-xs font-black text-slate-300 uppercase tracking-widest">Thiele/Small Parameters</h3>
                </div>
                <div className={`text-[9px] font-black uppercase px-2 py-0.5 rounded border ${ebp > 90 ? 'bg-indigo-500/10 border-indigo-500/30 text-indigo-300' : 'bg-amber-500/10 border-amber-500/30 text-amber-300'}`}>
                   EBP: {ebp.toFixed(1)}
                </div>
              </div>
              
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3 p-6 bg-[#0c1224] rounded-3xl border border-white/5">
                <TSInput label="Fs (Hz)" value={customFs} unit="" onChange={(v) => setCustomFs(v)} />
                <TSInput label="Qts" value={customQts} unit="" onChange={(v) => setCustomQts(v)} />
                <TSInput label="Vas (L)" value={customVas} unit="" onChange={(v) => setCustomVas(v)} />
                <TSInput label="Qes" value={customQes} unit="" onChange={(v) => setCustomQes(v)} />
                <TSInput label="Qms" value={customQms} unit="" onChange={(v) => setCustomQms(v)} />
                <TSInput label="Xmax (mm)" value={customXmax} unit="" onChange={(v) => setCustomXmax(v)} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Quantity</label>
                  <div className="relative">
                    <input 
                      type="number" 
                      value={subCount} 
                      onChange={(e) => setSubCount(parseInt(e.target.value) || 1)}
                      className="w-full bg-[#0c1224] border border-white/10 rounded-2xl px-5 py-3 font-mono font-bold text-indigo-100 outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
                    />
                    <Dna className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600 pointer-events-none" />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Sub Displacement</label>
                  <div className="flex flex-col bg-[#0c1224] border border-white/10 rounded-2xl p-1 gap-1">
                    <input 
                      type="number" 
                      step="0.001"
                      value={manualDisplacement} 
                      onChange={(e) => setManualDisplacement(parseFloat(e.target.value) || 0)}
                      className="w-full bg-transparent px-4 py-3 text-lg text-center focus:outline-none font-mono text-indigo-300 font-bold"
                    />
                    <div className="flex gap-1 p-1 bg-black/40 rounded-xl border border-white/5">
                      <button 
                        onClick={() => handleDisplacementUnitChange(Unit.IMPERIAL)}
                        className={`flex-1 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all ${displacementUnit === Unit.IMPERIAL ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-600 hover:text-slate-400'}`}
                      >
                        ft³
                      </button>
                      <button 
                        onClick={() => handleDisplacementUnitChange(Unit.METRIC)}
                        className={`flex-1 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all ${displacementUnit === Unit.METRIC ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-600 hover:text-slate-400'}`}
                      >
                        Liters
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-2">
                  <Maximize className="w-4 h-4 text-indigo-400" />
                  <h3 className="text-xs font-black text-slate-300 uppercase tracking-widest">Enclosure Geometry</h3>
                </div>
                <button 
                  onClick={() => setShowCutSheet(!showCutSheet)}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-[9px] font-black uppercase transition-all ${showCutSheet ? 'bg-indigo-600 text-white' : 'bg-white/5 text-slate-500 hover:text-slate-300 border border-white/5'}`}
                >
                  <Scissors className="w-3 h-3" /> {showCutSheet ? 'Hide Cut Sheet' : 'Show Cut Sheet'}
                </button>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <InputGroup label={`Length (${lengthUnitLabel})`} name="length" value={dimensions.length} onChange={handleInputChange} />
                <InputGroup label={`Width (${lengthUnitLabel})`} name="width" value={dimensions.width} onChange={handleInputChange} />
                <InputGroup label={`Height (${lengthUnitLabel})`} name="height" value={dimensions.height} onChange={handleInputChange} />
                <InputGroup label={`Material (${lengthUnitLabel})`} name="thickness" value={dimensions.thickness} onChange={handleInputChange} />
              </div>

              {showCutSheet && (
                <div className="mt-4 p-5 bg-indigo-500/5 rounded-3xl border border-indigo-500/10 animate-in fade-in slide-in-from-top-2 duration-300">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <ClipboardList className="w-4 h-4 text-indigo-400" />
                      <h4 className="text-[10px] font-black text-indigo-300 uppercase tracking-[0.2em]">Master Cut List</h4>
                    </div>
                    <button 
                      onClick={exportBuildReport}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-[9px] font-black uppercase transition-all shadow-lg shadow-emerald-600/20"
                    >
                      <FileDown className="w-3.5 h-3.5" /> Export Build Report
                    </button>
                  </div>
                  <div className="space-y-3">
                    {cutSheet.map((panel, idx) => (
                      <div key={idx} className="flex items-center justify-between p-3 bg-black/20 rounded-2xl border border-white/5">
                        <div className="flex flex-col">
                          <span className="text-[10px] font-black text-slate-400 uppercase">{panel.name}</span>
                          <span className="text-sm font-mono font-bold text-slate-200">{panel.dim} <span className="text-[10px] text-slate-600 font-bold">{lengthUnitLabel}</span></span>
                        </div>
                        <div className="bg-indigo-600/20 px-3 py-1.5 rounded-xl border border-indigo-600/30">
                          <span className="text-xs font-black text-indigo-400">x{panel.qty}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                  <p className="mt-4 text-[8px] text-slate-600 font-bold uppercase tracking-widest text-center italic">
                    Assumes top/bottom cap construction.
                  </p>
                </div>
              )}
            </div>

            <div className="mt-10 pt-8 border-t border-white/5 space-y-6">
              <div className="flex items-center gap-3">
                <Boxes className="w-5 h-5 text-emerald-400" />
                <h3 className="text-sm font-black text-slate-200 uppercase tracking-[0.1em]">Internal Hardware</h3>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <InputGroup label="Braces" name="count" value={bracing.count} onChange={handleBracingChange} />
                <InputGroup label="Brace W" name="width" value={bracing.width} onChange={handleBracingChange} />
                <div className="space-y-2">
                  <label className="block text-[10px] font-black text-slate-500 uppercase ml-1">Mount Disp.</label>
                  <input 
                    type="number"
                    step="0.01"
                    value={mountingDisp}
                    onChange={(e) => setMountingDisp(parseFloat(e.target.value) || 0)}
                    className="w-full bg-[#0c1224] border border-white/10 rounded-2xl px-4 py-3 font-mono text-xs font-bold text-emerald-300 outline-none focus:ring-2 focus:ring-emerald-500/30"
                  />
                </div>
              </div>
            </div>
          </section>

          <BoxVisualizer 
            length={dimensions.length} 
            width={dimensions.width} 
            height={dimensions.height} 
            type={boxType} 
            portShape={portSpecs.shape}
            portLength={portSpecs.calculatedLength}
            diameter={portSpecs.diameter}
            side={portSpecs.side}
            portWidth={portSpecs.width}
            portHeight={portSpecs.height}
            unit={unit}
          />
        </div>

        <div className="lg:col-span-6 space-y-8">
          <section className="bg-gradient-to-br from-indigo-600 to-indigo-800 rounded-[3rem] p-10 shadow-2xl shadow-indigo-900/40 relative overflow-hidden group transition-all duration-500">
            <div className="absolute top-0 right-0 p-12 opacity-10 group-hover:scale-110 transition-transform duration-700">
              <Calculator className="w-40 h-40 text-white" />
            </div>
            
            <div className="relative z-10">
              <div className="flex items-center gap-4 mb-2">
                <h2 className="text-indigo-100 font-black uppercase tracking-[0.2em] text-[10px]">Calculated Net Volume</h2>
                <div className="flex items-center gap-1.5 px-3 py-1 bg-white/10 rounded-full border border-white/20 backdrop-blur-md">
                  <Target className="w-3 h-3 text-white" />
                  <span className="text-[9px] font-black text-white uppercase tracking-tighter">Ideal: {activeTargetVb.toFixed(2)} {volUnitLabel}</span>
                </div>
              </div>
              
              <div className="flex items-baseline gap-4 mb-10">
                <span className="text-8xl font-black text-white drop-shadow-2xl">{results.netVolume.toFixed(2)}</span>
                <span className="text-3xl font-bold text-indigo-100/60 uppercase">{volUnitLabel}</span>
                
                <div className="ml-auto flex flex-col items-end gap-1">
                  <div className={`text-[11px] font-black uppercase px-4 py-1.5 rounded-2xl shadow-lg transition-all duration-500 ${Math.abs(volDiffPct - 100) < 5 ? 'bg-emerald-400 text-[#0a0f1e]' : 'bg-white/20 text-white backdrop-blur-xl'}`}>
                    {volDiffPct.toFixed(0)}% Match
                  </div>
                  <span className="text-[10px] font-black text-indigo-100/40 tracking-widest mt-1">
                    {volDiff > 0 ? `+${volDiff.toFixed(2)} Over` : `${volDiff.toFixed(2)} Under`}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <ResultCard label="Gross" value={results.grossVolume.toFixed(2)} unit={volUnitLabel} icon={<Layers className="w-3.5 h-3.5" />} />
                <ResultCard label="Driver" value={results.subDisplacement.toFixed(2)} unit={volUnitLabel} icon={<Cpu className="w-3.5 h-3.5" />} />
                <ResultCard label="Structural" value={results.bracingDisplacement.toFixed(2)} unit={volUnitLabel} icon={<Boxes className="w-3.5 h-3.5" />} />
                <ResultCard label="Port Unit" value={(results.portDisplacement).toFixed(2)} unit={volUnitLabel} icon={<Wind className="w-3.5 h-3.5" />} />
              </div>
            </div>
          </section>

          {boxType === BoxType.PORTED && (
            <section className="bg-slate-900/40 p-8 rounded-[2.5rem] border border-white/5 shadow-2xl space-y-8 backdrop-blur-xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="bg-indigo-500/10 p-2 rounded-xl">
                    <Wind className="w-5 h-5 text-indigo-400" />
                  </div>
                  <h2 className="text-xl font-black tracking-tight">Port Engineering</h2>
                </div>
                <div className="flex gap-1.5 bg-black/40 p-1.5 rounded-2xl border border-white/5">
                  {Object.values(PortShape).map(s => (
                    <button 
                      key={s}
                      onClick={() => setPortSpecs(prev => ({ ...prev, shape: s }))}
                      className={`px-4 py-2 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${portSpecs.shape === s ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
                    >
                      {getShapeIcon(s)}
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div className="col-span-2 space-y-3">
                   <div className="flex items-center justify-between ml-1">
                     <div className="flex items-center gap-2 group/fbtool">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Tuning Frequency (Fb)</label>
                        <div className="relative">
                          <HelpCircle className="w-3.5 h-3.5 text-slate-600 cursor-help hover:text-indigo-400 transition-colors" />
                          <div className="absolute bottom-full left-0 mb-3 w-72 p-5 bg-slate-900 border border-white/10 rounded-2xl text-[10px] text-slate-300 shadow-2xl opacity-0 invisible group-hover/fbtool:opacity-100 group-hover/fbtool:visible transition-all z-50 pointer-events-none leading-relaxed ring-1 ring-white/10">
                            <p className="font-black text-white uppercase tracking-tighter flex items-center gap-2 mb-2">
                              <Waves className="w-3 h-3 text-indigo-400" /> Acoustic Tuning Lab
                            </p>
                            <div className="space-y-3">
                              <div className="p-2 bg-indigo-500/10 rounded-lg border border-indigo-500/20">
                                <p className="font-bold text-indigo-300 mb-1 uppercase tracking-tighter">Recommended Range:</p>
                                <p className="text-sm font-black text-white">{fbMin} - {fbMax} Hz</p>
                              </div>
                              <p className="text-slate-400 leading-relaxed">
                                Tuning too high above Fs can lead to poor low-end extension and high-frequency "boominess". 
                                Tuning too low below Fs risks mechanical damage (unloading) and sluggish transient response.
                              </p>
                            </div>
                          </div>
                        </div>
                     </div>
                     <button 
                        onClick={handleApplyIdealFb}
                        className="flex items-center gap-1.5 px-3 py-1 bg-indigo-500/10 text-indigo-400 rounded-lg hover:bg-indigo-600 hover:text-white transition-all text-[9px] font-black uppercase"
                      >
                        <Wand2 className="w-3 h-3" /> Auto-Tune: {tsTargets.portedFb.toFixed(0)}Hz
                      </button>
                   </div>
                   <div className="relative">
                      <input 
                        type="number"
                        name="targetFb"
                        value={portSpecs.targetFb}
                        onChange={handlePortChange}
                        className="w-full bg-[#0c1224] border border-white/10 rounded-2xl px-6 py-4 font-mono font-bold text-indigo-100 text-lg outline-none focus:ring-2 focus:ring-indigo-500/50"
                      />
                      <div className="absolute right-6 top-1/2 -translate-y-1/2 flex items-center gap-2">
                        <Music4 className={`w-4 h-4 ${isFbInOptimalRange ? 'text-emerald-400' : 'text-slate-500'}`} />
                        <span className={`text-[10px] font-black uppercase ${isFbInOptimalRange ? 'text-emerald-400' : 'text-slate-500'}`}>{isFbInOptimalRange ? 'Optimal' : 'Caution'}</span>
                      </div>
                   </div>
                </div>
                
                <div className="col-span-1">
                  <InputGroup label="Port Quantity" name="count" value={portSpecs.count} onChange={handlePortChange} />
                </div>

                <div className="col-span-1 space-y-2 group/ktool relative">
                   <div className="flex items-center justify-between ml-1">
                     <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">End Correction (k)</label>
                     <div className="relative">
                        <HelpCircle className="w-3 h-3 text-slate-600 cursor-help hover:text-indigo-400 transition-colors" />
                        <div className="absolute bottom-full right-0 mb-3 w-64 p-5 bg-slate-900 border border-white/10 rounded-2xl text-[10px] text-slate-300 shadow-2xl opacity-0 invisible group-hover/ktool:opacity-100 group-hover/ktool:visible transition-all z-50 pointer-events-none leading-relaxed ring-1 ring-white/10">
                           <p className="font-black text-white uppercase tracking-tighter flex items-center gap-2 mb-2">
                             <CornerDownRight className="w-3 h-3 text-indigo-400" /> Boundary Conditions
                           </p>
                           <ul className="space-y-2 font-mono">
                             <li className="flex justify-between border-b border-white/5 pb-1"><span>0.613</span> <span className="text-slate-500">Free/Flared</span></li>
                             <li className="flex justify-between border-b border-white/5 pb-1"><span>0.732</span> <span className="text-indigo-400">1-Flanged</span></li>
                             <li className="flex justify-between"><span>0.850</span> <span className="text-slate-500">2-Flanged</span></li>
                           </ul>
                        </div>
                     </div>
                   </div>
                   <input 
                      type="number"
                      step="0.001"
                      name="endCorrection"
                      value={portSpecs.endCorrection}
                      onChange={handlePortChange}
                      className="w-full bg-[#0c1224] border border-white/10 rounded-2xl px-5 py-3.5 font-mono font-bold text-indigo-100 outline-none focus:ring-2 focus:ring-indigo-500/50"
                   />
                </div>
                
                {portSpecs.shape === PortShape.ROUND && (
                  <div className="col-span-2">
                    <InputGroup label={`Port Diameter (${lengthUnitLabel})`} name="diameter" value={portSpecs.diameter} onChange={handlePortChange} />
                  </div>
                )}
                
                {portSpecs.shape === PortShape.SQUARE && (
                  <div className="col-span-2">
                    <InputGroup label={`Side Length (${lengthUnitLabel})`} name="side" value={portSpecs.side} onChange={handlePortChange} />
                  </div>
                )}

                {portSpecs.shape === PortShape.SLOT && (
                  <>
                    <div className="col-span-1">
                      <InputGroup label={`Slot Width (${lengthUnitLabel})`} name="width" value={portSpecs.width} onChange={handlePortChange} />
                    </div>
                    <div className="col-span-1">
                      <InputGroup label={`Slot Height (${lengthUnitLabel})`} name="height" value={portSpecs.height} onChange={handlePortChange} />
                    </div>
                  </>
                )}

                <div className="col-span-2 space-y-2">
                   <div className="flex items-center justify-between ml-1">
                     <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Physical Depth (Displacement Override)</label>
                     <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded text-[8px] font-black uppercase transition-all ${portSpecs.physicalDepth > 0 ? 'bg-amber-500/20 text-amber-400' : 'bg-indigo-500/20 text-indigo-400'}`}>
                        {portSpecs.physicalDepth > 0 ? <Unlock className="w-2.5 h-2.5" /> : <Lock className="w-2.5 h-2.5" />}
                        {portSpecs.physicalDepth > 0 ? 'Manual Overridden' : 'Locked to Calculated'}
                     </div>
                   </div>
                   <div className="relative">
                      <input 
                        type="number"
                        step="0.01"
                        name="physicalDepth"
                        placeholder={`${portSpecs.calculatedLength.toFixed(2)}`}
                        value={portSpecs.physicalDepth === 0 ? "" : portSpecs.physicalDepth}
                        onChange={handlePortChange}
                        className={`w-full bg-[#0c1224] border border-white/10 rounded-2xl px-5 py-3.5 focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all font-mono font-bold text-indigo-100 ${portSpecs.physicalDepth > 0 ? 'border-amber-500/30' : ''}`}
                      />
                      <p className="text-[9px] font-bold text-slate-500 uppercase tracking-tight mt-1.5 ml-1 flex items-center gap-1">
                        <MoveHorizontal className="w-2.5 h-2.5" />
                        Enter 0 to use the calculated {portSpecs.calculatedLength.toFixed(1)}{lengthUnitLabel} for displacement.
                      </p>
                   </div>
                </div>
              </div>

              <div className={`p-6 rounded-[2rem] border-2 border-dashed transition-all duration-700 space-y-5 relative group/velocity ${velocityBg}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <HelpCircle className="w-5 h-5 text-slate-500 cursor-help hover:text-indigo-400 transition-colors" />
                      <div className="absolute bottom-full left-0 mb-4 w-80 p-6 bg-slate-900 border border-white/10 rounded-3xl text-xs text-slate-300 shadow-[0_20px_50px_rgba(0,0,0,0.5)] opacity-0 invisible group-hover/velocity:opacity-100 group-hover/velocity:visible transition-all z-50 pointer-events-none leading-relaxed ring-1 ring-white/10">
                        <div className="flex items-center gap-2 mb-4">
                          <Gauge className="w-4 h-4 text-indigo-400" />
                          <p className="font-black text-white uppercase tracking-tighter">Port Air Velocity Guide</p>
                        </div>
                        <div className="space-y-4">
                          <div className="space-y-2">
                            <p className="flex justify-between items-center"><strong className="text-cyan-400">0 - 17 m/s (SAFE)</strong> <span className="text-[9px] bg-cyan-500/20 text-cyan-300 px-1.5 py-0.5 rounded uppercase">Ideal</span></p>
                          </div>
                          <div className="space-y-2 border-t border-white/5 pt-3">
                            <p className="flex justify-between items-center"><strong className="text-amber-500">17 - 26 m/s (WARNING)</strong> <span className="text-[9px] bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded uppercase">Daily</span></p>
                          </div>
                          <div className="space-y-2 border-t border-white/5 pt-3">
                            <p className="flex justify-between items-center"><strong className="text-rose-500">26+ m/s (DANGER)</strong> <span className="text-[9px] bg-rose-500/20 text-rose-300 px-1.5 py-0.5 rounded uppercase">Critical</span></p>
                          </div>
                        </div>
                      </div>
                    </div>
                    <span className={`text-xs font-black uppercase tracking-[0.2em] transition-colors duration-700 ${velocityColor}`}>Air Velocity Analysis</span>
                  </div>
                  <div className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider transition-all duration-700 shadow-sm ${velocityBadge}`}>
                    {velocityLabel}
                  </div>
                </div>

                <div className="flex items-end justify-between">
                  <div className="space-y-1">
                    <span className={`text-4xl font-black transition-colors duration-700 ${velocityColor}`}>{velocityValue.toFixed(1)}</span>
                    <span className="text-sm font-black text-slate-500 ml-2 uppercase">m/s</span>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Mach Speed</p>
                    <p className="text-xs font-mono font-bold text-slate-400">{(velocityValue / 343).toFixed(3)}</p>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <div className="h-3 w-full bg-black/40 rounded-full overflow-hidden relative border border-white/5">
                    <div className="absolute top-0 bottom-0 left-[48.5%] w-0.5 bg-white/20 z-10" title="17 m/s Threshold" />
                    <div className="absolute top-0 bottom-0 left-[74.2%] w-0.5 bg-white/20 z-10" title="26 m/s Threshold" />
                    <div className="absolute right-0 top-0 bottom-0 w-[25.8%] bg-rose-500/10 border-l border-rose-500/20" />
                    <div 
                      className={`h-full transition-all duration-1000 ease-out rounded-full ${velocityBarColor}`} 
                      style={{ width: `${Math.min(100, (velocityValue / 35) * 100)}%` }}
                    />
                  </div>
                </div>
              </div>

              <div className={`p-8 rounded-[2rem] border transition-all duration-700 relative overflow-hidden flex flex-col gap-6 ${isPortTooLong || isResonanceRisk ? 'bg-rose-500/5 border-rose-500/20' : 'bg-indigo-500/5 border-indigo-500/20'}`}>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.2em]">Required Component Length</p>
                      {isResonanceRisk && (
                        <div className="flex items-center gap-1.5 px-2 py-0.5 bg-rose-500/20 text-rose-400 rounded-lg border border-rose-500/30">
                          <ZapOff className="w-2.5 h-2.5" />
                          <span className="text-[8px] font-black uppercase">Resonance Risk: {resonanceFreq.toFixed(0)}Hz</span>
                        </div>
                      )}
                    </div>
                    <div className="flex items-baseline gap-3">
                      <span className={`text-5xl font-black tracking-tighter transition-colors duration-700 ${isPortTooLong ? 'text-rose-500' : 'text-indigo-100'}`}>{portSpecs.calculatedLength.toFixed(2)}</span>
                      <span className={`text-xl font-bold uppercase transition-colors duration-700 ${isPortTooLong ? 'text-rose-500/60' : 'text-indigo-500'}`}>{lengthUnitLabel}</span>
                    </div>
                  </div>
                  <button 
                    onClick={handleOptimizePort}
                    disabled={isLoadingPortAdvice || portSpecs.calculatedLength <= 0}
                    className="flex flex-col items-center justify-center p-4 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-20 rounded-2xl transition-all shadow-xl shadow-indigo-600/20 group/opt"
                  >
                    <ShieldCheck className="w-5 h-5 text-white mb-1 group-hover/opt:scale-110 transition-transform" />
                    <span className="text-[8px] font-black uppercase tracking-widest text-white">Optimize Port</span>
                  </button>
                </div>

                {isResonanceRisk && !portAdvice && !isLoadingPortAdvice && (
                  <div className="p-4 bg-amber-500/10 rounded-xl border border-amber-500/20 flex items-start gap-3 animate-pulse">
                    <Sparkles className="w-4 h-4 text-amber-400 mt-0.5" />
                    <p className="text-[9px] font-black text-amber-200/80 uppercase leading-relaxed tracking-wider">
                      Length detected prone to standing waves. <br/> Suggestion: Use "Optimize Port" for AI-driven pipe organ resonance mitigation advice.
                    </p>
                  </div>
                )}

                {(isLoadingPortAdvice || portAdvice) && (
                  <div className="mt-2 p-5 bg-black/40 rounded-2xl border border-white/5 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="flex items-center gap-2 mb-3">
                      <Wand2 className="w-3.5 h-3.5 text-amber-400" />
                      <h4 className="text-[10px] font-black text-amber-200 uppercase tracking-widest">Acoustic Optimization Advice</h4>
                    </div>
                    {isLoadingPortAdvice ? (
                      <div className="flex items-center gap-3 py-2">
                        <RefreshCw className="w-3 h-3 text-indigo-400 animate-spin" />
                        <span className="text-[9px] font-black uppercase text-indigo-300 animate-pulse">Analyzing port resonance & flares...</span>
                      </div>
                    ) : (
                      <p className="text-xs text-slate-300 leading-relaxed font-medium italic">
                        {portAdvice}
                      </p>
                    )}
                  </div>
                )}

                {isPortTooLong && (
                  <div className="flex items-center gap-2 text-rose-500 p-3 bg-rose-500/10 rounded-xl border border-rose-500/20">
                    <AlertTriangle className="w-4 h-4" />
                    <span className="text-[10px] font-black uppercase tracking-tight">Warning: Port length exceeds available internal depth ({dimensions.width} {lengthUnitLabel}).</span>
                  </div>
                )}
              </div>
            </section>
          )}

          <section className="bg-slate-900/40 p-8 rounded-[2.5rem] border border-white/5 shadow-2xl backdrop-blur-xl">
             <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                  <div className="bg-amber-500/10 p-2 rounded-xl">
                    <Sparkles className="w-5 h-5 text-amber-400" />
                  </div>
                  <h2 className="text-xl font-black tracking-tight text-amber-100">Engineering Analysis</h2>
                </div>
                <button 
                  onClick={handleAskGemini}
                  disabled={isLoadingAdvice || !results.isStable}
                  className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-30 disabled:cursor-not-allowed text-xs font-black uppercase tracking-widest px-8 py-3.5 rounded-2xl transition-all flex items-center gap-3 shadow-xl shadow-indigo-600/20"
                >
                  {isLoadingAdvice ? 'Processing...' : 'Deploy AI Agent'}
                </button>
             </div>

             <div className="bg-black/30 rounded-[2rem] p-8 min-h-[180px] border border-white/5 relative group">
                {!aiAdvice && !isLoadingAdvice && (
                  <div className="flex flex-col items-center justify-center text-slate-600 h-full py-10 text-center space-y-4">
                    <Info className="w-12 h-12 mb-2 opacity-10 group-hover:opacity-20 transition-opacity" />
                    <p className="max-w-xs text-xs font-bold uppercase tracking-widest leading-relaxed opacity-40">Awaiting enclosure specification for real-time acoustic validation.</p>
                  </div>
                )}
                
                {isLoadingAdvice && (
                  <div className="flex flex-col items-center justify-center gap-6 py-12">
                    <div className="relative">
                      <div className="w-12 h-12 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin"></div>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <Cpu className="w-4 h-4 text-indigo-400 animate-pulse" />
                      </div>
                    </div>
                    <p className="text-[10px] font-black uppercase tracking-[0.3em] text-indigo-400 animate-pulse">Synthesizing Acoustic Data...</p>
                  </div>
                )}

                {aiAdvice && (
                  <div className="prose prose-invert prose-sm max-w-none animate-in fade-in zoom-in duration-500">
                    <p className="whitespace-pre-line text-slate-300 leading-relaxed font-medium italic text-base">
                      {aiAdvice}
                    </p>
                  </div>
                )}
             </div>
          </section>
        </div>
      </main>
      
      <footer className="max-w-7xl mx-auto mt-16 pt-10 border-t border-white/5 text-center text-slate-600 text-[10px] uppercase font-black tracking-[0.4em] opacity-40 hover:opacity-100 transition-opacity duration-500">
        <p>&copy; {new Date().getFullYear()} SubBox Pro Lab &bull; Silicon Valley Engineering &bull; Neural Enclosure Synthesis</p>
      </footer>
    </div>
  );
};

const InputGroup: React.FC<{
  label: string;
  name: string;
  value: number;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}> = ({ label, name, value, onChange }) => (
  <div className="group">
    <label className="block text-[10px] font-black text-slate-500 group-focus-within:text-indigo-400 uppercase tracking-widest mb-2 ml-1 transition-colors">{label}</label>
    <input 
      type="number"
      step="0.01"
      name={name}
      value={value === 0 ? "" : value}
      onChange={onChange}
      placeholder="0.00"
      className="w-full bg-[#0c1224] border border-white/10 rounded-2xl px-5 py-3.5 focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 focus:bg-[#0e162b] outline-none transition-all font-mono font-bold text-indigo-100 placeholder:text-slate-700"
    />
  </div>
);

const TSInput: React.FC<{
  label: string;
  value: number;
  unit: string;
  onChange: (v: number) => void;
}> = ({ label, value, unit, onChange }) => (
  <div className="flex flex-col gap-2">
    <span className="text-[9px] font-black text-slate-500 uppercase tracking-tighter ml-1 truncate">{label}</span>
    <div className="relative">
      <input 
        type="number"
        step="0.01"
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        className="w-full bg-[#141d33] border border-white/5 rounded-xl pl-3 pr-2 py-2 text-xs font-bold font-mono focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500/50 outline-none transition-all text-slate-200"
      />
      {unit && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[8px] font-black text-slate-600 uppercase pointer-events-none">{unit}</span>}
    </div>
  </div>
);

const ResultCard: React.FC<{
  label: string;
  value: string;
  unit: string;
  icon: React.ReactNode;
}> = ({ label, value, unit, icon }) => (
  <div className="bg-white/5 backdrop-blur-xl rounded-2xl p-4 border border-white/5 flex flex-col justify-center transition-transform hover:scale-105 duration-300">
    <div className="flex items-center gap-2 text-indigo-200 mb-1 opacity-60">
      {icon}
      <span className="text-[9px] font-black uppercase tracking-widest whitespace-nowrap">{label}</span>
    </div>
    <div className="flex items-baseline gap-1.5">
      <span className="text-lg font-black text-white">{value}</span>
      <span className="text-[9px] font-bold text-indigo-100/30 uppercase tracking-tighter">{unit}</span>
    </div>
  </div>
);

export default App;
