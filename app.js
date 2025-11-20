// app.js
// Global continent line chart + Asian subregion streamgraph

(function () {
  const FILE = "data/Indicator_1_1_annual_6562429754166382300.csv";

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

  const svgContinent = d3.select("#chartContinent");
  const svgStream = d3.select("#streamSubregion");
  if (svgContinent.empty() && svgStream.empty()) return;

  d3.csv(FILE, d3.autoType).then(data => {
    const yearCols = Object.keys(data[0]).filter(k => /^\d{4}$/.test(k));
    const years = yearCols.map(Number).sort((a, b) => a - b);

    const gasTypes = Array.from(new Set(data.map(d => d["Gas Type"]))).sort();

    // ---------------------------
    // 1. Continent line chart
    // ---------------------------
    const continents = ["Africa", "Asia", "Europe", "Oceania", "Americas"];

    const gasDropdown = d3.select("#gasDropdown");
    if (!gasDropdown.empty()) {
      gasDropdown
        .selectAll("option")
        .data(gasTypes)
        .join("option")
        .attr("value", d => d)
        .text(d => d);

      gasDropdown.property("value", "Carbon dioxide");
    }

    const marginC = { top: 40, right: 40, bottom: 50, left: 80 };
    const widthC = 960 - marginC.left - marginC.right;
    const heightC = 500 - marginC.top - marginC.bottom;

    svgContinent.attr(
      "viewBox",
      `0 0 ${widthC + marginC.left + marginC.right} ${heightC + marginC.top + marginC.bottom}`
    );

    const gC = svgContinent
      .append("g")
      .attr("transform", `translate(${marginC.left},${marginC.top})`);

    const xC = d3.scaleLinear().domain(d3.extent(years)).range([0, widthC]);
    const yC = d3.scaleLinear().range([heightC, 0]);

    const colorC = d3
      .scaleOrdinal()
      .domain(continents)
      .range(d3.schemeTableau10);

    const xAxisC = d3
      .axisBottom(xC)
      .ticks(years.length)
      .tickFormat(d3.format("d"));
    const yAxisC = d3
      .axisLeft(yC)
      .ticks(6)
      .tickFormat(d3.format(","));

    gC.append("g")
      .attr("class", "axis x-axis")
      .attr("transform", `translate(0,${heightC})`);

    gC.append("g").attr("class", "axis y-axis");

    gC.append("text")
      .attr("x", widthC / 2)
      .attr("y", heightC + 40)
      .attr("text-anchor", "middle")
      .attr("fill", "#555")
      .attr("font-size", 12)
      .text("Year");

    gC.append("text")
      .attr("transform", "rotate(-90)")
      .attr("x", -heightC / 2)
      .attr("y", -60)
      .attr("text-anchor", "middle")
      .attr("fill", "#555")
      .attr("font-size", 12)
      .text("Gas emissions (Million metric tons of CO2 equivalent)");

    const line = d3
      .line()
      .x(d => xC(d.year))
      .y(d => yC(d.value));

    function getContinentSeries(gasType) {
      const filtered = data.filter(
        d =>
          d["Gas Type"] === gasType &&
          continents.includes((d.Country || "").trim())
      );

      const byKey = new Map(); // key: continent|year
      filtered.forEach(row => {
        const region = row.Country.trim();
        yearCols.forEach(yStr => {
          const year = +yStr;
          const val = +row[yStr] || 0;
          if (!val) return;
          const key = `${region}|${year}`;
          byKey.set(key, (byKey.get(key) || 0) + val);
        });
      });

      const series = continents.map(region => {
        const values = years.map(year => ({
          year,
          value: byKey.get(`${region}|${year}`) || 0
        }));
        return { region, values };
      });

      return series;
    }

    function updateContinentChart(gasType) {
      const series = getContinentSeries(gasType);
      const maxY = d3.max(series, s => d3.max(s.values, d => d.value)) || 0;
      yC.domain([0, maxY * 1.05]);

      gC.select(".x-axis").call(xAxisC);
      gC.select(".y-axis").call(yAxisC);

      const paths = gC
        .selectAll(".continent-line")
        .data(series, d => d.region);

      paths
        .enter()
        .append("path")
        .attr("class", "continent-line")
        .attr("fill", "none")
        .attr("stroke-width", 2)
        .merge(paths)
        .attr("stroke", d => colorC(d.region))
        .transition()
        .duration(600)
        .attr("d", d => line(d.values));

      paths.exit().remove();

      // points for tooltip
      const points = gC
        .selectAll(".continent-point")
        .data(
          series.flatMap(s =>
            s.values.map(v => ({ region: s.region, ...v }))
          ),
          d => `${d.region}|${d.year}`
        );

      points
        .enter()
        .append("circle")
        .attr("class", "continent-point")
        .attr("r", 3)
        .attr("fill", d => colorC(d.region))
        .on("mousemove", (event, d) => {
          const html = `<b>${d.region}</b><br>Year: ${d.year}<br>${gasType}: ${d3.format(
            ",.0f"
          )(d.value)} MtCO₂e`;
          showTip(html, event);
        })
        .on("mouseleave", hideTip)
        .merge(points)
        .transition()
        .duration(600)
        .attr("cx", d => xC(d.year))
        .attr("cy", d => yC(d.value));

      points.exit().remove();
    }

    const initialGas = !gasDropdown.empty()
      ? gasDropdown.property("value")
      : gasTypes[0];
    updateContinentChart(initialGas);

    if (!gasDropdown.empty()) {
      gasDropdown.on("change", event => {
        const gasType = event.target.value;
        updateContinentChart(gasType);
      });
    }

    // ---------------------------
    // 2. Asian subregions streamgraph
    // ---------------------------
    const subregions = [
      "Central Asia",
      "Eastern Asia",
      "South-eastern Asia",
      "Southern Asia",
      "Western Asia"
    ];

    const gasDropdownSub = d3.select("#gasDropdownSubregion");
    if (!gasDropdownSub.empty()) {
      gasDropdownSub
        .selectAll("option")
        .data(gasTypes)
        .join("option")
        .attr("value", d => d)
        .text(d => d);

      gasDropdownSub.property("value", initialGas);
    }

    const marginS = { top: 40, right: 40, bottom: 40, left: 60 };
    const widthS = 960 - marginS.left - marginS.right;
    const heightS = 500 - marginS.top - marginS.bottom;

    svgStream.attr(
      "viewBox",
      `0 0 ${widthS + marginS.left + marginS.right} ${
        heightS + marginS.top + marginS.bottom
      }`
    );

    const gS = svgStream
      .append("g")
      .attr("transform", `translate(${marginS.left},${marginS.top})`);

    const xS = d3.scaleLinear().domain(d3.extent(years)).range([0, widthS]);
    const yS = d3.scaleLinear().range([heightS, 0]);

    const colorS = d3
      .scaleOrdinal()
      .domain(subregions)
      .range(d3.schemeTableau10);

    const xAxisS = d3
      .axisBottom(xS)
      .ticks(years.length)
      .tickFormat(d3.format("d"));
    const yAxisS = d3
      .axisLeft(yS)
      .ticks(5)
      .tickFormat(d3.format(","));

    gS.append("g")
      .attr("class", "axis x-axis")
      .attr("transform", `translate(0,${heightS})`);

    gS.append("g").attr("class", "axis y-axis");

    gS.append("text")
      .attr("x", widthS / 2)
      .attr("y", heightS + 35)
      .attr("text-anchor", "middle")
      .attr("fill", "#555")
      .attr("font-size", 12)
      .text("Year");

    gS.append("text")
      .attr("transform", "rotate(-90)")
      .attr("x", -heightS / 2)
      .attr("y", -45)
      .attr("text-anchor", "middle")
      .attr("fill", "#555")
      .attr("font-size", 12)
      .text("Gas emissions (Million metric tons of CO2 equivalent)");

    const area = d3
      .area()
      .x(d => xS(d.data.year))
      .y0(d => yS(d[0]))
      .y1(d => yS(d[1]));

    function prepareStreamData(gasType) {
      const filtered = data.filter(
        d =>
          d["Gas Type"] === gasType &&
          subregions.includes((d.Country || "").trim())
      );

      const byKey = new Map(); // key: region|year
      filtered.forEach(row => {
        const region = row.Country.trim();
        yearCols.forEach(yStr => {
          const year = +yStr;
          const val = +row[yStr] || 0;
          if (!val) return;
          const key = `${region}|${year}`;
          byKey.set(key, (byKey.get(key) || 0) + val);
        });
      });

      const records = years.map(year => {
        const obj = { year };
        subregions.forEach(region => {
          obj[region] = byKey.get(`${region}|${year}`) || 0;
        });
        return obj;
      });

      return records;
    }

    function updateStream(gasType) {
      const streamData = prepareStreamData(gasType);

      const stack = d3
        .stack()
        .keys(subregions)
        .order(d3.stackOrderNone)
        .offset(d3.stackOffsetWiggle);

      const layers = stack(streamData);

      const yExtent = d3.extent(layers.flat(2));
      yS.domain(yExtent);

      gS.select(".x-axis").call(xAxisS);
      gS.select(".y-axis").call(yAxisS);

      const layersSel = gS
        .selectAll(".stream-layer")
        .data(layers, d => d.key);

      layersSel
        .enter()
        .append("path")
        .attr("class", "stream-layer")
        .attr("fill", d => colorS(d.key))
        .attr("fill-opacity", 0.9)
        .on("mousemove", (event, layer) => {
          const [xPos] = d3.pointer(event);
          const yearFloat = xS.invert(xPos);
          const nearestYear = years.reduce((a, b) =>
            Math.abs(b - yearFloat) < Math.abs(a - yearFloat) ? b : a
          );
          const record = streamData.find(r => r.year === nearestYear);
          const value = record ? record[layer.key] : 0;
          const html = `<b>${layer.key}</b><br>Year: ${nearestYear}<br>${gasType}: ${d3.format(
            ",.0f"
          )(value)} MtCO₂e`;
          showTip(html, event);
        })
        .on("mouseleave", hideTip)
        .merge(layersSel)
        .transition()
        .duration(700)
        .attr("d", area);

      layersSel.exit().remove();
    }

    updateStream(initialGas);

    if (!gasDropdownSub.empty()) {
      gasDropdownSub.on("change", event => {
        const gasType = event.target.value;
        updateStream(gasType);
      });
    }
  });
})();