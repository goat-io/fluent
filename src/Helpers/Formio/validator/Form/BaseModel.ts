"use strict";
export default (model: any) => {
  model.schema.set("minimize", false);
  return model;
};
