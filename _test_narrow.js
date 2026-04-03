// Test narrow-amplitude rule: Stoch period 9→5, ROC weight 0.15→0.25, BB weight 0.10→0.00
const fs = require('fs');
const raw = JSON.parse(fs.readFileSync('d:/BOT/vn30_300d_utf8.json', 'utf8').replace(/^\uFEFF/, ''));
const ohlcv = raw.data.map(d => ({
  date: d.timestamp.split(' ')[0], open: d.open, high: d.high, low: d.low, close: d.close, volume: d.volume,
}));
const closes = ohlcv.map(d => d.close);
const highs = ohlcv.map(d => d.high);
const lows = ohlcv.map(d => d.low);

function calcRSI(data, period) {
  const rsi = new Array(data.length).fill(null);
  if (data.length < period + 1) return rsi;
  let ag = 0, al = 0;
  for (let i = 1; i <= period; i++) { const c = data[i]-data[i-1]; c>0?ag+=c:al+=Math.abs(c); }
  ag/=period; al/=period;
  rsi[period] = al===0?100:100-100/(1+ag/al);
  for (let i = period+1; i < data.length; i++) {
    const c = data[i]-data[i-1]; const g=c>0?c:0; const l=c<0?Math.abs(c):0;
    ag=(ag*(period-1)+g)/period; al=(al*(period-1)+l)/period;
    rsi[i] = al===0?100:100-100/(1+ag/al);
  }
  return rsi;
}
function calcStoch(data, h, l, period) {
  const s = new Array(data.length).fill(null);
  for (let i = period-1; i < data.length; i++) {
    const hh = Math.max(...h.slice(i-period+1,i+1));
    const ll = Math.min(...l.slice(i-period+1,i+1));
    s[i] = hh===ll?50:((data[i]-ll)/(hh-ll))*100;
  }
  return s;
}
function calcROC(data, period) {
  const r = new Array(data.length).fill(null);
  for (let i=period;i<data.length;i++) if(data[i-period]!==0) r[i]=((data[i]-data[i-period])/data[i-period])*100;
  return r;
}
function calcBB(data, period) {
  const r = new Array(data.length).fill(null);
  for (let i=period-1;i<data.length;i++){
    const sl=data.slice(i-period+1,i+1);
    const ma=sl.reduce((a,b)=>a+b,0)/period;
    const std=Math.sqrt(sl.reduce((a,b)=>a+(b-ma)**2,0)/period);
    const u=ma+2*std,lo=ma-2*std;
    r[i]=u===lo?50:((data[i]-lo)/(u-lo))*100;
  }
  return r;
}

function compute(stochPeriod, wRSI, wStoch, wROC, wBB, label, rsiPeriod=14) {
  const rsi = calcRSI(closes, rsiPeriod);
  const stoch = calcStoch(closes, highs, lows, stochPeriod);
  const roc5 = calcROC(closes, 5);
  const bb = calcBB(closes, 20);
  const scores = [];
  for (let i = 0; i < ohlcv.length; i++) {
    if (rsi[i] === null || stoch[i] === null) continue;
    const rsiScore = (rsi[i] / 100) * 5;
    const stochScore = (stoch[i] / 100) * 5;
    let rocScore = 2.5;
    if (roc5[i] !== null) {
      const start = Math.max(0, i - 59);
      const rw = []; for (let j = start; j <= i; j++) if (roc5[j] !== null) rw.push(roc5[j]);
      if (rw.length > 1) { const mn = Math.min(...rw), mx = Math.max(...rw); if (mx !== mn) rocScore = Math.max(0, Math.min(1, (roc5[i] - mn) / (mx - mn))) * 5; }
    }
    const bbScore = bb[i] !== null ? Math.max(0, Math.min(5, (bb[i] / 100) * 5)) : 2.5;
    const score = wRSI * rsiScore + wStoch * stochScore + wROC * rocScore + wBB * bbScore;
    scores.push({ date: ohlcv[i].date, rpi: Math.round(score * 100) / 100 });
  }
  for (let i = 0; i < scores.length; i++) {
    scores[i].ma7 = i >= 6 ? Math.round(scores.slice(i - 6, i + 1).reduce((s, d) => s + d.rpi, 0) / 7 * 100) / 100 : null;
  }
  const rpis = scores.map(s => s.rpi);
  const a4 = rpis.filter(r => r > 4).length;
  const b1 = rpis.filter(r => r < 1).length;
  const cp = ['2026-01-26', '2026-02-13', '2026-03-19', '2026-03-06'];
  console.log(`\n=== ${label} ===`);
  console.log(`  Stoch(${stochPeriod}) RSI(${rsiPeriod}) | RSI=${wRSI} Stoch=${wStoch} ROC=${wROC} BB=${wBB}`);
  for (const d of cp) { const e = scores.find(s => s.date === d); if (e) console.log(`  ${d} | RPI=${e.rpi.toFixed(2)} MA7=${e.ma7?.toFixed(2) ?? 'null'}`); }
  console.log(`  Min=${Math.min(...rpis).toFixed(2)} Max=${Math.max(...rpis).toFixed(2)} Mean=${(rpis.reduce((a,b)=>a+b,0)/rpis.length).toFixed(2)}`);
  console.log(`  >4.0: ${a4}/${rpis.length} (${(a4/rpis.length*100).toFixed(1)}%)`);
  console.log(`  <1.0: ${b1}/${rpis.length} (${(b1/rpis.length*100).toFixed(1)}%)`);
}

console.log('========== TOP CONTENDERS + EXTREME PUSH ==========');
// Best from round 1
compute(5, 0.20, 0.55, 0.25, 0.00, 'V8-RSI7',  7);
compute(5, 0.15, 0.60, 0.25, 0.00, 'V9-RSI7',  7);
compute(5, 0.20, 0.55, 0.25, 0.00, 'V8-RSI5',  5);

// Push Stoch even higher
compute(5, 0.10, 0.65, 0.25, 0.00, 'V10-RSI7', 7);
compute(5, 0.05, 0.70, 0.25, 0.00, 'V11-RSI7', 7);
compute(5, 0.00, 0.75, 0.25, 0.00, 'V12-noRSI', 7);
compute(5, 0.10, 0.65, 0.25, 0.00, 'V10-RSI5', 5);
compute(5, 0.05, 0.70, 0.25, 0.00, 'V11-RSI5', 5);

// ROC weight higher (30%)
compute(5, 0.15, 0.55, 0.30, 0.00, 'V13-RSI7-ROC30', 7);
compute(5, 0.10, 0.60, 0.30, 0.00, 'V14-RSI7-ROC30', 7);
compute(5, 0.10, 0.55, 0.35, 0.00, 'V15-RSI7-ROC35', 7);

// Stoch(3) + RSI(7) — more noise
compute(3, 0.15, 0.60, 0.25, 0.00, 'V16-Stoch3-RSI7', 7);
compute(3, 0.10, 0.65, 0.25, 0.00, 'V17-Stoch3-RSI7', 7);
