/// <reference types="vite/client" />
declare module "*?worker" {
  const WorkerFactory: {
    new (): Worker;
  };
  export default WorkerFactory;
}

type Duple = [number, number];
type Truple = [number, number, number];
type TriData<T> = [T, T, T];
type BiData<T> = [T, T];

type NullableNumIterable = Nullable<Iterable<number>>;

type AnyAction = (...args: AnyArgs) => void;
type NoArgAction = () => void;

type Opt<T> = T | undefined
type Nullable<T> = T | undefined | null
type Tail<T extends any[]> = T extends [any, ...infer Rest] ? Rest : never;

type FunctionKeyExtends<T, F> = {
    [K in keyof T]: T[K] extends F ? K : never
}[keyof T];

type FunctionKeys<T> = {
    [K in keyof T]: T[K] extends (...args: any[]) => any ? K : never
}[keyof T];

type BooleanKeys<T> = {
  [K in keyof T]: T[K] extends boolean
    ? boolean extends T[K]
      ? K
      : never
    : never;
}[keyof T];

type AsyncFuncKeys<T> = {
    [K in keyof T]: T[K] extends (...args: any[]) => Promise<any> ? K : never
}[keyof T];

type Union<T> = {
    [K in keyof T]: T[K];
}[keyof T]; // Union

type UnionToIntersection<U> = 
    (U extends any ? (k: U) => void : never) extends (k: infer I) => void ? I : never;

interface Constructor<T> {
    new (...args: any[]): T;
}