import Tesseract from 'tesseract.js';


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
        language: 'por',
        cachePath: '/tmp/tesseract'
      });
      this.workers.push({
        instance: worker,
        busy: false,
        queue: worker.load()
      });
    }
  }

  async processImage(imageData, timeout = 30000) {
    return new Promise(async (resolve, reject) => {
      const timeoutHandle = setTimeout(() => {
        reject(new Error(`OCR timeout após ${timeout}ms`));
      }, timeout);

      try {
        const worker = await this.getAvailableWorker();

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

  async getAvailableWorker() {
    for (const w of this.workers) {
      if (!w.busy) {
        w.busy = true;
        this.activeWorkers++;

        setTimeout(() => {
          w.busy = false;
          this.activeWorkers--;
        }, 100);

        return w.instance;
      }
    }

    return new Promise(resolve => {
      setTimeout(() => {
        resolve(this.getAvailableWorker());
      }, 100);
    });
  }

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

let ocrManager = null;

export function getOCRManager() {
  if (!ocrManager) {
    ocrManager = new OCRManager(3);
  }
  return ocrManager;
}

export async function pdfPageToImageData(page) {
  try {
    const scale = 2.0;
    const viewport = page.getViewport({ scale });

    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;

    const context = canvas.getContext('2d');

    await page.render({
      canvasContext: context,
      viewport: viewport
    }).promise;

    return context.getImageData(0, 0, viewport.width, viewport.height);
  } catch (err) {
    console.error('Erro ao converter página para imagem:', err);
    throw err;
  }
}

export async function ocrPageNode(imageBuffer, timeout = 30000) {
  const manager = getOCRManager();
  try {
    const text = await manager.processImage(imageBuffer, timeout);
    return text.trim();
  } catch (err) {
    console.error('Erro no OCR:', err.message);
    return '';
  }
}

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
