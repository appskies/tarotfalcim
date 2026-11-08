/* Pure reader logic. No network, storage, tracking, HTML, or provider calls. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.TFReader = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const orientations = ['upright', 'reversed'];
  const focuses = ['general', 'love', 'career'];
  function randomInt(max, cryptoSource = globalThis.crypto) {
    if (!Number.isSafeInteger(max) || max < 1 || max > 0x100000000) throw new Error('Invalid random range.');
    if (!cryptoSource || typeof cryptoSource.getRandomValues !== 'function') throw new Error('Secure drawing is unavailable. Choose Enter my cards instead.');
    const limit = Math.floor(0x100000000 / max) * max;
    const value = new Uint32Array(1);
    // A broken entropy source must not hang the page.
    for (let attempt = 0; attempt < 128; attempt++) {
      cryptoSource.getRandomValues(value);
      if (value[0] < limit) return value[0] % max;
    }
    throw new Error('Secure drawing failed. Try again or enter your physical cards.');
  }
  function validateData(data) {
    if (!data || data.schemaVersion !== 1 || typeof data.version !== 'string' || !Array.isArray(data.cards) || data.cards.length !== 78 || !Array.isArray(data.spreads) || data.spreads.length !== 9 || !Array.isArray(data.signs) || data.signs.length !== 12) throw new Error('The card data is incomplete. Please reload it.');
    const ids = new Set(), slugs = new Set();
    const validSlug = s => typeof s === 'string' && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(s);
    for (const card of data.cards) {
      if (!validSlug(card.id) || !validSlug(card.slug) || ids.has(card.id) || slugs.has(card.slug) || typeof card.name !== 'string' || typeof card.prompt !== 'string' || typeof card.decisionNote !== 'string') throw new Error('Invalid or duplicate card data.');
      ids.add(card.id); slugs.add(card.slug);
      for (const orientation of orientations) {
        if (!Array.isArray(card.keywords?.[orientation]) || card.keywords[orientation].some(k => typeof k !== 'string')) throw new Error('Missing card keywords.');
        for (const focus of focuses) if (typeof card.meaning?.[focus]?.[orientation] !== 'string' || !card.meaning[focus][orientation]) throw new Error('Missing card interpretation.');
      }
    }
    const expected = {'daily-reflection':1,'past-present-future':3,'yes-or-no':1,relationship:6,career:5,horseshoe:7,'weekly-moon':4,'celtic-cross':10,'year-ahead':13};
    const spreadIds = new Set();
    for (const spread of data.spreads) {
      if (spreadIds.has(spread.id) || spread.count !== expected[spread.id] || !Array.isArray(spread.positions) || spread.positions.length !== spread.count || !Array.isArray(spread.prompts) || spread.prompts.some(p => typeof p !== 'string')) throw new Error('Invalid spread positions.');
      spreadIds.add(spread.id);
      spread.positions.forEach((p, i) => {if (p.n !== i + 1 || typeof p.title !== 'string' || typeof p.desc !== 'string') throw new Error('Invalid position order.');});
    }
    const signs = new Set();
    for (const sign of data.signs) {
      if (!validSlug(sign.id) || signs.has(sign.id) || !slugs.has(sign.card) || !['air','earth','fire','water'].includes(sign.element) || typeof sign.affinity !== 'string' || !Array.isArray(sign.prompts)) throw new Error('Invalid zodiac data.');
      signs.add(sign.id);
    }
    for (const a of data.signs) for (const b of data.signs) {
      const rule = data.rules?.pairs?.[[a.element,b.element].sort().join('-')];
      if (!rule || typeof rule.theme !== 'string' || typeof rule.friction !== 'string' || !Array.isArray(rule.prompts) || rule.prompts.length !== 2 || rule.prompts.some(p => typeof p !== 'string')) throw new Error('Incomplete element rules.');
    }
    return data;
  }
  function spreadFor(data, id) {
    const spread = data.spreads.find(s => s.id === id);
    if (!spread) throw new Error('Choose a known spread.');
    return spread;
  }
  function draw(data, id, reversals = false, cryptoSource = globalThis.crypto) {
    const spread = spreadFor(data, id);
    const deck = data.cards.slice();
    for (let i = deck.length - 1; i > 0; i--) {
      const j = randomInt(i + 1, cryptoSource);
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    return deck.slice(0, spread.count).map(card => ({id:card.id, orientation:reversals && randomInt(2,cryptoSource) === 1 ? 'reversed' : 'upright'}));
  }
  function manual(data, id, selection) {
    const spread = spreadFor(data, id);
    if (!Array.isArray(selection) || selection.length !== spread.count) throw new Error('Choose one card for every position.');
    const used = new Set();
    for (const choice of selection) {
      if (!data.cards.some(c => c.id === choice.id) || !orientations.includes(choice.orientation)) throw new Error('Choose a card and orientation for every position.');
      if (used.has(choice.id)) throw new Error('Each position needs a different card. Check for duplicate cards.');
      used.add(choice.id);
    }
    return selection.map(c => ({id:c.id,orientation:c.orientation}));
  }
  function interpret(data, id, selection, focus = 'general') {
    if (!focuses.includes(focus)) throw new Error('Choose a known focus.');
    const spread = spreadFor(data, id);
    return manual(data,id,selection).map((choice,i) => {
      const card = data.cards.find(c => c.id === choice.id);
      return {card,orientation:choice.orientation,position:spread.positions[i],text:card.meaning[focus][choice.orientation]};
    });
  }
  function localDate(date = new Date()) {
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) throw new Error('Your device date is unavailable. Check its clock.');
    return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
  }
  function daily(data, date = new Date()) {
    const day = localDate(date);
    // FNV-1a gives a stable date-based prompt; this is not a random personal forecast.
    let hash = 2166136261;
    for (const char of `${day}:${data.version}`) hash = Math.imul(hash ^ char.charCodeAt(0),16777619) >>> 0;
    return {day,selection:[{id:data.cards[hash % data.cards.length].id,orientation:'upright'}]};
  }
  function zodiac(data, first, second = '') {
    const a = data.signs.find(s => s.id === first);
    const b = second ? data.signs.find(s => s.id === second) : null;
    if (!a || (second && !b)) throw new Error('Choose a listed zodiac sign.');
    return {signs:b ? [a,b] : [a],rule:b ? data.rules.pairs[[a.element,b.element].sort().join('-')] : null};
  }
  return {randomInt,validateData,spreadFor,draw,manual,interpret,localDate,daily,zodiac};
});
