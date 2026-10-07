/** 헤더 높이를 반영해 마커로 부드럽게 스크롤 */
export function scrollToMarker(
  id: string,
  behavior: ScrollBehavior = "smooth"
): boolean {
  const el = document.getElementById(id);
  if (!el) return false;
  const header = document.querySelector(".app-header");
  const headerH = header?.getBoundingClientRect().height ?? 0;
  const top = el.getBoundingClientRect().top + window.scrollY - headerH - 8;
  window.scrollTo({ top: Math.max(0, top), behavior });
  return true;
}
