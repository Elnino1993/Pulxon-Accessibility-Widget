# Pulxon — Google Tag Manager template

For a site owner who manages their site through Google Tag Manager and cannot
edit the site's own code (no theme file, no plugin, no `<script>` tag to
paste in). This is a **custom tag template**, not a hosted app — nothing runs
on a Pulxon server, and nothing is reviewed or published to Tag Manager's
public Community Template Gallery. You import the `.tpl` file into your own
container.

## What this template can and cannot do

This template takes exactly **one** field: the widget's script URL. That is
not a simplification — it is a hard limit of the platform.

Tag Manager's sandboxed `injectScript` API creates the `<script>` element
itself and gives a template no way to add HTML attributes to it. The Pulxon
widget reads every one of its options — site key, color, position, language,
and so on — from `data-*` attributes on its own `<script>` tag, and only
from there today (see `packages/widget/src/config/options.ts`,
`parseDataAttributes`, in the widget repository). Put those two facts
together and the result is: **a site installed through this template runs
the widget with its built-in defaults** (bottom-right, medium, a blue
accent, branding on). There is no field here for a site key, a color, a
position, or anything else, because a field that did nothing would be worse
than no field at all.

If your site needs those options set, use one of these instead:

- The **WordPress**, **Joomla** or **Drupal** package in this repository —
  each has its own settings screen and adds the `data-*` attributes itself.
- The matching **copy-paste snippet** in `integrations/snippets/` for your
  platform, which you can edit by hand to add attributes.

The template's own `___NOTES___` section (visible inside Tag Manager, in the
template's info panel) repeats this, and proposes the smallest widget-side
change that would remove the limitation: the widget reading its options from
its own script URL's query string, as a lower-priority source than
`data-*` attributes, so nothing that already relies on attributes would
change. That change has not been made; this template does not depend on it.

## Installing the template

1. In Google Tag Manager, open your container, go to **Templates → Tag
   Templates → Search Gallery**, then choose **Import** (not the gallery
   search — this template is not published there) and select
   `pulxon-template.tpl` from this folder.
2. Tag Manager will list the one permission this template requests:
   `inject_script`, scoped to `https://cdn.jsdelivr.net/npm/@pulxon/widget@*/dist/pulxon.min.js`
   — the exact host and path the widget is served from, and nothing wider.
   Review it, then approve.
3. Create a new tag from the imported template, name it (for example
   "Pulxon accessibility widget"), and set **Pulxon widget script URL** to
   an exact, version-pinned URL, for example:

   ```
   https://cdn.jsdelivr.net/npm/@pulxon/widget@0.4.0/dist/pulxon.min.js
   ```

   Pin an exact version rather than a floating tag — an unpinned URL can
   change under you the next time the widget publishes a release.
4. Set the trigger to **All Pages** (or your site's equivalent "every page"
   trigger) and publish the container version.

## Verifying it worked

This has not been tested against a live Tag Manager container — Tag Manager
runs only in a browser, which this environment does not have. Before
trusting it on a live site:

- Use Tag Manager's **Preview** mode on the site, confirm the tag fires and
  shows no errors in the tag's own status panel.
- View the page source (or the DOM, since Tag Manager injects after load)
  and confirm the widget's `<script>` tag is present and that
  `pulxon.min.js` loaded (check the browser's network panel — a 200
  response, not a 404).
- Confirm the widget's launcher button appears on the page and opens the
  panel. It will use the built-in defaults described above; that is
  expected, not a bug.

## Why jsDelivr, and not a Pulxon CDN

There is no Pulxon-run CDN yet — the WordPress, Joomla and Drupal packages
avoid that entirely by shipping the widget's own files inside the package,
so those sites never depend on a server we have not built. Tag Manager has
no such option: `injectScript` only loads a remote URL, so this template has
to point somewhere. jsDelivr serves any version of the `@pulxon/widget` npm
package automatically, with no backend of ours involved — the same URL
pattern the widget's own top-level README already documents as its quick
start. `___WEB_PERMISSIONS___` restricts the template to exactly that host
and path, so an administrator reviewing the import is not asked to trust an
open-ended "inject any script" permission.
