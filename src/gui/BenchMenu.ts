import { BenchObject } from "../util/DataUtil";

type CheckBoxCallBack = (status: boolean) => void;
const DO_NOTHING = () => {};

interface DivWrapper {
    readonly div: HTMLDivElement;
    setStyle(): this;
}

class ContextMenuOption<TSelf extends ContextMenuOption<TSelf> = ContextMenuOption<any>> extends BenchObject<TSelf> implements DivWrapper {
    public readonly parent?: ContextMenu;
    public readonly div: HTMLDivElement;
    protected readonly caption: HTMLSpanElement;
    protected readonly box: HTMLSpanElement;
    private _action: AnyAction = DO_NOTHING;
    private _hideParentOnAct: boolean = false;
    constructor( parameters: Partial<TSelf> = {} ) {
        super();
        const div = document.createElement("div");
        this.div = div;
        
        // Create and append caption element
        const caption = document.createElement("span");
        caption.style.marginRight = "12px";
        this.caption = caption;
        this.div.appendChild(caption);

        div.style.display = "flex";
        div.style.alignItems = "center";
        div.style.justifyContent = "space-between";
        div.style.padding = '6px 12px';
        div.style.cursor = 'pointer';
        div.style.userSelect = 'none';

        div.addEventListener('mouseenter', () => {
            div.style.background = '#444';
        });
        div.addEventListener('mouseleave', () => {
            div.style.background = 'transparent';
        });

        // Right PlaceHolder
        this.box = document.createElement("span");
        this.div.appendChild(this.box);
        const boxStyle = this.box.style;
        boxStyle.display = "inline-block";
        boxStyle.marginLeft = "auto";
        boxStyle.width = "20px";
        boxStyle.height = "20px";
        boxStyle.boxSizing = "border-box";
        boxStyle.position = "relative"; // to position inner box absolutely
        boxStyle.userSelect = "none";
        boxStyle.visibility = "hidden";

        // Initialize
        this.hideParent = this.hideParent.bind(this);
        this.hideParentOnAct = parameters.hideParentOnAct ?? true;
        this.updateValues(parameters);
    }

    setStyle(): this {
        return this;
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

class CheckBoxOption extends ContextMenuOption<CheckBoxOption> {
    private readonly innerBox: HTMLSpanElement;
    private _checked: boolean = false;

    constructor( parameters: Partial<CheckBoxOption> = {} ) {
        super({ hideParentOnAct: false });
        this.innerBox = document.createElement("span");
        this.setStyle();
        this.addEventListener("click", () => {
            this.checked = !this.checked;
        });

        this.checked = false;
        this.updateValues(parameters);
    }

    public override setStyle(): this {
        // Outer box
        const boxStyle = this.box.style;
        boxStyle.border = "1px solid #ccc";
        boxStyle.visibility = "visible";

        // Inner box (status indicator)
        
        const innerStyle = this.innerBox.style;
        innerStyle.position = "absolute";
        innerStyle.top = "50%";
        innerStyle.left = "50%";
        innerStyle.transform = "translate(-50%, -50%)";
        innerStyle.width = "14px";
        innerStyle.height = "14px";
        innerStyle.background = "transparent";
        this.box.appendChild(this.innerBox);
        return this;
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
}


class SubMenuOption extends ContextMenuOption<SubMenuOption> {
    private subMenu?: ContextMenu;

    constructor( parameters: Partial<SubMenuOption> = {} ) {
        super();
        this.action = this.showSubMenu.bind(this);
        this.hideParentOnAct = false;
        this.setStyle();
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

    public override setStyle(): this {
        // Outer box
        const boxStyle = this.box.style;
        boxStyle.visibility = "visible";
        boxStyle.marginLeft = "auto";
        boxStyle.padding = "0 8px";
        boxStyle.fontSize = "14px";
        boxStyle.color = "#ccc";
        boxStyle.pointerEvents = "none"; // don't block hover
        this.box.textContent = "▶";
        return this;
    }

    public showSubMenu() {
        const rect = this.div.getBoundingClientRect();
        this.subMenu?.show().moveTo(rect.right, rect.top - this.subMenu.topItemY);
        this.subMenu?.cancelHide();
    }

    public hideSubMenu() {
        this.subMenu?.hide();
    }
    
    public scheduleHideSubMenu() {
        this.subMenu?.scheduleHide();
    }
}

type MenuOptType = {
    option: typeof ContextMenuOption,
    subMenu: typeof SubMenuOption,
    checkBox: typeof CheckBoxOption,
};

const MenuOptCtor: MenuOptType = {
    option: ContextMenuOption,
    subMenu: SubMenuOption,
    checkBox: CheckBoxOption,
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

class ContextMenu implements DivWrapper {
    public readonly div: HTMLDivElement;
    public readonly declaration: MenuDeclaration;
    public readonly options: Array<ContextMenuOption>;
    public parent?: ContextMenu;
    private _hideTimer?: number;
    private _hideOnLeave: boolean = false;
    constructor( declare: MenuDeclaration = {} ) {
        this.div = document.createElement('div'); 
        this.setStyle();

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
            option = new MenuOptCtor[data](args);
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

    public setStyle(): this {
        const style = this.div.style;
        style.position = 'absolute';
        style.display = 'none';
        style.background = '#222';
        style.color = 'white';
        style.padding = '5px 0';
        style.borderRadius = '6px';
        style.boxShadow = '0 2px 8px rgba(0,0,0,0.5)';
        style.zIndex = '1000';
        style.fontFamily = 'sans-serif';
        return this;
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


export type {
    MenuDeclaration
}

export {
    ContextMenu
}