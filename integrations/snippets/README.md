# Pulxon — copy-paste snippets

These six platforms have no plugin/module/app format a build step can
package: there is nowhere to upload a file, only a text field to paste HTML
or Liquid into. That is different from the WordPress, Joomla and Drupal
packages elsewhere in this repository, which ship the widget's own files —
these snippets instead load the widget from jsDelivr, which serves any
published version of the `@pulxon/widget` npm package with no backend of
ours involved (the same CDN the widget's own top-level README documents as
its quick start).

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
<script src="https://cdn.jsdelivr.net/npm/@pulxon/widget@0.4.0/dist/pulxon.min.js"
        data-site-key="pk_live_xxxxxxxx" data-color="#1f4bff" data-position="bottom-left" defer></script>
```

See `packages/widget/src/config/options.ts` (`parseDataAttributes`) in the
widget repository for the full list of attributes the widget reads, and the
top-level `README.md`'s "Data attributes" section for how each one behaves.

## Pin a version

Each snippet is generated with an exact version pinned in the URL
(`@0.4.0`). When the widget publishes a new version, regenerate the
snippets (see above) rather than editing the version number in six files by
hand, and re-paste the updated tag into each site.

## What this doesn't do

Pasting a snippet loads the widget on the pages where you pasted it. It does
not create an app listing and does not add a settings UI inside the
platform — see `integrations/README.md` in this repository for why a real
Shopify, Wix or Squarespace **app** is out of scope today, and what a
snippet gives you instead.
