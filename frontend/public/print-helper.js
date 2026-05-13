(function () {
  var triggered = false;
  function doPrint() {
    if (triggered) return;
    triggered = true;
    try { window.focus(); window.print(); } catch (e) {}
  }
  document.addEventListener('DOMContentLoaded', function () {
    var btn = document.getElementById('print-trigger');
    if (btn) btn.addEventListener('click', function () { triggered = false; doPrint(); });
  });
  window.addEventListener('load', function () { setTimeout(doPrint, 1200); });
})();
