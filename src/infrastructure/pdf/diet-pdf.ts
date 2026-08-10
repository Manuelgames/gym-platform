import {
  PDFDocument,
  StandardFonts,
  rgb,
  type PDFFont,
  type PDFPage,
  type RGB,
} from 'pdf-lib';
import type { DietMeal, DietPlan } from '../../domain/diet/diet';

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN = 36;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const CONTENT_BOTTOM = 54;

const palette = {
  forest: rgb(0.02, 0.25, 0.12),
  leaf: rgb(0.35, 0.58, 0.18),
  paleLeaf: rgb(0.95, 0.97, 0.91),
  paleWarm: rgb(0.98, 0.97, 0.93),
  warmLine: rgb(0.82, 0.72, 0.55),
  blue: rgb(0.02, 0.38, 0.62),
  paleBlue: rgb(0.94, 0.98, 1),
  ink: rgb(0.08, 0.12, 0.09),
  muted: rgb(0.34, 0.37, 0.35),
  line: rgb(0.82, 0.87, 0.78),
  white: rgb(1, 1, 1),
};

export interface DietPdfOptions {
  clientName: string;
  age?: number | null;
  weightKg?: number | null;
  heightCm?: number | null;
}

interface MealContentLine {
  text: string;
  font: PDFFont;
  size: number;
  color: RGB;
  height: number;
  indent?: number;
}

function safePdfText(value: string): string {
  return value
    .replace(/[•·]/g, '-')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[–—]/g, '-')
    .replace(/…/g, '...')
    .replace(/\u00A0/g, ' ')
    .replace(/[^\u0009\u000A\u000D\u0020-\u007E\u00A0-\u00FF]/g, '');
}

function wrappedLines(text: string, font: PDFFont, size: number, maximumWidth: number): string[] {
  const paragraphs = safePdfText(text).split(/\r?\n/);
  const lines: string[] = [];
  for (const paragraph of paragraphs) {
    const words = paragraph.trim().split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      lines.push('');
      continue;
    }
    let line = '';
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, size) <= maximumWidth) {
        line = candidate;
        continue;
      }
      if (line) lines.push(line);
      if (font.widthOfTextAtSize(word, size) <= maximumWidth) {
        line = word;
        continue;
      }
      let fragment = '';
      for (const character of word) {
        const candidateFragment = fragment + character;
        if (font.widthOfTextAtSize(candidateFragment, size) > maximumWidth && fragment) {
          lines.push(fragment);
          fragment = character;
        } else {
          fragment = candidateFragment;
        }
      }
      line = fragment;
    }
    if (line) lines.push(line);
  }
  return lines;
}

function fittedText(text: string, font: PDFFont, size: number, maximumWidth: number): string {
  const safe = safePdfText(text);
  if (font.widthOfTextAtSize(safe, size) <= maximumWidth) return safe;
  let shortened = safe;
  while (shortened.length > 1 && font.widthOfTextAtSize(`${shortened}...`, size) > maximumWidth) {
    shortened = shortened.slice(0, -1);
  }
  return `${shortened.trim()}...`;
}

function displayTime(value: string): string {
  const [hourValue, minuteValue] = value.split(':').map(Number);
  if (!Number.isInteger(hourValue) || !Number.isInteger(minuteValue)) return value || 'Horario libre';
  const suffix = hourValue! < 12 ? 'a. m.' : 'p. m.';
  const hour = hourValue! % 12 || 12;
  return `${hour}:${String(minuteValue).padStart(2, '0')} ${suffix}`;
}

function sourceLabel(plan: DietPlan): string {
  if (plan.source === 'ai') return plan.generationEngine === 'openai' ? 'Generada con IA' : 'Generación automática';
  if (plan.source === 'manual') return 'Creada por el usuario';
  return 'Asignada por nutricionista';
}

function goalLabel(plan: DietPlan): string {
  if (plan.goal === 'ganar') return 'Ganar fuerza y masa muscular';
  if (plan.goal === 'perder') return 'Reducir grasa gradualmente';
  return 'Mantener peso y rendimiento';
}

function preferenceLabel(plan: DietPlan): string {
  const labels = {
    general: 'General',
    vegetariana: 'Vegetariana',
    vegana: 'Vegana',
    pescetariana: 'Pescetariana',
    sin_lactosa: 'Sin lactosa',
    rapida: 'Preparación rápida',
  } as const;
  return labels[plan.preference];
}

function amountLabel(value: number): string {
  return Number.isInteger(value) ? String(value) : String(Math.round(value * 100) / 100);
}

/** Genera un documento A4 con la misma jerarquía visual que la ficha mostrada en pantalla. */
export async function createDietPdf(plan: DietPlan, options: DietPdfOptions): Promise<Uint8Array> {
  const document = await PDFDocument.create();
  const regular = await document.embedFont(StandardFonts.Helvetica);
  const bold = await document.embedFont(StandardFonts.HelveticaBold);
  let page: PDFPage = document.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let y = PAGE_HEIGHT - MARGIN;

  const drawContinuationHeader = () => {
    page.drawText('ROMAN COLOSSEUM  /  PLAN DE ALIMENTACIÓN', {
      x: MARGIN,
      y: PAGE_HEIGHT - 31,
      size: 8,
      font: bold,
      color: palette.forest,
    });
    page.drawText(fittedText(plan.title, regular, 8, 250), {
      x: PAGE_WIDTH - MARGIN - 250,
      y: PAGE_HEIGHT - 31,
      size: 8,
      font: regular,
      color: palette.muted,
    });
    page.drawLine({
      start: { x: MARGIN, y: PAGE_HEIGHT - 41 },
      end: { x: PAGE_WIDTH - MARGIN, y: PAGE_HEIGHT - 41 },
      thickness: 0.8,
      color: palette.line,
    });
    y = PAGE_HEIGHT - 58;
  };

  const addPage = (continuation = true) => {
    page = document.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    if (continuation) drawContinuationHeader();
    else y = PAGE_HEIGHT - MARGIN;
  };

  const ensureSpace = (height: number) => {
    if (y - height < CONTENT_BOTTOM) addPage();
  };

  const drawSectionTitle = (title: string) => {
    ensureSpace(30);
    const text = safePdfText(title);
    const size = 14;
    const textWidth = bold.widthOfTextAtSize(text, size);
    const centerX = PAGE_WIDTH / 2;
    const lineGap = 12;
    page.drawLine({
      start: { x: MARGIN, y: y + 5 },
      end: { x: centerX - textWidth / 2 - lineGap, y: y + 5 },
      thickness: 1,
      color: palette.leaf,
    });
    page.drawText(text, { x: centerX - textWidth / 2, y, size, font: bold, color: palette.forest });
    page.drawLine({
      start: { x: centerX + textWidth / 2 + lineGap, y: y + 5 },
      end: { x: PAGE_WIDTH - MARGIN, y: y + 5 },
      thickness: 1,
      color: palette.leaf,
    });
    y -= 22;
  };

  page.drawText('PLAN ALIMENTICIO / DIETA NUTRIMENTAL', {
    x: MARGIN,
    y,
    size: 21,
    font: bold,
    color: palette.forest,
  });
  page.drawCircle({ x: PAGE_WIDTH - MARGIN - 12, y: y + 5, size: 10, color: palette.leaf });
  page.drawCircle({ x: PAGE_WIDTH - MARGIN - 28, y: y - 1, size: 7, color: palette.forest });
  y -= 24;
  page.drawText('Plan personalizado - no sustituye la valoración de un profesional de la nutrición', {
    x: MARGIN,
    y,
    size: 9.5,
    font: regular,
    color: palette.muted,
  });
  const badge = sourceLabel(plan);
  const badgeWidth = bold.widthOfTextAtSize(badge, 8) + 18;
  page.drawRectangle({
    x: PAGE_WIDTH - MARGIN - badgeWidth,
    y: y - 4,
    width: badgeWidth,
    height: 18,
    color: palette.paleLeaf,
    borderColor: palette.leaf,
    borderWidth: 0.6,
  });
  page.drawText(badge, {
    x: PAGE_WIDTH - MARGIN - badgeWidth + 9,
    y: y + 1,
    size: 8,
    font: bold,
    color: palette.forest,
  });
  y -= 29;

  const profileHeight = 78;
  const profileTop = y;
  page.drawRectangle({
    x: MARGIN,
    y: profileTop - profileHeight,
    width: CONTENT_WIDTH,
    height: profileHeight,
    color: palette.white,
    borderColor: palette.leaf,
    borderWidth: 0.8,
  });
  const profileItems = [
    { marker: 'N', label: 'NOMBRE', value: options.clientName },
    { marker: 'E', label: 'EDAD', value: options.age ? `${options.age} años` : 'Sin registrar' },
    { marker: 'P', label: 'PESO', value: options.weightKg ? `${amountLabel(options.weightKg)} kg` : 'Sin registrar' },
    { marker: 'A', label: 'ESTATURA', value: options.heightCm ? `${amountLabel(options.heightCm)} cm` : 'Sin registrar' },
    { marker: 'O', label: 'OBJETIVO', value: goalLabel(plan) },
  ];
  const profileWidth = CONTENT_WIDTH / profileItems.length;
  profileItems.forEach((item, index) => {
    const left = MARGIN + index * profileWidth;
    const center = left + profileWidth / 2;
    if (index > 0) {
      page.drawLine({
        start: { x: left, y: profileTop - 12 },
        end: { x: left, y: profileTop - profileHeight + 12 },
        thickness: 0.5,
        color: palette.line,
      });
    }
    page.drawCircle({
      x: center,
      y: profileTop - 15,
      size: 8,
      borderColor: palette.forest,
      borderWidth: 1,
    });
    const markerWidth = bold.widthOfTextAtSize(item.marker, 7);
    page.drawText(item.marker, { x: center - markerWidth / 2, y: profileTop - 17.5, size: 7, font: bold, color: palette.forest });
    const labelWidth = bold.widthOfTextAtSize(item.label, 7.5);
    page.drawText(item.label, { x: center - labelWidth / 2, y: profileTop - 35, size: 7.5, font: bold, color: palette.forest });
    const valueLines = wrappedLines(item.value, regular, 8.4, profileWidth - 12).slice(0, 2);
    valueLines.forEach((line, lineIndex) => {
      const valueWidth = regular.widthOfTextAtSize(line, 8.4);
      page.drawText(line, {
        x: center - valueWidth / 2,
        y: profileTop - 50 - lineIndex * 10,
        size: 8.4,
        font: regular,
        color: palette.ink,
      });
    });
  });
  y -= profileHeight + 10;

  const planNameLines = wrappedLines(plan.title, bold, 13, CONTENT_WIDTH - 20).slice(0, 2);
  const summaryLines = plan.summary ? wrappedLines(plan.summary, regular, 8.5, CONTENT_WIDTH - 20).slice(0, 3) : [];
  const introHeight = 19 + planNameLines.length * 15 + summaryLines.length * 10 + 11;
  page.drawRectangle({
    x: MARGIN,
    y: y - introHeight,
    width: CONTENT_WIDTH,
    height: introHeight,
    color: palette.paleWarm,
    borderColor: palette.warmLine,
    borderWidth: 0.6,
  });
  let introY = y - 16;
  planNameLines.forEach((line) => {
    page.drawText(line, { x: MARGIN + 10, y: introY, size: 13, font: bold, color: palette.forest });
    introY -= 15;
  });
  summaryLines.forEach((line) => {
    page.drawText(line, { x: MARGIN + 10, y: introY, size: 8.5, font: regular, color: palette.muted });
    introY -= 10;
  });
  y -= introHeight + 9;

  if (plan.nutrition) {
    const macroItems = [
      ['ENERGÍA', `${amountLabel(plan.nutrition.caloriesKcal)} kcal`],
      ['PROTEÍNA', `${amountLabel(plan.nutrition.proteinG)} g`],
      ['CARBOHIDRATOS', `${amountLabel(plan.nutrition.carbsG)} g`],
      ['GRASAS', `${amountLabel(plan.nutrition.fatG)} g`],
    ];
    const macroWidth = CONTENT_WIDTH / macroItems.length;
    const macroHeight = 35;
    macroItems.forEach(([label, value], index) => {
      const left = MARGIN + index * macroWidth;
      page.drawRectangle({
        x: left,
        y: y - macroHeight,
        width: macroWidth,
        height: macroHeight,
        color: index % 2 === 0 ? palette.paleLeaf : palette.white,
        borderColor: palette.line,
        borderWidth: 0.5,
      });
      page.drawText(label!, { x: left + 8, y: y - 13, size: 6.7, font: bold, color: palette.muted });
      page.drawText(value!, { x: left + 8, y: y - 27, size: 10, font: bold, color: palette.forest });
    });
    y -= macroHeight + 13;
  }

  drawSectionTitle('DISTRIBUCIÓN DEL DÍA');
  const columns = Math.min(5, plan.entries.length);
  const distributionGap = 5;
  const distributionWidth = (CONTENT_WIDTH - distributionGap * (columns - 1)) / columns;
  const distributionHeight = 45;
  const distributionRows = Math.ceil(plan.entries.length / columns);
  ensureSpace(distributionRows * (distributionHeight + distributionGap) + 8);
  const distributionTop = y;
  plan.entries.forEach((meal, index) => {
    const row = Math.floor(index / columns);
    const column = index % columns;
    const left = MARGIN + column * (distributionWidth + distributionGap);
    const top = distributionTop - row * (distributionHeight + distributionGap);
    page.drawRectangle({
      x: left,
      y: top - distributionHeight,
      width: distributionWidth,
      height: distributionHeight,
      color: palette.paleLeaf,
      borderColor: palette.line,
      borderWidth: 0.4,
    });
    page.drawCircle({ x: left + 12, y: top - 13, size: 7, color: palette.leaf });
    const indexText = String(index + 1);
    const indexWidth = bold.widthOfTextAtSize(indexText, 7);
    page.drawText(indexText, { x: left + 12 - indexWidth / 2, y: top - 15.5, size: 7, font: bold, color: palette.white });
    page.drawText(fittedText(meal.type, bold, 7.7, distributionWidth - 27), {
      x: left + 23,
      y: top - 15,
      size: 7.7,
      font: bold,
      color: palette.forest,
    });
    const mealTime = displayTime(meal.time);
    const timeWidth = regular.widthOfTextAtSize(mealTime, 8);
    page.drawText(mealTime, {
      x: left + Math.max(7, (distributionWidth - timeWidth) / 2),
      y: top - 34,
      size: 8,
      font: regular,
      color: palette.ink,
    });
  });
  y -= distributionRows * (distributionHeight + distributionGap) + 10;

  drawSectionTitle('PLAN DEL DÍA');

  const mealLines = (meal: DietMeal): MealContentLine[] => {
    const lines: MealContentLine[] = [];
    const rightWidth = CONTENT_WIDTH - 155;
    meal.ingredients.forEach((ingredient) => {
      const note = ingredient.note ? ` (${ingredient.note})` : '';
      const text = `- ${amountLabel(ingredient.amount)} ${ingredient.unit} de ${ingredient.name}${note}`;
      wrappedLines(text, regular, 9, rightWidth - 18).forEach((line, index) => {
        lines.push({
          text: line,
          font: index === 0 ? bold : regular,
          size: 9,
          color: palette.ink,
          height: 11.5,
          indent: index === 0 ? 0 : 9,
        });
      });
    });
    if (meal.preparation) {
      wrappedLines(`Preparación: ${meal.preparation}`, regular, 8.2, rightWidth - 18).forEach((line, index) => {
        lines.push({ text: line, font: index === 0 ? bold : regular, size: 8.2, color: palette.muted, height: 10.5 });
      });
    }
    if (meal.notes) {
      wrappedLines(`Nota: ${meal.notes}`, regular, 8.2, rightWidth - 18).forEach((line, index) => {
        lines.push({ text: line, font: index === 0 ? bold : regular, size: 8.2, color: palette.muted, height: 10.5 });
      });
    }
    if (meal.estimatedCaloriesKcal) {
      lines.push({
        text: `${amountLabel(meal.estimatedCaloriesKcal)} kcal aproximadas`,
        font: bold,
        size: 8,
        color: palette.leaf,
        height: 11,
      });
    }
    return lines;
  };

  const drawMealChunk = (
    meal: DietMeal,
    mealIndex: number,
    lines: MealContentLine[],
    continuation: boolean,
  ) => {
    const contentHeight = lines.reduce((total, line) => total + line.height, 0);
    const cardHeight = Math.max(88, contentHeight + 24);
    const cardTop = y;
    const leftWidth = 145;
    page.drawRectangle({
      x: MARGIN,
      y: cardTop - cardHeight,
      width: CONTENT_WIDTH,
      height: cardHeight,
      color: palette.white,
      borderColor: palette.warmLine,
      borderWidth: 0.7,
    });
    page.drawRectangle({
      x: MARGIN,
      y: cardTop - cardHeight,
      width: leftWidth,
      height: cardHeight,
      color: palette.paleWarm,
    });
    page.drawLine({
      start: { x: MARGIN + leftWidth, y: cardTop },
      end: { x: MARGIN + leftWidth, y: cardTop - cardHeight },
      thickness: 0.6,
      color: palette.warmLine,
    });
    page.drawCircle({ x: MARGIN + 21, y: cardTop - 24, size: 12, color: palette.paleLeaf, borderColor: palette.leaf, borderWidth: 0.8 });
    const mealNumber = String(mealIndex + 1);
    const mealNumberWidth = bold.widthOfTextAtSize(mealNumber, 9);
    page.drawText(mealNumber, {
      x: MARGIN + 21 - mealNumberWidth / 2,
      y: cardTop - 27,
      size: 9,
      font: bold,
      color: palette.forest,
    });
    const type = continuation ? `${meal.type} (continuación)` : meal.type;
    const typeLines = wrappedLines(type, bold, continuation ? 8.5 : 11, leftWidth - 22).slice(0, 2);
    typeLines.forEach((line, index) => {
      page.drawText(line, {
        x: MARGIN + 13,
        y: cardTop - 48 - index * 12,
        size: continuation ? 8.5 : 11,
        font: bold,
        color: palette.forest,
      });
    });
    if (!continuation) {
      const titleLines = wrappedLines(meal.title, regular, 8, leftWidth - 22).slice(0, 3);
      titleLines.forEach((line, index) => {
        page.drawText(line, { x: MARGIN + 13, y: cardTop - 76 - index * 10, size: 8, font: regular, color: palette.ink });
      });
      page.drawText(displayTime(meal.time), {
        x: MARGIN + 13,
        y: cardTop - cardHeight + 14,
        size: 8,
        font: bold,
        color: palette.leaf,
      });
    }
    let contentY = cardTop - 17;
    lines.forEach((line) => {
      page.drawText(line.text, {
        x: MARGIN + leftWidth + 12 + (line.indent ?? 0),
        y: contentY,
        size: line.size,
        font: line.font,
        color: line.color,
      });
      contentY -= line.height;
    });
    y -= cardHeight + 7;
  };

  plan.entries.forEach((meal, mealIndex) => {
    const lines = mealLines(meal);
    let cursor = 0;
    let continuation = false;
    do {
      ensureSpace(102);
      const availableContentHeight = Math.max(66, y - CONTENT_BOTTOM - 31);
      let consumedHeight = 0;
      let end = cursor;
      while (end < lines.length && consumedHeight + lines[end]!.height <= availableContentHeight) {
        consumedHeight += lines[end]!.height;
        end += 1;
      }
      if (end === cursor && lines[cursor]) end += 1;
      const chunk = lines.slice(cursor, end);
      drawMealChunk(meal, mealIndex, chunk, continuation);
      cursor = end;
      continuation = true;
      if (cursor < lines.length) addPage();
    } while (cursor < lines.length);
  });

  ensureSpace(137);
  const cardGap = 12;
  const utilityWidth = (CONTENT_WIDTH - cardGap) / 2;
  const utilityHeight = 122;
  const utilityTop = y;
  page.drawRectangle({
    x: MARGIN,
    y: utilityTop - utilityHeight,
    width: utilityWidth,
    height: utilityHeight,
    color: palette.paleBlue,
    borderColor: palette.blue,
    borderWidth: 0.7,
  });
  page.drawCircle({ x: MARGIN + 26, y: utilityTop - 27, size: 14, color: palette.blue });
  const waterMarkWidth = bold.widthOfTextAtSize('H2O', 7);
  page.drawText('H2O', { x: MARGIN + 26 - waterMarkWidth / 2, y: utilityTop - 29.5, size: 7, font: bold, color: palette.white });
  page.drawText('HIDRATACIÓN', { x: MARGIN + 50, y: utilityTop - 31, size: 14, font: bold, color: palette.blue });
  page.drawLine({
    start: { x: MARGIN + 18, y: utilityTop - 46 },
    end: { x: MARGIN + utilityWidth - 18, y: utilityTop - 46 },
    thickness: 0.8,
    color: palette.blue,
  });
  page.drawText('Como referencia general:', { x: MARGIN + 18, y: utilityTop - 67, size: 8.5, font: regular, color: palette.ink });
  page.drawText('2-2.5 litros', { x: MARGIN + 18, y: utilityTop - 91, size: 18, font: bold, color: palette.blue });
  page.drawText('de agua al día, salvo indicación clínica distinta.', {
    x: MARGIN + 18,
    y: utilityTop - 106,
    size: 7.5,
    font: regular,
    color: palette.muted,
  });

  const recommendationX = MARGIN + utilityWidth + cardGap;
  page.drawRectangle({
    x: recommendationX,
    y: utilityTop - utilityHeight,
    width: utilityWidth,
    height: utilityHeight,
    color: palette.paleLeaf,
    borderColor: palette.leaf,
    borderWidth: 0.7,
  });
  page.drawText('RECOMENDACIONES GENERALES', {
    x: recommendationX + 14,
    y: utilityTop - 25,
    size: 10.5,
    font: bold,
    color: palette.forest,
  });
  page.drawLine({
    start: { x: recommendationX + 14, y: utilityTop - 35 },
    end: { x: recommendationX + utilityWidth - 14, y: utilityTop - 35 },
    thickness: 0.8,
    color: palette.leaf,
  });
  const recommendations = [
    'Priorizar alimentos frescos y variados',
    'Respetar horarios y señales de saciedad',
    `Preferencia aplicada: ${preferenceLabel(plan)}`,
    'Ajustar por indicación profesional',
    'Combinar con actividad física y descanso',
  ];
  recommendations.forEach((recommendation, index) => {
    page.drawCircle({ x: recommendationX + 19, y: utilityTop - 52 - index * 14, size: 3.2, color: palette.leaf });
    page.drawText(fittedText(recommendation, regular, 7.7, utilityWidth - 40), {
      x: recommendationX + 29,
      y: utilityTop - 55 - index * 14,
      size: 7.7,
      font: regular,
      color: palette.ink,
    });
  });
  y -= utilityHeight + 12;

  const pages = document.getPages();
  pages.forEach((currentPage, index) => {
    currentPage.drawLine({
      start: { x: MARGIN, y: 39 },
      end: { x: PAGE_WIDTH - MARGIN, y: 39 },
      thickness: 0.5,
      color: palette.line,
    });
    currentPage.drawText('Documento educativo; las porciones son aproximadas y requieren ajuste individual cuando corresponda.', {
      x: MARGIN,
      y: 25,
      size: 6.8,
      font: regular,
      color: palette.muted,
    });
    const pageNumber = `${index + 1} / ${pages.length}`;
    currentPage.drawText(pageNumber, {
      x: PAGE_WIDTH - MARGIN - regular.widthOfTextAtSize(pageNumber, 7),
      y: 25,
      size: 7,
      font: regular,
      color: palette.muted,
    });
  });

  document.setTitle(safePdfText(plan.title));
  document.setAuthor('Roman Colosseum');
  document.setSubject('Plan de alimentación personalizado');
  document.setCreationDate(new Date(plan.updatedAt));
  return document.save();
}
