/* Native details navigation works before scripts load and without JavaScript. */
(() => {
  const menu = document.querySelector('.mobile-navigation');
  const summary = menu?.querySelector('summary');
  if (!menu || !summary) return;
  const close = (restoreFocus = false) => {
    menu.open = false;
    if (restoreFocus) summary.focus();
  };
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && menu.open) close(true);
  });
  document.addEventListener('click', event => {
    if (menu.open && !menu.contains(event.target)) close();
  });
  menu.addEventListener('click', event => {
    if (event.target.closest('a')) close();
  });
  menu.addEventListener('focusout', event => {
    if (event.relatedTarget && !menu.contains(event.relatedTarget)) close();
  });
})();
