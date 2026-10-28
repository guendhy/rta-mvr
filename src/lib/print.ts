export type PrintPage = "58mm" | "A4" | "label" | "A4-landscape";

const PAGE_CSS: Record<PrintPage, string> = {
  "58mm": "@page { size: 58mm auto; margin: 0; }",
  A4: "@page { size: A4 portrait; margin: 0; }",
  "A4-landscape": "@page { size: A4 landscape; margin: 10mm; }",
  label: "@page { size: 100mm 70mm; margin: 0; }",
};

/**
 * Prints a single element with the browser print dialog. The element is cloned into a
 * dedicated #print-root so sidebars, headers, modals and preview scaling never leak into
 * the printout (see the print rules in globals.css).
 */
export function printElement(elementId: string, page: PrintPage): Promise<void> {
  return new Promise((resolve, reject) => {
    const el = document.getElementById(elementId);
    if (!el) {
      reject(new Error("Nothing to print."));
      return;
    }
    let root = document.getElementById("print-root");
    if (!root) {
      root = document.createElement("div");
      root.id = "print-root";
      document.body.appendChild(root);
    }
    const clone = el.cloneNode(true) as HTMLElement;
    clone.removeAttribute("id");
    clone.style.transform = "none";
    clone.style.boxShadow = "none";
    root.replaceChildren(clone);

    const style = document.createElement("style");
    style.setAttribute("data-print-page", page);
    style.textContent = PAGE_CSS[page];
    document.head.appendChild(style);
    document.body.classList.add("printing");

    let done = false;
    const cleanup = () => {
      if (done) return;
      done = true;
      document.body.classList.remove("printing");
      root?.replaceChildren();
      style.remove();
      window.removeEventListener("afterprint", cleanup);
      resolve();
    };
    window.addEventListener("afterprint", cleanup);
    // Let images in the clone decode before the dialog opens.
    setTimeout(() => {
      window.print();
      setTimeout(cleanup, 1000);
    }, 150);
  });
}
