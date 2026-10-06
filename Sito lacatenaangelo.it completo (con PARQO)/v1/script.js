const nav = document.querySelector("[data-header]");
const revealItems = document.querySelectorAll(".reveal");

const onScroll = () => {
  nav.classList.toggle("is-scrolled", window.scrollY > 24);
};

onScroll();
window.addEventListener("scroll", onScroll, { passive: true });

const revealObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("is-visible");
        revealObserver.unobserve(entry.target);
      }
    });
  },
  { threshold: 0.16 },
);

revealItems.forEach((item, index) => {
  item.style.transitionDelay = `${Math.min((index % 4) * 60, 200)}ms`;
  revealObserver.observe(item);
});
