/**
 * Church Interpreter Helper - Session management utilities
 */

/**
 * Create a new session object
 * @param {Object} options - Session options
 * @param {string} options.id - Session ID
 * @param {string} options.title - Session title
 * @param {string} [options.scripture] - Scripture reference
 * @param {string} [options.speaker] - Speaker name
 * @returns {Object} New session object
 */
export function createSession(options) {
  return {
    id: options.id,
    title: options.title || 'Untitled Session',
    scripture: options.scripture || '',
    speaker: options.speaker || '',
    transcript: [],
    glossary: {},
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

/**
 * Add a message to a session's transcript
 * @param {Object} session - The session
 * @param {string} role - Message role (user, assistant, system)
 * @param {string} text - Message text
 * @returns {void}
 */
export function addMessageToTranscript(session, role, text) {
  session.transcript.push({
    role,
    text,
    timestamp: Date.now(),
  });
  session.updatedAt = Date.now();
}

/**
 * Store a glossary entry in a session
 * @param {Object} session - The session
 * @param {string} source - Source term
 * @param {string} target - Target translation
 * @param {boolean} isKorean - Whether source is Korean
 * @returns {void}
 */
export function storeGlossaryEntry(session, source, target, isKorean) {
  const normalized = isKorean ? source : source.toLowerCase();
  if (normalized) {
    session.glossary[normalized] = target;
    session.updatedAt = Date.now();
  }
}

/**
 * Get glossary entries for a session
 * @param {Object} session - The session
 * @returns {Object} Glossary object
 */
export function getSessionGlossary(session) {
  return { ...session.glossary };
}

/**
 * Get transcript entries from a session
 * @param {Object} session - The session
 * @returns {Array} Array of transcript entries (deep copy)
 */
export function getSessionTranscript(session) {
  return session.transcript.map(entry => ({ ...entry }));
}

/**
 * Clear session transcript
 * @param {Object} session - The session
 * @returns {void}
 */
export function clearSessionTranscript(session) {
  session.transcript = [];
  session.updatedAt = Date.now();
}

/**
 * Clear session glossary
 * @param {Object} session - The session
 * @returns {void}
 */
export function clearSessionGlossary(session) {
  session.glossary = {};
  session.updatedAt = Date.now();
}

/**
 * Delete a glossary entry
 * @param {Object} session - The session
 * @param {string} term - The term to delete
 * @returns {boolean} True if entry was deleted
 */
export function deleteGlossaryEntry(session, term) {
  if (term in session.glossary) {
    delete session.glossary[term];
    session.updatedAt = Date.now();
    return true;
  }
  return false;
}

/**
 * Export session to JSON
 * @param {Object} session - The session
 * @returns {string} JSON representation
 */
export function exportSessionJson(session) {
  return JSON.stringify(session, null, 2);
}

/**
 * Export session as markdown
 * @param {Object} session - The session
 * @returns {string} Markdown representation
 */
export function exportSessionMarkdown(session) {
  let markdown = `# ${session.title}\n\n`;

  if (session.scripture) {
    markdown += `**Scripture**: ${session.scripture}\n\n`;
  }
  if (session.speaker) {
    markdown += `**Speaker**: ${session.speaker}\n\n`;
  }

  markdown += `**Created**: ${new Date(session.createdAt).toLocaleString()}\n\n`;

  markdown += '## Transcript\n\n';
  session.transcript.forEach((entry) => {
    const label = entry.role === 'user' ? '👤 You' : entry.role === 'assistant' ? '🤖 Helper' : '⚙️ System';
    markdown += `**${label}**: ${entry.text}\n\n`;
  });

  if (Object.keys(session.glossary).length > 0) {
    markdown += '## Glossary\n\n';
    Object.entries(session.glossary)
      .sort()
      .forEach(([source, target]) => {
        markdown += `- ${source} → ${target}\n`;
      });
  }

  return markdown;
}

/**
 * Export glossary as CSV
 * @param {Object} session - The session
 * @returns {string} CSV representation
 */
export function exportGlossaryCsv(session) {
  let csv = 'Source,Target\n';
  Object.entries(session.glossary)
    .sort()
    .forEach(([source, target]) => {
      // Escape quotes in values
      const escapedSource = `"${source.replace(/"/g, '""')}"`;
      const escapedTarget = `"${target.replace(/"/g, '""')}"`;
      csv += `${escapedSource},${escapedTarget}\n`;
    });
  return csv;
}

/**
 * Import glossary from CSV content
 * @param {Object} session - The session
 * @param {string} csvContent - CSV content
 * @returns {number} Number of entries imported
 */
export function importGlossaryFromCsv(session, csvContent) {
  const lines = csvContent.trim().split('\n');
  let imported = 0;

  for (let i = 1; i < lines.length; i += 1) {
    const line = lines[i].trim();
    if (!line) continue;

    // Simple CSV parsing (handles quoted values)
    const match = line.match(/"([^"]*)","([^"]*)"/);
    if (match) {
      const source = match[1].replace(/""/g, '"');
      const target = match[2].replace(/""/g, '"');
      session.glossary[source] = target;
      imported += 1;
    }
  }

  if (imported > 0) {
    session.updatedAt = Date.now();
  }
  return imported;
}

/**
 * Search transcript for matching entries
 * @param {Object} session - The session
 * @param {string} query - Search query
 * @returns {Array} Matching transcript entries
 */
export function searchTranscript(session, query) {
  const lowerQuery = query.toLowerCase();
  return session.transcript.filter((entry) =>
    entry.text.toLowerCase().includes(lowerQuery)
  );
}
