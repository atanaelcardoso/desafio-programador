export function parseCartaoPonto(textPerPage) {
  const pages = [];

  for (let pageIdx = 0; pageIdx < textPerPage.length; pageIdx++) {
    const { text } = textPerPage[pageIdx];

    const normalizedText = text.replace(/\s+/g, ' ');

    const pageData = {
      page: pageIdx + 1,
      days: parseSiponTextGlobal(normalizedText)
    };

    pages.push(pageData);
  }

  return { pages };
}

function parseSiponTextGlobal(text) {
  let currentMonth = "01";
  let currentYear = new Date().getFullYear().toString();

  const compMatch = text.match(/mes\/ano\s*:\s*(\d{1,2})\s*[\/\-]\s*(\d{4})/i);
  if (compMatch) {
    currentMonth = compMatch[1].padStart(2, '0');
    currentYear = compMatch[2];
  }

  const dayPattern = /\b(\d{1,2})\s*-\s*([A-Z]{3,4})\b/g;
  let match;
  const dayMatches = [];

  while ((match = dayPattern.exec(text)) !== null) {
    dayMatches.push({
      dayNum: match[1].padStart(2, '0'),
      index: match.index,
      fullMatchLength: match[0].length
    });
  }

  const daysMap = {};

  for (let i = 0; i < dayMatches.length; i++) {
    const currentMatch = dayMatches[i];
    const dateRaw = `${currentMatch.dayNum}/${currentMonth}/${currentYear}`;

    const startIdx = currentMatch.index + currentMatch.fullMatchLength;
    const endIdx = (i + 1 < dayMatches.length) ? dayMatches[i + 1].index : text.length;

    const blockText = text.substring(startIdx, endIdx);

    const timePattern = /\b(\d{1,2}):(\d{2})\b/g;
    let timeMatch;
    const foundTimes = [];

    while ((timeMatch = timePattern.exec(blockText)) !== null) {
      const hhStr = timeMatch[1].padStart(2, '0');
      const mmStr = timeMatch[2];
      const correctTimeStr = `${hhStr}:${mmStr}`;

      if (correctTimeStr === "08:00") {
        continue;
      }

      const hourNumeric = parseInt(hhStr, 10);
      if (hourNumeric >= 0 && hourNumeric < 6) {
        continue;
      }

      const lookbackStart = Math.max(0, timeMatch.index - 12);
      const textImmediatelyBefore = blockText.substring(lookbackStart, timeMatch.index).toUpperCase();
      if (
        textImmediatelyBefore.includes("HE-") ||
        textImmediatelyBefore.includes("BCO") ||
        textImmediatelyBefore.includes("QTD")
      ) {
        continue;
      }

      foundTimes.push(correctTimeStr);
    }

    if (!daysMap[dateRaw]) {
      daysMap[dateRaw] = [];
    }
    daysMap[dateRaw].push(...foundTimes);
  }

  const days = [];
  for (const [dateRaw, times] of Object.entries(daysMap)) {
    const sortedTimes = [...new Set(times)].sort();

    const punches = sortedTimes.map((time, idx) => ({
      kind: idx % 2 === 0 ? 'IN' : 'OUT',
      time_raw: time,
      time_hhmm: time
    }));

    days.push({
      date_raw: dateRaw,
      punches
    });
  }

  return days.sort((a, b) => a.date_raw.localeCompare(b.date_raw));
}