# Pulxon accessibility widget — Drupal module

A GPL-2.0-or-later Drupal module that adds an on-page toolbar letting a visitor adjust text size,
color, spacing and other display preferences. The widget's own files ship inside this module
(`assets/`, added when the package is built), so the toolbar is served from your own site's
domain — nothing is loaded from a third-party host.

## This module has not been executed

**This module has not been installed against a live Drupal site.** This environment has no `php`
binary and no Docker, so every file here was written and checked against Drupal's own documented
10/11 API only, never run. Install it on a staging site first, not a production one, and check:

1. **The script tag appears before `</body>`** (view your page's source, or your browser's
   network panel — it should load with a 200, from your own site's domain, not a third party).
2. **The settings save.** Open the settings form, change something visible like the accent color
   or position, save, and confirm the value is still there after a page reload.
3. **The widget opens.** Reload a front-end page, find the launcher button in the position you
   set, click it, and confirm the panel opens and the option you changed took effect.

If any of those three fail, treat it as a real defect in this module and do not proceed to a
production install until it's fixed.

## Installing

1. Copy the `pulxon` folder from the package zip into your site's `modules/contrib/` (or
   `modules/`) directory, or install `pulxon-drupal-<version>.zip` through **Extend → Add new
   module** if your site has that installer enabled.
2. Go to **Extend**, find **Pulxon Accessibility Widget** under the Pulxon package, check its box,
   and click **Install**.
3. A **Pulxon** settings form is added at **Configuration → User interface → Pulxon**; default
   settings (matching the widget's own defaults) are in place as soon as the module is installed,
   so the toolbar appears on every front-end page immediately, even before you visit the form.

## Where the settings are

**Configuration → User interface → Pulxon** (`/admin/config/user-interface/pulxon`), reachable
from that menu once the module is installed. The form covers the site key, launcher position,
size, icon, accent color, language, accessibility statement URL, and the mobile/branding
switches.

## What this module does not do

This widget adjusts how a page is displayed for the visitor who opens it. It does not change,
repair, or rebuild the page's underlying markup, and installing it does not change what the
page's HTML, images, or documents actually contain.
