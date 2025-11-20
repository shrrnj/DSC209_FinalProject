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

  svg.attr(
    "viewBox",
    `0 0 ${width + margin.left + margin.right} ${
      height + margin.top + margin.bottom
    }`
  );

  const g = svg
    .append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  const yearSelect = d3.select("#heatmapYear");

  const subregions = [
    "Central Asia",
    "Eastern Asia",
    "South-eastern Asia",
    "Southern Asia",
    "Western Asia"
  ];

  d3.csv(FILE, d3.autoType).then(data => {
    const yearCols = Object.keys(data[0]).filter(k => /^\d{4}$/.test(k));
    const years = yearCols.map(Number).sort((a, b) => a - b);

    const filtered = data.filter(
      d =>
        d["Gas Type"] === "Greenhouse gas" &&
        subregions.includes((d.Country || "").trim())
    );

    const industries = Array.from(new Set(filtered.map(d => d.Industry))).sort();

    const totalsByYear = {};
    years.forEach(y => {
      const yearMap = {};
      industries.forEach(ind => (yearMap[ind] = {}));
      totalsByYear[y] = yearMap;
    });

    filtered.forEach(row => {
      const region = row.Country.trim();
      const industry = row.Industry;
      years.forEach(y => {
        const val = +row[y] || 0;
        if (!val) return;
        const yearMap = totalsByYear[y];
        const indMap = yearMap[industry] || (yearMap[industry] = {});
        indMap[region] = (indMap[region] || 0) + val;
      });
    });

    let maxVal = 0;
    years.forEach(y => {
      industries.forEach(ind => {
        subregions.forEach(region => {
          const v =
            (totalsByYear[y][ind] && totalsByYear[y][ind][region]) || 0;
          if (v > maxVal) maxVal = v;
        });
      });
    });

    const x = d3
      .scaleBand()
      .domain(subregions)
      .range([0, width])
      .padding(0.1);

    const y = d3
      .scaleBand()
      .domain(industries)
      .range([0, height])
      .padding(0.1);

    const color = d3
      .scaleSequential(d3.interpolateYlOrRd)
      .domain([0, maxVal || 1]);

    g.append("g")
      .attr("class", "axis x-axis")
      .attr("transform", `translate(0,${height})`)
      .call(d3.axisBottom(x));

    g.append("g")
      .attr("class", "axis y-axis")
      .call(d3.axisLeft(y));

    // Legend
    const legendWidth = 220;
    const legendHeight = 12;

    const legendGroup = svg
      .append("g")
      .attr(
        "transform",
        `translate(${margin.left + (width - legendWidth) / 2},${
          margin.top - 40
        })`
      );

    const legendScale = d3
      .scaleLinear()
      .domain(color.domain())
      .range([0, legendWidth]);

    const legendAxis = d3
      .axisBottom(legendScale)
      .ticks(4)
      .tickFormat(d3.format(".1s"));

    const legendGradientId = "heatmap-gradient";

    const defs = svg.append("defs");
    const gradient = defs
      .append("linearGradient")
      .attr("id", legendGradientId)
      .attr("x1", "0%")
      .attr("x2", "100%")
      .attr("y1", "0%")
      .attr("y2", "0%");

    d3.range(0, 1.01, 0.1).forEach(t => {
      gradient
        .append("stop")
        .attr("offset", `${t * 100}%`)
        .attr(
          "stop-color",
          color(
            color.domain()[0] +
              t * (color.domain()[1] - color.domain()[0])
          )
        );
    });

    legendGroup
      .append("rect")
      .attr("width", legendWidth)
      .attr("height", legendHeight)
      .attr("fill", `url(#${legendGradientId})`);

    legendGroup
      .append("g")
      .attr("transform", `translate(0,${legendHeight})`)
      .call(legendAxis);

    legendGroup
      .append("text")
      .attr("x", legendWidth / 2)
      .attr("y", -6)
      .attr("text-anchor", "middle")
      .attr("fill", "#555")
      .attr("font-size", 11)
      .text("Total GHG in selected year (MtCO₂e)");

    if (!yearSelect.empty()) {
      yearSelect
        .selectAll("option")
        .data(years)
        .join("option")
        .attr("value", d => d)
        .text(d => d);

      yearSelect.property("value", years[years.length - 1]);
    }

    let rects = g.selectAll("rect.heat-cell");

    function render(year) {
      const cells = [];
      industries.forEach(ind => {
        subregions.forEach(region => {
          const v =
            (totalsByYear[year][ind] &&
              totalsByYear[year][ind][region]) ||
            0;
          cells.push({ industry: ind, region, value: v });
        });
      });

      rects = rects.data(cells, d => `${d.industry}|${d.region}`);

      rects
        .enter()
        .append("rect")
        .attr("class", "heat-cell")
        .attr("x", d => x(d.region))
        .attr("y", d => y(d.industry))
        .attr("width", x.bandwidth())
        .attr("height", y.bandwidth())
        .attr("rx", 4)
        .attr("ry", 4)
        .on("mousemove", (event, d) => {
          const html = `<b>${d.industry}</b><br>${d.region}<br>Year: ${year}<br>Emissions: ${d3.format(
            ",.0f"
          )(d.value)} MtCO₂e`;
          showTip(html, event);
        })
        .on("mouseleave", hideTip)
        .merge(rects)
        .transition()
        .duration(400)
        .attr("fill", d =>
          d.value ? color(d.value) : "#f8fafc"
        );

      rects.exit().remove();
    }

    const initialYear = years[years.length - 1];
    render(initialYear);

    if (!yearSelect.empty()) {
      yearSelect.on("change", event => {
        const year = +event.target.value;
        render(year);
      });
    }
  });
})();