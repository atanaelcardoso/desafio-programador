# SOLUÇÃO — Quick Filler

## 📋 Visão Geral

**Quick Filler** é uma aplicação completa para transcrição inteligente de documentos trabalhistas (cartão de ponto e holerite) de formato PDF para planilhas editáveis.

**Stack Tecnológico:**

| Componente | Tecnologia | Versão |
|---|---|---|
| Backend | Node.js + Express.js | 22 Alpine / 4.18.2 |
| Frontend | React + Vite | 18.2.0 / 5.0.8 |
| PDF (Texto) | pdfjs-dist | 4.0.379 |
| OCR (Scaneado) | Tesseract.js | 5.0.4 |
| Planilha | xlsx | 0.18.5 |
| Container | Docker + Compose | Latest |
| Upload | Multer | 1.4.5 |

---

## 🏗️ Arquitetura

### Componentes Principais

```
┌─────────────────────────────────────────────────────────┐
│                    Frontend (React)                     │
│  • Upload.jsx: Seleção tipo + escolha PDF               │
│  • Review.jsx: Exibição, edição, download              │
│  • Polling: Consulta status a cada 1s                  │
└──────────────────────┬──────────────────────────────────┘
                       │
              POST /api/transcricoes
              GET /api/transcricoes/:id
              PUT /api/transcricoes/:id
              GET /api/transcricoes/:id/planilha
                       │
┌──────────────────────▼──────────────────────────────────┐
│              Backend (Express.js)                       │
│  ┌─────────────────────────────────────────────────┐   │
│  │ API Routes (routes.js)                          │   │
│  │ • Validação MIME + magic bytes                  │   │
│  │ • Resposta 202 com ID imediato                 │   │
│  │ • Transformação para Excel/CSV                 │   │
│  └──────────────────┬────────────────────────────┘   │
│                     │                                │
│  ┌──────────────────▼────────────────────────────┐   │
│  │ transcriptionService.js                        │   │
│  │ • Extração de texto (PDF.js)                  │   │
│  │ • Detecção PDF escaneado                      │   │
│  │ • OCR com Tesseract (fallback)                │   │
│  │ • Parsing (cartaoPonto / holerite)            │   │
│  └──────────────────┬────────────────────────────┘   │
│                     │                                │
│  ┌──────────────────▼────────────────────────────┐   │
│  │ Stores + Parsers                               │   │
│  │ • transcriptionStore: Map<id, data>           │   │
│  │ • parsers: Regex-based extraction             │   │
│  │ • Auto-cleanup: 5 minutos                     │   │
│  └────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

### Pipeline de Processamento

```
PDF Upload
    ↓
[Validação MIME + Magic Bytes]
    ↓ (202 ACCEPTED, ID retornado)
[Background Job Iniciado]
    ↓
[Extração de Texto (PDF.js)]
    ├─→ Texto encontrado (> 50 char) → Parsing direto
    └─→ Texto vazio (< 50 char) → OCR com Tesseract
    ↓
[Parser específico (cartaoPonto ou holerite)]
    ├─→ Extração de estrutura com Regex
    ├─→ Validação de sequência
    └─→ Cálculo de alertas
    ↓
[Armazenamento em memória]
    ├─→ Timestamp + lastAccessed
    ├─→ Auto-limpeza em 5 minutos
    └─→ Acessível por ID
    ↓
[Pronto para download/edição]
```

---

## 📝 Endpoints da API

### 1. Health Check
```
GET /healthz
→ 200 OK { "status": "ok", "timestamp": "2024-01-15T..." }
```

### 2. Upload PDF
```
POST /api/transcricoes
Content-Type: multipart/form-data

{
  "arquivo": <file.pdf>,
  "tipo": "cartao-ponto" | "holerite"
}

→ 202 ACCEPTED
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "tipo": "cartao-ponto",
  "message": "Processamento iniciado"
}

Erros possíveis:
• 400: MIME type inválido ou tipo de documento desconhecido
• 413: Arquivo > 50MB
• 422: Arquivo não é PDF válido
```

### 3. Consultar Status
```
GET /api/transcricoes/:id

→ 200 OK
{
  "id": "550e8400-...",
  "tipo": "cartao-ponto",
  "status": "processando" | "concluido" | "erro",
  "value": {
    "pages": [
      {
        "page": 1,
        "days": [
          {
            "date_raw": "21/05/2019",
            "punches": [
              { "kind": "IN", "time_raw": "08:25", "time_hhmm": "08:25" },
              { "kind": "OUT", "time_raw": "18:25", "time_hhmm": "18:25" }
            ]
          }
        ]
      }
    ]
  },
  "error": null
}

→ 404 Not Found (transcrição expirou após 5 min)
```

### 4. Editar Transcrição
```
PUT /api/transcricoes/:id
Content-Type: application/json

{
  "value": {
    "pages": [
      {
        "page": 1,
        "days": [ ... ]  // JSON modificado pelo usuário
      }
    ]
  }
}

→ 200 OK { ... mesmo formato do GET ... }

Erros possíveis:
• 404: Transcrição não encontrada
• 400: JSON inválido
```

### 5. Download Planilha
```
GET /api/transcricoes/:id/planilha?formato=xlsx|csv|json

Resposta:
• formato=xlsx: application/vnd.openxmlformats-officedocument...
  - Excel com 2 abas (Transcrição + JSON Raw)
  - Cores de alerta: 
    * Amarelo (#FFF3CD): Incerteza (?)
    * Vermelho (#F8D7DA): Erro (datas não-sequenciais, batidas ímpares)
  - Header com fundo azul

• formato=csv: text/csv
  - Dados tabulares separados por vírgula
  - Coluna 'alert' com null | 'warning' | 'error'

• formato=json: application/json
  - Estrutura completa com todos os dados
  - Inclui campo 'alert' por linha
```

---

## 💾 Estrutura de Dados

### Cartão de Ponto
```json
{
  "pages": [
    {
      "page": 1,
      "days": [
        {
          "date_raw": "21/05/2019",
          "punches": [
            { "kind": "IN", "time_raw": "08:25", "time_hhmm": "08:25" },
            { "kind": "OUT", "time_raw": "18:25", "time_hhmm": "18:25" }
          ]
        }
      ]
    }
  ]
}
```

**Transformação para Planilha:**
| Data | Entrada 1 | Saída 1 | Entrada 2 | Saída 2 | Alerta |
|---|---|---|---|---|---|
| 21/05/2019 | 08:25 | 18:25 | - | - | ✓ (verde) |
| 22/05/2019 | 09:00 | 17:30 | 12:00 | 13:00 | ⚠️ (amarelo) |

**Alertas calculados:**
- ❌ Batidas ímpares: `punches.length % 2 !== 0`
- ❌ Datas não-sequenciais: Gap entre dias

### Holerite
```json
{
  "pages": [
    {
      "page": 1,
      "year": 2020,
      "month": 1,
      "fields": [
        {
          "code": "0010",
          "label": "Salário Base",
          "reference": "220,00",
          "value": "2.389,77"
        }
      ],
      "bases": [
        { "label": "Base INSS", "value": "2.545,68" },
        { "label": "Valor Líquido", "value": "2.282,81" }
      ]
    }
  ]
}
```

**Transformação para Planilha:**
| Pág. | Mês | Ano | 0010 Salário | 5560 Extras | Base INSS | Total | Líquido |
|---|---|---|---|---|---|---|---|
| 1 | 1 | 2020 | 2.389,77 | 155,91 | 2.545,68 | 2.545,68 | 2.282,81 |

**Alertas calculados:**
- ⚠️ Página vazia: `fields.length === 0`
- ❌ Mês não-sequencial: Dec→Jan não é próximo

---

## 🔧 Configuração & Deployment

### Variáveis de Ambiente (.env)
```
# Backend
PORT=3000
NODE_ENV=production
RETENTION_MS=300000          # 5 minutos, transcrições auto-deletadas

# Frontend (gerenciado pelo Vite)
VITE_API_URL=http://localhost:3000
```

### Docker Compose
```bash
docker compose up -d

# Serviços:
# • backend:3000 (Node.js + API)
# • frontend:80 (Nginx + React SPA)
# • quick-filler-network (rede Docker)

# Health checks:
curl http://localhost:3000/healthz
curl http://localhost:5173/
```

### Build Local
```bash
# Backend
cd backend && npm install && npm run dev

# Frontend (nova aba)
cd frontend && npm install && npm run dev

# Acesso:
# API: http://localhost:3000
# UI: http://localhost:5173
```

---

## 📊 Decisões de Design

### 1. Resposta 202 Imediata
**Decisão:** Retornar 202 ACCEPTED com ID imediatamente, sem aguardar processamento.

**Motivo:**
- OCR pode demorar até 60s por página
- Timeout HTTP típico é 30s
- Frontend faz polling com timeout maior

**Implementação:**
```javascript
export function createTranscription(pdfBuffer, tipo) {
  const id = uuidv4();
  transcriptionStore.set(id, { status: 'processando', ... });
  processTranscription(id, pdfBuffer, tipo).catch(err => ...);
  return id;
}
```

### 2. Detecção Automática de OCR
**Decisão:** Se PDF tem < 50 caracteres de texto, considerar escaneado e aplicar OCR.

**Motivo:**
- PDFs nativos têm sempre > 100 caracteres por página
- Threshold 50 é conservador
- Evita OCR desnecessário em PDFs com pouco texto

**Implementação:**
```javascript
const isEmpty = text.trim().length < 50;
if (isEmpty) {
  page.text = await ocrPageText(page.pageNum, text);
  page.source = 'ocr';
}
```

### 3. Pool de Workers Tesseract
**Decisão:** Manter 3 workers Tesseract simultâneos em memória.

**Motivo:**
- Inicializar Tesseract custa ~3s
- Reutilizar workers evita 3s por cada PDF
- 3 workers é balance entre performance e memória (~100MB × 3)

**Implementação:**
```javascript
const WORKER_POOL_SIZE = 3;
async function initTesseractPool() {
  for (let i = 0; i < WORKER_POOL_SIZE; i++) {
    const worker = Tesseract.createWorker(...);
    await worker.load();
    tesseractWorkers.push({ instance: worker, busy: false });
  }
}
```

### 4. Armazenamento em Memória com Limpeza
**Decisão:** Store transcrições em Map<id, data> com auto-cleanup em 5 minutos.

**Motivo:**
- Simples, sem dependência de banco de dados
- 5 minutos é tempo suficiente para download
- Auto-cleanup evita vazamento de memória

**Implementação:**
```javascript
cleanup() {
  const now = Date.now();
  for (const [id, trans] of this.store) {
    if (now - trans.lastAccessed > this.retentionMs) {
      this.store.delete(id);
    }
  }
}
// Executar a cada 60s
setInterval(() => transcriptionStore.cleanup(), 60000);
```

### 5. Cores de Alerta em Planilha
**Decisão:** Amarelo (#FFF3CD) para avisos, vermelho (#F8D7DA) para erros.

**Motivo:**
- Padrão Bootstrap, familiar
- Vermelho = bloqueante (datas inválidas)
- Amarelo = requer atenção (batidas ímpares)

**Implementação:**
```javascript
const alertColor = alert === 'error' 
  ? { fill: { fgColor: { rgb: 'FFF8D7DA' } } }
  : { fill: { fgColor: { rgb: 'FFFFF3CD' } } };
```

### 6. Parsing com Regex (Não Machine Learning)
**Decisão:** Usar Regex para extrair dados estruturados, não OCR direto.

**Motivo:**
- Regex é 100% determinístico
- PDFs trabalhistas têm formato consistente
- Evita complexidade ML, custo computacional
- Se texto foi extraído (PDF nativo), parsing com Regex é O(1)

**Implementação:**
```javascript
// Cartão: Regex para datas e horários
const dateRegex = /(\d{1,2})[/\-.](\d{1,2})[/\-.](\ d{4})/g;
const timeRegex = /(\d{1,2}):?(\d{2})/g;

// Holerite: Regex para campos (código, label, valor)
const fieldRegex = /(\d{4})\s+([^\d]+?)\s+([0-9.,\s]+?)/g;
```

---

## ⏱️ Limites & Timeouts

| Limite | Valor | Motivo |
|---|---|---|
| Tamanho máximo PDF | 50MB | Memória do servidor |
| Timeout OCR por página | 60s | Tesseract pode ser lento |
| Timeout total processamento | 10 min | Máximo 10 páginas × 60s |
| Retenção de dados | 5 min | Suficiente para download |
| Pool de workers Tesseract | 3 | Balance memória/throughput |
| Polling frontend | 1s | Responsividade UX |

---

## 🚀 Performance

### Benchmarks Esperados

| Operação | Tempo |
|---|---|
| Upload (validação) | < 100ms |
| Extração PDF (50 pgs com texto) | 5-10s |
| OCR (1 página) | 30-60s |
| Parsing | < 1s |
| Geração Excel | 1-2s |
| **Total (melhor caso)** | < 15s |
| **Total (OCR necessário)** | 1-3 min |

### Limites de Memória

```
Base: 150MB (Node + dependências)
+ Pool Tesseract: 100MB × 3 = 300MB
+ PDFs em processamento: 50MB × 2 = 100MB
─────────────────────────────────────
Total: ~550MB ideal, 750MB máximo
```

---

## 📱 Frontend

### Fluxo de Usuário

1. **Upload** (`/`)
   - Selecionar tipo: cartão-ponto ou holerite
   - Escolher arquivo PDF (< 50MB, tipo application/pdf)
   - Clicar "Enviar"

2. **Processamento** (spinner com status)
   - Frontend faz polling a cada 1s
   - Mostra "Processando..." enquanto status = processando

3. **Review** (`/review/:id`)
   - Exibir JSON em tabela
   - Opção de editar células
   - Botão "Salvar" (PUT)
   - Seção de download (xlsx/csv/json)

4. **Download**
   - Selecionar formato
   - Clicar botão
   - Arquivo é baixado

### Componentes React

```
App.jsx (root + routing)
  ├─ Upload.jsx (form tipo + arquivo)
  ├─ Review.jsx (tabela + edição + download)
  └─ Context (estado compartilhado)

Estilos:
  ├─ App.css (header, footer, layout)
  ├─ Upload.css (form styling)
  └─ Review.css (tabela, botões, spinner)
```

---

## 🔐 Segurança

| Medida | Implementação |
|---|---|
| MIME type validation | `multer.fileFilter()` |
| Magic bytes check | Verifica %PDF header |
| Tamanho máximo | 50MB no multer |
| CORS | Apenas localhost (dev) ou domínio específico |
| JSON validation | `typeof value.pages === 'Array'` |
| Timeout OCR | 60s por página, 10min total |
| Limpeza dados | Auto-delete em 5 min |
| Logs | Apenas informações não-sensíveis |

---

## 📚 Stack Específico

### Backend

**express.js 4.18.2**
- Roteamento HTTP
- Middleware de upload (multer)
- CORS
- Error handler

**pdfjs-dist 4.0.379**
- Extração de texto nativo
- Renderização (se necessário)

**tesseract.js 5.0.4**
- OCR em JavaScript puro
- Suporte português
- Pool de workers

**xlsx 0.18.5**
- Geração de Excel com cores
- Export CSV/JSON

**uuid 9.0.1**
- IDs únicos para transcrições

**dotenv 16.3.1**
- Variáveis de ambiente

### Frontend

**react 18.2.0**
- Components, hooks, context

**react-router-dom 6.20.0**
- Navegação entre pages

**vite 5.0.8**
- Build + hot reload

**axios** (se usado, não está implementado)
- Já usando `fetch()` nativo

---

## ✅ Testes

Veja [TESTES.md](TESTES.md) para:
- Testes unitários (npm test)
- Testes de integração (curl / postman)
- Teste automatizado (test-api.sh)
- Critérios de aceição

---

## 🚀 Próximas Melhorias

1. **Banco de dados**: PostgreSQL em vez de in-memory
2. **Autenticação**: JWT para multi-user
3. **Storage**: S3 para PDFs subidos
4. **ML**: Treinamento de modelo para detecção automática de tipo
5. **Validação avançada**: Verificação de CNPJ, CPF, consistência com eSocial
6. **Webhooks**: Notificar quando processamento termina
7. **Histórico**: Manter registro de edições
8. **Exportação**: Integração com eSocial, Folha de pagamento

---

## 📞 Suporte

**Problemas comuns:**

1. "Connection refused" → Backend não está rodando (`npm run dev` ou Docker)
2. "PDF corrompido" → Validar magic bytes, usar PDF real
3. "OCR muito lento" → Aumentar WORKER_POOL_SIZE ou reduzir escala
4. "Transcrição expirou" → Download em < 5 minutos após processamento

Logs: `npm run dev` (backend) e `npm run dev` (frontend)

---

**Versão:** 1.0.0  
**Data:** 2024-01-15  
**Autor:** IA Quick Filler
