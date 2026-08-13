# Guia de Testes — Quick Filler

## 🧪 Testes Unitários

### Parsers

```bash
cd backend
npm test
```

Testes incluem:
- ✅ Parser Cartão de Ponto: data válida, inválida, batidas ímpares
- ✅ Parser Holerite: competência, separação fields/bases

---

## 🔗 Testes de Integração (API)

### 1. Health Check

```bash
curl http://localhost:3000/healthz
```

Resposta esperada:
```json
{ "status": "ok", "timestamp": "..." }
```

### 2. Upload de PDF

```bash
curl -X POST http://localhost:3000/api/transcricoes \
  -F "arquivo=@exemplos/cartao-ponto-1.pdf" \
  -F "tipo=cartao-ponto"
```

Resposta (202 Accepted):
```json
{
  "id": "abc123-def456",
  "tipo": "cartao-ponto",
  "message": "Processamento iniciado"
}
```

### 3. Polling (acompanhar progresso)

```bash
curl http://localhost:3000/api/transcricoes/{id}
```

Enquanto processa:
```json
{
  "id": "abc123",
  "tipo": "cartao-ponto",
  "status": "processando",
  "error": null,
  "value": null
}
```

Após concluir:
```json
{
  "id": "abc123",
  "tipo": "cartao-ponto",
  "status": "concluido",
  "error": null,
  "value": { "pages": [ ... ] }
}
```

### 4. Editar Transcrição

```bash
curl -X PUT http://localhost:3000/api/transcricoes/{id} \
  -H "Content-Type: application/json" \
  -d '{
    "value": {
      "pages": [ ... ]  # JSON modificado
    }
  }'
```

### 5. Download Planilha

```bash
# Excel (padrão)
curl "http://localhost:3000/api/transcricoes/{id}/planilha?formato=xlsx" \
  -o transcricao.xlsx

# CSV
curl "http://localhost:3000/api/transcricoes/{id}/planilha?formato=csv" \
  -o transcricao.csv

# JSON
curl "http://localhost:3000/api/transcricoes/{id}/planilha?formato=json" \
  -o transcricao.json
```

---

## 🚀 Teste Automatizado

```bash
chmod +x test-api.sh
./test-api.sh
```

Script realiza:
1. Health check
2. Upload PDF
3. Polling até conclusão
4. Exibe resultado
5. Download em 3 formatos

---

## 🌐 Teste no Frontend (Manual)

1. Abrir `http://localhost:5173` no navegador
2. Cliar em "Selecione o PDF" e escolher arquivo
3. Selecionar tipo de documento
4. Clicar "Enviar"
5. Aguardar processamento (spinner)
6. Revisar dados na tabela
7. Editar se necessário
8. Baixar em Excel/CSV/JSON

---

## 📊 Teste com PDFs Fictícios

Como gerar PDFs de teste sem exemplos reais:

```bash
# Criar PDF fictício com Python
python3 << 'EOF'
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import letter

# Cartão de Ponto
c = canvas.Canvas("exemplos/cartao-ponto-fake.pdf", pagesize=letter)
c.drawString(100, 750, "CARTÃO DE PONTO - FAKE")
c.drawString(100, 700, "21/05/2019  08:25  18:25")
c.drawString(100, 680, "22/05/2019  09:00  17:30  12:00  13:00")
c.drawString(100, 660, "23/05/2019  08:15  17:45")
c.save()

# Holerite
c = canvas.Canvas("exemplos/holerite-fake.pdf", pagesize=letter)
c.drawString(100, 750, "HOLERITE - FAKE")
c.drawString(100, 700, "Competência: 01/2020")
c.drawString(100, 680, "0010 Salário Base 2.389,77")
c.drawString(100, 660, "5560 Horas Extras - 50% 155,91")
c.drawString(100, 640, "Base INSS 2.545,68")
c.drawString(100, 620, "Valor Líquido 2.282,81")
c.save()
EOF
```

Ou usar exemplos do repositório quando disponíveis em `exemplos/`.

---

## ✅ Critérios de Teste

| Teste | Esperado | Status |
|---|---|---|
| Health check retorna 200 | ✅ | - |
| Upload retorna 202 + ID | ✅ | - |
| Polling muda status | ✅ | - |
| JSON tem estrutura correta | ✅ | - |
| Excel tem cores de alerta | ✅ | - |
| CSV é válido | ✅ | - |
| Edição atualiza dados | ✅ | - |
| OCR funciona (se PDF escaneado) | 🚧 | Testado |

---

## 🐛 Troubleshooting

### "Connection refused" na porta 3000
```bash
lsof -i :3000
# Deve listar node ou docker
```

### "PDF corrompido" no upload
```bash
# Validar magic bytes (%PDF)
hexdump -C arquivo.pdf | head
# Deve mostrar: 25 50 44 46 (= %PDF)
```

### OCR muito lento
- Pool de workers é 3, aumentar em `transcriptionService.js`
- Ou reduzir qualidade do PDF em `pdfjs` (scale 1.0 em vez de 2.0)

### Planilha sem cores
- Validar que `rows` contém `{ data: [...], alert: ... }`
- Validar que `alert` é `'warning'` ou `'error'`

---

## 📈 Métricas de Performance

Tempo esperado (por etapa):
- Upload (validação): < 100ms
- Extração de texto: 1-5s (PDF com texto)
- OCR (se necessário): 30-60s por página
- Parsing: < 1s
- **Total**: < 10 min (timeout)

Memória:
- Backend: ~150MB base + pool Tesseract (~100MB por worker)
- Frontend: ~50MB

---

## 🔍 Logs Úteis

Backend:
```
npm run dev
# Mostra: "🚀 Backend rodando...", "📄 Processando...", etc
```

Frontend (DevTools):
```
F12 → Console
# Mostra: "Upload iniciado", "Polling status", etc
```

Docker:
```bash
docker compose logs -f backend
docker compose logs -f frontend
```
