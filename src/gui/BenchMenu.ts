import { BenchObject } from "../util/DataUtil";

type CheckBoxCallBack = (status: boolean) => void;
const DO_NOTHING = () => {};

class ContextMenuOption<TSelf extends ContextMenuOption<TSelf> = any> extends BenchObject<TSelf> {
    public readonly div: HTMLDivElement;
    protected readonly caption: HTMLSpanElement;
    protected readonly box: HTMLSpanElement;
    private _action: AnyAction = DO_NOTHING;
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

    public addEventListener<K extends keyof HTMLElementEventMap>(type: K, listener: (this: HTMLDivElement, ev: HTMLElementEventMap[K]) => any, options?: boolean | AddEventListenerOptions) {
        this.div.addEventListener(type, listener, options);
    }
};

class CheckBoxOption extends ContextMenuOption<CheckBoxOption> {
    private readonly innerBox: HTMLSpanElement;
    private _checked: boolean = false;

    constructor( parameters: Partial<CheckBoxOption> = {} ) {
        super();
        // Outer box
        const boxStyle = this.box.style;
        boxStyle.border = "1px solid #ccc";
        boxStyle.visibility = "visible";

        // Inner box (status indicator)
        this.innerBox = document.createElement("span");
        const innerStyle = this.innerBox.style;
        innerStyle.position = "absolute";
        innerStyle.top = "50%";
        innerStyle.left = "50%";
        innerStyle.transform = "translate(-50%, -50%)";
        innerStyle.width = "14px";
        innerStyle.height = "14px";
        innerStyle.background = "transparent";
        this.box.appendChild(this.innerBox);

        this.addEventListener("click", () => {
            this.checked = !this.checked;
        });

        this.checked = false;
        this.updateValues(parameters);
    }

    public get action() { return super.action; }
    public set action(callback: CheckBoxCallBack) {
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
    public readonly subMenu?: ContextMenu;
    constructor( parameters: Partial<SubMenuOption> = {} ) {
        super();
        this.action = this.showSubMenu.bind(this);
        this.updateValues(parameters);
    }

    public showSubMenu() {

    }
    
    public hideSubMenu() {

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
type MenuOptDeclaration = {
    [K in keyof MenuOptType]: {
        type: K;
    } & Partial<InstanceType<MenuOptType[K]>>
}[keyof MenuOptType];

type MenuOptData = MenuOptDeclaration | MenuOptTypeKey | AnyAction

type MenuDeclaration = Record<string, MenuOptData>;

class ContextMenu {
    public readonly element: HTMLDivElement;
    constructor() {
        this.element = document.createElement('div'); 
        const style = this.element.style;
        style.position = 'absolute';
        style.display = 'none';
        style.background = '#222';
        style.color = 'white';
        style.padding = '5px 0';
        style.borderRadius = '6px';
        style.boxShadow = '0 2px 8px rgba(0,0,0,0.5)';
        style.zIndex = '1000';
        style.fontFamily = 'sans-serif';
        document.body.appendChild(this.element);
    }

    public show(x: number, y: number) {
        this.element.style.left = `${x}px`;
        this.element.style.top = `${y}px`;
        this.element.style.display = 'block';
    }

    public hide() {
        this.element.style.display = 'none';
    }
}



class BenchMenu extends ContextMenu {
    public readonly options;

    constructor(declare: MenuDeclaration = {}) {
        super();
        this.options = Array<ContextMenuOption>();
        for (const [label, data] of Object.entries(declare)) {
            const option = this.add(label, data);
            if (option) {
                option.addEventListener('click', () => this.hide());
            }
        }
    }

    public add(label: string, data: MenuOptData): Opt<ContextMenuOption> {
        let option: Opt<ContextMenuOption> = undefined;
        if (typeof data == "string") 
            // Type String Only
            option = new MenuOptCtor[data]({ label: label });
        else if (typeof data === "function")
            // Action Only
            option = new ContextMenuOption({ label: label, action: data });
        else if (typeof data === "object") {
            // Declaration
            const ctor = MenuOptCtor[data.type] as Constructor<ContextMenuOption>;
            data.label = label;
            option = new ctor(data);
        }
        if (option) this.append(option as ContextMenuOption);
        return option;
    }

    public append(option: ContextMenuOption) {
        this.options.push(option);
        this.element.appendChild(option.div); 
    }

    public handle() {
        document.querySelectorAll('#context-menu .menu-item').forEach((item) => {
        item.addEventListener('click', (event) => {
            const target = event.currentTarget as HTMLElement;
            const action = target.dataset.action;

            switch (action) {
            case 'select':
                console.log('Select clicked');
                break;
            case 'delete':
                console.log('Delete clicked');
                break;
            case 'info':
                console.log('Inspect clicked');
                break;
            }

            // Hide the menu after an action
            document.getElementById('context-menu')!.style.display = 'none';
        });
        });
    }

    
}


export type {
    MenuDeclaration
}

export {
    BenchMenu
}