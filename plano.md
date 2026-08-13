# Plan: Quick Filler — Backend Express + Frontend Vite+React

## TL;DR
Construir uma aplicação full-stack que transcreve PDFs de documentos trabalhistas (cartão de ponto e holerite) em planilhas editáveis. **Um pipeline compartilhado** entre upload, processamento, revisão e download para ambos os tipos. Backend Express com processamento assíncrono + OCR via Tesseract.js; frontend Vite+React com tabela editável e PDF side-by-side. Tudo em memória durante o ciclo.
---

## Arquitetura

| Componente | Tecnologia | Responsabilidade |
|---|---|---|
| **Backend** | Express + Node.js | HTTP API, orquestração, OCR, parsing |
| **Frontend** | Vite + React | Upload, revisão (tabela editável), download |
| **Persistência** | Em memória | Store `Map<id, transcrição>`, limpeza a cada 5 min |
| **OCR** | Tesseract.js | PDFs escaneados (sem camada de texto) |
| **PDF Parsing** | pdfjs-dist | Extração de texto embutido |
| **Planilhas** | xlsx library | Export para .xlsx/.csv/.json |

**Crítico**: Um pipeline (envio, fila, revisão, download) compartilhado entre cartão e holerite. Apenas o parser e a forma da planilha mudam.

---

## Fases (8 etapas)

### 1️⃣ **Setup e Estrutura** 
- Backend Express: rotas, store em memória, cleanup automático
- Frontend Vite+React: Context + Router, layout grid (PDF | Tabela)
- Docker: compose.yml com ambos serviços
- ✅ Verif.: `docker compose up` sem erros, `GET /healthz 200`

### 2️⃣ **Pipeline Assíncrono**
- `POST /api/transcricoes` → 202 (enfileira, não aguarda)
- `GET /api/transcricoes/:id` → polling (processando → concluido)
- `PUT /api/transcricoes/:id` → edição
- `GET .../planilha?formato=xlsx|csv|json` → download
- Frontend: progresso, tabela, download
- ✅ Verif.: Upload entra em fila, tabela carrega, download funciona

### 3️⃣ **Parser — Cartão de Ponto**
- Extração de data, batidas (IN/OUT), validação
- `date_raw`, `time_raw`, `time_hhmm` normalizados
- Marcação de `?` para incerteza
- Avisos calculados (batidas ímpares, data não-sequencial)
- ✅ Verif.: Testes com exemplos, casos de válido/inválido

### 4️⃣ **Parser — Holerite**
- Detecção de competência (year, month)
- Separação crítica: `fields` (verbas) vs `bases` (INSS, Total, Líquido)
- Valores como string (formato original)
- Avisos calculados (página vazia, mês não-sequencial)
- ✅ Verif.: Testes com exemplos, `fields` ≠ `bases`

### 5️⃣ **OCR e Processamento**
- PDF sem camada de texto → Tesseract.js
- Pool de 3 workers para não travar
- Timeout em 10 min
- Integração com parsers
- ✅ Verif.: PDF escaneado processado, tempo < 10 min

### 6️⃣ **Interface de Revisão** 
- Tabela editável (colunas dinâmicas por tipo)
- PDF lado esquerdo, navegação por página
- Destaques: amarelo para `?`, vermelho para não-sequencial
- Botão "Salvar" → `PUT`, "Baixar" → download com cores
- ✅ Verif.: Editar célula, salvar, cores aplicadas, download OK

### 7️⃣ **Docker + Deployment**
- `Dockerfile` backend + frontend (nginx SPA)
- Publicar em plataforma free (Railway/Render)
- `.env.example` com configuração
- ✅ Verif.: URL publicada abre, fluxo completo funciona

### 8️⃣ **Documentação + Testes**
- `SOLUCAO.md`: stack, decisões, retenção (5 min), limites (50MB)
- `PROCESSO.md`: IA usada, 3 erros/correções, 3 decisões com trade-offs, fraquezas
- Testes mínimos: parsers (casos críticos), API (202, 200, 400)
- CI mínima (GitHub Actions: lint + test)
- ✅ Verif.: Documentos preenchidos, `npm test` passa

---

## Arquivos Críticos

**Backend**
- `backend/src/server.js` — Configuração Express
- `backend/src/services/transcriptionService.js` — Orquestração (PDF → texto/OCR → parser → JSON)
- `backend/src/parsers/cartaoPonto.js`, `holerite.js` — Lógica de extração
- `backend/src/store/transcriptionStore.js` — `Map<id, transcrição>` com cleanup
- `backend/src/middleware/upload.js` — Multer, validação

**Frontend**
- `frontend/src/App.jsx` — Router, state global (Context)
- `frontend/src/pages/Upload.jsx` — Form + polling
- `frontend/src/pages/Review.jsx` — Tabela + PDF + download
- `frontend/src/utils/spreadsheet.js` — Transformação JSON → planilha com cores
- `frontend/src/components/DataTable.jsx` — Tabela editável

**DevOps**
- `docker-compose.yml`, `backend/Dockerfile`, `frontend/Dockerfile`
- `.env.example`

---

## Decisões Técnicas

| Decisão | Por quê | Alternativa rejeitada |
|---|---|---|
| Em memória | Ciclo curto, sem persistência entre sessões | PostgreSQL/SQLite (overhead) |
| Tesseract.js | Open-source, sem credenciais, custa 0 | Google Vision (requer API key + custo) |
| Um pipeline | Código DRY, arquitetura limpa | Dois pipelines (dobra código) |
| OCR sob demanda | Só se texto vazio (reduz overhead) | OCR sempre (lento) |
| Vite | Rápido, moderno, hot reload | CRA (mais lento) |

---

## Verificação por Fase

1. **Estrutura**: `docker compose up` sobe ambos, `GET /healthz 200`
2. **HTTP**: `POST /api/transcricoes` → 202, polling funciona, download blob
3. **Cartão**: Parser retorna JSON válido, `?` em incerteza, avisos calculados
4. **Holerite**: `fields` ≠ `bases`, valores como string, múltiplas páginas OK
5. **OCR**: PDF escaneado processado em < 10 min, worker pool não congela
6. **Interface**: Editar → salvar → `PUT` OK, cores aplicadas no .xlsx
7. **Deploy**: URL publicada abre, fluxo completo funciona
8. **Docs**: `SOLUCAO.md` + `PROCESSO.md` preenchidos, testes passam

---

## Tempo Realista

| Fase | Tempo | Crítico |
|---|---|---|
| 1. Setup | ✅ Sim (bloqueia tudo) |
| 2. Pipeline HTTP | ✅ Sim (bloqueia 3-6) |
| 3. Parser cartão | ✅ Sim (50% precisão) |
| 4. Parser holerite | ✅ Sim (50% precisão) |
| 5. OCR | ✅ Sim (docs escaneados) |
| 6. Interface | ⚠️ Não (pode simplificar) |
| 7. Docker + deploy | ✅ Sim (requisito) |
| 8. Docs + testes | ⚠️ Não (pode cortar) |
| **Margem** | — |

**Se estourar**: Corte Fase 8 (testes) → docs mínimas. **Nunca corte** 1, 2, 3-5, 7 (bloqueadores ou críticos na avaliação).

---

## Próximos Passos

✅ **Plano aprovado?** Começar pela Fase 1 (Setup).
🚀 **Pronto para implementar?** Dizemos "go" e iniciamos.