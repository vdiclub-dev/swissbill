(function () {
  "use strict";

  function csvCell(value) {
    var text = value == null ? "" : String(value);
    if (/[",;\n\r]/.test(text)) return '"' + text.replace(/"/g, '""') + '"';
    return text;
  }

  function generateErrorCsv(errors) {
    var rows = [["ligne", "reference", "champ", "message", "valeur"]];
    (errors || []).forEach(function (err) {
      rows.push([
        err.rowNumber || "",
        err.reference || "",
        err.field || "",
        err.message || "",
        err.value == null ? "" : err.value
      ]);
    });
    return rows.map(function (row) { return row.map(csvCell).join(";"); }).join("\n");
  }

  function downloadErrorCsv(errors, fileName) {
    var csv = "\ufeff" + generateErrorCsv(errors);
    var blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = fileName || "rapport-erreurs-import-colixo.csv";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
  }

  window.ColixoCsvErrorReport = {
    generateErrorCsv: generateErrorCsv,
    downloadErrorCsv: downloadErrorCsv
  };
})();
