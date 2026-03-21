/**
 * ConnectSlider - Native JavaScript carousel/slider (no jQuery)
 * Replaces bxslider with right-click safety and same API subset.
 * Use: var slider = ConnectSlider(element, options);
 * Instance stored on element._connectSlider
 */
(function (global) {
  'use strict';

  var defaults = {
    mode: 'horizontal',
    slideSelector: '',
    infiniteLoop: true,
    hideControlOnEnd: false,
    speed: 500,
    easing: null,
    slideMargin: 0,
    startSlide: 0,
    randomStart: false,
    useCSS: true,
    responsive: true,
    wrapperClass: 'bx-wrapper',
    controls: true,
    nextText: 'Next',
    prevText: 'Prev',
    nextSelector: null,
    prevSelector: null,
    pager: false,
    buildPager: null,
    minSlides: 1,
    maxSlides: 1,
    moveSlides: 0,
    slideWidth: 0,
    onSliderLoad: function () {},
    onSlideBefore: function () {},
    onSlideAfter: function () {},
    touchEnabled: true,
    swipeThreshold: 50,
    keyboardEnabled: true
  };

  function getChildren(el, slideSelector) {
    if (slideSelector) {
      return Array.prototype.slice.call(el.querySelectorAll(slideSelector));
    }
    return Array.prototype.slice.call(el.children);
  }

  function getCssPrefix() {
    var div = document.createElement('div');
    var props = ['WebkitTransform', 'msTransform', 'MozTransform', 'OTransform', 'transform'];
    for (var i = 0; i < props.length; i++) {
      if (div.style[props[i]] !== undefined) {
        return props[i].replace('Transform', '');
      }
    }
    return '';
  }

  function ConnectSlider(listElement, options) {
    if (!listElement || !listElement.nodeType) return null;
    if (listElement._connectSlider) return listElement._connectSlider;

    var settings = {};
    var key;
    for (key in defaults) settings[key] = defaults[key];
    for (key in options) if (options.hasOwnProperty(key)) settings[key] = options[key];

    settings.slideWidth = parseInt(settings.slideWidth, 10) || 0;

    var children = getChildren(listElement, settings.slideSelector);
    if (!children.length) return null;

    if (children.length < settings.minSlides) settings.minSlides = children.length;
    if (children.length < settings.maxSlides) settings.maxSlides = children.length;
    if (settings.randomStart) settings.startSlide = Math.floor(Math.random() * children.length);
    if (settings.startSlide < 0 || settings.startSlide >= children.length) settings.startSlide = 0;

    var slider = {
      settings: settings,
      el: listElement,
      children: children,
      viewport: null,
      wrapper: null,
      active: { index: settings.startSlide, last: false },
      working: false,
      initialized: false,
      carousel: settings.minSlides > 1 || settings.maxSlides > 1,
      animProp: settings.mode === 'vertical' ? 'top' : 'left',
      cssPrefix: '',
      usingCSS: false,
      minThreshold: 0,
      maxThreshold: 0,
      controls: { next: null, prev: null, el: null },
      origStyles: {},
      resizeHandler: null,
      transitionEndHandler: null,
      transitionSlideFallbackTimeout: null,
      drag: { active: false, startX: 0, startY: 0, startPosition: 0, hasMoved: false },
      suppressNextClick: false
    };
    var lastPosition = 0;

    slider.minThreshold = (settings.minSlides * settings.slideWidth) + ((settings.minSlides - 1) * settings.slideMargin);
    slider.maxThreshold = (settings.maxSlides * settings.slideWidth) + ((settings.maxSlides - 1) * settings.slideMargin);
    slider.usingCSS = settings.useCSS && settings.mode !== 'fade' && (function () {
      slider.cssPrefix = getCssPrefix();
      return !!slider.cssPrefix || ('transform' in document.createElement('div').style);
    })();

    function getViewportWidth() {
      return slider.viewport ? slider.viewport.offsetWidth : listElement.parentNode ? listElement.parentNode.offsetWidth : 0;
    }

    function getSlideWidth() {
      var wrapWidth = getViewportWidth();
      var newWidth = settings.slideWidth;
      if (settings.slideWidth === 0 || (settings.slideWidth > wrapWidth && !slider.carousel) || settings.mode === 'vertical') {
        newWidth = wrapWidth;
      } else if (settings.maxSlides > 1 && settings.mode === 'horizontal') {
        if (wrapWidth > slider.maxThreshold) return newWidth;
        if (wrapWidth < slider.minThreshold) {
          newWidth = (wrapWidth - (settings.slideMargin * (settings.minSlides - 1))) / settings.minSlides;
        }
      }
      return newWidth;
    }

    function getViewportMaxWidth() {
      if (settings.slideWidth > 0) {
        if (settings.mode === 'horizontal') {
          return (settings.maxSlides * settings.slideWidth) + ((settings.maxSlides - 1) * settings.slideMargin);
        }
        return settings.slideWidth;
      }
      return '100%';
    }

    function getNumberSlidesShowing() {
      if (settings.mode !== 'horizontal' || settings.slideWidth <= 0) return settings.mode === 'vertical' ? settings.minSlides : 1;
      var vw = getViewportWidth();
      if (vw < slider.minThreshold) return settings.minSlides;
      if (vw > slider.maxThreshold) return settings.maxSlides;
      var cw = slider.children[0] ? (slider.children[0].offsetWidth + settings.slideMargin) : 0;
      return cw ? Math.floor((vw + settings.slideMargin) / cw) || 1 : 1;
    }

    function getMoveBy() {
      if (settings.moveSlides > 0 && settings.moveSlides <= getNumberSlidesShowing()) return settings.moveSlides;
      return getNumberSlidesShowing();
    }

    function getPagerQty() {
      var showing = getNumberSlidesShowing();
      var moveBy = getMoveBy();
      if (settings.moveSlides > 0) {
        if (settings.infiniteLoop) return Math.ceil(children.length / moveBy);
        var pagerQty = 0, breakPoint = 0, counter = 0;
        while (breakPoint < children.length) {
          pagerQty++;
          breakPoint = counter + showing;
          counter += settings.moveSlides <= showing ? settings.moveSlides : showing;
        }
        return pagerQty;
      }
      return Math.ceil(children.length / showing);
    }

    function getViewportHeight() {
      var showing = getNumberSlidesShowing();
      var moveBy = getMoveBy();
      var startIdx = settings.moveSlides === 1 ? slider.active.index : slider.active.index * moveBy;
      var maxH = 0;
      for (var i = 0; i < showing; i++) {
        var idx = startIdx + i;
        if (idx >= children.length) idx = children.length - 1;
        var h = children[idx] ? children[idx].offsetHeight : 0;
        if (h > maxH) maxH = h;
      }
      return maxH;
    }

    function detachSlideTransitionListeners() {
      if (slider.transitionEndHandler) {
        listElement.removeEventListener('transitionend', slider.transitionEndHandler);
        listElement.removeEventListener('webkitTransitionEnd', slider.transitionEndHandler);
        slider.transitionEndHandler = null;
      }
      if (slider.transitionSlideFallbackTimeout) {
        clearTimeout(slider.transitionSlideFallbackTimeout);
        slider.transitionSlideFallbackTimeout = null;
      }
    }

    function setPositionProperty(value, type, duration, resetValue) {
      var val = settings.mode === 'vertical' ? 'translate3d(0, ' + value + 'px, 0)' : 'translate3d(' + value + 'px, 0, 0)';
      var pref = slider.cssPrefix;
      var transformKey = pref ? pref + 'Transform' : 'transform';

      if (type === 'reset' || type === 'slide') lastPosition = value;
      if (slider.usingCSS) {
        listElement.style[pref ? pref + 'TransitionDuration' : 'transitionDuration'] = (duration / 1000) + 's';
        listElement.style[transformKey] = val;
        if (type === 'slide' && duration > 0) {
          detachSlideTransitionListeners();
          var once = function (e) {
            if (e.target !== listElement) return;
            var pn = e.propertyName || '';
            if (pn && pn !== 'all' && pn.indexOf('transform') === -1) return;
            if (slider.transitionSlideFallbackTimeout) {
              clearTimeout(slider.transitionSlideFallbackTimeout);
              slider.transitionSlideFallbackTimeout = null;
            }
            listElement.removeEventListener('transitionend', once);
            listElement.removeEventListener('webkitTransitionEnd', once);
            slider.transitionEndHandler = null;
            updateAfterSlideTransition();
          };
          slider.transitionEndHandler = once;
          listElement.addEventListener('transitionend', once);
          listElement.addEventListener('webkitTransitionEnd', once);
          slider.transitionSlideFallbackTimeout = setTimeout(function () {
            slider.transitionSlideFallbackTimeout = null;
            if (!slider.working) return;
            detachSlideTransitionListeners();
            updateAfterSlideTransition();
          }, duration + 150);
        } else if (type === 'slide' && duration === 0) {
          updateAfterSlideTransition();
        }
      } else {
        listElement.style.left = value + 'px';
        if (type === 'slide' && duration > 0) {
          var start = Date.now();
          var startVal = parseInt(listElement.style.left, 10) || 0;
          (function step() {
            var t = Math.min((Date.now() - start) / duration, 1);
            var current = startVal + (value - startVal) * t;
            listElement.style.left = current + 'px';
            if (t < 1) requestAnimationFrame(step);
            else updateAfterSlideTransition();
          })();
        } else if (type === 'slide') {
          updateAfterSlideTransition();
        }
      }
    }

    function setSlidePosition() {
      var moveBy = getMoveBy();
      var pagerQty = getPagerQty();
      slider.active.last = slider.active.index >= pagerQty - 1;

      var firstVisible = slider.active.index * moveBy;
      if (firstVisible >= children.length) firstVisible = 0;
      var slideEl = children[firstVisible];
      if (!slideEl) return;

      var left = slideEl.offsetLeft;
      var top = slideEl.offsetTop;
      var value = settings.mode === 'horizontal' ? -left : -top;

      if (!settings.infiniteLoop && slider.active.last && slider.carousel && children.length > 0) {
        var lastIdx = settings.mode === 'horizontal' ? children.length - 1 : children.length - settings.minSlides;
        var lastEl = children[lastIdx];
        if (lastEl) {
          var l = lastEl.offsetLeft, t = lastEl.offsetTop;
          var vpW = getViewportWidth();
          value = settings.mode === 'horizontal' ? -(l - (vpW - lastEl.offsetWidth)) : -t;
        }
      }

      setPositionProperty(value, 'reset', 0);
    }

    function updateAfterSlideTransition() {
      if (!slider.initialized) return;
      if (settings.infiniteLoop && settings.mode !== 'fade') {
        var moveBy = getMoveBy();
        var pagerQty = getPagerQty();
        var position = null;
        if (slider.active.index === 0) {
          var first = children[0];
          if (first) position = { left: first.offsetLeft, top: first.offsetTop };
        } else if (slider.active.index === pagerQty - 1 && slider.carousel) {
          var reqIdx = (pagerQty - 1) * moveBy;
          if (children[reqIdx]) position = { left: children[reqIdx].offsetLeft, top: children[reqIdx].offsetTop };
        }
        if (position) {
          var v = settings.mode === 'horizontal' ? -position.left : -position.top;
          setPositionProperty(v, 'reset', 0);
        }
      }
      slider.working = false;
      try {
        settings.onSlideAfter.call(listElement, children[slider.active.index] || null, slider.oldIndex, slider.active.index);
      } catch (e) {}
    }

    function updateDirectionControls() {
      if (!slider.controls.next || !slider.controls.prev) return;
      var pagerQty = getPagerQty();
      var disabledClass = 'disabled';
      if (pagerQty <= 1) {
        slider.controls.prev.classList.add(disabledClass);
        slider.controls.next.classList.add(disabledClass);
      } else if (!settings.infiniteLoop && settings.hideControlOnEnd) {
        if (slider.active.index === 0) {
          slider.controls.prev.classList.add(disabledClass);
          slider.controls.next.classList.remove(disabledClass);
        } else if (slider.active.index >= pagerQty - 1) {
          slider.controls.next.classList.add(disabledClass);
          slider.controls.prev.classList.remove(disabledClass);
        } else {
          slider.controls.prev.classList.remove(disabledClass);
          slider.controls.next.classList.remove(disabledClass);
        }
      } else {
        slider.controls.prev.classList.remove(disabledClass);
        slider.controls.next.classList.remove(disabledClass);
      }
    }

    function isLeftClick(e) {
      if (e.button === undefined) return true;
      return e.button === 0;
    }

    function getDragBounds() {
      var pagerQty = getPagerQty();
      var maxPos = 0;
      var minPos = 0;
      if (children.length > 0 && pagerQty > 1) {
        var lastIdx = settings.mode === 'horizontal' ? children.length - 1 : children.length - settings.minSlides;
        var lastEl = children[lastIdx];
        if (lastEl) {
          var vpW = getViewportWidth();
          minPos = settings.mode === 'horizontal'
            ? -(lastEl.offsetLeft - (vpW - lastEl.offsetWidth))
            : -lastEl.offsetTop;
        }
      }
      return { min: minPos, max: maxPos };
    }

    function getPageX(e) {
      if (e.touches && e.touches.length) return e.touches[0].pageX;
      if (e.changedTouches && e.changedTouches.length) return e.changedTouches[0].pageX;
      return e.pageX;
    }
    function getPageY(e) {
      if (e.touches && e.touches.length) return e.touches[0].pageY;
      if (e.changedTouches && e.changedTouches.length) return e.changedTouches[0].pageY;
      return e.pageY;
    }

    function initDrag() {
      if (!slider.viewport || settings.mode === 'fade') return;
      var d = slider.drag;
      var threshold = settings.swipeThreshold || 50;

      function onStart(e) {
        if (e.type === 'mousedown' && e.button !== 0) return;
        if (slider.working) {
          detachSlideTransitionListeners();
          slider.working = false;
          setSlidePosition();
        }
        d.active = true;
        d.hasMoved = false;
        d.startX = getPageX(e);
        d.startY = getPageY(e);
        d.startPosition = lastPosition;
        if (e.type === 'mousedown') {
          e.preventDefault();
          document.addEventListener('mousemove', onMove);
          document.addEventListener('mouseup', onEnd);
        }
      }

      var moveThreshold = 5;
      function onMove(e) {
        if (!d.active) return;
        var pageX = getPageX(e);
        var pageY = getPageY(e);
        var delta = settings.mode === 'horizontal' ? (pageX - d.startX) : (pageY - d.startY);
        if (Math.abs(delta) > moveThreshold) d.hasMoved = true;
        if (e.type === 'touchmove') {
          var dx = Math.abs(pageX - d.startX);
          var dy = Math.abs(pageY - d.startY);
          if (dx > dy) e.preventDefault();
        }
        var newPos = d.startPosition + delta;
        if (!settings.infiniteLoop) {
          var bounds = getDragBounds();
          newPos = Math.max(bounds.min, Math.min(bounds.max, newPos));
        }
        setPositionProperty(newPos, 'reset', 0);
      }

      function onEnd(e) {
        if (e.type === 'mouseup' && e.button !== 0) return;
        if (!d.active) return;
        if (e.type === 'mousedown') return;
        if (d.hasMoved) {
          slider.suppressNextClick = true;
          if (slider.clickSuppressTimeout) clearTimeout(slider.clickSuppressTimeout);
          slider.clickSuppressTimeout = setTimeout(function () { slider.suppressNextClick = false; slider.clickSuppressTimeout = null; }, 400);
        }
        d.active = false;
        d.hasMoved = false;
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onEnd);
        var pageX = getPageX(e);
        var delta = settings.mode === 'horizontal' ? (pageX - d.startX) : (getPageY(e) - d.startY);
        if (Math.abs(delta) >= threshold) {
          if (delta < 0) {
            if (!settings.infiniteLoop && slider.active.last) setSlidePosition();
            else slider.goToNextSlide();
          } else {
            if (!settings.infiniteLoop && slider.active.index === 0) setSlidePosition();
            else slider.goToPrevSlide();
          }
        } else {
          setSlidePosition();
        }
      }

      function onTouchEnd(e) {
        if (!d.active) return;
        if (d.hasMoved) {
          slider.suppressNextClick = true;
          if (slider.clickSuppressTimeout) clearTimeout(slider.clickSuppressTimeout);
          slider.clickSuppressTimeout = setTimeout(function () { slider.suppressNextClick = false; slider.clickSuppressTimeout = null; }, 400);
        }
        d.active = false;
        d.hasMoved = false;
        var delta = settings.mode === 'horizontal' ? (getPageX(e) - d.startX) : (getPageY(e) - d.startY);
        if (Math.abs(delta) >= threshold) {
          if (delta < 0) {
            if (!settings.infiniteLoop && slider.active.last) setSlidePosition();
            else slider.goToNextSlide();
          } else {
            if (!settings.infiniteLoop && slider.active.index === 0) setSlidePosition();
            else slider.goToPrevSlide();
          }
        } else {
          setSlidePosition();
        }
      }

      function onWindowBlur() {
        if (!d.active) return;
        d.active = false;
        d.hasMoved = false;
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onEnd);
        setSlidePosition();
      }

      function onCaptureClick(e) {
        if (!slider.suppressNextClick) return;
        e.preventDefault();
        e.stopPropagation();
        slider.suppressNextClick = false;
        if (slider.clickSuppressTimeout) { clearTimeout(slider.clickSuppressTimeout); slider.clickSuppressTimeout = null; }
      }

      slider.viewport.addEventListener('mousedown', onStart);
      slider.viewport.addEventListener('click', onCaptureClick, true);
      try {
        slider.viewport.addEventListener('touchstart', onStart, { passive: true });
        slider.viewport.addEventListener('touchmove', onMove, { passive: false });
      } catch (e) {
        slider.viewport.addEventListener('touchstart', onStart);
        slider.viewport.addEventListener('touchmove', onMove);
      }
      slider.viewport.addEventListener('touchend', onTouchEnd);
      slider.viewport.addEventListener('touchcancel', onTouchEnd);
      window.addEventListener('blur', onWindowBlur);
      slider.dragCleanup = function () {
        window.removeEventListener('blur', onWindowBlur);
        if (slider.viewport) {
          slider.viewport.removeEventListener('mousedown', onStart);
          slider.viewport.removeEventListener('click', onCaptureClick, true);
          slider.viewport.removeEventListener('touchstart', onStart);
          slider.viewport.removeEventListener('touchmove', onMove);
          slider.viewport.removeEventListener('touchend', onTouchEnd);
          slider.viewport.removeEventListener('touchcancel', onTouchEnd);
        }
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onEnd);
        if (slider.clickSuppressTimeout) { clearTimeout(slider.clickSuppressTimeout); slider.clickSuppressTimeout = null; }
      };
    }

    function initKeyboard() {
      if (!settings.keyboardEnabled || !slider.viewport || settings.mode === 'fade') return;
      slider.viewport.setAttribute('tabindex', '0');
      function onKeyDown(e) {
        if (!slider.initialized) return;
        var k = e.key;
        var code = e.keyCode || e.which;
        var next = false;
        var prev = false;
        if (settings.mode === 'vertical') {
          if (k === 'ArrowDown' || k === 'Down' || code === 40) next = true;
          else if (k === 'ArrowUp' || k === 'Up' || code === 38) prev = true;
        } else {
          if (k === 'ArrowRight' || k === 'Right' || code === 39) next = true;
          else if (k === 'ArrowLeft' || k === 'Left' || code === 37) prev = true;
        }
        if (!next && !prev) return;
        e.preventDefault();
        if (next) slider.goToNextSlide();
        else slider.goToPrevSlide();
      }
      slider.viewport.addEventListener('keydown', onKeyDown);
      slider.keyboardCleanup = function () {
        if (slider.viewport) {
          slider.viewport.removeEventListener('keydown', onKeyDown);
          slider.viewport.removeAttribute('tabindex');
        }
      };
    }

    function appendControls() {
      var next = document.createElement('a');
      next.href = '#';
      next.className = 'bx-next ci-smallrightArrow';
      next.textContent = settings.nextText;
      next.setAttribute('aria-label', 'Next');
      var prev = document.createElement('a');
      prev.href = '#';
      prev.className = 'bx-prev ci-smallleftArrow';
      prev.textContent = settings.prevText;
      prev.setAttribute('aria-label', 'Previous');

      next.addEventListener('click', function (e) {
        if (!isLeftClick(e)) return;
        e.preventDefault();
        if (next.classList.contains('disabled')) return;
        slider.goToNextSlide();
      });
      prev.addEventListener('click', function (e) {
        if (!isLeftClick(e)) return;
        e.preventDefault();
        if (prev.classList.contains('disabled')) return;
        slider.goToPrevSlide();
      });

      slider.controls.next = next;
      slider.controls.prev = prev;

      if (settings.nextSelector) {
        var nextCont = document.querySelector(settings.nextSelector);
        if (nextCont) nextCont.appendChild(next);
      }
      if (settings.prevSelector) {
        var prevCont = document.querySelector(settings.prevSelector);
        if (prevCont) prevCont.appendChild(prev);
      }
      if (!settings.nextSelector && !settings.prevSelector && slider.viewport) {
        slider.controls.el = document.createElement('div');
        slider.controls.el.className = 'bx-controls bx-has-controls-direction';
        slider.controls.el.appendChild(prev);
        slider.controls.el.appendChild(next);
        slider.viewport.parentNode.insertBefore(slider.controls.el, slider.viewport.nextSibling);
      } else {
        slider.controls.el = document.createElement('div');
        slider.controls.el.className = 'bx-controls';
      }
    }

    function setSlideIndex(slideIndex) {
      var pagerQty = getPagerQty();
      if (slideIndex < 0) return settings.infiniteLoop ? pagerQty - 1 : slider.active.index;
      if (slideIndex >= pagerQty) return settings.infiniteLoop ? 0 : slider.active.index;
      return slideIndex;
    }

    slider.goToSlide = function (slideIndex, direction) {
      var resolved = setSlideIndex(slideIndex);
      if (slider.working) {
        detachSlideTransitionListeners();
        slider.working = false;
      }
      slider.oldIndex = slider.active.index;
      if (resolved === slider.oldIndex) return;
      slider.active.index = resolved;
      slider.working = true;

      var allow = settings.onSlideBefore.call(listElement, children[slider.active.index] || null, slider.oldIndex, slider.active.index);
      if (allow === false) {
        slider.active.index = slider.oldIndex;
        slider.working = false;
        return;
      }

      slider.active.last = slider.active.index >= getPagerQty() - 1;
      updateDirectionControls();

      var moveBy = getMoveBy();
      var firstVisible = slider.active.index * moveBy;
      if (firstVisible >= children.length) firstVisible = 0;
      var slideEl = children[firstVisible];
      if (!slideEl) {
        slider.working = false;
        return;
      }

      var value;
      if (!settings.infiniteLoop && slider.active.last && slider.carousel && children.length > 0) {
        var lastIdx = settings.mode === 'horizontal' ? children.length - 1 : children.length - settings.minSlides;
        var lastEl = children[lastIdx];
        if (lastEl) {
          var l = lastEl.offsetLeft;
          var vpW = getViewportWidth();
          value = settings.mode === 'horizontal' ? -(l - (vpW - lastEl.offsetWidth)) : -lastEl.offsetTop;
        } else {
          value = settings.mode === 'horizontal' ? -slideEl.offsetLeft : -slideEl.offsetTop;
        }
      } else {
        var left = slideEl.offsetLeft;
        var top = slideEl.offsetTop;
        value = settings.mode === 'horizontal' ? -left : -top;
      }
      setPositionProperty(value, 'slide', settings.speed);
    };

    slider.goToNextSlide = function () {
      if (!settings.infiniteLoop && slider.active.last) return;
      if (slider.working) return;
      slider.goToSlide(slider.active.index + 1, 'next');
    };

    slider.goToPrevSlide = function () {
      if (!settings.infiniteLoop && slider.active.index === 0) return;
      if (slider.working) return;
      slider.goToSlide(slider.active.index - 1, 'prev');
    };

    slider.getCurrentSlide = function () { return slider.active.index; };
    slider.getCurrentSlideElement = function () { return children[slider.active.index] || null; };
    slider.getSlideElement = function (index) { return children[index] || null; };
    slider.getSlideCount = function () { return children.length; };
    slider.destroySlider = function () {
      if (!slider.initialized) return;
      slider.initialized = false;

      detachSlideTransitionListeners();

      var clones = listElement.querySelectorAll('.bx-clone');
      for (var i = 0; i < clones.length; i++) clones[i].parentNode.removeChild(clones[i]);

      children.forEach(function (child, idx) {
        if (slider.origStyles[idx]) child.setAttribute('style', slider.origStyles[idx]);
        else child.removeAttribute('style');
      });
      if (slider.origStyles.el) listElement.setAttribute('style', slider.origStyles.el);
      else listElement.removeAttribute('style');

      if (slider.wrapper && slider.viewport) {
        var wrapper = slider.wrapper;
        var viewport = slider.viewport;
        wrapper.insertBefore(listElement, viewport);
        wrapper.removeChild(viewport);
        if (wrapper.parentNode) {
          wrapper.parentNode.insertBefore(listElement, wrapper);
          wrapper.parentNode.removeChild(wrapper);
        }
      }

      if (slider.controls.next && slider.controls.next.parentNode) slider.controls.next.parentNode.removeChild(slider.controls.next);
      if (slider.controls.prev && slider.controls.prev.parentNode) slider.controls.prev.parentNode.removeChild(slider.controls.prev);
      if (slider.controls.el && slider.controls.el.parentNode) slider.controls.el.parentNode.removeChild(slider.controls.el);

      if (slider.resizeHandler) window.removeEventListener('resize', slider.resizeHandler);
      if (typeof slider.keyboardCleanup === 'function') slider.keyboardCleanup();
      if (typeof slider.dragCleanup === 'function') slider.dragCleanup();

      listElement._connectSlider = null;
    };

    slider.redrawSlider = function () {
      var w = getSlideWidth();
      var all = listElement.children;
      for (var i = 0; i < all.length; i++) {
        all[i].style.width = w + 'px';
        if (settings.mode === 'horizontal' && settings.slideMargin > 0) all[i].style.marginRight = settings.slideMargin + 'px';
      }
      if (slider.viewport) slider.viewport.style.height = getViewportHeight() + 'px';
      setSlidePosition();
      if (slider.active.last) slider.active.index = getPagerQty() - 1;
      updateDirectionControls();
    };

    function resizeWindow() {
      if (!slider.initialized) return;
      if (slider.working) return setTimeout(resizeWindow, 10);
      slider.redrawSlider();
    }

    function setup() {
      slider.origStyles.el = listElement.getAttribute('style') || '';
      children.forEach(function (child, i) { slider.origStyles[i] = child.getAttribute('style') || ''; });

      slider.wrapper = document.createElement('div');
      slider.wrapper.className = settings.wrapperClass;
      slider.viewport = document.createElement('div');
      slider.viewport.className = 'bx-viewport';
      listElement.parentNode.insertBefore(slider.wrapper, listElement);
      slider.wrapper.appendChild(slider.viewport);
      slider.viewport.appendChild(listElement);

      var maxW = getViewportMaxWidth();
      slider.wrapper.style.maxWidth = (typeof maxW === 'number' ? maxW + 'px' : maxW);
      slider.viewport.style.width = '100%';
      slider.viewport.style.overflow = 'hidden';
      slider.viewport.style.position = 'relative';

      listElement.style.position = 'relative';
      listElement.style.width = settings.mode === 'horizontal' ? (children.length * 1000 + 215) + '%' : 'auto';

      var slideWidthVal = getSlideWidth();
      children.forEach(function (child) {
        child.style.float = settings.mode === 'horizontal' ? 'left' : 'none';
        child.style.listStyle = 'none';
        child.style.position = 'relative';
        child.style.width = slideWidthVal + 'px';
        if (settings.mode === 'horizontal' && settings.slideMargin > 0) child.style.marginRight = settings.slideMargin + 'px';
      });

      if (settings.controls) appendControls();

      if (settings.infiniteLoop && settings.mode !== 'fade') {
        var slice = settings.mode === 'vertical' ? settings.minSlides : settings.maxSlides;
        for (var s = 0; s < slice && s < children.length; s++) {
          var clone = children[s].cloneNode(true);
          clone.classList.add('bx-clone');
          listElement.appendChild(clone);
        }
        var start = Math.max(0, children.length - slice);
        for (var p = start; p < children.length; p++) {
          var cl = children[p].cloneNode(true);
          cl.classList.add('bx-clone');
          listElement.insertBefore(cl, listElement.firstChild);
        }
      }

      setSlidePosition();
      slider.viewport.style.height = getViewportHeight() + 'px';
      var pagerQty = getPagerQty();
      if (slider.active.index >= pagerQty) slider.active.index = Math.max(0, pagerQty - 1);
      slider.active.last = slider.active.index >= pagerQty - 1;
      slider.initialized = true;

      if (settings.responsive) {
        slider.resizeHandler = resizeWindow;
        window.addEventListener('resize', resizeWindow);
      }

      try { settings.onSliderLoad.call(listElement, slider.active.index); } catch (e) {}
      updateDirectionControls();

      if (settings.touchEnabled) initDrag();
      initKeyboard();
    }

    setup();
    listElement._connectSlider = slider;
    return slider;
  }

  global.ConnectSlider = ConnectSlider;
})(typeof window !== 'undefined' ? window : this);
