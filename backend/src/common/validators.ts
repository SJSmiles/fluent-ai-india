import { Model, Document } from 'mongoose';

interface IUserDocument extends Document {
  email: string;
}

export const emailUniqueValidator = {
  async validator(this: IUserDocument, email: string): Promise<boolean> {
    const model = this.constructor as Model<IUserDocument>;
    const user = await model.exists({ email, isArchived: false }).exec();
    return user === null || this._id.equals(user._id);
  },
  message: 'email already exist'
};
