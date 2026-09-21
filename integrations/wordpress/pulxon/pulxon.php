<?php
/**
 * Plugin Name: Pulxon Accessibility Widget
 * Description: Adds an on-page toolbar that lets a visitor adjust text size, color, spacing and other display preferences.
 * Version: 0.7.0
 * Requires at least: 6.3
 * Requires PHP: 7.4
 * Author: Pulxon
 * Author URI: https://pulxon.com/
 * License: GPLv2 or later
 * License URI: https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain: pulxon
 *
 * This file has not been executed against a live WordPress installation:
 * PHP cannot run in the environment that produced it. Every call below was
 * checked against the documented WordPress function signature only.
 *
 * The widget itself (the file at PULXON_WIDGET_FILE once built) is MIT
 * licensed; see LICENSE and THIRD_PARTY_NOTICES for the MIT notice this
 * GPLv2-or-later plugin ships alongside it.
 *
 * @package Pulxon
 */

defined( 'ABSPATH' ) || exit;

/** The plugin version, reused as the enqueued script's cache-busting version. */
define( 'PULXON_VERSION', '0.7.0' );

/** Path, relative to this file, to the widget script this plugin serves from the site itself. */
define( 'PULXON_WIDGET_FILE', 'assets/pulxon.min.js' );

/** The handle used both to enqueue the widget script and to identify it in the wp_script_attributes filter. */
define( 'PULXON_SCRIPT_HANDLE', 'pulxon-widget' );

if ( is_admin() ) {
	require_once __DIR__ . '/includes/settings.php';
}

/**
 * Enqueues the widget on the front end only. `wp_enqueue_scripts` itself
 * never fires in wp-admin, but `is_admin()` is kept as an explicit guard so
 * the intent survives a future change of hook.
 */
function pulxon_enqueue_widget() {
	if ( is_admin() ) {
		return;
	}

	wp_enqueue_script(
		PULXON_SCRIPT_HANDLE,
		plugins_url( PULXON_WIDGET_FILE, __FILE__ ),
		array(),
		PULXON_VERSION,
		array(
			'in_footer' => true,
			'strategy'  => 'defer',
		)
	);
}
add_action( 'wp_enqueue_scripts', 'pulxon_enqueue_widget' );

/**
 * Adds the saved options to the widget's own script tag as `data-*`
 * attributes, through the `wp_script_attributes` filter (WordPress 5.7+).
 * That filter hands over the tag's whole attribute array before it is
 * rendered to a string, keyed by attribute name, with the script's own id
 * (`"{$handle}-js"`) already in `$attributes['id']` — so this keys off the
 * id rather than splicing text into a pre-built `<script ...>` string.
 * `wp_script_attributes` fires once per script on the page (core's own and
 * every other plugin's), so every other handle's attributes must pass
 * through untouched.
 *
 * WordPress escapes every attribute value in this array when it renders the
 * tag (`wp_get_script_tag()`), but the values here are still passed through
 * `esc_attr()`/`esc_url()` on the way in, matching the same defense-in-depth
 * every other platform's package in this repository uses.
 *
 * @param array $attributes Key-value pairs representing `<script>` tag attributes.
 * @return array The attributes, with ours added only when this is our script.
 */
function pulxon_add_data_attributes( $attributes ) {
	if ( empty( $attributes['id'] ) || PULXON_SCRIPT_HANDLE . '-js' !== $attributes['id'] ) {
		return $attributes;
	}

	// Already validated against the widget's own SITE_KEY shape by the sanitize callback in
	// includes/settings.php at save time; esc_attr() here is still the same defense-in-depth
	// every other value in this array gets on the way out.
	$site_key = get_option( 'pulxon_site_key', '' );
	if ( $site_key ) {
		$attributes['data-site-key'] = esc_attr( $site_key );
	}

	$color = get_option( 'pulxon_color', '' );
	if ( $color ) {
		$attributes['data-color'] = esc_attr( $color );
	}

	$position = get_option( 'pulxon_position', '' );
	if ( $position ) {
		$attributes['data-position'] = esc_attr( $position );
	}

	$size = get_option( 'pulxon_size', '' );
	if ( $size ) {
		$attributes['data-size'] = esc_attr( $size );
	}

	$icon = get_option( 'pulxon_icon', '' );
	if ( $icon ) {
		$attributes['data-icon'] = esc_attr( $icon );
	}

	$lang = get_option( 'pulxon_lang', '' );
	if ( $lang ) {
		$attributes['data-lang'] = esc_attr( $lang );
	}

	// esc_url, not esc_attr: a URL saved by one administrator and rendered for
	// every visitor must have its scheme checked on the way out too, so a
	// javascript: value can never reach the attribute even if it were stored.
	$statement_url = get_option( 'pulxon_statement_url', '' );
	if ( $statement_url ) {
		$safe_url = esc_url( $statement_url, array( 'http', 'https' ) );
		if ( $safe_url ) {
			$attributes['data-statement-url'] = $safe_url;
		}
	}

	// The widget reads `data-hide-on-mobile` as the literal string "true" and
	// defaults to false, so only an explicit true needs the attribute.
	if ( get_option( 'pulxon_hide_on_mobile', false ) ) {
		$attributes['data-hide-on-mobile'] = 'true';
	}

	// The widget reads `data-branding` as anything but the string "false" and
	// defaults to true, so only an explicit false needs the attribute.
	if ( ! get_option( 'pulxon_branding', true ) ) {
		$attributes['data-branding'] = 'false';
	}

	return $attributes;
}
add_filter( 'wp_script_attributes', 'pulxon_add_data_attributes' );
