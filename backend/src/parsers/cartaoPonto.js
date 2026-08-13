/**
 * Parser para Cartão de Ponto
 * 
 * Estrutura esperada do PDF:
 * - Tabela com data e batidas (IN/OUT)
 * - Uma linha por dia
 * 
 * Output esperado:
 * {
 *   "pages": [
 *     {
 *       "page": 1,
 *       "days": [
 *         {
 *           "date_raw": "21/05/2019",
 *           "punches": [
 *             { "kind": "IN", "time_raw": "08:25", "time_hhmm": "08:25" }
 *           ]
 *         }
 *       ]
 *     }
 *   ]
 * }
 */

export function parseCartaoPonto(textPerPage) {
  const pages = [];

  for (let pageIdx = 0; pageIdx < textPerPage.length; pageIdx++) {
    const { text } = textPerPage[pageIdx];
    
    const pageData = {
      page: pageIdx + 1,
      days: parseCartaoPontoText(text)
    };

    pages.push(pageData);
  }

  return { pages };
}

/**
 * Extrair dias e batidas do texto
 * Procura por padrões de data (DD/MM/YYYY) seguidos de horários
 */
function parseCartaoPontoText(text) {
  const days = [];
  
  // Regex para encontrar linhas com datas
  // Padrão: DD/MM/YYYY seguido de zeros ou horários
  const datePattern = /(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})/g;
  
  let match;
  const dateMatches = [];
  
  while ((match = datePattern.exec(text)) !== null) {
    dateMatches.push({
      fullMatch: match[0],
      day: match[1],
      month: match[2],
      year: match[3],
      index: match.index
    });
  }

  // Para cada data encontrada, extrair batidas próximas
  for (let i = 0; i < dateMatches.length; i++) {
    const dateMatch = dateMatches[i];
    const dateRaw = dateMatch.fullMatch;

    // Validar data
    const day = parseInt(dateMatch.day, 10);
    const month = parseInt(dateMatch.month, 10);
    
    if (!isValidDate(day, month)) {
      // Data inválida, mas ainda assim incluir com marcadores de erro
      days.push({
        date_raw: dateRaw,
        punches: []
      });
      continue;
    }

    // Extrair texto entre esta data e a próxima
    const startIdx = dateMatch.index + dateMatch.fullMatch.length;
    const endIdx = i + 1 < dateMatches.length 
      ? dateMatches[i + 1].index 
      : text.length;
    
    const lineText = text.substring(startIdx, endIdx);

    // Extrair horários dessa linha (padrão HH:MM ou HHMM)
    const punches = extractPunches(lineText);

    days.push({
      date_raw: dateRaw,
      punches
    });
  }

  return days;
}

/**
 * Extrair batidas (horários) de um texto
 * Retorna array alternando IN (entrada) e OUT (saída)
 */
function extractPunches(text) {
  const punches = [];
  
  // Padrão: HH:MM ou HHMM
  const timePattern = /(\d{1,2}):?(\d{2})/g;
  let match;
  
  while ((match = timePattern.exec(text)) !== null) {
    const hours = match[1];
    const minutes = match[2];
    
    const h = parseInt(hours, 10);
    const m = parseInt(minutes, 10);
    
    // Validar horário
    if (h >= 0 && h < 24 && m >= 0 && m < 60) {
      const timeRaw = `${hours}:${minutes}`;
      const timeHhmm = `${hours.padStart(2, '0')}:${minutes}`;
      
      // Alternar IN e OUT
      const kind = punches.length % 2 === 0 ? 'IN' : 'OUT';
      
      punches.push({
        kind,
        time_raw: timeRaw,
        time_hhmm: timeHhmm
      });
    }
  }

  return punches;
}

/**
 * Função helper para validar data
 */
function isValidDate(day, month) {
  const d = parseInt(day, 10);
  const m = parseInt(month, 10);
  
  if (d < 1 || d > 31) return false;
  if (m < 1 || m > 12) return false;
  
  return true;
}
