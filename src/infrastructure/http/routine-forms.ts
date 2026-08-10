import type { SaveEditableRoutineInput } from '../../application/facade';
import { parseRoutineDaysJson } from '../../domain/routine/routine';
import { readNumberField, readTextField } from './forms';

/** Lee el editor común de rutina sin aceptar campos de identidad o autoría. */
export function readEditableRoutineForm(form: FormData): SaveEditableRoutineInput {
  return {
    title: readTextField(form, 'title', { maxRawLength: 120 }),
    summary: readTextField(form, 'summary', { optional: true, maxRawLength: 900 }),
    goal: readTextField(form, 'goal', { maxRawLength: 32 }),
    level: readTextField(form, 'level', { maxRawLength: 24 }),
    location: readTextField(form, 'location', { maxRawLength: 24 }),
    sessionDurationMinutes: readNumberField(form, 'sessionDurationMinutes'),
    availableEquipment: readTextField(form, 'availableEquipment', { optional: true, maxRawLength: 300 }),
    limitations: readTextField(form, 'limitations', { optional: true, maxRawLength: 500 }),
    days: parseRoutineDaysJson(readTextField(form, 'days', { maxRawLength: 240 * 1024 })),
  };
}
