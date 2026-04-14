document.addEventListener('DOMContentLoaded', () => {
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

  // 🛡️ SAFETY CHECK
  if (!inputName || !inputPhoto || !btnContinue || !uploadForm) {
    console.error('❌ Critical form elements missing. Check HTML IDs.');
    return;
  }

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
  templateImage.onload = () => console.log('✅ Template preloaded');
  templateImage.onerror = () => console.warn('⚠️ Template failed. Ensure assets/template.png exists.');

  // ✅ FORM VALIDATION (FIXED & ROBUST)
  function checkFormValidity() {
    const nameEntered = inputName.value.trim().length > 0;
    const fileSelected = inputPhoto.files && inputPhoto.files.length > 0;
    const isValid = nameEntered && fileSelected;

    // Toggle button state immediately
    btnContinue.disabled = !isValid;
    return isValid;
  }

  // Attach multiple events for max mobile/desktop compatibility
  inputName.addEventListener('input', checkFormValidity);
  inputName.addEventListener('keyup', checkFormValidity);
  inputName.addEventListener('paste', () => setTimeout(checkFormValidity, 10));

  inputPhoto.addEventListener('change', (e) => {
    const file = e.target.files[0];
    fileHint.textContent = file ? file.name : 'No file selected';
    checkFormValidity();
  });

  // Run once on load to set initial state
  checkFormValidity();

  // 📤 FORM SUBMISSION (FIXED)
  uploadForm.addEventListener('submit', (e) => {
    e.preventDefault(); // Block native form submit

    if (!checkFormValidity()) {
      alert('Please enter your name and select a photo to continue.');
      return;
    }

    const userName = inputName.value.trim();
    const userFile = inputPhoto.files[0];

    try {
      loadedUserName = userName;
      initEditor(userFile);
      showScreen('editor');
    } catch (err) {
      console.error('❌ Editor init failed:', err);
      alert('Failed to start editor. Please refresh and try again.');
    }
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

  // 🎨 KONVA EDITOR INIT
  function cleanupStage() {
    if (stage) { stage.destroy(); stage = null; }
    bgGroup = null; overlayImg = null; userImageNode = null;
  }

  function initEditor(file) {
    cleanupStage();

    const container = document.getElementById('canvas-container');
    const displayWidth = container.clientWidth || window.innerWidth * 0.9;
    const displayHeight = Math.round(displayWidth * (CANVAS_H / CANVAS_W));
    
    container.style.height = `${displayHeight}px`;
    exportPixelRatio = CANVAS_W / displayWidth;

    stage = new Konva.Stage({
      container: 'konva-stage',
      width: displayWidth,
      height: displayHeight,
    });

    // Clipped group for user image (acts as the "window")
    bgGroup = new Konva.Group({
      clip: { x: 0, y: 0, width: displayWidth, height: displayHeight },
      listening: true
    });
    stage.add(bgGroup);

    // Fixed template overlay (always on top)
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
      const baseScale = Math.min(scaleX, scaleY) * 1.15; // slight bleed for dragging

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

      // Reset sliders
      zoomSlider.value = 1;
      rotateSlider.value = 0;
      updateSliderLabels();
    };
    img.onerror = () => alert('Invalid image file. Please upload a JPG or PNG.');
    img.src = URL.createObjectURL(file);

    // Force immediate template render if already cached
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
        // Export at exact 2000x2250 resolution
        exportedDataUrl = stage.toDataURL({
          width: CANVAS_W,
          height: CANVAS_H,
          mimeType: 'image/png',
          pixelRatio: 1
        });
        previewImage.src = exportedDataUrl;
        loadingOverlay.classList.add('hidden');
        showScreen('preview');
      } catch (err) {
        console.error('Export failed:', err);
        alert('Generation failed. Please try again.');
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
