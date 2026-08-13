import { v4 as uuidv4 } from 'uuid';
import { transcriptionStore } from '../store/transcriptionStore.js';
import { parseCartaoPonto } from '../parsers/cartaoPonto.js';
import { parseHolerite } from '../parsers/holerite.js';
import * as pdfjsLib from 'pdfjs-dist';
import Tesseract from 'tesseract.js';

// Configurar worker do PDF.js
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  '../../node_modules/pdfjs-dist/build/pdf.worker.mjs',
  import.meta.url
).href;

// Pool de workers Tesseract
let tesseractWorkers = [];
let activeWorkerCount = 0;
const WORKER_POOL_SIZE = 3;

/**
 * Inicializar pool de workers Tesseract
 */
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

/**
 * Obter worker disponível do pool
 */
async function getAvailableWorker() {
  // Procurar worker disponível
  for (const w of tesseractWorkers) {
    if (!w.busy) {
      w.busy = true;
      activeWorkerCount++;
      return w;
    }
  }

  // Se todos ocupados, aguardar 100ms
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

/**
 * Liberar worker
 */
function releaseWorker(workerObj) {
  workerObj.busy = false;
  activeWorkerCount--;
}

/**
 * Extrair texto de um PDF usando PDF.js
 */
export async function extractTextFromPdf(pdfBuffer) {
  try {
    const binary = Buffer.isBuffer(pdfBuffer)
      ? new Uint8Array(pdfBuffer.buffer, pdfBuffer.byteOffset, pdfBuffer.length)
      : new Uint8Array(pdfBuffer);

    const pdf = await pdfjsLib.getDocument({ data: binary }).promise;
    const textPerPage = [];

    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const text = textContent.items
        .map(item => item.str)
        .join(' ');
      
      // Considerar "vazio" se texto < 50 caracteres (provável PDF escaneado)
      const isEmpty = text.trim().length < 50;
      
      textPerPage.push({
        pageNum: i,
        text: text.trim(),
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

/**
 * Aplicar OCR a uma página (sem camada de texto)
 */
async function ocrPageText(pageNum, text, timeout = 30000) {
  try {
    if (!text || text.trim().length === 0) {
      return '';
    }

    const workerObj = await getAvailableWorker();

    const ocrPromise = workerObj.instance.recognize(text, {
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
    return text; // Fallback: devolver texto extraído mesmo que ruim
  }
}

/**
 * Processar transcrição em background
 */
export async function processTranscription(id, pdfBuffer, tipo) {
  const startTime = Date.now();
  const maxDuration = 10 * 60 * 1000; // 10 minutos

  try {
    // Atualizar status para processando
    transcriptionStore.update(id, {
      status: 'processando',
      value: null,
      error: null
    });

    console.log(`📄 Processando ${tipo} [ID: ${id}]...`);

    // Extrair texto do PDF
    const textPerPage = await extractTextFromPdf(pdfBuffer);
    
    // Inicializar pool Tesseract se necessário
    const needsOCR = textPerPage.some(p => p.requiresOCR);
    if (needsOCR) {
      await initTesseractPool();
    }

    // Aplicar OCR onde necessário
    const processedPages = [];
    for (const page of textPerPage) {
      if (Date.now() - startTime > maxDuration) {
        throw new Error('Processamento excedeu 10 minutos');
      }

      if (page.requiresOCR) {
        console.log(`  📸 OCR na página ${page.pageNum}...`);
        page.text = await ocrPageText(page.pageNum, page.text, 60000);
        page.source = 'ocr';
      }

      processedPages.push(page);
    }
    
    // Chamar parser apropriado
    let result;
    if (tipo === 'cartao-ponto') {
      result = parseCartaoPonto(processedPages);
    } else if (tipo === 'holerite') {
      result = parseHolerite(processedPages);
    } else {
      throw new Error('Tipo de documento não suportado');
    }

    // Atualizar com resultado
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

/**
 * Criar nova transcrição (retorna ID imediatamente)
 */
export function createTranscription(pdfBuffer, tipo) {
  const id = uuidv4();

  // Guardar no store com status inicial
  transcriptionStore.set(id, {
    id,
    tipo,
    status: 'processando',
    value: null,
    error: null
  });

  // Enfileirar processamento em background (não aguardar)
  processTranscription(id, pdfBuffer, tipo).catch(err => {
    console.error('Erro não capturado:', err);
  });

  return id;
}

/**
 * Obter transcrição
 */
export function getTranscription(id) {
  return transcriptionStore.get(id);
}

/**
 * Atualizar transcrição (usuário corrigindo na interface)
 */
export function updateTranscription(id, value) {
  const trans = transcriptionStore.get(id);
  if (!trans) {
    throw new Error('Transcrição não encontrada');
  }

  // Validar estrutura básica
  if (!value || !value.pages || !Array.isArray(value.pages)) {
    throw new Error('Formato de transcrição inválido');
  }

  transcriptionStore.update(id, { value });
  return transcriptionStore.get(id);
}
