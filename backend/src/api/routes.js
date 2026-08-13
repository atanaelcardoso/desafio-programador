import express from 'express';
import {
  upload,
  validatePdfMagicBytes,
  validateDocumentType,
  handleMulterError
} from '../middleware/upload.js';
import {
  createTranscription,
  getTranscription,
  updateTranscription
} from '../services/transcriptionService.js';
import { transcriptionStore } from '../store/transcriptionStore.js';
import * as XLSX from 'xlsx';

const router = express.Router();

/**
 * POST /api/transcricoes
 * Enviar PDF para processamento
 * 
 * Multipart form-data:
 * - arquivo: file
 * - tipo: 'cartao-ponto' | 'holerite'
 * 
 * Response: 202 Accepted
 * { "id": "uuid" }
 */
router.post(
  '/transcricoes',
  upload.single('arquivo'),
  handleMulterError,
  validatePdfMagicBytes,
  validateDocumentType,
  (req, res) => {
    try {
      const { tipo } = req.body;
      const { buffer } = req.file;

      const id = createTranscription(buffer, tipo);

      res.status(202).json({
        id,
        tipo,
        message: 'Processamento iniciado'
      });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  }
);

/**
 * GET /api/transcricoes/:id
 * Obter status e resultado da transcrição
 * 
 * Response: 200 OK
 * {
 *   "id": "uuid",
 *   "tipo": "cartao-ponto",
 *   "status": "concluido",
 *   "erro": null,
 *   "value": { ... }
 * }
 */
router.get('/transcricoes/:id', (req, res) => {
  try {
    const { id } = req.params;
    const trans = getTranscription(id);

    if (!trans) {
      return res.status(404).json({ error: 'Transcrição não encontrada' });
    }

    res.json({
      id: trans.id,
      tipo: trans.tipo,
      status: trans.status,
      error: trans.error,
      value: trans.value
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * PUT /api/transcricoes/:id
 * Atualizar transcrição (correções do usuário)
 * 
 * Body: { "value": { pages: [...] } }
 * 
 * Response: 200 OK
 * { "id": "uuid", ... }
 */
router.put('/transcricoes/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { value } = req.body;

    const updated = updateTranscription(id, value);

    res.json({
      id: updated.id,
      tipo: updated.tipo,
      status: updated.status,
      value: updated.value
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * GET /api/transcricoes/:id/planilha
 * Baixar transcrição como planilha
 * 
 * Query: ?formato=xlsx|csv|json
 * 
 * Response: arquivo binário ou JSON
 */
router.get('/transcricoes/:id/planilha', (req, res) => {
  try {
    const { id } = req.params;
    const { formato = 'xlsx' } = req.query;

    const trans = getTranscription(id);
    if (!trans) {
      return res.status(404).json({ error: 'Transcrição não encontrada' });
    }

    if (trans.status !== 'concluido') {
      return res.status(400).json({
        error: 'Transcrição ainda não está pronta',
        status: trans.status
      });
    }

    // Transformar em planilha (com alertas)
    const rows = transformToSpreadsheet(trans);

    if (formato === 'json') {
      // Retornar JSON com dados brutos
      res.json({ data: rows });
    } else if (formato === 'csv') {
      const csv = rowsToCSV(rows.map(r => r.data));
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="transcricao-${id}.csv"`);
      res.send(csv);
    } else if (formato === 'xlsx') {
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.aoa_to_sheet(rows.map(r => r.data));
      
      // Aplicar estilos: cabeçalho + alertas
      const headerStyle = {
        fill: { fgColor: { rgb: 'FF173772' } },
        font: { bold: true, color: { rgb: 'FFFFFFFF' } }
      };
      
      const warningStyle = {
        fill: { fgColor: { rgb: 'FFFFF3CD' } }
      };

      const errorStyle = {
        fill: { fgColor: { rgb: 'FFF8D7DA' } },
        border: {
          left: { style: 'thin', color: { rgb: 'FFDC3545' } }
        }
      };

      // Aplicar estilos por linha
      for (let rowIdx = 0; rowIdx < rows.length; rowIdx++) {
        const row = rows[rowIdx];
        let style = rowIdx === 0 ? headerStyle : null;

        if (rowIdx > 0) {
          if (row.alert === 'error') {
            style = errorStyle;
          } else if (row.alert === 'warning') {
            style = warningStyle;
          }
        }

        if (style) {
          for (let colIdx = 0; colIdx < row.data.length; colIdx++) {
            const cellRef = XLSX.utils.encode_cell({ r: rowIdx, c: colIdx });
            if (!ws[cellRef]) {
              ws[cellRef] = { t: 's', v: '' };
            }
            ws[cellRef].s = style;
          }
        }
      }

      XLSX.utils.book_append_sheet(wb, ws, 'Transcrição');
      
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="transcricao-${id}.xlsx"`);
      
      const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
      res.send(buffer);
    } else {
      res.status(400).json({ error: 'Formato não suportado' });
    }
  } catch (err) {
    console.error('Erro ao gerar planilha:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * Transformar JSON de transcrição em linhas de planilha
 */
function transformToSpreadsheet(trans) {
  const { tipo, value } = trans;

  if (tipo === 'cartao-ponto') {
    return transformCartaoPontoToSpreadsheet(value);
  } else if (tipo === 'holerite') {
    return transformHoleriteToSpreadsheet(value);
  }

  return [];
}

/**
 * Transformar cartão de ponto para linhas de planilha
 * Cada linha tem: [rowData, alertType]
 * alertType: null | 'warning' | 'error'
 */
function transformCartaoPontoToSpreadsheet(value) {
  const rows = [];

  // Cabeçalho
  const headers = ['Data'];
  let maxPunches = 0;

  // Encontrar o número máximo de batidas
  for (const page of value.pages) {
    for (const day of page.days) {
      maxPunches = Math.max(maxPunches, day.punches.length);
    }
  }

  for (let i = 1; i <= maxPunches; i++) {
    headers.push(`Entrada ${Math.ceil(i / 2)}`);
    headers.push(`Saída ${Math.ceil(i / 2)}`);
  }

  rows.push({ data: headers, alert: null });

  // Dados
  let prevDate = null;
  for (const page of value.pages) {
    for (const day of page.days) {
      const row = [day.date_raw];
      let hasUncertainty = false;

      // Verificar se tem ?
      if (day.date_raw.includes('?')) {
        hasUncertainty = true;
      }

      for (let i = 0; i < maxPunches * 2; i++) {
        const punchIdx = Math.floor(i / 2);
        const isOut = i % 2 === 1;

        if (punchIdx < day.punches.length) {
          const punch = day.punches[punchIdx];
          const timeValue = (isOut && punch.kind === 'OUT') || (!isOut && punch.kind === 'IN')
            ? punch.time_raw
            : '';
          
          if (timeValue.includes('?')) {
            hasUncertainty = true;
          }
          row.push(timeValue);
        } else {
          row.push('');
        }
      }

      // Determinar tipo de alerta
      let alert = null;
      
      // Batidas ímpares = aviso
      if (day.punches.length % 2 !== 0) {
        alert = 'warning';
        hasUncertainty = true;
      }

      // Data não-sequencial = erro (vermelho)
      if (prevDate && !isSequentialDate(prevDate, day.date_raw)) {
        alert = 'error';
      }

      // Se tem ?, marcar como warning (mas error ganha sobre warning)
      if (hasUncertainty && !alert) {
        alert = 'warning';
      }

      rows.push({ data: row, alert });
      prevDate = day.date_raw;
    }
  }

  return rows;
}

/**
 * Verificar se duas datas são sequenciais
 */
function isSequentialDate(prevRaw, currRaw) {
  try {
    // Extrair partes da data
    const prevParts = prevRaw.match(/(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})/);
    const currParts = currRaw.match(/(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})/);

    if (!prevParts || !currParts) return true; // Se não conseguir parsear, considerar sequencial

    const prevDay = parseInt(prevParts[1], 10);
    const prevMonth = parseInt(prevParts[2], 10);
    const prevYear = parseInt(prevParts[3], 10);

    const currDay = parseInt(currParts[1], 10);
    const currMonth = parseInt(currParts[2], 10);
    const currYear = parseInt(currParts[3], 10);

    // Criar objetos Date (compensar mês 0-indexed)
    const prevDate = new Date(prevYear, prevMonth - 1, prevDay);
    const currDate = new Date(currYear, currMonth - 1, currDay);

    // Diferença esperada: 1 dia
    const diffMs = currDate - prevDate;
    const expectedMs = 24 * 60 * 60 * 1000;

    return Math.abs(diffMs - expectedMs) < 1000; // Tolerância de 1s
  } catch (err) {
    return true; // Se erro, considerar sequencial
  }
}

/**
 * Transformar holerite para linhas de planilha
 */
function transformHoleriteToSpreadsheet(value) {
  const rows = [];

  // Coletar todas as verbas únicas
  const allLabels = new Set();
  for (const page of value.pages) {
    for (const field of page.fields) {
      allLabels.add(field.label);
    }
  }

  // Cabeçalho
  const headers = ['Pág.', 'Mês', 'Ano', ...Array.from(allLabels)];
  rows.push({ data: headers, alert: null });

  // Dados
  let prevMonth = null;
  for (const page of value.pages) {
    const row = [String(page.page), page.month, page.year];
    let hasUncertainty = false;

    // Verificar incerteza
    if (page.month.includes('?') || page.year.includes('?')) {
      hasUncertainty = true;
    }

    for (const label of allLabels) {
      const field = page.fields.find(f => f.label === label);
      const value = field ? field.value : '';
      
      if (value.includes('?')) {
        hasUncertainty = true;
      }
      row.push(value);
    }

    // Determinar tipo de alerta
    let alert = null;

    // Página vazia
    if (page.fields.length === 0) {
      alert = 'warning';
      hasUncertainty = true;
    }

    // Mês não-sequencial
    if (prevMonth && !isSequentialMonth(prevMonth, page.month)) {
      alert = 'error';
    }

    // Se tem ?, marcar como warning
    if (hasUncertainty && !alert) {
      alert = 'warning';
    }

    rows.push({ data: row, alert });
    prevMonth = page.month;
  }

  return rows;
}

/**
 * Verificar se dois meses são sequenciais
 */
function isSequentialMonth(prevMonth, currMonth) {
  try {
    const prev = parseInt(prevMonth, 10);
    const curr = parseInt(currMonth, 10);

    if (isNaN(prev) || isNaN(curr)) return true;

    // Dezembro (12) para Janeiro (1) é sequencial
    if (prev === 12 && curr === 1) return true;

    // Caso normal
    return curr === (prev % 12) + 1;
  } catch (err) {
    return true;
  }
}

/**
 * Converter linhas para CSV
 */
function rowsToCSV(rowsData) {
  return rowsData
    .map(row =>
      row
        .map(cell => {
          const str = String(cell || '');
          // Escapar aspas duplas
          const escaped = str.replace(/"/g, '""');
          // Envolver em aspas se contiver vírgula ou aspas
          return `"${escaped}"`;
        })
        .join(',')
    )
    .join('\n');
}

export default router;
