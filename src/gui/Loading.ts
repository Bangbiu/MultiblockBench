

type ProgressRange = {
    start: number,
    length: number
};

type ProgressInfo = {
    progess: number,
    text: string
}

//type Loadable = (...args: [...any, SubTaskHandler]) => any;
type TaskCaller = (handler: SubTaskHandler) => void


interface Progressable {
    onStart?: AnyAction;
    onProgress: AnyAction;
    onLoad: () => void;
}

class SubTaskHandler implements Progressable {
    // Event Name
    public readonly name: string;
    // Job
    public readonly caller: TaskCaller
    // Starting Point, Lengh
    public range: ProgressRange;
    // Local Range from 0.0 to 1.0
    public localProg: number;
    // SubTask
    public subHandlers: Array<SubTaskHandler>;
    public lastSub: SubTaskHandler;
    private _workResolver!: AnyAction;

    constructor(name: string, caller: TaskCaller = WORK_SUB, range: ProgressRange = FULL_RANGE) {
        this.localProg = 0.0;
        this.subHandlers = Array();
        this.lastSub = this;
        this.name = name;
        this.caller = caller;
        this.range = range;
        // Bind Method to Self
        this.onStart = this.onStart.bind(this);
        this.onProgress = this.onProgress.bind(this);
        this.onLoad = this.onLoad.bind(this);
    }

    public async work() {
        this.caller(this);
        await new Promise<void>((resolve) => {
             this._workResolver = resolve;
        });
        this.finalize();
    }

    public setRange(start: number, length: number): this {
        this.range = {
            start: start,
            length: length
        };
        return this;
    }

    public onStart(info: ProgressInfo): void {
        this.onChange(info);
    }

    public onProgress(info: ProgressInfo): void {
        this.onChange(info);
    }

    public onLoad(): void {
        this._workResolver?.call(this);  
    }

    public finalize(): void {

    }

    public onChange(info: ProgressInfo): void {
        this.localProg = info.progess;
        console.log(this.name + ": " + info.text);
        window.app.loadingUI.onProgress({
            progess: this.getGlobalProgress(),
            text: this.name + ":" + info.text
        })
    }

    public getGlobalProgress(): number {
        return this.range.start + this.range.length * this.localProg;
    }

    public then(name: string, caller: TaskCaller): this {
        const handler = new SubTaskHandler(name, caller);
        this.subHandlers.push(handler);
        const taskCount = this.subHandlers.length;
        const taskLen = 1.0 / taskCount;
        this.subHandlers.forEach((handler, ind) => {
            handler.setRange(ind / taskCount, taskLen);
        });
        if (this.lastSub != this) {
            this.lastSub.onLoad = () => {
                if (handler.name) handler.onStart({ progess: 0, text: ""});
                handler.work();
            };
        }
        this.lastSub = handler;
        return this;
    }

    public finally(name: string, caller: TaskCaller): this {
        this.then(name, caller);
        this.lastSub!.onLoad = this.onLoad;
        return this;
    }

    public terminate() {
        return this.finally("Finished", handler => handler.onLoad());
    }

    public clear(): void {
        this.subHandlers.length = 0;
    }
}

class LoadingUI {
    
    public readonly loadingOverlay: HTMLElement;
    public readonly progressBar: HTMLDivElement;
    public readonly progressLabel: HTMLElement;

    public loadingText: string;

    constructor() {
        this.loadingOverlay = document.getElementById('loadingOverlay')!;
        this.progressBar = document.getElementById('progressBar') as HTMLDivElement;
        this.progressLabel = document.getElementById('progressLabel')!;
        this.onStart = this.onStart.bind(this);
        this.onProgress = this.onProgress.bind(this);
        this.onLoad = this.onLoad.bind(this);
        this.loadingText = "Loading"
    }

    public show(text: string): void {
        this.loadingText = text;
        this.progressLabel.textContent = text;
    }
    
    public onStart(): void {
        this.loadingOverlay.classList.remove('fade-out');
        this.loadingOverlay.style.display = 'flex';
        this.progressBar.style.width = '0%';
        this.show("Loading 0%");
    }

    public onProgress(info: ProgressInfo): void {
        const percent = Math.floor(info.progess * 100);
        this.progressBar.style.width = `${percent}%`;
        this.show(`${info.text}... ${percent}%`);
    }

    public onLoad(): void {
        this.progressBar.style.width = `${100}%`;
        this.progressLabel.textContent = `Finished`;
        this.loadingOverlay.classList.add('fade-out');
        setTimeout(() => {
            this.loadingOverlay.style.display = 'none'; // fully remove from view
        }, 500);
    };

    public startProcess(name: string): SubTaskHandler {
        const process = new SubTaskHandler(name);
        process.finalize = this.onLoad;
        return process;
    }

}

//const DO_NOTHING: AnyAction = function(){};
const WORK_SUB: TaskCaller = (handler) => handler.subHandlers[0].work();
const FULL_RANGE: ProgressRange = {
    start: 0.0,
    length: 1.0
}

export type {
    Progressable,
    SubTaskHandler
}

export {
    LoadingUI
}