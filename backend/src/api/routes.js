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

    const rows = transformToSpreadsheet(trans);

    if (formato === 'json') {
      res.json({ data: rows });
    } else if (formato === 'csv') {
      const csv = rowsToCSV(rows.map(r => r.data));
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="transcricao-${id}.csv"`);
      res.send(csv);
    } else if (formato === 'xlsx') {
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.aoa_to_sheet(rows.map(r => r.data));
      
      const headerStyle = {
        fill: { fgColor: { rgb: 'FF173772' } },
        font: { bold: true, color: { rgb: 'FFFFFFFF' } }
      };
      
      const warningStyle = {
        fill: { fgColor: { rgb: 'FFFFF3CD' } }
      };

      const errorStyle = {
        fill: { fgColor: { rgb: 'FFF8D7DA' } },
        border: { left: { style: 'thin', color: { rgb: 'FFDC3545' } } }
      };

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

function transformToSpreadsheet(trans) {
  const { tipo, value } = trans;

  if (tipo === 'cartao-ponto') {
    return transformCartaoPontoToSpreadsheet(value);
  } else if (tipo === 'holerite') {
    return transformHoleriteToSpreadsheet(value);
  }

  return [];
}

function transformCartaoPontoToSpreadsheet(value) {
  const rows = [];
  const headers = ['Data'];
  let maxPunches = 0;

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

  let prevDate = null;
  for (const page of value.pages) {
    for (const day of page.days) {
      const row = [day.date_raw];
      let hasUncertainty = day.date_raw.includes('?');

      for (let i = 0; i < maxPunches * 2; i++) {
        const punchIdx = Math.floor(i / 2);
        const isOut = i % 2 === 1;

        if (punchIdx < day.punches.length) {
          const punch = day.punches[punchIdx];
          const timeValue = (isOut && punch.kind === 'OUT') || (!isOut && punch.kind === 'IN')
            ? punch.time_raw
            : '';
          
          if (timeValue.includes('?')) hasUncertainty = true;
          row.push(timeValue);
        } else {
          row.push('');
        }
      }

      let alert = null;
      if (day.punches.length % 2 !== 0) {
        alert = 'warning';
        hasUncertainty = true;
      }
      if (prevDate && !isSequentialDate(prevDate, day.date_raw)) {
        alert = 'error';
      }
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
 * Nova Função: Transforma Ficha Financeira para Excel mapeando as bases
 */
function transformHoleriteToSpreadsheet(value) {
  const rows = [];
  rows.push({ data: ['Página', 'Ano', 'Mês', 'Indicador / Base Financeira', 'Valor (R$)'], alert: null });

  for (const page of value.pages) {
    const ano = page.year || '?';
    const mes = page.month || '?';

    if (page.bases && page.bases.length > 0) {
      for (const base of page.bases) {
        rows.push({
          data: [page.page, ano, mes, base.label, base.value],
          alert: base.label === 'Salário Líquido' ? 'warning' : null
        });
      }
    }

    if (page.fields && page.fields.length > 0) {
      for (const field of page.fields) {
        rows.push({
          data: [page.page, ano, mes, `[${field.code}] ${field.label}`, field.value],
          alert: null
        });
      }
    }
    rows.push({ data: ['', '', '', '', ''], alert: null });
  }

  return rows;
}

/**
 * Nova Função: Verifica se duas datas são sequenciais
 */
function isSequentialDate(prevRaw, currRaw) {
  try {
    const prevParts = prevRaw.match(/(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})/);
    const currParts = currRaw.match(/(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})/);

    if (!prevParts || !currParts) return true;

    const d1 = new Date(parseInt(prevParts[3], 10), parseInt(prevParts[2], 10) - 1, parseInt(prevParts[1], 10));
    const d2 = new Date(parseInt(currParts[3], 10), parseInt(currParts[2], 10) - 1, parseInt(currParts[1], 10));

    return d2 >= d1;
  } catch {
    return true;
  }
}

/**
 * Helper para conversão simples em CSV
 */
function rowsToCSV(rows) {
  return rows.map(r => r.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
}

export default router;
