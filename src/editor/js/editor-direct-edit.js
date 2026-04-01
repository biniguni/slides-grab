// editor-direct-edit.js — Style changes, direct save (debounced)

import { state, localFileUpdateBySlide } from './editor-state.js';
import { slideIframe } from './editor-dom.js';
import { currentSlideFile, getDirectSaveState, setStatus } from './editor-utils.js';
import { addChatMessage } from './editor-chat.js';
import { getSelectedObjectElement, renderObjectSelection, updateObjectEditorControls, readSelectedObjectStyleState, setSelectedObjectXPath } from './editor-select.js';
import { goToSlide } from './editor-navigation.js';

export function serializeSlideDocument(doc) {
  if (!doc?.documentElement) return '';
  const doctype = doc.doctype ? `<!DOCTYPE ${doc.doctype.name}>` : '<!DOCTYPE html>';
  return `${doctype}\n${doc.documentElement.outerHTML}`;
}

async function persistDirectSlideHtml(slide, html, message) {
  if (!slide || !html) return;

  try {
    const res = await fetch(`/api/slides/${encodeURIComponent(slide)}/save`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slide, html }),
    });
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      throw new Error(data.error || `Save failed with HTTP ${res.status}`);
    }

    localFileUpdateBySlide.set(slide, Date.now());
    if (slide === currentSlideFile()) {
      setStatus(message || `${slide} saved.`);
    }
  } catch (error) {
    addChatMessage('error', `[${slide}] Direct edit save failed: ${error.message}`, slide);
    setStatus(`Error: ${error.message}`);
  }
}

function queueDirectSave(slide, html, message) {
  const saveState = getDirectSaveState(slide);
  if (!html) return saveState.chain;
  saveState.chain = saveState.chain
    .catch(() => {})
    .then(() => persistDirectSlideHtml(slide, html, message));
  return saveState.chain;
}

export function scheduleDirectSave(delay = 0, message = 'Object updated and saved.') {
  const slide = currentSlideFile();
  const html = serializeSlideDocument(slideIframe.contentDocument);
  if (!slide || !html) return;

  const saveState = getDirectSaveState(slide);
  saveState.pendingHtml = html;
  saveState.pendingMessage = message;
  if (saveState.timer) {
    window.clearTimeout(saveState.timer);
  }
  saveState.timer = window.setTimeout(() => {
    saveState.timer = null;
    const nextHtml = saveState.pendingHtml;
    const nextMessage = saveState.pendingMessage;
    saveState.pendingHtml = '';
    queueDirectSave(slide, nextHtml, nextMessage);
  }, Math.max(0, delay));
}

export async function flushDirectSaveForSlide(slide) {
  if (!slide) return;

  const saveState = getDirectSaveState(slide);
  if (saveState.timer) {
    window.clearTimeout(saveState.timer);
    saveState.timer = null;
    const html = saveState.pendingHtml;
    const message = saveState.pendingMessage;
    saveState.pendingHtml = '';
    await queueDirectSave(slide, html, message);
    return;
  }

  await saveState.chain.catch(() => {});
}

export function applyTextDecorationToken(el, token, shouldEnable) {
  const frameWindow = slideIframe.contentWindow;
  const styles = frameWindow?.getComputedStyle ? frameWindow.getComputedStyle(el) : null;
  const parts = new Set(
    String(styles?.textDecorationLine || '')
      .split(/\s+/)
      .filter((part) => part === 'underline' || part === 'line-through'),
  );
  if (shouldEnable) {
    parts.add(token);
  } else {
    parts.delete(token);
  }
  el.style.textDecorationLine = parts.size > 0 ? Array.from(parts).join(' ') : 'none';
}

export function pushToHistory() {
  const slide = currentSlideFile();
  if (!slide || !slideIframe.contentDocument) return;

  const html = serializeSlideDocument(slideIframe.contentDocument);
  state.undoStack.push({ slide, html }); // 슬라이드 정보 포함 저장
  if (state.undoStack.length > state.maxHistorySize) {
    state.undoStack.shift();
  }
}

export async function undoLastChange() {
  if (state.undoStack.length === 0) {
    setStatus('Nothing to undo.');
    return;
  }

  const { slide, html } = state.undoStack.pop();
  
  // 1. 서버에 이전 상태의 소스코드를 즉시 덮어씌움 (영구 저장)
  setStatus('Reverting and reloading dynamic content...');
  await persistDirectSlideHtml(slide, html, 'Reverted change (Undo).');

  // 2. 만약 현재 보고 있는 슬라이드가 아니라면 해당 슬라이드 인덱스로 업데이트
  if (currentSlideFile() !== slide) {
    const idx = state.slides.indexOf(slide);
    if (idx !== -1) {
      state.currentIndex = idx;
    }
  }

  // 3. iframe을 완전히 새로고침하여 자바스크립트(그래프 등)가 다시 실행되게 함
  // 단순 innerHTML 교체 시 그래프가 소멸되는 문제를 해결
  const slideUrl = `/slides/${slide}?t=${Date.now()}`;
  slideIframe.src = slideUrl;

  // 4. 로드 완료 후 UI 갱신 (iframe 'load' 이벤트 리스너가 나머지를 처리함)
  renderObjectSelection();
  updateObjectEditorControls();
}

export function deleteSelectedObject() {
  const selected = getSelectedObjectElement();
  if (!selected) {
    setStatus('Nothing selected to delete.');
    return;
  }

  if (confirm('Are you sure you want to delete this element?')) {
    pushToHistory(); 
    selected.remove();
    setSelectedObjectXPath(''); 
    renderObjectSelection();
    scheduleDirectSave(0, 'Element deleted.');
  }
}

export function mutateSelectedObject(mutator, message, { delay = 0, preserveTextInput = false, skipHistory = false } = {}) {
  const selected = getSelectedObjectElement();
  if (!selected) return;

  if (!skipHistory) {
    pushToHistory(); // 이미 드래그 시작 시 저장했다면 건너뜀
  }
  
  mutator(selected);
  renderObjectSelection();
  updateObjectEditorControls({ preserveTextInput });
  scheduleDirectSave(delay, message);
  setStatus('Saving direct edit...');
}
