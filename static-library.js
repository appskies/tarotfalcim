/* Card search for the static mirror: no WordPress request is needed. */
(() => {
  const form = document.querySelector('.library-filter');
  const groups = [...document.querySelectorAll('.card-group')];
  if (!form || !groups.length) return;
  const cards = [...document.querySelectorAll('.library-grid .content-tile')];
  const query = form.elements.tf_q;
  const suit = form.elements.suit;
  const status = document.querySelector('.result-count') || document.createElement('p');
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  form.after(status);
  const params = new URLSearchParams(location.search);
  if (params.has('tf_q')) query.value = params.get('tf_q');
  if (params.has('suit')) suit.value = params.get('suit');
  const filter = () => {
    const terms = query.value.trim().toLowerCase().split(/\s+/).filter(Boolean);
    let count = 0;
    for (const card of cards) {
      const category = card.querySelector('.eyebrow')?.textContent.trim().toLowerCase() || '';
      const text = card.textContent.toLowerCase();
      const categoryMatches = !suit.value || category.includes(suit.value) ||
        (suit.value === 'minor' && !category.includes('major'));
      const visible = categoryMatches && terms.every(term => text.includes(term));
      card.hidden = !visible;
      card.style.display = visible ? '' : 'none';
      if (visible) count++;
    }
    for (const group of groups) group.style.display = [...group.querySelectorAll('.content-tile')].some(card => !card.hidden) ? '' : 'none';
    status.textContent = count === 1 ? '1 card found' : `${count} cards found`;
  };
  form.addEventListener('submit', event => { event.preventDefault(); filter(); });
  filter();
})();
