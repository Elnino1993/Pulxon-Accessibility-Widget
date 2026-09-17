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
const SETTINGS = ['position', 'size', 'icon', 'color', 'lang', 'statement_url', 'hide_on_mobile', 'branding'];

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

    const library = libraries[names[0]];
    const jsEntries = Object.entries(library.js ?? {});
    expect(jsEntries.length).toBe(1);

    const [file, definition] = jsEntries[0];
    expect(file).toMatch(/pulxon\.min\.js$/);
    expect(definition.attributes).toEqual(expect.objectContaining({ defer: true }));
  });
});

describe('pulxon.routing.yml', () => {
  it('gives the settings route the site-configuration permission', () => {
    const routing = parseYaml(routingYamlSource) as Record<string, { requirements?: Record<string, string> }>;
    const route = routing['pulxon.settings'];
    expect(route).toBeDefined();
    expect(route.requirements?._permission).toBe('administer site configuration');
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
      expect(mapping[setting], `schema must type "${setting}"`).toBeDefined();
      expect(mapping[setting].type).toBeTruthy();
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

describe('the Drupal module as a whole', () => {
  it('makes no compliance or legal claim', () => {
    const all = `${infoYamlSource}${librariesYamlSource}${routingYamlSource}${linksMenuYamlSource}${schemaYamlSource}${modulePhp}${formPhp}`;
    expect(all).not.toMatch(/\b(ADA|WCAG compliant|compliance|certified|lawsuit)\b/i);
  });
});
