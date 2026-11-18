'use strict';

(() => {
  const form = document.querySelector('#signup');
  const fields = document.querySelector('#signup-fields');
  const children = document.querySelector('#children');
  const template = children.querySelector('.child').cloneNode(true);
  const addButton = document.querySelector('#add-child');
  const limitNote = document.querySelector('#child-limit');
  const submitButton = document.querySelector('#submit');
  const summary = document.querySelector('#error-summary');
  const summaryList = summary.querySelector('ul');
  const status = document.querySelector('#submission-status');
  const announcement = document.querySelector('#child-announcement');
  const consent = document.querySelector('#consent');
  const consentText = document.querySelector('.consent-row span').textContent;
  const levels = new Set(['Rec', 'AYSO', 'Club', 'Competitive', 'Other']);
  const entryKeys = ['parentName', 'parentEmail', 'parentPhone', 'city', 'childCount', 'children', 'consent'];
  let nextKey = 1;
  let validationAttempted = false;
  let inFlight = false;

  const childBlocks = () => Array.from(children.querySelectorAll('.child'));
  const clean = control => control.value.replace(/[\r\n]+/g, ' ').trim();

  function refreshChildren() {
    const blocks = childBlocks();
    blocks.forEach((block, index) => {
      block.querySelector('legend').textContent = `Child ${index + 1}`;
      const removeButton = block.querySelector('button');
      if (removeButton) removeButton.setAttribute('aria-label', `Remove child ${index + 1}`);
    });
    addButton.hidden = blocks.length >= 6;
    limitNote.hidden = blocks.length < 6;
  }

  function updateAfterAttempt() {
    if (validationAttempted) validate();
  }

  function addChild() {
    if (inFlight || childBlocks().length >= 6) return;
    const block = template.cloneNode(true);
    const key = ++nextKey;
    block.dataset.key = String(key);
    block.querySelectorAll('.field').forEach(field => {
      const control = field.querySelector('input, select');
      const suffix = control.id.split('-').pop();
      control.id = `child-${key}-${suffix}`;
      control.value = '';
      control.removeAttribute('aria-invalid');
      const error = field.querySelector('.field-error');
      error.id = `${control.id}-error`;
      error.textContent = '';
      error.hidden = true;
      field.querySelector('label').htmlFor = control.id;
      control.setAttribute('aria-describedby', error.id);
    });
    const removeButton = document.createElement('button');
    removeButton.type = 'button';
    removeButton.className = 'text-button';
    removeButton.textContent = 'Remove';
    removeButton.addEventListener('click', () => removeChild(block));
    block.append(removeButton);
    children.append(block);
    refreshChildren();
    updateAfterAttempt();
    block.querySelector('input').focus();
    announcement.textContent = `Child ${childBlocks().length} added`;
  }

  function removeChild(block) {
    if (inFlight || block.dataset.key === '1') return;
    const blocks = childBlocks();
    const index = blocks.indexOf(block);
    if (index < 0) return;
    block.remove();
    refreshChildren();
    updateAfterAttempt();
    const remaining = childBlocks();
    (remaining[index] || remaining[index - 1]).querySelector('input').focus();
    announcement.textContent = `Child ${index + 1} removed`;
  }

  function validAge(value) {
    if (/^[0-9]{1,2}$/.test(value)) return Number(value) >= 1 && Number(value) <= 99;
    if (/^[0-9]{4}$/.test(value)) return Number(value) >= 1900 && Number(value) <= new Date().getFullYear();
    return false;
  }

  function validate() {
    const errors = [];
    function check(control, label, message) {
      const error = document.getElementById(control.getAttribute('aria-describedby'));
      error.textContent = message;
      error.hidden = !message;
      if (message) {
        control.setAttribute('aria-invalid', 'true');
        errors.push({ control, label, message });
      } else {
        control.removeAttribute('aria-invalid');
      }
    }
    const parentName = document.querySelector('#parent-name');
    const parentEmail = document.querySelector('#parent-email');
    const parentPhone = document.querySelector('#parent-phone');
    const city = document.querySelector('#city');
    check(parentName, 'Parent/guardian name', clean(parentName) ? '' : 'Enter a parent or guardian name.');
    const email = clean(parentEmail);
    check(parentEmail, 'Parent email', !email ? 'Enter your email address.' :
      parentEmail.validity.valid && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) ? '' : 'Enter a full email address, like name@example.com.');
    const phone = parentPhone.value.trim();
    check(parentPhone, 'Parent phone', !phone ? 'Enter a phone number.' :
      /^[0-9+ .()-]+$/.test(phone) && phone.replace(/[^0-9]/g, '').length >= 10 ? '' :
        'Enter a phone number with at least 10 digits.');
    check(city, 'City', clean(city) ? '' : 'Enter your city.');
    childBlocks().forEach((block, index) => {
      const [name, age, level] = block.querySelectorAll('input, select');
      const prefix = `Child ${index + 1}`;
      check(name, `${prefix}: Child first name`, clean(name) ? '' : 'Enter the child’s first name.');
      const ageValue = clean(age);
      check(age, `${prefix}: Age or birth year`, !ageValue ? 'Enter an age or birth year.' :
        validAge(ageValue) ? '' : 'Enter an age or a four-digit birth year.');
      check(level, `${prefix}: Playing level`, levels.has(level.value) ? '' : 'Select a playing level.');
    });
    check(consent, 'Consent', consent.checked ? '' : 'Check the box to agree to tryout and team emails.');
    summaryList.replaceChildren();
    errors.forEach(({ control, label, message }) => {
      const item = document.createElement('li');
      const link = document.createElement('a');
      link.href = `#${control.id}`;
      link.textContent = `${label}: ${message}`;
      link.addEventListener('click', event => {
        event.preventDefault();
        control.focus();
      });
      item.append(link);
      summaryList.append(item);
    });
    summary.hidden = errors.length === 0;
    return errors.length === 0;
  }

  function configured(config) {
    if (!config || typeof config.formAction !== 'string' ||
      config.formAction !== config.formAction.trim() ||
      !/^https:\/\/docs\.google\.com\/forms\/d\/e\/[A-Za-z0-9_-]+\/formResponse$/.test(config.formAction) ||
      !config.entries || config.consentValue !== consentText) return false;
    const entries = entryKeys.map(key => config.entries[key]);
    return entries.every(entry => typeof entry === 'string' && entry === entry.trim() && /^entry\.[0-9]+$/.test(entry)) &&
      new Set(entries).size === entryKeys.length;
  }

  async function submit(event) {
    event.preventDefault();
    if (inFlight) return;
    validationAttempted = true;
    status.textContent = '';
    if (!validate()) {
      summary.focus();
      return;
    }
    const config = window.SOUSA_TRYOUT_FORM;
    if (!configured(config)) {
      status.textContent = 'Signups open soon, please check back.';
      return;
    }
    const blocks = childBlocks();
    const values = {
      parentName: clean(document.querySelector('#parent-name')),
      parentEmail: clean(document.querySelector('#parent-email')),
      parentPhone: document.querySelector('#parent-phone').value.trim(),
      city: clean(document.querySelector('#city')),
      childCount: String(blocks.length),
      children: blocks.map((block, index) => {
        const [name, age, level] = block.querySelectorAll('input, select');
        return `Child ${index + 1}: ${clean(name)} | ${clean(age)} | ${level.value}`;
      }).join('\n'),
      consent: config.consentValue
    };
    const params = new URLSearchParams();
    entryKeys.forEach(key => params.set(config.entries[key], values[key]));
    inFlight = true;
    submitButton.textContent = 'Sending…';
    form.setAttribute('aria-busy', 'true');
    submitButton.disabled = true;
    fields.disabled = true;
    status.textContent = 'Sending your signup…';
    try {
      await fetch(config.formAction, { method: 'POST', mode: 'no-cors', body: params });
      form.removeAttribute('aria-busy');
      form.hidden = true;
      status.textContent = "Thanks for your interest! Watch your email for tryout details. Signing up doesn’t guarantee a spot.";
      status.focus();
    } catch {
      submitButton.textContent = 'Email me tryout details';
      form.removeAttribute('aria-busy');
      fields.disabled = false;
      submitButton.disabled = false;
      inFlight = false;
      status.textContent = 'We couldn’t send your signup. Please try again.';
      submitButton.focus();
    }
  }

  form.addEventListener('submit', submit);
  form.addEventListener('input', updateAfterAttempt);
  form.addEventListener('change', updateAfterAttempt);
  addButton.addEventListener('click', addChild);
  refreshChildren();
  submitButton.disabled = false;
})();
