/**
 * Classroots Work – Google Sheet sync API (used by the Next.js app's sync job).
 *
 * Setup: Project Settings → Script properties → add SYNC_TOKEN (same value as SYNC_TOKEN in the app's .env).
 * After you edit this file: Deploy → Manage deployments → pencil → New version → Deploy
 *
 * GET  ?action=read&tab=<tab>&token=…[&sheetId=…]  → { tab, headers, rows: [{__row, <header>: value}], all: true }
 * POST {action:'batchUpdate', token, tab, keyColumns:[…], updatedAtColumn, updates:[{key, column, value}][, sheetId]}
 *                                                 → { ok, updated, appended, failed:[{key, column, error}] }
 * POST {action:'ensureValues', token, tab, column, values:[…], sibling}   → { ok, added }   (dropdown lists next to the main tab)
 * POST {action:'ensureRows', token, tab, keyHeader, mode:'fill'|'update', rows:[{key, values:{header:value}}], sibling} → { ok, added, updated }
 * GET  ?action=update&tab&key&field&value&token  → { ok }   (single cell, kept for older app versions)
 *
 * Finding the tab: no spreadsheet id needed. The script looks for the tab in the default tracker (SHEET_ID below); if it is not
 * there it searches the Google Sheets the script owner can open, remembers the one that has it, and uses it from then on.
 * (First run after updating asks you to review permissions: it needs Google Drive access to search.)
 * To pin a tab to a sheet yourself: Script properties → add  TAB_SHEET::<tab name>  =  <spreadsheet id>.
 * sheetId: optional spreadsheet id; when sent it wins over everything above (kept for older app settings).
 * keyColumns: one or more header names; several make a composite key joined with " | " (same as the app).
 */
var SHEET_ID = '1ePpG1_BcsAKehoWnscpqQ8R2r9itzBRDSET9Ox-prjs';
var KEY_SEPARATOR = ' | ';
var DEFAULT_TAB = 'Journeys in Chapters';
var DEFAULT_KEY_COL = 'GxxCxxJxx';

function doGet(e) {
  var p = (e && e.parameter) || {};
  try {
    checkToken_(p.token);
    if (p.action === 'update') {
      return out_(batchUpdate_({
        tab: p.tab, keyColumns: [p.keyColumn || DEFAULT_KEY_COL], sheetId: p.sheetId,
        updates: [{ key: p.key || p.id, column: p.field, value: p.value == null ? '' : p.value }],
      }));
    }
    return out_(readRows_(p.tab || p.sheet || DEFAULT_TAB, p.sheetId));
  } catch (err) {
    return out_({ error: String(err && err.message || err) });
  }
}

function doPost(e) {
  try {
    var body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    checkToken_(body.token);
    if (body.action === 'batchUpdate') return out_(batchUpdate_(body));
    if (body.action === 'ensureValues') return out_(ensureValues_(body));
    if (body.action === 'ensureRows') return out_(ensureRows_(body));
    if (body.action === 'ensureSummary') return out_(ensureSummary_(body));
    return out_({ error: 'Unknown action: ' + body.action });
  } catch (err) {
    return out_({ error: String(err && err.message || err) });
  }
}

function checkToken_(token) {
  var expected = PropertiesService.getScriptProperties().getProperty('SYNC_TOKEN');
  if (expected && token !== expected) throw new Error('Unauthorized');
}

/** Time zone for dates: the spreadsheet's, else the script's, else India (a sheet converted from Excel may have none). */
function tz_(ss) {
  return ss.getSpreadsheetTimeZone() || Session.getScriptTimeZone() || 'Asia/Kolkata';
}

/** The spreadsheet and sheet that hold a tab: explicit id, else the default tracker, else a remembered or discovered one. */
function locate_(tab, sheetId, sibling) {
  var name = tab || DEFAULT_TAB;
  // A tab next to the main tab (Lists, Test Cases, ...): use the spreadsheet that has the main tab, never a same-named tab elsewhere.
  if (sibling) {
    var home = locate_(sibling, sheetId).ss;
    var shSibling = home.getSheetByName(name);
    if (!shSibling) throw new Error('Tab not found: ' + name);
    return { ss: home, sh: shSibling };
  }
  if (sheetId) {
    var given = SpreadsheetApp.openById(sheetId);
    var shGiven = given.getSheetByName(name);
    if (!shGiven) throw new Error('Tab not found: ' + name);
    return { ss: given, sh: shGiven };
  }
  var props = PropertiesService.getScriptProperties();
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var sh = ss.getSheetByName(name);
  if (sh) return { ss: ss, sh: sh };

  var memo = 'TAB_SHEET::' + name;
  var known = props.getProperty(memo);
  if (known) {
    try {
      var remembered = SpreadsheetApp.openById(known);
      var shKnown = remembered.getSheetByName(name);
      if (shKnown) return { ss: remembered, sh: shKnown };
    } catch (err) { /* lost access or deleted: search again */ }
    props.deleteProperty(memo);
  }

  var files = DriveApp.getFilesByType(MimeType.GOOGLE_SHEETS);
  var looked = 0;
  while (files.hasNext() && looked < 150) {
    var f = files.next();
    if (f.getId() === SHEET_ID) continue;
    looked++;
    try {
      var other = SpreadsheetApp.openById(f.getId());
      var shOther = other.getSheetByName(name);
      if (shOther) {
        props.setProperty(memo, f.getId());
        return { ss: other, sh: shOther };
      }
    } catch (err2) { /* not readable: skip */ }
  }
  throw new Error('Tab not found: ' + name + '. It is not in the default spreadsheet or in any Google Sheet this script can open. Share the sheet with the script owner, or add the script property ' + memo + ' = <spreadsheet id>.');
}

/** Composite key of one row: the key columns' trimmed values joined with " | "; '' when any part is blank. */
function rowKey_(values, headers, keyColumns) {
  var parts = [];
  for (var k = 0; k < keyColumns.length; k++) {
    var idx = headers.indexOf(keyColumns[k]);
    if (idx < 0) throw new Error('Key column not found: ' + keyColumns[k]);
    var v = String(values[idx]).trim();
    if (!v) return '';
    parts.push(v);
  }
  return parts.join(KEY_SEPARATOR);
}

/** Dates as yyyy-MM-dd, everything else as displayed text. */
function cellValue_(raw, display, tz) {
  if (Object.prototype.toString.call(raw) === '[object Date]' && !isNaN(raw)) {
    return Utilities.formatDate(raw, tz, 'yyyy-MM-dd');
  }
  return display;
}

function readRows_(tab, sheetId) {
  var loc = locate_(tab, sheetId);
  var sh = loc.sh;
  var range = sh.getDataRange();
  var raw = range.getValues();
  var display = range.getDisplayValues();
  var tz = tz_(loc.ss);
  if (!raw.length) return { tab: tab, headers: [], rows: [], all: true };
  var headers = display[0].map(function (h) { return String(h).trim(); });
  var rows = [];
  for (var i = 1; i < raw.length; i++) {
    var empty = true;
    var obj = { __row: i + 1 };
    for (var j = 0; j < headers.length; j++) {
      if (!headers[j]) continue;
      var v = cellValue_(raw[i][j], display[i][j], tz);
      if (String(v).trim() !== '') empty = false;
      obj[headers[j]] = v;
    }
    if (!empty) rows.push(obj);
  }
  return { tab: tab, headers: headers, rows: rows, all: true, updated: new Date().toISOString() };
}

function batchUpdate_(body) {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var loc = locate_(body.tab, body.sheetId);
    var sh = loc.sh;
    var values = sh.getDataRange().getDisplayValues();
    var headers = values[0].map(function (h) { return String(h).trim(); });
    var keyColumns = body.keyColumns && body.keyColumns.length ? body.keyColumns : [body.keyColumn || DEFAULT_KEY_COL];
    var keyIdxs = keyColumns.map(function (c) { return headers.indexOf(c); });
    if (keyIdxs.indexOf(-1) >= 0) throw new Error('Key column not found: ' + keyColumns[keyIdxs.indexOf(-1)]);

    var updatedAtIdx = body.updatedAtColumn ? headers.indexOf(body.updatedAtColumn) : -1;
    if (body.updatedAtColumn && updatedAtIdx < 0) {
      // Add the column once so app writes are visible in the sheet.
      updatedAtIdx = headers.length;
      sh.getRange(1, updatedAtIdx + 1).setValue(body.updatedAtColumn);
      headers.push(body.updatedAtColumn);
    }

    var rowByKey = {};
    for (var i = 1; i < values.length; i++) {
      var k = rowKey_(values[i], headers, keyColumns);
      if (k) rowByKey[k] = i + 1;
    }

    var updated = 0, appended = 0, failed = [];
    var stamp = Utilities.formatDate(new Date(), tz_(loc.ss), 'yyyy-MM-dd HH:mm:ss');
    (body.updates || []).forEach(function (u) {
      var key = String(u.key || '').trim();
      var col = headers.indexOf(String(u.column || '').trim());
      if (!key) { failed.push({ key: key, column: u.column, error: 'missing key' }); return; }
      if (col < 0) { failed.push({ key: key, column: u.column, error: 'column not found' }); return; }
      try {
        var row = rowByKey[key];
        if (!row) {
          // New row from the app: write each key part into its column.
          row = sh.getLastRow() + 1;
          var parts = key.split(KEY_SEPARATOR);
          for (var kc = 0; kc < keyIdxs.length; kc++) setCell_(sh.getRange(row, keyIdxs[kc] + 1), parts[kc] || '');
          rowByKey[key] = row;
          appended++;
        }
        setCell_(sh.getRange(row, col + 1), u.value == null ? '' : String(u.value));
        if (updatedAtIdx >= 0) setCell_(sh.getRange(row, updatedAtIdx + 1), stamp);
        updated++;
      } catch (err) {
        failed.push({ key: key, column: u.column, error: String(err && err.message || err) });
      }
    });
    SpreadsheetApp.flush();
    return { ok: failed.length === 0, updated: updated, appended: appended, failed: failed };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Write a cell without changing the sheet's design. Normally the value is valid (the Lists tab is updated first, so a new APK version
 * is already in its dropdown). If a cell's validation still rejects it (e.g. a fixed inline list), the rule is lifted for that one write
 * and the very same rule is put back straight after, so dropdowns look and behave exactly as before.
 */
function setCell_(range, value) {
  try {
    range.setValue(value);
  } catch (err) {
    if (!/validation/i.test(String(err && err.message || err))) throw err;
    var rule = range.getDataValidation();
    range.clearDataValidations();
    try {
      range.setValue(value);
    } finally {
      if (rule) range.setDataValidation(rule);
    }
  }
}

/** Last row (1-based) that has something in column `col` (0-based) of `values`; 1 = only the header. */
function lastFilled_(values, col) {
  for (var i = values.length - 1; i >= 1; i--) if (String(values[i][col]).trim() !== '') return i + 1;
  return 1;
}

/** Linked tab, step 1: make sure each value exists in a list column (e.g. the new APK version in Lists → APK Versions). */
function ensureValues_(body) {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var sh = locate_(body.tab, body.sheetId, body.sibling).sh;
    var values = sh.getDataRange().getDisplayValues();
    var headers = values[0].map(function (h) { return String(h).trim(); });
    var col = headers.indexOf(String(body.column).trim());
    if (col < 0) throw new Error('Column not found: ' + body.column);
    // A column filled by a formula (e.g. FILTER over another tab) fills itself; typing into it would break the formula.
    if (sh.getRange(2, col + 1).getFormula()) return { ok: true, added: 0, updated: 0, skipped: 'column is a formula' };
    var have = {};
    for (var i = 1; i < values.length; i++) have[String(values[i][col]).trim()] = true;
    var row = lastFilled_(values, col), added = 0;
    (body.values || []).forEach(function (v) {
      v = String(v).trim();
      if (!v || have[v]) return;
      row++;
      setCell_(sh.getRange(row, col + 1), v);
      have[v] = true;
      added++;
    });
    SpreadsheetApp.flush();
    return { ok: true, added: added, updated: 0 };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Linked tab, step 2: make sure each key has a row in a reference table (Test Cases, APK Releases).
 * mode 'fill' only fills empty cells of an existing row; 'update' also keeps the cells in step with the app.
 */
function ensureRows_(body) {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var sh = locate_(body.tab, body.sheetId, body.sibling).sh;
    var values = sh.getDataRange().getDisplayValues();
    var headers = values[0].map(function (h) { return String(h).trim(); });
    var keyCol = headers.indexOf(String(body.keyHeader).trim());
    if (keyCol < 0) throw new Error('Column not found: ' + body.keyHeader);
    var rowOf = {};
    for (var i = 1; i < values.length; i++) { var k = String(values[i][keyCol]).trim(); if (k) rowOf[k] = i + 1; }
    var next = lastFilled_(values, keyCol), added = 0, updated = 0;
    (body.rows || []).forEach(function (r) {
      var key = String(r.key).trim();
      if (!key) return;
      var row = rowOf[key];
      if (!row) {
        row = ++next;
        setCell_(sh.getRange(row, keyCol + 1), key);
        rowOf[key] = row;
        added++;
      }
      var touched = false;
      Object.keys(r.values || {}).forEach(function (header) {
        var col = headers.indexOf(String(header).trim());
        if (col < 0) return;
        var want = String(r.values[header]);
        var current = String(sh.getRange(row, col + 1).getDisplayValue()).trim();
        if (current === want) return;
        if (current !== '' && body.mode !== 'update') return;
        setCell_(sh.getRange(row, col + 1), want);
        touched = true;
      });
      if (touched) updated++;
    });
    SpreadsheetApp.flush();
    return { ok: true, added: added, updated: updated };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Linked tab, step 3: a summary table with one formula row per release and a Total row underneath (Version Summary).
 * A build with no row yet gets a copy of the last row (formulas move down by one, so it points at the next release) and the
 * Total row's ranges grow by one. Nothing else in the sheet is touched.
 */
function ensureSummary_(body) {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var sh = locate_(body.tab, body.sheetId, body.sibling).sh;
    var display = sh.getDataRange().getDisplayValues();
    var hr = -1, kc = -1;
    for (var r = 0; r < display.length && hr < 0; r++) {
      for (var c = 0; c < display[r].length; c++) {
        if (String(display[r][c]).trim() === String(body.keyHeader).trim()) { hr = r; kc = c; break; }
      }
    }
    if (hr < 0) throw new Error('Column not found: ' + body.keyHeader);
    var covered = {}, last = hr, total = -1, spare = false;
    for (var i = hr + 1; i < display.length; i++) {
      var v = String(display[i][kc]).trim();
      if (v === String(body.totalLabel).trim()) { total = i; break; }
      if (v === '') { spare = true; continue; }
      covered[v] = true;
      last = i;
    }
    if (last === hr) return { ok: true, added: 0, updated: 0, skipped: 'no rows to copy' };
    var added = 0;
    (body.values || []).forEach(function (version) {
      version = String(version).trim();
      if (!version || covered[version]) return;
      if (spare) return; // the table already has an empty prepared row for it
      var lastRow = last + 1;                       // 1-based
      var cols = sh.getLastColumn();
      sh.insertRowAfter(lastRow);
      sh.getRange(lastRow, 1, 1, cols).copyTo(sh.getRange(lastRow + 1, 1, 1, cols));
      if (total >= 0) {
        var totalRow = total + 2;                   // shifted down by the insert
        var range = sh.getRange(totalRow, 1, 1, cols);
        var formulas = range.getFormulas();
        for (var k = 0; k < cols; k++) {
          var f = formulas[0][k];
          if (!f) continue;
          formulas[0][k] = f.replace(/(\$?[A-Z]{1,3}\$?)(\d+):(\$?[A-Z]{1,3}\$?)(\d+)/g, function (m, a, b, c2, d) {
            return Number(d) === lastRow ? a + b + ':' + c2 + (lastRow + 1) : m;
          });
        }
        range.setFormulas(formulas);
        total++;
      }
      last++;
      covered[version] = true;
      added++;
    });
    SpreadsheetApp.flush();
    return { ok: true, added: added, updated: 0 };
  } finally {
    lock.releaseLock();
  }
}

function out_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
