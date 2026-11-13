// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Commercial
// Copyright (C) 2026 Shkilevich Nikita

'use strict';

/**
 * JavaScript snippets injected into the page via webContents.executeJavaScript.
 * Supports two question shapes:
 *   - radio / checkbox options  -> fill by clicking
 *   - text input (sum, word, "put the stages in order" -> digits) -> fill by typing
 */

const EXTRACT_JS = String.raw`
(() => {
  const norm = (s) => String(s == null ? '' : s).replace(/\s+/g, ' ').trim();
  const visible = (el) => {
    if (!el || !el.getBoundingClientRect) return false;
    const st = window.getComputedStyle(el);
    if (!st || st.display === 'none' || st.visibility === 'hidden') return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  };
  const toLines = (s) => String(s == null ? '' : s).split(/\n+/).map(norm).filter(Boolean);
  const isServiceLine = (line) => {
    if (/^(вопрос|варианты\s+ответа|ваш\s+ответ)\s*:?$/i.test(line)) return true;
    if (/^(ответ\s+ввести|текущий\s+вопрос|всего\s+вопросов|осталось|лимит\s+времени|итого|время\s+на)/i.test(line)) return true;
    return false;
  };

  // Remove markers from the previous extraction.
  ['data-ts-opt', 'data-ts-next', 'data-ts-input', 'data-ts-drop'].forEach((name) => {
    document.querySelectorAll('[' + name + ']').forEach((el) => el.removeAttribute(name));
  });

  const bodyRaw = String(document.body ? document.body.innerText : '');
  const bodyText = norm(bodyRaw).slice(0, 4000);
  const bodyLines = toLines(bodyRaw);

  const qnumMatch = bodyText.match(/Текущий\s+вопрос\s*[:\-]?\s*(\d+)/i);
  const totalMatch = bodyText.match(/Всего\s+вопросов\s*[:\-]?\s*(\d+)/i);
  const qnum = qnumMatch ? Number(qnumMatch[1]) : null;
  const total = totalMatch ? Number(totalMatch[1]) : null;

  const labelCandidates = Array.from(
    document.querySelectorAll('div,p,td,th,li,h1,h2,h3,h4,h5,span,strong,b,dt,dd')
  );
  const questionLabel = labelCandidates.find(
    (el) => visible(el) && /^Вопрос\s*:?$/i.test(norm(el.innerText || el.textContent))
  );
  const answerLabel = labelCandidates.find(
    (el) => visible(el) && /^Ваш\s+ответ\s*:?$/i.test(norm(el.innerText || el.textContent))
  );

  /* --------------------------- choices --------------------------- */

  const allChoices = Array.from(document.querySelectorAll('input[type="radio"], input[type="checkbox"]'));
  const visibleChoices = allChoices.filter(visible);
  const choices = visibleChoices.length >= 2 ? visibleChoices : allChoices;

  const groups = new Map();
  for (const el of choices) {
    const key = el.name || '__unnamed__';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(el);
  }
  let group = null;
  for (const [, els] of groups) {
    if (els.length < 2) continue;
    if (!group || els.length > group.els.length) group = { els };
  }

  const labelOfInput = (el) => {
    if (el.id) {
      try {
        const forLabel = document.querySelector('label[for="' + CSS.escape(el.id) + '"]');
        if (forLabel && visible(forLabel)) return forLabel;
      } catch (e) { /* ignore */ }
    }
    const parent = el.closest('label');
    return parent && visible(parent) ? parent : null;
  };

  const textOfChoice = (el, idx) => {
    const label = labelOfInput(el);
    if (label) {
      const t = norm(label.innerText || label.textContent);
      if (t.length > 1) return t;
    }
    let best = '';
    let node = el;
    for (let depth = 0; depth < 7 && node && node.parentElement; depth += 1) {
      node = node.parentElement;
      if (!/^(TR|LI|TD|DD|DT|P|DIV|SPAN|LABEL)$/.test(node.tagName)) continue;
      if (node.querySelectorAll('input[type="radio"], input[type="checkbox"]').length > 1) break;
      const t = norm(node.innerText || node.textContent);
      if (t.length > best.length) best = t;
      if (best.length > 3 && /^(TR|LI|P|DIV)$/.test(node.tagName)) break;
    }
    if (best) return best;
    let sib = el.nextSibling;
    let acc = '';
    while (sib && acc.length < 800) {
      if (sib.nodeType === 3) acc += sib.nodeValue;
      else if (sib.nodeType === 1) acc += sib.innerText || sib.textContent || '';
      sib = sib.nextSibling;
      if (norm(acc).length > 3) break;
    }
    return norm(acc) || ('Вариант ' + (idx + 1));
  };

  const options = group ? group.els.map((el, i) => ({ i, text: textOfChoice(el, i), type: el.type })) : [];
  const optSet = new Set(options.map((o) => norm(o.text).toLowerCase()));

  /* -------------------------- text input ------------------------- */

  const isSearchLike = (el) => {
    if (el.tagName === 'TEXTAREA') return false;
    if ((el.getAttribute('type') || '').toLowerCase() === 'search') return true;
    const sig = [el.name, el.id, el.className, el.placeholder, el.getAttribute('aria-label')].join(' ');
    return /(search|поиск|login|логин|password|пароль|email|captcha|otp|капч|фильтр|filter)/i.test(sig);
  };

  const textInputs = Array.from(document.querySelectorAll('input, textarea')).filter((el) => {
    const type = (el.getAttribute('type') || 'text').toLowerCase();
    if (['text', 'number', 'search', ''].indexOf(type) < 0) return false;
    if (!visible(el) || el.disabled || el.readOnly) return false;
    return !isSearchLike(el);
  });

  let textInput = null;
  if (!group && textInputs.length) {
    // Prefer the field right next to the "Ваш ответ:" label, then the field in
    // the same block as "Вопрос:". The last visible input is the fallback.
    const containers = [];
    if (answerLabel) {
      if (answerLabel.parentElement) containers.push(answerLabel.parentElement);
      if (answerLabel.nextElementSibling) containers.push(answerLabel.nextElementSibling);
      if (answerLabel.parentElement && answerLabel.parentElement.nextElementSibling) {
        containers.push(answerLabel.parentElement.nextElementSibling);
      }
    }
    if (questionLabel && questionLabel.parentElement) containers.push(questionLabel.parentElement);
    for (const container of containers) {
      if (!container || !container.contains) continue;
      const found = textInputs.find((el) => container.contains(el));
      if (found) {
        textInput = found;
        break;
      }
    }
    if (!textInput) textInput = textInputs[textInputs.length - 1];
  }

  /* ------------------------ question text ------------------------ */

  const dropOptionNodes = (els) => {
    for (const el of els) {
      let node = el.parentElement;
      let target = null;
      for (let depth = 0; depth < 6 && node && node !== document.body; depth += 1) {
        if (/^(TR|TD|TH|LI|LABEL|P|DIV|DD|DT|SPAN)$/.test(node.tagName)) {
          const count = node.querySelectorAll('input[type="radio"], input[type="checkbox"]').length;
          if (count === 1) {
            const text = norm(node.innerText || node.textContent);
            if (!target) target = node;
            if (text.length >= 3 && text.length < 700) { target = node; break; }
          }
        }
        node = node.parentElement;
      }
      if (target) target.setAttribute('data-ts-drop', '1');
    }
  };

  if (options.length) dropOptionNodes(group.els);

  // innerText on a detached clone loses line breaks (no layout), so walk the
  // tree and insert breaks around block elements instead.
  const BLOCK_TAGS = /^(ADDRESS|ARTICLE|ASIDE|BLOCKQUOTE|DD|DIV|DL|DT|FIELDSET|FIGCAPTION|FIGURE|FOOTER|FORM|H[1-6]|HEADER|HR|LI|MAIN|NAV|OL|P|PRE|SECTION|TABLE|TBODY|TD|TFOOT|TH|THEAD|TR|UL)$/;
  const SKIP_TAGS = /^(SCRIPT|STYLE|INPUT|TEXTAREA|SELECT|OPTION|BUTTON|SVG|NOSCRIPT)$/;

  const collectText = (node, out) => {
    if (!node) return;
    if (node.nodeType === 3) {
      out.push(node.nodeValue || '');
      return;
    }
    if (node.nodeType !== 1) return;
    const tag = node.tagName;
    if (SKIP_TAGS.test(tag)) return;
    if (node.hasAttribute && node.hasAttribute('data-ts-drop')) return;
    if (tag === 'BR') {
      out.push('\n');
      return;
    }
    const block = BLOCK_TAGS.test(tag);
    if (block) out.push('\n');
    for (const child of node.childNodes) collectText(child, out);
    if (block) out.push('\n');
  };

  const cleanText = (root) => {
    const parts = [];
    collectText(root, parts);
    return toLines(parts.join(''))
      .filter((line) => !isServiceLine(line))
      .filter((line) => !optSet.has(line.toLowerCase()))
      .join('\n')
      .replace(/^Вопрос\s*:?\s*/i, '')
      .trim();
  };

  const commonAncestor = (nodes) => {
    if (!nodes.length) return null;
    let node = nodes[0];
    for (const other of nodes.slice(1)) {
      while (node && !node.contains(other)) node = node.parentElement;
    }
    return node;
  };

  const optionHeavy = (text) => {
    if (options.length < 2) return false;
    const low = norm(text).toLowerCase();
    let hits = 0;
    for (const option of options) {
      const key = norm(option.text).toLowerCase().slice(0, 40);
      if (key && low.includes(key)) hits += 1;
    }
    return hits >= options.length;
  };

  let container = null;
  if (group) container = commonAncestor(group.els);
  else if (textInput) container = (questionLabel && questionLabel.parentElement) || textInput.parentElement;

  let question = '';
  let node = container;
  for (let depth = 0; depth < 5 && node && node !== document.body; depth += 1) {
    const candidate = cleanText(node);
    if (candidate.length >= 5 && !optionHeavy(candidate)) {
      question = candidate;
      break;
    }
    node = node.parentElement;
  }

  // Fallback: the text block right above the answer area.
  if (!question) {
    let cursor = group ? group.els[0] : textInput;
    while (cursor && !question) {
      let prev = cursor.previousElementSibling;
      while (prev && !question) {
        if (!prev.querySelector || prev.querySelectorAll('input').length === 0) {
          const candidate = cleanText(prev);
          if (candidate.length >= 5 && !optionHeavy(candidate)) question = candidate;
        }
        prev = prev.previousElementSibling;
      }
      cursor = cursor.parentElement;
    }
  }

  question = String(question || '').trim().slice(0, 2500);

  /* --------------------------- hints ----------------------------- */

  const items = [];
  question.split('\n').forEach((line) => {
    const m = line.match(/^(\d{1,2})\s*[.)]\s+(.{2,})$/);
    if (m) items.push({ n: Number(m[1]), text: norm(m[2]) });
  });

  // Numbered statements can be an <ol> where the browser renders the numbers:
  // textContent then has no "1." prefix, so take the numbers from the list.
  if (!items.length && textInput) {
    const listRoot = container || document;
    const listItems = Array.from(listRoot.querySelectorAll('ol > li')).filter(visible);
    listItems.forEach((li, i) => {
      const text = norm(li.innerText || li.textContent);
      if (text) items.push({ n: i + 1, text });
    });
  }

  const expectedFormat =
    bodyLines.find(
      (line) => /(без\s+пробелов|например|в\s+виде|введите)/i.test(line) && line.length < 300
    ) ||
    bodyLines.find((line) => /последовательност/i.test(line) && line.length < 300) ||
    '';

  let inputHint = '';
  if (textInput) {
    const parts = [];
    const label = labelOfInput(textInput);
    if (label) parts.push(norm(label.innerText || label.textContent));
    if (textInput.placeholder) parts.push(textInput.placeholder);
    const aria = textInput.getAttribute('aria-label');
    if (aria) parts.push(aria);
    if (!parts.length) {
      let prev = textInput.previousElementSibling;
      while (prev && !parts.length) {
        const t = norm(prev.innerText || prev.textContent);
        if (t.length > 1 && t.length < 120) parts.push(t);
        prev = prev.previousElementSibling;
      }
    }
    inputHint = norm(parts.join(' ')).slice(0, 160);
  }

  /* --------------------------- button ---------------------------- */

  const buttons = Array.from(
    document.querySelectorAll('button, input[type="submit"], input[type="button"], a[role="button"], a.btn, .btn, .button')
  ).filter((el) => visible(el) && !el.disabled);
  const nextRe = /(продолж|далее|следующ|заверш|законч|next|continue|submit|отправ)/i;
  let nextButton = buttons.find((b) => nextRe.test(norm(b.innerText || b.value || '')));
  if (!nextButton) nextButton = buttons.find((b) => /^(BUTTON|INPUT)$/.test(b.tagName) && /submit|button/i.test(b.type || ''));
  const buttonText = nextButton ? norm(nextButton.innerText || nextButton.value || '') : '';
  if (nextButton) nextButton.setAttribute('data-ts-next', '1');

  const kind = group ? 'choice' : (textInput ? 'text' : null);

  if (!kind) {
    return {
      ok: false,
      reason: 'no-options',
      url: location.href,
      title: document.title,
      bodyText: bodyText.slice(0, 600),
      resultHint: /(результат|завершен|оценк|балл|попытк|итог)/i.test(bodyText)
    };
  }

  if (group) group.els.forEach((el, i) => el.setAttribute('data-ts-opt', String(i)));
  if (textInput) textInput.setAttribute('data-ts-input', '1');

  const signatureSource = [qnum === null ? '' : qnum, question, inputHint]
    .concat(options.map((o) => o.text))
    .concat(items.map((it) => it.text))
    .join('|');
  let hash = 5381;
  for (let i = 0; i < signatureSource.length; i += 1) {
    hash = (((hash * 33) ^ signatureSource.charCodeAt(i)) >>> 0);
  }

  return {
    ok: true,
    kind,
    type: group ? (options[0] && options[0].type === 'checkbox' ? 'multi' : 'single') : 'text',
    url: location.href,
    title: document.title,
    qnum,
    total,
    question,
    options,
    items,
    inputHint,
    expectedFormat,
    hasInput: Boolean(textInput),
    inputMaxLength: textInput ? textInput.maxLength : 0,
    buttonText,
    hasNextButton: Boolean(nextButton),
    pageSig: hash.toString(16) + ':' + signatureSource.length,
    bodyText: bodyText.slice(0, 600)
  };
})()
`;

function clickOptionScript(index) {
  const i = Number(index) || 0;
  return `
(() => {
  const el = document.querySelector('input[data-ts-opt="${i}"]');
  if (!el) return { ok: false, reason: 'option-not-found' };
  try { el.scrollIntoView({ block: 'center' }); } catch (e) { /* ignore */ }

  el.click();
  if (!el.checked) {
    var label = null;
    if (el.id) {
      try { label = document.querySelector('label[for="' + CSS.escape(el.id) + '"]'); } catch (e) { label = null; }
    }
    if (!label) label = el.closest('label');
    if (label) label.click();
  }
  if (!el.checked) {
    el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
  }
  if (!el.checked && el.type === 'radio') {
    el.checked = true;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }

  const mark = el.closest('tr') || el.closest('li') || el.closest('label') || el.parentElement;
  if (mark) {
    mark.style.transition = 'background-color .25s';
    mark.style.backgroundColor = 'rgba(46, 160, 67, 0.22)';
  }
  el.style.outline = '2px solid #2ea043';
  el.style.outlineOffset = '2px';

  return { ok: Boolean(el.checked), index: ${i}, type: el.type };
})()
`;
}

function highlightOptionScript(index) {
  const i = Number(index) || 0;
  return `
(() => {
  const el = document.querySelector('input[data-ts-opt="${i}"]');
  if (!el) return { ok: false, reason: 'option-not-found' };
  try { el.scrollIntoView({ block: 'center' }); } catch (e) { /* ignore */ }
  const mark = el.closest('tr') || el.closest('li') || el.closest('label') || el.parentElement;
  if (mark) {
    mark.style.transition = 'background-color .25s';
    mark.style.backgroundColor = 'rgba(37, 99, 235, 0.20)';
  }
  el.style.outline = '2px dashed #2563eb';
  el.style.outlineOffset = '2px';
  return { ok: true, index: ${i} };
})()
`;
}

/** Types the value into the answer field the way a real user (and frameworks) expect. */
function fillTextScript(value) {
  const payload = JSON.stringify(String(value == null ? '' : value));
  return `
(() => {
  const value = ${payload};
  const visible = (el) => Boolean(el) && el.offsetParent !== null;
  let el = document.querySelector('[data-ts-input="1"]');
  if (!el) {
    el = Array.from(document.querySelectorAll('input[type="text"], input:not([type]), textarea'))
      .filter(visible)
      .pop();
  }
  if (!el) return { ok: false, reason: 'input-not-found' };

  try { el.scrollIntoView({ block: 'center' }); } catch (e) { /* ignore */ }
  try { el.focus(); } catch (e) { /* ignore */ }

  const proto = el.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
  let descriptor = null;
  try { descriptor = Object.getOwnPropertyDescriptor(proto, 'value'); } catch (e) { descriptor = null; }
  if (descriptor && descriptor.set) descriptor.set.call(el, value);
  else el.value = value;

  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
  // No synthetic Enter: on some tests it submits the form and advances before
  // the runner clicks «Продолжить», which would skip a question.
  try { el.blur(); } catch (e) { /* ignore */ }

  const mark = el.closest('tr') || el.closest('li') || el.closest('label') || el.parentElement;
  if (mark) {
    mark.style.transition = 'background-color .25s';
    mark.style.backgroundColor = 'rgba(46, 160, 67, 0.18)';
  }
  el.style.outline = '2px solid #2ea043';
  el.style.outlineOffset = '2px';

  return { ok: el.value === value, value: el.value, maxLength: el.maxLength };
})()
`;
}

function highlightInputScript() {
  return `
(() => {
  const el = document.querySelector('[data-ts-input="1"]');
  if (!el) return { ok: false, reason: 'input-not-found' };
  try { el.scrollIntoView({ block: 'center' }); } catch (e) { /* ignore */ }
  const mark = el.closest('tr') || el.closest('li') || el.closest('label') || el.parentElement;
  if (mark) {
    mark.style.transition = 'background-color .25s';
    mark.style.backgroundColor = 'rgba(37, 99, 235, 0.18)';
  }
  el.style.outline = '2px dashed #2563eb';
  el.style.outlineOffset = '2px';
  return { ok: true };
})()
`;
}

function clickNextScript() {
  return `
(() => {
  const norm = (s) => String(s == null ? '' : s).replace(/\\s+/g, ' ').trim();
  let btn = document.querySelector('[data-ts-next="1"]');
  if (!btn) {
    const re = /(продолж|далее|следующ|заверш|законч|next|continue|submit|отправ)/i;
    const found = Array.from(document.querySelectorAll('button, input[type="submit"], input[type="button"], a.btn, .btn'))
      .filter((el) => !el.disabled && el.offsetParent !== null);
    btn = found.find((el) => re.test(norm(el.innerText || el.value || '')));
  }
  if (!btn) return { ok: false, reason: 'button-not-found' };
  try { btn.scrollIntoView({ block: 'center' }); } catch (e) { /* ignore */ }
  btn.click();
  return { ok: true, text: norm(btn.innerText || btn.value || '') };
})()
`;
}

/** Full page markup, used for diagnostics when the question cannot be parsed. */
function pageHtmlScript() {
  return `(() => ({ url: location.href, title: document.title, html: document.documentElement.outerHTML }))()`;
}

module.exports = {
  EXTRACT_JS,
  clickOptionScript,
  highlightOptionScript,
  fillTextScript,
  highlightInputScript,
  clickNextScript,
  pageHtmlScript
};
