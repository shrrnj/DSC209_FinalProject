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
  if (svgContinent.empty()) return;

  d3.csv(FILE, d3.autoType).then(data => {
    const yearCols = Object.keys(data[0]).filter(k => /^\d{4}$/.test(k));
    const years = yearCols.map(Number).sort((a, b) => a - b);

    const gasTypes = Array.from(new Set(data.map(d => d["Gas Type"]))).sort();


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
      .range([
        "#9b8b6e", // Africa - muted brown
        "#166534", // Asia - deep green (accent)
        "#4b6a88", // Europe - dusty blue
        "#6b8e62", // Oceania - soft green
        "#b3565a"  // Americas - muted red
      ]);

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
      .text("Gas emissions (Million metric tons of CO₂ equivalent)");

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

    let asiaFocused = false;

    function applyAsiaFocus() {
      const lines = gC.selectAll(".continent-line");
      const points = gC.selectAll(".continent-point");

      lines.transition().duration(300)
        .style("opacity", d => {
          if (!asiaFocused) return 1;
          return d.region === "Asia" ? 1 : 0.15;
        })
        .style("stroke-width", d => {
          if (!asiaFocused) return 2;
          return d.region === "Asia" ? 4 : 1.2;
        });

      points.transition().duration(300)
        .style("opacity", d => {
          if (!asiaFocused) return 1;
          return d.region === "Asia" ? 1 : 0.15;
        })
        .attr("r", d => {
          if (!asiaFocused) return 3;
          return d.region === "Asia" ? 5 : 2;
        });
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
        .attr("stroke", d => colorC(d.region))
        .attr("d", d => line(d.values))
        .merge(paths)
        .transition()
        .duration(700)
        .ease(d3.easeCubicInOut)
        .attr("stroke", d => colorC(d.region))
        .attr("d", d => line(d.values));

      paths.exit().remove();

      
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

      
      applyAsiaFocus();
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

    
    const asiaToggleBtn = document.getElementById("asiaFocusToggle");
    if (asiaToggleBtn) {
      asiaToggleBtn.addEventListener("click", () => {
        asiaFocused = !asiaFocused;
        applyAsiaFocus();
      });
    }
  });
})();
