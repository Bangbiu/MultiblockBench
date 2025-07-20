class BenchObject<TSelf extends BenchObject<TSelf> = any> {
    public updateValues(values: Partial<TSelf>): this {
        for (const key of Object.keys(values) as Array<keyof typeof values>) {
            if (key in this) (this as any)[key] = values[key];
        }
        return this;
    }
}

export {
    BenchObject
}