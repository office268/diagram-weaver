/** Strip scripts, event-handler attributes, and javascript:/data: hrefs from SVG strings. */
export function sanitizeSvg(svg: string): string {
  if (typeof window === "undefined") return svg;

  const doc = new DOMParser().parseFromString(svg, "image/svg+xml");
  const root = doc.documentElement;
  if (!root || root.nodeName === "parsererror") return "";

  const walker = doc.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
  const toRemove: Element[] = [];

  const visit = (el: Element) => {
    const tag = el.tagName.toLowerCase();
    if (tag === "script") {
      toRemove.push(el);
      return;
    }
    for (const attr of Array.from(el.attributes)) {
      const name = attr.name.toLowerCase();
      const value = attr.value;
      if (name.startsWith("on")) {
        el.removeAttribute(attr.name);
        continue;
      }
      if (
        (name === "href" || name === "xlink:href") &&
        /^\s*(javascript|data):/i.test(value)
      ) {
        el.removeAttribute(attr.name);
      }
    }
  };

  visit(root);
  let n: Node | null = walker.nextNode();
  while (n) {
    visit(n as Element);
    n = walker.nextNode();
  }
  for (const el of toRemove) el.remove();

  return new XMLSerializer().serializeToString(root);
}
