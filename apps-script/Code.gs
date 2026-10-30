/**
 * Classroots Work – Google Sheet sync API (used by the Next.js app's sync job).
 *
 * Setup: Project Settings → Script properties → add SYNC_TOKEN (same value as SYNC_TOKEN in the app's .env).
 * After you edit this file: Deploy → Manage deployments → pencil → New version → Deploy
 *
 * GET  ?action=read&tab=<tab>&token=…[&sheetId=…]  → { tab, headers, rows: [{__row, <header>: value}], all: true }
 * POST {action:'batchUpdate', token, tab, keyColumns:[…], updatedAtColumn, updates:[{key, column, value}][, sheetId]}
 *                                                 → { ok, updated, appended, failed:[{key, column, error}] }
 * GET  ?action=update&tab&key&field&value&token  → { ok }   (single cell, kept for older app versions)
 *
 * sheetId: optional spreadsheet id, so one deployment can serve several trackers (the script owner must have access).
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
    return out_({ error: 'Unknown action: ' + body.action });
  } catch (err) {
    return out_({ error: String(err && err.message || err) });
  }
}

function checkToken_(token) {
  var expected = PropertiesService.getScriptProperties().getProperty('SYNC_TOKEN');
  if (expected && token !== expected) throw new Error('Unauthorized');
}

function spreadsheet_(sheetId) {
  return SpreadsheetApp.openById(sheetId || SHEET_ID);
}

function sheet_(tab, sheetId) {
  var sh = spreadsheet_(sheetId).getSheetByName(tab || DEFAULT_TAB);
  if (!sh) throw new Error('Tab not found: ' + tab);
  return sh;
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
  var sh = sheet_(tab, sheetId);
  var range = sh.getDataRange();
  var raw = range.getValues();
  var display = range.getDisplayValues();
  var tz = spreadsheet_(sheetId).getSpreadsheetTimeZone();
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
    var sh = sheet_(body.tab, body.sheetId);
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
    var stamp = Utilities.formatDate(new Date(), spreadsheet_(body.sheetId).getSpreadsheetTimeZone(), 'yyyy-MM-dd HH:mm:ss');
    (body.updates || []).forEach(function (u) {
      var key = String(u.key || '').trim();
      var col = headers.indexOf(String(u.column || '').trim());
      if (!key) { failed.push({ key: key, column: u.column, error: 'missing key' }); return; }
      if (col < 0) { failed.push({ key: key, column: u.column, error: 'column not found' }); return; }
      var row = rowByKey[key];
      if (!row) {
        // New row from the app: write each key part into its column.
        row = sh.getLastRow() + 1;
        var parts = key.split(KEY_SEPARATOR);
        for (var kc = 0; kc < keyIdxs.length; kc++) sh.getRange(row, keyIdxs[kc] + 1).setValue(parts[kc] || '');
        rowByKey[key] = row;
        appended++;
      }
      sh.getRange(row, col + 1).setValue(u.value == null ? '' : String(u.value));
      if (updatedAtIdx >= 0) sh.getRange(row, updatedAtIdx + 1).setValue(stamp);
      updated++;
    });
    SpreadsheetApp.flush();
    return { ok: failed.length === 0, updated: updated, appended: appended, failed: failed };
  } finally {
    lock.releaseLock();
  }
}

function out_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
