const WALLET_SHEET_ID = '16cELFn6q08ITvp8uT-3PKHfsAf-R7wIMNH6t6DgTd5U';
const WALLET_SHEETS = { accounts: 'Wallet_Accounts', transactions: 'Wallet_Transactions', requests: 'Wallet_Requests' };

/** Run once before deploying the web app. */
function setupWalletDatabase() {
  const ss = SpreadsheetApp.openById(WALLET_SHEET_ID);
  ensureSheet_(ss, WALLET_SHEETS.accounts, ['wallet_id', 'display_name', 'status', 'created_at']);
  ensureSheet_(ss, WALLET_SHEETS.transactions, ['transaction_id', 'external_id', 'wallet_id', 'type', 'amount', 'note', 'source', 'status', 'created_at']);
  ensureSheet_(ss, WALLET_SHEETS.requests, ['request_id', 'wallet_id', 'amount', 'note', 'status', 'created_at']);
  const accounts = ss.getSheetByName(WALLET_SHEETS.accounts);
  if (accounts.getLastRow() === 1) accounts.appendRow(['uyen', 'Uyen Nguyen', 'active', new Date()]);
}

function doGet(e) {
  try { if (String((e.parameter && e.parameter.action) || 'wallet') !== 'wallet') throw new Error('Unsupported action'); return json_({ ok: true, data: getWallet_(required_(e.parameter.walletId, 'walletId')) }); }
  catch (error) { return json_({ ok: false, error: error.message }); }
}

function doPost(e) {
  try {
    const body = e.parameter || {}; const action = String(body.action || '');
    if (action === 'request') return json_({ ok: true, data: createRequest_(body) });
    if (action === 'spend') return json_({ ok: true, data: spendFromWallet_(body) });
    if (action === 'credit') return json_({ ok: true, data: creditFromMainApp_(body) });
    if (action === 'debit') return json_({ ok: true, data: debitFromMainApp_(body) });
    throw new Error('Unsupported action');
  } catch (error) { return json_({ ok: false, error: error.message }); }
}

function getWallet_(walletId) {
  const ss = SpreadsheetApp.openById(WALLET_SHEET_ID);
  const account = rowsAsObjects_(ss.getSheetByName(WALLET_SHEETS.accounts)).find((row) => String(row.wallet_id) === walletId && String(row.status).toLowerCase() === 'active');
  if (!account) throw new Error('Wallet not found');
  const transactions = rowsAsObjects_(ss.getSheetByName(WALLET_SHEETS.transactions))
    .filter((row) => String(row.wallet_id) === walletId && String(row.status).toLowerCase() === 'posted')
    .map((row) => ({ id: String(row.transaction_id), type: String(row.type).toLowerCase(), amount: Number(row.amount || 0), note: String(row.note || ''), source: String(row.source || ''), createdAt: iso_(row.created_at) }))
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  const balance = transactions.reduce((sum, item) => sum + (item.type === 'credit' ? item.amount : -item.amount), 0);
  return { walletId, displayName: String(account.display_name || walletId), balance: Math.max(0, balance), updatedAt: new Date().toISOString(), transactions: transactions.slice(0, 50) };
}

function createRequest_(body) {
  const walletId = required_(body.walletId, 'walletId'); const amount = positiveAmount_(body.amount); const note = required_(body.note, 'note').slice(0, 180);
  const ss = SpreadsheetApp.openById(WALLET_SHEET_ID); assertActiveWallet_(ss, walletId); const requestId = Utilities.getUuid();
  ss.getSheetByName(WALLET_SHEETS.requests).appendRow([requestId, walletId, amount, note, 'pending', new Date()]);
  return { requestId, status: 'pending' };
}

function creditFromMainApp_(body) { verifyMainAppKey_(body.apiKey); return postTransaction_(body, 'credit'); }
function debitFromMainApp_(body) { verifyMainAppKey_(body.apiKey); const amount = positiveAmount_(body.amount); if (amount > getWallet_(required_(body.walletId, 'walletId')).balance) throw new Error('Insufficient balance'); return postTransaction_(Object.assign({}, body, { amount }), 'debit'); }

function spendFromWallet_(body) {
  const lock = LockService.getScriptLock(); lock.waitLock(10000);
  try {
    const walletId = required_(body.walletId, 'walletId'); const amount = positiveAmount_(body.amount); const note = required_(body.note, 'note').slice(0, 180);
    if (amount > getWallet_(walletId).balance) throw new Error('Insufficient balance');
    return postTransaction_({ walletId, amount, note, externalId: 'UYEN-' + Utilities.getUuid(), source: 'Uyen.M' }, 'debit');
  } finally { lock.releaseLock(); }
}

function postTransaction_(body, type) {
  const walletId = required_(body.walletId, 'walletId'); const externalId = required_(body.externalId, 'externalId'); const amount = positiveAmount_(body.amount);
  const ss = SpreadsheetApp.openById(WALLET_SHEET_ID); assertActiveWallet_(ss, walletId); const sheet = ss.getSheetByName(WALLET_SHEETS.transactions);
  if (rowsAsObjects_(sheet).some((row) => String(row.external_id) === externalId)) throw new Error('Duplicate externalId');
  const transactionId = Utilities.getUuid();
  sheet.appendRow([transactionId, externalId, walletId, type, amount, String(body.note || (type === 'credit' ? 'รับเงินจากแอปเงินรวม' : 'จ่ายเงิน')).slice(0, 180), String(body.source || 'แอปเงินรวม').slice(0, 80), 'posted', new Date()]);
  return { transactionId, externalId, type, amount };
}

function verifyMainAppKey_(candidate) { const expected = PropertiesService.getScriptProperties().getProperty('MAIN_APP_API_KEY'); if (!expected || String(candidate || '') !== expected) throw new Error('Unauthorized main app'); }
function assertActiveWallet_(ss, walletId) { if (!rowsAsObjects_(ss.getSheetByName(WALLET_SHEETS.accounts)).some((row) => String(row.wallet_id) === walletId && String(row.status).toLowerCase() === 'active')) throw new Error('Wallet not found'); }
function ensureSheet_(ss, name, headers) { const sheet = ss.getSheetByName(name) || ss.insertSheet(name); if (sheet.getLastRow() === 0) { sheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold').setBackground('#171717').setFontColor('#ffffff'); sheet.setFrozenRows(1); } return sheet; }
function rowsAsObjects_(sheet) { if (!sheet || sheet.getLastRow() < 2) return []; const values = sheet.getDataRange().getValues(); const headers = values.shift().map(String); return values.filter((row) => row.some((value) => value !== '')).map((row) => headers.reduce((out, key, index) => { out[key] = row[index]; return out; }, {})); }
function positiveAmount_(value) { const amount = Number(value); if (!Number.isFinite(amount) || amount <= 0) throw new Error('Amount must be greater than zero'); return Math.round(amount * 100) / 100; }
function required_(value, label) { const text = String(value == null ? '' : value).trim(); if (!text) throw new Error(label + ' is required'); return text; }
function iso_(value) { const date = value instanceof Date ? value : new Date(value); return Number.isNaN(date.getTime()) ? new Date(0).toISOString() : date.toISOString(); }
function json_(payload) { return ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(ContentService.MimeType.JSON); }


