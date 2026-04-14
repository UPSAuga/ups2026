// ============ DOM REFS ============
const screens = {
  upload: document.getElementById("screen-upload"),
  editor: document.getElementById("screen-editor"),
  preview: document.getElementById("screen-preview"),
};

const uploadForm = document.getElementById("upload-form");
const inputName = document.getElementById("input-name");
const inputPhoto = document.getElementById("input-photo");
const btnContinue = document.getElementById("btn-continue");
const fileHint = document.getElementById("file-hint");

const btnBack = document.getElementById("btn-back");
const btnReset = document.getElementById("btn-reset");
const btnPreview = document.getElementById("btn-preview");
const btnEditAgain = document.getElementById("btn-edit-again");
const btnDownload = document.getElementById("btn-download");

const zoomSlider = document.getElementById("zoom-slider");
const rotateSlider = document.getElementById("rotate-slider");

const previewImage = document.getElementById("preview-image");
const loadingOverlay = document.getElementById("loading-overlay");

// ============ STATE ============
const CANVAS_W = 2000;
const CANVAS_H = 2250;

let stage, bgLayer, overlayLayer, userImageNode;
let exportedBlob = null;
let loadedUserName = "";

// ============ SCREEN SWITCHING ============
function showScreen(name) {
  Object.values(screens).forEach((s) => s.classList.remove("active"));
  screens[name].classList.add("active");
  window.scrollTo(0, 0);
}

// ============ UPLOAD FORM ============
function validateForm() {
  btnContinue.disabled = !(inputName.value.trim() && inputPhoto.files.length);
}

inputName.addEventListener("input", validateForm);
inputPhoto.addEventListener("change", () => {
  const file = inputPhoto.files[0];
  fileHint.textContent = file ? file.name : "No file chosen";
  validateForm();
});

uploadForm.addEventListener("submit", (e) => {
  e.preventDefault();
  if (!validateForm()) return;
  loadedUserName = inputName.value.trim();
  initEditor(inputPhoto.files[0]);
  showScreen("editor");
});

// ============ BACK BUTTON ============
btnBack.addEventListener("click", () => {
  destroyStage();
  showScreen("upload");
});

// ============ KONVA STAGE ============
function initStage() {
  stage = new Konva.Stage({
    container: "konva-stage",
    width: CANVAS_W,
    height: CANVAS_H,
  });

  bgLayer = new Konva.Layer();
  overlayLayer = new Konva.Layer();

  stage.add(bgLayer);
  stage.add(overlayLayer);
}

function destroyStage() {
  if (stage) {
    stage.destroy();
    stage = null;
    bgLayer = null;
    overlayLayer = null;
    userImageNode = null;
  }
}

// ============ EDITOR INIT ============
function initEditor(file) {
  destroyStage();
  initStage();

  const img = new Image();
  img.onload = () => {
    drawUserImage(img);
    loadTemplate();
    bindControls();
  };
  img.src = URL.createObjectURL(file);
}

function drawUserImage(img) {
  // Calculate initial scale to cover the canvas
  const scaleX = CANVAS_W / img.width;
  const scaleY = CANVAS_H / img.height;
  const initialScale = Math.min(scaleX, scaleY) * 1.15; // slight bleed

  userImageNode = new Konva.Image({
    image: img,
    x: CANVAS_W / 2,
    y: CANVAS_H / 2,
    offsetX: img.width / 2,
    offsetY: img.height / 2,
    scaleX: initialScale,
    scaleY: initialScale,
    draggable: true,
    listening: true,
  });

  bgLayer.add(userImageNode);
  bgLayer.batchDraw();

  // Store defaults for reset
  userImageNode._defaults = {
    x: CANVAS_W / 2,
    y: CANVAS_H / 2,
    scaleX: initialScale,
    scaleY: initialScale,
    rotation: 0,
  };

  // Sync sliders
  zoomSlider.value = initialScale.toFixed(2);
  rotateSlider.value = 0;
  zoomSlider.min = (initialScale * 0.4).toFixed(2);
  zoomSlider.max = (initialScale * 2.8).toFixed(2);
}

function loadTemplate() {
  const tpl = new Image();
  tpl.onload = () => {
    const tplImg = new Konva.Image({
      image: tpl,
      x: 0,
      y: 0,
      width: CANVAS_W,
      height: CANVAS_H,
      listening: false,
    });
    overlayLayer.add(tplImg);
    overlayLayer.batchDraw();
  };
  tpl.onerror = () => {
    console.warn("Template image not found at assets/template.png");
  };
  tpl.src = "assets/template.png";
}

// ============ CONTROLS ============
function bindControls() {
  zoomSlider.oninput = () => {
    if (!userImageNode) return;
    const val = parseFloat(zoomSlider.value);
    userImageNode.scaleX(val);
    userImageNode.scaleY(val);
    bgLayer.batchDraw();
  };

  rotateSlider.oninput = () => {
    if (!userImageNode) return;
    userImageNode.rotation(parseFloat(rotateSlider.value));
    bgLayer.batchDraw();
  };

  btnReset.onclick = () => {
    if (!userImageNode) return;
    const d = userImageNode._defaults;
    userImageNode.position({ x: d.x, y: d.y });
    userImageNode.scaleX(d.scaleX);
    userImageNode.scaleY(d.scaleY);
    userImageNode.rotation(d.rotation);
    zoomSlider.value = d.scaleX.toFixed(2);
    rotateSlider.value = d.rotation;
    bgLayer.batchDraw();
  };

  btnPreview.onclick = () => {
    generatePreview();
  };
}

// ============ EXPORT ============
function generatePreview() {
  loadingOverlay.classList.remove("hidden");

  // Small delay so spinner renders
  setTimeout(() => {
    try {
      const dataURL = stage.toDataURL({
        width: CANVAS_W,
        height: CANVAS_H,
        mimeType: "image/png",
        pixelRatio: 1,
      });

      previewImage.src = dataURL;
      exportedBlob = dataURL;

      // Convert base64 to blob for download
      fetch(dataURL)
        .then((r) => r.blob())
        .then((blob) => {
          exportedBlob = blob;
        });
    } catch (err) {
      console.error("Export failed:", err);
      alert("Something went wrong during export. Please try again.");
    }

    loadingOverlay.classList.add("hidden");
    showScreen("preview");
  }, 400);
}

// ============ DOWNLOAD ============
btnDownload.onclick = () => {
  if (!exportedBlob) return;

  const link = document.createElement("a");
  link.download = `${loadedUserName.replace(/\s+/g, "_")}_UPS2026.png`;
  link.href = exportedBlob;
  link.click();
};

// ============ EDIT AGAIN ============
btnEditAgain.onclick = () => {
  showScreen("editor");
};

// ============ INIT ============
showScreen("upload");