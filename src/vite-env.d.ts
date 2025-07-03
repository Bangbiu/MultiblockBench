/// <reference types="vite/client" />
declare module "*?worker" {
  const WorkerFactory: {
    new (): Worker;
  };
  export default WorkerFactory;
}

type Opt<T> = T | undefined

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