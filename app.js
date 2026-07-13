/* app.js — state, math, rendering, persistence. No dependencies, no build step. */
(function () {
  'use strict';

  var STEP = 5; // calories increment in 5-cal steps
  var KEYS = { saved: 'calories.savedConfigs', session: 'calories.session' };

  /* ------------------------------------------------------------------ *
   * Pure math (exposed on window.CalMath so tests.html can check it)
   * ------------------------------------------------------------------ */

  function roundTo5(n) {
    return Math.round(n / STEP) * STEP;
  }

  function gramsFor(cal, calPerG) {
    return Math.round(cal / calPerG);
  }

  function totalOf(alloc) {
    var t = 0;
    for (var k in alloc) if (alloc.hasOwnProperty(k)) t += alloc[k];
    return t;
  }

  /*
   * Split an exact whole-number `total` across `names` in proportion to `weights`,
   * using the largest-remainder method so the parts sum EXACTLY to `total`.
   * Distributing in 1-cal units is what makes EVERY ingredient shift together
   * instead of the whole change landing on one.
   */
  function apportion(names, weights, total) {
    total = Math.max(0, Math.round(total));
    var alloc = {};
    var i;
    if (!names.length) return alloc;

    var wsum = 0;
    for (i = 0; i < names.length; i++) wsum += Math.max(0, weights[names[i]] || 0);

    // No usable ratio -> even split.
    if (wsum <= 0) {
      var each = Math.floor(total / names.length);
      for (i = 0; i < names.length; i++) alloc[names[i]] = each;
      var leftover = total - each * names.length;
      for (i = 0; i < leftover; i++) alloc[names[i]] += 1;
      return alloc;
    }

    var quotas = [];
    for (i = 0; i < names.length; i++) {
      var q = (Math.max(0, weights[names[i]] || 0) / wsum) * total;
      var base = Math.floor(q);
      quotas.push({ name: names[i], base: base, frac: q - base });
      alloc[names[i]] = base;
    }
    var assigned = 0;
    for (i = 0; i < quotas.length; i++) assigned += quotas[i].base;
    var rem = total - assigned;
    quotas.sort(function (a, b) { return b.frac - a.frac; });
    for (i = 0; i < rem; i++) alloc[quotas[i % quotas.length].name] += 1;
    return alloc;
  }

  // Scale a meal to a target total (snapped to nearest 5), keeping ingredient ratios stable.
  function scaleToTotal(names, weights, targetTotal) {
    return apportion(names, weights, Math.max(0, roundTo5(targetTotal)));
  }

  /*
   * Like scaleToTotal, but ingredients in `locked` keep their current calories.
   * The remaining calories (target minus the locked sum) are apportioned across
   * the UNLOCKED ingredients by `weights`, so they keep their mutual ratios.
   * If the locked sum already meets/exceeds the target, unlocked go to 0 (the
   * total can't drop below the locked calories).
   */
  function distributeWithLocks(names, weights, targetTotal, locked, current) {
    locked = locked || {};
    current = current || {};
    var T = Math.max(0, roundTo5(targetTotal));
    var alloc = {};
    var lockedSum = 0;
    var unlocked = [];
    names.forEach(function (n) {
      if (locked[n]) { alloc[n] = Math.max(0, Math.round(current[n] || 0)); lockedSum += alloc[n]; }
      else unlocked.push(n);
    });
    var rem = Math.max(0, T - lockedSum);
    var uw = {};
    unlocked.forEach(function (n) { uw[n] = Math.max(0, weights[n] || 0); });
    var part = apportion(unlocked, uw, rem);
    unlocked.forEach(function (n) { alloc[n] = part[n] || 0; });
    return alloc;
  }

  window.CalMath = {
    STEP: STEP,
    roundTo5: roundTo5,
    gramsFor: gramsFor,
    totalOf: totalOf,
    apportion: apportion,
    scaleToTotal: scaleToTotal,
    distributeWithLocks: distributeWithLocks,
  };

  // tests.html loads only the math above; bail out before touching the DOM.
  if (typeof document === 'undefined' || !document.getElementById) return;
  if (typeof MEALS === 'undefined') return;

  /* ------------------------------------------------------------------ *
   * Persistence
   * ------------------------------------------------------------------ */

  function load(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
      return fallback;
    }
  }

  function save(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      /* storage unavailable (private mode, etc.) — app still works in-memory */
    }
  }

  function mealById(id) {
    for (var i = 0; i < MEALS.length; i++) if (MEALS[i].id === id) return MEALS[i];
    return null;
  }

  function namesOf(meal) {
    return meal.ingredients.map(function (ing) { return ing.name; });
  }

  function calPerGOf(meal, name) {
    for (var i = 0; i < meal.ingredients.length; i++) {
      if (meal.ingredients[i].name === name) return meal.ingredients[i].calPerG;
    }
    return 1;
  }

  /* ------------------------------------------------------------------ *
   * State
   * ------------------------------------------------------------------ */

  var savedConfigs = load(KEYS.saved, {}); // { mealId: [ {id,name,allocations} ] }
  var session = load(KEYS.session, null);
  var savedChips = (session && session.chips) || {}; // { mealId: last selected chip id }

  var state = {
    activeMealId: (session && mealById(session.activeMealId)) ? session.activeMealId : MEALS[0].id,
    perMeal: {},  // { mealId: { allocations, selectedId } }
    lastChip: {}, // { mealId: last selected chip id, restored on next load }
  };

  // Restore each meal to its last selected chip; untouched meals fall back to 500.
  MEALS.forEach(function (meal) {
    var slot = slotForChip(meal, savedChips[meal.id]);
    slot.locked = {}; // { ingredientName: true } — in-memory only, cleared on reload
    state.perMeal[meal.id] = slot;
    state.lastChip[meal.id] = slot.selectedId;
  });

  // Resolve a saved chip id to a slot; unknown/missing chip -> first preset (500).
  function slotForChip(meal, chipId) {
    if (chipId && chipId.indexOf('preset:') === 0) {
      var p = parseInt(chipId.slice(7), 10);
      if ((meal.presets || []).indexOf(p) !== -1) {
        return { allocations: scaleToTotal(namesOf(meal), meal.base, p), selectedId: chipId };
      }
    } else if (chipId && chipId.indexOf('saved:') === 0) {
      var sid = chipId.slice(6);
      var list = savedConfigs[meal.id] || [];
      for (var i = 0; i < list.length; i++) {
        if (list[i].id === sid) return { allocations: sanitize(meal, list[i].allocations), selectedId: chipId };
      }
    }
    return defaultSlot(meal);
  }

  // Initial slot for a meal: the first preset applied (falls back to the base split).
  function defaultSlot(meal) {
    var presets = meal.presets || [];
    if (presets.length) {
      var p = presets[0];
      return { allocations: scaleToTotal(namesOf(meal), meal.base, p), selectedId: 'preset:' + p };
    }
    return { allocations: cloneBase(meal), selectedId: 'default' };
  }

  function cloneBase(meal) {
    var a = {};
    namesOf(meal).forEach(function (n) { a[n] = Math.max(0, Math.round(meal.base[n] || 0)); });
    return a;
  }

  // Keep only current ingredients; fill missing from base.
  function sanitize(meal, alloc) {
    var out = {};
    namesOf(meal).forEach(function (n) {
      out[n] = Math.max(0, Math.round(typeof alloc[n] === 'number' ? alloc[n] : (meal.base[n] || 0)));
    });
    return out;
  }

  function persist() {
    // Remember the last active meal and each meal's last selected chip. Untouched
    // meals fall back to the 500 preset on load (see slotForChip / defaultSlot).
    save(KEYS.session, { activeMealId: state.activeMealId, chips: state.lastChip });
    save(KEYS.saved, savedConfigs);
  }

  function activeMeal() { return mealById(state.activeMealId); }
  function activeSlot() { return state.perMeal[state.activeMealId]; }

  /* ------------------------------------------------------------------ *
   * Mutations
   * ------------------------------------------------------------------ */

  function setMeal(id) {
    if (!mealById(id)) return;
    state.activeMealId = id;
    persist();
    renderAll();
  }

  function toggleLock(name) {
    var slot = activeSlot();
    if (slot.locked[name]) delete slot.locked[name];
    else slot.locked[name] = true;
    // locking only pins the value; it doesn't change allocations or the selected chip
    syncValues();
  }

  function adjustIngredient(name, deltaSteps) {
    var slot = activeSlot();
    if (slot.locked[name]) return; // locked ingredients can't be changed
    slot.allocations[name] = Math.max(0, slot.allocations[name] + deltaSteps * STEP);
    slot.selectedId = null; // now a custom, unsaved state
    persist();
    syncValues();
  }

  function setIngredient(name, value) {
    var slot = activeSlot();
    if (slot.locked[name]) return;
    slot.allocations[name] = Math.max(0, Math.round(value || 0));
    slot.selectedId = null;
    persist();
    syncValues();
  }

  function scaleTotal(targetTotal) {
    var meal = activeMeal();
    var slot = activeSlot();
    // locked ingredients stay put; unlocked absorb the change by their current ratio
    slot.allocations = distributeWithLocks(namesOf(meal), slot.allocations, targetTotal, slot.locked, slot.allocations);
    slot.selectedId = null;
    persist();
    syncValues();
  }

  function stepTotal(deltaSteps) {
    scaleTotal(totalOf(activeSlot().allocations) + deltaSteps * STEP);
  }

  function applyPreset(presetTotal) {
    var meal = activeMeal();
    var slot = activeSlot();
    // scale from the BASE ratio to the preset total, but keep locked ingredients fixed
    slot.allocations = distributeWithLocks(namesOf(meal), meal.base, presetTotal, slot.locked, slot.allocations);
    slot.selectedId = 'preset:' + presetTotal;
    state.lastChip[meal.id] = slot.selectedId;
    persist();
    syncValues();
  }

  function applySaved(cfg) {
    var meal = activeMeal();
    var slot = activeSlot();
    slot.allocations = sanitize(meal, cfg.allocations); // a saved snapshot loads exactly
    slot.locked = {};                                   // ...so clear any locks
    slot.selectedId = 'saved:' + cfg.id;
    state.lastChip[meal.id] = slot.selectedId;
    persist();
    syncValues();
  }

  function saveCurrentAs(name) {
    var meal = activeMeal();
    var slot = activeSlot();
    var id = (window.crypto && crypto.randomUUID) ? crypto.randomUUID()
           : 'c' + Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36);
    var cfg = { id: id, name: name, allocations: {} };
    namesOf(meal).forEach(function (n) { cfg.allocations[n] = slot.allocations[n]; });
    if (!savedConfigs[meal.id]) savedConfigs[meal.id] = [];
    savedConfigs[meal.id].push(cfg);
    slot.selectedId = 'saved:' + id;
    state.lastChip[meal.id] = slot.selectedId;
    persist();
    renderAll();
  }

  function deleteSaved(cfgId) {
    var meal = activeMeal();
    var list = savedConfigs[meal.id] || [];
    savedConfigs[meal.id] = list.filter(function (c) { return c.id !== cfgId; });
    var slot = activeSlot();
    if (slot.selectedId === 'saved:' + cfgId) slot.selectedId = null;
    if (state.lastChip[meal.id] === 'saved:' + cfgId) state.lastChip[meal.id] = null;
    persist();
    renderAll();
  }

  /* ------------------------------------------------------------------ *
   * Rendering
   * ------------------------------------------------------------------ */

  var el = {}; // cached DOM refs

  function h(tag, attrs, children) {
    var node = document.createElement(tag);
    if (attrs) for (var k in attrs) {
      if (k === 'class') node.className = attrs[k];
      else if (k === 'text') node.textContent = attrs[k];
      else if (k.slice(0, 2) === 'on') node.addEventListener(k.slice(2), attrs[k]);
      else node.setAttribute(k, attrs[k]);
    }
    (children || []).forEach(function (c) {
      if (c) node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    });
    return node;
  }

  function renderMealSelect() {
    var sel = el.mealSelect;
    sel.innerHTML = '';
    MEALS.forEach(function (meal) {
      var opt = h('option', { value: meal.id, text: meal.name });
      if (meal.id === state.activeMealId) opt.selected = true;
      sel.appendChild(opt);
    });
  }

  function renderConfigBar() {
    var meal = activeMeal();
    var bar = el.configChips;
    bar.innerHTML = '';

    // built-in presets
    (meal.presets || []).forEach(function (p) {
      bar.appendChild(chip(p + ' cal', 'preset:' + p, function () { applyPreset(p); }));
    });

    // saved configs (with delete)
    (savedConfigs[meal.id] || []).forEach(function (cfg) {
      var c = chip(cfg.name, 'saved:' + cfg.id, function () { applySaved(cfg); });
      c.appendChild(h('button', {
        'class': 'chip-x', 'aria-label': 'Delete ' + cfg.name, text: '×',
        onclick: function (e) {
          e.stopPropagation();
          if (confirm('Delete saved configuration "' + cfg.name + '"?')) deleteSaved(cfg.id);
        },
      }));
      bar.appendChild(c);
    });

    // save-current-as action, styled like a chip, at the end of the row
    bar.appendChild(h('button', {
      'class': 'chip chip-save', type: 'button', 'aria-label': 'Save current as a new configuration',
      onclick: function () {
        var name = prompt('Name this configuration (e.g. "Big lunch"):');
        if (name && name.trim()) saveCurrentAs(name.trim());
      },
    }, ['+ Save']));
  }

  function chip(label, id, onclick) {
    var active = activeSlot().selectedId === id;
    return h('button', {
      'class': 'chip' + (active ? ' chip-active' : ''),
      'data-id': id, onclick: onclick,
    }, [label]);
  }

  // open + closed padlock; CSS shows one based on the .lock-on class. Uses currentColor.
  var LOCK_SVG =
    '<svg class="ic-open" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V7a4 4 0 0 1 7.5-2"/></svg>' +
    '<svg class="ic-closed" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>';

  function renderIngredients() {
    var meal = activeMeal();
    var wrap = el.ingredients;
    wrap.innerHTML = '';

    meal.ingredients.forEach(function (ing) {
      var row = h('div', { 'class': 'row', 'data-name': ing.name });

      var lockBtn = h('button', {
        'class': 'lock', type: 'button', 'data-lock': ing.name, 'aria-pressed': 'false',
        'aria-label': 'Lock ' + ing.name + ' calories',
        onclick: function () { toggleLock(ing.name); },
      });
      lockBtn.innerHTML = LOCK_SVG;

      var head = h('div', { 'class': 'row-head' }, [
        lockBtn,
        h('span', { 'class': 'row-name' }, [
          h('span', { 'class': 'row-emoji', 'aria-hidden': 'true', text: ing.emoji || '' }),
          ing.name,
        ]),
        h('span', { 'class': 'row-grams', 'data-grams': ing.name }),
      ]);

      var input = h('input', {
        'class': 'num row-cal', type: 'number', step: STEP, min: 0,
        inputmode: 'numeric', 'data-cal': ing.name, 'aria-label': ing.name + ' calories',
      });
      input.addEventListener('change', function () { setIngredient(ing.name, parseFloat(input.value)); });
      input.addEventListener('input', function () { liveGrams(ing.name, parseFloat(input.value)); });

      var controls = h('div', { 'class': 'stepper' }, [
        h('button', { 'class': 'step', 'aria-label': 'Decrease ' + ing.name + ' by 5',
          onclick: function () { adjustIngredient(ing.name, -1); }, text: '−5' }),
        input,
        h('span', { 'class': 'unit', text: 'cal' }),
        h('button', { 'class': 'step', 'aria-label': 'Increase ' + ing.name + ' by 5',
          onclick: function () { adjustIngredient(ing.name, 1); }, text: '+5' }),
      ]);

      var bar = h('div', { 'class': 'bar' }, [h('div', { 'class': 'bar-fill', 'data-bar': ing.name })]);

      row.appendChild(head);
      row.appendChild(controls);
      row.appendChild(bar);
      wrap.appendChild(row);
    });
  }

  // Grams is the key meal-prep number: big value + small unit. `g` is a number, so safe.
  function gramsHTML(g) {
    return '<span class="g-num">' + g + '</span><span class="g-unit">g</span>';
  }

  // Update values in place without destroying focused inputs.
  function syncValues() {
    var meal = activeMeal();
    var slot = activeSlot();
    var total = totalOf(slot.allocations);

    if (document.activeElement !== el.totalInput) el.totalInput.value = total;

    meal.ingredients.forEach(function (ing) {
      var cal = slot.allocations[ing.name];
      var locked = !!slot.locked[ing.name];
      var input = el.ingredients.querySelector('[data-cal="' + cssEsc(ing.name) + '"]');
      var gramsEl = el.ingredients.querySelector('[data-grams="' + cssEsc(ing.name) + '"]');
      var barEl = el.ingredients.querySelector('[data-bar="' + cssEsc(ing.name) + '"]');
      if (input && document.activeElement !== input) input.value = cal;
      if (gramsEl) gramsEl.innerHTML = gramsHTML(gramsFor(cal, calPerGOf(meal, ing.name)));
      if (barEl) barEl.style.width = (total > 0 ? (cal / total) * 100 : 0) + '%';

      // reflect lock state: disable this ingredient's steppers/input, toggle the lock button
      var row = input && input.closest ? input.closest('.row') : null;
      if (row) {
        row.classList.toggle('locked', locked);
        var steps = row.querySelectorAll('.step');
        for (var s = 0; s < steps.length; s++) steps[s].disabled = locked;
        var lockBtn = row.querySelector('.lock');
        if (lockBtn) {
          lockBtn.classList.toggle('lock-on', locked);
          lockBtn.setAttribute('aria-pressed', locked ? 'true' : 'false');
          lockBtn.setAttribute('aria-label', (locked ? 'Unlock ' : 'Lock ') + ing.name + ' calories');
        }
      }
      if (input) input.disabled = locked;
    });

    // highlight the active config chip
    var chips = el.configChips.querySelectorAll('.chip');
    for (var i = 0; i < chips.length; i++) {
      chips[i].classList.toggle('chip-active', chips[i].getAttribute('data-id') === slot.selectedId);
    }
  }

  // Live grams while typing (before the value is committed/rounded).
  function liveGrams(name, value) {
    var meal = activeMeal();
    var gramsEl = el.ingredients.querySelector('[data-grams="' + cssEsc(name) + '"]');
    if (gramsEl && !isNaN(value)) gramsEl.innerHTML = gramsHTML(gramsFor(Math.max(0, value), calPerGOf(meal, name)));
  }

  function cssEsc(s) {
    return (window.CSS && CSS.escape) ? CSS.escape(s) : s.replace(/["\\]/g, '\\$&');
  }

  function renderAll() {
    renderMealSelect();
    renderConfigBar();
    renderIngredients();
    syncValues();
  }

  /* ------------------------------------------------------------------ *
   * Wire up
   * ------------------------------------------------------------------ */

  function init() {
    el.mealSelect = document.getElementById('meal-select');
    el.configChips = document.getElementById('config-chips');
    el.totalInput = document.getElementById('total-input');
    el.totalDown = document.getElementById('total-down');
    el.totalUp = document.getElementById('total-up');
    el.ingredients = document.getElementById('ingredients');

    el.mealSelect.addEventListener('change', function () { setMeal(el.mealSelect.value); });
    el.totalDown.addEventListener('click', function () { stepTotal(-1); });
    el.totalUp.addEventListener('click', function () { stepTotal(1); });
    el.totalInput.addEventListener('change', function () { scaleTotal(parseFloat(el.totalInput.value)); });

    renderAll();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
