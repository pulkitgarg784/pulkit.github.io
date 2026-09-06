const filters = document.querySelectorAll(".filter");
const projects = document.querySelectorAll(".project");
const emptyState = document.getElementById("projectsEmpty");
const statusRegion = document.getElementById("projectsStatus");

function applyFilter(filter) {
  let visibleCount = 0;
  projects.forEach((p) => {
    const tags = (p.dataset.tags || "").split(" ");
    const show = filter === "all" || tags.includes(filter);
    p.classList.toggle("is-hidden", !show);
    if (show) visibleCount++;
  });

  emptyState.classList.toggle("is-visible", visibleCount === 0);
  statusRegion.textContent =
    visibleCount === 0
      ? "No projects match this filter."
      : `Showing ${visibleCount} project${visibleCount === 1 ? "" : "s"}.`;
}

filters.forEach((btn) => {
  btn.addEventListener("click", () => {
    filters.forEach((f) => f.setAttribute("aria-pressed", "false"));
    btn.setAttribute("aria-pressed", "true");
    applyFilter(btn.dataset.filter);
  });
});


const revealEls = document.querySelectorAll(".reveal");

if ("IntersectionObserver" in window) {
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          io.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
  );
  revealEls.forEach((el) => io.observe(el));
} else {
  revealEls.forEach((el) => el.classList.add("is-visible"));
}

if (window.matchMedia("(hover: hover)").matches) {
  document.querySelectorAll(".project").forEach((card) => {
    card.addEventListener("pointermove", (e) => {
      const r = card.getBoundingClientRect();
      card.style.setProperty("--mx", `${e.clientX - r.left}px`);
      card.style.setProperty("--my", `${e.clientY - r.top}px`);
    });
  });
}
