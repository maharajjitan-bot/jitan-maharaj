
import { Subwoofer } from './types';

export const STANDARD_SUBS: Subwoofer[] = [
  { id: '6.5', size: 6.5, displacement: 0.015, sD: 130, xMax: 8, fS: 45, qTS: 0.48, vAS: 8.5, count: 1 },
  { id: '8', size: 8, displacement: 0.03, sD: 210, xMax: 12, fS: 38, qTS: 0.44, vAS: 18.2, count: 1 },
  { id: '10', size: 10, displacement: 0.05, sD: 330, xMax: 14, fS: 32, qTS: 0.41, vAS: 35.5, count: 1 },
  { id: '12', size: 12, displacement: 0.08, sD: 510, xMax: 15, fS: 28, qTS: 0.48, vAS: 62.1, count: 1 },
  { id: '13', size: 13, displacement: 0.10, sD: 650, xMax: 16, fS: 26, qTS: 0.45, vAS: 85.0, count: 1 },
  { id: '15', size: 15, displacement: 0.12, sD: 810, xMax: 18, fS: 24, qTS: 0.52, vAS: 145.0, count: 1 },
  { id: '18', size: 18, displacement: 0.18, sD: 1200, xMax: 22, fS: 21, qTS: 0.55, vAS: 280.0, count: 1 },
  { id: '21', size: 21, displacement: 0.25, sD: 1650, xMax: 25, fS: 19, qTS: 0.58, vAS: 410.0, count: 1 },
  { id: '24', size: 24, displacement: 0.35, sD: 2200, xMax: 30, fS: 16, qTS: 0.62, vAS: 650.0, count: 1 },
];

export const CONVERSION_IN_TO_CF = 1728;
export const CONVERSION_CM_TO_L = 1000;
export const CF_TO_LITERS = 28.3168466;
