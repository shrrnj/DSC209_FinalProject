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


// ============================
// Line Chart: Gas Emissions by Continent
// ============================
d3.csv("data/Indicator_1_1_annual_6562429754166382300.csv").then(function(data) {

  // --- 1. Filter for continent-level rows ---
  const continents = ["Africa", "Asia", "Europe", "Oceania", "Americas"];
  const filteredData = data.filter(d => continents.includes(d.Country));

  // --- 2. Convert data to long form ---
  const years = d3.range(2010, 2024);
  let longData = [];
  filteredData.forEach(d => {
    years.forEach(y => {
      longData.push({
        Country: d.Country,
        GasType: d["Gas Type"],
        Year: +y,
        Value: +d[y]
      });
    });
  });

  // --- 3. Flatten grouped data (sum duplicates if any) ---
  const grouped = d3.rollups(
    longData,
    v => d3.sum(v, d => d.Value),
    d => d.Country,
    d => d.GasType,
    d => d.Year
  );

  const flatData = [];
  grouped.forEach(([country, gasMap]) => {
    gasMap.forEach(([gas, yearMap]) => {
      yearMap.forEach(([year, value]) => {
        flatData.push({Country: country, GasType: gas, Year: +year, Value: +value});
      });
    });
  });

  // --- 4. Dropdown for Gas Types ---
  const gasTypes = Array.from(new Set(flatData.map(d => d.GasType)));
  const dropdown = d3.select("#gasDropdown");
  dropdown.selectAll("option")
    .data(gasTypes)
    .join("option")
    .attr("value", d => d)
    .text(d => d);

  // --- 5. Setup SVG & chart area ---
  const svg = d3.select("#chartContinent");
  const width = 800, height = 500;
  const margin = {top: 40, right: 100, bottom: 40, left: 60};
  const chartWidth = width - margin.left - margin.right;
  const chartHeight = height - margin.top - margin.bottom;

  const g = svg.append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  const x = d3.scaleLinear().domain(d3.extent(years)).range([0, chartWidth]);
  const y = d3.scaleLinear().range([chartHeight, 0]);
  const color = d3.scaleOrdinal(d3.schemeTableau10).domain(continents);

  const xAxis = g.append("g")
    .attr("transform", `translate(0,${chartHeight})`)
    .attr("class", "x-axis");
  const yAxis = g.append("g")
    .attr("class", "y-axis");

  // Axis labels
  g.append("text")
    .attr("x", chartWidth / 2)
    .attr("y", chartHeight + 35)
    .attr("text-anchor", "middle")
    .attr("class", "axis-label")
    .text("Year");

  g.append("text")
    .attr("transform", "rotate(-90)")
    .attr("x", -chartHeight / 2)
    .attr("y", -45)
    .attr("text-anchor", "middle")
    .attr("class", "axis-label")
    .text("Gas emissions (Million metric tons of CO2 equivalent)");

  const line = d3.line().x(d => x(d.Year)).y(d => y(d.Value));

  // --- Tooltip ---
  const tooltip = d3.select("body").append("div")
    .attr("class", "tooltip");

  const focusCircle = g.append("circle")
    .attr("r", 4)
    .style("opacity", 0);

  // --- Update function ---
  function update(gasType) {
    const filtered = flatData.filter(d => d.GasType === gasType);
    y.domain([0, d3.max(filtered, d => d.Value)]).nice();

    xAxis.call(d3.axisBottom(x).tickFormat(d3.format("d")));
    yAxis.call(d3.axisLeft(y));

    const byCountry = d3.groups(filtered, d => d.Country);

    const lines = g.selectAll(".line").data(byCountry, d => d[0]);
    lines.enter()
      .append("path")
      .attr("class", "line")
      .attr("fill", "none")
      .attr("stroke-width", 2)
      .merge(lines)
      .attr("stroke", d => color(d[0]))
      .transition()
      .duration(750)
      .attr("d", d => line(d[1]));
    lines.exit().remove();

    // Legend
    g.selectAll(".legend-group").remove();
    const legendGroup = g.append("g")
      .attr("class", "legend-group")
      .attr("transform", "translate(0, -20)");
    const legend = legendGroup.selectAll(".legend")
      .data(continents)
      .join("g")
      .attr("class", "legend")
      .attr("transform", (d, i) => `translate(${i * 100}, 0)`);
    legend.append("rect")
      .attr("x", 0)
      .attr("y", -10)
      .attr("width", 14)
      .attr("height", 14)
      .attr("fill", d => color(d));
    legend.append("text")
      .attr("x", 20)
      .attr("y", 2)
      .text(d => d)
      .style("font-size", "12px")
      .style("alignment-baseline", "middle");

    // Tooltip interaction
    svg.on("mousemove", function(event) {
      const [mx, my] = d3.pointer(event, svg.node());
      const xYear = Math.round(x.invert(mx - margin.left));
      if (xYear < years[0] || xYear > years[years.length - 1]) {
        tooltip.style("opacity", 0);
        focusCircle.style("opacity", 0);
        return;
      }

      const valuesAtYear = byCountry.map(([country, vals]) => {
        const v = vals.find(d => d.Year === xYear);
        return v ? {country, ...v} : null;
      }).filter(Boolean);

      if (valuesAtYear.length) {
        valuesAtYear.forEach(d => {
          focusCircle
            .attr("cx", x(d.Year))
            .attr("cy", y(d.Value))
            .attr("fill", color(d.country))
            .style("opacity", 1);

          tooltip
            .style("opacity", 1)
            .html(`<b>${d.country}</b><br>Year: ${d.Year}<br>Value: ${d3.format(",.2f")(d.Value)}`)
            .style("left", (event.pageX + 12) + "px")
            .style("top", (event.pageY - 28) + "px");
        });
      }
    });

    svg.on("mouseleave", function() {
      tooltip.style("opacity", 0);
      focusCircle.style("opacity", 0);
    });
  }

  // Initialize
  const defaultGas = gasTypes[0];
  update(defaultGas);
  dropdown.on("change", e => update(e.target.value));

});


// ============================
// Streamgraph: Gas Emissions in Asian Subregions
// ============================
d3.csv("data/Indicator_1_1_annual_6562429754166382300.csv").then(data => {
  const subregions = ['Central Asia', 'Eastern Asia', 'South-eastern Asia', 'Southern Asia', 'Western Asia'];
  const years = d3.range(2010, 2024);

  const longData = [];
  data.forEach(d => {
    if(subregions.includes(d.Country.trim())){
      years.forEach(y => {
        longData.push({
          subregion: d.Country.trim(),
          gas: d["Gas Type"].trim(),
          year: +y,
          value: +d[y]
        });
      });
    }
  });

  // Dropdown for Gas Type
  const gasTypes = Array.from(new Set(longData.map(d => d.gas)));
  const dropdown = d3.select("#gasDropdownSubregion");
  dropdown.selectAll("option")
    .data(gasTypes)
    .join("option")
    .attr("value", d => d)
    .text(d => d);

  let selectedGas = gasTypes[0];
  dropdown.on("change", function(){
    selectedGas = this.value;
    update(selectedGas);
  });

  // SVG setup
  const svg = d3.select("#streamSubregion");
  const width = +svg.attr("width");
  const height = +svg.attr("height");
  const margin = {top:40,right:150,bottom:40,left:60};
  const chartWidth = width - margin.left - margin.right;
  const chartHeight = height - margin.top - margin.bottom;
  const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

  const x = d3.scaleLinear().domain(d3.extent(years)).range([0, chartWidth]);
  const y = d3.scaleLinear().range([chartHeight,0]);
  const color = d3.scaleOrdinal(d3.schemeTableau10).domain(subregions);

  const xAxis = g.append("g").attr("transform", `translate(0,${chartHeight})`);
  const yAxis = g.append("g");

  const tooltip = d3.select("#tooltip");

  const area = d3.area()
    .x(d => x(d.data.year))
    .y0(d => y(d[0]))
    .y1(d => y(d[1]))
    .curve(d3.curveBasis);


  // Add vertical guide line *on top of layers*
  const guideLine = g.append("line")
    .attr("stroke","#555")
    .attr("stroke-width",1)
    .attr("y1",0)
    .attr("y2",chartHeight)
    .style("opacity",0);

  // Layers group container (so we can control order)
  const layersGroup = g.append("g").attr("class","layers");

  // --- Update function ---
  function update(gas){
      const gasData = longData.filter(d => d.gas === gas);
      const pivotData = years.map(y => {
        const row = {year: y};
        subregions.forEach(s => {
          const found = gasData.find(d => d.year===y && d.subregion===s);
          row[s] = found ? found.value : 0;
        });
        return row;
      });

      const stack = d3.stack().keys(subregions)(pivotData);
      y.domain([0, d3.max(stack[stack.length-1], d => d[1])]).nice();

      xAxis.transition().duration(500).call(d3.axisBottom(x).tickFormat(d3.format("d")));
      yAxis.transition().duration(500).call(d3.axisLeft(y));

      const layers = layersGroup.selectAll(".layer").data(stack, d=>d.key);

      layers.join(
        enter => enter.append("path")
                      .attr("class","layer")
                      .attr("fill", d => {
                          if(d.key==="Western Asia") return "#ff7f0e";       // highlight Western Asia
                          if(d.key==="Southern Asia" && gas.includes("Fluorinated")) return "#2ca02c"; // highlight Southern Asia for Fluorinated
                          return color(d.key);
                      })
                      .attr("opacity", d => {
                          if(d.key==="Western Asia" || (d.key==="Southern Asia" && gas.includes("Fluorinated"))) return 0.9;
                          return 0.7;
                      })
                      .attr("d", area)
                      .on("mousemove", (event,d)=>{
                          const [mx] = d3.pointer(event);
                          const yearVal = Math.round(x.invert(mx));
                          const stackedPoint = pivotData.find(p=>p.year===yearVal) || pivotData[pivotData.length-1];
                          const value = stackedPoint[d.key];

                          // Tooltip content
                          let html = `<b>${d.key}</b><br>Year: ${yearVal}<br>Value: ${d3.format(",.0f")(value)} MtCO₂e`;
                          if(d.key==="Western Asia") html += "<br><b>Leader for all gases!</b>";
                          if(d.key==="Southern Asia" && gas.includes("Fluorinated")) html += "<br><b>Leader for Fluorinated gases!</b>";

                          tooltip.style("opacity",1)
                            .style("left", (event.pageX+10)+"px")
                            .style("top", (event.pageY-10)+"px")
                            .html(html);

                          guideLine
                            .attr("x1", x(yearVal))
                            .attr("x2", x(yearVal))
                            .style("opacity",1);
                      })
                      .on("mouseleave", ()=>{
                          tooltip.style("opacity",0);
                          guideLine.style("opacity",0);
                      }),
        update => update.transition().duration(500)
                        .attr("fill", d => {
                          if(d.key==="Western Asia") return "#ff7f0e";
                          if(d.key==="Southern Asia" && gas.includes("Fluorinated")) return "#2ca02c";
                          return color(d.key);
                        })
                        .attr("opacity", d => {
                          if(d.key==="Western Asia" || (d.key==="Southern Asia" && gas.includes("Fluorinated"))) return 0.9;
                          return 0.7;
                        })
                        .attr("d", area),
        exit => exit.remove()
      );

      // Legend
      g.selectAll(".legend-group").remove();
      const legendGroup = g.append("g")
        .attr("class","legend-group")
        .attr("transform", `translate(${chartWidth + 20}, 0)`);

      const legend = legendGroup.selectAll(".legend")
        .data(subregions)
        .join("g")
        .attr("class","legend")
        .attr("transform", (d,i)=>`translate(0, ${i*20})`);

      legend.append("rect")
        .attr("x",0).attr("y",0)
        .attr("width",14).attr("height",14)
        .attr("fill", d => {
          if(d==="Western Asia") return "#ff7f0e";
          if(d==="Southern Asia" && gas.includes("Fluorinated")) return "#2ca02c";
          return color(d);
        });

      legend.append("text")
        .attr("x",20).attr("y",12)
        .text(d=>d)
        .style("font-size","12px");
  }

  update(selectedGas);
});