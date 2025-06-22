import { FileUtil } from "../util/FileUtil";

type AnyArgs = any[]
type AnyAction = (...args: AnyArgs) => void;

type ProgressRange = [number, number];
type LoadingInfo = [number, string];
type ProgressIntepretor = (...args: AnyArgs) => LoadingInfo;
type PassThroughIntepretor = (prog: number, content: string) => LoadingInfo;
type ObjProgIntepretor = (url: string, loaded: number, total: number) => LoadingInfo;
type UIChanger = (...info: LoadingInfo) => void;

interface Progressable {
    onStart?: AnyAction;
    onProgress: AnyAction;
    onLoad: () => void;
}

class SubEventHandler<I extends ProgressIntepretor = ProgressIntepretor> implements Progressable {
    // Starting Point, Lengh
    public range: [number, number];
    // Local Range from 0.0 to 1.0
    public localProg: number;
    // Translate Data From Event
    public intepretor: I;
    // Link to UI
    public onUIChange: UIChanger;
    
    constructor(changer: UIChanger, intepretor: I, range: ProgressRange = [0.0, 1.0]) {
        this.localProg = 0.0;
        this.onUIChange = changer;
        this.intepretor = intepretor;
        this.range = range;
        // Bind Method to Self
        this.onStart = this.onStart.bind(this);
        this.onProgress = this.onProgress.bind(this);
        this.onLoad = this.onLoad.bind(this);
    }

    public setRange(starting: number, range: number): this {
        this.range = [starting, range];
        return this;
    }

    public onStart(...args: Parameters<I>): void {
        this.onChange(...args);
    }

    public onProgress(...args: Parameters<I>): void {
        this.onChange(...args);
    }

    public onLoad(): void {}

    public onChange(...args: Parameters<I>): void {
        const info = this.intepretor(...args);
        this.localProg = info[0];
        console.log(info[1]);
        
        this.onUIChange(this.getGlobalProgress(), info[1]);
    }

    public getGlobalProgress(): number {
        return this.range[0] + this.range[1] * this.localProg;
    }

    public handle(progressable: Progressable) {
        SubEventHandler.assign(this, progressable);
    }

    public static assign(handler: SubEventHandler, target: Progressable) {
        target.onStart = handler.onStart;
        target.onProgress = handler.onProgress;
        target.onLoad = handler.onLoad;
    }
}

class LoadingUI extends SubEventHandler<PassThroughIntepretor> {
    
    public readonly loadingOverlay: HTMLElement;
    public readonly progressBar: HTMLDivElement;
    public readonly progressLabel: HTMLElement;

    // Handler Sequence
    public handlers: Array<SubEventHandler>;
    public loadingText: string;

    constructor() {
        super(DO_NOTHING, LoadingUI.passThrough);
        this.onUIChange = this.onProgress;
        this.loadingOverlay = document.getElementById('loadingOverlay')!;
        this.progressBar = document.getElementById('progressBar') as HTMLDivElement;
        this.progressLabel = document.getElementById('progressLabel')!;

        this.handlers = new Array<SubEventHandler>();
        this.loadingText = "Loading"
    }
    
    public onStart(): void {
        this.loadingOverlay.classList.remove('fade-out');
        this.loadingOverlay.style.display = 'flex';
        this.progressBar.style.width = '0%';
        this.progressLabel.textContent = 'Loading 0%';
    }

    public onProgress(progress: number, loadingContent: string): void {
        const percent = Math.floor(progress * 100);
        this.progressBar.style.width = `${percent}%`;
        this.progressLabel.textContent = `Loading ${loadingContent}... ${percent}%`;
    }

    public onLoad(): void {
        this.progressBar.style.width = `${100}%`;
        this.progressLabel.textContent = `Finished`;
        this.loadingOverlay.classList.add('fade-out');
        setTimeout(() => {
            this.loadingOverlay.style.display = 'none'; // fully remove from view
        }, 500);
    };

    public createHandler<I extends ProgressIntepretor>(intepretor?: I): SubEventHandler<I> {
        const processFn = intepretor ?? LoadingUI.passThrough;
        return new SubEventHandler<I>(this.onProgress, processFn as I);
    }

    public pushSubHandler<I extends ProgressIntepretor>(intepretor?: I, final: boolean = false): SubEventHandler<I> {
        const handler = this.createHandler(intepretor);
        if (final) handler.onLoad = this.onLoad;
        // Arrenge Jobs
        this.handlers.push(handler);
        const handlerCount = this.handlers.length;
        const handlerLen = 1.0 / handlerCount;
        this.handlers.forEach((handler, ind) => {
            handler.setRange(ind / handlerCount, handlerLen);
        });
        return handler;
    }

    public clearEvents(): void {
        this.handlers.length = 0;
    }

    // Customized Progress
    public pushObjLoadingHandler(): SubEventHandler<ObjProgIntepretor> {
        const intepretor: ObjProgIntepretor = 
            (url: string, loaded: number, total: number) => [ loaded / total, FileUtil.getFileName(url) ];
        return this.pushSubHandler(intepretor);
    }

    public static passThrough(progress: number, content: string): LoadingInfo {
        return [progress, content];
    }
}

const DO_NOTHING = function(){};

export type {
    Progressable,
    SubEventHandler,
    PassThroughIntepretor
}

export {
    LoadingUI
}