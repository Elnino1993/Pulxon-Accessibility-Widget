/**
 * The legal banner at the very top of every built file. MIT's one condition is that the copyright
 * and permission notice travel with every copy; the full text is too long for a script header, so
 * the banner names the authors and points at the notices file, which ships next to the bundle.
 *
 * `/*!` marks it as a legal comment any later minifier keeps. It is added through Rolldown's
 * `postBanner`, after minification, so it is always the first thing in the file.
 */
export const LEGAL_BANNER = `/*!
 * Pulxon Accessibility Widget | (c) 2026 Pulxon | https://www.pulxon.com/
 * Portions based on Sienna Accessibility Widget, (c) 2025 Benny Luk, MIT License
 * https://github.com/bennyluk/Sienna-Accessibility-Widget
 * Full notices: https://www.pulxon.com/widget/THIRD_PARTY_NOTICES.txt
 */`;
