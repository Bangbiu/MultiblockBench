abstract class BenchIterable<IT extends Iterable<number> = Iterable<number>> implements Iterable<number> {
    private _container: IT;
    constructor(container: IT) {
        this._container = container;
    }

    public get container() { return this._container };  
    public set(iterable: Iterable<number>) { 
        this.clear(); this.append(iterable); 
    }

    /**
     * Get Element at index from Container Set
     * Inefficient: To be override
     * @param index 
     * @returns element at index
     */
    public at(index: number): number {
        if (index < 0 || index >= this.size) {
            throw new RangeError("Index out of bounds");
        }
        let i = 0;
        for (const value of this) {
            if (i === index) return value;
            i++;
        }
        throw new Error("Unexpected state");
    }

    public add(...items: Array<number>): void {
        this.append(items);
    }

    public forEach(callbackfn: (value: number, index: number) => void): void {
        let index = 0;
        for (const value of this) callbackfn.call(this, value, index++);
    }

    public map<U>(callbackfn: (value: number, index: number) => U): Array<U> {
        const result = new Array<U>();
        this.forEach((value, index) => {
            result.push(callbackfn.call(this, value, index));
        });
        return result;
    }

    [Symbol.iterator](): Iterator<number, any, any> {
        return this._container[Symbol.iterator]();
    }

    public abstract get size(): number;
    
    public abstract append(iterable: Iterable<number>): void;
    public abstract clear(): void;
}

abstract class IndexIterable<CT extends Constructor, IT extends Iterable<number> = Iterable<number>> extends BenchIterable<IT> {
    protected readonly creator: CT;
    constructor(container: IT, creator: CT) {
        super(container);
        this.creator = creator;
    }

    public get(index: number): InstanceType<CT> {
        return this.create(super.at(index));
    }

    public each(callbackfn: (value: InstanceType<CT>, index: number) => void): void {
        let index = 0;
        for (const value of this) callbackfn.call(this, this.create(value), index++);
    }

    public fetch<U = InstanceType<CT>>(callbackfn: (value: InstanceType<CT>, index: number) => U = value => value as U): Array<U> {
        const result = new Array<U>();
        this.each((value, index) => {
            result.push(callbackfn.call(this, value, index));
        });
        return result;
    }

    abstract create(referIndex: number): InstanceType<CT>;
}



class BenchObject<TSelf extends BenchObject<TSelf> = any> {
    public updateValues(values: Partial<TSelf>): this {
        for (const key of Object.keys(values) as Array<keyof typeof values>) {
            if (key in this) (this as any)[key] = values[key];
        }
        return this;
    }
}

export {
    BenchIterable,
    IndexIterable,
    BenchObject
}