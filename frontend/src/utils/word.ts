type MaybeWordWithMongoId = {
  id?: string;
  _id?: string;
};

export function getWordId(word: MaybeWordWithMongoId | null | undefined): string {
  return word?.id ?? word?._id ?? "";
}
