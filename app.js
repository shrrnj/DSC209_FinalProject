// --- Controls ---
const regionSel = document.getElementById("regionSel");
const modeSel   = document.getElementById("modeSel");     // 'industry' | 'gas'
const yearChips = document.getElementById("yearChips");
const yearsSummary = document.getElementById("yearsSummary");
const tipEl = document.getElementById("tooltip");
const tip = d3.select(tipEl);

// --- SVG (stacked bars) ---
const svg = d3.select("#chartMain");
const W=960, H=560, M={t:26,r:24,b:44,l:230};
const innerW = W - M.l - M.r, innerH = H - M.t - M.b;
const g = svg.append("g").attr("transform",`translate(${M.l},${M.t})`);
const gx = g.append("g").attr("class","axis").attr("transform",`translate(0,${innerH})`);
const gy = g.append("g").attr("class","axis");
const x = d3.scaleLinear().range([0, innerW]);
const y = d3.scaleBand().range([0, innerH]).padding(0.12);

// Colors + legend
const palette = d3.schemeTableau10.concat(d3.schemeSet3);
const segColor = d3.scaleOrdinal().range(palette);
function drawLegend(keys){
  const wrap = d3.select("#legendMain").attr("class","legend");
  const items = wrap.selectAll(".item").data(keys, d=>d);
  const enter = items.enter().append("div").attr("class","item");
  enter.append("span").attr("class","sw").style("background", d=>segColor(d));
  enter.append("span").text(d=>d);
  items.exit().remove();
}

// Tooltip helpers (viewport-clamped)
function showTipSmart(html, evt){
  tipEl.innerHTML = html;
  tip.style("opacity",1);

  const pad = 10;
  const { clientWidth:w, clientHeight:h } = tipEl;

  let xPos = evt.clientX + 16;
  let yPos = evt.clientY - h - 16;

  if (yPos < pad) yPos = evt.clientY + 16;
  if (xPos + w + pad > window.innerWidth) xPos = window.innerWidth - w - pad;
  if (xPos < pad) xPos = pad;

  if (yPos + h + pad > window.innerHeight) yPos = window.innerHeight - h - pad;
  if (yPos < pad) yPos = pad;

  tip.style("left", `${xPos}px`).style("top", `${yPos}px`);
}
function hideTip(){ tip.style("opacity",0); }

// Data file
const FILE = "data/Indicator_1_1_annual_6562429754166382300.csv";

d3.csv(FILE).then(raw => {
  // Detect years and coerce numbers
  const years = Object.keys(raw[0]).filter(k => /^\d{4}$/.test(k)).map(Number).sort((a,b)=>a-b);
  raw.forEach(r => years.forEach(y => r[y] = +r[y]));

  // Long rows with region
  const rows = [];
  const gases = new Set(), inds = new Set();
  raw.forEach(r=>{
    const region = r.Country;
    const gas = r["Gas Type"] || "Unknown gas";
    const ind = r["Industry"]  || "Unknown industry";
    gases.add(gas); inds.add(ind);
    years.forEach(y=>{
      const v = +r[y];
      if(!Number.isFinite(v)) return;
      rows.push({ region, gas, industry: ind, year: y, value: v });
    });
  });
  const gasList = Array.from(gases);
  const indList = Array.from(inds);

  // State
  const state = {
    region: regionSel.value,
    mode: modeSel.value,
    years: [years[years.length-1]]   // default: last year
  };

  // ----- Year chips -----
  function renderYearChips(){
    yearChips.innerHTML = "";
    years.forEach(y=>{
      const chip = document.createElement("div");
      chip.className = "chip" + (state.years.includes(y) ? " active" : "");
      chip.setAttribute("role","button");
      chip.setAttribute("aria-pressed", state.years.includes(y) ? "true" : "false");
      chip.title = "Click to toggle";
      chip.innerHTML = `<span class="sw"></span><span>${y}</span>`;
      chip.addEventListener("click", ()=>{
        const idx = state.years.indexOf(y);
        if(idx>=0){ state.years.splice(idx,1); }
        else { state.years.push(y); }
        if(state.years.length===0){ state.years = [y]; }  // keep at least one year
        renderYearChips();
        update();
      });
      yearChips.appendChild(chip);
    });
    const ys = [...state.years].sort((a,b)=>a-b);
    yearsSummary.textContent = `Selected years: ${ys.join(", ")}`;
  }

  // Events
  regionSel.addEventListener("change", ()=>{ state.region = regionSel.value; update(); });
  modeSel.addEventListener("change",   ()=>{ state.mode   = modeSel.value;   update(); });

  // Build snapshot for region + selected years (sum across years)
  function snapshot(region, mode, selYears){
    const src = rows.filter(d => d.region === region && selYears.includes(d.year));

    if(mode === "industry"){
      // bars = industries; stacks = all gases
      const segKeys = gasList.slice(); segColor.domain(segKeys);
      const by = d3.rollups(src, v=>d3.sum(v,d=>d.value), d=>d.industry, d=>d.gas);
      const bars = by.map(([name, bySeg]) => {
        const obj = Object.fromEntries(bySeg);
        segKeys.forEach(k => { if(!(k in obj)) obj[k]=0; });
        return { name, ...obj };
      });
      return {bars, segKeys};

    } else {
      // bars = gases; stacks = all industries
      const segKeys = indList.slice(); segColor.domain(segKeys);
      const by = d3.rollups(src, v=>d3.sum(v,d=>d.value), d=>d.gas, d=>d.industry);
      const bars = by.map(([name, bySeg]) => {
        const obj = Object.fromEntries(bySeg);
        segKeys.forEach(k => { if(!(k in obj)) obj[k]=0; });
        return { name, ...obj };
      });
      return {bars, segKeys};
    }
  }

  function update(){
    const {bars, segKeys} = snapshot(state.region, state.mode, state.years);

    // totals & sorting (always largest first)
    bars.forEach(d => d._total = segKeys.reduce((s,k)=> s + (d[k]||0), 0));
    bars.sort((a,b)=>d3.descending(a._total,b._total));

    const yrText = [...state.years].sort((a,b)=>a-b).join(", ");
    d3.select("#snapTitle").text(
      `Snapshot · ${state.region} · ${state.mode==='industry'?'Industries (stacked by Gas)':'Gases (stacked by Industry)'} · Years: ${yrText}`
    );

    drawLegend(segKeys);

    const stack = d3.stack().keys(segKeys).value((d,k)=> d[k]||0);
    const series = stack(bars);

    x.domain([0, d3.max(bars, d=>d._total)||1]);
    y.domain(bars.map(d=>d.name));

    gx.transition().duration(300).call(d3.axisBottom(x).ticks(6,".2s"));
    gy.transition().duration(300).call(d3.axisLeft(y));

    g.selectAll(".layer").remove();
    const layers = g.selectAll(".layer").data(series, d=>d.key);
    const enterL = layers.enter().append("g").attr("class","layer").attr("fill", d=>segColor(d.key));

    enterL.selectAll("rect")
      .data(d => d.map(p => ({seg:d.key, data:p.data, y0:p[0], y1:p[1]})), d=>d.data.name)
      .enter().append("rect")
      .attr("x", d=>x(d.y0))
      .attr("y", d=>y(d.data.name))
      .attr("height", y.bandwidth())
      .attr("width", d=>x(d.y1)-x(d.y0))
      .on("mousemove", (event, d)=>{
        const total = d.data._total||0;
        const v = d.data[d.seg]||0;
        const pct = total ? (100*v/total).toFixed(1) : "0.0";
        const otherDim = state.mode==='industry' ? 'Gas' : 'Industry';
        const yrText = [...state.years].sort((a,b)=>a-b).join(", ");
        const html = `<b>${state.region}</b><br>${state.mode==='industry'?'Industry':'Gas'}: <b>${d.data.name}</b><br>${otherDim}: <b>${d.seg}</b><br>Years: ${yrText}<br>Total: ${d3.format(",.0f")(v)} MtCO₂e<br>Share of bar: ${pct}%`;
        showTipSmart(html, event);
      })
      .on("mouseleave", hideTip);
  }

  // init
  renderYearChips();
  update();
});