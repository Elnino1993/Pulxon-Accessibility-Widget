<?php
/**
 * Pulxon accessibility widget — Joomla site module entry point.
 *
 * This follows the module dispatch pattern that has been stable since
 * Joomla 1.5 and is still how Joomla 4 and 5 render a simple site module
 * (`Joomla\CMS\Helper\ModuleHelper::renderModule()` includes this file with
 * `$module` and `$params` already in scope, then this file hands off to the
 * layout). No namespaced module-dispatcher class is needed for a module
 * this small, and the plain dispatch file avoids depending on class
 * autoloading conventions that vary by extension type.
 *
 * This file has not been executed against a live Joomla installation: PHP
 * cannot run in the environment that produced it. Every call below was
 * checked against the documented Joomla 4/5 API only.
 *
 * The module itself needs no capability check: Joomla only reaches this
 * file through the module manager and the site's module rendering, both of
 * which are already gated by Joomla's own ACL before this file is ever
 * included, the same way core modules ship without an internal permission
 * check.
 *
 * @package Pulxon
 */

defined('_JEXEC') or die;

use Joomla\CMS\Helper\ModuleHelper;

/** @var \Joomla\Registry\Registry $params */
$position     = (string) $params->get('position', 'bottom-right');
$size         = (string) $params->get('size', 'medium');
$icon         = (string) $params->get('icon', 'person');
$color        = (string) $params->get('color', '#1f4bff');
$lang         = (string) $params->get('lang', '');
$statementUrl = (string) $params->get('statement_url', '');
$hideOnMobile = (bool) $params->get('hide_on_mobile', 0);
$branding     = (bool) $params->get('branding', 1);

require ModuleHelper::getLayoutPath('mod_pulxon', $params->get('layout', 'default'));
