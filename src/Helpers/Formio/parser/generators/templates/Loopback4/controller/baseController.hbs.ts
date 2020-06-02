export const template = `import {
  Count,
  CountSchema,
  Filter,
  repository,
  Where
} from "@loopback/repository";
import {
  post,
  param,
  get,
  getFilterSchemaFor,
  getModelSchemaRef,
  getWhereSchemaFor,
  patch,
  put,
  del,
  requestBody
} from "@loopback/rest";
import { intercept } from "@loopback/core";
import {  {{_Model.name}}Model, {{_Model.name}}OriginalModel, {{_Model.name}}ReturnModel } from "../{{_Model.name}}.model";
import { {{_Model.name}}Repository } from "../{{_Model.name}}.repository";
import { validateSubmission } from "@goatlab/fluent/dist/core/Loopback/submission.validation";
import { FormRepository } from "@goatlab/fluent/dist/core/Loopback/Form/form.repository";

export class {{_Model.name}}Base {
  constructor(
    @repository({{_Model.name}}Repository)
    public model_Repository: {{_Model.name}}Repository,
    @repository(FormRepository)
    public formRepository: FormRepository
  ) {}
  /*
   * /POST/
   * Creates a new {{_Model.name}}
   */
  @intercept(validateSubmission)
  @post("/{{_Model.path}}", {
    responses: {
      "200": {
        description: "{{_Model.name}} model instance",
        content: {
          "application/json": { schema: getModelSchemaRef(dogsModel, {exclude: ["deleted", "_ngram"]}) }
        }
      }
    },
    tags: ["{{_Model.path}}"]
  })
  async create(
    @requestBody({
      content: {
        "application/json": {
          schema: getModelSchemaRef({{_Model.name}}Model, {
            title: "New{{_Model.name}}",
            exclude: ["id", "form", "roles", "owner", "_ngram", "created", "modified", "deleted"]
          })
        }
      }
    })
    {{_Model.name}}Submission: {{_Model.name}}OriginalModel
  ): Promise<{{_Model.name}}ReturnModel> {
    return this.model_Repository.create({{_Model.name}}Submission);
  }
  /*
   * /POST/
   * Creates a many new {{_Model.name}}
   */
  // @intercept(validateSubmission)
  @post("/{{_Model.path}}/createMany", {
    responses: {
      "200": {
        description: "Array of {{_Model.name}} model instance",
        content: {
          "application/json": {
            schema: {
              type: "array",
              items: getModelSchemaRef({{_Model.name}}Model, {exclude: ["deleted", "_ngram"]})
            }
          }
        }
      }
    },
    tags: ["{{_Model.path}}"]
  })
  async createMany(
    @requestBody({
      content: {
        "application/json": {
          schema: {
            type: "array",
            items: getModelSchemaRef({{_Model.name}}Model, {exclude: ["id", "form", "roles", "owner", "_ngram", "created", "modified", "deleted"]})
          }
        }
      }
    })
    {{_Model.name}}Submission: {{_Model.name}}OriginalModel[]
  ): Promise< {{_Model.name}}ReturnModel[]> {
    return this.model_Repository.createAll({{_Model.name}}Submission);
  }
  /*
   * /PUT/
   * Replace a {{_Model.name}} by id
   */
  @intercept(validateSubmission)
  @put("/{{_Model.path}}/{id}", {
    responses: {
      "204": {
        description: "{{_Model.name}} PUT success"
      }
    },
    tags: ["{{_Model.path}}"]
  })
  async replaceById(
    @param.path.string("id") id: string,
    @requestBody({
      content: {
        "application/json": {
          schema: getModelSchemaRef({{_Model.name}}Model, {
            title: "New{{_Model.name}}",
            exclude: ["id", "form", "roles", "owner", "_ngram", "created", "modified", "deleted"]
          })
        }
      }
    }) {{_Model.name}}Submission: {{_Model.name}}ReturnModel
  ): Promise<void> {
    await this.model_Repository.replaceById(id, {{_Model.name}}Submission);
  }
  /*
   * /PATCH/
   * Update a {{_Model.name}} by id
   */
  // @intercept(validateSubmission)
  @patch("/{{_Model.path}}/{id}", {
    responses: {
      "204": {
        description: "{{_Model.name}} PATCH success"
      }
    },
    tags: ["{{_Model.path}}"]
  })
  async updateById(
    @param.path.string("id") id: string,
    @requestBody({
      content: {
        "application/json": {
          schema: getModelSchemaRef({{_Model.name}}Model, {
            title: "New{{_Model.name}}",
            exclude: ["id", "form", "roles", "owner", "_ngram", "created", "modified", "deleted"]
          })
        }
      }
    }) {{_Model.name}}Submission: {{_Model.name}}ReturnModel
  ): Promise<void> {
    await this.model_Repository.replaceById(id, {{_Model.name}}Submission);
  }
  /*
   * /PATCH/
   * Update {{_Model.name}} matching WHERE
   */
  // @intercept(validateSubmission)
  @patch("/{{_Model.path}}", {
    responses: {
      "200": {
        description: "Form {{_Model.name}} success count",
        content: { "application/json": { schema: CountSchema } }
      }
    },
    tags: ["{{_Model.path}}"]
  })
  async updateAll(
    @requestBody({
      content: {
        "application/json": {
          schema: getModelSchemaRef({{_Model.name}}Model, {
            partial: true,
            exclude: ["id", "form", "roles", "owner", "_ngram", "created", "modified", "deleted"]
          })
        }
      }
    })
    {{_Model.name}}Submission: {{_Model.name}}OriginalModel,
    @param.query.object("where", getWhereSchemaFor({{_Model.name}}Model))
    where?: Where<{{_Model.name}}Model>
  ): Promise<Count> {
    return this.model_Repository.updateAll({{_Model.name}}Submission, where);
  }
  /*
   * /GET/
   * Gets the count of {{_Model.name}} WHERE
   */
  @get("/{{_Model.path}}/count", {
    responses: {
      "200": {
        description: "{{_Model.name}} model count",
        content: { "application/json": { schema: CountSchema } }
      }
    },
    tags: ["{{_Model.path}}"]
  })
  async count(
    @param.query.object("where", getWhereSchemaFor({{_Model.name}}Model))
    where?: Where<{{_Model.name}}Model>
  ): Promise<Count> {
    return this.model_Repository.count(where);
  }
  /*
   * /GET/
   * Get the {{_Model.name}} with Filter
   */
  @get("/{{_Model.path}}", {
    responses: {
      "200": {
        description: "Array of {{_Model.name}} model instances",
        content: {
          "application/json": {
            schema: {
              type: "array",
              items: getModelSchemaRef({{_Model.name}}Model, {
                includeRelations: true
              })
            }
          }
        }
      }
    },
    tags: ["{{_Model.path}}"]
  })
  async find(
    @param.query.object("filter", getFilterSchemaFor({{_Model.name}}Model))
    filter?: Filter<{{_Model.name}}Model>
  ): Promise<{{_Model.name}}Model[]> {
    return this.model_Repository.find(filter);
  }
  /*
   * /GET/
   * Gets a specific {{_Model.name}} by id
   */
  @get("/{{_Model.path}}/{id}", {
    responses: {
      "200": {
        description: "{{_Model.name}} model instance",
        content: {
          "application/json": {
            schema: getModelSchemaRef({{_Model.name}}Model, {
              includeRelations: true
            })
          }
        }
      }
    },
    tags: ["{{_Model.path}}"]
  })
  async findById(
    @param.path.string("id") id: string,
    @param.query.object("filter", getFilterSchemaFor({{_Model.name}}Model))
    filter?: Filter<{{_Model.name}}Model>
  ): Promise<{{_Model.name}}Model> {
    return this.model_Repository.findById(id, filter);
  }
  /*
   * /DELETE/
   * Deletes a {{_Model.name}} by id
   */
  @del("/{{_Model.path}}/{id}", {
    responses: {
      "204": {
        description: "{{_Model.name}} DELETE success"
      }
    },
    tags: ["{{_Model.path}}"]
  })
  async deleteById(@param.path.string("id") id: string): Promise<void> {
    await this.model_Repository.deleteById(id);
  }
}`
