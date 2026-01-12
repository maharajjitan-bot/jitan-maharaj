
import { GoogleGenAI } from "@google/genai";
import { BoxType, Unit } from "../types";

const aiClient = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const getEnclosureAdvice = async (
  boxType: BoxType,
  netVolume: number,
  unit: Unit,
  subCount: number,
  subSize: number
) => {
  const volumeUnit = unit === Unit.IMPERIAL ? "ft³" : "L";
  
  const prompt = `Act as a master car audio engineer and acoustician. I am building a ${boxType} enclosure for ${subCount} x ${subSize}-inch subwoofer(s). 
  The calculated net internal volume is ${netVolume.toFixed(2)} ${volumeUnit}.
  
  Please provide a detailed technical analysis including:
  1. Volume Suitability: Is this volume appropriate for these drivers?
  2. Tuning/Alignment: Recommended tuning frequency (if ported) or QTC target (if sealed).
  3. Damping Material Optimization: Suggest specific materials (e.g., polyfill, open-cell foam, fiberglass) and exact amounts (e.g., lbs per cubic foot or coverage percentage) to control internal reflections and standing waves for this specific ${netVolume.toFixed(2)} ${volumeUnit} space.
  4. Structural Integrity: One high-level pro tip for internal bracing strategy.
  5. Acoustic Signature: Which music genres will perform best with this specific enclosure alignment?
  
  Keep the response professional, technical yet accessible, and well-structured.`;

  try {
    const response = await aiClient.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });
    return response.text;
  } catch (error) {
    console.error("Gemini Error:", error);
    return "Could not fetch expert advice at this time.";
  }
};

export const getPortOptimizationAdvice = async (
  length: number,
  area: number,
  fb: number,
  velocity: number,
  unit: Unit
) => {
  const lenUnit = unit === Unit.IMPERIAL ? "inches" : "cm";
  // Speed of sound in inches/s approx 13500, cm/s approx 34300
  const speedOfSound = unit === Unit.IMPERIAL ? 13500 : 34300;
  const resonanceFreq = speedOfSound / (2 * length);
  
  const prompt = `Act as an acoustic engineer specializing in ported subwoofer enclosures. 
  I have a port with the following specs:
  - Calculated Length: ${length.toFixed(2)} ${lenUnit}
  - Cross-sectional Area: ${area.toFixed(2)} sq ${unit === Unit.IMPERIAL ? "in" : "cm"}
  - Tuning Frequency (Fb): ${fb} Hz
  - Estimated Port Velocity: ${velocity.toFixed(2)} m/s
  - Theoretical 1st Pipe Resonance: ${resonanceFreq.toFixed(0)} Hz
  
  Please provide:
  1. Specific flare radius recommendations (e.g., 1/2", 1", etc.) for both ends to minimize chuffing.
  2. Structural bracing advice for this specific port length (should it be anchored to the box wall, have a middle brace, etc.).
  3. Pipe Organ Resonance Mitigation: Based on the ${resonanceFreq.toFixed(0)} Hz resonance, advise if this is a concern given typical subwoofer crossovers (80-120Hz) and suggest mitigation (e.g., lining the port, internal damping, or geometry changes).
  
  Keep the advice technical, precise, and under 120 words.`;

  try {
    const response = await aiClient.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });
    return response.text;
  } catch (error) {
    console.error("Gemini Port Advice Error:", error);
    return "Could not fetch port optimization data.";
  }
};
