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
    name: 'Salmon / Rice / Edamame',
    ingredients: [
      { name: 'Salmon',  calPerG: 2.06 }, // baked salmon, ~206 cal / 100g
      { name: 'Rice',    calPerG: 1.30 }, // cooked white rice, ~130 cal / 100g
      { name: 'Edamame', calPerG: 1.22 }, // shelled edamame, ~122 cal / 100g
    ],
    base: { Salmon: 300, Rice: 250, Edamame: 100 }, // 650 cal default
    presets: [500, 600, 700],
  },
  {
    id: 'chicken-sweetpotato-broccoli',
    name: 'Chicken / Sweet Potato / Broccoli',
    ingredients: [
      { name: 'Chicken',      calPerG: 1.65 }, // cooked breast, ~165 cal / 100g
      { name: 'Sweet Potato', calPerG: 0.90 }, // cooked, ~90 cal / 100g
      { name: 'Broccoli',     calPerG: 0.35 }, // cooked, ~35 cal / 100g
    ],
    base: { Chicken: 300, 'Sweet Potato': 200, Broccoli: 50 }, // 550 cal default
    presets: [500, 600, 700],
  },
  {
    id: 'yogurt-granola-berries',
    name: 'Yogurt / Granola / Berries',
    ingredients: [
      { name: 'Greek Yogurt', calPerG: 0.59 }, // nonfat, ~59 cal / 100g
      { name: 'Granola',      calPerG: 4.70 }, // ~470 cal / 100g
      { name: 'Berries',      calPerG: 0.57 }, // blueberries, ~57 cal / 100g
    ],
    base: { 'Greek Yogurt': 150, Granola: 200, Berries: 50 }, // 400 cal default
    presets: [350, 450, 550],
  },
];
