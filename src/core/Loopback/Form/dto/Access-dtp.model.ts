import { Model, model, property } from "@loopback/repository";

@model({ settings: {} })
export class Access extends Model {
  @property.array(String)
  roles?: string[];

  @property({
    type: "string"
  })
  type?: string;

  constructor(data?: Partial<Access>) {
    super(data);
  }
}
