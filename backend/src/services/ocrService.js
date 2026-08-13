import Tesseract from 'tesseract.js';

/**
 * Gerenciador de OCR com pool de workers
 * Reutiliza workers para não sobrecarregar memória
 */
class OCRManager {
  constructor(poolSize = 3) {
    this.poolSize = poolSize;
    this.workers = [];
    this.taskQueue = [];
    this.activeWorkers = 0;
    this.totalProcessed = 0;
    this.initializeWorkers();
  }

  initializeWorkers() {
    console.log(`🔧 Inicializando ${this.poolSize} workers de Tesseract...`);
    for (let i = 0; i < this.poolSize; i++) {
      const worker = Tesseract.createWorker({
        language: 'por', // Português
        cachePath: '/tmp/tesseract'
      });
      this.workers.push({
        instance: worker,
        busy: false,
        queue: worker.load()
      });
    }
  }

  /**
   * Processar imagem com OCR
   * Usa worker disponível ou enfileira
   */
  async processImage(imageData, timeout = 30000) {
    return new Promise(async (resolve, reject) => {
      const timeoutHandle = setTimeout(() => {
        reject(new Error(`OCR timeout após ${timeout}ms`));
      }, timeout);

      try {
        // Aguardar worker disponível
        const worker = await this.getAvailableWorker();

        // Executar OCR
        const result = await worker.recognize(imageData);
        
        this.totalProcessed++;
        clearTimeout(timeoutHandle);
        resolve(result.data.text);
      } catch (err) {
        clearTimeout(timeoutHandle);
        reject(err);
      }
    });
  }

  /**
   * Obter worker disponível (esperar se necessário)
   */
  async getAvailableWorker() {
    // Tentar encontrar worker ocioso
    for (const w of this.workers) {
      if (!w.busy) {
        w.busy = true;
        this.activeWorkers++;
        
        // Liberar depois de 100ms sem chamadas
        setTimeout(() => {
          w.busy = false;
          this.activeWorkers--;
        }, 100);

        return w.instance;
      }
    }

    // Se todos estão ocupados, aguardar 100ms e tentar novamente
    return new Promise(resolve => {
      setTimeout(() => {
        resolve(this.getAvailableWorker());
      }, 100);
    });
  }

  /**
   * Cleanup — terminar todos os workers
   */
  async terminate() {
    console.log('🧹 Terminando workers de Tesseract...');
    for (const w of this.workers) {
      try {
        await w.instance.terminate();
      } catch (err) {
        console.warn('Erro ao terminar worker:', err.message);
      }
    }
    this.workers = [];
    console.log(`✅ ${this.totalProcessed} imagens processadas com OCR`);
  }
}

// Singleton
let ocrManager = null;

export function getOCRManager() {
  if (!ocrManager) {
    ocrManager = new OCRManager(3); // 3 workers
  }
  return ocrManager;
}

/**
 * Converter página PDF para imagem (canvas → ImageData)
 * Requer pdfjs-dist
 */
export async function pdfPageToImageData(page) {
  try {
    const scale = 2.0;
    const viewport = page.getViewport({ scale });
    
    // Criar canvas
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    
    const context = canvas.getContext('2d');
    
    // Renderizar página
    await page.render({
      canvasContext: context,
      viewport: viewport
    }).promise;

    // Extrair ImageData
    return context.getImageData(0, 0, viewport.width, viewport.height);
  } catch (err) {
    console.error('Erro ao converter página para imagem:', err);
    throw err;
  }
}

/**
 * Processar página com OCR (versão Node.js)
 * Para uso em Node, usamos Buffer de imagem
 */
export async function ocrPageNode(imageBuffer, timeout = 30000) {
  const manager = getOCRManager();
  try {
    const text = await manager.processImage(imageBuffer, timeout);
    return text.trim();
  } catch (err) {
    console.error('Erro no OCR:', err.message);
    return ''; // Retornar vazio em caso de erro
  }
}

/**
 * Processar página com OCR (versão Browser)
 * Para uso no frontend React
 */
export async function ocrPageBrowser(imageCanvas, timeout = 30000) {
  const manager = getOCRManager();
  try {
    const text = await manager.processImage(imageCanvas, timeout);
    return text.trim();
  } catch (err) {
    console.error('Erro no OCR:', err.message);
    return '';
  }
}
