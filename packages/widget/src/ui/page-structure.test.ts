import { afterEach, describe, expect, it, vi } from 'vitest';
import { collectHeadings, collectLandmarks, collectLinks, focusElement } from './page-structure';

afterEach(() => {
  document.body.innerHTML = '';
});

describe('collectHeadings', () => {
  it('returns visible headings with levels and skips hidden, ignored or empty ones', () => {
    document.body.innerHTML =
      '<h1>Title</h1>' +
      '<div role="heading" aria-level="3">  Custom\n heading </div>' +
      '<h2 hidden>Hidden</h2>' +
      '<div aria-hidden="true"><h2>Aria hidden</h2></div>' +
      '<div data-pulxon-ignore><h2>Widget</h2></div>' +
      '<h4></h4>';
    expect(collectHeadings(document).map((item) => [item.label, item.detail, item.level])).toEqual([
      ['Title', 'H1', 1],
      ['Custom heading', 'H3', 3],
    ]);
  });

  it('skips inert subtrees and headings whose role is presentation or none', () => {
    document.body.innerHTML =
      '<div inert><h2>Inert</h2></div>' +
      '<h2 role="presentation">Presentational</h2>' +
      '<h2 role="none">NoneRole</h2>' +
      '<h2>Kept</h2>';
    expect(collectHeadings(document).map((item) => item.label)).toEqual(['Kept']);
  });
});

describe('collectLandmarks', () => {
  it('maps elements and roles to landmarks', () => {
    document.body.innerHTML =
      '<header>Top</header>' +
      '<nav aria-label="Primary"></nav>' +
      '<main></main>' +
      '<article><header>Article header</header></article>' +
      '<aside></aside>' +
      '<section>Unnamed</section>' +
      '<section aria-labelledby="t"><h2 id="t">Pricing</h2></section>' +
      '<form aria-label="Signup"></form>' +
      '<div role="search"></div>' +
      '<footer></footer>';
    expect(collectLandmarks(document).map((item) => [item.detailKey, item.label])).toEqual([
      ['landmark.banner', ''],
      ['landmark.navigation', 'Primary'],
      ['landmark.main', ''],
      ['landmark.complementary', ''],
      ['landmark.region', 'Pricing'],
      ['landmark.form', 'Signup'],
      ['landmark.search', ''],
      ['landmark.contentinfo', ''],
    ]);
  });

  it('only counts explicit region and form roles when they have an accessible name', () => {
    document.body.innerHTML =
      '<div role="region">Unnamed region</div>' +
      '<div role="region" aria-label="Named region">Named</div>' +
      '<div role="form">Unnamed form</div>' +
      '<div role="form" aria-label="Named form">Named</div>';
    expect(collectLandmarks(document).map((item) => [item.detailKey, item.label])).toEqual([
      ['landmark.region', 'Named region'],
      ['landmark.form', 'Named form'],
    ]);
  });
});

describe('item kinds', () => {
  it('marks each collected item with its kind', () => {
    document.body.innerHTML = '<main><h1>Title</h1><a href="/a">Home</a></main>';
    expect(collectHeadings(document).map((item) => item.kind)).toEqual(['heading']);
    expect(collectLandmarks(document).map((item) => item.kind)).toEqual(['landmark']);
    expect(collectLinks(document).map((item) => item.kind)).toEqual(['link']);
  });
});

describe('collectLinks', () => {
  it('uses the accessible name and falls back to the href', () => {
    document.body.innerHTML =
      '<a href="/a">Home</a><a href="/b" aria-label="Cart"><svg></svg></a><a href="/c"></a><a>No href</a>';
    expect(collectLinks(document).map((item) => item.label)).toEqual(['Home', 'Cart', '/c']);
  });
});

describe('focusElement', () => {
  it('makes non-focusable targets focusable and focuses them', () => {
    document.body.innerHTML = '<h2 id="h">Section</h2><button id="b" type="button">Go</button><div id="d" tabindex="0">D</div>';
    const heading = document.getElementById('h') as HTMLElement;
    focusElement(heading);
    expect(heading.getAttribute('tabindex')).toBe('-1');
    expect(document.activeElement).toBe(heading);

    const button = document.getElementById('b') as HTMLElement;
    focusElement(button);
    expect(button.hasAttribute('tabindex')).toBe(false);
    expect(document.activeElement).toBe(button);

    const div = document.getElementById('d') as HTMLElement;
    focusElement(div);
    expect(div.getAttribute('tabindex')).toBe('0');
  });

  it('returns whether focus actually landed on the element', () => {
    document.body.innerHTML = '<h2 id="h">Section</h2>';
    const heading = document.getElementById('h') as HTMLElement;
    expect(focusElement(heading)).toBe(true);

    const detached = document.createElement('div');
    expect(focusElement(detached)).toBe(false);
  });

  it('removes the tabindex it added when focus does not land', () => {
    document.body.innerHTML = '<h2 id="h">Section</h2>';
    const heading = document.getElementById('h') as HTMLElement;
    vi.spyOn(heading, 'focus').mockImplementation(() => undefined);
    expect(focusElement(heading)).toBe(false);
    expect(heading.hasAttribute('tabindex')).toBe(false);
  });

  it('removes the tabindex it added once the element loses focus', () => {
    document.body.innerHTML = '<h2 id="h">Section</h2><button id="b" type="button">Go</button>';
    const heading = document.getElementById('h') as HTMLElement;
    const button = document.getElementById('b') as HTMLElement;
    focusElement(heading);
    expect(heading.getAttribute('tabindex')).toBe('-1');
    button.focus();
    expect(heading.hasAttribute('tabindex')).toBe(false);
  });
});
