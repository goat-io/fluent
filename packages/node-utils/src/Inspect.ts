import { inspectAny, inspectAnyStringifyFn } from "./Got/inspectAny"

class InspectClass {
    anyStringifyFn = inspectAnyStringifyFn

    any = inspectAny
}

export const Inspect = new InspectClass()