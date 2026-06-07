import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.jsx";
import "./styles.css";

installMobileViewportLock();

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>
);

function installMobileViewportLock() {
  const setAppHeight = () => {
    const viewportHeight = window.visualViewport?.height || window.innerHeight;
    document.documentElement.style.setProperty("--app-height", `${viewportHeight}px`);
  };

  let lastTouchEnd = 0;
  const preventDefault = (event) => event.preventDefault();
  const preventMultiTouchZoom = (event) => {
    if (event.touches.length > 1) event.preventDefault();
  };
  const preventDoubleTapZoom = (event) => {
    const now = Date.now();
    if (now - lastTouchEnd <= 300) event.preventDefault();
    lastTouchEnd = now;
  };

  setAppHeight();
  window.addEventListener("resize", setAppHeight);
  window.visualViewport?.addEventListener("resize", setAppHeight);
  window.visualViewport?.addEventListener("scroll", setAppHeight);
  document.addEventListener("gesturestart", preventDefault);
  document.addEventListener("gesturechange", preventDefault);
  document.addEventListener("gestureend", preventDefault);
  document.addEventListener("touchmove", preventMultiTouchZoom, { passive: false });
  document.addEventListener("touchend", preventDoubleTapZoom, { passive: false });
}
