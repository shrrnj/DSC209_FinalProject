// asia_bar.js
(function () {
  const FILE = "data/Indicator_1_1_annual_6562429754166382300.csv";

  const subregions = [
    "Central Asia",
    "Eastern Asia",
    "South-eastern Asia",
    "Southern Asia",
    "Western Asia"
  ];

  const svg = d3.select("#asiaBarChart");
if (svg.empty()) return;

const vw = 900;
const vh = 420;
const margin = { top: 40, right: 30, bottom: 40, left: 180 };
const width = vw - margin.left - margin.right;
const height = vh - margin.top - margin.bottom;

svg.attr("viewBox", `0 0 ${vw} ${vh}`);

const g = svg.append("g")
  .attr("transform", `translate(${margin.left},${margin.top})`);


svg.on("click", function(event) {
  
  if (event.target.tagName === "svg") {
    g.selectAll(".asia-bar-seg") 
      .transition().duration(300)
      .style("opacity", 1);

    d3.select("#asiaBarInfo").html("Click a bar to focus on one subregion.");
  }
});
  const gx = g.append("g").attr("class", "axis axis-x")
    .attr("transform", `translate(0,${height})`);

  const gy = g.append("g").attr("class", "axis axis-y");

  const yearText = svg.append("text")
    .attr("x", margin.left)
    .attr("y", margin.top - 10)
    .attr("font-size", 16)
    .attr("font-weight", "600")
    .attr("fill", "#111");

  const tipEl = document.getElementById("tooltip");
  const tip = d3.select(tipEl);

  function showTip(html, evt) {
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

    const x = d3.scaleLinear().domain([0, globalMaxTotal]).range([0, width]);
    const y = d3.scaleBand().domain(subregions).range([0, height]).padding(0.35);

    const color = d3.scaleOrdinal()
  .domain(industries)
  .range([
    "#000000ff", 
    "#faff64ff", 
    "#b97bbfff", 
    "#fc5c00ff", 
    "#264a20ff", 
    "#906a51ff", 
    "#095891ff", 
    "#c0c0c0ff",
    "#bf228dff", 
    "#7db987ff",
  ]);




    gx.call(d3.axisBottom(x).ticks(5).tickFormat(d3.format(".2s")));
    gy.call(d3.axisLeft(y));

    svg.append("text")
      .attr("x", margin.left + width / 2)
      .attr("y", margin.top + height + 30)
      .attr("text-anchor", "middle")
      .attr("font-size", 12)
      .attr("fill", "#555")
      .text("Total GHG emissions (MtCO₂e)");

    const legendWrap = d3.select("#asiaBarLegend");
    function drawLegend() {
      const items = legendWrap.selectAll(".item").data(industries, d => d);
      const enter = items.enter().append("div").attr("class", "item");

      enter.append("span")
        .attr("class", "sw")
        .style("background", d => color(d));

      enter.append("span").text(d => d);

      items.exit().remove();
    }
    drawLegend();

    let segments = g.selectAll("rect.asia-bar-seg");

    function buildSegments(year) {
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
          const x0 = cum;
          const x1 = cum + v;
          cum = x1;

          segs.push({
            region,
            industry: ind,
            value: v,
            total,
            x0,
            x1,
            year
          });
        });
      });

      return segs;
    }

    function render(year, animate = true) {
      yearText.text(`Year: ${year}`);

      const dataSegs = buildSegments(year);
      const t = animate ? g.transition().duration(700).ease(d3.easeCubicInOut) : g;

      segments = segments.data(
        dataSegs,
        d => `${d.region}|${d.industry}`
      );

      segments.enter()
  .append("rect")
  .attr("class", "asia-bar-seg")
  .attr("y", d => y(d.region))
  .attr("height", y.bandwidth())
  .attr("x", d => x(d.x0))
  .attr("width", d => x(d.x1) - x(d.x0))
  .attr("fill", d => color(d.industry))
  .attr("opacity", 0.9)
  .on("mousemove", (event, d) => {
    const html = `<b>${d.region}</b><br>
                  Industry: <b>${d.industry}</b><br>
                  Year: ${d.year}<br>
                  Emissions: ${d3.format(",.0f")(d.value)} MtCO₂e`;
    showTip(html, event);
  })
  .on("mouseleave", hideTip)

  .on("click", (event, d) => {
    const sub = d.region;

    g.selectAll(".asia-bar-seg")
      .transition().duration(300)
      .style("opacity", seg => seg.region === sub ? 1 : 0.25);

    d3.select("#asiaBarInfo").html(`
      <strong>Focused on: ${sub}</strong><br>
      Click empty space to reset.
    `);

    event.stopPropagation();
  })

  .merge(segments)
  .transition(t)
  .attr("y", d => y(d.region))
  .attr("height", y.bandwidth())
  .attr("x", d => x(d.x0))
  .attr("width", d => x(d.x1) - x(d.x0));

segments.exit()
  .transition()
  .duration(300)
  .attr("opacity", 0)
  .remove();

  }

    const playBtn = d3.select("#asiaBarPlay");
    const pauseBtn = d3.select("#asiaBarPause");

    const frameDuration = 1000;
    let currentYearIndex = 0;
    let timer = null;

    // 🔹 Expose a global function for the year slider control
    window.updateAsiaBars = function (year) {
      const yVal = +year;
      if (!years.includes(yVal)) return;
      render(yVal, false);
      currentYearIndex = years.indexOf(yVal);
    };

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
