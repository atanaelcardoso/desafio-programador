import { v4 as uuidv4 } from 'uuid';
import { transcriptionStore } from '../store/transcriptionStore.js';
import { parseCartaoPonto } from '../parsers/cartaoPonto.js';
import { parseHolerite } from '../parsers/holerite.js';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import Tesseract from 'tesseract.js';
import { pdf } from 'pdf-to-img';

pdfjsLib.GlobalWorkerOptions.disableWorker = true;
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  '../../node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs',
  import.meta.url
).href;

let tesseractWorkers = [];
let activeWorkerCount = 0;
const WORKER_POOL_SIZE = 3;

async function initTesseractPool() {
  if (tesseractWorkers.length > 0) return;

  console.log(`🔧 Inicializando ${WORKER_POOL_SIZE} workers Tesseract...`);

  for (let i = 0; i < WORKER_POOL_SIZE; i++) {
    const worker = await Tesseract.createWorker('por', 1, {
      logger: (m) => {
        if (m.status === 'recognizing') {
          console.log(`  OCR worker ${i + 1}: ${Math.round(m.progress * 100)}%`);
        }
      }
    });

    tesseractWorkers.push({
      instance: worker,
      busy: false
    });
  }

  console.log('✅ Pool Tesseract pronto');
}

async function getAvailableWorker() {
  for (const w of tesseractWorkers) {
    if (!w.busy) {
      w.busy = true;
      activeWorkerCount++;
      return w;
    }
  }

  return new Promise(resolve => {
    const checkInterval = setInterval(() => {
      for (const w of tesseractWorkers) {
        if (!w.busy) {
          clearInterval(checkInterval);
          w.busy = true;
          activeWorkerCount++;
          return resolve(w);
        }
      }
    }, 100);
  });
}

function releaseWorker(workerObj) {
  workerObj.busy = false;
  activeWorkerCount--;
}

export async function extractTextFromPdf(pdfBuffer) {
  try {
    const pdfCopy = Buffer.from(pdfBuffer);
    const binary = new Uint8Array(pdfCopy.buffer, pdfCopy.byteOffset, pdfCopy.length);

    const pdfDoc = await pdfjsLib.getDocument({
      data: binary,
      standardFontDataUrl: new URL('../../node_modules/pdfjs-dist/standard_fonts/', import.meta.url).href,
      useSystemFonts: true
    }).promise;

    const textPerPage = [];
    let pageImages = null;

    for (let i = 1; i <= pdfDoc.numPages; i++) {
      const page = await pdfDoc.getPage(i);
      const textContent = await page.getTextContent();
      const text = textContent.items
        .map(item => item.str)
        .join(' ');

      const textToValidate = text
        .replace(/assinado\s+eletronicamente\s+por/gi, '')
        .replace(/juntado\s+em/gi, '')
        .replace(/fls\.:\s*\d+/gi, '')
        .replace(/[\d/:\-\s]+/g, '')
        .trim();

      const isEmpty = textToValidate.length < 30;

      if (isEmpty && !pageImages) {
        console.log('📸 Rodapé judicial detectado, mas o conteúdo é uma imagem. Convertendo PDF para imagens via JavaScript puro...');
        pageImages = [];

        const documentImages = await pdf(pdfBuffer, { scale: 2.0 });
        for await (const image of documentImages) {
          pageImages.push(image);
        }
      }

      textPerPage.push({
        pageNum: i,
        text: isEmpty ? '' : text.trim(),
        imageBuffer: isEmpty && pageImages ? pageImages[i - 1] : null,
        source: isEmpty ? 'empty' : 'text',
        requiresOCR: isEmpty
      });
    }

    return textPerPage;
  } catch (err) {
    console.error('Erro ao extrair texto do PDF:', err.message);
    throw new Error('Falha ao processar arquivo PDF');
  }
}

async function ocrPageText(pageNum, imageBuffer, timeout = 60000) {
  try {
    if (!imageBuffer) {
      return '';
    }

    const workerObj = await getAvailableWorker();

    const ocrPromise = workerObj.instance.recognize(imageBuffer, {
      rotateAuto: true
    });

    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`OCR timeout na página ${pageNum}`)), timeout)
    );

    const result = await Promise.race([ocrPromise, timeoutPromise]);

    releaseWorker(workerObj);
    return result.data.text.trim();
  } catch (err) {
    console.error(`Erro no OCR página ${pageNum}:`, err.message);
    return '';
  }
}

export async function processTranscription(id, pdfBuffer, tipo) {
  const startTime = Date.now();
  const maxDuration = 10 * 60 * 1000;

  try {
    transcriptionStore.update(id, {
      status: 'processando',
      value: null,
      error: null
    });

    console.log(`📄 Processando ${tipo} [ID: ${id}]...`);

    const textPerPage = await extractTextFromPdf(pdfBuffer);

    const needsOCR = textPerPage.some(p => p.requiresOCR);
    if (needsOCR) {
      await initTesseractPool();
    }

    const processedPages = [];
    for (const page of textPerPage) {
      if (Date.now() - startTime > maxDuration) {
        throw new Error('Processamento excedeu 10 minutos');
      }

      if (page.requiresOCR) {
        console.log(`  📸 Executando OCR na página ${page.pageNum}...`);
        page.text = await ocrPageText(page.pageNum, page.imageBuffer, 60000);
        page.source = 'ocr';
      }

      delete page.imageBuffer;
      processedPages.push(page);
    }

    console.log("🔍 TEXTO EXTRAÍDO ENVIADO PARA O PARSER:\n", JSON.stringify(processedPages, null, 2));

    let result;
    if (tipo === 'cartao-ponto') {
      result = parseCartaoPonto(processedPages);
    } else if (tipo === 'holerite') {
      result = parseHolerite(processedPages);
    } else {
      throw new Error('Tipo de documento não suportado');
    }

    transcriptionStore.update(id, {
      status: 'concluido',
      value: result,
      error: null
    });

    console.log(`✅ Transcrição concluída [ID: ${id}] em ${Math.round((Date.now() - startTime) / 1000)}s`);
  } catch (err) {
    console.error(`❌ Erro ao processar [ID: ${id}]:`, err.message);
    transcriptionStore.update(id, {
      status: 'erro',
      value: null,
      error: err.message
    });
  }
}

export function createTranscription(pdfBuffer, tipo) {
  const id = uuidv4();

  transcriptionStore.set(id, {
    id,
    tipo,
    status: 'processando',
    value: null,
    error: null
  });

  processTranscription(id, pdfBuffer, tipo).catch(err => {
    console.error('Erro não capturado no processamento em background:', err);
  });

  return id;
}

export function getTranscription(id) {
  return transcriptionStore.get(id);
}

export function updateTranscription(id, value) {
  const trans = transcriptionStore.get(id);
  if (!trans) {
    throw new Error('Transcrição não encontrada');
  }

  if (!value || !value.pages || !Array.isArray(value.pages)) {
    throw new Error('Formato de transcrição inválido');
  }

  transcriptionStore.update(id, { value });
  return transcriptionStore.get(id);
}
