import type { SaveEditableDietInput } from '../../application/facade';
import { parseDietEntriesJson } from '../../domain/diet/diet';
import { DomainValidationError } from '../../domain/shared/errors';
import { readTextField } from './forms';

function optionalNumber(form: FormData, name: string): number | null {
  const value = readTextField(form, name, { optional: true, maxRawLength: 20 }).trim();
  if (!value) return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new DomainValidationError(name, 'El número no es válido.');
  return parsed;
}

/** Lee el formato común emitido por el editor manual y profesional. */
export function readEditableDietForm(form: FormData): SaveEditableDietInput {
  return {
    title: readTextField(form, 'title', { maxRawLength: 140 }),
    summary: readTextField(form, 'summary', { optional: true, maxRawLength: 900 }),
    goal: readTextField(form, 'goal', { maxRawLength: 16 }),
    preference: readTextField(form, 'preference', { maxRawLength: 24 }),
    entries: parseDietEntriesJson(readTextField(form, 'entries', { maxRawLength: 240_000 })),
    caloriesKcal: optionalNumber(form, 'caloriesKcal'),
    proteinG: optionalNumber(form, 'proteinG'),
    carbsG: optionalNumber(form, 'carbsG'),
    fatG: optionalNumber(form, 'fatG'),
  };
}
