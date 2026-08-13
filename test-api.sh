#!/bin/bash

# Script de teste da API Quick Filler
# Testa o ciclo completo: upload → polling → download

echo "🧪 Teste da API Quick Filler"
echo "============================="

BACKEND_URL="http://localhost:3000"
TEST_ARQUIVO="exemplos/cartao-ponto-1.pdf"  # ou holerite-1.pdf
TIPO="cartao-ponto"  # ou "holerite"

# 1. Health check
echo ""
echo "1️⃣  Health Check..."
curl -s "$BACKEND_URL/healthz" | jq '.' || echo "❌ Backend não está respondendo"

# 2. Enviar PDF
echo ""
echo "2️⃣  Enviando PDF ($TIPO)..."
RESPONSE=$(curl -s -X POST "$BACKEND_URL/api/transcricoes" \
  -F "arquivo=@$TEST_ARQUIVO" \
  -F "tipo=$TIPO")

echo "$RESPONSE" | jq '.'

ID=$(echo "$RESPONSE" | jq -r '.id')
echo "ID da transcrição: $ID"

if [ "$ID" = "null" ] || [ -z "$ID" ]; then
  echo "❌ Erro ao enviar PDF"
  exit 1
fi

# 3. Polling - aguardar conclusão
echo ""
echo "3️⃣  Aguardando processamento..."
STATUS="processando"
COUNTER=0

while [ "$STATUS" = "processando" ] && [ $COUNTER -lt 300 ]; do
  sleep 1
  RESPONSE=$(curl -s "$BACKEND_URL/api/transcricoes/$ID")
  STATUS=$(echo "$RESPONSE" | jq -r '.status')
  
  echo "  Status: $STATUS"
  COUNTER=$((COUNTER + 1))
done

if [ "$STATUS" != "concluido" ]; then
  echo "❌ Processamento falhou ou expirou"
  echo "$RESPONSE" | jq '.'
  exit 1
fi

echo "✅ Processamento concluído!"

# 4. Exibir resultado
echo ""
echo "4️⃣  Resultado da transcrição:"
echo "$RESPONSE" | jq '.value'

# 5. Download em diferentes formatos
echo ""
echo "5️⃣  Baixando planilha em diferentes formatos..."

for FORMATO in xlsx csv json; do
  echo "  Formato: $FORMATO"
  curl -s "$BACKEND_URL/api/transcricoes/$ID/planilha?formato=$FORMATO" \
    -o "transcricao.$FORMATO"
  
  if [ -f "transcricao.$FORMATO" ]; then
    SIZE=$(ls -lh "transcricao.$FORMATO" | awk '{print $5}')
    echo "  ✅ Baixado: transcricao.$FORMATO ($SIZE)"
  fi
done

echo ""
echo "✅ Teste completo!"
