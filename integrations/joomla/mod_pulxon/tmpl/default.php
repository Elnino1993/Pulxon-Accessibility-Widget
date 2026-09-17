<?php
/**
 * Pulxon module output layout.
 *
 * Prints exactly one <script> tag pointing at the widget file this module
 * ships in its own assets/ directory (added when the package is built), so
 * the site serves the widget from its own domain and makes no third-party
 * request. The saved parameters are carried as data-* attributes, spelled
 * exactly as `integrations/src/snippet.ts` and
 * `packages/widget/src/config/options.ts` (`parseDataAttributes`) define
 * them.
 *
 * Every value that reaches markup is escaped with
 * `htmlspecialchars(..., ENT_QUOTES, 'UTF-8')` on the way out. Most of these
 * values are already restricted to a closed list by the manifest's <field>
 * definitions, but a module's saved params live in `params.ini` and can be
 * edited directly, so the render-time escape is not optional.
 *
 * This file has not been executed against a live Joomla installation.
 *
 * @var string $position
 * @var string $size
 * @var string $icon
 * @var string $color
 * @var string $lang
 * @var string $statementUrl
 * @var bool   $hideOnMobile
 * @var bool   $branding
 */

defined('_JEXEC') or die;

use Joomla\CMS\Uri\Uri;

$src = Uri::root() . 'modules/mod_pulxon/assets/pulxon.min.js';
?>
<script src="<?php echo htmlspecialchars($src, ENT_QUOTES, 'UTF-8'); ?>"
<?php if ('' !== $color) : ?>
	data-color="<?php echo htmlspecialchars($color, ENT_QUOTES, 'UTF-8'); ?>"
<?php endif; ?>
<?php if ('' !== $position) : ?>
	data-position="<?php echo htmlspecialchars($position, ENT_QUOTES, 'UTF-8'); ?>"
<?php endif; ?>
<?php if ('' !== $size) : ?>
	data-size="<?php echo htmlspecialchars($size, ENT_QUOTES, 'UTF-8'); ?>"
<?php endif; ?>
<?php if ('' !== $icon) : ?>
	data-icon="<?php echo htmlspecialchars($icon, ENT_QUOTES, 'UTF-8'); ?>"
<?php endif; ?>
<?php if ('' !== $lang) : ?>
	data-lang="<?php echo htmlspecialchars($lang, ENT_QUOTES, 'UTF-8'); ?>"
<?php endif; ?>
<?php if ('' !== $statementUrl) : ?>
	data-statement-url="<?php echo htmlspecialchars($statementUrl, ENT_QUOTES, 'UTF-8'); ?>"
<?php endif; ?>
<?php if ($hideOnMobile) : ?>
	data-hide-on-mobile="true"
<?php endif; ?>
<?php if (!$branding) : ?>
	data-branding="false"
<?php endif; ?>
	defer></script>
