class ResizableInt32Array {
    private _buffer: Int32Array;
    private _length: number = 0;

    constructor(initialCapacity = 64) {
        this._buffer = new Int32Array(initialCapacity);
    }

    public push(value: number): void {
        if (this._length >= this._buffer.length) {
            this._resize(this._buffer.length * 2);
        }
        this._buffer[this._length++] = value;
    }

    public get(index: number): number {
        if (index >= this._length) throw new RangeError("Index out of bounds");
        return this._buffer[index];
    }

    public set(index: number, value: number): void {
        if (index >= this._length) throw new RangeError("Index out of bounds");
        this._buffer[index] = value;
    }

    public get length(): number {
        return this._length;
    }

    public toTypedArray(): Int32Array {
        return this._buffer.subarray(0, this._length);
    }

    private _resize(newCapacity: number): void {
        const newBuffer = new Int32Array(newCapacity);
        newBuffer.set(this._buffer);
        this._buffer = newBuffer;
    }
}

export {
    ResizableInt32Array
}