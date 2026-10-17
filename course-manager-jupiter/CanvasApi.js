/**
 * CanvasApi.js
 * Purpose: the project's one Canvas request helper (read-only), and the
 *   "Test Canvas connection" menu item. Every Canvas read goes through canvasGet_().
 * Canvas endpoints called: whatever path a caller passes to canvasGet_();
 *   the connection test calls GET /api/v1/users/self.
 * Canvas write operations: none. (Writes will go through canvasWrite_(), not here.)
 * Required User/Script Properties: reads User Properties CANVAS_BASE_URL and CANVAS_TOKEN.
 *
 * Error messages name the problem type only. They never include the token, the request
 * path or query (which could contain IDs), or anything Canvas sent back.
 */

const CANVAS_PAGE_SIZE = 100;
const CANVAS_MAX_PAGES = 200;
const CANVAS_MAX_ATTEMPTS = 4;
const CANVAS_RATE_LIMIT_FLOOR = 100;
const CANVAS_PAUSE_MS = 2000;

/** Adds this file's menu items. Called by onOpen. */
function addCanvasApiMenuItems_(menu) {
  menu.addItem('Test Canvas connection', 'testCanvasConnection');
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
