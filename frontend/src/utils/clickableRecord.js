// Preserve native actions inside a clickable record (including disabled controls).
export function clickableRecordProps(open, label) {
  return {
    tabIndex: 0,
    'aria-label': label,
    onClick(event) {
      if (event.target.closest('button, a, input, select, textarea, label, [role="button"]')) return;
      const selection = window.getSelection?.();
      if (selection && !selection.isCollapsed) return;
      open();
    },
    onKeyDown(event) {
      if (event.target !== event.currentTarget || !['Enter', ' '].includes(event.key)) return;
      event.preventDefault();
      open();
    },
  };
}
