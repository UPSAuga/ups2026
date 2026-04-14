document.addEventListener('DOMContentLoaded', () => {
  if (typeof Konva === 'undefined') {
    console.error('❌ Konva.js failed to load. Check your internet connection.');
    document.body.innerHTML = '<h2 style="padding:20px;text-align:center;">Failed to load editor library.</h2>';
    return;
  }

  // 🔍 STRICT DOM REFERENCES
  const inputName = document.getElementById('input-name');
  const inputPhoto = document.getElementById('input-photo');
  const btnContinue = document.getElementById('btn-continue');
  const uploadForm = document.getElementById('upload-form');
  const fileHint = document.getElementById('file-hint');

  const screenUpload = document.getElementById('screen-upload');
  const screenEditor = document.getElementById('screen-editor');
  const screenPreview = document.getElementById('screen-preview');

  const btnBack = document.getElementById('btn-back');
  const btnReset = document.getElementById('btn-reset');
  const btnPreview = document.getElementById('btn-preview');
  const btnEditAgain = document.getElementById('btn-edit-again');
  const btnDownload = document.getElementById('btn-download');

  const zoomSlider = document.getElementById('zoom-slider');
  const rotateSlider = document.getElementById('rotate-slider');
  const zoomVal = document.getElementById('zoom-val');
  const rotateVal = document.getElementById('rotate-val');

  const previewImage = document.getElementById('preview-image');
  const loadingOverlay = document.getElementById('loading-overlay');

  // 📐 CONSTANTS
  const CANVAS_W = 2000;
  const CANVAS_H = 2250;

  // 🧠 STATE
  let stage, bgGroup, overlayImg, userImageNode;
  let exportedDataUrl = null;
  let loadedUserName = '';
  let exportPixelRatio = 1;

  // 📥 PRELOAD TEMPLATE INSTANTLY
  const templateImage = new Image();
  templateImage.crossOrigin = 'anonymous';
  templateImage.src = 'assets/template.png';
  templateImage.onload = () => console.log('✅ Template preloaded & ready');
  templateImage.onerror = () => console.warn('⚠️ Template failed to load. Ensure assets/template.png exists.');

  // ✅ ROBUST FORM VALIDATION
  function checkFormValidity() {
    const nameEntered = inputName.value.trim().length > 0;
    const fileSelected = inputPhoto.files && inputPhoto.files.length > 0;
    const isValid = nameEntered && fileSelected;

    btnContinue.disabled = !isValid;
    return isValid;
  }

  inputName.addEventListener('input', checkFormValidity);
  inputName.addEventListener('keyup', checkFormValidity);
  inputName.addEventListener('paste', () => setTimeout(checkFormValidity, 10));

  inputPhoto.addEventListener('change', (e) => {
    const file = e.target.files[0];
    fileHint.textContent = file ? file.name : 'No file selected';
    checkFormValidity();
  });

  // Initialize button state on load
  checkFormValidity();

  // 📤 FORM SUBMISSION (FIXED ORDER & TIMING)
  uploadForm.addEventListener('submit', (e) => {
    e.preventDefault();

    if (!checkFormValidity()) {
      alert('Please enter your name and select a photo to continue.');
      return;
    }

    loadedUserName = inputName.value.trim();
    const userFile = inputPhoto.files[0];

    // 1️⃣ Show screen FIRST so browser calculates layout
    showScreen('editor');

    // 2️⃣ Wait for next paint to guarantee non-zero container dimensions
    requestAnimationFrame(() => {
      try {
        initEditor(userFile);
      } catch (err) {
        console.error('❌ Editor initialization failed:', err);
        alert('Failed to load editor: ' + err.message);
        showScreen('upload');
      }
    });
  });

  // 🔄 SCREEN NAVIGATION
  function showScreen(name) {
    [screenUpload, screenEditor, screenPreview].forEach(s => s.classList.remove('active'));
    if (name === 'upload') screenUpload.classList.add('active');
    if (name === 'editor') screenEditor.classList.add('active');
    if (name === 'preview') screenPreview.classList.add('active');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  btnBack.addEventListener('click', () => {
    cleanupStage();
    showScreen('upload');
  });

  // 🎨 KONVA EDITOR INITIALIZATION
  function cleanupStage() {
    if (stage) { stage.destroy(); stage = null; }
    bgGroup = null; overlayImg = null; userImageNode = null;
  }

  function initEditor(file) {
    cleanupStage();

    const container = document.getElementById('canvas-container');
    
    // 🛡️ FALLBACK: Prevents 0-width crash if container isn't fully painted
    let displayWidth = container.clientWidth || Math.min(window.innerWidth - 32, 480);
    const displayHeight = Math.round(displayWidth * (CANVAS_H / CANVAS_W));
    
    container.style.height = `${displayHeight}px`;
    exportPixelRatio = CANVAS_W / displayWidth || 4; // Safe fallback

    stage = new Konva.Stage({
      container: 'konva-stage',
      width: displayWidth,
      height: displayHeight,
    });

    // Clipped group for user image
    bgGroup = new Konva.Group({
      clip: { x: 0, y: 0, width: displayWidth, height: displayHeight },
      listening: true
    });
    stage.add(bgGroup);

    // Fixed template overlay
    overlayImg = new Konva.Image({
      image: templateImage,
      x: 0, y: 0,
      width: displayWidth,
      height: displayHeight,
      listening: false,
      draggable: false
    });
    stage.add(overlayImg);

    // Load user image
    const img = new Image();
    img.onload = () => {
      const scaleX = displayWidth / img.width;
      const scaleY = displayHeight / img.height;
      const baseScale = Math.min(scaleX, scaleY) * 1.15; // Slight bleed for safe dragging

      userImageNode = new Konva.Image({
        image: img,
        x: displayWidth / 2,
        y: displayHeight / 2,
        offsetX: img.width / 2,
        offsetY: img.height / 2,
        scaleX: baseScale,
        scaleY: baseScale,
        draggable: true,
      });

      bgGroup.add(userImageNode);
      bgGroup.batchDraw();
      stage.draw();

      // Store defaults for reset
      userImageNode._defaults = {
        x: displayWidth / 2,
        y: displayHeight / 2,
        scaleX: baseScale,
        scaleY: baseScale,
        rotation: 0
      };

      zoomSlider.value = 1;
      rotateSlider.value = 0;
      updateSliderLabels();
    };
    img.onerror = () => alert('Invalid image format. Please use JPG or PNG.');
    img.src = URL.createObjectURL(file);

    // Immediate template draw if cached
    if (templateImage.complete && templateImage.naturalWidth > 0) {
      overlayImg.image(templateImage);
      stage.draw();
    }

    bindControls();
  }

  // 🎛️ CONTROLS
  function bindControls() {
    zoomSlider.oninput = () => {
      if (!userImageNode) return;
      const factor = parseFloat(zoomSlider.value);
      const base = userImageNode._defaults.scaleX;
      userImageNode.scale({ x: base * factor, y: base * factor });
      bgGroup.batchDraw();
      updateSliderLabels();
    };

    rotateSlider.oninput = () => {
      if (!userImageNode) return;
      userImageNode.rotation(parseFloat(rotateSlider.value));
      bgGroup.batchDraw();
      updateSliderLabels();
    };

    btnReset.onclick = () => {
      if (!userImageNode) return;
      const d = userImageNode._defaults;
      userImageNode.position({ x: d.x, y: d.y });
      userImageNode.scale({ x: d.scaleX, y: d.scaleY });
      userImageNode.rotation(d.rotation);
      zoomSlider.value = 1;
      rotateSlider.value = 0;
      updateSliderLabels();
      bgGroup.batchDraw();
    };

    btnPreview.onclick = generatePreview;
  }

  function updateSliderLabels() {
    zoomVal.textContent = `${parseFloat(zoomSlider.value).toFixed(2)}x`;
    rotateVal.textContent = `${rotateSlider.value}°`;
  }

  // 📤 EXPORT & DOWNLOAD
  function generatePreview() {
    if (!stage || !userImageNode) return;
    loadingOverlay.classList.remove('hidden');

    setTimeout(() => {
      try {
        exportedDataUrl = stage.toDataURL({
          width: CANVAS_W,
          height: CANVAS_H,
          mimeType: 'image/png',
          pixelRatio: exportPixelRatio || 1,
          imageSmoothingEnabled: true,
          imageSmoothingQuality: 'high'
        });
        previewImage.src = exportedDataUrl;
        loadingOverlay.classList.add('hidden');
        showScreen('preview');
      } catch (err) {
        console.error('Export failed:', err);
        alert('Could not generate preview. Please try again.');
        loadingOverlay.classList.add('hidden');
      }
    }, 150);
  }

  btnDownload.onclick = () => {
    if (!exportedDataUrl) return;
    const link = document.createElement('a');
    link.download = `${loadedUserName.replace(/[^a-zA-Z0-9]/g, '_')}_UPS2026.png`;
    link.href = exportedDataUrl;
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  btnEditAgain.onclick = () => showScreen('editor');
});
