// race.js — Radial bar chart race of industry emissions
(function () {
  const width = 600;
  const height = 600;
  const innerRadius = 80;
  const outerRadius = Math.min(width, height) / 2 - 20;

  const svgRoot = d3
    .select("#chartRace")
    .attr("width", width)
    .attr("height", height);

  // clear anything that might already be inside
  svgRoot.selectAll("*").remove();

  const g = svgRoot
    .append("g")
    .attr("transform", `translate(${width / 2},${height / 2})`);

  const yearLabelOutside = d3.select("#raceYearLabel");
  const playButton = d3.select("#racePlay");
  const pauseButton = d3.select("#racePause");

  const centerYear = g
    .append("text")
    .attr("text-anchor", "middle")
    .attr("dy", "0.35em")
    .attr("font-size", 28)
    .attr("fill", "#333");

  let years;
  let industries;
  let dataByYear;
  let maxEmission;
  let currentYearIndex = 0;
  let timer = null;
  const frameDuration = 1000; // ms per year

  d3.csv("data/world_ghg_by_industry.csv", d3.autoType).then(raw => {
    const data = raw.map(d => ({
      Industry: d.Industry,
      Year: +d.Year,
      Emissions: +d.Emissions
    }));

    years = Array.from(new Set(data.map(d => d.Year))).sort((a, b) => a - b);
    industries = Array.from(new Set(data.map(d => d.Industry))).sort();

    // map: year -> array [{Industry, Year, Emissions}]
    dataByYear = new Map();
    years.forEach(year => {
      const m = new Map(
        data
          .filter(d => d.Year === year)
          .map(d => [d.Industry, d.Emissions])
      );

      const yearArray = industries.map(ind => ({
        Industry: ind,
        Year: year,
        Emissions: m.get(ind) ?? 0
      }));

      dataByYear.set(year, yearArray);
    });

    maxEmission = d3.max(data, d => d.Emissions);

    const angle = d3
      .scaleBand()
      .domain(industries)
      .range([0, 2 * Math.PI])
      .align(0);

    const radius = d3
      .scaleLinear()
      .domain([0, maxEmission])
      .range([innerRadius, outerRadius]);

    const color = d3
      .scaleOrdinal()
      .domain(industries)
      .range(d3.schemeTableau10);

    const arc = d3
      .arc()
      .innerRadius(innerRadius)
      .outerRadius(d => radius(d.Emissions))
      .startAngle(d => angle(d.Industry))
      .endAngle(d => angle(d.Industry) + angle.bandwidth())
      .padAngle(0.02)
      .padRadius(innerRadius);

    // circular grid rings for context
    const gridValues = [0.25, 0.5, 0.75, 1].map(f => f * maxEmission);
    g.selectAll(".grid-circle")
      .data(gridValues)
      .enter()
      .append("circle")
      .attr("class", "grid-circle")
      .attr("r", d => radius(d))
      .attr("fill", "none")
      .attr("stroke", "#ddd")
      .attr("stroke-width", 1);

    // radial bars
    const bars = g
      .selectAll(".radial-bar")
      .data(dataByYear.get(years[0]), d => d.Industry)
      .enter()
      .append("path")
      .attr("class", "radial-bar")
      .attr("fill", d => color(d.Industry))
      .attr("opacity", 0.85)
      .attr("d", arc);

    // labels around outer edge (industry names)
    const labels = g
      .selectAll(".radial-label")
      .data(industries)
      .enter()
      .append("text")
      .attr("class", "radial-label")
      .attr("text-anchor", "middle")
      .attr("font-size", 10)
      .attr("fill", "#333")
      .attr("transform", d => {
        const a = angle(d) + angle.bandwidth() / 2 - Math.PI / 2;
        const r = outerRadius + 16;
        return `translate(${Math.cos(a) * r},${Math.sin(a) * r}) rotate(${
          (a * 180) / Math.PI
        })`;
      })
      .text(d => d);

    function updateYear(year, animate = true) {
      const yearData = dataByYear.get(year);
      yearLabelOutside.text(year);
      centerYear.text(year);

      const t = animate
        ? g.transition().duration(frameDuration * 0.9).ease(d3.easeCubicInOut)
        : g;

      bars
        .data(yearData, d => d.Industry)
        .transition(t)
        .attr("d", arc);
    }

    function step() {
      updateYear(years[currentYearIndex]);
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

    // initial frame
    updateYear(years[0], false);
  });
})();

