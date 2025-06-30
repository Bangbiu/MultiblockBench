import { FileUtil } from "../util/FileUtil";

type AnyArgs = any[]
type AnyAction = (...args: AnyArgs) => void;
type UIChanger = (...info: LoadingInfo) => void;

type ProgressRange = [number, number];
type LoadingInfo = [number, string];
type ProgressIntepretor = (...args: AnyArgs) => LoadingInfo;
type PassThroughIntepretor = (prog: number, content: string) => LoadingInfo;
type ObjProgIntepretor = (url: string, loaded: number, total: number) => LoadingInfo;
type Loadable<I extends ProgressIntepretor> = (...args: [...any, SubEventHandler<I>]) => any;

type HandlerCreator = <I extends ProgressIntepretor>(intepretor: I) => SubEventHandler<I>;
type HandledJob<I extends ProgressIntepretor = ProgressIntepretor> = (handler: SubEventHandler<I>) => void;
type HandledTask<I extends ProgressIntepretor = ProgressIntepretor> = {
    job: HandledJob<I>,
    handler: SubEventHandler<I>
}

interface Progressable {
    onStart?: AnyAction;
    onProgress: AnyAction;
    onLoad: () => void;
}

class SubEventHandler<I extends ProgressIntepretor = PassThroughIntepretor> implements Progressable {
    // Event Name
    public name?: string;
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

    public onLoad(): void {

    }

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

    // Tasks
    private readonly tasks: TaskSequence;

    public loadingText: string;

    constructor() {
        super(DO_NOTHING, Intepretors.PassThrough);
        this.onUIChange = this.onProgress;
        this.createHandler = this.createHandler.bind(this);

        this.loadingOverlay = document.getElementById('loadingOverlay')!;
        this.progressBar = document.getElementById('progressBar') as HTMLDivElement;
        this.progressLabel = document.getElementById('progressLabel')!;

        this.tasks = new TaskSequence(this.createHandler, this.onLoad);
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

    public onProgress(progress: number, loadingContent: string): void {
        const percent = Math.floor(progress * 100);
        this.progressBar.style.width = `${percent}%`;
        this.show(`${loadingContent}... ${percent}%`);
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
        const processFn = intepretor ?? Intepretors.PassThrough;
        return new SubEventHandler<I>(this.onProgress, processFn as I);
    }

    public startProcess(): TaskSequence {
        this.tasks.clear();
        return this.tasks;
    }


}

class TaskSequence {
    public readonly handledTasks: Array<HandledTask<ProgressIntepretor>>;
    private readonly creator: HandlerCreator;
    private readonly finalizer: AnyAction;

    private lastTask?: HandledTask<ProgressIntepretor>;

    constructor(handlerCreator: HandlerCreator, finalizer: AnyAction = DO_NOTHING) {
        this.creator = handlerCreator;
        this.finalizer = finalizer;
        this.handledTasks = new Array();
    }

    public then<I extends ProgressIntepretor>(name: string, job: HandledJob<I>, intepretor?: I): this {
        const handler = this.creator(intepretor ?? Intepretors.PassThrough);
        const curTask = { job: job as HandledJob, handler: handler };
        this.handledTasks.push(curTask);
        
        const taskCount = this.handledTasks.length;
        const taskLen = 1.0 / taskCount;
        this.handledTasks.forEach((task, ind) => {
            task.handler.setRange(ind / taskCount, taskLen);
        });
        if (this.lastTask) {
            this.lastTask.handler.onLoad = () => {
                if (name) curTask.handler.onStart(0, name);
                curTask.job(curTask.handler);
            };
        }
        this.lastTask = curTask;
        return this;
    }

    public finally<I extends ProgressIntepretor>(name: string, job: HandledJob<I>, intepretor?: I): this {
        this.then(name, job, intepretor);
        this.lastTask!.handler.onLoad = this.finalizer;
        return this;
    }

    public work(): void {
        if (this.handledTasks.length > 0) {
            this.handledTasks[0].job(this.handledTasks[0].handler);
        }
    }

    public clear(): void {
        this.handledTasks.length = 0;
    }

    public static readonly TIME_PADDING: number = 200;
}

const DO_NOTHING = function(){};

const Intepretors: {
    PassThrough: PassThroughIntepretor;
    ObjProg: ObjProgIntepretor;
} = {
    PassThrough: (progress: number, content: string) => [ progress, content ],
    ObjProg: (url: string, loaded: number, total: number) => 
        [ loaded / total, "Loading " + FileUtil.getFileName(url) ],
} as const;

export type {
    ObjProgIntepretor,
    Progressable,
    Loadable,
    SubEventHandler
}

export {
    LoadingUI,
    Intepretors,
    TaskSequence
}