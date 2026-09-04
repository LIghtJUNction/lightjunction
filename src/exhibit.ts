type ExhibitOptions = {
    isExploring: () => boolean;
    onOpen: (id: string) => void;
    onClose: () => void;
};

/** Move the original live sections; never clone forms, IDs, canvases or challenge data. */
export function createExhibit(options: ExhibitOptions) {
    const dialog = document.getElementById('exhibit-dialog')!;
    const content = document.getElementById('exhibit-content')!;
    const title = document.getElementById('exhibit-title')!;
    const closeButton = document.getElementById('exhibit-close')!;
    const main = document.querySelector<HTMLElement>('.story-wall')!;
    const sources = new Map(Array.from(main.querySelectorAll<HTMLElement>(':scope > section[id]')).map(section => [section.id, section]));
    let current: { section: HTMLElement; marker: Comment } | null = null;
    let previousFocus: HTMLElement | null = null;
    let inertElements: HTMLElement[] = [];

    const restoreSection = () => {
        if (!current) return;
        current.marker.replaceWith(current.section);
        current = null;
    };
    const close = (updateHistory = true) => {
        if (!current) return;
        restoreSection();
        dialog.hidden = true;
        for (const element of inertElements) element.inert = false;
        inertElements = [];
        if (updateHistory) history.replaceState(null, '', '#explore');
        options.onClose();
        if (previousFocus?.isConnected && !previousFocus.closest('[hidden]')) previousFocus.focus();
        previousFocus = null;
    };
    const open = (id: string, label?: string, updateHistory = true): boolean => {
        const section = sources.get(id);
        if (!section || !options.isExploring()) return false;
        if (current?.section === section) return true;
        if (!current) {
            previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
            for (const element of [main, document.querySelector<HTMLElement>('.site-header'), document.getElementById('explore')]) {
                if (element && !element.inert) { element.inert = true; inertElements.push(element); }
            }
        }
        restoreSection();
        const marker = document.createComment('exhibit source');
        section.before(marker);
        current = { section, marker };
        content.append(section);
        const heading = section.querySelector('h1, h2');
        title.textContent = label ?? heading?.textContent?.trim() ?? 'Explore';
        dialog.hidden = false;
        content.scrollTop = 0;
        if (updateHistory && location.hash !== `#${id}`) history.pushState(null, '', `#${id}`);
        options.onOpen(id);
        closeButton.focus();
        return true;
    };

    const resolve = (hash: string): string | null => {
        const id = hash.replace(/^#/, '');
        if (id === 'workspace-title') return 'workbench';
        return sources.has(id) ? id : null;
    };
    const fromLocation = () => {
        if (!options.isExploring()) return;
        const id = resolve(location.hash);
        if (id) open(id, undefined, false);
        else close(false);
    };
    closeButton.addEventListener('click', () => close());
    dialog.addEventListener('click', event => { if (event.target === dialog) close(); });
    document.addEventListener('click', event => {
        if (!options.isExploring() || event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return;
        const anchor = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>('a[href^="#"]') : null;
        const id = anchor ? resolve(anchor.getAttribute('href') ?? '') : null;
        if (!id) return;
        event.preventDefault();
        open(id);
        if (anchor?.getAttribute('href') === '#workspace-title') document.getElementById('workspace-title')?.focus();
    });
    document.addEventListener('keydown', event => {
        if (dialog.hidden || event.defaultPrevented) return;
        // The encrypted contact flow owns its own Escape/Tab handling above this panel.
        const secure = document.getElementById('secure-card');
        const result = document.getElementById('result-overlay');
        if ((secure && !secure.hidden) || result?.getAttribute('aria-hidden') === 'false') return;
        if (event.key === 'Escape') { event.preventDefault(); close(); return; }
        if (event.key !== 'Tab') return;
        const focusable = Array.from(dialog.querySelectorAll<HTMLElement>(
            'button:not([disabled]), a[href], input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex="0"]'
        )).filter(element => !element.closest('[hidden]') && element.getClientRects().length > 0);
        const first = focusable[0], last = focusable[focusable.length - 1];
        if (!first || !last) { event.preventDefault(); closeButton.focus(); return; }
        if (event.shiftKey && (document.activeElement === first || !dialog.contains(document.activeElement))) {
            event.preventDefault(); last.focus();
        } else if (!event.shiftKey && (document.activeElement === last || !dialog.contains(document.activeElement))) {
            event.preventDefault(); first.focus();
        }
    });
    window.addEventListener('popstate', fromLocation);
    window.addEventListener('hashchange', fromLocation);
    return { open, close, fromLocation, isOpen: () => !dialog.hidden };
}
