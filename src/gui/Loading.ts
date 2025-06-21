import { FileUtil } from "../util/FileUtil";


export class LoadingUI {
    
    public readonly loadingOverlay: HTMLElement;
    public readonly progressBar: HTMLDivElement;
    public readonly progressLabel: HTMLElement;

    public loadingText: string;

    constructor() {
        this.loadingOverlay = document.getElementById('loadingOverlay')!;
        this.progressBar = document.getElementById('progressBar') as HTMLDivElement;
        this.progressLabel = document.getElementById('progressLabel')!;
        // Bind Method to Self
        this.onStart = this.onStart.bind(this);
        this.onProgress = this.onProgress.bind(this);
        this.onLoad = this.onLoad.bind(this);

        this.loadingText = "Loading"
    }

    public onStart(): void {
        this.loadingOverlay.classList.remove('fade-out');
        this.loadingOverlay.style.display = 'flex';
        this.progressBar.style.width = '0%';
        this.progressLabel.textContent = 'Loading 0%';
    }

    public onProgress(url: string, loaded: number, total: number): void {
        const percent = Math.floor((loaded / total) * 100);
        this.progressBar.style.width = `${percent}%`;
        this.progressLabel.textContent = `Loading ${FileUtil.getFileName(url)}... ${percent}%`;
    };

    public onLoad(): void {
        this.loadingOverlay.classList.add('fade-out');
        setTimeout(() => {
            this.loadingOverlay.style.display = 'none'; // fully remove from view
        }, 500);
    };
}