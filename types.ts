
export enum Unit {
  IMPERIAL = 'Imperial (inches)',
  METRIC = 'Metric (cm)'
}

export enum BoxType {
  SEALED = 'Sealed',
  PORTED = 'Ported'
}

export enum PortShape {
  ROUND = 'Round',
  SQUARE = 'Square',
  SLOT = 'Slot'
}

export interface Subwoofer {
  id: string;
  size: number; // inches
  displacement: number; // cubic feet or liters
  sD: number; // cm^2 (Effective cone area)
  xMax: number; // mm (One-way linear excursion)
  fS: number; // Hz (Free-air resonance)
  qTS: number; // Total Q factor
  vAS: number; // Liters (Equivalent Volume of Compliance)
  count: number;
}

export interface BoxDimensions {
  length: number;
  width: number;
  height: number;
  thickness: number;
}

export interface BracingDimensions {
  count: number;
  length: number;
  width: number;
  height: number;
}

export interface PortBraceDimensions {
  count: number;
  length: number;
  width: number;
  thickness: number;
}

export interface PortSpecs {
  shape: PortShape;
  count: number;
  targetFb: number;
  diameter: number; // For Round
  side: number;     // For Square
  width: number;    // For Slot
  height: number;   // For Slot
  physicalDepth: number; // For manual displacement override
  calculatedLength: number;
  endCorrection: number; // Correction factor (e.g., 0.732)
}

export interface CalculationResults {
  grossVolume: number;
  netVolume: number;
  subDisplacement: number;
  bracingDisplacement: number;
  portDisplacement: number;
  portBraceDisplacement: number;
  mountingDisplacement: number;
  portVelocity: number; // m/s
  isStable: boolean;
}

export interface SavedProject {
  id: string;
  name: string;
  timestamp: number;
  unit: Unit;
  boxType: BoxType;
  dimensions: BoxDimensions;
  bracing: BracingDimensions;
  portBracing: PortBraceDimensions;
  mountingDisp: number;
  portSpecs: PortSpecs;
  selectedSubId: string;
  subCount: number;
  manualDisplacement: number;
  displacementUnit: Unit;
}
