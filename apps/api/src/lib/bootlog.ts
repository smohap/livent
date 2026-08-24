import { appendFileSync } from 'node:fs';

/**
 * Passenger runs this app from outside the document root, so its stdout and
 * stderr are unreachable through the hosting API. When BOOT_STATUS_PATH points
 * at a readable location, startup progress is appended there instead.
 *
 * Diagnostic only. Never throws: a logging failure must not take down boot.
 */
const target = process.env.BOOT_STATUS_PATH;

export function boot(stage: string, detail?: unknown): void {
  const line = `${new Date().toISOString()} ${stage}${
    detail === undefined ? '' : ' :: ' + serialise(detail)
  }\n`;

  console.log('[boot]', line.trim());
  if (!target) return;

  try {
    appendFileSync(target, line, 'utf8');
  } catch {
    // Unwritable path is not worth failing over.
  }
}

function serialise(value: unknown): string {
  if (value instanceof Error) {
    return `${value.name}: ${value.message} | ${(value.stack ?? '').slice(0, 900)}`;
  }
  if (typeof value === 'string') return value.slice(0, 900);
  try {
    return JSON.stringify(value).slice(0, 900);
  } catch {
    return String(value).slice(0, 900);
  }
}
