// TDA Intro Animation - NUR auf Startseite "/"
(function () {
  var currentPath = window.location.pathname;
  var intro = document.getElementById('introOverlay');

  if (currentPath === '/' || currentPath === '/index.html') {
    var introShown = sessionStorage.getItem('tdaIntroShown');

    if (!introShown) {
      intro.style.display = 'flex';

      setTimeout(function () { intro.classList.add('exiting'); }, 2500);
      setTimeout(function () {
        intro.classList.add('hidden');
        intro.style.display = 'none';
      }, 3500);

      sessionStorage.setItem('tdaIntroShown', 'true');
    } else {
      intro.style.display = 'none';
    }
  } else {
    intro.style.display = 'none';
  }
})();
