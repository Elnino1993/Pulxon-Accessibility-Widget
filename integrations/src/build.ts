/**
 * Builds the three installable packages (WordPress, Joomla, Drupal) into
 * `integrations/dist/`: one zip each, carrying the platform's own files
 * plus the widget's own built script, fonts and licence.
 *
 * The one failure this script refuses to produce quietly is a package with
 * no widget inside it — see `assertWidgetBuilt` below. `pnpm --filter
 * @pulxon/widget build` must have run first; this script does not build the
 * widget itself.
 */
import { ZipArchive } from 'archiver';
import { copyFileSync, createWriteStream, cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const integrationsRoot = join(here, '..');
const repoRoot = join(integrationsRoot, '..');
const widgetPackageDir = join(repoRoot, 'packages', 'widget');

export interface PackageSpec {
  /** Short id used to select one package with `buildPackages({ only: [...] })`. */
  id: string;
  /** Where this package's own source files live. */
  sourceDir: string;
  /** The folder name the package's own files are wrapped in inside the zip — matches each platform's own expected extraction layout. */
  zipFolderName: string;
  /** The zip file is named `${zipBaseName}-${version}.zip`. */
  zipBaseName: string;
  /** A representative sample of this package's own files, relative to `sourceDir` — used by `build.test.ts` to confirm they made it into the zip. */
  ownFiles: string[];
}

export const PACKAGES: PackageSpec[] = [
  {
    id: 'wordpress',
    sourceDir: join(integrationsRoot, 'wordpress', 'pulxon'),
    zipFolderName: 'pulxon',
    zipBaseName: 'pulxon-wordpress',
    ownFiles: ['pulxon.php', 'includes/settings.php', 'readme.txt'],
  },
  {
    id: 'joomla',
    sourceDir: join(integrationsRoot, 'joomla', 'mod_pulxon'),
    zipFolderName: 'mod_pulxon',
    zipBaseName: 'mod_pulxon',
    ownFiles: ['mod_pulxon.php', 'mod_pulxon.xml', 'tmpl/default.php'],
  },
  {
    id: 'drupal',
    sourceDir: join(integrationsRoot, 'drupal', 'pulxon'),
    zipFolderName: 'pulxon',
    zipBaseName: 'pulxon-drupal',
    ownFiles: ['pulxon.info.yml', 'pulxon.module', 'src/Form/PulxonSettingsForm.php'],
  },
];

export interface BuildResult {
  name: string;
  path: string;
  bytes: number;
}

export interface BuildOptions {
  /** Defaults to `packages/widget/dist`. Overridable so tests can point at a fixture without a built widget. */
  widgetDistDir?: string;
  /** Defaults to `packages/widget/package.json`'s own `version`. */
  version?: string;
  /** Defaults to `integrations/dist`. */
  outDir?: string;
  /** Widget's own MIT licence text, defaults to the repo's top-level `LICENSE`. */
  widgetLicensePath?: string;
  /** Build only these package ids (by `PackageSpec.id`) — mainly for focused tests. Defaults to all of `PACKAGES`. */
  only?: string[];
}

/**
 * Throws, rather than letting the build continue, when the widget has not
 * been built. Without this check, a missing `pulxon.min.js` would silently
 * produce a package whose script tag points at a file that isn't in the
 * zip — the one failure that must never reach a customer.
 */
export function assertWidgetBuilt(widgetDistDir: string): void {
  const widgetFile = join(widgetDistDir, 'pulxon.min.js');
  if (!existsSync(widgetFile)) {
    throw new Error(
      `The widget has not been built: "${widgetFile}" does not exist. Run "pnpm --filter @pulxon/widget build" first — packaging now would ship a zip with no widget inside it.`,
    );
  }
  const fontsDir = join(widgetDistDir, 'fonts');
  if (!existsSync(fontsDir)) {
    throw new Error(`The widget has not been built: "${fontsDir}" does not exist. Run "pnpm --filter @pulxon/widget build" first.`);
  }
}

export function readWidgetVersion(widgetPackageJsonPath: string = join(widgetPackageDir, 'package.json')): string {
  const pkg = JSON.parse(readFileSync(widgetPackageJsonPath, 'utf8')) as { version?: string };
  if (!pkg.version) {
    throw new Error(`"${widgetPackageJsonPath}" has no "version" field.`);
  }
  return pkg.version;
}

function zipDirectory(sourceDir: string, folderNameInZip: string, outPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const output = createWriteStream(outPath);
    // archiver@8 dropped the classic `archiver('zip', opts)` factory in favour of a class
    // per format; `ZipArchive` is still the same `Archiver` (a Transform stream) underneath,
    // so `.pipe()`, `.directory()` and `.finalize()` behave exactly as before.
    const archive = new ZipArchive({ zlib: { level: 9 } });

    output.on('error', reject);
    archive.on('error', reject);
    archive.on('warning', (err: NodeJS.ErrnoException) => {
      if (err.code !== 'ENOENT') reject(err);
    });
    // `finalize()` resolves once archiver has finished writing, but that can race the
    // destination file stream's own flush to disk; wait for the write stream's `close`
    // too, since callers immediately `statSync` the file afterward.
    output.on('close', () => resolve());

    archive.pipe(output);
    archive.directory(sourceDir, folderNameInZip);
    archive.finalize().catch(reject);
  });
}

/**
 * Stages one package's files (its own source directory plus the widget's
 * built assets and licence) into a fresh temp directory, then zips that
 * staging directory into `outDir`.
 */
async function buildOnePackage(pkg: PackageSpec, widgetDistDir: string, widgetLicensePath: string, version: string, outDir: string): Promise<BuildResult> {
  const stagingRoot = mkdtempSync(join(tmpdir(), `pulxon-package-${pkg.id}-`));
  try {
    const pkgStagingDir = join(stagingRoot, pkg.zipFolderName);

    // The platform's own files first (manifest/module code, settings screen, readme, and
    // its own GPL licence) — everything this package needs that isn't produced by a build.
    cpSync(pkg.sourceDir, pkgStagingDir, { recursive: true });

    // Then the widget's own built output, which is never committed inside a platform's
    // source directory (it's a build artifact) — added here so the zip is self-contained
    // and the site never depends on a CDN we have not built.
    const assetsDir = join(pkgStagingDir, 'assets');
    mkdirSync(assetsDir, { recursive: true });
    copyFileSync(join(widgetDistDir, 'pulxon.min.js'), join(assetsDir, 'pulxon.min.js'));
    cpSync(join(widgetDistDir, 'fonts'), join(assetsDir, 'fonts'), { recursive: true });

    // The widget's own MIT notice, copied from the repo's single canonical copy so it can
    // never drift from what LICENSE actually says, even if a platform directory's own copy
    // goes stale.
    copyFileSync(widgetLicensePath, join(pkgStagingDir, 'LICENSE-widget-MIT.txt'));

    const zipName = `${pkg.zipBaseName}-${version}.zip`;
    const zipPath = join(outDir, zipName);
    await zipDirectory(pkgStagingDir, pkg.zipFolderName, zipPath);

    return { name: zipName, path: zipPath, bytes: statSync(zipPath).size };
  } finally {
    rmSync(stagingRoot, { recursive: true, force: true });
  }
}

export async function buildPackages(options: BuildOptions = {}): Promise<BuildResult[]> {
  const widgetDistDir = options.widgetDistDir ?? join(widgetPackageDir, 'dist');
  assertWidgetBuilt(widgetDistDir);

  const version = options.version ?? readWidgetVersion();
  const outDir = options.outDir ?? join(integrationsRoot, 'dist');
  const widgetLicensePath = options.widgetLicensePath ?? join(repoRoot, 'LICENSE');
  mkdirSync(outDir, { recursive: true });

  const packages = options.only ? PACKAGES.filter((pkg) => options.only!.includes(pkg.id)) : PACKAGES;

  const results: BuildResult[] = [];
  for (const pkg of packages) {
    results.push(await buildOnePackage(pkg, widgetDistDir, widgetLicensePath, version, outDir));
  }
  return results;
}

// `process.argv[1]` is whatever was typed on the command line (often relative, e.g.
// `src/build.ts`), so it has to be resolved before comparing it to the absolute,
// OS-native path `fileURLToPath` returns — a plain string/URL comparison silently
// never matches on Windows and this script would then do nothing when run directly.
const isMain = Boolean(process.argv[1]) && fileURLToPath(import.meta.url) === resolve(process.argv[1] as string);
if (isMain) {
  buildPackages()
    .then((results) => {
      for (const result of results) {
        console.log(`${result.name}  (${(result.bytes / 1024).toFixed(1)} KB)  ${result.path}`);
      }
    })
    .catch((err: unknown) => {
      console.error(err instanceof Error ? err.message : err);
      process.exitCode = 1;
    });
}
