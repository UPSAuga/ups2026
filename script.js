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

  // State
  let stage, bgLayer, overlayLayer, userImageNode;
  let exportedDataUrl = null;
  let loadedUserName = '';
  let exportPixelRatio = 1;

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

  // Konva Setup
  function cleanupStage() {
    if (stage) { stage.destroy(); stage = null; }
    bgLayer = null; overlayLayer = null; userImageNode = null;
  }

  function initEditor(file) {
    cleanupStage();

    const container = document.getElementById('canvas-container');
    const displayWidth = container.clientWidth || 400;
    const displayHeight = displayWidth * (2250 / 2000);
    container.style.height = `${displayHeight}px`;
    exportPixelRatio = 2000 / displayWidth;

    stage = new Konva.Stage({
      container: 'konva-stage',
      width: displayWidth,
      height: displayHeight,
    });

    bgLayer = new Konva.Layer();
    overlayLayer = new Konva.Layer();
    stage.add(bgLayer);
    stage.add(overlayLayer);

    loadImage(file);
    loadTemplate();
    bindControls();
  }

  function loadImage(file) {
    const img = new Image();
    img.onload = () => {
      // Calculate scale to cover the canvas
      const scaleX = stage.width() / img.width;
      const scaleY = stage.height() / img.height;
      const baseScale = Math.max(scaleX, scaleY) * 1.15; // slight bleed for dragging

      userImageNode = new Konva.Image({
        image: img,
        x: stage.width() / 2,
        y: stage.height() / 2,
        offsetX: img.width / 2,
        offsetY: img.height / 2,
        scaleX: baseScale,
        scaleY: baseScale,
        draggable: true,
      });

      bgLayer.add(userImageNode);
      bgLayer.batchDraw();

      // Store defaults for reset
      userImageNode._defaults = {
        x: stage.width() / 2,
        y: stage.height() / 2,
        scaleX: baseScale,
        scaleY: baseScale,
        rotation: 0
      };

      // Reset sliders to default state
      zoomSlider.value = 1;
      rotateSlider.value = 0;
      updateSliderLabels();
    };
    img.src = URL.createObjectURL(file);
  }

  function loadTemplate() {
    const tpl = new Image();
    tpl.onload = () => {
      const tplImg = new Konva.Image({
        image: tpl,
        x: 0, y: 0,
        width: stage.width(),
        height: stage.height(),
        listening: false
      });
      overlayLayer.add(tplImg);
      overlayLayer.batchDraw();
    };
    tpl.onerror = () => {
      console.warn('Template failed to load. Make sure assets/template.png exists.');
    };
    tpl.src = 'assets/template.png';
  }

  function bindControls() {
    zoomSlider.oninput = () => {
      if (!userImageNode) return;
      const factor = parseFloat(zoomSlider.value);
      const base = userImageNode._defaults.scaleX;
      const newScale = base * factor;
      userImageNode.scale({ x: newScale, y: newScale });
      bgLayer.batchDraw();
      updateSliderLabels();
    };

    rotateSlider.oninput = () => {
      if (!userImageNode) return;
      userImageNode.rotation(parseFloat(rotateSlider.value));
      bgLayer.batchDraw();
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
      bgLayer.batchDraw();
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

    // Allow UI to render spinner
    setTimeout(() => {
      try {
        exportedDataUrl = stage.toDataURL({
          width: 2000,
          height: 2250,
          mimeType: 'image/png',
          pixelRatio: exportPixelRatio
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

  btnEditAgain.onclick = () => {
    showScreen('editor');
  };
});
