/** Progressive enhancements only: the profile and its links work without JS. */
const storageKey = 'lightjunction.profile.language';

export function readLanguage(storage) {
  try { return storage?.getItem(storageKey) === 'zh' ? 'zh' : 'en'; }
  catch { return 'en'; }
}

export function applyLanguage(root, language) {
  const locale = language === 'zh' ? 'zh' : 'en';
  root.documentElement.lang = locale === 'zh' ? 'zh-CN' : 'en';
  for (const element of root.querySelectorAll('[data-en][data-zh]')) {
    // Translations are text, never HTML or a remotely supplied payload.
    element.textContent = element.dataset[locale];
  }
  for (const element of root.querySelectorAll('[data-en-label][data-zh-label]')) {
    element.setAttribute('aria-label', element.dataset[`${locale}Label`]);
  }
  const toggle = root.getElementById('language-toggle');
  toggle.textContent = locale === 'zh' ? 'EN' : '中文';
  toggle.lang = locale === 'zh' ? 'en' : 'zh-CN';
  toggle.setAttribute('aria-label', locale === 'zh' ? 'Switch to English' : '切换到中文');
  return locale;
}

export async function copyEmail(clipboard, email) {
  if (!clipboard?.writeText) return false;
  try { await clipboard.writeText(email); return true; }
  catch { return false; }
}

export function initProfile(root, browser) {
  let storage;
  try { storage = browser.localStorage; } catch { /* Browsing still works with storage blocked. */ }
  let language = applyLanguage(root, readLanguage(storage));
  let feedbackTimer;
  let feedbackVersion = 0;
  const toggle = root.getElementById('language-toggle');
  const copy = root.getElementById('copy-email');
  const status = root.getElementById('copy-status');
  const menu = root.getElementById('elsewhere');
  const email = root.querySelector('.email').textContent.trim();
  const icon = copy.querySelector('use');

  function clearFeedback() {
    feedbackVersion += 1;
    browser.clearTimeout(feedbackTimer);
    status.textContent = '';
    icon.setAttribute('href', '#i-copy');
    copy.disabled = false;
  }

  toggle.hidden = false;
  copy.hidden = false;
  toggle.addEventListener('click', () => {
    clearFeedback();
    language = applyLanguage(root, language === 'en' ? 'zh' : 'en');
    try { storage?.setItem(storageKey, language); } catch { /* Preference persistence is optional. */ }
  });

  copy.addEventListener('click', async () => {
    clearFeedback();
    const version = feedbackVersion;
    copy.disabled = true;
    const copied = await copyEmail(browser.navigator.clipboard, email);
    if (version !== feedbackVersion) return;
    copy.disabled = false;
    icon.setAttribute('href', copied ? '#i-check' : '#i-copy');
    status.textContent = copied
      ? (language === 'zh' ? '邮箱已复制。' : 'Email copied.')
      : (language === 'zh' ? '无法自动复制，请选中邮箱手动复制。' : 'Could not copy. Please select the email address and copy it manually.');
    feedbackTimer = browser.setTimeout(clearFeedback, copied ? 2400 : 6500);
  });

  root.addEventListener('click', event => {
    if (menu.open && !menu.contains(event.target)) menu.open = false;
  });
  root.addEventListener('keydown', event => {
    if (event.key === 'Escape' && menu.open) {
      menu.open = false;
      menu.querySelector('summary').focus();
    }
  });
  browser.addEventListener('pagehide', clearFeedback);
}

if (typeof document !== 'undefined') initProfile(document, window);
