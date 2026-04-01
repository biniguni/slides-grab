// editor-init.js — Entry point: imports, event bindings, init()

import { state, TOOL_MODE_DRAW, TOOL_MODE_SELECT } from './editor-state.js';
import {
  btnPrev, btnNext, slideIframe, drawLayer, promptInput, modelSelect,
  btnSend, btnClearBboxes, slideCounter,
  toggleBold, toggleItalic, toggleUnderline, toggleStrike,
  alignLeft, alignCenter, alignRight,
  popoverTextInput, popoverApplyText, popoverTextColorInput, popoverBgColorInput,
  popoverSizeInput, popoverApplySize, toolModeDrawBtn, toolModeSelectBtn,
  btnDeleteObject,
} from './editor-dom.js';
import {
  currentSlideFile, getSlideState, normalizeModelName, setStatus,
  saveSelectedModel, loadModelOptions, clamp,
} from './editor-utils.js';
import { renderChatMessages } from './editor-chat.js';
import {
  onBboxChange, renderBboxes, scaleSlide, startDrawing, moveDrawing, endDrawing,
  clearBboxesForCurrentSlide, initBboxLayerEvents, getXPath,
} from './editor-bbox.js';
import {
  setToolMode, updateToolModeUI, renderObjectSelection, updateObjectEditorControls,
  getSelectedObjectElement, setSelectedObjectXPath, updateHoveredObjectFromPointer,
  clearHoveredObject, getSelectableTargetAt, readSelectedObjectStyleState,
  initDragAndDrop,
} from './editor-select.js';
import {
  mutateSelectedObject, applyTextDecorationToken,
  undoLastChange, deleteSelectedObject,
} from './editor-direct-edit.js';
import { updateSendState, applyChanges } from './editor-send.js';
import { goToSlide } from './editor-navigation.js';
import { connectSSE, loadRunsInitial } from './editor-sse.js';

// Late-binding: connect bbox changes to updateSendState
onBboxChange(updateSendState);

// Bbox layer events
initBboxLayerEvents();
initDragAndDrop();

// Navigation
btnPrev.addEventListener('click', () => { void goToSlide(state.currentIndex - 1); });
btnNext.addEventListener('click', () => { void goToSlide(state.currentIndex + 1); });

// Tool modes
toolModeDrawBtn.addEventListener('click', () => setToolMode(TOOL_MODE_DRAW));
toolModeSelectBtn.addEventListener('click', () => setToolMode(TOOL_MODE_SELECT));

// Clear bboxes
btnClearBboxes.addEventListener('click', clearBboxesForCurrentSlide);

// Iframe interactions
slideIframe.addEventListener('load', () => {
  const doc = slideIframe.contentDocument;
  if (!doc) return;

  doc.addEventListener('mousemove', (event) => {
    if (state.toolMode !== TOOL_MODE_SELECT) return;
    updateHoveredObjectFromPointer(event.clientX, event.clientY);
  });

  doc.addEventListener('mouseleave', clearHoveredObject);

  doc.addEventListener('click', (event) => {
    if (state.toolMode !== TOOL_MODE_SELECT) return;
    const target = getSelectableTargetAt(event.clientX, event.clientY);
    if (!target) {
      setSelectedObjectXPath('', 'No selectable object at this point.');
      return;
    }

    const xpath = getXPath(target);
    setSelectedObjectXPath(xpath, `Object selected on ${currentSlideFile()}.`);
  });
});

window.addEventListener('mousemove', moveDrawing);
window.addEventListener('mouseup', endDrawing);

// Send
btnSend.addEventListener('click', applyChanges);

// Model select
modelSelect.addEventListener('change', () => {
  const nextModel = normalizeModelName(modelSelect.value);
  if (!state.availableModels.includes(nextModel)) {
    modelSelect.value = state.selectedModel;
    return;
  }

  const slide = currentSlideFile();
  if (slide) {
    const ss = getSlideState(slide);
    ss.model = nextModel;
  }
  state.selectedModel = nextModel;
  state.defaultModel = nextModel;
  saveSelectedModel(state.selectedModel);
  updateSendState();
  setStatus(`Model selected: ${state.selectedModel}`);
});

// Prompt input
promptInput.addEventListener('input', () => {
  const slide = currentSlideFile();
  if (slide) {
    const ss = getSlideState(slide);
    ss.prompt = promptInput.value;
  }
  updateSendState();
});

// Text editing
popoverApplyText.addEventListener('click', () => {
  if (popoverApplyText.disabled) return;
  mutateSelectedObject((el) => {
    const escaped = popoverTextInput.value
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    el.innerHTML = escaped.replace(/\n/g, '<br>');
  }, 'Object text updated and saved.', { delay: 120 });
});

popoverApplySize.addEventListener('click', () => {
  if (popoverApplySize.disabled) return;
  const size = clamp(Number.parseInt(popoverSizeInput.value || '24', 10) || 24, 8, 180);
  mutateSelectedObject((el) => {
    el.style.fontSize = `${size}px`;
  }, 'Object font size updated and saved.');
});

popoverTextInput.addEventListener('keydown', (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
    event.preventDefault();
    event.stopPropagation();
    popoverApplyText.click();
  }
});

popoverSizeInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') {
    event.preventDefault();
    event.stopPropagation();
    popoverApplySize.click();
  }
});

popoverTextColorInput.addEventListener('input', () => {
  if (popoverTextColorInput.disabled) return;
  mutateSelectedObject((el) => {
    // !important를 붙여서 기존의 고집센 빨간색 등 고정 스타일을 덮어씀
    el.style.setProperty('color', popoverTextColorInput.value, 'important');
  }, 'Object text color updated.', { delay: 300 });
});

popoverBgColorInput.addEventListener('input', () => {
  if (popoverBgColorInput.disabled) return;
  mutateSelectedObject((el) => {
    // !important를 붙여서 배경색도 강제 적용
    el.style.setProperty('background-color', popoverBgColorInput.value, 'important');
  }, 'Object background color updated.', { delay: 300 });
});

function hasEditableFocus() {
  const activeElement = document.activeElement;
  if (!(activeElement instanceof HTMLElement)) return false;
  if (activeElement.matches('input, textarea, select')) return true;
  return activeElement.isContentEditable;
}

// Style toggles
toggleBold.addEventListener('click', () => {
  mutateSelectedObject((el) => {
    const nextBold = !readSelectedObjectStyleState(el).bold;
    el.style.fontWeight = nextBold ? '700' : '400';
  }, 'Object font weight updated and saved.');
});

toggleItalic.addEventListener('click', () => {
  mutateSelectedObject((el) => {
    const nextItalic = !readSelectedObjectStyleState(el).italic;
    el.style.fontStyle = nextItalic ? 'italic' : 'normal';
  }, 'Object font style updated and saved.');
});

toggleUnderline.addEventListener('click', () => {
  mutateSelectedObject((el) => {
    const nextUnderline = !readSelectedObjectStyleState(el).underline;
    applyTextDecorationToken(el, 'underline', nextUnderline);
  }, 'Object underline updated and saved.');
});

toggleStrike.addEventListener('click', () => {
  mutateSelectedObject((el) => {
    const nextStrike = !readSelectedObjectStyleState(el).strike;
    applyTextDecorationToken(el, 'line-through', nextStrike);
  }, 'Object strikethrough updated and saved.');
});

// Alignment
alignLeft.addEventListener('click', () => {
  mutateSelectedObject((el) => {
    el.style.textAlign = 'left';
  }, 'Object alignment updated and saved.');
});

alignCenter.addEventListener('click', () => {
  mutateSelectedObject((el) => {
    el.style.textAlign = 'center';
  }, 'Object alignment updated and saved.');
});

alignRight.addEventListener('click', () => {
  mutateSelectedObject((el) => {
    el.style.textAlign = 'right';
  }, 'Object alignment updated and saved.');
});

// Delete button
btnDeleteObject.addEventListener('click', deleteSelectedObject);

// Global keyboard listener function
function handleGlobalKeyDown(event) {
  const isInput = ['INPUT', 'TEXTAREA'].includes(event.target.tagName);
  if (isInput) return;

  // Undo: Ctrl+Z or Cmd+Z
  const key = event.key.toLowerCase();
  if ((event.ctrlKey || event.metaKey) && key === 'z') {
    event.preventDefault();
    void undoLastChange();
    return;
  }

  // Styles (only in select mode)
  if (state.toolMode === TOOL_MODE_SELECT && (event.ctrlKey || event.metaKey)) {
    if (key === 'b') { event.preventDefault(); if (!toggleBold.disabled) toggleBold.click(); return; }
    if (key === 'i') { event.preventDefault(); if (!toggleItalic.disabled) toggleItalic.click(); return; }
    if (key === 'u') { event.preventDefault(); if (!toggleUnderline.disabled) toggleUnderline.click(); return; }
  }

  // Delete/Backspace
  if (event.key === 'Delete' || event.key === 'Backspace') {
    if (getSelectedObjectElement()) {
      event.preventDefault();
      deleteSelectedObject();
      return;
    }
  }

  // Esc: 선택 즉시 해제 (강력하게!)
  if (event.key === 'Escape') {
      if (document.activeElement) document.activeElement.blur();
      const slide = currentSlideFile();
      if (slide) {
        getSlideState(slide).selectedObjectXPath = '';
      }
      renderObjectSelection();
      updateObjectEditorControls();
      setStatus('Object selection cleared.');
      return;
  }

  if (event.key === 'ArrowLeft') {
    event.preventDefault();
    void goToSlide(state.currentIndex - 1);
  } else if (event.key === 'ArrowRight') {
    event.preventDefault();
    void goToSlide(state.currentIndex + 1);
  }
}

document.addEventListener('keydown', handleGlobalKeyDown);

// Iframe load integration
slideIframe.addEventListener('load', () => {
  const doc = slideIframe.contentDocument;
  if (!doc) return;

  // 1. 내부 스타일 주입 (head가 없어도 작동하도록 바디에도 체크)
  const styleStr = `
    html, body { overflow: visible !important; height: auto !important; min-height: 100% !important; margin: 0 !important; padding: 0 !important; }
    ::-webkit-scrollbar { display: none !important; }
    * { scrollbar-width: none !important; }
  `;
  const styleEl = doc.createElement('style');
  styleEl.textContent = styleStr;
  (doc.head || doc.body || doc.documentElement).appendChild(styleEl);

  // 2. 내용물에 맞춰 전체 크기 확장 및 시인성 확보
  setTimeout(() => {
    const body = doc.body;
    if (body) {
      const fullH = Math.max(doc.documentElement.scrollHeight, body.scrollHeight, 1080);
      const fullW = Math.max(doc.documentElement.scrollWidth, body.scrollWidth, 1920);
      slideWrapper.style.width = `${fullW}px`;
      slideWrapper.style.height = `${fullH}px`;
      slideIframe.style.width = `${fullW}px`;
      slideIframe.style.height = `${fullH}px`;
    }
    renderObjectSelection();
  }, 300);

  // 3. 기존 렌더링 로직 유지
  const slide = currentSlideFile();
  if (slide) {
    const ss = getSlideState(slide);
    if (ss.selectedObjectXPath && !getSelectedObjectElement(slide)) {
      ss.selectedObjectXPath = '';
    }
  }
  state.hoveredObjectXPath = '';
  renderBboxes();
  renderObjectSelection();
  updateObjectEditorControls();
  updateSendState();

  // 4. 단축키 연결
  doc.addEventListener('keydown', handleGlobalKeyDown);
});

// Init
async function init() {
  setStatus('Loading slide list...');

  try {
    const res = await fetch('/api/slides');
    if (!res.ok) {
      throw new Error(`Failed to fetch slide list: ${res.status}`);
    }

    state.slides = await res.json();

    if (state.slides.length === 0) {
      setStatus('No slides found.');
      slideCounter.textContent = '0 / 0';
      return;
    }

    await loadModelOptions();
    updateToolModeUI();
    await goToSlide(0);
    scaleSlide();
    await loadRunsInitial();
    connectSSE();

    setStatus(`Ready. Model: ${state.selectedModel}. Draw red pending bboxes, run Codex, then review green bboxes.`);
  } catch (error) {
    setStatus(`Error loading slides: ${error.message}`);
    console.error('Init error:', error);
  }
}

init();
