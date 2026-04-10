(function () {
  "use strict";

  var tool = window.BrimotTool;
  var form = document.getElementById("configForm");
  var resetBtn = document.getElementById("resetConfig");

  var fields = [
    "standardHourlyRate",
    "diogeneHourlyRate",
    "endOfLeasePerM2",
    "windowsPerM2",
    "travelPerKm"
  ];

  function fill(config) {
    fields.forEach(function (id) {
      var el = document.getElementById(id);
      if (el) {
        el.value = config[id];
      }
    });
  }

  function read() {
    var values = {};
    fields.forEach(function (id) {
      values[id] = tool.toNumber(document.getElementById(id).value, tool.DEFAULT_CONFIG[id]);
    });
    return values;
  }

  form.addEventListener("submit", function (event) {
    event.preventDefault();
    var current = tool.loadConfig();
    var patch = read();
    var saved = tool.saveConfig(Object.assign({}, current, patch));
    fill(saved);
    alert("Configuration sauvegardee.");
  });

  resetBtn.addEventListener("click", function () {
    if (!confirm("Reinitialiser les tarifs par defaut ?")) {
      return;
    }
    var saved = tool.saveConfig(tool.DEFAULT_CONFIG);
    fill(saved);
  });

  fill(tool.loadConfig());
})();
