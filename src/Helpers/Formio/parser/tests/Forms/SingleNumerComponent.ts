// This is just  a simple number component

module.exports = () => {
  return {
    _id: "5d24e91176853baf2b663a60",
    type: "resource",
    tags: [],
    owner: "573cc203e35b990100f16c0a",
    components: [
      {
        autofocus: false,
        input: true,
        tableView: true,
        inputType: "number",
        label: "Number",
        key: "number",
        placeholder: "",
        prefix: "",
        suffix: "",
        defaultValue: "",
        protected: false,
        persistent: true,
        hidden: false,
        clearOnHide: true,
        validate: {
          required: false,
          min: "",
          max: "",
          step: "any",
          integer: "",
          multiple: "",
          custom: ""
        },
        type: "number",
        labelPosition: "top",
        tags: [],
        conditional: { show: "", when: null, eq: "" },
        properties: {}
      },
      {
        autofocus: false,
        input: true,
        label: "Submit",
        tableView: false,
        key: "submit",
        size: "md",
        leftIcon: "",
        rightIcon: "",
        block: false,
        action: "submit",
        disableOnInvalid: false,
        theme: "primary",
        type: "button"
      }
    ],
    revisions: "",
    _vid: 0,
    title: "test",
    display: "form",
    access: [
      {
        roles: [
          "5c069517f137d96a8e76ce7b",
          "5c069517f137d953c476ce7c",
          "5c069517f137d9542f76ce7d"
        ],
        type: "read_all"
      }
    ],
    submissionAccess: [],
    settings: {},
    properties: {},
    name: "test",
    path: "test",
    created: "2019-07-09T19:20:49.908Z",
    modified: "2019-07-09T19:20:49.911Z"
  };
};
