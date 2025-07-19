const DO_NOTHING = () => {};

class ContextMenuOption {
    public readonly div: HTMLDivElement;
    protected readonly caption: HTMLSpanElement;
    private _action: AnyAction = DO_NOTHING;
    constructor(label: string, action?: AnyAction) {
        const div = document.createElement("div");
        this.div = div;
        
        // Create and append caption element
        const caption = document.createElement("span");
        this.caption = caption;
        this.div.appendChild(caption);
        this.label = label;
        
        if (action) this.action = action;

        div.style.padding = '6px 12px';
        div.style.cursor = 'pointer';
        div.style.userSelect = 'none';

        div.addEventListener('mouseenter', () => {
            div.style.background = '#444';
        });
        div.addEventListener('mouseleave', () => {
            div.style.background = 'transparent';
        });
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

class CheckBoxOption extends ContextMenuOption {
    private readonly box: HTMLSpanElement;
    private readonly innerBox: HTMLSpanElement;
    private _checked: boolean = false;

    constructor(label: string, initialState: boolean = false) {
        super(label);

        // Setup layout
        this.div.style.display = "flex";
        this.div.style.alignItems = "center";
        this.div.style.justifyContent = "space-between";
        this.caption.style.marginRight = "8px";

        // Outer box
        this.box = document.createElement("span");
        this.div.appendChild(this.box);

        const boxStyle = this.box.style;
        boxStyle.display = "inline-block";
        boxStyle.marginLeft = "auto";
        boxStyle.width = "20px";
        boxStyle.height = "20px";
        boxStyle.border = "1px solid #ccc";
        boxStyle.boxSizing = "border-box";
        boxStyle.position = "relative"; // to position inner box absolutely
        boxStyle.userSelect = "none";

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

        this.checked = initialState;

        this.div.addEventListener("click", () => {
            this.checked = !this.checked;
        });
    }

    public get checked(): boolean {
        return this._checked;
    }

    public set checked(value: boolean) {
        this._checked = value;
        this.innerBox.style.background = value ? "#ccc" : "transparent";
    }
}


class SubMenuOption extends ContextMenuOption {
    public readonly subMenu: ContextMenu;
    constructor(label: string, subMenu?: ContextMenu) {
        super(label);
        this.action = this.showSubMenu.bind(this);
        this.subMenu = subMenu ?? new ContextMenu();
    }

    public showSubMenu() {

    }
    
    public hideSubMenu() {

    }
}

type OptionConstructor = new (label: string, ...args: any[]) => ContextMenuOption;

const MenuOptType = {
  option: ContextMenuOption,
  subMenu: SubMenuOption,
  checkBox: CheckBoxOption,
} as const;

const MenuOptCtor: Record<string, OptionConstructor> = MenuOptType;

type MenuOptTypeMap = typeof MenuOptType;
type MenuOptKind = keyof MenuOptTypeMap;
type Tail<T extends any[]> = T extends [any, ...infer Rest] ? Rest : never;
type MenuOptCtor<T extends MenuOptKind> = Tail<ConstructorParameters<MenuOptTypeMap[T]>>;

type MenuOptDeclaration<T extends MenuOptKind> = {
    type: T;
    action?: AnyAction;
    args?: MenuOptCtor<T>;
} | AnyAction | MenuOptKind;

type AnyMenuOpt = {
    [K in MenuOptKind]: MenuOptDeclaration<K>;
}[MenuOptKind];

type MenuDeclaration = Record<string, AnyMenuOpt>;

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

    public add<T extends MenuOptKind>(label: string, data: MenuOptDeclaration<T>): Opt<ContextMenuOption> {
        let option: Opt<ContextMenuOption> = undefined;
        if (typeof data == "string") 
            option = new MenuOptCtor[data](label);
        else if (typeof data === "function")
            option = new ContextMenuOption(label, data);
        else if (typeof data === "object") {
            const ctor = MenuOptCtor[data.type];
            option = data.args ? new ctor(label, ...data.args) : new ctor(label);
            if (data.action) 
                option.action = data.action;
        }
        if (option) this.append(option);
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