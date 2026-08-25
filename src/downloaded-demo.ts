// pi-lens-ignore: knip:file
type DemoId = "3";

type DemoElements = {
    frame: HTMLIFrameElement;
    status: HTMLElement;
    fallback: HTMLElement;
    reloadButton: HTMLButtonElement | null;
};

function findDemoElements(card: HTMLElement): DemoElements | null {
    const frame = card.querySelector<HTMLIFrameElement>("[data-shader-demo-frame]");
    const status = card.querySelector<HTMLElement>("[data-demo-status]");
    const fallback = card.querySelector<HTMLElement>("[data-demo-fallback]");
    if (!frame || !status || !fallback) return null;
    return {
        frame,
        status,
        fallback,
        reloadButton: card.querySelector<HTMLButtonElement>("[data-demo-reload]"),
    };
}

function isDemoId(value: string | undefined): value is DemoId {
    return value === "3";
}

function fetchDemoSource(): Promise<Response> {
    const options: RequestInit = { credentials: "same-origin" };
    return fetch("./shader-demos/3.html.txt", options);
}

// pi-lens-ignore: large-class
export class DownloadedDemoController {
    private readonly frame: HTMLIFrameElement;
    private readonly status: HTMLElement;
    private readonly fallback: HTMLElement;
    private readonly label: string;
    private sourcePromise: Promise<string> | null = null;
    private objectUrl: string | null = null;
    private visible = false;
    private generation = 0;

    constructor(card: HTMLElement) {
        const elements = findDemoElements(card);
        const demoId = card.dataset.demoId;
        if (!elements || !isDemoId(demoId)) {
            throw new Error("Downloaded demo card is missing required elements.");
        }

        this.frame = elements.frame;
        this.status = elements.status;
        this.fallback = elements.fallback;
        this.label = card.dataset.demoLabel || "downloaded HTML";
        elements.reloadButton?.addEventListener("click", () => this.reload());
    }

    updateVisibility(visible: boolean): void {
        this.visible = visible;
        if (visible) {
            void this.mount();
        } else {
            this.unmount();
            this.status.textContent = `Paused off-screen · ${this.label}`;
        }
    }

    reload(): void {
        this.generation += 1;
        this.unmount();
        if (this.visible) void this.mount();
    }

    private async loadSource(): Promise<string> {
        if (!this.sourcePromise) {
            this.sourcePromise = fetchDemoSource().then((response) => {
                if (!response.ok) {
                    throw new Error(`Demo source returned ${response.status}.`);
                }
                return response.text();
            });
        }
        return this.sourcePromise;
    }

    private async mount(): Promise<void> {
        const requestedGeneration = this.generation;
        this.status.textContent = `Loading exact ${this.label} source…`;
        this.fallback.hidden = true;

        try {
            const source = await this.loadSource();
            if (!this.visible || requestedGeneration !== this.generation) return;

            this.releaseObjectUrl();
            this.objectUrl = URL.createObjectURL(
                new Blob([source], { type: "text/html;charset=utf-8" }),
            );
            this.frame.src = this.objectUrl;
            this.frame.hidden = false;
            this.status.textContent = `Live · sandboxed ${this.label}`;
        } catch {
            this.frame.hidden = true;
            this.fallback.hidden = false;
            this.fallback.dataset.demoError = "source-load-failed";
            this.status.textContent = `Fallback · ${this.label} unavailable`;
        }
    }

    private unmount(): void {
        this.frame.hidden = true;
        this.frame.src = "about:blank";
        this.releaseObjectUrl();
    }

    private releaseObjectUrl(): void {
        if (!this.objectUrl) return;
        URL.revokeObjectURL(this.objectUrl);
        this.objectUrl = null;
    }
}
