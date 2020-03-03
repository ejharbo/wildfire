var jsonResponsePlugin = function(yasr) {
  var plugin = {};
  var options = $.extend(true, {}, {});
  var json = null;
  var draw = function() {
    var jsonOptions = {};
    jsonOptions.value = yasr.results.getOriginalResponseAsString();

    var mode = yasr.results.getType();
    if (mode) {
      if (mode == "json") {
        mode = {
          name: "javascript",
          json: true
        };
      }
      jsonOptions.mode = mode;
    }

    $(yasr.resultsContainer.get()[0]).append(jsonOptions.value);
  };
  var canHandleResults = function() {
    if (!yasr.results) return false;
    if (!yasr.results.getOriginalResponseAsString) return false;
    var response = yasr.results.getOriginalResponseAsString();
    if ((!response || response.length == 0) && yasr.results.getException()) return false; //in this case, show exception instead, as we have nothing to show anyway
    return true;
  };

  var getDownloadInfo = function() {
    if (!yasr.results) return null;
    var contentType = yasr.results.getOriginalContentType();
    var type = yasr.results.getType();
    return {
      getContent: function() {
        return yasr.results.getOriginalResponse();
      },
      filename: "queryResults" + (type ? "." + type : ""),
      contentType: contentType ? contentType : "text/plain",
      buttonTitle: "Download response"
    };
  };

  return {
    draw: draw,
    name: "JSON",
    canHandleResults: canHandleResults,
    getPriority: 2,
    getDownloadInfo: getDownloadInfo
  };
};
