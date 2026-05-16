// "Was this helpful?" widget.
// GoatCounter records the click itself via data-goatcounter-click on the
// button. This script only persists the click in localStorage and swaps
// the visual state so the button doesn't reappear in the same browser.

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
    try {
      localStorage.setItem(storageKey, Date.now().toString());
    } catch (e) {
      // ignore
    }
    showThanks();
  });
})();
