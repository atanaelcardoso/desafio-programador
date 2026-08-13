/**
 * Parser para Holerite
 * 
 * Estrutura esperada do PDF:
 * - Tabela de verbas (vencimentos e descontos)
 * - Seção separada de bases (Base INSS, Base IR, etc)
 * 
 * Output esperado:
 * {
 *   "pages": [
 *     {
 *       "page": 1,
 *       "year": "2020",
 *       "month": "01",
 *       "fields": [
 *         { "code": "0010", "label": "Salário Base", "reference": "220,00", "value": "2.389,77" }
 *       ],
 *       "bases": [
 *         { "label": "Base INSS", "value": "2.545,68" }
 *       ]
 *     }
 *   ]
 * }
 */

export function parseHolerite(textPerPage) {
  const pages = [];

  for (let pageIdx = 0; pageIdx < textPerPage.length; pageIdx++) {
    const { text } = textPerPage[pageIdx];
    
    const competency = extractCompetency(text);
    const fields = extractFields(text);
    const bases = extractBases(text);

    const pageData = {
      page: pageIdx + 1,
      year: competency.year,
      month: competency.month,
      fields,
      bases
    };

    pages.push(pageData);
  }

  return { pages };
}

/**
 * Extrair competência (year, month) do texto
 */
function extractCompetency(text) {
  // Padrão: MM/YYYY ou YYYY-MM
  const patterns = [
    /(\d{1,2})[/\-](\d{4})/,      // 01/2020 ou 01-2020
    /(\d{4})[/\-](\d{1,2})/       // 2020/01 ou 2020-01
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      let year, month;
      
      if (match[1].length === 4) {
        year = match[1];
        month = match[2].padStart(2, '0');
      } else {
        month = match[1].padStart(2, '0');
        year = match[2];
      }

      // Validar
      const y = parseInt(year, 10);
      const m = parseInt(month, 10);
      
      if (y >= 1990 && y <= 2099 && m >= 1 && m <= 12) {
        return { year, month };
      }
    }
  }

  return { year: '?', month: '?' };
}

/**
 * Extrair verbas (fields) do texto
 * Busca por padrões de código + label + valor
 */
function extractFields(text) {
  const fields = [];
  
  // Padrão: código (4 dígitos) + label + valor monetário
  // Exemplo: 0010 Salário Base 2.389,77
  const pattern = /(\d{4})\s+([^\d]+?)\s+([0-9.,\s]+?)(?=\d{4}\s|Bases?|Base INSS|Total|$)/g;
  
  let match;
  while ((match = pattern.exec(text)) !== null) {
    const code = match[1];
    const label = match[2].trim();
    const valueStr = match[3].trim();

    // Não incluir bases
    if (isBase(label)) {
      continue;
    }

    // Extrair valor e reference
    const parts = valueStr.split(/\s+/);
    let value = '';
    let reference = '';

    if (parts.length >= 1) {
      value = parts[parts.length - 1]; // Último é o valor
      if (parts.length > 1) {
        reference = parts[0]; // Primeiro é a referência
      }
    }

    fields.push({
      code,
      label,
      reference,
      value
    });
  }

  return fields;
}

/**
 * Extrair bases do texto
 * Busca por labels específicos: Base INSS, Base IR, Total, etc
 */
function extractBases(text) {
  const bases = [];
  
  // Keywords de bases
  const baseKeywords = [
    'Base INSS',
    'Base IR',
    'Base IRRF',
    'Base FGTS',
    'FGTS',
    'Total Vencimentos',
    'Total Descontos',
    'Valor Líquido',
    'Salário Líquido'
  ];

  for (const keyword of baseKeywords) {
    // Procurar pelo keyword no texto
    const regex = new RegExp(`${keyword}\\s+([0-9.,]+)`, 'i');
    const match = text.match(regex);
    
    if (match) {
      bases.push({
        label: keyword,
        value: match[1].trim()
      });
    }
  }

  return bases;
}

/**
 * Verificar se um label é uma base (não uma verba)
 */
function isBase(label) {
  const basesKeywords = [
    'Base INSS',
    'Base IR',
    'Base IRRF',
    'Base FGTS',
    'FGTS',
    'Total Vencimentos',
    'Total Descontos',
    'Total',
    'Valor Líquido',
    'Salário Líquido'
  ];

  return basesKeywords.some(keyword => 
    label.toLowerCase().includes(keyword.toLowerCase())
  );
}
