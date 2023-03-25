import { inspectAny, inspectAnyStringifyFn } from "./Got/inspectAny.js"

class InspectClass {
    anyStringifyFn = inspectAnyStringifyFn

    any = inspectAny
}

export const Inspect = new InspectClass()