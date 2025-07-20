class BenchObject<TSelf extends BenchObject<TSelf> = any> {
    constructor() {
        
    }

    public updateValues(values: Partial<TSelf>): this {
        for (const key of Object.keys(values) as Array<keyof typeof values>) {
            if (key in this) (this as any)[key] = values[key];
        }
        return this;
    }
}

class SubObject<TSelf extends SubObject<TSelf>> extends BenchObject<TSelf> {
    public prop: number = 1;
    constructor(parameters: Partial<TSelf> = {}) {
        super();
        this.updateValues(parameters);
    }
}

class SubSub<TSelf extends SubSub<TSelf>> extends SubObject<TSelf> {
    public prop2: number = 0;
    private _prop3: number = -1;
    constructor(parameters: Partial<TSelf> = {}) {
        super();
        this.updateValues(parameters);
    }

    public get prop3() { return this._prop3; }
    public set prop3(value: number) {this._prop3 = value;}
}

console.log(new SubSub({prop3: 123}));


export {
    BenchObject
}