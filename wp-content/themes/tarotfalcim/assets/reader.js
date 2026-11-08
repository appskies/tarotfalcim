/* Accessible DOM controls; selections stay in memory and never enter a URL. */
(() => {
  'use strict';
  const siteBase = document.currentScript.getAttribute('src').split('wp-content/')[0];
  const E = globalThis.TFReader;
  if (!E) return;
  const node = (tag, text, className) => {
    const el = document.createElement(tag);
    if (text !== undefined) el.textContent = text;
    if (className) el.className = className;
    return el;
  };
  const link = (label, route) => {
    const el = node('a',label);
    el.href = siteBase + route;
    return el;
  };
  const button = (label, action, primary = false) => {
    const el = node('button',label,`button ${primary ? 'button-gold' : 'button-outline'}`);
    el.type = 'button';
    if (action) el.addEventListener('click',action);
    return el;
  };
  function select(parent, label, options) {
    const wrapper = node('label',label);
    const field = node('select');
    for (const [value,title] of options) {
      const option = node('option',title); option.value = value; field.append(option);
    }
    wrapper.append(field); parent.append(wrapper);
    return field;
  }
  const requests = new Map();
  async function load(source) {
    if (!requests.has(source)) {
      const task = (async () => {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(),12000);
        try {
          const url = new URL(source,location.href);
          if (url.origin !== location.origin) throw new Error('The card data must come from this website.');
          const response = await fetch(url,{signal:controller.signal,credentials:'omit',referrerPolicy:'no-referrer'});
          if (!response.ok) throw new Error('Card data could not be loaded.');
          return E.validateData(await response.json());
        } finally { clearTimeout(timeout); }
      })();
      requests.set(source,task);
      task.catch(() => requests.delete(source));
    }
    return requests.get(source);
  }
  function init(root,data) {
    const status = root.querySelector('.reader-status');
    const controls = root.querySelector('.reader-controls');
    const results = root.querySelector('.reader-results');
    const after = root.querySelector('.reader-after');
    let state = 'configure', selection = null, activeSpread = root.dataset.spread;
    let readingDay = null;
    const form = node('form');
    // An accidental submit is always local, including Enter from a select.
    form.addEventListener('submit',event => event.preventDefault());
    controls.replaceChildren(form);
    status.textContent = 'Ready. Your result stays on this page; no account is needed.';
    function finish(label) {
      state = 'complete';
      status.textContent = label;
      if (after) after.hidden = false;
      results.focus();
    }
    function shareControls() {
      const actions = node('div',undefined,'reader-actions');
      actions.append(button('Print this result',() => window.print()));
      actions.append(button('Copy result',async () => {
        try {
          if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
          await navigator.clipboard.writeText(results.innerText);
          status.textContent = 'Result copied. Nothing has been posted or shared automatically.';
        } catch (_) { status.textContent = 'Copy is unavailable. Select the visible result text to copy it, or choose Print.'; }
      }));
      return actions;
    }
    if (root.dataset.tool === 'zodiac') {
      const signOptions = [['','Choose a sign'],...data.signs.map(s => [s.id,s.name])];
      const first = select(form,'Your sign',signOptions);
      const second = select(form,'Optional: a second sign',[['','Just my sign'],...data.signs.map(s => [s.id,s.name])]);
      const framing = select(form,'Conversation context',[['friendship','Friendship'],['romantic','Romantic relationship'],['work','Working together']]);
      const context = {friendship:'Use this as a conversation between friends about support and boundaries.',romantic:'Use this to ask about your own needs and agreements. It cannot reveal a partner’s feelings.',work:'Use this to discuss responsibilities and ways of working; it does not assess professional ability.'};
      const show = button('Explore the connection',() => {
        try {
          const reading = E.zodiac(data,first.value,second.value);
          const fragment = document.createDocumentFragment();
          fragment.append(node('h3',reading.rule ? 'Your symbolic comparison' : 'Your sign & its tarot card'));
          for (const sign of reading.signs) {
            const card = data.cards.find(c => c.slug === sign.card);
            const section = node('section',undefined,'reader-result');
            section.append(node('p',`${sign.element} element`,'eyebrow'),node('h4',`${sign.name} · ${card.name}`),node('p',sign.affinity),node('p',card.meaning.general.upright),link(`Read ${card.name} →`,`card-meanings/${card.slug}/`),node('p'),link(`Explore the ${sign.name} guide →`,`zodiac/${sign.id}/`));
            fragment.append(section);
          }
          if (reading.rule) {
            fragment.append(node('h4','Shared themes'),node('p',reading.rule.theme),node('h4','Potential friction'),node('p',reading.rule.friction),node('p',context[framing.value]),node('h4','Two questions to discuss'));
          } else { fragment.append(node('h4','Questions for reflection')); }
          const prompts = node('ul');
          (reading.rule?.prompts || reading.signs[0].prompts).forEach(p => prompts.append(node('li',p)));
          fragment.append(prompts,node('p','Golden Dawn-derived correspondences; original editorial element prompts, version '+data.rules.version+'. Traditions differ. No compatibility score or outcome is implied.'));
          results.replaceChildren(fragment);
          finish('Your full result is ready. Change the signs and choose Explore to compare again.');
        } catch (error) { status.textContent = error.message; }
      },true);
      form.append(show);
      return;
    }
    let spreadSelect = null, mode = null, reverse = null, focus = null;
    const settings = node('fieldset'); settings.append(node('legend','Set up your reading'));
    form.append(settings);
    if (root.dataset.choose === 'yes') {
      spreadSelect = select(settings,'Choose a spread',data.spreads.map(s => [s.id,`${s.name} · ${s.count} cards`]));
      spreadSelect.value = activeSpread;
    }
    if (root.dataset.tool !== 'daily') {
      mode = select(settings,'How will you choose cards?',[['draw','Draw virtual cards'],['manual','Enter my cards']]);
      const reverseLabel = node('label');
      reverse = node('input'); reverse.type = 'checkbox';
      reverseLabel.append(reverse,document.createTextNode('Include reversed cards in a virtual draw'));
      settings.append(reverseLabel);
      const help = node('details'); help.append(node('summary','How the draw works'),node('p','A Fisher–Yates shuffle uses rejection-sampled Web Crypto random integers. Cards are drawn without replacement. When enabled, each reversal has an independent 50% chance. These are software choices for reflection. Changing focus keeps your cards; a new draw requires Start over. There are no live AI calls.'));
      form.append(help);
    }
    focus = select(form,'Reading focus',[['general','General reflection'],['love','Love & relationships'],['career','Career reflection']]);
    const manualFields = node('fieldset'); manualFields.append(node('legend','Your physical cards'));
    settings.append(manualFields);
    let pickers = [];
    function buildManual() {
      activeSpread = spreadSelect?.value || root.dataset.spread;
      manualFields.replaceChildren(node('legend','Your physical cards'));
      pickers = E.spreadFor(data,activeSpread).positions.map(position => {
        const card = select(manualFields,`${position.n}. ${position.title}`,[['','Choose a card'],...data.cards.map(c => [c.id,c.name])]);
        const orientation = select(manualFields,`Orientation for position ${position.n}`,[['upright','Upright'],['reversed','Reversed']]);
        return {card,orientation};
      });
      manualFields.hidden = mode?.value !== 'manual';
      if (reverse) reverse.disabled = mode?.value === 'manual';
    }
    buildManual();
    mode?.addEventListener('change',buildManual);
    spreadSelect?.addEventListener('change',buildManual);
    const actions = node('div',undefined,'reader-actions');
    const drawButton = button(root.dataset.tool === 'daily' ? 'Draw today’s card' : 'Show my full reading',draw,true);
    const resetButton = button('Start over',() => {
      if (state !== 'complete') return;
      selection = null; state = 'configure'; results.replaceChildren();
      settings.disabled = false; drawButton.disabled = false; resetButton.hidden = true;
      if (after) after.hidden = true;
      status.textContent = 'Ready for a new reading. Choose Show my full reading to draw again.';
      drawButton.focus();
    });
    resetButton.hidden = true;
    actions.append(drawButton,resetButton); form.append(actions);
    const extras = shareControls(); extras.hidden = true; form.append(extras);
    resetButton.addEventListener('click',() => {extras.hidden = true;});
    function render() {
      const interpreted = E.interpret(data,activeSpread,selection,focus.value);
      const fragment = document.createDocumentFragment();
      fragment.append(node('h3',root.dataset.tool === 'daily' ? `Card of the Day · ${readingDay}` : E.spreadFor(data,activeSpread).name));
      fragment.append(node('p',`Focus: ${focus.options[focus.selectedIndex].textContent}. These meanings offer possibilities for reflection, not a prediction.`));
      const list = node('ol');
      for (const row of interpreted) {
        const item = node('li',undefined,'reader-result');
        item.append(node('p',row.position.title,'eyebrow'),node('h4',`${row.card.name} · ${row.orientation === 'upright' ? 'Upright' : 'Reversed'}`),node('p',row.position.desc),node('p',row.card.keywords[row.orientation].join(' · ')),node('p',row.text),node('p',`Reflect: ${row.card.prompt}`));
        if (activeSpread === 'yes-or-no') {
          const stance = row.orientation === 'reversed' ? 'Needs more context' : ({supports:'Supports a considered step','invites caution':'Invites caution','needs more context':'Needs more context'}[row.card.decision] || 'Needs more context');
          item.append(node('h4',stance),node('p',row.card.decisionNote));
        }
        item.append(link(`Read the full ${row.card.name} meaning →`,`card-meanings/${row.card.slug}/`));
        list.append(item);
      }
      fragment.append(list,node('h4','Bring the reading together'),node('p','Compare the themes across these positions. Separate what you know from what you are imagining, then choose one manageable next step. You do not need another draw to correct an uncomfortable result.'));
      const prompts = node('ul');
      E.spreadFor(data,activeSpread).prompts.forEach(p => prompts.append(node('li',p)));
      fragment.append(prompts,link('Use the complete spread guide →',`spreads/${activeSpread}/`));
      results.replaceChildren(fragment);
    }
    function draw() {
      if (state !== 'configure' && root.dataset.tool !== 'daily') return;
      if (state === 'drawing') return;
      state = 'drawing'; drawButton.disabled = true;
      try {
        if (root.dataset.tool === 'daily') {
          const result = E.daily(data); selection = result.selection; readingDay = result.day;
        } else {
          selection = mode.value === 'manual' ? E.manual(data,activeSpread,pickers.map(p => ({id:p.card.value,orientation:p.orientation.value}))) : E.draw(data,activeSpread,reverse.checked);
        }
        render(); settings.disabled = true; extras.hidden = false;
        resetButton.hidden = root.dataset.tool === 'daily';
        if (root.dataset.tool === 'daily') { drawButton.disabled = false; drawButton.textContent = 'Show today’s card again'; }
        finish('Your complete reading is ready. Changing focus keeps the same cards. Nothing is saved or sent to an AI service.');
      } catch (error) {
        state = 'configure'; drawButton.disabled = false;
        status.textContent = error.message;
      }
    }
    focus.addEventListener('change',() => {
      if (state !== 'complete') return;
      render(); status.textContent = 'Focus updated using the same cards. No new draw was made.';
    });
  }
  document.querySelectorAll('.tf-reader').forEach(root => {
    const status = root.querySelector('.reader-status');
    const controls = root.querySelector('.reader-controls');
    let loading = false;
    const start = async () => {
      if (loading) return;
      loading = true; status.textContent = 'Loading the card library…'; controls.replaceChildren();
      try { init(root,await load(root.dataset.source)); }
      catch (_) {
        status.textContent = 'The card data could not load. Retry below, or use the complete guides with your own cards.';
        controls.replaceChildren(button('Retry loading cards',start,true),link('Open the card library →','card-meanings/'));
      } finally { loading = false; }
    };
    start();
  });
})();
