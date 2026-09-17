<?php
/**
 * Settings → Pulxon admin page.
 *
 * Registers every option through the Settings API with an explicit
 * allow-list sanitize callback, then renders the form with the Settings
 * API's own field callbacks, escaping every value again on the way out.
 * Options are attacker-controlled the moment a site has a second
 * administrator, so both the save-time sanitize and the render-time escape
 * are required — neither replaces the other.
 *
 * `settings_fields()` prints the settings-API nonce and the `options.php`
 * form target handles verifying it, so this file adds no CSRF handling of
 * its own beyond what the Settings API already provides.
 *
 * This file has not been executed against a live WordPress installation.
 *
 * @package Pulxon
 */

defined( 'ABSPATH' ) || exit;

define( 'PULXON_OPTION_GROUP', 'pulxon_options_group' );
define( 'PULXON_SETTINGS_SLUG', 'pulxon-settings' );
define( 'PULXON_SETTINGS_SECTION', 'pulxon_main_section' );

/**
 * The values a visitor-facing position select is allowed to hold. Spelled
 * exactly as `packages/widget/src/config/options.ts` (`POSITIONS`) and
 * `integrations/src/snippet.ts` expect them.
 *
 * @return string[]
 */
function pulxon_allowed_positions() {
	return array( 'top-left', 'top-center', 'top-right', 'center-left', 'center-right', 'bottom-left', 'bottom-center', 'bottom-right' );
}

/**
 * @return string[]
 */
function pulxon_allowed_sizes() {
	return array( 'small', 'medium', 'large' );
}

/**
 * @return string[]
 */
function pulxon_allowed_icons() {
	return array( 'person', 'eye', 'contrast' );
}

/**
 * The languages this widget ships a translation for, plus '' for "use the
 * page's own language". Matches `SUPPORTED_LANGUAGES` in
 * `packages/widget/src/i18n/index.ts`.
 *
 * @return string[]
 */
function pulxon_allowed_languages() {
	return array( '', 'en', 'es' );
}

add_action( 'admin_menu', 'pulxon_add_settings_page' );

function pulxon_add_settings_page() {
	add_options_page(
		__( 'Pulxon', 'pulxon' ),
		__( 'Pulxon', 'pulxon' ),
		'manage_options',
		PULXON_SETTINGS_SLUG,
		'pulxon_render_settings_page'
	);
}

add_action( 'admin_init', 'pulxon_register_settings' );

function pulxon_register_settings() {
	register_setting(
		PULXON_OPTION_GROUP,
		'pulxon_site_key',
		array(
			'type'              => 'string',
			'sanitize_callback' => function ( $value ) {
				// The exact shape `SITE_KEY` in `packages/widget/src/config/options.ts`
				// accepts, spelled the same way (not a looser rule), so a value this plugin
				// accepts is never one the widget itself would then silently ignore.
				$value = trim( (string) $value );
				return '' !== $value && preg_match( '/^pk_(?:live|test)_[A-Za-z0-9]{8,64}$/', $value ) ? $value : '';
			},
			'default'           => '',
		)
	);

	register_setting(
		PULXON_OPTION_GROUP,
		'pulxon_color',
		array(
			'type'              => 'string',
			'sanitize_callback' => 'sanitize_hex_color',
			'default'           => '#1f4bff',
		)
	);

	register_setting(
		PULXON_OPTION_GROUP,
		'pulxon_position',
		array(
			'type'              => 'string',
			'sanitize_callback' => function ( $value ) {
				return in_array( $value, pulxon_allowed_positions(), true ) ? $value : 'bottom-right';
			},
			'default'           => 'bottom-right',
		)
	);

	register_setting(
		PULXON_OPTION_GROUP,
		'pulxon_size',
		array(
			'type'              => 'string',
			'sanitize_callback' => function ( $value ) {
				return in_array( $value, pulxon_allowed_sizes(), true ) ? $value : 'medium';
			},
			'default'           => 'medium',
		)
	);

	register_setting(
		PULXON_OPTION_GROUP,
		'pulxon_icon',
		array(
			'type'              => 'string',
			'sanitize_callback' => function ( $value ) {
				return in_array( $value, pulxon_allowed_icons(), true ) ? $value : 'person';
			},
			'default'           => 'person',
		)
	);

	register_setting(
		PULXON_OPTION_GROUP,
		'pulxon_lang',
		array(
			'type'              => 'string',
			'sanitize_callback' => function ( $value ) {
				return in_array( $value, pulxon_allowed_languages(), true ) ? $value : '';
			},
			'default'           => '',
		)
	);

	register_setting(
		PULXON_OPTION_GROUP,
		'pulxon_statement_url',
		array(
			'type'              => 'string',
			'sanitize_callback' => 'esc_url_raw',
			'default'           => '',
		)
	);

	register_setting(
		PULXON_OPTION_GROUP,
		'pulxon_hide_on_mobile',
		array(
			'type'              => 'boolean',
			'sanitize_callback' => function ( $value ) {
				return (bool) $value;
			},
			'default'           => false,
		)
	);

	register_setting(
		PULXON_OPTION_GROUP,
		'pulxon_branding',
		array(
			'type'              => 'boolean',
			'sanitize_callback' => function ( $value ) {
				return (bool) $value;
			},
			'default'           => true,
		)
	);

	add_settings_section(
		PULXON_SETTINGS_SECTION,
		__( 'Widget appearance', 'pulxon' ),
		'__return_false',
		PULXON_SETTINGS_SLUG
	);

	add_settings_field( 'pulxon_site_key', __( 'Site key', 'pulxon' ), 'pulxon_render_site_key_field', PULXON_SETTINGS_SLUG, PULXON_SETTINGS_SECTION );
	add_settings_field( 'pulxon_color', __( 'Accent color', 'pulxon' ), 'pulxon_render_color_field', PULXON_SETTINGS_SLUG, PULXON_SETTINGS_SECTION );
	add_settings_field( 'pulxon_position', __( 'Launcher position', 'pulxon' ), 'pulxon_render_position_field', PULXON_SETTINGS_SLUG, PULXON_SETTINGS_SECTION );
	add_settings_field( 'pulxon_size', __( 'Launcher size', 'pulxon' ), 'pulxon_render_size_field', PULXON_SETTINGS_SLUG, PULXON_SETTINGS_SECTION );
	add_settings_field( 'pulxon_icon', __( 'Launcher icon', 'pulxon' ), 'pulxon_render_icon_field', PULXON_SETTINGS_SLUG, PULXON_SETTINGS_SECTION );
	add_settings_field( 'pulxon_lang', __( 'Language', 'pulxon' ), 'pulxon_render_lang_field', PULXON_SETTINGS_SLUG, PULXON_SETTINGS_SECTION );
	add_settings_field( 'pulxon_statement_url', __( 'Accessibility statement URL', 'pulxon' ), 'pulxon_render_statement_url_field', PULXON_SETTINGS_SLUG, PULXON_SETTINGS_SECTION );
	add_settings_field( 'pulxon_hide_on_mobile', __( 'Hide the widget on mobile', 'pulxon' ), 'pulxon_render_hide_on_mobile_field', PULXON_SETTINGS_SLUG, PULXON_SETTINGS_SECTION );
	add_settings_field( 'pulxon_branding', __( 'Show the "powered by Pulxon" link', 'pulxon' ), 'pulxon_render_branding_field', PULXON_SETTINGS_SLUG, PULXON_SETTINGS_SECTION );
}

function pulxon_render_site_key_field() {
	$value = get_option( 'pulxon_site_key', '' );
	printf(
		'<input type="text" name="pulxon_site_key" value="%s" class="regular-text" placeholder="pk_live_..." />',
		esc_attr( $value )
	);
	printf(
		'<p class="description">%s</p>',
		esc_html__( "Your site's key, found on the site's page in the Pulxon dashboard. Leaving this empty is fine — the widget then uses only the options set here.", 'pulxon' )
	);
}

function pulxon_render_color_field() {
	$value = get_option( 'pulxon_color', '#1f4bff' );
	printf(
		'<input type="text" name="pulxon_color" value="%s" class="regular-text" placeholder="#1f4bff" />',
		esc_attr( $value )
	);
}

function pulxon_render_position_field() {
	$value = get_option( 'pulxon_position', 'bottom-right' );
	print '<select name="pulxon_position">';
	foreach ( pulxon_allowed_positions() as $position ) {
		printf(
			'<option value="%1$s"%2$s>%1$s</option>',
			esc_attr( $position ),
			selected( $value, $position, false )
		);
	}
	print '</select>';
}

function pulxon_render_size_field() {
	$value = get_option( 'pulxon_size', 'medium' );
	print '<select name="pulxon_size">';
	foreach ( pulxon_allowed_sizes() as $size ) {
		printf(
			'<option value="%1$s"%2$s>%1$s</option>',
			esc_attr( $size ),
			selected( $value, $size, false )
		);
	}
	print '</select>';
}

function pulxon_render_icon_field() {
	$value = get_option( 'pulxon_icon', 'person' );
	print '<select name="pulxon_icon">';
	foreach ( pulxon_allowed_icons() as $icon ) {
		printf(
			'<option value="%1$s"%2$s>%1$s</option>',
			esc_attr( $icon ),
			selected( $value, $icon, false )
		);
	}
	print '</select>';
}

function pulxon_render_lang_field() {
	$value = get_option( 'pulxon_lang', '' );
	print '<select name="pulxon_lang">';
	foreach ( pulxon_allowed_languages() as $lang ) {
		$label = '' === $lang ? __( 'Match the page', 'pulxon' ) : $lang;
		printf(
			'<option value="%1$s"%2$s>%3$s</option>',
			esc_attr( $lang ),
			selected( $value, $lang, false ),
			esc_html( $label )
		);
	}
	print '</select>';
}

function pulxon_render_statement_url_field() {
	$value = get_option( 'pulxon_statement_url', '' );
	printf(
		'<input type="url" name="pulxon_statement_url" value="%s" class="regular-text" placeholder="https://example.com/accessibility" />',
		esc_attr( $value )
	);
}

function pulxon_render_hide_on_mobile_field() {
	$value = get_option( 'pulxon_hide_on_mobile', false );
	printf(
		'<label><input type="checkbox" name="pulxon_hide_on_mobile" value="1"%s /> %s</label>',
		checked( true, (bool) $value, false ),
		esc_html__( 'Do not show the widget to visitors on small screens.', 'pulxon' )
	);
}

function pulxon_render_branding_field() {
	$value = get_option( 'pulxon_branding', true );
	printf(
		'<label><input type="checkbox" name="pulxon_branding" value="1"%s /> %s</label>',
		checked( true, (bool) $value, false ),
		esc_html__( 'Show a small "powered by Pulxon" link in the widget panel.', 'pulxon' )
	);
}

/**
 * Renders the Settings → Pulxon page. `settings_fields()` prints the
 * settings-API nonce and group name; `options.php` (the form's action)
 * verifies both before anything is saved.
 */
function pulxon_render_settings_page() {
	if ( ! current_user_can( 'manage_options' ) ) {
		return;
	}
	?>
	<div class="wrap">
		<h1><?php esc_html_e( 'Pulxon', 'pulxon' ); ?></h1>
		<form action="options.php" method="post">
			<?php
			settings_fields( PULXON_OPTION_GROUP );
			do_settings_sections( PULXON_SETTINGS_SLUG );
			submit_button();
			?>
		</form>
	</div>
	<?php
}
