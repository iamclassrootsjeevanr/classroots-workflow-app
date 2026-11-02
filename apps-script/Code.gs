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
function locate_(tab, sheetId) {
  var name = tab || DEFAULT_TAB;
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
