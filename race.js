// race.js — Bar chart race for world_ghg_by_industry.csv
(function () {
  const margin = { top: 40, right: 140, bottom: 40, left: 240 };
  const width = 900 - margin.left - margin.right;
  const height = 500 - margin.top - margin.bottom;

  const svg = d3
    .select("#chartRace")
    .append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  const yearLabel = d3.select("#raceYearLabel");
  const playButton = d3.select("#racePlay");
  const pauseButton = d3.select("#racePause");

  let data;
  let years;
  let currentYearIndex = 0;
  let timer = null;
  const frameDuration = 1200; // ms per year

  d3.csv("data/world_ghg_by_industry.csv", d3.autoType).then(raw => {
    data = raw.map(d => ({
      Industry: d.Industry,
      Year: +d.Year,
      Emissions: +d.Emissions
    }));

    years = Array.from(new Set(data.map(d => d.Year))).sort((a, b) => a - b);

    const maxEmission = d3.max(data, d => d.Emissions);

    const x = d3.scaleLinear().domain([0, maxEmission]).range([0, width]).nice();
    const y = d3.scaleBand().range([0, height]).padding(0.2);
    const color = d3.scaleOrdinal(d3.schemeTableau10);

    const xAxis = d3.axisTop(x).ticks(6);
    const xAxisGroup = svg.append("g").attr("class", "x-axis");
    xAxisGroup.call(xAxis);

    svg
      .append("text")
      .attr("x", width)
      .attr("y", -20)
      .attr("text-anchor", "end")
      .attr("fill", "#555")
      .text("Million metric tons CO₂ equivalent");

    function getYearData(year) {
      const filtered = data
        .filter(d => d.Year === year)
        .sort((a, b) => d3.descending(a.Emissions, b.Emissions));

      y.domain(filtered.map(d => d.Industry));
      return filtered;
    }

    function drawYear(year, firstTime = false) {
      const yearData = getYearData(year);
      yearLabel.text(year);

      const t = svg
        .transition()
        .duration(firstTime ? 0 : frameDuration)
        .ease(d3.easeCubicInOut);

      const bars = svg.selectAll("rect.bar").data(yearData, d => d.Industry);
      const labels = svg.selectAll("text.label").data(yearData, d => d.Industry);
      const values = svg.selectAll("text.value").data(yearData, d => d.Industry);

      // ENTER bars
      bars
        .enter()
        .append("rect")
        .attr("class", "bar")
        .attr("x", 0)
        .attr("y", d => y(d.Industry))
        .attr("height", y.bandwidth())
        .attr("width", d => x(d.Emissions))
        .attr("fill", d => color(d.Industry))
        .append("title")
        .text(d => `${d.Industry}\n${d.Emissions.toFixed(1)} MtCO₂e`);

      // UPDATE bars
      bars
        .transition(t)
        .attr("y", d => y(d.Industry))
        .attr("height", y.bandwidth())
        .attr("width", d => x(d.Emissions))
        .selection()
        .select("title")
        .text(d => `${d.Industry}\n${d.Emissions.toFixed(1)} MtCO₂e`);

      // EXIT bars
      bars
        .exit()
        .transition(t)
        .attr("width", 0)
        .remove();

      // ENTER labels
      labels
        .enter()
        .append("text")
        .attr("class", "label")
        .attr("x", -10)
        .attr("y", d => y(d.Industry) + y.bandwidth() / 2)
        .attr("dy", "0.35em")
        .attr("text-anchor", "end")
        .text(d => d.Industry)
        .style("font-size", "11px")
        .style("fill", "#333");

      // UPDATE labels
      labels
        .transition(t)
        .attr("y", d => y(d.Industry) + y.bandwidth() / 2);

      // EXIT labels
      labels.exit().remove();

      // ENTER value labels
      values
        .enter()
        .append("text")
        .attr("class", "value")
        .attr("x", d => x(d.Emissions) + 5)
        .attr("y", d => y(d.Industry) + y.bandwidth() / 2)
        .attr("dy", "0.35em")
        .attr("text-anchor", "start")
        .text(d => d.Emissions.toFixed(0))
        .style("font-size", "11px")
        .style("fill", "#333");

      // UPDATE value labels
      values
        .transition(t)
        .attr("x", d => x(d.Emissions) + 5)
        .attr("y", d => y(d.Industry) + y.bandwidth() / 2)
        .text(d => d.Emissions.toFixed(0));

      // EXIT value labels
      values.exit().remove();

      xAxisGroup.call(xAxis);
    }

    function step() {
      drawYear(years[currentYearIndex]);
      currentYearIndex++;
      if (currentYearIndex >= years.length) {
        clearInterval(timer);
        timer = null;
        currentYearIndex = years.length - 1;
      }
    }

    playButton.on("click", () => {
      if (timer) return;
      if (currentYearIndex >= years.length - 1) currentYearIndex = 0;
      timer = setInterval(step, frameDuration);
      step();
    });

    pauseButton.on("click", () => {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
    });

    // first frame
    drawYear(years[0], true);
  });
})();
