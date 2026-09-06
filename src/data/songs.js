const lyricFiles = import.meta.glob('./lyrics/*.txt', { query: '?raw', import: 'default', eager: true });
const chordFiles = import.meta.glob('./chords/*.txt', { query: '?raw', import: 'default', eager: true });

// Helper to clean filename and extract details
function cleanName(filename) {
  const nameWithoutExt = filename.replace(/\.txt$/, '');
  return nameWithoutExt.replace(/^\d+[\s.]+\s*/, '').trim();
}

function normalize(str) {
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

// Build chord index
const chordsList = [];
for (const path in chordFiles) {
  const filename = path.split('/').pop();
  const cleanNameStr = cleanName(filename);
  
  let title = cleanNameStr;
  let author = '';
  const authorMatch = cleanNameStr.match(/\(([^)]+)\)$/);
  if (authorMatch) {
    author = authorMatch[1].trim();
    title = cleanNameStr.substring(0, authorMatch.index).trim();
  }
  
  chordsList.push({
    path,
    filename,
    cleanName: cleanNameStr,
    title,
    normalizedTitle: normalize(title),
    normalizedCleanName: normalize(cleanNameStr),
    content: chordFiles[path]
  });
}

const songs = [];

for (const path in lyricFiles) {
  const filename = path.split('/').pop();
  const cleanNameStr = cleanName(filename);

  let title = cleanNameStr;
  let author = '';

  const authorMatch = cleanNameStr.match(/\(([^)]+)\)$/);
  if (authorMatch) {
    author = authorMatch[1].trim().replace(/\s*-\s*/g, ' | ');
    title = cleanNameStr.substring(0, authorMatch.index).trim();
  }

  const normalizedTitle = normalize(title);
  const normalizedCleanName = normalize(cleanNameStr);

  // Find matching chord
  let matchedChord = null;

  // 1. Try exact clean name match
  matchedChord = chordsList.find(c => c.cleanName.toLowerCase() === cleanNameStr.toLowerCase());

  // 2. Try exact normalized clean name match
  if (!matchedChord) {
    matchedChord = chordsList.find(c => c.normalizedCleanName === normalizedCleanName);
  }

  // 3. Try exact normalized title match
  if (!matchedChord) {
    matchedChord = chordsList.find(c => c.normalizedTitle === normalizedTitle);
  }

  // 4. Try substring match on normalized title
  if (!matchedChord) {
    matchedChord = chordsList.find(c => {
      return c.normalizedTitle.includes(normalizedTitle) || normalizedTitle.includes(c.normalizedTitle);
    });
  }

  const lyricsContent = lyricFiles[path];
  const chordsContent = matchedChord ? matchedChord.content : lyricsContent;

  songs.push({
    title: title,
    lyrics: lyricsContent.trim(),
    chords: chordsContent.trim(),
    author: author
  });
}

export default songs;

