/**
 * Helper function to extract the URL for the next page from the Link header. 3
 *
 * Helper used internally by performCanvasApiOperation to parse the HTTP Link header returned by 
 * Canvas and find the URL for the next page of results during pagination 4.
 *
 * @param {string} linkHeader The HTTP Link header value from the Canvas API response.
 * @returns {string|null} The URL for the next page, or null if not found.
 */
function getNextUrl(linkHeader) {
  if (!linkHeader) {
    return null;
  }

  var parts = linkHeader.split(',');
  for (var i = 0; i < parts.length; i++) {
    var part = parts[i].trim();
    if (part.indexOf('rel="next"') !== -1) {
      var match = part.match(/<([^>]+)>/);
      if (match && match[1]) {
        return match[1];
      }
    }
  }
  return null;
}