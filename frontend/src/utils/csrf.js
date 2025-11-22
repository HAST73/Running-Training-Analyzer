export function getCSRFToken() {
  const name = 'csrftoken=';
  const decoded = decodeURIComponent(document.cookie || '');
  const parts = decoded.split(';');
  for (let p of parts) {
    const trimmed = p.trim();
    if (trimmed.startsWith(name)) {
      return trimmed.substring(name.length);
    }
  }
  return '';
}
