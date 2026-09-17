# Pulxon accessibility widget — Joomla module

A GPL-2.0-or-later Joomla site module that adds an on-page toolbar letting a visitor adjust text
size, color, spacing and other display preferences. The widget's own files ship inside this
module (`assets/`, added when the package is built), so the toolbar is served from your own
site's domain — nothing is loaded from a third-party host.

## This module has not been executed

**This module has not been installed against a live Joomla site.** This environment has no `php`
binary and no Docker, so every file here was written and checked against Joomla's own documented
manifest schema and API only, never run. Install it on a staging site first, not a production
one, and check:

1. **The script tag appears before `</body>`** (view your page's source, or your browser's
   network panel — it should load with a 200, from your own site's domain, not a third party).
2. **The settings save.** Open the module's own parameters, change something visible like the
   accent color or position, save, and confirm the value is still there after a page reload.
3. **The widget opens.** Reload a front-end page, find the launcher button in the position you
   set, click it, and confirm the panel opens and the option you changed took effect.

If any of those three fail, treat it as a real defect in this module and do not proceed to a
production install until it's fixed.

## Installing

1. In the Joomla administrator, go to **System → Install → Extensions** and upload
   `mod_pulxon-<version>.zip`.
2. Go to **Content → Site Modules → New**, choose **Pulxon Accessibility Widget**, and assign it
   to a position and the pages you want it on — any position works, since the module outputs only
   a `<script>` tag, not visible content.
3. **Publish the module with Advanced → Module Style set to `None`** (`style="none"`). This
   module's output is a single `<script>` tag with no visible content; any other module style
   wraps it in your template's module chrome (a heading, a border, a card), which would draw an
   empty-looking box around nothing.
4. Set **Status** to Published and **Save & Close**.

## Where the settings are

The module's own parameters — site key, launcher position, size, icon, accent color, language,
accessibility statement URL, and the mobile/branding switches — are on the module's own edit
screen (**Content → Site Modules → Pulxon Accessibility Widget**), under the **Basic Options**
tab. There is no separate settings page; every option lives on the module itself, the same as any
other Joomla module.

## What this module does not do

This widget adjusts how a page is displayed for the visitor who opens it. It does not change,
repair, or rebuild the page's underlying markup, and installing it does not change what the
page's HTML, images, or documents actually contain.
