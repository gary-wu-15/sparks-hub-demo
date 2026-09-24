export function carousel(id, label, items) {
  if (!items.length) return '';
  return `<div class="carousel" role="region" aria-roledescription="carousel" aria-label="${label}">
    <div id="${id}" class="carousel-track" tabindex="0" aria-label="${label}, use left and right arrow keys">${items.join('')}</div>
    ${items.length > 1 ? `<div class="carousel-controls">
      <button type="button" class="carousel-previous" aria-label="Previous ${label}" aria-controls="${id}" disabled>‹</button>
      <div class="carousel-dots">${items.map((_, index) => `<button type="button" class="carousel-dot" data-slide="${index}" aria-label="Go to ${label} item ${index + 1}" aria-controls="${id}"${index === 0 ? ' aria-current="true"' : ''}><span></span></button>`).join('')}</div>
      <button type="button" class="carousel-next" aria-label="Next ${label}" aria-controls="${id}">›</button>
    </div>` : ''}
    <span class="sr-only carousel-status" aria-live="polite" aria-atomic="true">Item 1 of ${items.length}</span>
  </div>`;
}

export function mountCarousels(root) {
  const observers = [];
  root.querySelectorAll('.carousel').forEach((element) => {
    const track = element.querySelector('.carousel-track');
    const items = [...track.children];
    const previous = element.querySelector('.carousel-previous');
    const next = element.querySelector('.carousel-next');
    const dots = [...element.querySelectorAll('.carousel-dot')];
    let index = 0;
    const offsets = () => items.map((item) => Math.min(item.offsetLeft - items[0].offsetLeft, track.scrollWidth - track.clientWidth));
    function update() {
      const targets = offsets();
      const end = track.scrollWidth - track.clientWidth;
      index = end > 0 && track.scrollLeft >= end - 2 ? items.length - 1
        : targets.reduce((best, value, i) => Math.abs(value - track.scrollLeft) < Math.abs(targets[best] - track.scrollLeft) ? i : best, 0);
      if (previous) previous.disabled = index === 0;
      if (next) next.disabled = index === items.length - 1 || end <= 0;
      dots.forEach((dot, i) => {
        if (i === index) dot.setAttribute('aria-current', 'true');
        else dot.removeAttribute('aria-current');
      });
      element.querySelector('.carousel-status').textContent = `Item ${index + 1} of ${items.length}`;
    }
    function goTo(target) {
      const destination = Math.max(0, Math.min(items.length - 1, target));
      track.scrollTo({ left: offsets()[destination], behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
    }
    previous?.addEventListener('click', () => goTo(index - 1));
    next?.addEventListener('click', () => goTo(index + 1));
    dots.forEach((dot, i) => dot.addEventListener('click', () => goTo(i)));
    track.addEventListener('keydown', (event) => {
      if (event.target !== track || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault();
      goTo(event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1 : index + (event.key === 'ArrowRight' ? 1 : -1));
    });
    track.addEventListener('scroll', update, { passive: true });
    const observer = new ResizeObserver(update);
    observer.observe(track);
    observers.push(observer);
    update();
  });
  return () => observers.forEach((observer) => observer.disconnect());
}
