export function mountCasePrompt(root) {
  const copy = root.querySelector('[data-copy-case]');
  const source = root.querySelector('[data-copy-source]');
  const status = root.querySelector('[data-copy-status]');
  if (!navigator.clipboard?.writeText) return;
  copy.hidden = false;
  copy.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(source.textContent);
      status.textContent = '已复制。';
    } catch {
      const range = document.createRange();
      range.selectNodeContents(source);
      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
      status.textContent = '已选中文字，请手动复制。';
    }
  });
}
