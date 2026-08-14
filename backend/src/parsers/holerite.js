export function parseHolerite(textPerPage) {
  const allParsedPages = [];

  for (let pageIdx = 0; pageIdx < textPerPage.length; pageIdx++) {
    const { text } = textPerPage[pageIdx];

    const normalizedText = text.replace(/\s+/g, ' ');

    const blockMarkers = /(?=Folha Normal|Adiantamento\s*-\s*PLR|13\s*Salario)/ig;
    const blocks = normalizedText.split(blockMarkers);

    for (const block of blocks) {
      if (!block.toLowerCase().includes('mês:') && !block.toLowerCase().includes('mes:')) continue;

      const competency = extractBlockCompetency(block);
      if (competency.month === '?') continue;

      const bases = extractBlockBases(block);
      const fields = extractBlockFieldsRobust(block);

      allParsedPages.push({
        page: pageIdx + 1,
        year: competency.year,
        month: competency.month,
        fields,
        bases
      });
    }
  }

  const sortedPages = allParsedPages.sort((a, b) => {
    const dateA = `${a.year}-${a.month}`;
    const dateB = `${b.year}-${b.month}`;
    return dateA.localeCompare(dateB);
  });

  return {
    pages: sortedPages.length > 0 ? sortedPages : [{ page: 1, year: '?', month: '?', fields: [], bases: [] }]
  };
}

function extractBlockCompetency(block) {
  const monthMap = {
    'jan': '01', 'fev': '02', 'mar': '03', 'abr': '04', 'mai': '05', 'jun': '06',
    'jul': '07', 'ago': '08', 'set': '09', 'out': '10', 'nov': '11', 'dez': '12'
  };

  const match = block.match(/(?:mês|mes):\s*([a-z]{3})-(\d{2})/i);
  if (match) {
    const mStr = match[1].toLowerCase();
    const yStr = match[2];
    return {
      month: monthMap[mStr] || '?',
      year: `20${yStr}`
    };
  }
  return { year: '?', month: '?' };
}

function extractBlockFieldsRobust(block) {
  const fields = [];
  const verbasConhecidas = [
    { code: '0040', label: 'Reembolso VR' },
    { code: '0091', label: 'Hr Adic Pericul' },
    { code: '0037', label: 'DSR Adicional' },
    { code: '0102', label: 'Hr Ext Diu 60%' },
    { code: '0104', label: 'Hr Ext Diu 80%' },
    { code: '0124', label: 'Hr Ext Not 80%' },
    { code: '0311', label: 'Part Lucr Resul' },
    { code: '0290', label: 'VA Funcionario' },
    { code: '0404', label: 'Adt Norm Desc' },
    { code: '0491', label: 'Seguro Vida Fun' },
    { code: '0499', label: 'Vale Ref Func' },
    { code: '0511', label: 'INSS Normal' },
    { code: '0561', label: 'IRF Normal' },
    { code: '0613', label: 'Smart 500 QC' },
    { code: '0684', label: 'Vale Gas' },
    { code: '0820', label: 'Vale Transp Fun' },
    { code: '0314', label: 'PLR Pago' },
    { code: '0017', label: 'REMUNERAÇÃOMES' }
  ];

  for (const verba of verbasConhecidas) {
    const index = block.indexOf(verba.label);
    if (index !== -1) {
      const lookahead = block.substring(index + verba.label.length, index + verba.label.length + 45);

      const numberMatches = lookahead.match(/\b\d{1,3}(?:\.\d{3})*,\d{2}\b|\b0\b/g);

      if (numberMatches && numberMatches.length > 0) {
        let value = numberMatches[numberMatches.length - 1];
        const reference = numberMatches.length > 1 ? numberMatches[0] : '';

        if (value === '0') {
          value = '0,00';
        }

        fields.push({
          code: verba.code,
          label: verba.label,
          reference: reference === '0' ? '0,00' : reference,
          value: value
        });
      }
    }
  }

  return fields;
}

function extractBlockBases(block) {
  const bases = [];
  const baseMapping = [
    { label: 'Base INSS', search: 'BASEDECALCULODOINSS' },
    { label: 'Base IRRF', search: 'BASEDECALCULODOIRF' },
    { label: 'Base FGTS', search: 'BASEDECALCULODOFGTS' },
    { label: 'FGTS', search: 'VALORDOFGTS' },
    { label: 'Salário Líquido', search: 'SALARIOLIQUIDONOMES' }
  ];

  const unifiedText = block.replace(/\s+/g, '');

  for (const item of baseMapping) {
    const regex = new RegExp(`${item.search}([0-9.,]+)`, 'i');
    const match = unifiedText.match(regex);
    if (match) {
      let val = match[1];
      const commaIdx = val.indexOf(',');
      if (commaIdx !== -1 && val.length > commaIdx + 3) {
        val = val.substring(0, commaIdx + 3);
      }
      bases.push({ label: item.label, value: val });
    }
  }

  return bases;
}
