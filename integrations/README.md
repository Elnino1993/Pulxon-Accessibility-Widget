# Pulxon integrations

Installable packages and copy-paste snippets that put the Pulxon
accessibility widget on the platforms site owners actually run, without
depending on a CDN we have not built. Every package and snippet emits the
same `<script>` markup, defined once in `src/snippet.ts`
(`buildScriptTag`), so there is exactly one behaviour to reason about
across every platform.

## What each package is

| Platform | Where | What you get |
|---|---|---|
| WordPress | `wordpress/pulxon/` | A GPL-2.0-or-later plugin with a Settings → Pulxon screen. Installs like any other plugin; the widget's own files ship inside it. |
| Joomla | `joomla/mod_pulxon/` | A GPL-2.0-or-later site module with its own parameters (position, color, and so on) in the module manager. |
| Drupal | `drupal/pulxon/` | A GPL-2.0-or-later module with a Configuration → User interface → Pulxon settings form. |
| Google Tag Manager | `tag-manager/` | A custom tag template for a site owner who cannot touch their site's code. Takes only a script URL — Tag Manager cannot add `data-*` attributes to a script it injects, so no other option can be configured from it. See `tag-manager/README.md`. |

Each of the three packages above is built into its own zip by `src/build.ts`
(see "Building the zips" below) — the source directories here hold only the
platform's own code; the widget's built script, fonts and MIT licence are
added at build time, never committed twice.

## Which platforms get a package, which get a snippet, and why

Shopify, Squarespace, Wix, Webflow, Tilda and Bitrix have no
plugin/module/app format this repository can build and hand over: there is
nowhere on any of them to upload a file, only a text field to paste HTML or
Liquid into. Those six get a **copy-paste snippet** instead, in
`snippets/` — also generated from `buildScriptTag`, so a snippet's markup
can never drift from a package's. See `snippets/README.md` for exactly
where each one goes.

**Shopify, Wix and Squarespace do not get a marketplace app**, and that is
deliberate, not an oversight. A Shopify/Wix/Squarespace **app** (as opposed
to a snippet) requires a developer account in the founder's name, an OAuth
flow, a hosted backend to serve it, and each platform's own review process.
None of that exists yet, and a folder in this repository called
`shopify-app` containing nothing but a snippet would misrepresent what it
is. Those three platforms get the same snippet and install instructions as
Webflow, Tilda and Bitrix, plus whatever install guide the Pulxon dashboard
shows. PrestaShop and OpenCart modules are the obvious next two packages,
in the same shape as the Joomla module here, whenever that work is
scheduled.

## Building the zips

```bash
cd widget
pnpm --filter @pulxon/widget build       # produces packages/widget/dist/pulxon.min.js and dist/fonts/
pnpm --filter @pulxon/integrations build # produces integrations/dist/*.zip
```

`src/build.ts` reads the widget's version from
`packages/widget/package.json`, then for each of the three packages: copies
that platform's own source directory, adds `assets/pulxon.min.js` and
`assets/fonts/*` from the widget's build output, adds the widget's MIT
licence as `LICENSE-widget-MIT.txt` (copied from this repository's
top-level `LICENSE`, so it can't drift from what that file actually says),
and zips the result as `pulxon-wordpress-<version>.zip`,
`mod_pulxon-<version>.zip` and `pulxon-drupal-<version>.zip` in
`integrations/dist/` (git-ignored, along with every other `dist/`
directory in this repository).

**If the widget has not been built, `pnpm --filter @pulxon/integrations
build` fails immediately**, with an error naming the missing file and
telling you to build the widget first, rather than producing a zip with no
widget inside it — that is the one failure from this script that would
otherwise reach a customer as a silently broken install.

## The PHP has never been executed

**None of the PHP in `wordpress/`, `joomla/` or `drupal/` has run against a
real WordPress, Joomla or Drupal installation.** This environment has no
`php` binary and no Docker, so every file was written and reviewed against
each platform's documented API only — every function name, every hook,
every escaping call was checked by reading the platform's own
documentation, never by running the code. Each package's own settings
screen was written with that platform's capability check and CSRF/form
token in place (see each package's own PHP for exactly which), and every
value that reaches markup goes through that platform's own escaper
(`esc_attr`/`esc_url` in WordPress, `htmlspecialchars(...,
ENT_QUOTES, 'UTF-8')` in Joomla, Drupal's own render/Attribute escaping) —
but "checked against the documentation" is not the same thing as "run," and
this needs to be said plainly rather than discovered the hard way.

**The first install of any of these three packages should be on a staging
site, not a production one.** When you do that first install, check:

1. **The script tag appears before `</body>`**, sourced from the package's
   own `assets/pulxon.min.js` (view source, or the browser's network panel
   — it should load with a 200, from your own site's domain, not a
   third-party one).
2. **The settings save.** Open the package's settings screen (Settings →
   Pulxon in WordPress; the module's own parameters in Joomla; Configuration
   → User interface → Pulxon in Drupal), change something visible like the
   accent color or position, save, and confirm the saved value is still
   there after a page reload — not just that the save didn't error.
3. **The widget opens.** Reload a front-end page, find the widget's
   launcher button in the position you set, click it, and confirm the panel
   opens and the option you changed took effect.

If any of those three fail, treat it as a real defect in the package, file
an issue with what you saw, and do not proceed to a production install
until it's fixed.
