import { Interceptor } from "@loopback/core";
// import { to } from "await-to-js";
// import Validate from "./utilities/Validator/Validate";
// import _G from "./utilities";

export const validateSubmission: Interceptor = async (ctx, next) => {
  /*
  const method = ctx.methodName;
  const isPatch = ["updateById"].includes(method);
  let argsIndex = ["replaceById", "updateById"].includes(method) ? 1 : 0;
  let submission = ctx.args[argsIndex];

  if (isPatch) {
    const _id = ctx.args[0];
    const target: any = ctx.target;
    const form = await target.formRepository.findById(_id);
    submission = { ...form, ...submission };
  }

  const [error, validated] = await to(Validate.form(submission));
  if (error || !validated) {
    throw _G.error(error, "Validation error. Your Form has errors", {
      code: 422
    }).httpError;
  }

  ctx.args[argsIndex] = validated;
*/
  const result = await next();
  return result;
};
