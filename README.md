# ConnectSlider

Native JavaScript carousel/slider (no jQuery). Drop-in replacement for bxslider with the same API subset and **right-click safety**: only left-clicks and touch trigger navigation; right-click does not move the slider or start auto.

## Quick start

1. Include the script: `<script src="connect-slider.js"></script>`
2. Create a slider on a list element:

```js
var slider = ConnectSlider(document.querySelector('#my-slider'), {
  slideWidth: 335,
  slideMargin: 23,
  minSlides: 3,
  maxSlides: 4,
  moveSlides: 4,
  nextSelector: '#my-next',
  prevSelector: '#my-prev',
  hideControlOnEnd: true,
  infiniteLoop: false,
  onSliderLoad: function () { },
  onSlideAfter: function () { }
});
```

3. Instance is also stored on the element: `element._connectSlider`
4. Destroy when done: `slider.destroySlider()`

## Files

- **connect-slider.js** – Native slider implementation (no dependencies).
- **[example.html](example.html)** – Demo: blog carousel, group carousel, right-click test, minimal single-slide.
- **[documentation.html](documentation.html)** – Full options, API, callbacks, and integration note for including in your project.

## Including in your project

Copy `connect-slider.js` into your app and load it instead of `jquery.bxslider.min.js`. Update call sites to use `ConnectSlider(domElement, options)` and store the returned instance (e.g. on the container or use `domElement._connectSlider`). See **documentation.html** for details.
