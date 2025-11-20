(function () {
    const FILE = "data/Indicator_1_1_annual_6562429754166382300.csv";
  
    const subregions = [
      "Central Asia",
      "Eastern Asia",
      "South-eastern Asia",
      "Southern Asia",
      "Western Asia"
    ];
  
    const svg = d3.select("#chartRadialAsia");
    if (svg.empty()) return; 
  
    const width = 720;
    const height = 720;
    const innerRadius = 50;
    const outerRadius = Math.min(width, height) / 2 - 40;
  
    svg.attr("viewBox", `0 0 ${width} ${height}`);
  
    const g = svg
      .append("g")
      .attr("transform", `translate(${width / 2},${height / 2})`);
  
    const angle = d3
      .scaleBand()
      .domain(subregions)
      .range([0, 2 * Math.PI])
      .align(0.1);
  
    const centerYear = g
      .append("text")
      .attr("text-anchor", "middle")
      .attr("dy", "0.35em")
      .attr("font-size", 30)
      .attr("fill", "#333");
  
    function drawGrid(radiusScale, maxTotal) {
      const gridValues = [0.25, 0.5, 0.75, 1].map(f => f * maxTotal);
      const circles = g.selectAll(".radial-grid").data(gridValues);
  
      circles
        .enter()
        .append("circle")
        .attr("class", "radial-grid")
        .attr("fill", "none")
        .attr("stroke", "#e2e8f0")
        .attr("stroke-width", 1)
        .merge(circles)
        .attr("r", d => radiusScale(d));
  
      circles.exit().remove();
    }
  
    const tipEl = document.getElementById("tooltip");
    const tip = d3.select(tipEl);
  
    function showTipSmart(html, evt) {
      tipEl.innerHTML = html;
      tip.style("opacity", 1);
  
      const pad = 10;
      const { clientWidth: w, clientHeight: h } = tipEl;
  
      let xPos = evt.clientX + 16;
      let yPos = evt.clientY - h - 16;
  
      if (yPos < pad) yPos = evt.clientY + 16;
      if (xPos + w + pad > window.innerWidth) xPos = window.innerWidth - w - pad;
      if (xPos < pad) xPos = pad;
      if (yPos + h + pad > window.innerHeight) yPos = window.innerHeight - h - pad;
      if (yPos < pad) yPos = pad;
  
      tip.style("left", `${xPos}px`).style("top", `${yPos}px`);
    }
  
    function hideTip() {
      tip.style("opacity", 0);
    }
  
    d3.csv(FILE, d3.autoType).then(data => {
      const filtered = data.filter(
        d =>
          d["Gas Type"] === "Greenhouse gas" &&
          subregions.includes((d.Country || "").trim())
      );
  
      const yearCols = Object.keys(data[0]).filter(k => /^\d{4}$/.test(k));
      const years = yearCols.map(Number).sort((a, b) => a - b);
  
      const industrySet = new Set();
      filtered.forEach(d => {
        if (d.Industry) industrySet.add(d.Industry);
      });
      const industries = Array.from(industrySet).sort();
  
      // aggregate: for each year -> subregion -> industry -> value
      const totalsByYear = {};
      let globalMaxTotal = 0;
  
      years.forEach(y => {
        const yStr = String(y);
        const bySub = new Map();
  
        filtered.forEach(d => {
          const region = d.Country.trim();
          const ind = d.Industry;
          const val = +d[yStr] || 0;
          if (!val) return;
  
          if (!bySub.has(region)) bySub.set(region, new Map());
          const m = bySub.get(region);
          m.set(ind, (m.get(ind) || 0) + val);
        });
  
        totalsByYear[y] = bySub;
  
        subregions.forEach(region => {
          const m = bySub.get(region);
          if (!m) return;
          const total = Array.from(m.values()).reduce((s, v) => s + v, 0);
          if (total > globalMaxTotal) globalMaxTotal = total;
        });
      });
  
      const radius = d3
        .scaleLinear()
        .domain([0, globalMaxTotal])
        .range([innerRadius, outerRadius]);
  
      drawGrid(radius, globalMaxTotal);
  
      const color = d3
        .scaleOrdinal()
        .domain(industries)
        .range(d3.schemeTableau10.concat(d3.schemeSet3));
  
      const arc = d3
        .arc()
        .startAngle(d => angle(d.region))
        .endAngle(d => angle(d.region) + angle.bandwidth())
        .innerRadius(d => radius(d.r0))
        .outerRadius(d => radius(d.r1))
        .padAngle(0.02)
        .padRadius(innerRadius);
  
      const labelRadius = outerRadius + 26;
      g.selectAll(".radial-region-label")
        .data(subregions)
        .enter()
        .append("text")
        .attr("class", "radial-region-label")
        .attr("text-anchor", "middle")
        .attr("font-size", 16)
        .attr("font-weight", "600")
        .attr("fill", "#111")
        .attr("transform", d => {
          const a = angle(d) + angle.bandwidth() / 2 - Math.PI / 2;
          const x = Math.cos(a) * labelRadius;
          const y = Math.sin(a) * labelRadius;
          return `translate(${x},${y}) rotate(${(a * 180) / Math.PI})`;
        })
        .text(d => d);
  
      const legendWrap = d3.select("#radialLegend");
      function drawLegend() {
        const items = legendWrap.selectAll(".item").data(industries, d => d);
        const enter = items.enter().append("div").attr("class", "item");
        enter
          .append("span")
          .attr("class", "sw")
          .style("background", d => color(d));
        enter.append("span").text(d => d);
        items.exit().remove();
      }
      drawLegend();
  
      const playBtn = d3.select("#radialPlay");
      const pauseBtn = d3.select("#radialPause");
  
      const frameDuration = 1000; 
      let currentYearIndex = 0;
      let timer = null;
  
      let paths = g.selectAll("path.radial-bar");
  
      function computeStackData(year) {
        const bySub = totalsByYear[year] || new Map();
        const segs = [];
  
        subregions.forEach(region => {
          const m = bySub.get(region) || new Map();
          const total = Array.from(m.values()).reduce((s, v) => s + v, 0);
          if (!total) return;
  
          let cum = 0;
          industries.forEach(ind => {
            const v = m.get(ind) || 0;
            if (!v) return;
            const r0 = cum;
            const r1 = cum + v;
            cum = r1;
  
            segs.push({
              region,
              industry: ind,
              value: v,
              total,
              r0,
              r1
            });
          });
        });
  
        return segs;
      }
  
      function render(year, animate = true) {
        centerYear.text(year);
  
        const segData = computeStackData(year);
  
        const t = animate
          ? g.transition().duration(700).ease(d3.easeCubicInOut)
          : g;
  
        paths = paths.data(segData, d => `${d.region}|${d.industry}`);
  
        paths
          .enter()
          .append("path")
          .attr("class", "radial-bar")
          .attr("fill", d => color(d.industry))
          .attr("opacity", 0.9)
          .on("mousemove", (event, d) => {
            const html = `<b>${d.region}</b><br>
                          Industry: <b>${d.industry}</b><br>
                          Year: ${year}<br>
                          Emissions: ${d3.format(",.0f")(d.value)} MtCO₂e`;
            showTipSmart(html, event);
          })
          .on("mouseleave", hideTip)
          .merge(paths)
          .transition(t)
          .attr("d", arc);
  
        paths
          .exit()
          .transition()
          .duration(300)
          .attr("opacity", 0)
          .remove();
      }
  
      function step() {
        render(years[currentYearIndex], true);
        currentYearIndex++;
        if (currentYearIndex >= years.length) {
          clearInterval(timer);
          timer = null;
          currentYearIndex = years.length - 1;
        }
      }
  
      currentYearIndex = 0;
      render(years[currentYearIndex], false);
  
      playBtn.on("click", () => {
        if (timer) return;
        if (currentYearIndex >= years.length - 1) currentYearIndex = 0;
        timer = setInterval(step, frameDuration);
        step();
      });
  
      pauseBtn.on("click", () => {
        if (timer) {
          clearInterval(timer);
          timer = null;
        }
      });
    });
  })();