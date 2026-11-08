import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import App from "./App";

// Belt-and-suspenders on top of the CSS lock in index.css: block the input
// events that could still nudge the viewport (iOS rubber-banding, trackpad
// wheel, pinch-zoom gestures, scroll keys).
const preventDefault = (event) => event.preventDefault();
const SCROLL_KEYS = new Set([
  " ",
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "PageUp",
  "PageDown",
  "Home",
  "End"
]);

window.addEventListener("wheel", preventDefault, { passive: false });
window.addEventListener("touchmove", preventDefault, { passive: false });
window.addEventListener("gesturestart", preventDefault, { passive: false });
window.addEventListener("keydown", (event) => {
  if (SCROLL_KEYS.has(event.key)) event.preventDefault();
});
window.addEventListener("scroll", () => window.scrollTo(0, 0));

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<App />);
