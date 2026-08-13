# Quick Filler — Setup & Execução

## Pré-requisitos

- Node.js 22+ e npm
- Docker e Docker Compose
- Um navegador moderno (Chrome, Firefox, Safari, Edge)

## Instalação Local (Desenvolvimento)

### Backend

```bash
cd backend
npm install
npm run dev
```

Servidor roda em `http://localhost:3000`

### Frontend

Em outro terminal:

```bash
cd frontend
npm install
npm run dev
```

App roda em `http://localhost:5173`

## Usando Docker Compose (Produção)

```bash
docker compose build
docker compose up
```

- Backend: `http://localhost:3000`
- Frontend: `http://localhost:5173`
- Health check: `http://localhost:3000/healthz`

## Testes

### Testes de Parsers

```bash
cd backend
npm test
```

### Teste Manual da API

```bash
# Health check
curl http://localhost:3000/healthz

# Upload de PDF
curl -X POST http://localhost:3000/api/transcricoes \
  -F "arquivo=@exemplos/cartao-ponto-1.pdf" \
  -F "tipo=cartao-ponto"

# Verificar status (substitua {id} pelo ID retornado)
curl http://localhost:3000/api/transcricoes/{id}

# Download planilha
curl "http://localhost:3000/api/transcricoes/{id}/planilha?formato=xlsx" \
  -o transcricao.xlsx
```

## Estrutura do Projeto

```
.
├── backend/
│   ├── src/
│   │   ├── server.js              # Entrypoint
│   │   ├── api/routes.js          # Endpoints HTTP
│   │   ├── services/              # Lógica de negócio
│   │   ├── parsers/               # Cartão de Ponto e Holerite
│   │   ├── store/                 # Store em memória
│   │   └── middleware/            # Multer, validação
│   ├── Dockerfile
│   └── package.json
│
├── frontend/
│   ├── src/
│   │   ├── pages/                 # Upload e Review
│   │   ├── styles/                # CSS
│   │   ├── App.jsx                # App principal
│   │   └── main.jsx               # Entry React
│   ├── Dockerfile
│   ├── nginx.conf
│   ├── vite.config.js
│   └── package.json
│
├── docker-compose.yml
├── .env                           # Variáveis de ambiente
└── plano.md                       # Plano do projeto
```

## Status de Implementação

### ✅ Completo
- Estrutura backend/frontend
- Endpoints HTTP (POST, GET, PUT, planilha)
- Parsers Cartão de Ponto e Holerite (básico)
- Store em memória com cleanup
- UI de upload e revisão
- Transformação em Excel/CSV/JSON com cores de alerta
- Docker e Docker Compose

### 🚧 Em Progresso
- OCR com Tesseract.js (para PDFs escaneados)
- Testes automatizados
- Melhorias de precisão nos parsers

### 📋 TODO
- Rastreabilidade visual (clicar célula → destacar PDF)
- Detecção automática de tipo
- Ficha financeira (holerite anual)

## Variáveis de Ambiente

Ver `.env.example` para template completo.

**Principais:**
- `PORT` — Porta do backend (padrão: 3000)
- `NODE_ENV` — development | production
- `RETENTION_MS` — Tempo de retenção de transcrições em ms (padrão: 300000 = 5 min)

## Troubleshooting

### "Port 3000 is already in use"
```bash
lsof -i :3000
kill -9 <PID>
```

### "Cannot find module 'express'"
```bash
cd backend && npm install
cd ../frontend && npm install
```

### Docker build falha
```bash
docker compose down
docker system prune -a
docker compose up --build
```

## Documentação Completa

Veja também:
- [plano.md](plano.md) — Plano executivo com todas as 8 fases
- [README.md](README.md) — Especificação técnica do desafio
- [INSTRUCOES.md](INSTRUCOES.md) — Instruções para candidato
