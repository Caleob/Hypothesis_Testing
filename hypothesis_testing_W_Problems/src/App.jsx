


import React, { useState, useEffect, useRef } from 'react';
import { Info, Calculator, ChevronDown, CheckCircle, X } from 'lucide-react';

/**
 * MATH UTILITIES (Gamma, Chi-Square PDF/CDF/Inverse)
 */
const MathUtils = {
  gamma: (z) => {
    if (z < 0.5) return Math.PI / (Math.sin(Math.PI * z) * MathUtils.gamma(1 - z));
    z -= 1;
    const p = [
      676.5203681218851, -1259.1392167224028, 771.32342877765313,
      -176.61502916214059, 12.507343278686905, -0.13857109526572012,
      9.9843695780195716e-6, 1.5056327351493116e-7
    ];
    let x = 0.99999999999980993;
    for (let i = 0; i < p.length; i++) x += p[i] / (z + i + 1);
    const t = z + p.length - 0.5;
    return Math.sqrt(2 * Math.PI) * Math.pow(t, z + 0.5) * Math.exp(-t) * x;
  },

  pdf: (x, k) => {
    if (x <= 0 || k <= 0) return 0;
    const numerator = Math.pow(x, (k / 2) - 1) * Math.exp(-x / 2);
    const denominator = Math.pow(2, k / 2) * MathUtils.gamma(k / 2);
    return numerator / denominator;
  },

  cdf: (x, k) => {
    if (x <= 0) return 0;
    const n = 100;
    const h = x / n;
    let sum = MathUtils.pdf(0.0001, k) + MathUtils.pdf(x, k);
    for (let i = 1; i < n; i += 2) sum += 4 * MathUtils.pdf(i * h, k);
    for (let i = 2; i < n - 1; i += 2) sum += 2 * MathUtils.pdf(i * h, k);
    return (h / 3) * sum;
  },

  ppf: (targetArea, k) => {
    if (targetArea <= 0) return 0;
    const stdDev = Math.sqrt(2 * k);
    let high = Math.max(100, k + 6 * stdDev); 
    if (targetArea >= 1) return high; 
    let low = 0, mid = 0;
    for (let i = 0; i < 50; i++) { 
      mid = (low + high) / 2;
      const val = MathUtils.cdf(mid, k);
      if (val < targetArea) low = mid;
      else high = mid;
    }
    return mid;
  }
};


const PROBLEM_BANK = [
  {
    field: "Manufacturing",
    text: "A precision parts manufacturer claims the standard deviation of rod diameters is 0.02 mm. A quality inspector suspects the variability is actually higher. They take a random sample of 25 rods and find a sample standard deviation of 0.028 mm.",
    task: "Conduct a hypothesis test at α = 0.05 to determine if the population standard deviation is greater than 0.02 mm.",
    tails: "right",
    testStatType: "chi-squared",
    expectedTestStat: 47.04,
    expectedH0: { op: "=", val: 0.02 },
    expectedHa: { op: ">", val: 0.02 },
    expectedDecision: "reject"
  },
  {
    field: "Hydrology",
    text: "Stream flow measurements at a gauging station have historically shown a variance of 144 (m³/s)². After installing a new measurement system, 26 readings show a sample variance of 89 (m³/s)², and engineers worry the sensors may be malfunctioning.",
    task: "Test whether the variance differs from 144 at the 0.05 significance level.",
    tails: "both",
    testStatType: "chi-squared",
    expectedTestStat: 15.4514,
    expectedH0: { op: "=", val: 144 },
    expectedHa: { op: "≠", val: 144 },
    expectedDecision: "reject"
  },
  {
    field: "Market Research",
    text: "Customer satisfaction scores typically have a standard deviation of 12 points. After a new product launch, a company surveys 35 customers and finds a standard deviation of 10 points—unusually low variation that might indicate survey bias or limited product appeal to a narrow demographic.",
    task: "Test at α = 0.10 whether the population standard deviation is less than 12 points.",
    tails: "left",
    testStatType: "chi-squared",
    expectedTestStat: 23.611,
    expectedH0: { op: "=", val: 12 },
    expectedHa: { op: "<", val: 12 },
    expectedDecision: "fail"
  }
];

const App = () => {
  const [inputMode, setInputMode] = useState('sd');
  const [n, setN] = useState(1);
  const [s, setS] = useState(1);
  const [sigma, setSigma] = useState(1);
  const [testStat, setTestStat] = useState(0);
  const [cvLeft, setCvLeft] = useState("");
  const [areaLeft, setAreaLeft] = useState("");
  const [cvRight, setCvRight] = useState("");
  const [areaRight, setAreaRight] = useState("");
  const [h1Op, setH1Op] = useState('>');
  const [decision, setDecision] = useState(null);
  const [selectedProblem, setSelectedProblem] = useState(null);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [pValue, setPValue] = useState(null);

  const canvasRef = useRef(null);
  const noSpinClass = "[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none";

  useEffect(() => {
    const randomIdx = Math.floor(Math.random() * PROBLEM_BANK.length);
    setSelectedProblem(PROBLEM_BANK[randomIdx]);
  }, []);

  const df = Math.max(1, (parseInt(n) || 2) - 1);

  // Recalculate Test Statistic
  useEffect(() => {
    const nVal = parseFloat(n);
    const sVal = parseFloat(s);
    const sigmaVal = parseFloat(sigma);

    if (nVal && sVal && sigmaVal && sigmaVal !== 0) {
      let sSquared, sigmaSquared;
      if (inputMode === 'sd') {
        sSquared = sVal * sVal;
        sigmaSquared = sigmaVal * sigmaVal;
      } else {
        sSquared = sVal;
        sigmaSquared = sigmaVal;
      }
      const val = ((nVal - 1) * sSquared) / sigmaSquared;
      setTestStat(val);
    }
  }, [n, s, sigma, inputMode]);

  // Recalculate p-value whenever testStat or tail-selection changes
  useEffect(() => {
    const isLeftSet = cvLeft !== "";
    const isRightSet = cvRight !== "";

    const pLow = MathUtils.cdf(testStat, df);
    const pHigh = 1 - pLow;

    if (isLeftSet && isRightSet) {
      setPValue(Math.min(1.0, 2 * Math.min(pLow, pHigh)));
    } else if (isLeftSet) {
      setPValue(pLow);
    } else if (isRightSet) {
      setPValue(pHigh);
    } else {
      setPValue(null);
    }
  }, [testStat, cvLeft, cvRight, df]);

  const updateFromCvLeft = (val) => {
    setCvLeft(val);
    if (val === "" || isNaN(val)) { setAreaLeft(""); return; }
    const num = parseFloat(val);
    setAreaLeft(MathUtils.cdf(num, df).toFixed(4));
  };

  const updateFromAreaLeft = (val) => {
    setAreaLeft(val);
    if (val === "" || isNaN(val)) { setCvLeft(""); return; }
    const num = parseFloat(val);
    setCvLeft(MathUtils.ppf(num, df).toFixed(3));
  };

  const updateFromCvRight = (val) => {
    setCvRight(val);
    if (val === "" || isNaN(val)) { setAreaRight(""); return; }
    const num = parseFloat(val);
    setAreaRight((1 - MathUtils.cdf(num, df)).toFixed(4));
  };

  const updateFromAreaRight = (val) => {
    setAreaRight(val);
    if (val === "" || isNaN(val)) { setCvRight(""); return; }
    const num = parseFloat(val);
    setCvRight(MathUtils.ppf(1 - num, df).toFixed(3));
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;

    ctx.clearRect(0, 0, width, height);
    
    // Dynamic scaling logic
    const xMax = MathUtils.ppf(0.9995, df);
    const modeX = df >= 2 ? df - 2 : 0.2;
    const peakY = MathUtils.pdf(modeX, df);
    const yMax = peakY * 1.1; 

    // Adjustment to mapY to ensure room for labels under the x-axis
    const baselineY = height - 40;
    const mapX = (x) => (x / xMax) * width;
    const mapY = (y) => baselineY - (y / yMax) * (baselineY - 40);

    // Draw Grid
    ctx.strokeStyle = '#f3f4f6';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for(let i=0; i<=width; i+=width/20) { ctx.moveTo(i,0); ctx.lineTo(i,baselineY); }
    for(let i=0; i<=baselineY; i+=baselineY/10) { ctx.moveTo(0,i); ctx.lineTo(width,i); }
    ctx.stroke();

    // Draw Curve
    ctx.beginPath();
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#4f46e5'; 
    let started = false;
    for (let px = 0; px < width; px++) {
      const x = (px / width) * xMax;
      const y = MathUtils.pdf(x, df);
      if (!isFinite(y)) continue;
      if (!started) { ctx.moveTo(px, mapY(y)); started = true; }
      else { ctx.lineTo(px, mapY(y)); }
    }
    ctx.stroke();

    // Rejection Regions
    if (cvLeft !== "" && !isNaN(parseFloat(cvLeft))) {
      const limit = parseFloat(cvLeft);
      const drawLimit = Math.min(limit, xMax);
      ctx.fillStyle = 'rgba(165, 243, 252, 0.6)'; 
      ctx.beginPath();
      ctx.moveTo(mapX(0), baselineY);
      for (let px = 0; px <= mapX(drawLimit); px++) {
        const x = (px / width) * xMax;
        const y = MathUtils.pdf(x, df);
        ctx.lineTo(px, mapY(y));
      }
      ctx.lineTo(mapX(drawLimit), baselineY);
      ctx.closePath();
      ctx.fill();
      
      ctx.beginPath();
      ctx.strokeStyle = '#0891b2';
      ctx.moveTo(mapX(limit), baselineY);
      ctx.lineTo(mapX(limit), mapY(MathUtils.pdf(limit, df)) - 20);
      ctx.stroke();
      
      ctx.fillStyle = '#0e7490';
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(limit.toFixed(2), mapX(limit) - 5, mapY(MathUtils.pdf(limit, df)) - 25);
      ctx.textAlign = 'left';
    }

    if (cvRight !== "" && !isNaN(parseFloat(cvRight))) {
      const limit = parseFloat(cvRight);
      if (limit < xMax) {
          ctx.fillStyle = 'rgba(251, 207, 232, 0.6)'; 
          ctx.beginPath();
          ctx.moveTo(mapX(limit), baselineY);
          for (let px = mapX(limit); px <= width; px++) {
            const x = (px / width) * xMax;
            const y = MathUtils.pdf(x, df);
            ctx.lineTo(px, mapY(y));
          }
          ctx.lineTo(width, baselineY);
          ctx.closePath();
          ctx.fill();
          
          ctx.beginPath();
          ctx.strokeStyle = '#be185d';
          ctx.moveTo(mapX(limit), baselineY);
          ctx.lineTo(mapX(limit), mapY(MathUtils.pdf(limit, df)) - 20);
          ctx.stroke();
          
          ctx.fillStyle = '#be185d';
          ctx.font = 'bold 12px sans-serif';
          ctx.fillText(limit.toFixed(2), mapX(limit) + 5, mapY(MathUtils.pdf(limit, df)) - 25);
      }
    }

    // Test Statistic Marker
    const statX = mapX(testStat);
    if (statX >= 0 && statX <= width) {
        ctx.beginPath();
        ctx.lineWidth = 2; ctx.strokeStyle = '#1e293b'; ctx.setLineDash([5, 5]);
        ctx.moveTo(statX, baselineY); ctx.lineTo(statX, 10); ctx.stroke(); ctx.setLineDash([]);
        
        // χ² Label centered under x-axis
        ctx.fillStyle = '#1e293b'; 
        ctx.font = 'bold 12px sans-serif'; 
        ctx.textAlign = 'center';
        ctx.fillText(`χ²: ${testStat.toFixed(2)}`, statX, baselineY + 20); 
        ctx.textAlign = 'left';
    } else if (testStat > xMax) {
        ctx.fillStyle = '#1e293b'; ctx.beginPath();
        ctx.moveTo(width - 20, baselineY/2 - 10); ctx.lineTo(width, baselineY/2); ctx.lineTo(width - 20, baselineY/2 + 10); ctx.fill();
        ctx.fillText(`χ²: ${testStat.toFixed(2)}`, width - 80, baselineY/2 - 15);
    }

    // Baseline
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, baselineY);
    ctx.lineTo(width, baselineY);
    ctx.stroke();

  }, [cvLeft, cvRight, df, testStat, areaLeft, areaRight, n, s, sigma, inputMode]);

  return (
    <div className="min-h-screen bg-gray-50 p-4 font-sans text-gray-800 relative">
      
      {showSubmitModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
            <div className="bg-white p-8 rounded-3xl shadow-2xl border border-gray-100 flex flex-col items-center gap-4 animate-in fade-in zoom-in duration-200">
                <CheckCircle className="w-16 h-16 text-emerald-500" />
                <h2 className="text-2xl font-bold">Problem Completed</h2>
                <p className="text-gray-500">Your hypothesis test has been submitted.</p>
                <button 
                    onClick={() => setShowSubmitModal(false)}
                    className="mt-4 px-6 py-2 bg-indigo-600 text-white rounded-full font-bold hover:bg-indigo-700 transition-colors"
                >
                    Return to Tool
                </button>
            </div>
        </div>
      )}

      <div className="max-w-6xl mx-auto space-y-6">
        
        <div className="flex justify-between items-center pb-4 border-b border-gray-200">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Calculator className="w-6 h-6 text-indigo-600" />
              Chi-Square Test Calculator
            </h1>
            <p className="text-sm text-gray-500">Practice tool for Hypothesis Testing for Variance</p>
          </div>
          <div className="text-sm font-mono text-indigo-800 bg-indigo-50 px-3 py-1.5 rounded-lg border border-indigo-100 shadow-sm">
            df = n - 1 = {df}
          </div>
        </div>

        <div className="flex flex-col md:flex-row gap-4">
            <div className="flex flex-col gap-3 w-full md:w-48 shrink-0">
                <div className="bg-cyan-100 p-3 rounded-xl border border-cyan-200 shadow-sm flex flex-col items-center">
                    <span className="text-cyan-800 font-bold text-[10px] mb-1 uppercase tracking-wider">Left CV</span>
                    <input type="number" inputMode="decimal" value={cvLeft} placeholder="None" onChange={(e) => updateFromCvLeft(e.target.value)}
                        className={`w-full text-center p-1 rounded border-cyan-300 outline-none font-mono text-sm bg-white/80 ${noSpinClass}`} />
                    <span className="text-cyan-800 font-bold text-[10px] mt-2 mb-1 uppercase tracking-wider">Left Area (α)</span>
                    <input type="number" inputMode="decimal" step="0.0001" value={areaLeft} placeholder="None" onChange={(e) => updateFromAreaLeft(e.target.value)}
                        className={`w-full text-center p-1 rounded border-cyan-300 outline-none font-mono text-sm bg-white/80 ${noSpinClass}`} />
                </div>
                <div className="bg-pink-100 p-3 rounded-xl border border-pink-200 shadow-sm flex flex-col items-center">
                    <span className="text-pink-800 font-bold text-[10px] mb-1 uppercase tracking-wider">Right CV</span>
                    <input type="number" inputMode="decimal" value={cvRight} placeholder="None" onChange={(e) => updateFromCvRight(e.target.value)}
                        className={`w-full text-center p-1 rounded border-pink-300 outline-none font-mono text-sm bg-white/80 ${noSpinClass}`} />
                    <span className="text-pink-800 font-bold text-[10px] mt-2 mb-1 uppercase tracking-wider">Right Area (α)</span>
                    <input type="number" inputMode="decimal" step="0.0001" value={areaRight} placeholder="None" onChange={(e) => updateFromAreaRight(e.target.value)}
                        className={`w-full text-center p-1 rounded border-pink-300 outline-none font-mono text-sm bg-white/80 ${noSpinClass}`} />
                </div>

                <div className="bg-emerald-50 p-3 rounded-xl border border-emerald-100 shadow-sm flex flex-col items-center">
                    <span className="text-emerald-800 font-bold text-[10px] mb-1 uppercase tracking-wider">P-Value</span>
                    <div className="w-full text-center py-2 rounded-lg font-mono text-lg font-bold text-emerald-700 bg-white/50 border border-emerald-200 shadow-inner min-h-[40px]">
                      {pValue !== null ? pValue.toFixed(4) : "--"}
                    </div>
                    <span className="text-[8px] text-emerald-600 mt-1 uppercase text-center font-medium">
                      {cvLeft !== "" && cvRight !== "" ? "Two-Tailed" : cvLeft !== "" ? "Left-Tailed" : cvRight !== "" ? "Right-Tailed" : "Define Rejection Region"}
                    </span>
                </div>
            </div>

            <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-1 relative overflow-hidden flex-1">
                <canvas ref={canvasRef} width={1000} height={350} className="w-full h-full object-contain" />
                <div className="absolute top-4 left-4 bg-white/90 p-2 rounded text-xs text-gray-500 border border-gray-200 shadow-sm">
                   Distribution: Chi-Square (df={df})
                </div>
            </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="bg-white rounded-2xl shadow-md border border-gray-200 p-6 flex flex-col justify-center items-center">
                <h3 className="text-gray-400 font-bold text-xs uppercase tracking-widest mb-4">Test Statistic Formula</h3>
                <div className="text-2xl md:text-4xl font-serif italic text-gray-800 mb-2">
                    χ² = <span className="inline-block align-middle text-center">
                        <span className="block border-b-2 border-gray-800 px-1">(n-1)s²</span>
                        <span className="block px-1">σ²</span>
                    </span>
                </div>
                <div className="mt-4 p-3 bg-gray-50 rounded-lg text-center w-full">
                    <div className="text-xs text-gray-500 mb-1">Calculated Value</div>
                    <div className="text-xl font-bold text-indigo-600 font-mono">{testStat.toFixed(4)}</div>
                </div>
            </div>

            <div className="bg-white rounded-2xl shadow-md border border-gray-200 p-6 space-y-4 relative">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-gray-400 font-bold text-xs uppercase tracking-widest">Sample Data</h3>
                    <div className="flex bg-gray-100 p-1 rounded-lg border border-gray-200">
                        <button onClick={() => setInputMode('sd')}
                            className={`px-3 py-1 text-sm font-bold rounded-md transition-all ${inputMode === 'sd' ? 'bg-white text-indigo-600 shadow-sm border border-gray-200' : 'text-gray-400 hover:text-gray-600'}`}>σ</button>
                        <button onClick={() => setInputMode('var')}
                            className={`px-3 py-1 text-sm font-bold rounded-md transition-all ${inputMode === 'var' ? 'bg-white text-indigo-600 shadow-sm border border-gray-200' : 'text-gray-400 hover:text-gray-600'}`}>σ²</button>
                    </div>
                </div>
                <div className="flex items-center gap-4">
                    <label className="w-16 text-xl font-serif italic font-bold text-right">n =</label>
                    <input type="number" value={n} onChange={(e) => setN(e.target.value)}
                        className="flex-1 p-3 text-lg border-2 border-gray-200 rounded-xl focus:border-indigo-500 outline-none transition-all font-handwritten" />
                </div>
                <div className="flex items-center gap-4">
                    <label className="w-16 text-xl font-serif italic font-bold text-right">{inputMode === 'sd' ? 's =' : 's² ='}</label>
                    <input type="number" inputMode="decimal" step="0.001" value={s} onChange={(e) => setS(e.target.value)}
                        className={`flex-1 p-3 text-lg border-2 border-gray-200 rounded-xl focus:border-indigo-500 outline-none transition-all ${noSpinClass}`} />
                </div>
                <div className="flex items-center gap-4">
                    <label className="w-16 text-xl font-serif italic font-bold text-right">{inputMode === 'sd' ? 'σ =' : 'σ² ='}</label>
                    <input type="number" inputMode="decimal" step="0.001" value={sigma} onChange={(e) => setSigma(e.target.value)}
                        className={`flex-1 p-3 text-lg border-2 border-gray-200 rounded-xl focus:border-indigo-500 outline-none transition-all ${noSpinClass}`} />
                </div>
            </div>

            <div className="bg-white rounded-2xl shadow-md border border-gray-200 p-6 space-y-4 flex flex-col">
                <h3 className="text-gray-400 font-bold text-xs uppercase tracking-widest mb-2">Hypothesis</h3>
                
                {/* Fixed H0 */}
                <div className="flex items-center gap-3">
                    <label className="text-xl font-serif italic font-bold w-10">H₀:</label>
                    <span className="text-2xl font-serif italic text-indigo-600 font-semibold">{inputMode === 'sd' ? 'σ' : 'σ²'}</span>
                    <div className="flex-1 text-center py-2 text-xl font-mono text-gray-500 border-2 border-transparent">
                        =
                    </div>
                    <span className="text-xl font-mono text-gray-700 bg-gray-50 px-3 py-2 rounded-lg border-2 border-transparent w-24 text-center">{sigma || '0'}</span>
                </div>

                {/* Dropdown Ha */}
                <div className="flex items-center gap-3">
                    <label className="text-xl font-serif italic font-bold w-10">H₁:</label>
                    <span className="text-2xl font-serif italic text-indigo-600 font-semibold">{inputMode === 'sd' ? 'σ' : 'σ²'}</span>
                    <div className="relative flex-1 group">
                        <select value={h1Op} onChange={(e) => setH1Op(e.target.value)}
                            className="w-full p-2 text-xl font-mono border-2 border-gray-100 rounded-lg appearance-none bg-gray-50 hover:bg-white focus:border-indigo-300 outline-none cursor-pointer transition-colors text-center"
                        >
                            <option value="≠">≠</option>
                            <option value=">">&gt;</option>
                            <option value="<">&lt;</option>
                        </select>
                        <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                    </div>
                    <span className="text-xl font-mono text-gray-700 bg-gray-50 px-3 py-2 rounded-lg border-2 border-transparent w-24 text-center">{sigma || '0'}</span>
                </div>

                <div className="text-[10px] text-gray-400 text-center uppercase tracking-widest pt-2 border-t border-gray-100">Formulate a null and alternate hypothesis</div>
                
                <div className="flex flex-col gap-2 mt-auto">
                    <span className="text-[10px] text-gray-400 font-bold uppercase text-center tracking-widest">Final Conclusion</span>
                    <div className="flex bg-gray-100 p-1 rounded-xl border border-gray-200">
                        <button onClick={() => setDecision('reject')} className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${decision === 'reject' ? 'bg-blue-600 text-white shadow-md' : 'text-gray-400 hover:text-gray-600'}`}>Reject H₀</button>
                        <button onClick={() => setDecision('fail')} className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${decision === 'fail' ? 'bg-blue-600 text-white shadow-md' : 'text-gray-400 hover:text-gray-600'}`}>Fail to Reject H₀</button>
                    </div>
                </div>
            </div>
        </div>

        {selectedProblem && (
          <div className="flex flex-col md:flex-row gap-4 items-stretch">
              <div className="bg-indigo-100 rounded-2xl p-6 border border-indigo-200 shadow-sm flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="px-2 py-1 bg-indigo-200 text-indigo-700 text-[10px] font-bold uppercase rounded-md">{selectedProblem.field}</span>
                    <h3 className="text-indigo-800 font-bold flex items-center gap-2"><Info className="w-4 h-4" />Problem Statement</h3>
                  </div>
                  <p className="text-indigo-900 leading-relaxed mb-4">{selectedProblem.text}</p>
                  <div className="pt-4 border-t border-indigo-200 text-indigo-800 font-medium italic">{selectedProblem.task}</div>
              </div>

              <button 
                onClick={() => setShowSubmitModal(true)}
                disabled={!decision}
                className={`w-12 md:w-16 rounded-2xl flex items-center justify-center transition-all duration-300 transform group ${
                    decision 
                    ? 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-lg cursor-pointer active:scale-95' 
                    : 'bg-gray-200 text-gray-400 cursor-not-allowed border-2 border-dashed border-gray-300'
                }`}
              >
                  <span className="whitespace-nowrap -rotate-90 font-black tracking-[0.2em] text-lg uppercase flex items-center gap-2">
                      Submit 
                  </span>
              </button>
          </div>
        )}

      </div>
    </div>
  );
};

export default App;