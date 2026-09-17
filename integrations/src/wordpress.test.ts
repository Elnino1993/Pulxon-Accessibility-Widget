import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));
const read = (relative: string) => readFileSync(join(here, '..', relative), 'utf8');

const plugin = read('wordpress/pulxon/pulxon.php');
const settings = read('wordpress/pulxon/includes/settings.php');
const readme = read('wordpress/pulxon/readme.txt');

/**
 * The exact shape `SITE_KEY` in `packages/widget/src/config/options.ts` accepts — hand-copied,
 * not imported (PHP cannot import a TypeScript module), the same way `POSITIONS`/`SIZES` are
 * hand-copied elsewhere in this file. A sanitize callback that accepted anything looser than
 * this would let a customer save a value the widget itself would silently reject.
 */
const SITE_KEY_PATTERN_SOURCE = 'pk_(?:live|test)_[A-Za-z0-9]{8,64}';

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
    // The script must come from the plugin's own directory on the site's domain.
    expect(plugin).toContain('plugins_url');

    // And nothing may reach out at runtime. URLs in the plugin header (the GPL
    // licence, the author page) are metadata WordPress reads, not requests, so
    // this checks the calls that would actually fetch something instead of
    // banning the string "https" outright.
    for (const fetcher of ['wp_remote_get', 'wp_remote_post', 'file_get_contents', 'curl_init', 'fopen']) {
      expect(plugin, fetcher).not.toContain(fetcher);
    }
    const enqueued = [...plugin.matchAll(/wp_(?:enqueue|register)_(?:script|style)\(([\s\S]{0,200})/g)];
    expect(enqueued.length).toBeGreaterThan(0);
    for (const call of enqueued) {
      expect(call[1], 'an enqueue must not name an external host').not.toMatch(/https?:\/\//);
    }
  });

  it('loads the script deferred and in the footer', () => {
    expect(plugin).toContain('wp_enqueue_script');
    expect(plugin).toMatch(/'strategy'\s*=>\s*'defer'/);
  });

  it('adds its data-* attributes through the wp_script_attributes filter, keyed by the script id, not by splicing the tag core built', () => {
    // script_loader_tag hands over a finished HTML string; splicing attributes in before the
    // first " src" breaks the moment anything else (an inline "before" script, a script
    // translation) adds markup ahead of that src for our handle. wp_script_attributes (WP
    // 5.7+) hands over the attribute array itself instead, with no string surgery involved.
    expect(plugin).toContain("add_filter( 'wp_script_attributes'");
    expect(plugin).not.toContain('script_loader_tag');
    expect(plugin).not.toMatch(/strpos\(\s*\$tag\s*,\s*'\s*src'\s*\)/);

    const filterFn = plugin.match(/function\s+pulxon_add_data_attributes[\s\S]*?\n}/);
    expect(filterFn, 'pulxon_add_data_attributes() not found').not.toBeNull();
    const body = filterFn![0];
    // Every script on the page fires this filter, so the handler must key off this script's
    // own id (`{handle}-js`, per the documented wp_script_attributes contract) before touching
    // the array, or it would corrupt every other plugin's and core's own script tags too.
    expect(body).toMatch(/PULXON_SCRIPT_HANDLE\s*\.\s*'-js'/);
    expect(body).toContain("\$attributes['id']");
  });

  it('documents itself for the plugin directory', () => {
    for (const heading of ['=== Pulxon', 'Stable tag:', '== Description ==', '== Installation ==', '== Changelog ==']) {
      expect(readme, heading).toContain(heading);
    }
  });

  it('makes no claim about compliance', () => {
    expect(`${plugin}${settings}${readme}`).not.toMatch(/\b(ADA|WCAG compliant|compliance|certified|lawsuit)\b/i);
  });

  describe('the site key field', () => {
    it('registers pulxon_site_key with a sanitize callback that enforces the widget\'s own site-key shape', () => {
      const registrationStart = settings.indexOf("register_setting(\n\t\tPULXON_OPTION_GROUP,\n\t\t'pulxon_site_key'");
      expect(registrationStart, 'no register_setting(...) call for pulxon_site_key').toBeGreaterThanOrEqual(0);
      const nextRegistration = settings.indexOf('register_setting(', registrationStart + 1);
      const body = settings.slice(registrationStart, nextRegistration > 0 ? nextRegistration : undefined);
      expect(body).toContain(SITE_KEY_PATTERN_SOURCE);
      expect(body).toMatch(/preg_match/);
    });

    it('renders the site key as the very first field on the settings screen', () => {
      const siteKeyField = settings.indexOf("add_settings_field( 'pulxon_site_key'");
      expect(siteKeyField, "add_settings_field( 'pulxon_site_key', ... ) not found").toBeGreaterThanOrEqual(0);
      const otherFields = ['pulxon_color', 'pulxon_position', 'pulxon_size', 'pulxon_icon', 'pulxon_lang', 'pulxon_statement_url', 'pulxon_hide_on_mobile', 'pulxon_branding'];
      for (const field of otherFields) {
        const index = settings.indexOf(`add_settings_field( '${field}'`);
        expect(index, `add_settings_field( '${field}', ... ) not found`).toBeGreaterThanOrEqual(0);
        expect(siteKeyField, `site key field must render before ${field}`).toBeLessThan(index);
      }
    });

    it('tells the customer where to find their site key and that leaving it empty is fine', () => {
      const renderFn = settings.match(/function\s+pulxon_render_site_key_field\s*\(\s*\)\s*\{[\s\S]*?\n\}/);
      expect(renderFn, 'pulxon_render_site_key_field() not found').not.toBeNull();
      expect(settings).toMatch(/pulxon dashboard/i);
      expect(settings).toMatch(/leav(e|ing)[^.]*empty/i);
    });

    it('emits data-site-key on the script tag when a site key is saved', () => {
      const filterFn = plugin.match(/function\s+pulxon_add_data_attributes[\s\S]*?\n}/);
      expect(filterFn, 'pulxon_add_data_attributes() not found').not.toBeNull();
      expect(filterFn![0]).toContain("get_option( 'pulxon_site_key'");
      expect(filterFn![0]).toContain("\$attributes['data-site-key']");
    });
  });

  describe('readme.txt', () => {
    it('does not claim a Screenshots section it does not ship', () => {
      expect(readme).not.toMatch(/==\s*Screenshots\s*==/i);
    });

    it('does not claim a WordPress version was tested, since none was', () => {
      expect(readme).not.toMatch(/Tested up to:/i);
    });

    it('discloses plainly that the plugin has never been run, and gives the same first-install checklist as integrations/README.md', () => {
      expect(readme).toMatch(/has not been (run|executed)/i);
      expect(readme).toMatch(/staging/i);
      expect(readme).toMatch(/<\/body>/);
      expect(readme).toMatch(/settings save/i);
      expect(readme).toMatch(/widget opens/i);
    });
  });
});
