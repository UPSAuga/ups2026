document.addEventListener('DOMContentLoaded', () => {
  // DOM Elements
  const screens = {
    upload: document.getElementById('screen-upload'),
    editor: document.getElementById('screen-editor'),
    preview: document.getElementById('screen-preview'),
  };

  const uploadForm = document.getElementById('upload-form');
  const inputName = document.getElementById('input-name');
  const inputPhoto = document.getElementById('input-photo');
  const btnContinue = document.getElementById('btn-continue');
  const fileHint = document.getElementById('file-hint');

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

  // State & Constants
  const CANVAS_W = 2000;
  const CANVAS_H = 2250;
  
  let stage, bgGroup, overlayImg, userImageNode;
  let exportedDataUrl = null;
  let loadedUserName = '';
  let exportPixelRatio = 1;

  // 1️⃣ PRELOAD TEMPLATE INSTANTLY
  const templateImage = new Image();
  templateImage.crossOrigin = 'anonymous';
  templateImage.src = 'assets/template.png';
  templateImage.onload = () => {
    console.log('✅ Template preloaded and ready');
  };
  templateImage.onerror = () => {
    console.warn('⚠️ Template failed to load. Ensure assets/template.png exists.');
  };

  // Screen Navigation
  function showScreen(name) {
    Object.values(screens).forEach(s => s.classList.remove('active'));
    screens[name].classList.add('active');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // Form Validation
  function validateForm() {
    const hasName = inputName.value.trim().length > 0;
    const hasFile = inputPhoto.files && inputPhoto.files.length > 0;
    const isValid = hasName && hasFile;
    btnContinue.disabled = !isValid;
    return isValid;
  }

  inputName.addEventListener('input', validateForm);
  inputPhoto.addEventListener('change', () => {
    fileHint.textContent = inputPhoto.files[0]?.name || 'No file selected';
    validateForm();
  });

  uploadForm.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!validateForm()) return;
    loadedUserName = inputName.value.trim();
    initEditor(inputPhoto.files[0]);
    showScreen('editor');
  });

  btnBack.addEventListener('click', () => {
    cleanupStage();
    showScreen('upload');
  });

  // Konva Setup & Lifecycle
  function cleanupStage() {
    if (stage) { stage.destroy(); stage = null; }
    bgGroup = null; overlayImg = null; userImageNode = null;
  }

  function initEditor(file) {
    cleanupStage();

    const container = document.getElementById('canvas-container');
    const displayWidth = container.clientWidth || 400;
    const displayHeight = Math.round(displayWidth * (CANVAS_H / CANVAS_W));
    
    // Set exact container size
    container.style.height = `${displayHeight}px`;
    exportPixelRatio = CANVAS_W / displayWidth;

    stage = new Konva.Stage({
      container: 'konva-stage',
      width: displayWidth,
      height: displayHeight,
    });

    // 2️⃣ USER IMAGE LAYER (CLIPPED TO CANVAS BOUNDS)
    bgGroup = new Konva.Group({
      clip: { x: 0, y: 0, width: displayWidth, height: displayHeight },
      listening: true
    });
    stage.add(bgGroup);

    // 3️⃣ TEMPLATE OVERLAY (FIXED ON TOP)
    overlayImg = new Konva.Image({
      image: templateImage,
      x: 0, y: 0,
      width: displayWidth,
      height: displayHeight,
      listening: false,
      draggable: false
    });
    stage.add(overlayImg);

    // Load & Position User Image
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
    img.src = URL.createObjectURL(file);

    // Draw template immediately if already loaded
    if (templateImage.complete && templateImage.naturalWidth > 0) {
      overlayImg.image(templateImage);
      stage.draw();
    }

    bindControls();
  }

  function bindControls() {
    zoomSlider.oninput = () => {
      if (!userImageNode) return;
      const factor = parseFloat(zoomSlider.value);
      const base = userImageNode._defaults.scaleX;
      const newScale = base * factor;
      userImageNode.scale({ x: newScale, y: newScale });
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

  function generatePreview() {
    if (!stage) return;
    loadingOverlay.classList.remove('hidden');

    setTimeout(() => {
      try {
        // Export at exact 2000x2250
        exportedDataUrl = stage.toDataURL({
          width: CANVAS_W,
          height: CANVAS_H,
          mimeType: 'image/png',
          pixelRatio: exportPixelRatio,
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
    }, 200);
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

  // Init
  showScreen('upload');
});
