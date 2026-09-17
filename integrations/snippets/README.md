# Pulxon — copy-paste snippets

These six platforms have no plugin/module/app format a build step can
package: there is nowhere to upload a file through this repository's own
build, only a text field to paste HTML or Liquid into. That is different
from the WordPress, Joomla and Drupal packages elsewhere in this repository,
which ship the widget's own files inside an installable zip — but the
result is the same: **these snippets are self-hosted, too.** They point at
`/pulxon/pulxon.min.js`, a path on the *owner's own site*, not at a
third-party CDN.

`@pulxon/widget` has never been published to any public npm-backed CDN, so a
URL pointing at one simply 404s — and there is no Pulxon-run CDN to fall
back to, either. Before a snippet does anything, you must **upload the
widget's files to your own site first**:

1. Get the widget's built files — `pulxon.min.js` and its `fonts/` folder —
   from the widget zip (or build them yourself with `pnpm --filter
   @pulxon/widget build`, which produces `packages/widget/dist/pulxon.min.js`
   and `packages/widget/dist/fonts/`).
2. Upload both to a `/pulxon/` folder at the root of your own site (via your
   host's file manager, FTP, or your platform's own file/theme-asset upload
   feature — check your platform's own docs for how to add a file at a fixed
   path), **keeping `fonts/` beside the script**: `/pulxon/pulxon.min.js` and
   `/pulxon/fonts/...`. The widget loads its own font files relative to its
   own script, so moving one without the other breaks it.
3. Confirm `https://<your-domain>/pulxon/pulxon.min.js` loads with a 200 in
   your browser before pasting the snippet.

Only once that path resolves does pasting the snippet below actually load
the widget.

| Platform | File | Where it goes |
|---|---|---|
| Shopify | `shopify.liquid` | Online Store → Themes → Edit code → layout/theme.liquid, right before `</body>` |
| Squarespace | `squarespace.html` | Settings → Advanced → Code Injection → Footer |
| Wix | `wix.html` | Settings → Custom Code → Add Custom Code → Body - end, applied to All Pages |
| Webflow | `webflow.html` | Project Settings → Custom Code → Footer Code |
| Tilda | `tilda.html` | Site Settings → More → Additional code → "Paste code before `</body>`" |
| Bitrix (1C-Bitrix) | `bitrix.php` | `local/templates/<your template>/footer.php`, right before `</body>` |

Every file's own first line repeats this, so it is still correct if a file
gets copied on its own without this README.

## What's in each file

Two comments and one `<script>` tag — nothing else. The tag is generated
from `buildScriptTag` in `integrations/src/snippet.ts`, the one function
every installable package in this repository also uses, so its attribute
names and escaping can never drift between a snippet and a package. Each
snippet is checked, by `integrations/src/snippets.test.ts`, to be exactly
what `buildScriptTag` produces — if you need to change the tag these files
emit, change `snippet.ts` or `integrations/src/generate-snippets.ts`, run
`npx tsx integrations/scripts/write-snippets.mts` to regenerate the files,
then run the tests, rather than hand-editing a snippet file.

## Setting a site key, color, position or any other option

The tag each snippet ships has no options set — it is the smallest tag that
works. Unlike the WordPress, Joomla and Drupal packages, there is no
settings screen behind a copy-paste snippet, so to set an option you edit
the `<script>` tag directly and add the matching `data-*` attribute, for
example:

```html
<script src="/pulxon/pulxon.min.js"
        data-site-key="pk_live_xxxxxxxx" data-color="#1f4bff" data-position="bottom-left" defer></script>
```

See `packages/widget/src/config/options.ts` (`parseDataAttributes`) in the
widget repository for the full list of attributes the widget reads, and the
top-level `README.md`'s "Data attributes" section for how each one behaves.

## Upgrading to a new widget version

There is no version pinned in the URL to update — `/pulxon/pulxon.min.js`
always resolves to whatever you last uploaded. When the widget publishes a
new version, download the new build and re-upload it to the same
`/pulxon/` folder, overwriting the old `pulxon.min.js` and `fonts/`. No
snippet or script tag needs to change.

## What this doesn't do

Pasting a snippet loads the widget on the pages where you pasted it. It does
not create an app listing and does not add a settings UI inside the
platform — see `integrations/README.md` in this repository for why a real
Shopify, Wix or Squarespace **app** is out of scope today, and what a
snippet gives you instead.
