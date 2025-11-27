const yearSlider = document.getElementById("yearSlider"); 
const yearDisplay = document.getElementById("yearDisplay");

const playBtn = document.getElementById("playYears");
const pauseBtn = document.getElementById("pauseYears");

let playTimer = null;

function setYear(year) {
  yearSlider.value = year;
  yearDisplay.textContent = year;

  if (window.updateAsiaBars) window.updateAsiaBars(+year);
  if (window.updateHeatmap) window.updateHeatmap(+year);
}

yearSlider.addEventListener("input", e => setYear(e.target.value));

playBtn.addEventListener("click", () => {
  if (playTimer) return;
  playTimer = setInterval(() => {
    let current = +yearSlider.value;
    if (current >= 2023) current = 2010;
    else current++;
    setYear(current);
  }, 800);
});

pauseBtn.addEventListener("click", () => {
  clearInterval(playTimer);
  playTimer = null;
});

// Initialize default
setYear(2010);

const revealTargets = document.querySelectorAll(".top, .card");

const observer = new IntersectionObserver(
  entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add("visible");
        observer.unobserve(entry.target);
      }
    });
  },
  {
    threshold: 0.12
  }
);

revealTargets.forEach(el => observer.observe(el));

const asiaToggleBtn = document.getElementById("asiaFocusToggle");
if (asiaToggleBtn) {
  asiaToggleBtn.classList.add("pulse");
  setTimeout(() => asiaToggleBtn.classList.remove("pulse"), 4000);
}
