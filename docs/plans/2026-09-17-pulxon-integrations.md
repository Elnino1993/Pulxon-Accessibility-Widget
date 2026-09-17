# Platform Integrations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship installable packages that put the Pulxon widget on the platforms site owners actually run — a WordPress plugin, a Joomla module, a Drupal module and a Google Tag Manager template — each carrying the widget's own files so the site never depends on a CDN we have not built yet.

**Architecture:** The packages live in the widget repo, in `integrations/`, as a workspace package `@pulxon/integrations`. Each platform gets a source folder holding only its own manifest, settings screen and template; the widget's built files are never committed twice — a build script copies `packages/widget/dist` into each package and produces a zip a site owner can upload. Every package emits the same script tag the README documents, with the site owner's choices as `data-*` attributes, so there is exactly one behaviour to reason about across four platforms.

**Tech Stack:** TypeScript and Vitest for the builder and its tests (the existing widget toolchain), PHP 7.4+ for the WordPress, Joomla and Drupal packages, Google Tag Manager's sandboxed JavaScript for the template, `archiver` for the zips.

## Global Constraints

- Branch: `feat/integrations`, from widget `main` (head `058f4ab`). One commit per task, conventional-commit subject, `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>` as a separate `-m`.
- Repo-local git identity is `Pulxon` / `dev@pulxon.com`. Never use a personal email in a commit.
- **PHP cannot be executed on this machine** — there is no `php` binary and no Docker. Every PHP file ships unrun. That raises the bar on review rather than lowering it: write the smallest code that can work, follow each platform's documented API exactly, and never invent a function name. Say plainly in each package's README that it has not been executed and what a site owner should check first.
- **Escaping is not optional.** Every value that reaches markup goes through the platform's escaper (`esc_attr`/`esc_url` in WordPress, `htmlspecialchars` with `ENT_QUOTES` in Joomla, Twig's autoescape or `Html::escape` in Drupal). A settings field is attacker-controlled the moment a site has more than one administrator.
- **Capability and CSRF checks are not optional.** A settings screen checks the platform's own permission (`manage_options` in WordPress, `core.admin` in Joomla, a route permission in Drupal) and uses the platform's own form token. Never write a settings handler without both.
- The widget is MIT licensed, so a GPL-2.0-or-later plugin may ship it. The WordPress package is GPL-2.0-or-later; keep the widget's own MIT notice in the package.
- No compliance or legal claims in any copy: never say or imply ADA, FTC, lawsuit risk, "compliant", "certified", or a risk score. These packages let a visitor adjust a page; they do not make a site accessible.
- Verification per task, from `widget/`, in the foreground: `pnpm --filter @pulxon/integrations test`, then `pnpm --filter @pulxon/integrations build` where the task says so. Never start a dev server.

---

## File structure

```
widget/integrations/
  package.json                     @pulxon/integrations, private, scripts: test, build
  vitest.config.ts
  src/
    snippet.ts                     buildScriptTag(options) — the one place the embed markup is defined
    snippet.test.ts
    build.ts                       copies the widget dist into each package and zips it
    build.test.ts
  wordpress/pulxon/                pulxon.php, includes/settings.php, readme.txt, LICENSE
  joomla/mod_pulxon/               mod_pulxon.xml, mod_pulxon.php, tmpl/default.php
  drupal/pulxon/                   pulxon.info.yml, pulxon.libraries.yml, pulxon.module,
                                   src/Form/PulxonSettingsForm.php, config/schema/pulxon.schema.yml
  tag-manager/                     pulxon-template.tpl, README.md
  snippets/                        shopify.liquid, squarespace.html, wix.html, webflow.html,
                                   tilda.html, README.md
  dist/                            built zips (git-ignored)
```

---

### Task 1: The one definition of the embed markup

**Files:**
- Create: `integrations/package.json`, `integrations/vitest.config.ts`, `integrations/tsconfig.json`
- Create: `integrations/src/snippet.ts`
- Test: `integrations/src/snippet.test.ts`
- Modify: `pnpm-workspace.yaml` (add `integrations` to the workspace globs if it is not already covered)

**Interfaces:**
- Produces: `export interface SnippetOptions { src: string; siteKey?: string | null; position?: string | null; mobilePosition?: string | null; color?: string | null; size?: string | null; icon?: string | null; lang?: string | null; statementUrl?: string | null; hideOnMobile?: boolean; branding?: boolean }` and `export function buildScriptTag(options: SnippetOptions): string`, used by Task 6's snippets and by every package's README.

- [ ] **Step 1: Write the failing test**

Create `integrations/src/snippet.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { buildScriptTag } from './snippet';

describe('buildScriptTag', () => {
  it('emits the smallest possible tag when nothing is configured', () => {
    expect(buildScriptTag({ src: '/pulxon/pulxon.min.js' })).toBe('<script src="/pulxon/pulxon.min.js" defer></script>');
  });

  it('adds only the attributes that were set', () => {
    expect(buildScriptTag({ src: '/w.js', position: 'bottom-left', color: '#1f4bff' })).toBe(
      '<script src="/w.js" data-position="bottom-left" data-color="#1f4bff" defer></script>',
    );
  });

  it('writes the booleans the way the widget reads them', () => {
    expect(buildScriptTag({ src: '/w.js', hideOnMobile: true, branding: false })).toBe(
      '<script src="/w.js" data-hide-on-mobile="true" data-branding="false" defer></script>',
    );
  });

  it('omits a boolean that is at its default', () => {
    expect(buildScriptTag({ src: '/w.js', hideOnMobile: false, branding: true })).toBe('<script src="/w.js" defer></script>');
  });

  it('escapes every value it writes into an attribute', () => {
    const tag = buildScriptTag({ src: '/w.js', statementUrl: 'https://example.com/a?b=1&c=2', color: '"><script>alert(1)</script>' });
    expect(tag).toContain('data-statement-url="https://example.com/a?b=1&amp;c=2"');
    expect(tag).not.toContain('<script>alert(1)');
    expect(tag.match(/<script/g)).toHaveLength(1);
  });

  it('keeps the attribute order stable, so a diff of a generated file is readable', () => {
    const first = buildScriptTag({ src: '/w.js', color: '#000000', position: 'top-left' });
    const second = buildScriptTag({ position: 'top-left', color: '#000000', src: '/w.js' });
    expect(first).toBe(second);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `pnpm --filter @pulxon/integrations test`
Expected: FAIL — the package does not exist yet. Create `integrations/package.json` (`"name": "@pulxon/integrations"`, `"private": true`, `"type": "module"`, scripts `test: vitest run` and `build: tsx src/build.ts`), a `vitest.config.ts` matching the widget package's, and a `tsconfig.json` extending the repo's base. Then the failure becomes "module not found".

- [ ] **Step 3: Implement it**

`snippet.ts` holds one ordered list of attribute names so the output is deterministic, escapes with a local `escapeAttribute` covering `&`, `<`, `>`, `"` and `'`, skips null, undefined and empty values, and emits `defer` last. No dependency; this file is copied into no package — it is what generates them.

- [ ] **Step 4: Run the test**

Run: `pnpm --filter @pulxon/integrations test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add integrations pnpm-workspace.yaml
git commit -m "feat(integrations): define the embed markup once" -m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 2: The WordPress plugin

**Files:**
- Create: `integrations/wordpress/pulxon/pulxon.php`, `integrations/wordpress/pulxon/includes/settings.php`, `integrations/wordpress/pulxon/readme.txt`, `integrations/wordpress/pulxon/LICENSE`
- Test: `integrations/src/wordpress.test.ts`

**Interfaces:**
- Consumes: nothing from Task 1 at runtime — the plugin builds its own tag in PHP. The test asserts the two agree.
- Produces: a plugin directory the build script zips as `pulxon-wordpress-<version>.zip`.

- [ ] **Step 1: Write the failing test**

Create `integrations/src/wordpress.test.ts`. Since PHP cannot run here, the test reads the source and asserts the things that most often go wrong, each of which is a real defect if absent:

```ts
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const plugin = readFileSync(new URL('../wordpress/pulxon/pulxon.php', import.meta.url), 'utf8');
const settings = readFileSync(new URL('../wordpress/pulxon/includes/settings.php', import.meta.url), 'utf8');
const readme = readFileSync(new URL('../wordpress/pulxon/readme.txt', import.meta.url), 'utf8');

describe('the WordPress plugin', () => {
  it('declares the header WordPress needs to list it', () => {
    for (const field of ['Plugin Name:', 'Description:', 'Version:', 'License:', 'Requires at least:', 'Requires PHP:']) {
      expect(plugin, field).toContain(field);
    }
    expect(plugin).toMatch(/License:\s*GPLv2 or later/);
  });

  it('refuses to run when loaded directly', () => {
    expect(plugin).toMatch(/defined\(\s*'ABSPATH'\s*\)\s*\|\|\s*exit/);
  });

  it('checks the administrator capability before rendering settings', () => {
    expect(settings).toContain("current_user_can( 'manage_options' )");
  });

  it('registers every setting with a sanitize callback', () => {
    const registrations = settings.match(/register_setting\(/g) ?? [];
    const callbacks = settings.match(/'sanitize_callback'/g) ?? [];
    expect(registrations.length).toBeGreaterThan(0);
    expect(callbacks.length).toBe(registrations.length);
  });

  it('escapes every option it prints', () => {
    // Any `echo $something` that is not wrapped in an escaper is a cross-site scripting hole.
    const unescaped = [...settings.matchAll(/echo\s+(?!esc_)/g)];
    expect(unescaped.map((match) => settings.slice(match.index, (match.index ?? 0) + 60))).toEqual([]);
  });

  it('ships the widget from the site itself, not from a third party', () => {
    expect(plugin).toContain('plugins_url');
    expect(plugin).not.toMatch(/https?:\/\/(?!pulxon\.com\/)/);
  });

  it('loads the script deferred and in the footer', () => {
    expect(plugin).toContain('wp_enqueue_script');
    expect(plugin).toMatch(/'strategy'\s*=>\s*'defer'/);
  });

  it('documents itself for the plugin directory', () => {
    for (const heading of ['=== Pulxon', 'Stable tag:', '== Description ==', '== Installation ==', '== Changelog ==']) {
      expect(readme, heading).toContain(heading);
    }
  });

  it('makes no claim about compliance', () => {
    expect(`${plugin}${settings}${readme}`).not.toMatch(/\b(ADA|WCAG compliant|compliance|certified|lawsuit)\b/i);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `pnpm --filter @pulxon/integrations test -- wordpress`
Expected: FAIL — the files do not exist.

- [ ] **Step 3: Write the plugin**

`pulxon.php`:
- the plugin header (Plugin Name `Pulxon Accessibility Widget`, Description one sentence about what a visitor can do, Version `0.4.0`, Requires at least `6.0`, Requires PHP `7.4`, License `GPLv2 or later`, Text Domain `pulxon`);
- `defined( 'ABSPATH' ) || exit;`
- a constant for the plugin version and one for the widget file path;
- `wp_enqueue_script( 'pulxon-widget', plugins_url( 'assets/pulxon.min.js', __FILE__ ), array(), PULXON_VERSION, array( 'in_footer' => true, 'strategy' => 'defer' ) );` on `wp_enqueue_scripts`, skipped in the admin;
- a `script_loader_tag` filter that adds the `data-*` attributes for the saved options to that one handle, each through `esc_attr`;
- `require_once` the settings file only in the admin.

`includes/settings.php`: a settings page under Settings → Pulxon using the Settings API — `register_setting` for each option with an explicit `sanitize_callback` (`sanitize_hex_color` for the colour, an allow-list closure for position, size, icon and language, `esc_url_raw` for the statement URL, a boolean cast for the two switches), `add_settings_section`, one `add_settings_field` per option, and a render callback per field that prints with `esc_attr`. The page body starts with `if ( ! current_user_can( 'manage_options' ) ) { return; }`.

`readme.txt` in the WordPress plugin-directory format, with `== Installation ==` telling the owner what to do and a short section saying what the widget does not do — it adjusts a page for a visitor and does not repair the page.

`LICENSE`: GPL-2.0.

- [ ] **Step 4: Run the test**

Run: `pnpm --filter @pulxon/integrations test -- wordpress`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add integrations
git commit -m "feat(integrations): add the WordPress plugin" -m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 3: The Joomla module

**Files:**
- Create: `integrations/joomla/mod_pulxon/mod_pulxon.xml`, `integrations/joomla/mod_pulxon/mod_pulxon.php`, `integrations/joomla/mod_pulxon/tmpl/default.php`
- Test: `integrations/src/joomla.test.ts`

**Interfaces:**
- Produces: a module directory the build script zips as `mod_pulxon-<version>.zip`, installable through Joomla's Extensions → Install.

- [ ] **Step 1: Write the failing test**

Create `integrations/src/joomla.test.ts` asserting, by reading the files:
- `mod_pulxon.xml` is well-formed XML (parse it, do not regex it — use `DOMParser` from `@xmldom/xmldom` if the repo already has it, otherwise assert the required substrings and say in the report that a parser was not available);
- it declares `type="module"`, `client="site"`, a `<version>`, `<files>` listing every file the package ships, and a `<config>` with one `<field>` per option;
- every `<field>` has a `name`, `type`, `label` and, for the choice fields, an `<option>` list matching the widget's accepted values;
- `mod_pulxon.php` guards with `defined('_JEXEC') or die;`;
- `tmpl/default.php` escapes every value with `htmlspecialchars(..., ENT_QUOTES, 'UTF-8')` — assert there is no `echo $` that is not wrapped;
- nothing in the three files makes a compliance claim.

- [ ] **Step 2: Run it and watch it fail**

Run: `pnpm --filter @pulxon/integrations test -- joomla`
Expected: FAIL.

- [ ] **Step 3: Write the module**

The module reads its params (`$params->get('position', 'bottom-right')` and so on), passes them to the template, and the template prints the script tag pointing at `Uri::root() . 'modules/mod_pulxon/assets/pulxon.min.js'`. Follow Joomla 4/5 conventions: namespaced helper not required for a module this small, but the manifest must declare `<version>4.0</version>`-era attributes correctly. Keep the module's output to the one script tag — a module that prints nothing else can be published in any position, and the README says to publish it in `footer` on all pages.

- [ ] **Step 4: Run the test, then commit**

```bash
git add integrations
git commit -m "feat(integrations): add the Joomla module" -m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 4: The Drupal module

**Files:**
- Create: `integrations/drupal/pulxon/pulxon.info.yml`, `pulxon.libraries.yml`, `pulxon.module`, `pulxon.links.menu.yml`, `pulxon.routing.yml`, `src/Form/PulxonSettingsForm.php`, `config/schema/pulxon.schema.yml`
- Test: `integrations/src/drupal.test.ts`

**Interfaces:**
- Produces: a module directory the build script zips as `pulxon-drupal-<version>.zip`.

- [ ] **Step 1: Write the failing test**

Create `integrations/src/drupal.test.ts` asserting:
- `pulxon.info.yml` parses as YAML (the repo already has a YAML parser available through `yaml` — if it does not, add it to the integrations package) and declares `name`, `type: module`, `description`, `core_version_requirement: ^10 || ^11`, `configure: pulxon.settings`;
- `pulxon.libraries.yml` declares one library whose `js` entry points at the bundled file with `{ attributes: { defer: true } }`;
- `pulxon.routing.yml` gives the settings route `_permission: 'administer site configuration'`;
- `PulxonSettingsForm.php` extends `ConfigFormBase`, declares `getEditableConfigNames`, and every `#type` field has a `#title`;
- `config/schema/pulxon.schema.yml` types every setting the form writes — a missing schema entry is the classic Drupal config bug;
- `pulxon.module` attaches the library in `hook_page_attachments` and passes the settings as `drupalSettings` or as attributes, escaping anything that reaches markup;
- no compliance claims anywhere.

- [ ] **Step 2: Run it and watch it fail, then write the module, then run it again**

Run: `pnpm --filter @pulxon/integrations test -- drupal`

- [ ] **Step 3: Commit**

```bash
git add integrations
git commit -m "feat(integrations): add the Drupal module" -m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 5: The Google Tag Manager template

**Files:**
- Create: `integrations/tag-manager/pulxon-template.tpl`, `integrations/tag-manager/README.md`
- Test: `integrations/src/tag-manager.test.ts`

**Interfaces:**
- Produces: a template a site owner imports through Tag Manager's template gallery import.

- [ ] **Step 1: Write the failing test**

A `.tpl` file is a sequence of `___SECTION___`-delimited blocks. Create `integrations/src/tag-manager.test.ts` asserting:
- every required section is present and in order: `___INFO___`, `___TEMPLATE_PARAMETERS___`, `___SANDBOXED_JS_FOR_WEB_TEMPLATE___`, `___WEB_PERMISSIONS___`, `___TESTS___`;
- `___INFO___` and `___TEMPLATE_PARAMETERS___` parse as JSON5-ish objects — assert with a tolerant parse (strip trailing commas) and check `displayName`, `description`, `categories` and that every parameter has a `name` and `type`;
- the sandboxed code uses only Tag Manager's own APIs (`injectScript`, `setInWindow`, `data.gtmOnSuccess`) — assert it never uses `document`, `window` directly or `eval`;
- `___WEB_PERMISSIONS___` declares `inject_script` with the exact host the template loads from, and nothing wider than that;
- the template has at least one entry in `___TESTS___`.

- [ ] **Step 2: Run it and watch it fail, then write the template**

The template takes the script URL and the same options as `data-*` values, and calls `injectScript(url, onSuccess, onFailure, cacheToken)`. Because Tag Manager cannot add attributes to an injected script, the template sets the options on `window.pulxonSettings` with `setInWindow` before injecting — and this task therefore also needs the widget to read that object when the script tag carries no attributes. **Do not change the widget in this task.** Instead, write the template so it passes the options as query parameters on the script URL, and record in the report that reading options from the URL is not something the widget does today, so the template ships with a note that only the script URL works until that lands. Then add a task-level note in the report proposing the smallest widget change that would fix it.

- [ ] **Step 3: Commit**

```bash
git add integrations
git commit -m "feat(integrations): add the Tag Manager template" -m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 6: Snippets for the platforms that take code, not packages

**Files:**
- Create: `integrations/snippets/shopify.liquid`, `squarespace.html`, `wix.html`, `webflow.html`, `tilda.html`, `bitrix.php`, `README.md`
- Test: `integrations/src/snippets.test.ts`

**Interfaces:**
- Consumes: `buildScriptTag` from Task 1 — the snippets are generated from it, not typed by hand, so they cannot drift.

- [ ] **Step 1: Write the failing test**

Assert that each snippet file contains exactly the tag `buildScriptTag` produces for that platform's documented path, that each carries a comment naming where it goes (for example, Shopify's says `layout/theme.liquid`, before `</body>`), and that the README lists every platform the dashboard's install guides mention. Then generate the files from `buildScriptTag` in the build script so the test and the files share one source.

- [ ] **Step 2: Write them, run the test, commit**

```bash
git add integrations
git commit -m "feat(integrations): add the copy-paste snippets" -m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 7: Build the packages and say what is untested

**Files:**
- Create: `integrations/src/build.ts`, `integrations/src/build.test.ts`, `integrations/README.md`
- Modify: `integrations/package.json` (add `archiver`), `.gitignore` (add `integrations/dist`)

- [ ] **Step 1: Write the failing test**

`build.test.ts` runs the builder into a temporary directory and asserts:
- one zip per package, named `pulxon-wordpress-0.4.0.zip`, `mod_pulxon-0.4.0.zip`, `pulxon-drupal-0.4.0.zip`;
- each zip contains the platform's own files **and** `assets/pulxon.min.js` plus the two font files and both licence files;
- the widget file inside the zip is byte-identical to `packages/widget/dist/pulxon.min.js`;
- the builder fails loudly when the widget has not been built, rather than shipping a package with no widget in it.

- [ ] **Step 2: Write the builder, run the test**

`build.ts` reads the version from `packages/widget/package.json`, copies `dist/pulxon.min.js`, `dist/fonts/*`, the widget's `LICENSE` and the platform's own files into a staging directory, writes the zip with `archiver`, and prints each package's path and size.

- [ ] **Step 3: Write `integrations/README.md`**

It says, in this order: what each package is, which platforms get a package and which get a snippet and why (a marketplace app needs a developer account and a hosted backend we do not have), how to build the zips, and — plainly — that the PHP in these packages has never been executed, that the first install should be on a staging site, and exactly what to check when it is (the script tag appears before `</body>`, the settings save, the widget opens).

- [ ] **Step 4: Verify everything and commit**

Run `pnpm --filter @pulxon/integrations test` and `pnpm --filter @pulxon/integrations build`, then from `widget/` run `pnpm --filter @pulxon/widget test` to confirm nothing in the widget package regressed.

```bash
git add integrations .gitignore
git commit -m "feat(integrations): build the installable packages" -m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Not in this plan (recorded)

Shopify, Wix and Squarespace apps. Each is a marketplace application: a developer account in the founder's name, an OAuth flow, a hosted backend to serve it, and a review process. None of that can be produced here, and a folder called "shopify-app" containing a snippet would be a lie about what it is. Those platforms get a snippet and the install guide the dashboard already shows. PrestaShop and OpenCart modules are the obvious next two packages, in the same shape as Joomla's.

## Verification of the whole branch

- `pnpm --filter @pulxon/integrations test` and `build` exit 0, and `pnpm --filter @pulxon/widget test` still passes.
- Every zip contains the widget build and the platform's files, and the widget file inside matches the one in `packages/widget/dist`.
- No package claims a site is compliant, certified, or protected from anything.
- Every README says the PHP has not been executed and what to check on the first install.
