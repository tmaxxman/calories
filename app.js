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
   * Scale a meal to a target total while keeping the ratio between ingredients
   * stable. The TOTAL is snapped to the nearest 5 cal, then split across the
   * ingredients in proportion to `weights` (the current allocation, or the
   * meal's base). Per-ingredient values are whole calories distributed with the
   * largest-remainder method so they sum EXACTLY to the (rounded) total.
   *
   * Distributing in 1-cal units (not 5-cal units) is what makes EVERY ingredient
   * shift together when the total nudges by 5 — instead of the whole +5 landing
   * on a single ingredient.
   *
   *   names        ordered ingredient names
   *   weights      { name: number } — the ratio source (current alloc, or base)
   *   targetTotal  desired total calories (snapped to nearest 5)
   */
  function scaleToTotal(names, weights, targetTotal) {
    var T = Math.max(0, roundTo5(targetTotal)); // total stays on the 5-cal grid
    var alloc = {};
    var i;

    var wsum = 0;
    for (i = 0; i < names.length; i++) wsum += Math.max(0, weights[names[i]] || 0);

    // No usable ratio -> even split.
    if (wsum <= 0) {
      var each = names.length ? Math.floor(T / names.length) : 0;
      for (i = 0; i < names.length; i++) alloc[names[i]] = each;
      var leftover = T - each * names.length;
      for (i = 0; i < leftover; i++) alloc[names[i]] += 1;
      return alloc;
    }

    // Ideal proportional quota per ingredient (in whole calories).
    var quotas = [];
    for (i = 0; i < names.length; i++) {
      var q = (Math.max(0, weights[names[i]] || 0) / wsum) * T;
      var base = Math.floor(q);
      quotas.push({ name: names[i], base: base, frac: q - base });
      alloc[names[i]] = base;
    }

    // Hand out the leftover calories to the largest fractional remainders.
    var assigned = 0;
    for (i = 0; i < quotas.length; i++) assigned += quotas[i].base;
    var rem = T - assigned;
    quotas.sort(function (a, b) { return b.frac - a.frac; });
    for (i = 0; i < rem; i++) alloc[quotas[i % quotas.length].name] += 1;

    return alloc;
  }

  window.CalMath = {
    STEP: STEP,
    roundTo5: roundTo5,
    gramsFor: gramsFor,
    totalOf: totalOf,
    scaleToTotal: scaleToTotal,
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

  var state = {
    activeMealId: (session && mealById(session.activeMealId)) ? session.activeMealId : MEALS[0].id,
    perMeal: {}, // { mealId: { allocations, selectedId } }
  };

  // Seed per-meal state from session or defaults.
  MEALS.forEach(function (meal) {
    var prev = session && session.perMeal && session.perMeal[meal.id];
    if (prev && prev.allocations) {
      state.perMeal[meal.id] = { allocations: sanitize(meal, prev.allocations), selectedId: prev.selectedId || null };
    } else {
      state.perMeal[meal.id] = { allocations: cloneBase(meal), selectedId: 'default' };
    }
  });

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
    var slim = { activeMealId: state.activeMealId, perMeal: {} };
    for (var id in state.perMeal) {
      if (state.perMeal.hasOwnProperty(id)) {
        slim.perMeal[id] = {
          allocations: state.perMeal[id].allocations,
          selectedId: state.perMeal[id].selectedId,
        };
      }
    }
    save(KEYS.session, slim);
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

  function adjustIngredient(name, deltaSteps) {
    var slot = activeSlot();
    slot.allocations[name] = Math.max(0, slot.allocations[name] + deltaSteps * STEP);
    slot.selectedId = null; // now a custom, unsaved state
    persist();
    syncValues();
  }

  function setIngredient(name, value) {
    var slot = activeSlot();
    slot.allocations[name] = Math.max(0, Math.round(value || 0));
    slot.selectedId = null;
    persist();
    syncValues();
  }

  function scaleTotal(targetTotal) {
    var meal = activeMeal();
    var slot = activeSlot();
    slot.allocations = scaleToTotal(namesOf(meal), slot.allocations, targetTotal);
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
    slot.allocations = scaleToTotal(namesOf(meal), meal.base, presetTotal); // scale from BASE ratio
    slot.selectedId = 'preset:' + presetTotal;
    persist();
    syncValues();
  }

  function resetToDefault() {
    var meal = activeMeal();
    var slot = activeSlot();
    slot.allocations = cloneBase(meal);
    slot.selectedId = 'default';
    persist();
    syncValues();
  }

  function applySaved(cfg) {
    var meal = activeMeal();
    var slot = activeSlot();
    slot.allocations = sanitize(meal, cfg.allocations);
    slot.selectedId = 'saved:' + cfg.id;
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
    persist();
    renderAll();
  }

  function deleteSaved(cfgId) {
    var meal = activeMeal();
    var list = savedConfigs[meal.id] || [];
    savedConfigs[meal.id] = list.filter(function (c) { return c.id !== cfgId; });
    var slot = activeSlot();
    if (slot.selectedId === 'saved:' + cfgId) slot.selectedId = null;
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

    // default chip
    bar.appendChild(chip('Default', 'default', function () { resetToDefault(); }));

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
  }

  function chip(label, id, onclick) {
    var active = activeSlot().selectedId === id;
    return h('button', {
      'class': 'chip' + (active ? ' chip-active' : ''),
      'data-id': id, onclick: onclick,
    }, [label]);
  }

  function renderIngredients() {
    var meal = activeMeal();
    var wrap = el.ingredients;
    wrap.innerHTML = '';

    meal.ingredients.forEach(function (ing) {
      var row = h('div', { 'class': 'row', 'data-name': ing.name });

      var head = h('div', { 'class': 'row-head' }, [
        h('span', { 'class': 'row-name', text: ing.name }),
        h('span', { 'class': 'row-grams', 'data-grams': ing.name }),
      ]);

      var input = h('input', {
        'class': 'num row-cal', type: 'number', step: STEP, min: 0,
        inputmode: 'numeric', 'data-cal': ing.name, 'aria-label': ing.name + ' calories',
      });
      input.addEventListener('change', function () { setIngredient(ing.name, parseFloat(input.value)); });
      input.addEventListener('input', function () { liveGrams(ing.name, parseFloat(input.value)); });

      var controls = h('div', { 'class': 'stepper' }, [
        h('button', { 'class': 'step', 'aria-label': 'Decrease ' + ing.name,
          onclick: function () { adjustIngredient(ing.name, -1); }, text: '−' }),
        input,
        h('span', { 'class': 'unit', text: 'cal' }),
        h('button', { 'class': 'step', 'aria-label': 'Increase ' + ing.name,
          onclick: function () { adjustIngredient(ing.name, 1); }, text: '+' }),
      ]);

      var bar = h('div', { 'class': 'bar' }, [h('div', { 'class': 'bar-fill', 'data-bar': ing.name })]);

      row.appendChild(head);
      row.appendChild(controls);
      row.appendChild(bar);
      wrap.appendChild(row);
    });
  }

  // Update values in place without destroying focused inputs.
  function syncValues() {
    var meal = activeMeal();
    var slot = activeSlot();
    var total = totalOf(slot.allocations);

    if (document.activeElement !== el.totalInput) el.totalInput.value = total;

    meal.ingredients.forEach(function (ing) {
      var cal = slot.allocations[ing.name];
      var input = el.ingredients.querySelector('[data-cal="' + cssEsc(ing.name) + '"]');
      var gramsEl = el.ingredients.querySelector('[data-grams="' + cssEsc(ing.name) + '"]');
      var barEl = el.ingredients.querySelector('[data-bar="' + cssEsc(ing.name) + '"]');
      if (input && document.activeElement !== input) input.value = cal;
      if (gramsEl) gramsEl.textContent = gramsFor(cal, calPerGOf(meal, ing.name)) + ' g';
      if (barEl) barEl.style.width = (total > 0 ? (cal / total) * 100 : 0) + '%';
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
    if (gramsEl && !isNaN(value)) gramsEl.textContent = gramsFor(Math.max(0, value), calPerGOf(meal, name)) + ' g';
  }

  function cssEsc(s) {
    return (window.CSS && CSS.escape) ? CSS.escape(s) : s.replace(/["\\]/g, '\\$&');
  }

  function renderAll() {
    renderMealSelect();
    el.mealTitle.textContent = activeMeal().name;
    renderConfigBar();
    renderIngredients();
    syncValues();
  }

  /* ------------------------------------------------------------------ *
   * Wire up
   * ------------------------------------------------------------------ */

  function init() {
    el.mealSelect = document.getElementById('meal-select');
    el.mealTitle = document.getElementById('meal-title');
    el.configChips = document.getElementById('config-chips');
    el.saveBtn = document.getElementById('save-btn');
    el.totalInput = document.getElementById('total-input');
    el.totalDown = document.getElementById('total-down');
    el.totalUp = document.getElementById('total-up');
    el.ingredients = document.getElementById('ingredients');

    el.mealSelect.addEventListener('change', function () { setMeal(el.mealSelect.value); });
    el.totalDown.addEventListener('click', function () { stepTotal(-1); });
    el.totalUp.addEventListener('click', function () { stepTotal(1); });
    el.totalInput.addEventListener('change', function () { scaleTotal(parseFloat(el.totalInput.value)); });
    el.saveBtn.addEventListener('click', function () {
      var name = prompt('Name this configuration (e.g. "Big lunch"):');
      if (name && name.trim()) saveCurrentAs(name.trim());
    });

    renderAll();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
