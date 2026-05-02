interface DateMatch {
  year?: number;
  month?: number;
  day?: number;
}

export function extractDateFromQuery(query: string): DateMatch | null {
  const lowerQuery = query.toLowerCase();
  
  const monthMap: { [key: string]: number } = {
    january: 0, jan: 0,
    february: 1, feb: 1,
    march: 2, mar: 2,
    april: 3, apr: 3,
    may: 4,
    june: 5, jun: 5,
    july: 6, jul: 6,
    august: 7, aug: 7,
    september: 8, sep: 8, sept: 8,
    october: 9, oct: 9,
    november: 10, nov: 10,
    december: 11, dec: 11,
  };

  let extractedDate: DateMatch = {};
  
  for (const [monthName, monthNum] of Object.entries(monthMap)) {
    const regex = new RegExp(`\\b${monthName}\\b`, 'i');
    if (regex.test(lowerQuery)) {
      extractedDate.month = monthNum;
      break;
    }
  }
  
  const yearMatch = lowerQuery.match(/\b(20\d{2}|19\d{2})\b/);
  if (yearMatch) {
    extractedDate.year = parseInt(yearMatch[1]);
  }
  
  const dayMatch = lowerQuery.match(/\b(\d{1,2})(?:st|nd|rd|th)?\b/);
  if (dayMatch && extractedDate.month !== undefined) {
    const day = parseInt(dayMatch[1]);
    if (day >= 1 && day <= 31) {
      extractedDate.day = day;
    }
  }
  
  if (Object.keys(extractedDate).length === 0) {
    return null;
  }
  
  return extractedDate;
}

export function calculateDateSimilarity(queryDate: DateMatch, encounterDate: Date): number {
  const encMonth = encounterDate.getMonth();
  const encDay = encounterDate.getDate();
  const encYear = encounterDate.getFullYear();
  
  if (queryDate.month === undefined) {
    return 0;
  }
  
  if (queryDate.month !== encMonth) {
    return 0;
  }
  
  let score = 1.0;
  
  if (queryDate.year !== undefined) {
    if (queryDate.year === encYear) {
      score = 1.0;
    } else {
      return 0;
    }
  }
  
  if (queryDate.day !== undefined) {
    if (queryDate.day === encDay) {
      score = 1.0;
    } else {
      const dayDiff = Math.abs(queryDate.day - encDay);
      if (dayDiff <= 3) {
        score = 0.8 - (dayDiff * 0.1);
      } else {
        return 0;
      }
    }
  }
  
  return score;
}

function stripSurroundingPunctuation(word: string): string {
  return word.replace(/^\p{P}+|\p{P}+$/gu, '');
}

export function extractLocationTerms(query: string): string[] {
  const lowerQuery = query.toLowerCase();
  
  const dateWords = [
    'january', 'february', 'march', 'april', 'may', 'june',
    'july', 'august', 'september', 'october', 'november', 'december',
    'jan', 'feb', 'mar', 'apr', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec',
    'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday',
    'today', 'yesterday', 'tomorrow', 'last', 'this', 'next', 'week', 'month', 'year', 'on', 'in'
  ];
  
  const questionWords = [
    'who', 'what', 'when', 'where', 'why', 'how',
    'did', 'do', 'does', 'was', 'were', 'is', 'are',
    'i', 'me', 'my',
    'meet', 'met', 'saw', 'see', 'seen', 'encounter', 'encountered',
    'the', 'a', 'an',
    'at', 'of', 'to', 'from', 'with',
    'that', 'this', 'name', 'person', 'people', 'location',
    'girl', 'guy', 'man', 'woman', 'boy'
  ];
  
  const allWordsToRemove = [...dateWords, ...questionWords];
  
  let cleanedQuery = lowerQuery;
  
  for (const word of allWordsToRemove) {
    cleanedQuery = cleanedQuery.replace(new RegExp(`\\b${word}\\b`, 'g'), '');
  }
  
  cleanedQuery = cleanedQuery.replace(/\b\d{1,2}(?:st|nd|rd|th)?\b/g, '');
  cleanedQuery = cleanedQuery.replace(/\b(20\d{2}|19\d{2})\b/g, '');
  
  const terms = cleanedQuery
    .trim()
    .split(/\s+/)
    .map(term => stripSurroundingPunctuation(term))
    .filter(term => term.length > 0);
  
  return terms;
}

export function calculateLocationScore(
  locationTerms: string[],
  encounterLocation: string,
  encounterContext: string | null
): { score: number; hasMatch: boolean } {
  if (locationTerms.length === 0) {
    return { score: 0, hasMatch: false };
  }
  
  const location = encounterLocation.toLowerCase();
  const context = (encounterContext || '').toLowerCase();
  
  let locationMatches = 0;
  let contextMatches = 0;
  
  for (const term of locationTerms) {
    if (location.includes(term)) {
      locationMatches++;
    }
    if (context.includes(term)) {
      contextMatches++;
    }
  }
  
  if (locationMatches === 0 && contextMatches === 0) {
    return { score: 0, hasMatch: false };
  }
  
  const locationMatchRatio = locationMatches / locationTerms.length;
  const contextMatchRatio = contextMatches / locationTerms.length;
  
  const score = (locationMatchRatio * 0.8) + (contextMatchRatio * 0.2);
  
  return { score, hasMatch: true };
}

export function isDateQuery(query: string): boolean {
  const lowerQuery = query.toLowerCase();
  
  const dateIndicators = [
    'january', 'february', 'march', 'april', 'may', 'june',
    'july', 'august', 'september', 'october', 'november', 'december',
    'jan', 'feb', 'mar', 'apr', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec',
    'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday',
    'today', 'yesterday', 'last week', 'this week', 'last month'
  ];
  
  const hasDateWord = dateIndicators.some(indicator => {
    const regex = new RegExp(`\\b${indicator}\\b`, 'i');
    return regex.test(lowerQuery);
  });
  
  return hasDateWord ||
         /\b\d{1,2}(?:st|nd|rd|th)?\b/.test(lowerQuery) ||
         /\b(20\d{2}|19\d{2})\b/.test(lowerQuery);
}

export function isLocationQuery(query: string): boolean {
  const locationTerms = extractLocationTerms(query);
  return locationTerms.length > 0;
}
