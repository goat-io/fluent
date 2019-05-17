/* global describe, it, before */
import "babel-polyfill";
import chai from "chai";
import GoatExport from "./goat-export";

chai.expect();
const expect = chai.expect;
let component = {
  type: "form",
  title: "Example",
  display: "form",
  components: [
    {
      type: "textfield",
      key: "name",
      label: "Name",
      input: true
    },
    {
      type: "number",
      key: "age",
      label: "Age",
      input: true
    }
  ]
};

let submission = {
  _id: "<submission id>",
  owner: "<owner id>",
  modified: "1970-01-01T00:00:00.000Z",
  data: {
    name: "John Doe",
    age: 25
  }
};

let options = {
  ignoreLayout: true
};

let config = {
  download: false,
  filename: "example.pdf"
};

describe("Given a FLUENT Export Instance", () => {
  before(async () => {});

  it("should add 2+2", () => {
    console.log(component);
    expect(2).to.be.equal(2);
  });
});
