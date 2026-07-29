/**
 * Resolves which preset a build renders under.
 *
 * Normally that is `theme.preset` from the payload. `DS_PRESET` overrides it for a
 * single build **without touching `client/site.config.ts`** — which is what the
 * stress script needs. Editing the payload to test it was the previous approach and
 * it left the repo on the wrong preset twice when a run was interrupted.
 *
 * The override is build-time only: `process.env` is not available to the browser,
 * and nothing here reaches the client bundle.
 */
import { PRESETS, type Preset } from '../config-schema';
import { siteConfig } from './site-config';

function readOverride(): Preset | undefined {
  const raw = typeof process !== 'undefined' ? process.env?.DS_PRESET : undefined;
  if (!raw) return undefined;

  if (!(PRESETS as readonly string[]).includes(raw)) {
    throw new Error(
      `DS_PRESET="${raw}" is not a known preset.\n` +
        `Expected one of: ${PRESETS.join(', ')}.`,
    );
  }
  return raw as Preset;
}

/** The preset this build renders under. */
export const activePreset: Preset = readOverride() ?? siteConfig.theme.preset;

/** True when the build is running under an override rather than the payload value. */
export const isPresetOverridden = activePreset !== siteConfig.theme.preset;
