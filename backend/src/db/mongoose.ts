import mongoose from "mongoose";
import { env } from "../config/env";
import { logger } from "../utils/logger";
import { VocabularyWord } from "../models";

export async function connectDB(): Promise<void> {
  try {
    await mongoose.connect(env.MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
    });
    logger.info("MongoDB connected successfully");

    // Repair old text index behavior where Mongo treated our `language`
    // field as language_override and rejected codes like `ja`.
    try {
      const indexes = await VocabularyWord.collection.indexes();
      const legacyTextIndex = indexes.find(
        (index) =>
          index.name === "word_text_definition_text_translation_text" &&
          (!index.language_override || index.language_override === "language")
      );

      if (legacyTextIndex?.name) {
        await VocabularyWord.collection.dropIndex(legacyTextIndex.name);
      }

      await VocabularyWord.syncIndexes();
      await VocabularyWord.collection.createIndex(
        { word: "text", definition: "text", translation: "text" },
        {
          name: "word_text_definition_text_translation_text",
          language_override: "_unused_language_override",
        }
      );
    } catch (indexErr) {
      logger.warn(`VocabularyWord index sync warning: ${indexErr}`);
    }
  } catch (err) {
    logger.error(`MongoDB connection failed: ${err}`);
    process.exit(1);
  }

  mongoose.connection.on("error", (err) => {
    logger.error(`MongoDB error: ${err}`);
  });

  mongoose.connection.on("disconnected", () => {
    logger.warn("MongoDB disconnected");
  });
}
