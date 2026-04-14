import * as pdfjsLib from 'pdfjs-dist';

// Set worker source
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

export async function extractTextFromPdf(file: File): Promise<string> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
    const pdf = await loadingTask.promise;
    let fullText = '';

    const maxPages = Math.min(pdf.numPages, 20);
    for (let i = 1; i <= maxPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        .map((item: any) => 'str' in item ? item.str : '')
        .join(' ');
      fullText += `--- Página ${i} ---\n${pageText}\n\n`;
    }

    return fullText;
  } catch (error) {
    console.error('Erro ao extrair texto do PDF:', error);
    throw new Error('Não foi possível ler o arquivo PDF. Verifique se o arquivo não está corrompido.');
  }
}

export async function renderPdfPageToImage(file: File, pageNumber: number = 1): Promise<string> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
    const pdf = await loadingTask.promise;
    const page = await pdf.getPage(pageNumber);
    
    const viewport = page.getViewport({ scale: 1.5 }); // Optimized for performance/quality balance
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    
    if (!context) throw new Error('Could not get canvas context');
    
    canvas.height = viewport.height;
    canvas.width = viewport.width;
    
    await page.render({
      canvasContext: context,
      viewport: viewport,
      canvas: canvas // Added canvas property as required by newer versions
    }).promise;
    
    return canvas.toDataURL('image/png').split(',')[1];
  } catch (error) {
    console.error('Erro ao renderizar PDF para imagem:', error);
    throw new Error('Não foi possível gerar visualização do PDF.');
  }
}
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const base64 = (reader.result as string).split(',')[1];
      resolve(base64);
    };
    reader.onerror = error => reject(error);
  });
}
