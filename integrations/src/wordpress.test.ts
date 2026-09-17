import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));
const read = (relative: string) => readFileSync(join(here, '..', relative), 'utf8');

const plugin = read('wordpress/pulxon/pulxon.php');
const settings = read('wordpress/pulxon/includes/settings.php');
const readme = read('wordpress/pulxon/readme.txt');

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
});
