/**
 * CanvasApi.js
 * Purpose: the project's Canvas request helpers and their menu items. Every Canvas read
 *   goes through canvasGet_(); every Canvas write goes through canvasWrite_(), which
 *   only sends when the DRY_RUN Script Property is exactly "false". Menu items: "Test
 *   Canvas connection", "Dry run: show status", "Dry run: switch on/off", and the
 *   temporary "Test dry-run write" (remove in reorder step 4).
 * Canvas endpoints called: whatever path a caller passes to canvasGet_() or
 *   canvasWrite_(); the connection test calls GET /api/v1/users/self.
 * Canvas write operations: canvasWrite_() sends POST/PUT/PATCH/DELETE for its callers.
 *   No caller sends a real write yet; the test item runs only while dry run is ON.
 * Required User/Script Properties: reads User Properties CANVAS_BASE_URL and CANVAS_TOKEN;
 *   reads and writes Script Property DRY_RUN (unset means dry run is ON).
 *
 * Error messages name the problem type only. They never include the token, the request
 * path or query (which could contain IDs), or anything Canvas sent back. Dry-run logs
 * show the method, the path with every number replaced by ":id", and field names only.
 */

const CANVAS_PAGE_SIZE = 100;
const CANVAS_MAX_PAGES = 200;
const CANVAS_MAX_ATTEMPTS = 4;
const CANVAS_RATE_LIMIT_FLOOR = 100;
const CANVAS_PAUSE_MS = 2000;
const CANVAS_WRITE_METHODS = Object.freeze(['POST', 'PUT', 'PATCH', 'DELETE']);
const PROP_DRY_RUN = 'DRY_RUN';

/** Adds this file's menu items. Called by onOpen. */
function addCanvasApiMenuItems_(menu) {
  menu.addItem('Test Canvas connection', 'testCanvasConnection');
  menu.addItem('Dry run: show status', 'showDryRunStatus');
  menu.addItem('Dry run: switch on/off', 'toggleDryRun');
  menu.addItem('Test dry-run write (temporary)', 'testDryRunWrite');
}

/**
 * Menu: Course Manager › Test Canvas connection.
 * Reads the user's own Canvas profile and reports only "Connected" or the error type.
 */
function testCanvasConnection() {
  const ui = SpreadsheetApp.getUi();
  try {
    canvasGet_('/users/self');
    ui.alert('Test Canvas connection', 'Connected', ui.ButtonSet.OK);
  } catch (error) {
    console.error('Canvas connection test failed: ' + (error.canvasType || 'UNEXPECTED'));
    ui.alert('Test Canvas connection', 'Not connected. ' + describeCanvasError_(error),
      ui.ButtonSet.OK);
  }
}

/**
 * GETs a Canvas API path, for example canvasGet_('/courses', {'state[]': 'available'}).
 * Adds per_page=100. If Canvas returns a list, follows every "next" page and returns
 * one combined array; otherwise returns the single object.
 */
function canvasGet_(path, query) {
  const creds = getCanvasCredentials_();
  const options = {
    method: 'get',
    headers: { Authorization: 'Bearer ' + creds.token, Accept: 'application/json' },
    muteHttpExceptions: true,
  };
  let url = buildCanvasUrl_(creds.baseUrl, path, query);
  let items = [];
  for (let page = 1; url; page++) {
    if (page > CANVAS_MAX_PAGES) {
      throw canvasError_('TOO_MANY_PAGES', `Stopped after ${CANVAS_MAX_PAGES} pages.`);
    }
    const response = fetchCanvas_(url, options);
    const data = parseCanvasJson_(response);
    if (!Array.isArray(data)) return data;
    items = items.concat(data);
    url = getCanvasNextUrl_(response.getHeaders(), creds.baseUrl);
  }
  return items;
}

/**
 * The only way to change anything in Canvas. method is POST, PUT, PATCH, or DELETE;
 * path is like '/courses/123/assignments/456'; payload is sent as JSON.
 * While dry run is ON (the default), logs what would be sent and returns
 * { dryRun: true } without contacting Canvas. Otherwise sends the request with the
 * shared retry, back-off, and response checks, and returns Canvas's reply.
 */
function canvasWrite_(method, path, payload) {
  const verb = String(method).toUpperCase();
  if (!CANVAS_WRITE_METHODS.includes(verb)) {
    throw canvasError_('BAD_METHOD', 'canvasWrite_ only sends POST, PUT, PATCH, or DELETE.');
  }
  const cleanPath = path.startsWith('/') ? path : '/' + path;
  if (isDryRun_()) {
    const fields = describeFields_(payload);
    console.log(`DRY RUN: would ${verb} ${cleanPath.replace(/\d+/g, ':id')}` +
      ` (fields: ${fields.length ? fields.join(', ') : 'none'})`);
    return { dryRun: true };
  }

  const creds = getCanvasCredentials_();
  const options = {
    method: verb.toLowerCase(),
    headers: { Authorization: 'Bearer ' + creds.token, Accept: 'application/json' },
    muteHttpExceptions: true,
  };
  if (payload !== undefined) {
    options.contentType = 'application/json';
    options.payload = JSON.stringify(payload);
  }
  const response = fetchCanvas_(creds.baseUrl + '/api/v1' + cleanPath, options);
  return response.getContentText() ? parseCanvasJson_(response) : {};
}

/** True unless the DRY_RUN Script Property is exactly "false" (any case). Fails safe. */
function isDryRun_() {
  const value = PropertiesService.getScriptProperties().getProperty(PROP_DRY_RUN);
  return String(value).trim().toLowerCase() !== 'false';
}

/** Field names in a payload, e.g. ['assignment[position]']. Never the values. */
function describeFields_(payload, prefix) {
  if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
    return prefix ? [prefix] : [];
  }
  return Object.entries(payload).flatMap(([key, value]) =>
    describeFields_(value, prefix ? `${prefix}[${key}]` : key));
}

/** Menu: Course Manager › Dry run: show status. */
function showDryRunStatus() {
  const ui = SpreadsheetApp.getUi();
  try {
    ui.alert('Dry run', describeDryRun_(isDryRun_()), ui.ButtonSet.OK);
  } catch (error) {
    console.error('Dry run status failed: ' + error.message);
    ui.alert('Could not read the dry-run setting: ' + error.message);
  }
}

/** Menu: Course Manager › Dry run: switch on/off. Asks first, then confirms the result. */
function toggleDryRun() {
  const ui = SpreadsheetApp.getUi();
  try {
    const dryRunOn = isDryRun_();
    const question = dryRunOn ?
      'Dry run is ON now.\n\nIf you turn it off, changes WILL be sent to Canvas until ' +
        'you turn dry run back on.\n\nTurn dry run OFF?' :
      'Dry run is OFF now: changes are being sent to Canvas.\n\nTurn dry run ON?';
    const answer = ui.alert(dryRunOn ? 'Turn dry run OFF?' : 'Turn dry run ON?',
      question, ui.ButtonSet.YES_NO);
    if (answer !== ui.Button.YES) {
      ui.alert('Dry run', 'No change. ' + describeDryRun_(dryRunOn), ui.ButtonSet.OK);
      return;
    }
    PropertiesService.getScriptProperties()
      .setProperty(PROP_DRY_RUN, dryRunOn ? 'false' : 'true');
    console.log('Dry run switched ' + (dryRunOn ? 'OFF.' : 'ON.'));
    ui.alert('Dry run', describeDryRun_(!dryRunOn), ui.ButtonSet.OK);
  } catch (error) {
    console.error('Dry run switch failed: ' + error.message);
    ui.alert('Could not change the dry-run setting: ' + error.message);
  }
}

function describeDryRun_(dryRunOn) {
  return dryRunOn ?
    'Dry run is ON. Changes are only logged; nothing is sent to Canvas.' :
    'Dry run is OFF. Changes WILL be sent to Canvas.';
}

/**
 * Menu: Course Manager › Test dry-run write (temporary; remove in reorder step 4).
 * Refuses unless dry run is ON, then calls canvasWrite_ once with a made-up assignment
 * so the "DRY RUN: would PUT ..." line appears under Executions. Never sends anything.
 */
function testDryRunWrite() {
  const ui = SpreadsheetApp.getUi();
  try {
    if (!isDryRun_()) {
      ui.alert('Test dry-run write', 'Dry run is OFF, so this test will not run. ' +
        'Turn dry run ON first.', ui.ButtonSet.OK);
      return;
    }
    const result = canvasWrite_('PUT', '/courses/0/assignments/0', { assignment: { position: 1 } });
    ui.alert('Test dry-run write', result.dryRun ?
      'Nothing was sent. See Extensions › Apps Script › Executions for the "DRY RUN" line.' :
      'Unexpected: the test was not a dry run.', ui.ButtonSet.OK);
  } catch (error) {
    console.error('Test dry-run write failed: ' + (error.canvasType || error.message));
    ui.alert('Test dry-run write', 'The test could not run. ' + describeCanvasError_(error),
      ui.ButtonSet.OK);
  }
}

/** Reads the saved address and token. Clear message if either is missing. */
function getCanvasCredentials_() {
  const props = PropertiesService.getUserProperties();
  const token = props.getProperty(PROP_TOKEN);
  const baseUrl = props.getProperty(PROP_BASE_URL);
  if (!token || !baseUrl) {
    throw canvasError_('NOT_SET_UP',
      'Your Canvas address or token is not saved yet. Run Course Manager › Set Canvas token.');
  }
  return { token, baseUrl };
}

/** Builds https://host/api/v1/path?per_page=100&... from a path and query object. */
function buildCanvasUrl_(baseUrl, path, query) {
  const params = Object.assign({ per_page: CANVAS_PAGE_SIZE }, query || {});
  const parts = [];
  Object.entries(params).forEach(([key, value]) => {
    [].concat(value).forEach(v => {
      parts.push(encodeURIComponent(key) + '=' + encodeURIComponent(v));
    });
  });
  const cleanPath = path.startsWith('/') ? path : '/' + path;
  return baseUrl + '/api/v1' + cleanPath + '?' + parts.join('&');
}

/**
 * Sends one request. Retries a few times if Canvas says it is busy, and pauses
 * when X-Rate-Limit-Remaining runs low.
 */
function fetchCanvas_(url, options) {
  for (let attempt = 1; attempt <= CANVAS_MAX_ATTEMPTS; attempt++) {
    let response;
    try {
      response = UrlFetchApp.fetch(url, options);
    } catch {
      throw canvasError_('UNREACHABLE',
        'Could not reach Canvas. Check the Canvas address in Set Canvas token.');
    }
    const code = response.getResponseCode();
    const throttled = code === 429 ||
      (code === 403 && /rate limit exceeded/i.test(response.getContentText()));
    if (throttled && attempt < CANVAS_MAX_ATTEMPTS) {
      Utilities.sleep(CANVAS_PAUSE_MS * attempt);
      continue;
    }
    checkCanvasResponse_(code, throttled);
    const remaining = Number(getHeader_(response.getHeaders(), 'X-Rate-Limit-Remaining'));
    if (!isNaN(remaining) && remaining < CANVAS_RATE_LIMIT_FLOOR) {
      Utilities.sleep(CANVAS_PAUSE_MS);
    }
    return response;
  }
  throw canvasError_('RATE_LIMITED', 'Canvas is busy. Wait a minute and try again.');
}

/** Turns a non-2xx response code into a clear error. */
function checkCanvasResponse_(code, throttled) {
  if (code >= 200 && code < 300) return;
  if (throttled) {
    throw canvasError_('RATE_LIMITED', 'Canvas is busy. Wait a minute and try again.');
  }
  if (code === 401) {
    throw canvasError_('TOKEN_REJECTED', 'Canvas did not accept your token (401). ' +
      'It may be expired or mistyped. Run Course Manager › Set Canvas token.');
  }
  if (code === 403) {
    throw canvasError_('NOT_ALLOWED',
      'Canvas says your account is not allowed to do this (403).');
  }
  if (code === 404) {
    throw canvasError_('NOT_FOUND', 'Canvas could not find what was asked for (404).');
  }
  throw canvasError_('HTTP_' + code, `Canvas returned an error (HTTP ${code}).`);
}

function parseCanvasJson_(response) {
  try {
    return JSON.parse(response.getContentText());
  } catch {
    throw canvasError_('BAD_RESPONSE', 'Canvas sent a reply that was not readable data.');
  }
}

/**
 * Finds the rel="next" URL in the Link header (ported from the legacy getNextUrl).
 * Refuses a next link to any other site, so the token is only ever sent to Canvas.
 */
function getCanvasNextUrl_(headers, baseUrl) {
  const link = getHeader_(headers, 'Link');
  if (!link) return null;
  for (const part of String(link).split(',')) {
    if (part.indexOf('rel="next"') === -1) continue;
    const match = part.match(/<([^>]+)>/);
    if (!match) return null;
    if (!match[1].startsWith(baseUrl + '/')) {
      throw canvasError_('BAD_NEXT_LINK', 'Canvas sent a next-page link to a different site. Stopped.');
    }
    return match[1];
  }
  return null;
}

/** Header lookup that ignores capitalization (Link vs link). */
function getHeader_(headers, name) {
  const wanted = name.toLowerCase();
  const entry = Object.entries(headers).find(([key]) => key.toLowerCase() === wanted);
  return entry ? entry[1] : undefined;
}

function canvasError_(type, message) {
  const error = new Error(message);
  error.canvasType = type;
  return error;
}

/** Message for the user: the Canvas error's own message, or a generic one. */
function describeCanvasError_(error) {
  return error.canvasType ? error.message : 'Unexpected error. See Extensions › Apps Script › Executions.';
}
