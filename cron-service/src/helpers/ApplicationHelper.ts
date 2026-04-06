import { connection } from "mongoose";

export const getCollection = (collectionName: string) => {
  return connection.db.collection(collectionName);
};
