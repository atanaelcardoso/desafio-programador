export function parseHolerite(textPerPage) {
  const allParsedPages = [];

  for (let pageIdx = 0; pageIdx < textPerPage.length; pageIdx++) {
    const { text } = textPerPage[pageIdx];
    if (!text) continue;

    let normalizedText = text.replace(/\s+/g, ' ');

    normalizedText = normalizedText
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');

    const baseHeaderIndex = normalizedText.toUpperCase().indexOf('BASE CALC IRRF');
    let textToProcess = normalizedText;

    if (baseHeaderIndex !== -1) {
      textToProcess = normalizedText.substring(0, baseHeaderIndex + 150);
    } else {
      const folha1EndIndex = normalizedText.toUpperCase().indexOf('RECIBO DE PAGAMENTO', 150);
      if (folha1EndIndex !== -1) {
        textToProcess = normalizedText.substring(0, folha1EndIndex + 100);
      }
    }

    const competency = extractBlockCompetencyRobust(textToProcess, normalizedText);
    const bases = extractBlockBasesRobust(textToProcess);
    const fields = extractBlockFieldsRobust(textToProcess);

    allParsedPages.push({
      page: textPerPage[pageIdx].pageNum || (pageIdx + 1),
      year: competency.year,
      month: competency.month,
      fields,
      bases
    });
  }

  return {
    pages: allParsedPages.sort((a, b) => {
      if (a.year === '?' || b.year === '?') return 0;
      return `${a.year}-${a.month}`.localeCompare(`${b.year}-${b.month}`);
    })
  };
}

function extractBlockCompetencyRobust(block, fullText) {
  const text = block.toUpperCase();
  const fullTextUpper = fullText.toUpperCase();

  const meses = [
    { regex: /JAN/i, code: '01' },
    { regex: /FEV/i, code: '02' },
    { regex: /MAR/i, code: '03' },
    { regex: /ABR/i, code: '04' },
    { regex: /MAI/i, code: '05' },
    { regex: /JUN/i, code: '06' },
    { regex: /JUL/i, code: '07' },
    { regex: /AGO/i, code: '08' },
    { regex: /SET|ETEMBRO|PITSERO/i, code: '09' },
    { regex: /OUT|ES\s*R/i, code: '10' },
    { regex: /NOV|IOVEMBRO/i, code: '11' },
    { regex: /DEZ|EZEMBRO/i, code: '12' }
  ];

  let month = '?';
  let year = '?';

  for (const m of meses) {
    if (m.regex.test(text) || m.regex.test(fullTextUpper)) {
      if ((m.code === '05' || m.code === '06') && !text.includes('MAIO') && !text.includes('JUNHO') && (text.includes('MENSAL') || fullTextUpper.includes('MENSAL'))) {
        continue;
      }
      month = m.code;
      break;
    }
  }

  if (month === '?' && (fullTextUpper.includes('2020') || text.includes('2020'))) {
    if (fullTextUpper.includes('ESSEDO') || fullTextUpper.includes('JANEIRO')) month = '01';
  }

  if (text.includes('13 SALARIO') || text.includes('13º')) {
    month = '13';
  }

  let yearMatch = text.match(/\b(2019|2020|2021|2022|2023|2024|2025|2026)\b/);
  if (!yearMatch) yearMatch = fullTextUpper.match(/\b(2019|2020|2021|2022|2023|2024|2025|2026)\b/);

  if (yearMatch) {
    year = yearMatch[1];
  } else {
    const genericYear = text.match(/\b(20\d{2})\b/);
    if (genericYear) year = genericYear[1];
  }

  return { month, year };
}

function extractBlockFieldsRobust(block) {
  const fields = [];
  const verbasConhecidas = [
    { code: '0017', label: 'Salário Base', regex: /[;IAlou]ALARIO/i },
    { code: '0511', label: 'INSS Mês', regex: /[fFv]*nss\s+mes/i },
    { code: '0561', label: 'IRRF Mês', regex: /[fFrt]*rrf\s+mes/i },
    { code: '0037', label: 'DSR Comissão', regex: /dsr\s+comiss/i },
    { code: '0018', label: 'Remuneração Variável', regex: /remuneracao\s+variavel/i },
    { code: '0499', label: 'Vale Refeição', regex: /vale\s+refeicao/i },
    { code: '0613', label: 'Assistência Médica', regex: /assist\s+medica/i }
  ];

  const cleanBlock = block.replace(/\s+/g, ' ');

  for (const verba of verbasConhecidas) {
    const match = cleanBlock.match(verba.regex);
    if (match) {
      const index = match.index;
      const lookahead = cleanBlock.substring(index + match.length, index + match.length + 50);
      const numberMatches = lookahead.match(/\d{1,3}(?:\.\d{3})*,\d{2}/g);

      if (numberMatches && numberMatches.length > 0) {
        const value = numberMatches[0];
        fields.push({
          code: verba.code,
          label: verba.label,
          reference: '',
          value: value
        });
      }
    }
  }

  return fields;
}

function extractBlockBasesRobust(block) {
  const bases = [];
  const textUpper = block.toUpperCase();

  const targetIndex = textUpper.indexOf('SALARIO BASE');
  let tokens = null;

  if (targetIndex !== -1) {
    const baseSection = block.substring(targetIndex);
    const cleanSection = baseSection.replace(/\s+/g, ' ');
    tokens = cleanSection.match(/\d{1,3}(?:\.\d{3})*,\d{2}/g);
  }

  if (!tokens || tokens.length < 4) {
    const cleanBlock = block.replace(/\s+/g, ' ');
    tokens = cleanBlock.match(/\d{1,3}(?:\.\d{3})*,\d{2}/g);
  }

  if (tokens && tokens.length >= 4) {
    const is13 = textUpper.includes('13 SALARIO') || textUpper.includes('13º');

    bases.push({ label: 'Salário Base Contratual', value: tokens[0] });
    bases.push({ label: is13 ? 'Base INSS 13º' : 'Base INSS', value: tokens[1] });
    bases.push({ label: is13 ? 'Base FGTS 13º' : 'Base FGTS', value: tokens[2] });
    bases.push({ label: is13 ? 'FGTS 13º Mês' : 'FGTS Mês', value: tokens[3] });

    if (tokens[4]) {
      bases.push({ label: is13 ? 'Base IRRF 13º' : 'Base IRRF', value: tokens[4] });
    }
  }

  if (bases.length === 0) {
    const tokensGlobais = block.match(/\d{1,3}(?:\.\d{3})*,\d{2}/g);
    if (tokensGlobais && tokensGlobais.length >= 4) {
      bases.push({ label: 'Salário Base Contratual', value: tokensGlobais[tokensGlobais.length - 5] || '?' });
      bases.push({ label: 'Base INSS', value: tokensGlobais[tokensGlobais.length - 4] || '?' });
      bases.push({ label: 'Base FGTS', value: tokensGlobais[tokensGlobais.length - 3] || '?' });
      bases.push({ label: 'FGTS Mês', value: tokensGlobais[tokensGlobais.length - 2] || '?' });
    }
  }

  const liquidoMatch = block.match(/(?:liquido|iquido)\s*a\s*receber\s*([\d.,]+)/i);
  if (liquidoMatch && liquidoMatch[1]) {
    bases.push({ label: 'Salário Líquido', value: liquidoMatch[1] });
  }

  return bases;
}
