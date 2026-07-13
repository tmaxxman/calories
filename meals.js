/*
 * meals.js — the ONLY file you edit to change meals.
 *
 * Each meal:
 *   id          unique slug (used as a localStorage key — don't reuse across meals)
 *   name        display name
 *   ingredients list of { name, calPerG } where calPerG = calories PER GRAM for the way
 *               YOU prepare that ingredient. (calPerG = calories-per-100g / 100.)
 *   base        default calorie split per ingredient. Values should be multiples of 5.
 *               This also defines the "base ratio" used when you pick a preset.
 *   presets     built-in whole-meal calorie targets shown as quick-pick chips.
 *
 * The numbers below are reasonable starting points for common cooked portions —
 * tweak calPerG to match the nutrition labels / sources you actually use.
 */
const MEALS = [
  {
    id: 'salmon-rice-edamame',
    name: 'Salmon & Rice',
    ingredients: [
      { name: 'Salmon',            calPerG: 2.0,  emoji: '🐟' }, // 200 cal / 100g
      { name: 'Rice',              calPerG: 1.3,  emoji: '🍚' }, // 130 cal / 100g
      { name: 'Edamame',           calPerG: 1.25, emoji: '🫘' }, // 125 cal / 100g
      { name: 'Snap Peas in EVOO', calPerG: 0.8,  emoji: '🫛' }, // 80 cal / 100g
    ],
    // Snap peas default to 0 cal, so all presets leave them at 0 until you add some.
    base: { Salmon: 300, Rice: 250, Edamame: 100, 'Snap Peas in EVOO': 0 }, // 650 cal default
    presets: [500, 600, 700],
  },
  {
    id: 'taco-bowl',
    name: 'Taco Bowl',
    ingredients: [
      { name: 'Taco Meat',               calPerG: 2.6, emoji: '🌮' }, // 260 cal / 100g
      { name: 'Potatoes Cooked in EVOO', calPerG: 1.2, emoji: '🥔' }, // 120 cal / 100g
      { name: 'Grilled Peppers',         calPerG: 0.7, emoji: '🫑' }, // 70 cal / 100g
    ],
    base: { 'Taco Meat': 300, 'Potatoes Cooked in EVOO': 200, 'Grilled Peppers': 50 }, // 550 cal default
    presets: [500, 600, 700],
  },
  {
    id: 'chicken-bowl',
    name: 'Chicken Bowl',
    ingredients: [
      { name: 'Chicken',                       calPerG: 2.0,  emoji: '🍗' }, // 200 cal / 100g
      { name: 'Sweet Potatoes Cooked in EVOO', calPerG: 1.24, emoji: '🍠' }, // 124 cal / 100g
      { name: 'Avocado',                       calPerG: 1.64, emoji: '🥑' }, // 164 cal / 100g
    ],
    base: { Chicken: 300, 'Sweet Potatoes Cooked in EVOO': 150, Avocado: 100 }, // 550 cal default
    presets: [500, 600, 700],
  },
];
