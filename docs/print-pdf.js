import './vendor/jspdf.umd.min.js';
import {regular, bold} from './vendor/print-fonts.js';

// All assets are local and loaded before the click, including Cyrillic fonts.
// Generation stays synchronous so Safari can download within the user gesture.
export function schedulePDF(rows, doctorCount) {
  const {jsPDF} = globalThis.jspdf;
  const pdf = new jsPDF({orientation:'landscape', unit:'mm', format:'a4', compress:true, putOnlyUsedFonts:true});
  pdf.addFileToVFS('PSOPrint-Regular.ttf', regular);
  pdf.addFont('PSOPrint-Regular.ttf', 'PSOPrint', 'normal');
  pdf.addFileToVFS('PSOPrint-Bold.ttf', bold);
  pdf.addFont('PSOPrint-Bold.ttf', 'PSOPrint', 'bold');
  pdf.setProperties({title:'График отпусков ПСО на 2027 год'});
  pdf.setLanguage('ru-RU');
  pdf.setTextColor(17, 17, 17);
  pdf.setFont('PSOPrint', 'bold');
  pdf.setFontSize(14.25);
  pdf.text('График отпусков врачей ПСО на 2027 год', 10, 14.5);

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const tableWidth = pageWidth - 20;
  const widths = [11.5, 56, 22.5, 35.5, 35.5, 45.5, 23.5, 45].map(w => w * tableWidth / 275);
  const tableTop = 19.5;
  // Fit every row and the total on one page, keeping the supplied 31-row
  // schedule at 9 pt. No automatic pagination or clipped rows.
  const rowHeight = Math.min(5, (pageHeight - 10 - tableTop) / (rows.length + 2));
  const fontSize = Math.min(9, rowHeight * 1.8);
  const padding = Math.min(1, rowHeight / 5);
  pdf.setDrawColor(136, 136, 136);
  pdf.setLineWidth(0.2);
  let y = tableTop;

  function row(cells, spans = cells.map(() => 1), header = false) {
    let x = 10, column = 0;
    pdf.setFont('PSOPrint', header ? 'bold' : 'normal');
    for (const [i, value] of cells.entries()) {
      const width = widths.slice(column, column + spans[i]).reduce((a, b) => a + b, 0);
      pdf.setFillColor(237, 243, 246);
      pdf.rect(x, y, width, rowHeight, header ? 'FD' : 'S');
      const text = String(value);
      pdf.setFontSize(fontSize);
      const textWidth = pdf.getTextWidth(text);
      if (textWidth > width - padding * 2) pdf.setFontSize(fontSize * (width - padding * 2) / textWidth);
      pdf.text(text, x + padding, y + rowHeight / 2, {baseline:'middle'});
      x += width;
      column += spans[i];
    }
    y += rowHeight;
  }

  row(['№', 'Врач', 'Часть', 'Начало', 'Окончание', 'Дней отпуска', 'За год', 'Примечание'], undefined, true);
  const date = value => value.split('-').reverse().join('.');
  rows.forEach((r, i) => row([
    i + 1, r.name, r.part, date(r.start), date(r.end), r.days, r.source,
    r.span !== r.days ? `Праздников: ${r.span - r.days}` : ''
  ]));
  row(['Итого', rows.reduce((total, r) => total + r.days, 0), `${doctorCount} врачей`], [5, 1, 2]);
  return pdf.output('arraybuffer');
}
