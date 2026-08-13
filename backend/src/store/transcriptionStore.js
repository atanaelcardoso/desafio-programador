/**
 * Store em memória para transcrições
 * Chave: UUID
 * Valor: { id, tipo, status, value, error, timestamp, lastAccessed }
 * 
 * Status: 'processando' | 'concluido' | 'erro'
 * Cleanup: remove transcrições > 5 min sem acesso
 */

class TranscriptionStore {
  constructor(retentionMs = 5 * 60 * 1000) {
    this.store = new Map();
    this.retentionMs = retentionMs;
    
    // Limpeza automática a cada 1 min
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 60 * 1000);
  }

  set(id, data) {
    this.store.set(id, {
      ...data,
      timestamp: Date.now(),
      lastAccessed: Date.now()
    });
  }

  get(id) {
    if (this.store.has(id)) {
      const data = this.store.get(id);
      data.lastAccessed = Date.now();
      return data;
    }
    return null;
  }

  update(id, updates) {
    if (this.store.has(id)) {
      const data = this.store.get(id);
      this.store.set(id, {
        ...data,
        ...updates,
        lastAccessed: Date.now()
      });
      return true;
    }
    return false;
  }

  delete(id) {
    return this.store.delete(id);
  }

  cleanup() {
    const now = Date.now();
    let removed = 0;
    
    for (const [id, data] of this.store.entries()) {
      if (now - data.lastAccessed > this.retentionMs) {
        this.store.delete(id);
        removed++;
      }
    }
    
    if (removed > 0) {
      console.log(`🧹 Limpeza: ${removed} transcrição(ões) removida(s)`);
    }
  }

  destroy() {
    clearInterval(this.cleanupInterval);
    this.store.clear();
  }
}

export const transcriptionStore = new TranscriptionStore();
