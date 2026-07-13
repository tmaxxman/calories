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
      { name: 'Salmon',  calPerG: 2.06 }, // baked salmon, ~206 cal / 100g
      { name: 'Rice',    calPerG: 1.30 }, // cooked white rice, ~130 cal / 100g
      { name: 'Edamame', calPerG: 1.22 }, // shelled edamame, ~122 cal / 100g
    ],
    base: { Salmon: 300, Rice: 250, Edamame: 100 }, // 650 cal default
    presets: [500, 600, 700],
  },
  {
    id: 'taco-bowl',
    name: 'Taco Bowl',
    ingredients: [
      { name: 'Taco Meat', calPerG: 2.45 }, // seasoned ground beef, cooked, ~245 cal / 100g
      { name: 'Potatoes',  calPerG: 0.93 }, // cooked, ~93 cal / 100g
      { name: 'Peppers',   calPerG: 0.30 }, // bell peppers, ~30 cal / 100g
    ],
    base: { 'Taco Meat': 300, Potatoes: 200, Peppers: 50 }, // 550 cal default
    presets: [500, 600, 700],
  },
  {
    id: 'chicken-bowl',
    name: 'Chicken Bowl',
    ingredients: [
      { name: 'Chicken',      calPerG: 1.65 }, // cooked breast, ~165 cal / 100g
      { name: 'Sweet Potato', calPerG: 0.90 }, // cooked, ~90 cal / 100g
      { name: 'Avocado',      calPerG: 1.60 }, // ~160 cal / 100g
    ],
    base: { Chicken: 300, 'Sweet Potato': 150, Avocado: 100 }, // 550 cal default
    presets: [500, 600, 700],
  },
];
