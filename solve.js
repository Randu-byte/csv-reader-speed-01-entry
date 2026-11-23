// A fast drop-in for csv-reader 1.0.0 (make.fun's reference CSV reader): run(input) returns exactly csv-reader's
// answer for every input {text, header} — {columns, rows, errors} under its broken-row policy — and spends its time
// scanning with indexOf and slicing fields out of the text instead of building them a character at a time.
//
// The policy, matched exactly: a U+FEFF at the very start is dropped; a record ends at LF or CRLF and a line left
// with no characters is no record; a CR not followed by LF outside quotes is dropped (stray_cr); a field that opens
// with a quote runs to the next quote that is not doubled ("" is one quote, each CRLF or lone CR inside it read as
// LF); what follows the closing quote, up to the next comma or line break, is appended as it stands (quote_junk,
// when the field ends); a quote that never closes is a literal character and the text after it is read again as
// unquoted (unterminated_quote); a quote inside an unquoted field is a literal character; fields stay strings,
// never trimmed or converted; columns is the first record when header is true, else null; rows are padded with ""
// (short_row, with fields: the count) or cut (long_row, with extra: the cut fields) to the first record's width;
// each error is {code, line, row} in the order met, line the 1-based line its record starts on (every LF, CRLF and
// lone CR inside a quoted field counted), row its record's index in rows, null for the header.

const COMMA = 0;
const BREAK = 1;
const END = 2;

/** csv-reader 1.0.0's answer for one case's input, computed faster. */
export function run(input) {
  const text = String(input.text);
  const header = input.header === true;
  const n = text.length;
  const errors = [];
  const rows = [];
  let columns = null;
  let width = -1;

  let pos = 0; // the next character to read
  let line = 1; // the line that character is on
  if (text.charCodeAt(0) === 0xfeff) pos = 1;

  // The record being read: the line it starts on and the index in rows it takes (null: the header).
  let recordLine = 1;
  let recordRow = null;

  // The field just read by parseUnquoted / parseQuoted.
  let fValue = '';
  let fEnded = END;
  let fAdded = 0; // characters parseUnquoted kept (drives quote_junk)

  // The next LF and the next CR at or after a position, cached: each search resumes where the last one stopped,
  // so over a whole call the two searches together walk the text once. -1 means none is left.
  let nextLF = text.indexOf('\n', pos);
  let nextCR = text.indexOf('\r', pos);

  // Reads unquoted characters onto `initial` up to the next comma or line break: a CR not followed by LF is
  // dropped (stray_cr). The field's end is the earliest of the next comma, the next LF and the next CRLF, all
  // found by native searches; a lone CR before them cuts the field into segments that are joined once.
  // Sets fValue, fEnded, fAdded; advances pos and line.
  function parseUnquoted(initial) {
    let pieces = null; // kept segments, only when a stray CR cuts the field
    let segStart = pos;
    let i = pos;
    let added = 0;
    let ended = END;
    let end = n; // where the field's last segment stops
    for (;;) {
      let comma = text.indexOf(',', i);
      if (comma === -1) comma = n + 1; // a sentinel past every real index
      while (nextLF !== -1 && nextLF < i) nextLF = text.indexOf('\n', nextLF + 1);
      while (nextCR !== -1 && nextCR < i) nextCR = text.indexOf('\r', nextCR + 1);
      const lf = nextLF === -1 ? Infinity : nextLF;
      const cr = nextCR === -1 ? Infinity : nextCR;
      if (cr < comma && cr < lf) {
        if (text.charCodeAt(cr + 1) === 10) {
          // A CRLF ends the field.
          ended = BREAK;
          end = cr;
          line += 1;
          pos = cr + 2;
          break;
        }
        // A lone CR is dropped (stray_cr); the field goes on without it.
        errors.push({ code: 'stray_cr', line: recordLine, row: recordRow });
        if (pieces === null) pieces = [];
        pieces.push(text.slice(segStart, cr));
        added += cr - segStart;
        i = cr + 1;
        segStart = i;
        nextCR = text.indexOf('\r', i);
        continue;
      }
      if (lf < comma) {
        ended = BREAK;
        end = lf;
        line += 1;
        pos = lf + 1;
        break;
      }
      if (comma <= n) {
        ended = COMMA;
        end = comma;
        pos = comma + 1;
        break;
      }
      // No comma and no line break left: the field runs to the end of the text.
      ended = END;
      end = n;
      pos = n;
      break;
    }
    added += end - segStart;
    if (pieces === null) {
      fValue = initial === '' ? text.slice(segStart, end) : initial + text.slice(segStart, end);
    } else {
      pieces.push(text.slice(segStart, end));
      fValue = initial + pieces.join('');
    }
    fAdded = added;
    fEnded = ended;
  }

  // Reads a quoted field whose opening quote is at pos. Sets fValue and fEnded; advances pos and line.
  function parseQuoted() {
    const open = pos;
    // Find the closing quote: the next quote that is not doubled. The scan touches no line counter, so a quote
    // that never closes costs nothing to abandon: the reference restores the line count on that path too.
    let close = -1;
    let paired = false; // the scan skipped a doubled quote, so the span holds quotes of its own
    let j = open + 1;
    for (;;) {
      j = text.indexOf('"', j);
      if (j === -1) break;
      if (text.charCodeAt(j + 1) === 34) {
        paired = true;
        j += 2;
        continue;
      }
      close = j;
      break;
    }
    if (close === -1) {
      // The quote never closes: it is a literal character, and the text after it is read again as unquoted.
      errors.push({ code: 'unterminated_quote', line: recordLine, row: recordRow });
      pos = open + 1;
      parseUnquoted('"');
      return;
    }
    const s = open + 1;
    if (!paired) {
      // The span holds no quote of its own. If it holds no CR either, its only specials are LFs, which stay as
      // they are: the value is one slice, and the line count is the LFs in the span, walked on the shared cache.
      while (nextCR !== -1 && nextCR < s) nextCR = text.indexOf('\r', nextCR + 1);
      if (nextCR === -1 || nextCR >= close) {
        while (nextLF !== -1 && nextLF < s) nextLF = text.indexOf('\n', nextLF + 1);
        while (nextLF !== -1 && nextLF < close) {
          line += 1;
          nextLF = text.indexOf('\n', nextLF + 1);
        }
        fValue = text.slice(s, close);
        finishQuoted(close);
        return;
      }
    }
    // Build the value from (open + 1 .. close): "" is one quote, each CRLF or lone CR is one LF, and every line
    // break inside counts a line. Slices between special characters are copied whole.
    let pieces = null;
    let seg = s;
    let i = s;
    while (i < close) {
      const c = text.charCodeAt(i);
      if (c === 34) { // a doubled quote (the close scan guarantees quotes in the span pair up)
        if (pieces === null) pieces = [];
        pieces.push(text.slice(seg, i), '"');
        i += 2;
        seg = i;
        continue;
      }
      if (c === 13) { // CR: CRLF and a lone CR are each one LF
        if (pieces === null) pieces = [];
        pieces.push(text.slice(seg, i), '\n');
        line += 1;
        i += text.charCodeAt(i + 1) === 10 ? 2 : 1;
        seg = i;
        continue;
      }
      if (c === 10) line += 1; // LF stays LF; it rides along in the next slice
      i += 1;
    }
    if (pieces === null) fValue = text.slice(s, close);
    else {
      pieces.push(text.slice(seg, close));
      fValue = pieces.join('');
    }
    finishQuoted(close);
  }

  // What follows a quoted field's closing quote at `close`, with the field's value already in fValue: a comma,
  // a line break, the end of the text, or junk appended as it stands (quote_junk, when the field ends).
  function finishQuoted(close) {
    const after = close + 1;
    if (after >= n) {
      fEnded = END;
      pos = n;
      return;
    }
    const c = text.charCodeAt(after);
    if (c === 44) {
      fEnded = COMMA;
      pos = after + 1;
      return;
    }
    if (c === 10) {
      fEnded = BREAK;
      line += 1;
      pos = after + 1;
      return;
    }
    if (c === 13 && text.charCodeAt(after + 1) === 10) {
      fEnded = BREAK;
      line += 1;
      pos = after + 2;
      return;
    }
    // Junk after the closing quote is appended as it stands, up to the next comma or line break.
    pos = after;
    parseUnquoted(fValue);
    if (fAdded > 0) errors.push({ code: 'quote_junk', line: recordLine, row: recordRow });
  }

  for (;;) {
    // Lines with no characters are no records.
    while (pos < n) {
      const c = text.charCodeAt(pos);
      if (c === 10) {
        pos += 1;
        line += 1;
      } else if (c === 13 && text.charCodeAt(pos + 1) === 10) {
        pos += 2;
        line += 1;
      } else break;
    }
    if (pos >= n) break;

    recordLine = line;
    recordRow = header && columns === null ? null : rows.length;

    const fields = [];
    let quoted = false;
    do {
      quoted = text.charCodeAt(pos) === 34;
      if (quoted) parseQuoted();
      else parseUnquoted('');
      fields.push(fValue);
    } while (fEnded === COMMA);

    // A line that held only stray CRs is left with no characters: no record (its stray_cr errors stay).
    if (fields.length === 1 && fields[0] === '' && !quoted) continue;

    if (width < 0) width = fields.length;
    if (header && columns === null) {
      columns = fields;
      continue;
    }
    if (fields.length < width) {
      errors.push({ code: 'short_row', line: recordLine, row: recordRow, fields: fields.length });
      while (fields.length < width) fields.push('');
    } else if (fields.length > width) {
      errors.push({ code: 'long_row', line: recordLine, row: recordRow, extra: fields.splice(width) });
    }
    rows.push(fields);
  }
  return { columns: header ? (columns ?? []) : null, rows, errors };
}
