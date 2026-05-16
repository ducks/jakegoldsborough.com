// "Was this helpful?" widget.
// Records a positive-only vote to GoatCounter and keeps the click
// from re-firing in the same browser via localStorage.

(function () {
  var widget = document.querySelector('.helpful[data-helpful-path]');
  if (!widget) return;

  var path = widget.getAttribute('data-helpful-path');
  var storageKey = 'helpful:' + path;
  var button = widget.querySelector('[data-helpful-action="vote"]');
  var thanks = widget.querySelector('.helpful-thanks');

  function showThanks() {
    button.hidden = true;
    thanks.hidden = false;
    widget.classList.add('helpful--voted');
  }

  // Already voted in this browser? Skip straight to the thank-you state.
  try {
    if (localStorage.getItem(storageKey)) {
      showThanks();
      return;
    }
  } catch (e) {
    // Private browsing / storage disabled: continue without persistence.
  }

  button.addEventListener('click', function () {
    // Fire the GoatCounter event. count.js loads async, so guard the call.
    if (window.goatcounter && window.goatcounter.count) {
      window.goatcounter.count({
        path: path + '#helpful',
        title: 'Helpful click',
        event: true
      });
    }
    try {
      localStorage.setItem(storageKey, Date.now().toString());
    } catch (e) {
      // ignore
    }
    showThanks();
  });
})();
