// Free, dependency-free CSV read/write (RFC4180-ish) for the inventory
// export/import feature — same "hand-rolled, no external library" approach
// as every other parser in this app.

// Turns one row of fields into a CSV line. A field gets wrapped in quotes
// (with any internal quote doubled) whenever it contains a comma, quote,
// or newline — otherwise it's written plain, so a normal item name stays
// readable when opened in a spreadsheet.
function stringifyCsvField(value) {
  const str = value === null || value === undefined ? '' : String(value);
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function stringifyCsv(rows) {
  return rows.map((row) => row.map(stringifyCsvField).join(',')).join('\r\n') + '\r\n';
}

// Parses CSV text into an array of rows (each an array of string fields).
// Handles quoted fields — including embedded commas, doubled "" quotes,
// and embedded newlines — plus bare \n, \r\n, or \r line endings. Blank
// trailing lines are dropped, but a genuinely blank row in the middle of
// the file (two line breaks in a row) is kept as [''] so row numbers
// reported back to the user still match what they see in a spreadsheet.
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  let i = 0;
  const src = String(text || '');

  function endField() {
    row.push(field);
    field = '';
  }
  function endRow() {
    endField();
    rows.push(row);
    row = [];
  }

  while (i < src.length) {
    const c = src[i];
    if (inQuotes) {
      if (c === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      field += c;
      i++;
      continue;
    }
    if (c === '"') {
      inQuotes = true;
      i++;
      continue;
    }
    if (c === ',') {
      endField();
      i++;
      continue;
    }
    if (c === '\r' || c === '\n') {
      endRow();
      if (c === '\r' && src[i + 1] === '\n') i++;
      i++;
      continue;
    }
    field += c;
    i++;
  }
  // Last field/row, if the file doesn't end in a line break.
  if (field !== '' || row.length > 0) endRow();

  // Drop wholly-blank trailing rows (a final newline in the file, or one
  // an editor added), but only from the end — a blank row mid-file is
  // preserved so line numbers stay accurate.
  while (rows.length > 0 && rows[rows.length - 1].length === 1 && rows[rows.length - 1][0] === '') {
    rows.pop();
  }
  return rows;
}

module.exports = { parseCsv, stringifyCsv };
