import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { PageNumber } from '../types';

// 특정 페이지를 PDF로 변환
export async function generatePDF(_pageNumber: PageNumber, elementId: string): Promise<jsPDF> {
  const element = document.getElementById(elementId);
  if (!element) {
    throw new Error('PDF로 변환할 요소를 찾을 수 없습니다.');
  }

  const canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    logging: false,
  });

  const imgData = canvas.toDataURL('image/png');
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const imgWidth = 210; // A4 width in mm
  const pageHeight = 297; // A4 height in mm
  const imgHeight = (canvas.height * imgWidth) / canvas.width;
  let heightLeft = imgHeight;

  let position = 0;

  pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
  heightLeft -= pageHeight;

  while (heightLeft >= 0) {
    position = heightLeft - imgHeight;
    pdf.addPage();
    pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;
  }

  return pdf;
}

// 모든 페이지를 하나의 PDF로 생성
export async function generateAllPagesPDF(
  pageElements: { pageNumber: PageNumber; elementId: string }[],
  filename: string
): Promise<void> {
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  let isFirstPage = true;

  for (const { elementId } of pageElements) {
    const element = document.getElementById(elementId);
    if (!element) continue;

    const canvas = await html2canvas(element, {
      scale: 2,
      useCORS: true,
      logging: false,
    });

    const imgData = canvas.toDataURL('image/png');
    const imgWidth = 210;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    // 첫 페이지가 아니면 새 페이지 추가
    if (!isFirstPage) {
      pdf.addPage();
    }
    isFirstPage = false;

    // 이미지를 A4 페이지에 맞춰 추가
    pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);
  }

  pdf.save(filename);
}

