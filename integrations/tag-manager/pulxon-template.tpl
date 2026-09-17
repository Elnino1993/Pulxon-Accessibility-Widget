___INFO___

{
  "type": "TAG",
  "id": "cvt_temp_public_id",
  "version": 1,
  "securityGroups": [],
  "displayName": "Pulxon Accessibility Widget",
  "categories": ["UTILITY"],
  "brand": {
    "id": "brand_pulxon",
    "displayName": "Pulxon",
    "thumbnail": "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBTAA7"
  },
  "description": "Loads the Pulxon accessibility widget from a single script URL you provide. Google Tag Manager's injectScript API cannot add data-* attributes to the <script> tag it creates, and the widget currently reads all of its options (site key, color, position, and so on) from those attributes — so this tag does not expose separate fields for them. Until the widget can also read its options from its own script URL, a site installed through this tag runs with the widget's built-in defaults. See this template's Notes, and integrations/tag-manager/README.md in the Pulxon widget repository, for exactly what that means and how to get full configuration today (the WordPress, Joomla and Drupal packages, or a platform snippet).",
  "containerContexts": ["WEB"]
}


___TEMPLATE_PARAMETERS___

[
  {
    "type": "TEXT",
    "name": "scriptUrl",
    "displayName": "Pulxon widget script URL",
    "simpleValueType": true,
    "valueValidators": [
      {
        "type": "NON_EMPTY"
      },
      {
        "type": "STARTS_WITH",
        "args": ["https://cdn.jsdelivr.net/npm/@pulxon/widget@"]
      }
    ],
    "help": "The full https:// URL of pulxon.min.js on jsDelivr, pinned to an exact version — for example https://cdn.jsdelivr.net/npm/@pulxon/widget@0.4.0/dist/pulxon.min.js. This is the ONE thing this tag takes. Tag Manager's injectScript API cannot add data-* attributes to the <script> tag it creates, so options such as data-site-key, data-color or data-position cannot be set from this tag the way they can in the WordPress, Joomla or Drupal packages — the widget will run with its built-in defaults until it can also read its options from this URL. See this template's Notes for details."
  }
]


___SANDBOXED_JS_FOR_WEB_TEMPLATE___

const injectScript = require('injectScript');
const gtmOnSuccess = require('gtmOnSuccess');
const gtmOnFailure = require('gtmOnFailure');

// injectScript is the only sandboxed API this tag needs, and the only one
// permitted to load a file outside the sandbox (see ___WEB_PERMISSIONS___,
// scoped to exactly the host below). It has no way to add data-* attributes
// to the <script> element it creates, which is why data.scriptUrl is the
// only input this template takes — see the TEMPLATE_PARAMETERS help text
// and this template's Notes for what that means for configuring the widget.
//
// The URL is also used as the injectScript cache token, so Tag Manager
// dedupes repeated firings of this tag on the same page instead of injecting
// the widget's script more than once.
injectScript(data.scriptUrl, gtmOnSuccess, gtmOnFailure, data.scriptUrl);


___WEB_PERMISSIONS___

[
  {
    "instance": {
      "key": {
        "publicId": "inject_script",
        "versionId": "1"
      },
      "param": [
        {
          "key": "urls",
          "value": {
            "type": 2,
            "listItem": [
              {
                "type": 1,
                "string": "https://cdn.jsdelivr.net/npm/@pulxon/widget@*/dist/pulxon.min.js"
              }
            ]
          }
        }
      ]
    },
    "clientAnnotations": {
      "isEditedByUser": true
    },
    "isRequired": true
  }
]


___TESTS___

scenarios:
- name: Injects the configured script URL and reports success to Tag Manager
  code: |-
    const mockUrl = 'https://cdn.jsdelivr.net/npm/@pulxon/widget@0.4.0/dist/pulxon.min.js';

    mock('injectScript', function(url, onSuccess) {
      assertThat(url).isEqualTo(mockUrl);
      onSuccess();
    });

    runCode({scriptUrl: mockUrl});

    assertApi('gtmOnSuccess').wasCalled();
- name: Reports failure to Tag Manager when the script fails to load
  code: |-
    const mockUrl = 'https://cdn.jsdelivr.net/npm/@pulxon/widget@0.4.0/dist/pulxon.min.js';

    mock('injectScript', function(url, onSuccess, onFailure) {
      onFailure();
    });

    runCode({scriptUrl: mockUrl});

    assertApi('gtmOnFailure').wasCalled();


___NOTES___

Created for the Pulxon widget's `integrations/tag-manager` package.

**This tag takes only a script URL, on purpose.** Google Tag Manager's
`injectScript` API creates a `<script>` element itself and gives this
sandbox no way to add attributes to it. The widget — see
`packages/widget/src/config/options.ts`, `parseDataAttributes`, and
`packages/widget/src/auto.ts` in the Pulxon widget repository — reads every
one of its options (`data-site-key`, `data-color`, `data-position`, and so
on) from `data-*` attributes on its own `<script>` tag, and from nothing
else today. That combination means this tag cannot set a site key, a color,
a position, or any other option: the widget boots with its built-in
defaults (bottom-right, medium, blue accent, branding on) whenever it is
installed through Tag Manager.

If your site needs those options, use the Pulxon WordPress plugin, Joomla
module or Drupal module (each adds the attributes itself, from a settings
screen) or one of the copy-paste snippets in `integrations/snippets/`, all
in the Pulxon widget repository. This Tag Manager path is for a site owner
who cannot touch their site's code at all and can accept the widget's
defaults.

The smallest fix on the widget's side — proposed, not built, and out of
scope for this template — would be for the widget's boot code to also read
its options from its own script URL's query string (`new
URL(document.currentScript.src).searchParams`), passed through the exact
same validators `parseDataAttributes` already uses for each option, as a
lower-priority source than `data-*` attributes. That would let a future
version of this template build a URL like
`.../pulxon.min.js?siteKey=pk_live_xxxx&color=%231f4bff` and have it work,
without changing anything about the WordPress, Joomla, Drupal or npm
integrations, which would keep using attributes exactly as they do today.
