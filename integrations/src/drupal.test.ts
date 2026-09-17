import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse as parseYaml } from 'yaml';
import { describe, expect, it } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));
const read = (relative: string) => readFileSync(join(here, '..', relative), 'utf8');

const MODULE_DIR = 'drupal/pulxon';

const infoYamlSource = read(`${MODULE_DIR}/pulxon.info.yml`);
const librariesYamlSource = read(`${MODULE_DIR}/pulxon.libraries.yml`);
const routingYamlSource = read(`${MODULE_DIR}/pulxon.routing.yml`);
const linksMenuYamlSource = read(`${MODULE_DIR}/pulxon.links.menu.yml`);
const schemaYamlSource = read(`${MODULE_DIR}/config/schema/pulxon.schema.yml`);
const modulePhp = read(`${MODULE_DIR}/pulxon.module`);
const formPhp = read(`${MODULE_DIR}/src/Form/PulxonSettingsForm.php`);

// The settings the WordPress plugin and the Joomla module both expose, spelled the same way,
// so every package writes and reads the same closed set of options.
const SETTINGS = ['site_key', 'position', 'size', 'icon', 'color', 'lang', 'statement_url', 'hide_on_mobile', 'branding'];

/**
 * The exact shape `SITE_KEY` in `packages/widget/src/config/options.ts` accepts — hand-copied,
 * not imported, the same way `SETTINGS` above is hand-copied.
 */
const SITE_KEY_PATTERN_SOURCE = 'pk_(?:live|test)_[A-Za-z0-9]{8,64}';

describe('pulxon.info.yml', () => {
  it('parses as YAML and declares what Drupal needs to list and configure the module', () => {
    const info = parseYaml(infoYamlSource) as Record<string, unknown>;
    expect(info.name).toBeTruthy();
    expect(info.type).toBe('module');
    expect(info.description).toBeTruthy();
    expect(info.core_version_requirement).toBe('^10 || ^11');
    expect(info.configure).toBe('pulxon.settings');
  });
});

describe('pulxon.libraries.yml', () => {
  it('declares one library whose js entry points at the bundled file, deferred', () => {
    const libraries = parseYaml(librariesYamlSource) as Record<string, { js?: Record<string, { attributes?: Record<string, unknown> }> }>;
    const names = Object.keys(libraries);
    expect(names.length).toBe(1);

    const [name] = names;
    expect(name, 'no library name found').toBeDefined();
    const library = libraries[name!];
    expect(library, `no library entry for "${name}"`).toBeDefined();
    const jsEntries = Object.entries(library!.js ?? {});
    expect(jsEntries.length).toBe(1);

    const [entry] = jsEntries;
    expect(entry, 'no js entry found').toBeDefined();
    const [file, definition] = entry!;
    expect(file).toMatch(/pulxon\.min\.js$/);
    expect(definition.attributes).toEqual(expect.objectContaining({ defer: true }));
  });
});

describe('pulxon.routing.yml', () => {
  it('gives the settings route the site-configuration permission', () => {
    const routing = parseYaml(routingYamlSource) as Record<string, { requirements?: Record<string, string> }>;
    const route = routing['pulxon.settings'];
    expect(route).toBeDefined();
    expect(route!.requirements?._permission).toBe('administer site configuration');
  });
});

describe('pulxon.links.menu.yml', () => {
  it('parses as YAML and links to the settings route', () => {
    const links = parseYaml(linksMenuYamlSource) as Record<string, { route_name?: string }>;
    const entries = Object.values(links);
    expect(entries.length).toBeGreaterThan(0);
    expect(entries.some((link) => link.route_name === 'pulxon.settings')).toBe(true);
  });

  it('parents the link to a menu id core actually defines, so it doesn\'t silently re-parent to the admin root', () => {
    // Core's own id is `system.admin_config_ui` (Configuration -> User interface). An unknown
    // parent id is not an install error — Drupal just re-parents the link to the admin root,
    // so the link ends up as a top-level item instead of where the README and the link's own
    // description send the owner.
    const links = parseYaml(linksMenuYamlSource) as Record<string, { parent?: string }>;
    const entries = Object.values(links);
    expect(entries.some((link) => link.parent === 'system.admin_config_ui')).toBe(true);
    expect(entries.some((link) => link.parent === 'system.admin_config_user-interface')).toBe(false);
  });
});

describe('config/schema/pulxon.schema.yml', () => {
  it('types every setting the form writes', () => {
    const schema = parseYaml(schemaYamlSource) as Record<string, { mapping?: Record<string, { type?: string }> }>;
    const mapping = schema['pulxon.settings']?.mapping ?? {};
    for (const setting of SETTINGS) {
      const entry = mapping[setting];
      expect(entry, `schema must type "${setting}"`).toBeDefined();
      expect(entry!.type).toBeTruthy();
    }
  });
});

describe('src/Form/PulxonSettingsForm.php', () => {
  it('extends ConfigFormBase and declares getEditableConfigNames', () => {
    expect(formPhp).toMatch(/class\s+PulxonSettingsForm\s+extends\s+ConfigFormBase/);
    expect(formPhp).toContain('getEditableConfigNames');
  });

  it('clears the library discovery cache after saving, so hook_library_info_alter is re-run instead of serving the cached (pre-save) library definition', () => {
    const submit = formPhp.match(/function\s+submitForm[\s\S]*?\n  }/);
    expect(submit, 'submitForm() not found').not.toBeNull();
    const body = submit![0];
    const saveIndex = body.indexOf('->save()');
    const clearIndex = body.indexOf("\\Drupal::service('library.discovery')->clearCachedDefinitions()");
    expect(saveIndex, 'submitForm must call ->save()').toBeGreaterThanOrEqual(0);
    expect(clearIndex, 'submitForm must clear the library discovery cache').toBeGreaterThanOrEqual(0);
    expect(clearIndex).toBeGreaterThan(saveIndex);
  });

  it('renders the site key as the very first field, before position', () => {
    const siteKeyIndex = formPhp.indexOf("\$form['site_key']");
    const positionIndex = formPhp.indexOf("\$form['position']");
    expect(siteKeyIndex, "\$form['site_key'] not found").toBeGreaterThanOrEqual(0);
    expect(positionIndex, "\$form['position'] not found").toBeGreaterThanOrEqual(0);
    expect(siteKeyIndex).toBeLessThan(positionIndex);
  });

  it('tells the customer where to find their site key and that leaving it empty is fine', () => {
    const field = formPhp.match(/\$form\['site_key'\]\s*=\s*\[[\s\S]*?\n {4}\];/);
    expect(field, "\$form['site_key'] declaration not found").not.toBeNull();
    expect(field![0]).toMatch(/pulxon dashboard/i);
    expect(field![0]).toMatch(/leav(e|ing)[^.]*empty/i);
  });

  it('rejects a site key that does not match the widget\'s own shape, server-side, before it can be saved', () => {
    const validate = formPhp.match(/function\s+validateForm[\s\S]*?\n  }/);
    expect(validate, 'validateForm() not found').not.toBeNull();
    const body = validate![0];
    expect(body).toContain(SITE_KEY_PATTERN_SOURCE);
    expect(body).toMatch(/preg_match/);
    expect(body).toContain('setErrorByName');
  });

  it('saves the site key', () => {
    const submit = formPhp.match(/function\s+submitForm[\s\S]*?\n  }/);
    expect(submit, 'submitForm() not found').not.toBeNull();
    expect(submit![0]).toContain("->set('site_key'");
  });

  it('gives every #type field a #title', () => {
    // Every `'#type' => '...'` field array must also declare `'#title' => ...` somewhere
    // before the next field starts, or a screen reader has nothing to announce for it.
    const fieldBlocks = formPhp.split(/(?=\$form\[)/).filter((block) => block.includes("'#type'"));
    expect(fieldBlocks.length).toBeGreaterThan(0);
    for (const block of fieldBlocks) {
      // Only check the first field's worth of the block (up to the next top-level $form[ assignment).
      expect(block, block.slice(0, 40)).toContain("'#title'");
    }
  });
});

describe('pulxon.module', () => {
  it('attaches the library in hook_page_attachments', () => {
    expect(modulePhp).toMatch(/function\s+pulxon_page_attachments\s*\(/);
    expect(modulePhp).toContain("'library'");
    expect(modulePhp).toContain('pulxon/pulxon.widget');
  });

  it('tags page_attachments with the settings config, so page-cached HTML is invalidated when the settings change', () => {
    const fn = modulePhp.match(/function\s+pulxon_page_attachments[\s\S]*?\n}/);
    expect(fn, 'pulxon_page_attachments() not found').not.toBeNull();
    expect(fn![0]).toContain("$attachments['#cache']['tags'][] = 'config:pulxon.settings';");
  });

  it('emits data-site-key when a site key is saved', () => {
    const fn = modulePhp.match(/function\s+pulxon_library_info_alter[\s\S]*?\n}/);
    expect(fn, 'pulxon_library_info_alter() not found').not.toBeNull();
    expect(fn![0]).toContain("\$attributes['data-site-key']");
  });

  it('passes the saved settings toward the widget, not as raw unescaped concatenation', () => {
    // The settings must reach either `drupalSettings` or the library's own `attributes`
    // array; both of Drupal's own render/library systems auto-escape on output. What must
    // never appear is a hand-built `<script ...>` string built with raw `.` concatenation.
    const usesDrupalSettings = modulePhp.includes('drupalSettings');
    const usesLibraryAttributes = modulePhp.includes("['attributes']");
    expect(usesDrupalSettings || usesLibraryAttributes).toBe(true);
    expect(modulePhp).not.toMatch(/['"]<script/i);
  });
});

describe('config/install/pulxon.settings.yml', () => {
  it('ships the same defaults the form shows, so config exists from install and is removed cleanly on uninstall', () => {
    // Drupal core copies everything under config/install into active config at module install,
    // and removes exactly those keys again at uninstall — without this file, the widget's
    // config does not exist at all until an administrator saves the settings form once, and
    // uninstalling never cleans it up because there is nothing in config/install to diff against.
    const source = read(`${MODULE_DIR}/config/install/pulxon.settings.yml`);
    const config = parseYaml(source) as Record<string, unknown>;
    expect(config).toEqual({
      site_key: '',
      position: 'bottom-left',
      size: 'medium',
      icon: 'person',
      color: '#1f4bff',
      lang: '',
      statement_url: '',
      hide_on_mobile: false,
      branding: true,
    });
  });
});

describe('the Drupal module as a whole', () => {
  it('makes no compliance or legal claim', () => {
    const all = `${infoYamlSource}${librariesYamlSource}${routingYamlSource}${linksMenuYamlSource}${schemaYamlSource}${modulePhp}${formPhp}`;
    expect(all).not.toMatch(/\b(ADA|WCAG compliant|compliance|certified|lawsuit)\b/i);
  });

  it('ships its own README.md, disclosing that it has never been executed and giving the same first-install checklist as integrations/README.md', () => {
    const readme = read(`${MODULE_DIR}/README.md`);
    expect(readme).toMatch(/has not been (run|executed)/i);
    expect(readme).toMatch(/staging/i);
    expect(readme).toMatch(/<\/body>/);
    expect(readme).toMatch(/settings save/i);
    expect(readme).toMatch(/widget opens/i);
  });
});
