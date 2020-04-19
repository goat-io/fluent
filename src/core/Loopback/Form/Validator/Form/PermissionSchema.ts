import { Document, Schema } from "mongoose";

export interface IPermission extends Document {
  type: string;
  roles: string[];
}

export default new Schema({
  type: {
    type: String,
    enum: [
      "create_all",
      "read_all",
      "update_all",
      "delete_all",
      "create_own",
      "read_own",
      "update_own",
      "delete_own",
      "self"
    ],
    required:
      "A permission type is required to associate an available permission with a given role."
  },
  roles: {
    type: [Schema.Types.ObjectId],
    ref: "role"
  }
});
