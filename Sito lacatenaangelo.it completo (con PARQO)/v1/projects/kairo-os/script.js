const header = document.querySelector("[data-header]");
const heroMedia = document.querySelector(".hero-media");
const revealItems = document.querySelectorAll(".reveal");
const metricItems = document.querySelectorAll("[data-count]");

const onScroll = () => {
  header.classList.toggle("is-scrolled", window.scrollY > 24);
};

onScroll();
window.addEventListener("scroll", onScroll, { passive: true });

if (heroMedia) {
  window.addEventListener(
    "pointermove",
    (event) => {
      const x = (event.clientX / window.innerWidth - 0.5) * 10;
      const y = (event.clientY / window.innerHeight - 0.5) * 8;
      heroMedia.style.transform = `scale(1.05) translate(${x}px, ${y}px)`;
    },
    { passive: true },
  );
}

const revealObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("is-visible");
        revealObserver.unobserve(entry.target);
      }
    });
  },
  { threshold: 0.18 },
);

revealItems.forEach((item, index) => {
  item.style.transitionDelay = `${Math.min(index * 55, 260)}ms`;
  revealObserver.observe(item);
});

const animateMetric = (node) => {
  const target = Number(node.dataset.count);
  const start = performance.now();
  const duration = 900;

  const frame = (now) => {
    const progress = Math.min((now - start) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    node.textContent = Math.round(target * eased);

    if (progress < 1) {
      requestAnimationFrame(frame);
    }
  };

  requestAnimationFrame(frame);
};

const metricObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        animateMetric(entry.target);
        metricObserver.unobserve(entry.target);
      }
    });
  },
  { threshold: 0.65 },
);

metricItems.forEach((metric) => metricObserver.observe(metric));
