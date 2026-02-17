import React, { useState, useEffect, useRef } from 'react';
import { Calculator, ChevronDown, ArrowLeft, Activity, Users, BarChart2, PieChart } from 'lucide-react';

/**
 * MATH UTILITIES 
 * Includes Gamma, Error Function, PDF/CDF/PPF for Normal, T, and Chi-Square
 */
const MathUtils = {
  // --- Helpers ---
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

  erf: (x) => {
    // Save the sign of x
    var sign = (x >= 0) ? 1 : -1;
    x = Math.abs(x);
    // Constants for approximation
    var a1 =  0.254829592;
    var a2 = -0.284496736;
    var a3 =  1.421413741;
    var a4 = -1.453152027;
    var a5 =  1.061405429;
    var p  =  0.3275911;
    // A&S formula 7.1.26
    var t = 1.0 / (1.0 + p*x);
    var y = 1.0 - (((((a5*t + a4)*t) + a3)*t + a2)*t + a1)*t*Math.exp(-x*x);
    return sign * y;
  },

  // --- Distributions ---

  // CHI-SQUARE
  chiPdf: (x, k) => {
    if (x <= 0 || k <= 0) return 0;
    const numerator = Math.pow(x, (k / 2) - 1) * Math.exp(-x / 2);
    const denominator = Math.pow(2, k / 2) * MathUtils.gamma(k / 2);
    return numerator / denominator;
  },
  chiCdf: (x, k) => {
    if (x <= 0) return 0;
    // Simpson's rule / Numerical integration
    const n = 100;
    const h = x / n;
    let sum = MathUtils.chiPdf(0.0001, k) + MathUtils.chiPdf(x, k);
    for (let i = 1; i < n; i += 2) sum += 4 * MathUtils.chiPdf(i * h, k);
    for (let i = 2; i < n - 1; i += 2) sum += 2 * MathUtils.chiPdf(i * h, k);
    return (h / 3) * sum;
  },

  // NORMAL (Standard)
  normPdf: (x) => {
    return (1 / Math.sqrt(2 * Math.PI)) * Math.exp(-0.5 * x * x);
  },
  normCdf: (x) => {
    return 0.5 * (1 + MathUtils.erf(x / Math.sqrt(2)));
  },

  // STUDENT'S T
  tPdf: (x, v) => {
    const num = MathUtils.gamma((v + 1) / 2);
    const den = Math.sqrt(v * Math.PI) * MathUtils.gamma(v / 2);
    const base = 1 + (x * x) / v;
    const pow = -(v + 1) / 2;
    return (num / den) * Math.pow(base, pow);
  },
  tCdf: (x, v) => {
    // Numerical integration for T
    if (x === 0) return 0.5;
    const limit = x;
    const n = 200; // precision
    const h = Math.abs(limit) / n;
    let sum = MathUtils.tPdf(0, v) + MathUtils.tPdf(limit, v); // start at 0 (pdf 0.39) to limit
    for (let i = 1; i < n; i += 2) sum += 4 * MathUtils.tPdf(i * h, v);
    for (let i = 2; i < n - 1; i += 2) sum += 2 * MathUtils.tPdf(i * h, v);
    const integral = (h / 3) * sum;
    return x > 0 ? 0.5 + integral : 0.5 - integral;
  },

  // GENERIC INTERFACE
  pdf: (x, df, type) => {
    if (type === 'chi') return MathUtils.chiPdf(x, df);
    if (type === 't') return MathUtils.tPdf(x, df);
    return MathUtils.normPdf(x); // z-test
  },

  cdf: (x, df, type) => {
    if (type === 'chi') return MathUtils.chiCdf(x, df);
    if (type === 't') return MathUtils.tCdf(x, df);
    return MathUtils.normCdf(x);
  },

  // Inverse CDF (Percent Point Function) using Binary Search
  ppf: (targetArea, df, type) => {
    if (targetArea <= 0) return type === 'chi' ? 0 : -10;
    if (targetArea >= 1) return type === 'chi' ? 100 : 10;

    let low = type === 'chi' ? 0 : -10;
    let high = type === 'chi' ? Math.max(100, df + 10) : 10;
    let mid = 0;

    for (let i = 0; i < 50; i++) { 
      mid = (low + high) / 2;
      const val = MathUtils.cdf(mid, df, type);
      if (val < targetArea) low = mid;
      else high = mid;
    }
    return mid;
  }
};

/**
 * MAIN APP COMPONENT
 */
const App = () => {
  const [mode, setMode] = useState(null); // null (menu), 'chi', 't_mean', 'z_mean', 'z_prop'

  // --- Shared State ---
  // We use generic names (param1, param2) mapped to specific meanings based on mode
  const [n, setN] = useState(10);
  const [sampleVal, setSampleVal] = useState(1); // s (chi), xBar (t/z), pHat (prop)
  const [popVal, setPopVal] = useState(0);    // sigma (chi), mu (t/z), p (prop)
  const [extraVal, setExtraVal] = useState(1);   // sigma (z-test), or unused

  const [testStat, setTestStat] = useState(0);
  const [cvLeft, setCvLeft] = useState("");
  const [areaLeft, setAreaLeft] = useState("");
  const [cvRight, setCvRight] = useState("");
  const [areaRight, setAreaRight] = useState("");
  const [h1Op, setH1Op] = useState('≠');
  const [decision, setDecision] = useState(null);
  const [pValue, setPValue] = useState(null);
  
  // Specific for Chi-Square toggle
  const [chiInputMode, setChiInputMode] = useState('sd'); // 'sd' or 'var'

  const canvasRef = useRef(null);
  const noSpinClass = "[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none";

  // --- Configuration per Mode ---
  const config = {
    chi: {
      title: "Chi-Square Variance Test",
      color: "indigo",
      sym: { sample: "s", pop: "σ", stat: "χ²" },
      distType: 'chi',
      isSymmetric: false
    },
    t_mean: {
      title: "One-Sample t-Test (Mean)",
      color: "blue",
      sym: { sample: "x̄", pop: "μ", stat: "t" },
      distType: 't',
      isSymmetric: true
    },
    z_mean: {
      title: "One-Sample Z-Test (Mean)",
      color: "violet",
      sym: { sample: "x̄", pop: "μ", stat: "z" },
      distType: 'normal',
      isSymmetric: true
    },
    z_prop: {
      title: "One-Proportion Z-Test",
      color: "emerald",
      sym: { sample: "p̂", pop: "p", stat: "z" },
      distType: 'normal',
      isSymmetric: true
    }
  };

  const currentConfig = mode ? config[mode] : config.chi;
  const df = mode === 'chi' || mode === 't_mean' ? Math.max(1, (parseInt(n) || 2) - 1) : 0; // DF irrelevant for Z

  // --- Reset on Mode Change ---
  useEffect(() => {
    setCvLeft(""); setAreaLeft("");
    setCvRight(""); setAreaRight("");
    setDecision(null);
    setH1Op('≠');
    
    // Set sensible defaults
    if (mode === 'chi') { setN(10); setSampleVal(2); setPopVal(2); }
    if (mode === 't_mean') { setN(10); setSampleVal(105); setPopVal(100); setExtraVal(10); } // extra is s
    if (mode === 'z_mean') { setN(30); setSampleVal(105); setPopVal(100); setExtraVal(15); } // extra is sigma
    if (mode === 'z_prop') { setN(100); setSampleVal(0.55); setPopVal(0.5); }
  }, [mode]);

  // --- Calculations ---
  useEffect(() => {
    if (!mode) return;

    const nNum = parseFloat(n);
    const samp = parseFloat(sampleVal);
    const pop = parseFloat(popVal);
    const extra = parseFloat(extraVal);

    let stat = 0;

    if (mode === 'chi' && nNum && samp && pop) {
      let sSq = chiInputMode === 'sd' ? samp * samp : samp;
      let sigSq = chiInputMode === 'sd' ? pop * pop : pop;
      if (sigSq !== 0) stat = ((nNum - 1) * sSq) / sigSq;
    } 
    else if (mode === 't_mean' && nNum && extra && extra !== 0) {
      // t = (xBar - mu) / (s / sqrt(n))
      stat = (samp - pop) / (extra / Math.sqrt(nNum));
    }
    else if (mode === 'z_mean' && nNum && extra && extra !== 0) {
      // z = (xBar - mu) / (sigma / sqrt(n))
      stat = (samp - pop) / (extra / Math.sqrt(nNum));
    }
    else if (mode === 'z_prop' && nNum && pop > 0 && pop < 1) {
      // z = (pHat - p) / sqrt(p(1-p)/n)
      const num = samp - pop;
      const den = Math.sqrt((pop * (1 - pop)) / nNum);
      if (den !== 0) stat = num / den;
    }

    setTestStat(stat);

  }, [n, sampleVal, popVal, extraVal, mode, chiInputMode]);

  // --- P-Value & CV Logic ---
  useEffect(() => {
    if (!mode) return;
    const type = currentConfig.distType;
    const isLeftSet = cvLeft !== "";
    const isRightSet = cvRight !== "";

    const pLow = MathUtils.cdf(testStat, df, type);
    const pHigh = 1 - pLow;

    let pVal = 0;

    if (isLeftSet && isRightSet) {
      // Two-tailed: take the smaller tail and double it
      pVal = 2 * Math.min(pLow, pHigh);
    } else if (isLeftSet) {
      pVal = pLow;
    } else if (isRightSet) {
      pVal = pHigh;
    } else {
      setPValue(null);
      return;
    }
    
    // Clamp
    setPValue(Math.max(0, Math.min(1.0, pVal)));

  }, [testStat, cvLeft, cvRight, df, mode]);

  // --- Handlers ---
  const updateFromCvLeft = (val) => {
    setCvLeft(val);
    if (val === "" || isNaN(val)) { setAreaLeft(""); return; }
    setAreaLeft(MathUtils.cdf(parseFloat(val), df, currentConfig.distType).toFixed(4));
  };

  const updateFromAreaLeft = (val) => {
    setAreaLeft(val);
    if (val === "" || isNaN(val)) { setCvLeft(""); return; }
    setCvLeft(MathUtils.ppf(parseFloat(val), df, currentConfig.distType).toFixed(3));
  };

  const updateFromCvRight = (val) => {
    setCvRight(val);
    if (val === "" || isNaN(val)) { setAreaRight(""); return; }
    setAreaRight((1 - MathUtils.cdf(parseFloat(val), df, currentConfig.distType)).toFixed(4));
  };

  const updateFromAreaRight = (val) => {
    setAreaRight(val);
    if (val === "" || isNaN(val)) { setCvRight(""); return; }
    setCvRight(MathUtils.ppf(1 - parseFloat(val), df, currentConfig.distType).toFixed(3));
  };

  // --- Canvas Drawing ---
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !mode) return;
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    const type = currentConfig.distType;

    ctx.clearRect(0, 0, width, height);
    
    // Define bounds
    let xMin, xMax, peakY;
    
    if (type === 'chi') {
      xMin = 0;
      xMax = MathUtils.ppf(0.9995, df, 'chi');
      const modeX = df >= 2 ? df - 2 : 0.2;
      peakY = MathUtils.pdf(modeX, df, 'chi') * 1.1;
    } else {
      // Normal / T are centered at 0
      xMin = -5;
      xMax = 5;
      peakY = (type === 't' ? MathUtils.pdf(0, df, 't') : MathUtils.pdf(0, 0, 'normal')) * 1.1;
    }

    const range = xMax - xMin;
    const baselineY = height - 40;
    
    // Map functions
    const mapX = (x) => ((x - xMin) / range) * width;
    const mapY = (y) => baselineY - (y / peakY) * (baselineY - 40);

    // Draw Grid
    ctx.strokeStyle = '#f3f4f6'; ctx.lineWidth = 1; ctx.beginPath();
    for(let i=0; i<=width; i+=width/20) { ctx.moveTo(i,0); ctx.lineTo(i,baselineY); }
    for(let i=0; i<=baselineY; i+=baselineY/10) { ctx.moveTo(0,i); ctx.lineTo(width,i); }
    ctx.stroke();

    // Draw Curve
    ctx.beginPath();
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#4f46e5'; 
    let started = false;
    for (let px = 0; px < width; px++) {
      const x = xMin + (px / width) * range;
      const y = MathUtils.pdf(x, df, type);
      if (!isFinite(y)) continue;
      if (!started) { ctx.moveTo(px, mapY(y)); started = true; }
      else { ctx.lineTo(px, mapY(y)); }
    }
    ctx.stroke();

    // Helper for shading
    const shadeArea = (startX, endX, color) => {
      ctx.fillStyle = color;
      ctx.beginPath();
      // clamp to visible range
      let s = Math.max(xMin, startX);
      let e = Math.min(xMax, endX);
      if (s >= e) return;

      const startPx = mapX(s);
      const endPx = mapX(e);
      
      ctx.moveTo(startPx, baselineY);
      for (let px = startPx; px <= endPx; px++) {
        const x = xMin + ((px) / width) * range;
        const y = MathUtils.pdf(x, df, type);
        ctx.lineTo(px, mapY(y));
      }
      ctx.lineTo(endPx, baselineY);
      ctx.closePath();
      ctx.fill();
    };

    // Left Rejection Region
    if (cvLeft !== "" && !isNaN(parseFloat(cvLeft))) {
      const limit = parseFloat(cvLeft);
      shadeArea(xMin - 1, limit, 'rgba(165, 243, 252, 0.6)');
      
      // Line
      if(limit > xMin && limit < xMax) {
        ctx.beginPath(); ctx.strokeStyle = '#0891b2';
        ctx.moveTo(mapX(limit), baselineY);
        ctx.lineTo(mapX(limit), mapY(MathUtils.pdf(limit, df, type)) - 20);
        ctx.stroke();
        ctx.fillStyle = '#0e7490'; ctx.font = 'bold 12px sans-serif'; ctx.textAlign = 'right';
        ctx.fillText(limit.toFixed(2), mapX(limit) - 5, mapY(MathUtils.pdf(limit, df, type)) - 25);
      }
    }

    // Right Rejection Region
    if (cvRight !== "" && !isNaN(parseFloat(cvRight))) {
      const limit = parseFloat(cvRight);
      shadeArea(limit, xMax + 1, 'rgba(251, 207, 232, 0.6)');
      
       // Line
       if(limit > xMin && limit < xMax) {
        ctx.beginPath(); ctx.strokeStyle = '#be185d';
        ctx.moveTo(mapX(limit), baselineY);
        ctx.lineTo(mapX(limit), mapY(MathUtils.pdf(limit, df, type)) - 20);
        ctx.stroke();
        ctx.fillStyle = '#be185d'; ctx.font = 'bold 12px sans-serif'; ctx.textAlign = 'left';
        ctx.fillText(limit.toFixed(2), mapX(limit) + 5, mapY(MathUtils.pdf(limit, df, type)) - 25);
       }
    }

    // Test Statistic Marker
    const statX = mapX(testStat);
    if (statX >= 0 && statX <= width) {
        ctx.beginPath();
        ctx.lineWidth = 2; ctx.strokeStyle = '#1e293b'; ctx.setLineDash([5, 5]);
        ctx.moveTo(statX, baselineY); ctx.lineTo(statX, 10); ctx.stroke(); ctx.setLineDash([]);
        
        ctx.fillStyle = '#1e293b'; 
        ctx.font = 'bold 12px sans-serif'; 
        ctx.textAlign = 'center';
        ctx.fillText(`${currentConfig.sym.stat}: ${testStat.toFixed(2)}`, statX, baselineY + 20); 
        ctx.textAlign = 'left';
    } 

    // Baseline
    ctx.strokeStyle = '#333'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, baselineY); ctx.lineTo(width, baselineY); ctx.stroke();

  }, [cvLeft, cvRight, df, testStat, areaLeft, areaRight, n, sampleVal, popVal, extraVal, mode, currentConfig]);


  // --- MENU RENDERER ---
  if (!mode) {
    return (
      <div className="min-h-screen bg-gray-50 p-6 font-sans flex items-center justify-center">
        <div className="max-w-4xl w-full">
          <h1 className="text-4xl font-bold text-center text-gray-800 mb-2">Statistical Calculator Suite</h1>
          <p className="text-center text-gray-500 mb-10">Select a hypothesis test to begin</p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <button onClick={() => setMode('chi')} className="bg-white p-8 rounded-2xl shadow-sm hover:shadow-xl border border-gray-200 hover:border-indigo-300 transition-all group text-left">
              <div className="flex items-center gap-4 mb-4">
                <div className="p-3 bg-indigo-100 rounded-xl group-hover:bg-indigo-600 transition-colors">
                  <Activity className="w-8 h-8 text-indigo-600 group-hover:text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-800">Chi-Square Test</h2>
                  <p className="text-sm text-gray-500">Variance (σ²)</p>
                </div>
              </div>
              <p className="text-gray-600 text-sm">Test population variance against a standard. Uses the Chi-Squared distribution (skewed).</p>
            </button>

            <button onClick={() => setMode('t_mean')} className="bg-white p-8 rounded-2xl shadow-sm hover:shadow-xl border border-gray-200 hover:border-blue-300 transition-all group text-left">
              <div className="flex items-center gap-4 mb-4">
                <div className="p-3 bg-blue-100 rounded-xl group-hover:bg-blue-600 transition-colors">
                  <BarChart2 className="w-8 h-8 text-blue-600 group-hover:text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-800">T-Test for Mean</h2>
                  <p className="text-sm text-gray-500">Mean (μ) with unknown σ</p>
                </div>
              </div>
              <p className="text-gray-600 text-sm">Test sample mean against population mean. Uses Student's t-distribution (heavier tails).</p>
            </button>

            <button onClick={() => setMode('z_mean')} className="bg-white p-8 rounded-2xl shadow-sm hover:shadow-xl border border-gray-200 hover:border-violet-300 transition-all group text-left">
              <div className="flex items-center gap-4 mb-4">
                <div className="p-3 bg-violet-100 rounded-xl group-hover:bg-violet-600 transition-colors">
                  <Users className="w-8 h-8 text-violet-600 group-hover:text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-800">Z-Test for Mean</h2>
                  <p className="text-sm text-gray-500">Mean (μ) with known σ</p>
                </div>
              </div>
              <p className="text-gray-600 text-sm">Test sample mean when population deviation is known. Uses Standard Normal distribution.</p>
            </button>

            <button onClick={() => setMode('z_prop')} className="bg-white p-8 rounded-2xl shadow-sm hover:shadow-xl border border-gray-200 hover:border-emerald-300 transition-all group text-left">
              <div className="flex items-center gap-4 mb-4">
                <div className="p-3 bg-emerald-100 rounded-xl group-hover:bg-emerald-600 transition-colors">
                  <PieChart className="w-8 h-8 text-emerald-600 group-hover:text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-800">Z-Test for Proportion</h2>
                  <p className="text-sm text-gray-500">Proportion (p)</p>
                </div>
              </div>
              <p className="text-gray-600 text-sm">Test sample proportion against population claim. Uses Normal approximation.</p>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // --- CALCULATOR RENDERER ---
  return (
    <div className="min-h-screen bg-gray-50 p-4 font-sans text-gray-800 relative">
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* HEADER */}
        <div className="flex justify-between items-center pb-4 border-b border-gray-200">
          <div className="flex items-center gap-4">
            <button onClick={() => setMode(null)} className="p-2 bg-gray-100 hover:bg-gray-200 rounded-full transition-colors">
               <ArrowLeft className="w-5 h-5 text-gray-600" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                <Calculator className={`w-6 h-6 text-${currentConfig.color}-600`} />
                {currentConfig.title}
              </h1>
              <p className="text-sm text-gray-500">Hypothesis Testing Calculator</p>
            </div>
          </div>
          <div className={`text-sm font-mono text-${currentConfig.color}-800 bg-${currentConfig.color}-50 px-3 py-1.5 rounded-lg border border-${currentConfig.color}-100 shadow-sm`}>
            {mode === 'z_prop' || mode === 'z_mean' ? 'Distribution: Normal (Z)' : `df = n - 1 = ${df}`}
          </div>
        </div>

        {/* TOP SECTION: CVs, p-value, and GRAPH */}
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
                   Distribution: {mode === 'chi' ? 'Chi-Square' : mode === 't_mean' ? "Student's t" : "Standard Normal"}
                </div>
            </div>
        </div>

        {/* INPUTS GRID */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* COLUMN 1: FORMULA */}
            <div className="bg-white rounded-2xl shadow-md border border-gray-200 p-6 flex flex-col justify-center items-center">
                <h3 className="text-gray-400 font-bold text-xs uppercase tracking-widest mb-4">Test Statistic Formula</h3>
                <div className="text-xl md:text-3xl font-serif italic text-gray-800 mb-2">
                    {mode === 'chi' && (
                       <span>χ² = <span className="inline-block align-middle text-center"><span className="block border-b-2 border-gray-800 px-1">(n-1)s²</span><span className="block px-1">σ²</span></span></span>
                    )}
                    {mode === 't_mean' && (
                       <span>t = <span className="inline-block align-middle text-center"><span className="block border-b-2 border-gray-800 px-1">x̄ - μ</span><span className="block px-1">s / √n</span></span></span>
                    )}
                    {mode === 'z_mean' && (
                       <span>z = <span className="inline-block align-middle text-center"><span className="block border-b-2 border-gray-800 px-1">x̄ - μ</span><span className="block px-1">σ / √n</span></span></span>
                    )}
                    {mode === 'z_prop' && (
                       <span>z = <span className="inline-block align-middle text-center"><span className="block border-b-2 border-gray-800 px-1">p̂ - p</span><span className="block px-1">√p(1-p)/n</span></span></span>
                    )}
                </div>
                <div className="mt-4 p-3 bg-gray-50 rounded-lg text-center w-full">
                    <div className="text-xs text-gray-500 mb-1">Calculated Value</div>
                    <div className={`text-xl font-bold text-${currentConfig.color}-600 font-mono`}>{testStat.toFixed(4)}</div>
                </div>
            </div>

            {/* COLUMN 2: INPUTS */}
            <div className="bg-white rounded-2xl shadow-md border border-gray-200 p-6 space-y-4 relative">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-gray-400 font-bold text-xs uppercase tracking-widest">Sample Data</h3>
                    {mode === 'chi' && (
                        <div className="flex bg-gray-100 p-1 rounded-lg border border-gray-200">
                            <button onClick={() => setChiInputMode('sd')} className={`px-3 py-1 text-sm font-bold rounded-md transition-all ${chiInputMode === 'sd' ? 'bg-white text-indigo-600 shadow-sm border border-gray-200' : 'text-gray-400 hover:text-gray-600'}`}>σ</button>
                            <button onClick={() => setChiInputMode('var')} className={`px-3 py-1 text-sm font-bold rounded-md transition-all ${chiInputMode === 'var' ? 'bg-white text-indigo-600 shadow-sm border border-gray-200' : 'text-gray-400 hover:text-gray-600'}`}>σ²</button>
                        </div>
                    )}
                </div>

                {/* N Input */}
                <div className="flex items-center gap-4">
                    <label className="w-16 text-xl font-serif italic font-bold text-right">n =</label>
                    <input type="number" value={n} onChange={(e) => setN(e.target.value)}
                        className="flex-1 p-3 text-lg border-2 border-gray-200 rounded-xl focus:border-indigo-500 outline-none transition-all font-handwritten" />
                </div>

                {/* Sample Statistic Input */}
                <div className="flex items-center gap-4">
                    <label className="w-16 text-xl font-serif italic font-bold text-right">
                       {mode === 'chi' ? (chiInputMode === 'sd' ? 's =' : 's² =') : `${currentConfig.sym.sample} =`}
                    </label>
                    <input type="number" inputMode="decimal" step="0.001" value={sampleVal} onChange={(e) => setSampleVal(e.target.value)}
                        className={`flex-1 p-3 text-lg border-2 border-gray-200 rounded-xl focus:border-indigo-500 outline-none transition-all ${noSpinClass}`} />
                </div>

                {/* Population Param Input */}
                <div className="flex items-center gap-4">
                    <label className="w-16 text-xl font-serif italic font-bold text-right">
                      {mode === 'chi' ? (chiInputMode === 'sd' ? 'σ =' : 'σ² =') : `${currentConfig.sym.pop} =`}
                    </label>
                    <input type="number" inputMode="decimal" step="0.001" value={popVal} onChange={(e) => setPopVal(e.target.value)}
                        className={`flex-1 p-3 text-lg border-2 border-gray-200 rounded-xl focus:border-indigo-500 outline-none transition-all ${noSpinClass}`} />
                </div>

                {/* Extra Input (Sigma for Z-Mean, s for T-Mean) */}
                {(mode === 'z_mean' || mode === 't_mean') && (
                     <div className="flex items-center gap-4">
                        <label className="w-16 text-xl font-serif italic font-bold text-right">
                           {mode === 'z_mean' ? 'σ =' : 's ='}
                        </label>
                        <input type="number" inputMode="decimal" step="0.001" value={extraVal} onChange={(e) => setExtraVal(e.target.value)}
                            className={`flex-1 p-3 text-lg border-2 border-gray-200 rounded-xl focus:border-indigo-500 outline-none transition-all ${noSpinClass}`} />
                    </div>
                )}
            </div>

            {/* COLUMN 3: HYPOTHESIS & CONCLUSION */}
            <div className="bg-white rounded-2xl shadow-md border border-gray-200 p-6 space-y-4 flex flex-col">
                <h3 className="text-gray-400 font-bold text-xs uppercase tracking-widest mb-2">Hypothesis</h3>
                
                <div className="flex items-center gap-3">
                    <label className="text-xl font-serif italic font-bold w-10">H₀:</label>
                    <span className={`text-2xl font-serif italic text-${currentConfig.color}-600 font-semibold`}>
                        {mode === 'chi' ? (chiInputMode === 'sd' ? 'σ' : 'σ²') : currentConfig.sym.pop}
                    </span>
                    <div className="flex-1 text-center py-2 text-xl font-mono text-gray-500 border-2 border-transparent">=</div>
                    <span className="text-xl font-mono text-gray-700 bg-gray-50 px-3 py-2 rounded-lg border-2 border-transparent w-24 text-center">{popVal || '0'}</span>
                </div>

                <div className="flex items-center gap-3">
                    <label className="text-xl font-serif italic font-bold w-10">H₁:</label>
                    <span className={`text-2xl font-serif italic text-${currentConfig.color}-600 font-semibold`}>
                        {mode === 'chi' ? (chiInputMode === 'sd' ? 'σ' : 'σ²') : currentConfig.sym.pop}
                    </span>
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
                    <span className="text-xl font-mono text-gray-700 bg-gray-50 px-3 py-2 rounded-lg border-2 border-transparent w-24 text-center">{popVal || '0'}</span>
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

      </div>
    </div>
  );
};

export default App;