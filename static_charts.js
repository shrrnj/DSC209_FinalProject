(function () {
  const FILE = "data/Indicator_1_1_annual_6562429754166382300.csv";

  d3.csv(FILE).then(function (data) {
    // Detect year columns and coerce to numbers
    const yearCols = Object.keys(data[0]).filter(k => /^\d{4}$/.test(k));
    data.forEach(d => {
      yearCols.forEach(y => {
        d[y] = +d[y];
      });
    });

    // Default year for static charts
    let heatmapYear = yearCols.includes("2023")
      ? "2023"
      : yearCols[yearCols.length - 1];

    // --- build year dropdown for the heatmap card (pure JS, no HTML changes needed) ---
    const heatmapSvgNode = document.getElementById("heatmapIndustries");
    if (heatmapSvgNode) {
      const card = heatmapSvgNode.closest(".card") || heatmapSvgNode.parentNode;

      const controlWrap = document.createElement("div");
      controlWrap.className = "heatmap-year-control";
      controlWrap.style.display = "flex";
      controlWrap.style.justifyContent = "flex-end";
      controlWrap.style.alignItems = "center";
      controlWrap.style.gap = "6px";
      controlWrap.style.marginBottom = "6px";

      const label = document.createElement("span");
      label.textContent = "Year:";
      label.style.fontSize = "12px";

      const select = document.createElement("select");
      select.style.fontSize = "12px";
      select.style.padding = "2px 6px";
      yearCols.forEach(y => {
        const opt = document.createElement("option");
        opt.value = y;
        opt.textContent = y;
        if (y === heatmapYear) opt.selected = true;
        select.appendChild(opt);
      });

      controlWrap.appendChild(label);
      controlWrap.appendChild(select);
      card.insertBefore(controlWrap, heatmapSvgNode);

      select.addEventListener("change", () => {
        heatmapYear = select.value;
        renderHeatmap(data, heatmapYear);
      });
    }

    // initial render
    renderHeatmap(data, heatmapYear);
    renderLorenz(data);
  });

  // =====================================================================
  // Heatmap: Industries × Asian subregions, year-selectable
  // =====================================================================
  function renderHeatmap(data, year) {
    const subregions = [
      "Central Asia",
      "Eastern Asia",
      "South-eastern Asia",
      "Southern Asia",
      "Western Asia"
    ];

    const industriesOrder = [
      "Electricity, Gas, Steam and Air Conditioning Supply",
      "Manufacturing",
      "Transportation and Storage",
      "Agriculture, Forestry and Fishing",
      "Construction",
      "Mining",
      "Water supply; sewerage, waste management and remediation activities",
      "Other Services Industries"
    ];

    const filtered = data.filter(
      d =>
        d["Gas Type"] === "Greenhouse gas" &&
        subregions.includes((d.Country || "").trim()) &&
        industriesOrder.includes(d.Industry)
    );

    // aggregate by subregion × industry
    const bySI = d3.rollup(
      filtered,
      v => d3.sum(v, d => d[year]),
      d => d.Country.trim(),
      d => d.Industry
    );

    const values = [];
    subregions.forEach(region => {
      industriesOrder.forEach(ind => {
        const v = (bySI.get(region) && bySI.get(region).get(ind)) || 0;
        values.push({ region, industry: ind, value: v });
      });
    });

    const nonZeroValues = values.filter(d => d.value > 0);
    const maxVal = d3.max(nonZeroValues, d => d.value) || 1;

    const svg = d3.select("#heatmapIndustries");
    const vw = 800;
    const vh = 520;
    const margin = { top: 40, right: 20, bottom: 90, left: 280 };
    const width = vw - margin.left - margin.right;
    const height = vh - margin.top - margin.bottom;

    svg.attr("viewBox", `0 0 ${vw} ${vh}`);
    svg.selectAll("*").remove();

    const g = svg
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    const x = d3
      .scaleBand()
      .domain(subregions)
      .range([0, width])
      .padding(0.18);

    const y = d3
      .scaleBand()
      .domain(industriesOrder)
      .range([0, height])
      .padding(0.3); // room for multi-line labels

    const color = d3
      .scaleSequential(d3.interpolateYlOrRd)
      .domain([0, maxVal])
      .clamp(true);

    // X axis
    g.append("g")
      .attr("class", "axis")
      .attr("transform", `translate(0,${height})`)
      .call(d3.axisBottom(x))
      .selectAll("text")
      .style("font-size", "11px");

    // Y axis with wrapped labels
    const yAxis = g
      .append("g")
      .attr("class", "axis")
      .call(d3.axisLeft(y).tickSize(0));

    yAxis
      .selectAll("text")
      .style("font-size", "11px")
      .call(wrapText, 210);

    // Cells
    g.selectAll("rect.heat-cell")
      .data(values)
      .enter()
      .append("rect")
      .attr("class", "heat-cell")
      .attr("x", d => x(d.region))
      .attr("y", d => y(d.industry))
      .attr("width", x.bandwidth())
      .attr("height", y.bandwidth())
      .attr("rx", 4)
      .attr("ry", 4)
      .attr("fill", d => color(d.value));

    // Legend
    const legendWidth = 180;
    const legendHeight = 8;
    const legendX = width - legendWidth;
    const legendY = -24;

    const legend = g
      .append("g")
      .attr("class", "heatmap-legend")
      .attr("transform", `translate(${legendX},${legendY})`);

    const gradId = "heatmapGradient";
    const defs = svg.append("defs");
    const grad = defs
      .append("linearGradient")
      .attr("id", gradId)
      .attr("x1", "0%")
      .attr("x2", "100%")
      .attr("y1", "0%")
      .attr("y2", "0%");

    const stops = d3.range(0, 1.01, 0.1);
    stops.forEach(t => {
      grad
        .append("stop")
        .attr("offset", `${t * 100}%`)
        .attr("stop-color", color(t * maxVal));
    });

    legend
      .append("rect")
      .attr("width", legendWidth)
      .attr("height", legendHeight)
      .attr("fill", `url(#${gradId})`)
      .attr("rx", 4)
      .attr("ry", 4);

    const legendScale = d3
      .scaleLinear()
      .domain([0, maxVal])
      .range([0, legendWidth]);

    const legendAxis = d3
      .axisBottom(legendScale)
      .ticks(4)
      .tickFormat(d3.format(".2s"));

    legend
      .append("g")
      .attr("transform", `translate(0,${legendHeight})`)
      .call(legendAxis)
      .selectAll("text")
      .style("font-size", "10px");

    legend
      .append("text")
      .attr("x", legendWidth / 2)
      .attr("y", -6)
      .attr("text-anchor", "middle")
      .style("font-size", "11px")
      .text(`Total GHG in ${year} (MtCO₂e)`);

    // helper: wrap long y-axis labels
    function wrapText(selection, maxWidth) {
      selection.each(function () {
        const text = d3.select(this);
        const words = text.text().split(/\s+/).reverse();
        let line = [];
        let lineNumber = 0;
        const lineHeight = 1.1;
        const yText = text.attr("y");
        const dy = parseFloat(text.attr("dy")) || 0;
        let tspan = text
          .text(null)
          .append("tspan")
          .attr("x", -12)
          .attr("y", yText)
          .attr("dy", dy + "em");

        let word;
        while ((word = words.pop())) {
          line.push(word);
          tspan.text(line.join(" "));
          if (tspan.node().getComputedTextLength() > maxWidth) {
            line.pop();
            tspan.text(line.join(" "));
            line = [word];
            tspan = text
              .append("tspan")
              .attr("x", -12)
              .attr("y", yText)
              .attr("dy", (++lineNumber * lineHeight + dy) + "em")
              .text(word);
          }
        }
      });
    }
  }

  // ============================================================
  // Lorenz curve — still for 2023 (global inequality)
  // ============================================================
  function renderLorenz(data) {
    const year = "2023";

    const filtered = data.filter(d => d["Gas Type"] === "Greenhouse gas");

    // aggregate total by region (Country column)
    const byRegion = d3.rollups(
      filtered,
      v => d3.sum(v, d => d[year]),
      d => d.Country
    );

    const regions = byRegion.map(([region, value]) => ({ region, value }));
    regions.sort((a, b) => d3.ascending(a.value, b.value));

    const n = regions.length;
    const total = d3.sum(regions, d => d.value) || 1;

    const points = [{ x: 0, y: 0 }];
    let cum = 0;
    regions.forEach((d, i) => {
      cum += d.value;
      points.push({
        x: (i + 1) / n,
        y: cum / total
      });
    });

    // approximate Gini: 1 - 2 * area under Lorenz curve
    let area = 0;
    for (let i = 0; i < points.length - 1; i++) {
      const x0 = points[i].x;
      const x1 = points[i + 1].x;
      const y0 = points[i].y;
      const y1 = points[i + 1].y;
      area += ((y0 + y1) * (x1 - x0)) / 2;
    }
    const gini = 1 - 2 * area;

    const svg = d3.select("#lorenzCurve");
    const vw = 520;
    const vh = 420;
    const margin = { top: 40, right: 20, bottom: 40, left: 50 };
    const width = vw - margin.left - margin.right;
    const height = vh - margin.top - margin.bottom;

    svg.attr("viewBox", `0 0 ${vw} ${vh}`);
    svg.selectAll("*").remove();

    const g = svg
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    const x = d3.scaleLinear().domain([0, 1]).range([0, width]);
    const y = d3.scaleLinear().domain([0, 1]).range([height, 0]);

    const xAxis = d3
      .axisBottom(x)
      .ticks(5)
      .tickFormat(d3.format(".0%"));
    const yAxis = d3
      .axisLeft(y)
      .ticks(5)
      .tickFormat(d3.format(".0%"));

    g.append("g")
      .attr("class", "axis")
      .attr("transform", `translate(0,${height})`)
      .call(xAxis);

    g.append("g")
      .attr("class", "axis")
      .call(yAxis);

    const lineEq = d3
      .line()
      .x(d => x(d.x))
      .y(d => y(d.y));

    g.append("path")
      .datum([
        { x: 0, y: 0 },
        { x: 1, y: 1 }
      ])
      .attr("class", "lorenz-eq")
      .attr("d", lineEq);

    const lineLorenz = d3
      .line()
      .x(d => x(d.x))
      .y(d => y(d.y))
      .curve(d3.curveMonotoneX);

    g.append("path")
      .datum(points)
      .attr("class", "lorenz-curve")
      .attr("d", lineLorenz);

    const areaLorenz = d3
      .area()
      .x(d => x(d.x))
      .y0(d => y(d.y))
      .y1(d => y(d.x));

    g.append("path")
      .datum(points)
      .attr("class", "lorenz-shade")
      .attr("d", areaLorenz);

    g.append("text")
      .attr("x", width / 2)
      .attr("y", height + 32)
      .attr("text-anchor", "middle")
      .style("font-size", "12px")
      .text(
        "Cumulative share of regions (sorted from lowest to highest emissions)"
      );

    g.append("text")
      .attr("transform", "rotate(-90)")
      .attr("x", -height / 2)
      .attr("y", -36)
      .attr("text-anchor", "middle")
      .style("font-size", "12px")
      .text("Cumulative share of emissions (Greenhouse gas, 2023)");

    g.append("text")
      .attr("x", width - 4)
      .attr("y", 0)
      .attr("text-anchor", "end")
      .style("font-size", "12px")
      .style("font-weight", "600")
      .text(`Gini ≈ ${gini.toFixed(2)}`);
  }
})();