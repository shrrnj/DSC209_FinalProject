(function () {
  const FILE = "data/Indicator_1_1_annual_6562429754166382300.csv";

  const svg = d3.select("#heatmapIndustries");
  if (svg.empty()) return;

  const tooltipEl = document.getElementById("tooltip");
  const tooltip = d3.select(tooltipEl);

  function showTip(html, evt) {
    tooltipEl.innerHTML = html;
    tooltip.style("opacity", 1);

    const pad = 10;
    const { clientWidth: w, clientHeight: h } = tooltipEl;

    let xPos = evt.clientX + 16;
    let yPos = evt.clientY - h - 16;

    if (yPos < pad) yPos = evt.clientY + 16;
    if (xPos + w + pad > window.innerWidth) xPos = window.innerWidth - w - pad;
    if (xPos < pad) xPos = pad;
    if (yPos + h + pad > window.innerHeight) yPos = window.innerHeight - h - pad;
    if (yPos < pad) yPos = pad;

    tooltip.style("left", `${xPos}px`).style("top", `${yPos}px`);
  }

  function hideTip() {
    tooltip.style("opacity", 0);
  }

  const margin = { top: 80, right: 120, bottom: 60, left: 260 };
  const width = 960 - margin.left - margin.right;
  const height = 420 - margin.top - margin.bottom;

  svg.attr("viewBox", `0 0 ${width + margin.left + margin.right} ${height + margin.top + margin.bottom}`);

  const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

  const subregions = [
    "Central Asia",
    "Eastern Asia",
    "South-eastern Asia",
    "Southern Asia",
    "Western Asia"
  ];

  const year = 2023; // Fixed year

  d3.csv(FILE, d3.autoType).then(data => {
    // Filter for relevant rows
    const filtered = data.filter(
      d => d["Gas Type"] === "Greenhouse gas" && subregions.includes((d.Country || "").trim())
    );

    const industries = Array.from(new Set(filtered.map(d => d.Industry))).sort();

    // Prepare data for 2023
    const totals = {};
    industries.forEach(ind => totals[ind] = {});

    filtered.forEach(row => {
      const region = row.Country.trim();
      const industry = row.Industry;
      const val = +row[year] || 0;
      if (val) totals[industry][region] = val;
    });

    const maxVal = d3.max(industries.flatMap(ind => subregions.map(region => totals[ind][region] || 0))) || 1;

    const x = d3.scaleBand().domain(subregions).range([0, width]).padding(0.1);
    const y = d3.scaleBand().domain(industries).range([0, height]).padding(0.1);

    const color = d3.scaleSequential(d3.interpolateYlOrRd).domain([maxVal * 0.05, maxVal]);

    // Axes
    g.append("g").attr("class", "axis x-axis").attr("transform", `translate(0,${height})`).call(d3.axisBottom(x));
    g.append("g").attr("class", "axis y-axis").call(d3.axisLeft(y));

    // Legend
    const legendWidth = 220;
    const legendHeight = 12;
    const legendGroup = svg.append("g").attr("transform", `translate(${margin.left + (width - legendWidth) / 2},${margin.top - 40})`);

    const defs = svg.append("defs");
    const gradient = defs.append("linearGradient").attr("id", "heatmap-gradient").attr("x1", "0%").attr("x2", "100%");

    d3.range(0, 1.01, 0.1).forEach(t => {
      gradient.append("stop")
        .attr("offset", `${t * 100}%`)
        .attr("stop-color", color(maxVal * 0.05 + t * (maxVal - maxVal * 0.05)));
    });

    legendGroup.append("rect").attr("width", legendWidth).attr("height", legendHeight).attr("fill", "url(#heatmap-gradient)");

    const legendScale = d3.scaleLinear().domain([maxVal * 0.05, maxVal]).range([0, legendWidth]);
    const legendAxis = d3.axisBottom(legendScale).ticks(4).tickFormat(d3.format(".1s"));
    legendGroup.append("g").attr("transform", `translate(0,${legendHeight})`).call(legendAxis);

    legendGroup.append("text")
      .attr("x", legendWidth / 2)
      .attr("y", -6)
      .attr("text-anchor", "middle")
      .attr("fill", "#555")
      .attr("font-size", 11)
      .text(`Total GHG in ${year} (MtCO₂e)`);

    // Draw heatmap
g.selectAll("rect.heat-cell")
  .data(industries.flatMap(ind => subregions.map(region => ({ industry: ind, region, value: totals[ind][region] || 0 }))))
  .enter()
  .append("rect")
  .attr("class", "heat-cell")
  .attr("x", d => x(d.region))
  .attr("y", d => y(d.industry))
  .attr("width", x.bandwidth())
  .attr("height", y.bandwidth())
  .attr("rx", 4)
  .attr("ry", 4)
  .attr("fill", d => d.value ? color(d.value) : "#f8fafc")
  .on("mouseenter", function(event, d) {
    // Show tooltip
    showTip(`<b>${d.industry}</b><br>${d.region}<br>Year: ${year}<br>Emissions: ${d3.format(",.0f")(d.value)} MtCO₂e`, event);
    
    // Highlight row/column
    const rowR = d.region;
    const colI = d.industry;
    g.selectAll(".heat-cell")
      .transition().duration(200)
      .style("opacity", c => c.region === rowR || c.industry === colI ? 1 : 0.15);
  })
  .on("mousemove", (event, d) => {
    // Update tooltip position
    showTip(`<b>${d.industry}</b><br>${d.region}<br>Year: ${year}<br>Emissions: ${d3.format(",.0f")(d.value)} MtCO₂e`, event);
  })
  .on("mouseleave", function() {
    // Hide tooltip
    hideTip();

    // Reset heatmap opacity
    g.selectAll(".heat-cell")
      .transition().duration(200)
      .style("opacity", 1);
  });

  });
})();
