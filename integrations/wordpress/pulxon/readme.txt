=== Pulxon Accessibility Widget ===
Contributors: pulxon
Tags: accessibility, widget, toolbar, usability
Requires at least: 6.3
Requires PHP: 7.4
Stable tag: 0.6.1
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

Adds an on-page toolbar that lets a visitor adjust text size, color, spacing and other display preferences.

== This plugin has not been executed ==

This plugin has not been run against a live WordPress installation — it was written and checked
against WordPress's own documented API only, never installed on a real site. Install it on a
staging site first, not a production one, and check:

1. The script tag appears before `</body>` (view source, or your browser's network panel — it
   should load with a 200, from your own site's domain).
2. The settings save. Open Settings → Pulxon, change something, save, and reload to confirm the
   value stuck.
3. The widget opens. Reload a front-end page, find the launcher button, click it, and confirm the
   panel opens.

If any of those fail, treat it as a real defect and do not proceed to a production install.

== Description ==

Pulxon adds a small on-page toolbar that a visitor can open to adjust how the current page is
displayed for them, such as text size, color, spacing, and other on-page display preferences.
The toolbar is served from your own site — this plugin bundles the widget's own files — so
nothing is loaded from a third-party domain.

Choose a launcher position, size, icon and accent color from Settings → Pulxon, and optionally
link to your own accessibility statement page.

**What this plugin does not do**

This widget adjusts how a page is displayed for the visitor who opens it. It does not change,
repair, or rebuild the page's underlying markup, and activating it does not change what the
page's HTML, images, or documents actually contain. Whether a given page is easy for a visitor
to use is a property of the page itself, not of this plugin.

This plugin has not been tested against every theme and plugin combination on a live site — check
your pages after activating it.

== Installation ==

1. Upload the `pulxon` folder to `/wp-content/plugins/`, or install the plugin zip from Plugins →
   Add New → Upload Plugin.
2. Activate the plugin through the Plugins screen.
3. Go to Settings → Pulxon to choose a launcher position, size, icon and accent color, pick a
   language, and optionally add a link to your accessibility statement.
4. Click Save Changes. The toolbar now appears on every front-end page; it is never shown in
   wp-admin.

== Frequently Asked Questions ==

= Does installing this plugin make my site accessible? =

No single plugin can do that. It gives a visitor on-page controls to adjust the page to their own
preferences; it does not evaluate, change, or guarantee anything about your site's underlying
markup, content, or design.

= Where are the widget's files served from? =

From your own site. This plugin ships the widget's files under its own `assets/` directory and
enqueues them with `plugins_url()`, so nothing loads from a third-party domain.

= What happens if I deactivate the plugin? =

The toolbar stops loading immediately. Your saved settings are kept so they are ready again if
you reactivate the plugin.

== Changelog ==

= 0.6.1 =

The accessibility button can still be picked up and lifted anywhere, but let go it falls back to the
bottom of the screen, where it keeps its place across. Visitors who asked for less motion see it land
without the fall. The "Powered by Pulxon" link moved to the top of the panel, under its title.

= 0.6.0 =

Visitors can drag the accessibility button anywhere on the page, and drag the panel by its title bar;
both stay where they were put on the next visit. The panel is now a compact floating window with
four small tiles to a row, and only its content scrolls, so the close button never scrolls away.

= 0.5.0 =

The widget's default corner is now the bottom LEFT. A site that already saved a position keeps it;
only sites that never chose one move. The bottom-right corner is where themes and other plugins put
chat bubbles and back-to-top buttons, and a launcher hidden under one of those is a launcher the
visitor who needs it cannot reach.

= 0.4.0 =
* Initial release: front-end toolbar loaded from the site's own domain, Settings → Pulxon options
  page for position, size, icon, color, language, statement URL, and the mobile/branding switches.

== Upgrade Notice ==

= 0.4.0 =
Initial release.
