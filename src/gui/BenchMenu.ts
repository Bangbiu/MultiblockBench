import { BenchObject } from "../util/DataUtil";

type CheckBoxCallBack = (status: boolean) => void;
const DO_NOTHING = () => {};

class DivWrapper<TSelf extends DivWrapper<TSelf> = DivWrapper<any>> extends BenchObject<TSelf> {
    public readonly div: HTMLDivElement;
    constructor(className?: string) {
        super();
        this.div = create("div", className);
    }
    public get className() { return this.div.className; }
    public set className(name: string) { this.div.className = name; }

    public createChild<K extends keyof HTMLElementTagNameMap>(tagName: K, className?: string): HTMLElementTagNameMap[K] {
        const child = create(tagName, className);
        this.div.appendChild(child);
        return child;
    }
}

class ContextMenuOption<TSelf extends ContextMenuOption<TSelf> = ContextMenuOption<any>> extends DivWrapper<TSelf> {
    public readonly parent?: ContextMenu;
    protected readonly caption: HTMLSpanElement;
    protected readonly box: HTMLSpanElement;
    private _action: AnyAction = DO_NOTHING;
    private _hideParentOnAct: boolean = false;
    constructor( parameters: Partial<TSelf> = {} ) {
        super("contextMenuOption");
        // Create and append caption element
        this.caption = this.createChild("span", "contextMenuCaption");
        // Right Aligned PlaceHolder
        this.box = this.createChild("span", "optionBox");
        // Initialize
        this.hideParent = this.hideParent.bind(this);
        this.hideParentOnAct = parameters.hideParentOnAct ?? true;
        this.updateValues(parameters);
    }

    public get action() { return this._action; }
    public set action(callback: AnyAction) {
        if (this._action !== DO_NOTHING)
            this.div.removeEventListener("click", this._action);
        if (callback !== DO_NOTHING) {
            this.div.addEventListener("click", callback);
        }
            
        this._action = callback
    }

    public get label() { return this.caption.textContent ?? ""; }
    public set label(text: string) { this.caption.textContent = text; }

    public get hideParentOnAct() { return this._hideParentOnAct; }
    public set hideParentOnAct(value: boolean) { 
        if (value === this._hideParentOnAct) return;
        if (value)
            this.addEventListener("click", this.hideParent)
        else
            this.removeEventListener("click", this.hideParent);
        this._hideParentOnAct = value;
    }

    public addEventListener<K extends keyof HTMLElementEventMap>(type: K, listener: (this: HTMLDivElement, ev: HTMLElementEventMap[K]) => any, options?: boolean | AddEventListenerOptions) {
        this.div.addEventListener(type, listener, options);
    }

    public removeEventListener<K extends keyof HTMLElementEventMap>(type: K, listener: (this: HTMLDivElement, ev: HTMLElementEventMap[K]) => any, options?: boolean | EventListenerOptions): void {
        this.div.removeEventListener(type, listener, options);
    }

    public hideParent() {
        let superMenu = this.parent;
        while (superMenu?.parent) superMenu = superMenu.parent;
        superMenu?.hide();
    }
};

class CheckBoxOption<TSelf extends CheckBoxOption<TSelf> = CheckBoxOption<any>> extends ContextMenuOption<TSelf> {
    protected readonly innerBox: HTMLSpanElement;
    private _checked: boolean = false;

    constructor( parameters: Partial<TSelf> = {} ) {
        super();
        this.hideParentOnAct = false;
        this.box.classList.add("checkbox");
        this.innerBox = create("span", "checkboxInnerBox");
        this.box.appendChild(this.innerBox);
        this.toggle = this.toggle.bind(this);
        this.addEventListener("click", this.toggle);
        this.checked = false;
        this.updateValues(parameters);
    }

    public get setter() { return super.action; }
    public set setter(callback: CheckBoxCallBack) {
        super.action = () => callback(this._checked);
    }

    public get checked(): boolean {
        return this._checked;
    }

    public set checked(value: boolean) {
        this._checked = value;
        this.innerBox.style.background = value ? "#ccc" : "transparent";
    }

    public toggle(): this {
        this.checked = !this.checked;
        return this;
    }
}

class RadioButtonOption extends CheckBoxOption<RadioButtonOption> {
    constructor(parameters: Partial<RadioButtonOption> = {}) {
        super();
        this.box.classList.add("radio");
        this.innerBox.classList.add("radio");
        this.updateValues(parameters);
    }

    public set checked(value: boolean) {
        if (value) this.parent?.uncheckRadios();
        super.checked = value;
    }
}

class BenchSlider extends ContextMenuOption<BenchSlider> {
    private readonly input: HTMLInputElement;
    private readonly valueLabel: HTMLSpanElement;

    private _min: number = 0;
    private _max: number = 100;
    private _step: number = 1;
    private _value: number = 0;

    constructor(parameters: Partial<BenchSlider> = {}) {
        super();

        this.hideParentOnAct = false;

        this.box.style.visibility = "visible";
        this.box.style.width = "150px";
        this.box.style.display = "flex";
        this.box.style.alignItems = "center";

        // Range input
        this.input = document.createElement("input");
        this.input.type = "range";
        this.input.min = this._min.toString();
        this.input.max = this._max.toString();
        this.input.step = this._step.toString();
        this.input.value = this._value.toString();
        this.input.style.flex = "1";

        // Value label
        this.valueLabel = document.createElement("span");
        this.valueLabel.style.marginLeft = "8px";
        this.valueLabel.textContent = this._value.toString();

        this.box.appendChild(this.input);
        this.box.appendChild(this.valueLabel);

        this.input.addEventListener("input", () => {
            this._value = parseFloat(this.input.value);
            this.valueLabel.textContent = this._value.toString();
            //this._action();
        });

        this.updateValues(parameters);
    }

    public get min() { return this._min; }
    public set min(value: number) {
        this._min = value;
        this.input.min = value.toString();
    }

    public get max() { return this._max; }
    public set max(value: number) {
        this._max = value;
        this.input.max = value.toString();
    }

    public get step() { return this._step; }
    public set step(value: number) {
        this._step = value;
        this.input.step = value.toString();
    }

    public get value() { return this._value; }
    public set value(val: number) {
        this._value = val;
        this.input.value = val.toString();
        this.valueLabel.textContent = val.toString();
    }

    public override set action(callback: (val: number) => void) {
        super.action = () => callback(this._value);
    }
}

class SubMenuOption extends ContextMenuOption<SubMenuOption> {
    private subMenu?: ContextMenu;

    constructor( parameters: Partial<SubMenuOption> = {} ) {
        super();
        this.action = this.showSubMenu.bind(this);
        this.hideParentOnAct = false;
        this.box.classList.add("submenu");
        this.box.textContent = "▶";

        this.updateValues(parameters);
        this.showSubMenu = this.showSubMenu.bind(this);
        this.scheduleHideSubMenu = this.scheduleHideSubMenu.bind(this);
        this.addEventListener("mouseenter", this.showSubMenu);
        // Schedule hide on leave
        this.addEventListener("mouseleave", this.scheduleHideSubMenu);
    }

    public get menu(): Opt<MenuDeclaration> {
        return this.subMenu?.declaration;
    }

    public set menu(declare: MenuDeclaration) {
        if (this.subMenu) this.subMenu.detach();
        this.subMenu = new ContextMenu(declare).attach();
        this.subMenu.parent = this.parent;
        this.subMenu.hideOnLeave = true;
    }

    public showSubMenu() {
        const rect = this.div.getBoundingClientRect();
        this.subMenu?.show().moveTo(rect.right, rect.top - this.subMenu.topItemY);
        this.subMenu?.cancelHide();
    }

    public hideSubMenu() { this.subMenu?.hide(); }
    public scheduleHideSubMenu() { this.subMenu?.scheduleHide(); }
}

type MenuOptType = {
    option: typeof ContextMenuOption,
    subMenu: typeof SubMenuOption,
    checkBox: typeof CheckBoxOption,
    radio: typeof RadioButtonOption,
    slider: typeof BenchSlider
};

const MenuOptCtor: MenuOptType = {
    option: ContextMenuOption,
    subMenu: SubMenuOption,
    checkBox: CheckBoxOption,
    radio: RadioButtonOption,
    slider: BenchSlider
};

type MenuOptTypeKey = keyof MenuOptType;
type MenuOptParameters<K extends MenuOptTypeKey> = Partial<InstanceType<MenuOptType[K]>>
type MenuOptAllParameters = Partial<UnionToIntersection<Union<{
    [K in keyof MenuOptType]: InstanceType<MenuOptType[K]>;
}>>>;

type MenuOptDeclaration = {
    [K in MenuOptTypeKey]: {
        type: K;
    } & MenuOptParameters<K>
}[keyof MenuOptType];

type MenuOptData = MenuOptDeclaration | MenuOptTypeKey | AnyAction;
type MenuDeclaration = Record<string, MenuOptData>;

class ContextMenu extends DivWrapper {
    public readonly declaration: MenuDeclaration;
    public readonly options: Array<ContextMenuOption>;
    public parent?: ContextMenu;
    private _hideTimer?: number;
    private _hideOnLeave: boolean = false;
    constructor( declare: MenuDeclaration = {} ) {
        super()
        this.className = "contextMenu";
        this.scheduleHide = this.scheduleHide.bind(this);
        this.declaration = declare;
        this.options = Array<ContextMenuOption>();
        for (const [label, data] of Object.entries(declare)) {
            this.add(label, data);
        }

        this.addEventListener("mouseenter", this.cancelHide.bind(this));
        this.addEventListener("contextmenu", (event) => event.preventDefault());
    }

    public get topItemY() {
        if (!this.options[0]) return 0;
        const childRect = this.options[0].div.getBoundingClientRect();
        const parentRect = this.div.getBoundingClientRect();
        return childRect.top - parentRect.top;
    }

    public get hideOnLeave() { return this._hideOnLeave; }
    public set hideOnLeave(value: boolean) {
        if (value === this._hideOnLeave) return;
        if (value) this.addEventListener("mouseleave", this.scheduleHide);
        else this.removeEventListener("mouseleave", this.scheduleHide);
        this._hideOnLeave = value;
    }

    public get zIndex() { return parseInt(this.div.style.zIndex); }
    public set zIndex(value: number) { this.div.style.zIndex = value.toString(); }
    public get parentZ() { return this.parent ? this.parent.zIndex : 1000; }

    public attach() { document.body.appendChild(this.div); return this; }
    public detach() { document.body.removeChild(this.div); return this; }

    public add(label: string, data: MenuOptData): Opt<ContextMenuOption> {
        let option: Opt<ContextMenuOption> = undefined;
        const args: MenuOptAllParameters = { parent: this, label: label };
        if (typeof data == "string") 
            // Type String Only
            option = new (MenuOptCtor[data] as Constructor<ContextMenuOption>)(args);
        else if (typeof data === "function") {
            // Action Only
            args.action = data;
            if (data.length === 0)
                option = new ContextMenuOption(args);
            else
                option = new CheckBoxOption(args);
        }
        else if (typeof data === "object") {
            // Declaration
            Object.assign(args, data);
            const ctor = MenuOptCtor[data.type] as Constructor<ContextMenuOption>;
            option = new ctor(args);
        }
        if (option) this.append(option as ContextMenuOption);
        return option;
    }

    public append(option: ContextMenuOption) {
        this.options.push(option);
        this.div.appendChild(option.div); 
    }

    public show() { 
        this.div.style.display = 'block'; 
        this.zIndex = this.parentZ + 1;
        return this; 
    }
    public hide() { 
        this.div.style.display = 'none'; 
        for (const opt of this.options) {
            if (opt instanceof SubMenuOption) {
                opt.hideSubMenu();
            }
        }
        return this; 
    }
    
    public moveTo(x: number, y: number) {
        this.div.style.left = `${x}px`;
        this.div.style.top = `${y}px`;
        return this;
    }

    public addEventListener<K extends keyof HTMLElementEventMap>(type: K, listener: (this: HTMLDivElement, ev: HTMLElementEventMap[K]) => any, options?: boolean | AddEventListenerOptions) {
        this.div.addEventListener(type, listener, options);
    }

    public removeEventListener<K extends keyof HTMLElementEventMap>(type: K, listener: (this: HTMLDivElement, ev: HTMLElementEventMap[K]) => any, options?: boolean | EventListenerOptions): void {
        this.div.removeEventListener(type, listener, options);
    }

    public uncheckRadios() {
        this.options.forEach(option => {
            if (option instanceof RadioButtonOption) option.checked = false;
        });
    }

    public scheduleHide() {
        this._hideTimer = window.setTimeout(() => this.hide(), 50);
    }

    public cancelHide() {
        if (this._hideTimer) {
            clearTimeout(this._hideTimer);
            this._hideTimer = undefined;
        }
        this.parent?.cancelHide();
    }
}

function create<K extends keyof HTMLElementTagNameMap>(tagName: K, className?: string): HTMLElementTagNameMap[K] {
    const element = document.createElement(tagName);
    if (className) element.className = className;
    return element;
}

export type {
    MenuDeclaration
}

export {
    ContextMenu
}