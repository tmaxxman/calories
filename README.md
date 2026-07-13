# Meal Calorie Calculator

A tiny, static, mobile-first web app for hitting a calorie target on your regular meals.
Toggle between meals, nudge the whole meal or individual ingredients in 5-calorie steps
(ingredient ratios stay stable), and it tells you how many **grams** of each ingredient to
use. Pick built-in presets or save your own named configurations — everything is stored in
your browser and it reopens to whatever you last used.

No build step, no dependencies — just HTML, CSS, and JavaScript.

## Run it locally

Open `index.html` directly in a browser, **or** serve the folder (needed to test on your
phone over Wi-Fi):

```sh
python3 -m http.server 8000
```

Then visit `http://localhost:8000` — or `http://<your-mac-ip>:8000` from your phone on the
same network.

## Change your meals

Everything is defined in [`meals.js`](./meals.js). Each meal lists its ingredients with a
`calPerG` (calories **per gram** — that's the label's calories-per-100g ÷ 100), a default
calorie split (`base`), and quick-pick `presets`. Edit that file and reload.

```js
{
  id: 'salmon-rice-edamame',
  name: 'Salmon / Rice / Edamame',
  ingredients: [
    { name: 'Salmon',  calPerG: 2.06 },
    { name: 'Rice',    calPerG: 1.30 },
    { name: 'Edamame', calPerG: 1.22 },
  ],
  base: { Salmon: 300, Rice: 250, Edamame: 100 }, // multiples of 5
  presets: [500, 600, 700],
}
```

## How the math works

When you scale the whole meal, the total snaps to the nearest 5 calories and is split across
the ingredients in proportion to their current split — so **every** ingredient shifts
together and the ratios stay stable. Per-ingredient values are whole calories handed out via
the largest-remainder method so they **sum exactly** to the total. The individual `+`/`−`
buttons move one ingredient by 5. Grams are `calories ÷ calPerG`, rounded to the nearest gram.

Open [`tests.html`](./tests.html) in a browser to run the math test suite (should be all
green).

## Deploy (GitHub Pages)

It's fully static, so Pages needs no build. After pushing to a **public** repo, enable
Pages → *Deploy from a branch* → `main` / root. The app will be at
`https://<user>.github.io/<repo>/`.

**Before each deploy, run `./bump.sh`** — it stamps a fresh `?v=` token onto the `app.js`,
`meals.js`, and `styles.css` links in `index.html`. GitHub Pages caches files for ~10
minutes, so without this a page can load a new `index.html` against a stale cached script
and misbehave. Bumping the token makes a fresh page always fetch matching files.

Icons are a single `icon.svg`; add PNG icons to `manifest.webmanifest` later if you want a
crisper iOS home-screen icon.
