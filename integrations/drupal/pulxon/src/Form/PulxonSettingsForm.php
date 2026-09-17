<?php

namespace Drupal\pulxon\Form;

use Drupal\Core\Form\ConfigFormBase;
use Drupal\Core\Form\FormStateInterface;

/**
 * Configure Pulxon widget settings.
 *
 * Reached only through the route in pulxon.routing.yml, which requires the
 * `administer site configuration` permission, so this class adds no
 * capability check of its own. The Form API's own CSRF token is added
 * automatically to every form `\Drupal\Core\Form\FormBuilder` builds
 * (including this one) unless a form explicitly opts out with
 * `$form['#token'] = FALSE`, which this form does not do, so no explicit
 * CSRF handling is added here either.
 *
 * This file has not been executed against a live Drupal installation: PHP
 * cannot run in the environment that produced it. Every call below was
 * checked against the documented Drupal 10/11 API only.
 */
class PulxonSettingsForm extends ConfigFormBase {

  /**
   * The values a select field is allowed to hold, spelled exactly as
   * `integrations/src/snippet.ts` and
   * `packages/widget/src/config/options.ts` expect them.
   */
  private const POSITIONS = [
    'top-left' => 'Top left',
    'top-center' => 'Top center',
    'top-right' => 'Top right',
    'center-left' => 'Center left',
    'center-right' => 'Center right',
    'bottom-left' => 'Bottom left',
    'bottom-center' => 'Bottom center',
    'bottom-right' => 'Bottom right',
  ];

  private const SIZES = [
    'small' => 'Small',
    'medium' => 'Medium',
    'large' => 'Large',
  ];

  private const ICONS = [
    'person' => 'Person',
    'eye' => 'Eye',
    'contrast' => 'Contrast',
  ];

  private const LANGUAGES = [
    '' => 'Match the page',
    'en' => 'English',
    'es' => 'Español',
  ];

  /**
   * {@inheritdoc}
   */
  public function getFormId() {
    return 'pulxon_settings_form';
  }

  /**
   * {@inheritdoc}
   */
  protected function getEditableConfigNames() {
    return ['pulxon.settings'];
  }

  /**
   * {@inheritdoc}
   */
  public function buildForm(array $form, FormStateInterface $form_state) {
    $config = $this->config('pulxon.settings');

    $form['site_key'] = [
      '#type' => 'textfield',
      '#title' => $this->t('Site key'),
      '#description' => $this->t("Your site's key, found on the site's page in the Pulxon dashboard. Leaving this empty is fine — the widget then uses only the options set here."),
      '#default_value' => $config->get('site_key') ?: '',
    ];

    $form['position'] = [
      '#type' => 'select',
      '#title' => $this->t('Launcher position'),
      '#description' => $this->t('Where the widget\'s launcher button appears on the page.'),
      '#options' => self::POSITIONS,
      '#default_value' => $config->get('position') ?: 'bottom-left',
    ];

    $form['size'] = [
      '#type' => 'select',
      '#title' => $this->t('Launcher size'),
      '#options' => self::SIZES,
      '#default_value' => $config->get('size') ?: 'medium',
    ];

    $form['icon'] = [
      '#type' => 'select',
      '#title' => $this->t('Launcher icon'),
      '#options' => self::ICONS,
      '#default_value' => $config->get('icon') ?: 'person',
    ];

    $form['color'] = [
      '#type' => 'color',
      '#title' => $this->t('Accent color'),
      '#default_value' => $config->get('color') ?: '#1f4bff',
    ];

    $form['lang'] = [
      '#type' => 'select',
      '#title' => $this->t('Language'),
      '#options' => self::LANGUAGES,
      '#default_value' => $config->get('lang') ?: '',
    ];

    $form['statement_url'] = [
      '#type' => 'url',
      '#title' => $this->t('Accessibility statement URL'),
      '#description' => $this->t('Optional link to your own accessibility statement page.'),
      '#default_value' => $config->get('statement_url') ?: '',
    ];

    $form['hide_on_mobile'] = [
      '#type' => 'checkbox',
      '#title' => $this->t('Hide the widget on mobile'),
      '#description' => $this->t('Do not show the widget to visitors on small screens.'),
      '#default_value' => (bool) $config->get('hide_on_mobile'),
    ];

    $form['branding'] = [
      '#type' => 'checkbox',
      '#title' => $this->t('Show the "powered by Pulxon" link'),
      '#description' => $this->t('Show a small "powered by Pulxon" link in the widget panel.'),
      '#default_value' => $config->get('branding') === NULL ? TRUE : (bool) $config->get('branding'),
    ];

    return parent::buildForm($form, $form_state);
  }

  /**
   * {@inheritdoc}
   *
   * Rejects a site key that does not match the exact shape `SITE_KEY` in
   * packages/widget/src/config/options.ts accepts, server-side — the HTML5 pattern attribute
   * client-side hint alone would not stop a request built by hand.
   */
  public function validateForm(array &$form, FormStateInterface $form_state) {
    parent::validateForm($form, $form_state);

    $site_key = trim((string) $form_state->getValue('site_key'));
    if ('' !== $site_key && !preg_match('/^pk_(?:live|test)_[A-Za-z0-9]{8,64}$/', $site_key)) {
      $form_state->setErrorByName('site_key', $this->t('This does not look like a Pulxon site key. Check the site\'s page in the Pulxon dashboard, or leave this empty.'));
    }
  }

  /**
   * {@inheritdoc}
   */
  public function submitForm(array &$form, FormStateInterface $form_state) {
    $this->config('pulxon.settings')
      ->set('site_key', trim((string) $form_state->getValue('site_key')))
      ->set('position', $form_state->getValue('position'))
      ->set('size', $form_state->getValue('size'))
      ->set('icon', $form_state->getValue('icon'))
      ->set('color', $form_state->getValue('color'))
      ->set('lang', $form_state->getValue('lang'))
      ->set('statement_url', $form_state->getValue('statement_url'))
      ->set('hide_on_mobile', (bool) $form_state->getValue('hide_on_mobile'))
      ->set('branding', (bool) $form_state->getValue('branding'))
      ->save();

    // hook_library_info_alter() (see pulxon.module) reads this config back
    // to build the library's data-* attributes, but Drupal caches library
    // discovery behind the `library_info` cache tag, and nothing else
    // invalidates it when this config changes. Without this call, the
    // front end keeps serving the library definition that was cached
    // before this save — on a fresh site, one with no data-* attributes at
    // all — until something unrelated happens to clear it.
    \Drupal::service('library.discovery')->clearCachedDefinitions();

    parent::submitForm($form, $form_state);
  }

}
