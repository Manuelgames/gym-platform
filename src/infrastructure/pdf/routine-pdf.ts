import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage, type RGB } from 'pdf-lib';
import { formatRoutineDuration, type RoutinePlan } from '../../domain/routine/routine';
import { drawBrandWatermark, embedBrandWatermark } from './pdf-branding';

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN = 38;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const BOTTOM = 55;
const colors = {
  navy: rgb(0.05, 0.22, 0.38), blue: rgb(0.12, 0.38, 0.62), red: rgb(0.62, 0.16, 0.17),
  paleBlue: rgb(0.94, 0.97, 0.99), paleGreen: rgb(0.94, 0.97, 0.92), green: rgb(0.25, 0.47, 0.22),
  line: rgb(0.77, 0.83, 0.87), ink: rgb(0.09, 0.14, 0.18), muted: rgb(0.34, 0.4, 0.44), white: rgb(1, 1, 1),
};

function safeText(value: string): string {
  return value.replace(/[•·]/g, '-').replace(/[“”]/g, '"').replace(/[‘’]/g, "'").replace(/[–—]/g, '-').replace(/…/g, '...').replace(/\u00A0/g, ' ').replace(/[^\u0009\u000A\u000D\u0020-\u007E\u00A0-\u00FF]/g, '');
}

function wrap(text: string, font: PDFFont, size: number, width: number): string[] {
  const lines: string[] = [];
  for (const paragraph of safeText(text).split(/\r?\n/)) {
    const words = paragraph.trim().split(/\s+/).filter(Boolean);
    if (!words.length) { lines.push(''); continue; }
    let line = '';
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (!line || font.widthOfTextAtSize(candidate, size) <= width) line = candidate;
      else { lines.push(line); line = word; }
    }
    if (line) lines.push(line);
  }
  return lines;
}

function fitted(text: string, font: PDFFont, size: number, width: number): string {
  const safe = safeText(text);
  if (font.widthOfTextAtSize(safe, size) <= width) return safe;
  let value = safe;
  while (value.length > 1 && font.widthOfTextAtSize(`${value}...`, size) > width) value = value.slice(0, -1);
  return `${value.trim()}...`;
}

const goalLabels = {
  fuerza: 'Ganar fuerza', hipertrofia: 'Hipertrofia', perdida_grasa: 'Pérdida de grasa',
  resistencia: 'Resistencia', movilidad: 'Movilidad', general: 'Condición general',
} as const;
const dayLabels = { lunes: 'Lunes', martes: 'Martes', miercoles: 'Miércoles', jueves: 'Jueves', viernes: 'Viernes', sabado: 'Sábado', domingo: 'Domingo' } as const;

/** Genera un PDF A4 multipágina con la misma semana visible en la aplicación. */
export async function createRoutinePdf(plan: RoutinePlan, options: { clientName: string }): Promise<Uint8Array> {
  const document = await PDFDocument.create();
  const regular = await document.embedFont(StandardFonts.Helvetica);
  const bold = await document.embedFont(StandardFonts.HelveticaBold);
  const brandWatermark = await embedBrandWatermark(document);
  let page: PDFPage = document.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  drawBrandWatermark(page, brandWatermark);
  let y = PAGE_HEIGHT - MARGIN;

  const continuationHeader = () => {
    page.drawText('ROMAN COLOSSEUM  /  RUTINA SEMANAL', { x: MARGIN, y: PAGE_HEIGHT - 31, size: 8, font: bold, color: colors.navy });
    page.drawText(fitted(plan.title, regular, 8, 250), { x: PAGE_WIDTH - MARGIN - 250, y: PAGE_HEIGHT - 31, size: 8, font: regular, color: colors.muted });
    page.drawLine({ start: { x: MARGIN, y: PAGE_HEIGHT - 41 }, end: { x: PAGE_WIDTH - MARGIN, y: PAGE_HEIGHT - 41 }, thickness: .7, color: colors.line });
    y = PAGE_HEIGHT - 60;
  };
  const addPage = () => {
    page = document.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    drawBrandWatermark(page, brandWatermark);
    continuationHeader();
  };
  const ensure = (height: number) => { if (y - height < BOTTOM) addPage(); };
  const textLines = (text: string, x: number, width: number, size = 9, font = regular, color: RGB = colors.ink, lineHeight = size * 1.25) => {
    const lines = wrap(text, font, size, width);
    ensure(lines.length * lineHeight + 2);
    lines.forEach((line) => { page.drawText(line, { x, y, size, font, color }); y -= lineHeight; });
  };

  page.drawText('PROGRAMA SEMANAL DE ENTRENAMIENTO', { x: MARGIN, y, size: 20, font: bold, color: colors.navy });
  page.drawRectangle({ x: PAGE_WIDTH - MARGIN - 48, y: y - 4, width: 48, height: 14, color: colors.red });
  y -= 23;
  page.drawText('Formato personalizado de lunes a domingo', { x: MARGIN, y, size: 9.5, font: regular, color: colors.muted });
  y -= 24;

  const profileItems = [
    ['ATLETA', options.clientName], ['OBJETIVO', goalLabels[plan.goal]], ['NIVEL', plan.level],
    ['LUGAR', plan.location], ['SESIÓN', formatRoutineDuration(plan.sessionDurationMinutes)],
  ];
  const profileHeight = 55;
  const profileWidth = CONTENT_WIDTH / profileItems.length;
  profileItems.forEach(([label, value], index) => {
    const left = MARGIN + index * profileWidth;
    page.drawRectangle({ x: left, y: y - profileHeight, width: profileWidth, height: profileHeight, color: index % 2 ? colors.white : colors.paleBlue, borderColor: colors.line, borderWidth: .5 });
    page.drawText(label!, { x: left + 7, y: y - 16, size: 6.8, font: bold, color: colors.blue });
    wrap(value!, bold, 8.5, profileWidth - 14).slice(0, 2).forEach((line, lineIndex) => page.drawText(line, { x: left + 7, y: y - 33 - lineIndex * 10, size: 8.5, font: bold, color: colors.navy }));
  });
  y -= profileHeight + 10;

  textLines(plan.title, MARGIN, CONTENT_WIDTH, 15, bold, colors.navy, 18);
  if (plan.summary) { y -= 2; textLines(plan.summary, MARGIN, CONTENT_WIDTH, 8.7, regular, colors.muted, 11); }
  y -= 9;

  const restCount = plan.days.filter((day) => day.isRestDay).length;
  const metrics = [
    ['DÍAS ACTIVOS', String(plan.days.length - restCount)], ['DESCANSOS', String(restCount)],
    ['EJERCICIOS', String(plan.days.reduce((total, day) => total + day.exercises.length, 0))],
  ];
  const metricHeight = 36;
  const metricWidth = CONTENT_WIDTH / metrics.length;
  metrics.forEach(([label, value], index) => {
    const left = MARGIN + index * metricWidth;
    page.drawRectangle({ x: left, y: y - metricHeight, width: metricWidth, height: metricHeight, color: colors.paleBlue, borderColor: colors.line, borderWidth: .4 });
    page.drawText(label!, { x: left + 7, y: y - 13, size: 6.4, font: bold, color: colors.muted });
    page.drawText(fitted(value!, bold, 9, metricWidth - 14), { x: left + 7, y: y - 27, size: 9, font: bold, color: colors.navy });
  });
  y -= metricHeight + 17;

  plan.days.forEach((day, dayIndex) => {
    ensure(day.isRestDay ? 86 : 120);
    const headerTop = y;
    page.drawRectangle({ x: MARGIN, y: headerTop - 48, width: CONTENT_WIDTH, height: 48, color: day.isRestDay ? colors.paleGreen : colors.paleBlue, borderColor: day.isRestDay ? colors.green : colors.blue, borderWidth: .6 });
    page.drawCircle({ x: MARGIN + 20, y: headerTop - 24, size: 12, color: day.isRestDay ? colors.green : colors.navy });
    const number = String(dayIndex + 1);
    page.drawText(number, { x: MARGIN + 20 - bold.widthOfTextAtSize(number, 9) / 2, y: headerTop - 27, size: 9, font: bold, color: colors.white });
    page.drawText(dayLabels[day.day].toUpperCase(), { x: MARGIN + 42, y: headerTop - 15, size: 7, font: bold, color: day.isRestDay ? colors.green : colors.blue });
    page.drawText(fitted(day.title, bold, 12, CONTENT_WIDTH - 175), { x: MARGIN + 42, y: headerTop - 31, size: 12, font: bold, color: colors.navy });
    const status = day.isRestDay ? 'RECUPERACIÓN' : `${day.exercises.length} EJERCICIOS`;
    page.drawText(status, { x: PAGE_WIDTH - MARGIN - bold.widthOfTextAtSize(status, 7.5) - 10, y: headerTop - 27, size: 7.5, font: bold, color: day.isRestDay ? colors.green : colors.red });
    y -= 56;
    if (day.isRestDay) {
      textLines(day.focus || 'Descanso planificado, hidratación y movilidad suave según tolerancia.', MARGIN + 12, CONTENT_WIDTH - 24, 8.5, regular, colors.muted, 11);
      y -= 10;
      return;
    }
    if (day.focus) { textLines(day.focus, MARGIN + 8, CONTENT_WIDTH - 16, 8.2, regular, colors.muted, 10.5); y -= 4; }
    day.exercises.forEach((exercise, exerciseIndex) => {
      const nameLines = wrap(`${exerciseIndex + 1}. ${exercise.name}`, bold, 9.3, 225);
      const noteLines = exercise.notes ? wrap(exercise.notes, regular, 7.5, 225) : [];
      const rowHeight = Math.max(37, 12 + nameLines.length * 11 + noteLines.length * 9);
      ensure(rowHeight + 4);
      const rowTop = y;
      page.drawRectangle({ x: MARGIN, y: rowTop - rowHeight, width: CONTENT_WIDTH, height: rowHeight, color: exerciseIndex % 2 ? colors.paleBlue : colors.white, borderColor: colors.line, borderWidth: .35 });
      let nameY = rowTop - 14;
      nameLines.forEach((line) => { page.drawText(line, { x: MARGIN + 9, y: nameY, size: 9.3, font: bold, color: colors.ink }); nameY -= 11; });
      noteLines.forEach((line) => { page.drawText(line, { x: MARGIN + 9, y: nameY, size: 7.5, font: regular, color: colors.muted }); nameY -= 9; });
      const columns = [
        [exercise.muscle, 270], [exercise.prescriptionType === 'duration' ? formatRoutineDuration(exercise.durationMinutes ?? 0) : `${exercise.sets} x ${exercise.reps}`, 350],
        [exercise.prescriptionType === 'duration' && !exercise.restSeconds ? 'No aplica' : exercise.restSeconds ? `${exercise.restSeconds} s` : 'Sin pausa', 435],
        [exercise.tempo || (exercise.prescriptionType === 'duration' ? 'Ritmo sostenible' : 'Controlado'), 495],
      ] as const;
      columns.forEach(([value, x]) => page.drawText(fitted(value, regular, 8.2, x === 495 ? 57 : 72), { x, y: rowTop - 22, size: 8.2, font: x === 350 ? bold : regular, color: colors.ink }));
      y -= rowHeight;
    });
    y -= 12;
  });

  ensure(90);
  page.drawRectangle({ x: MARGIN, y: y - 76, width: CONTENT_WIDTH, height: 76, color: colors.paleGreen, borderColor: colors.green, borderWidth: .6 });
  page.drawText('CONSIDERACIONES Y SEGURIDAD', { x: MARGIN + 12, y: y - 18, size: 9, font: bold, color: colors.green });
  let noteY = y - 34;
  wrap(plan.limitations || 'No se registraron limitaciones específicas para este plan.', regular, 8, CONTENT_WIDTH - 24).slice(0, 3).forEach((line) => { page.drawText(line, { x: MARGIN + 12, y: noteY, size: 8, font: regular, color: colors.ink }); noteY -= 10; });

  const pages = document.getPages();
  pages.forEach((current, index) => {
    current.drawLine({ start: { x: MARGIN, y: 40 }, end: { x: PAGE_WIDTH - MARGIN, y: 40 }, thickness: .5, color: colors.line });
    current.drawText('Documento educativo. Detén el ejercicio ante dolor agudo o malestar inusual y solicita valoración profesional.', { x: MARGIN, y: 25, size: 6.4, font: regular, color: colors.muted });
    const number = `${index + 1} / ${pages.length}`;
    current.drawText(number, { x: PAGE_WIDTH - MARGIN - regular.widthOfTextAtSize(number, 7), y: 25, size: 7, font: regular, color: colors.muted });
  });
  document.setTitle(safeText(plan.title));
  document.setAuthor('Roman Colosseum');
  document.setSubject('Rutina semanal de entrenamiento');
  document.setCreationDate(new Date(plan.updatedAt));
  return document.save();
}
