import mongoose from "mongoose";
import { VocabularyWord } from "./models/VocabularyWord";
import type { PartOfSpeech } from "./models/VocabularyWord";
import type { CefrLevel } from "./models/User";
import { seedLearningFoundation } from "./seeds/learningSeed";

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/asalingo";

const words: Array<{
  word: string;
  translation: string;
  definition: string;
  partOfSpeech: PartOfSpeech;
  cefrLevel: CefrLevel;
  topic: string;
  exampleSentence: string;
  easierExplanation: string;
  synonyms: string[];
  collocations: string[];
  pronunciation: string;
  language: string;
}> = [
  // A1 words
  {
    word: "hello",
    translation: "привет / hola / bonjour",
    definition: "A greeting used when meeting someone",
    partOfSpeech: "INTERJECTION",
    cefrLevel: "A1",
    topic: "daily life",
    exampleSentence: "Hello! How are you today?",
    easierExplanation: "What you say when you first see someone",
    synonyms: ["hi", "hey", "greetings"],
    collocations: ["say hello", "hello there"],
    pronunciation: "heh-LOH",
    language: "English",
  },
  {
    word: "water",
    translation: "вода / agua / eau",
    definition: "A clear liquid that is necessary for life",
    partOfSpeech: "NOUN",
    cefrLevel: "A1",
    topic: "daily life",
    exampleSentence: "Can I have a glass of water, please?",
    easierExplanation: "The clear liquid you drink",
    synonyms: ["H2O"],
    collocations: ["drink water", "glass of water", "hot water"],
    pronunciation: "WAW-ter",
    language: "English",
  },
  {
    word: "house",
    translation: "дом / casa / maison",
    definition: "A building where people live",
    partOfSpeech: "NOUN",
    cefrLevel: "A1",
    topic: "daily life",
    exampleSentence: "I live in a small house near the park.",
    easierExplanation: "A place where a family lives",
    synonyms: ["home", "residence"],
    collocations: ["go home", "house key", "family house"],
    pronunciation: "HOWSS",
    language: "English",
  },
  {
    word: "eat",
    translation: "есть / comer / manger",
    definition: "To put food in your mouth and swallow it",
    partOfSpeech: "VERB",
    cefrLevel: "A1",
    topic: "daily life",
    exampleSentence: "I eat breakfast at seven o'clock every morning.",
    easierExplanation: "What you do with food",
    synonyms: ["have", "consume"],
    collocations: ["eat breakfast", "eat lunch", "eat dinner", "something to eat"],
    pronunciation: "EET",
    language: "English",
  },
  {
    word: "big",
    translation: "большой / grande / grand",
    definition: "Large in size",
    partOfSpeech: "ADJECTIVE",
    cefrLevel: "A1",
    topic: "daily life",
    exampleSentence: "The elephant is a very big animal.",
    easierExplanation: "Something that is large or not small",
    synonyms: ["large", "huge", "great"],
    collocations: ["big house", "big city", "big problem"],
    pronunciation: "BIG",
    language: "English",
  },
  // A2 words
  {
    word: "adventure",
    translation: "приключение / aventura / aventure",
    definition: "An exciting or unusual experience",
    partOfSpeech: "NOUN",
    cefrLevel: "A2",
    topic: "travel",
    exampleSentence: "Traveling to a new country is always a great adventure.",
    easierExplanation: "An exciting experience, often something new",
    synonyms: ["journey", "expedition", "experience"],
    collocations: ["great adventure", "sense of adventure", "go on an adventure"],
    pronunciation: "ad-VEN-cher",
    language: "English",
  },
  {
    word: "describe",
    translation: "описывать / describir / décrire",
    definition: "To say or write what someone or something is like",
    partOfSpeech: "VERB",
    cefrLevel: "A2",
    topic: "daily life",
    exampleSentence: "Can you describe what the person looked like?",
    easierExplanation: "To tell someone what something looks like or is like",
    synonyms: ["explain", "depict", "portray"],
    collocations: ["describe yourself", "hard to describe", "briefly describe"],
    pronunciation: "dih-SKRYB",
    language: "English",
  },
  {
    word: "opinion",
    translation: "мнение / opinión / opinion",
    definition: "What you think about something",
    partOfSpeech: "NOUN",
    cefrLevel: "A2",
    topic: "daily life",
    exampleSentence: "In my opinion, this movie is very interesting.",
    easierExplanation: "What you think or believe about something",
    synonyms: ["view", "belief", "thought"],
    collocations: ["in my opinion", "give your opinion", "different opinion"],
    pronunciation: "oh-PIN-yun",
    language: "English",
  },
  // B1 words
  {
    word: "negotiate",
    translation: "переговариваться / negociar / négocier",
    definition: "To try to reach an agreement through discussion",
    partOfSpeech: "VERB",
    cefrLevel: "B1",
    topic: "work",
    exampleSentence: "We need to negotiate the terms of the contract before signing.",
    easierExplanation: "To talk with someone to reach an agreement",
    synonyms: ["discuss", "bargain", "mediate"],
    collocations: ["negotiate a deal", "negotiate salary", "negotiate terms"],
    pronunciation: "neh-GOH-shee-ayt",
    language: "English",
  },
  {
    word: "efficient",
    translation: "эффективный / eficiente / efficace",
    definition: "Working well and producing good results without wasting time or effort",
    partOfSpeech: "ADJECTIVE",
    cefrLevel: "B1",
    topic: "work",
    exampleSentence: "This new software makes our workflow much more efficient.",
    easierExplanation: "Something that works well and does not waste time",
    synonyms: ["effective", "productive", "capable"],
    collocations: ["efficient system", "highly efficient", "cost-efficient"],
    pronunciation: "ih-FISH-ent",
    language: "English",
  },
  {
    word: "consequence",
    translation: "последствие / consecuencia / conséquence",
    definition: "A result or effect of an action or condition",
    partOfSpeech: "NOUN",
    cefrLevel: "B1",
    topic: "daily life",
    exampleSentence: "You must think about the consequences of your decisions.",
    easierExplanation: "What happens because of something you do",
    synonyms: ["result", "outcome", "effect"],
    collocations: ["face consequences", "serious consequence", "as a consequence"],
    pronunciation: "KON-sih-kwens",
    language: "English",
  },
  // B2 words
  {
    word: "ambiguous",
    translation: "неоднозначный / ambiguo / ambigu",
    definition: "Having more than one possible meaning; not clear",
    partOfSpeech: "ADJECTIVE",
    cefrLevel: "B2",
    topic: "university",
    exampleSentence: "The instructions were ambiguous, so nobody knew what to do.",
    easierExplanation: "Something that can be understood in more than one way",
    synonyms: ["unclear", "vague", "equivocal"],
    collocations: ["ambiguous statement", "deliberately ambiguous", "morally ambiguous"],
    pronunciation: "am-BIG-yoo-us",
    language: "English",
  },
  {
    word: "phenomenon",
    translation: "явление / fenómeno / phénomène",
    definition: "A fact or situation that is observed to exist or happen",
    partOfSpeech: "NOUN",
    cefrLevel: "B2",
    topic: "university",
    exampleSentence: "Global warming is a complex environmental phenomenon.",
    easierExplanation: "Something that happens or exists in the world",
    synonyms: ["occurrence", "event", "happening"],
    collocations: ["natural phenomenon", "social phenomenon", "rare phenomenon"],
    pronunciation: "feh-NOM-ih-non",
    language: "English",
  },
  // C1 words
  {
    word: "pragmatic",
    translation: "прагматичный / pragmático / pragmatique",
    definition: "Dealing with things sensibly and realistically rather than theoretically",
    partOfSpeech: "ADJECTIVE",
    cefrLevel: "C1",
    topic: "business",
    exampleSentence: "We need a pragmatic approach to solve this complex problem.",
    easierExplanation: "Focused on practical solutions rather than ideals",
    synonyms: ["practical", "realistic", "sensible"],
    collocations: ["pragmatic approach", "pragmatic solution", "remain pragmatic"],
    pronunciation: "prag-MAT-ik",
    language: "English",
  },
  {
    word: "nuance",
    translation: "нюанс / matiz / nuance",
    definition: "A subtle difference in meaning, expression, or sound",
    partOfSpeech: "NOUN",
    cefrLevel: "C1",
    topic: "university",
    exampleSentence: "Understanding cultural nuances is essential for effective communication.",
    easierExplanation: "A small but important difference",
    synonyms: ["subtlety", "shade", "distinction"],
    collocations: ["subtle nuance", "cultural nuance", "grasp the nuance"],
    pronunciation: "NOO-ahns",
    language: "English",
  },
  // ── Portuguese words (language = "Portuguese") ───────────────────────────────
  {
    word: "olá",
    translation: "hello / hi",
    definition: "A greeting used when meeting someone",
    partOfSpeech: "INTERJECTION",
    cefrLevel: "A1",
    topic: "daily life",
    exampleSentence: "Olá! Como vai você hoje?",
    easierExplanation: "What you say when you first see someone in Portuguese",
    synonyms: ["oi", "bom dia"],
    collocations: ["dizer olá", "olá a todos"],
    pronunciation: "oh-LAH",
    language: "Portuguese",
  },
  {
    word: "água",
    translation: "water",
    definition: "A clear liquid that is necessary for life",
    partOfSpeech: "NOUN",
    cefrLevel: "A1",
    topic: "daily life",
    exampleSentence: "Posso ter um copo de água, por favor?",
    easierExplanation: "The clear liquid you drink",
    synonyms: ["líquido"],
    collocations: ["beber água", "copo de água", "água quente"],
    pronunciation: "AH-gwah",
    language: "Portuguese",
  },
  {
    word: "casa",
    translation: "house / home",
    definition: "A building where people live",
    partOfSpeech: "NOUN",
    cefrLevel: "A1",
    topic: "daily life",
    exampleSentence: "Eu moro em uma casa pequena perto do parque.",
    easierExplanation: "A place where a family lives",
    synonyms: ["lar", "residência"],
    collocations: ["ir para casa", "chave de casa", "casa de família"],
    pronunciation: "KAH-zah",
    language: "Portuguese",
  },
  {
    word: "comer",
    translation: "to eat",
    definition: "To put food in your mouth and swallow it",
    partOfSpeech: "VERB",
    cefrLevel: "A1",
    topic: "daily life",
    exampleSentence: "Eu como café da manhã às sete horas toda manhã.",
    easierExplanation: "What you do with food",
    synonyms: ["alimentar-se"],
    collocations: ["comer o café da manhã", "comer o almoço", "comer o jantar"],
    pronunciation: "koh-MEHR",
    language: "Portuguese",
  },
  {
    word: "grande",
    translation: "big / large",
    definition: "Large in size",
    partOfSpeech: "ADJECTIVE",
    cefrLevel: "A1",
    topic: "daily life",
    exampleSentence: "O elefante é um animal muito grande.",
    easierExplanation: "Something that is large or not small",
    synonyms: ["enorme", "amplo"],
    collocations: ["casa grande", "cidade grande", "problema grande"],
    pronunciation: "GRAHN-djeh",
    language: "Portuguese",
  },
  {
    word: "viagem",
    translation: "trip / journey",
    definition: "An act of travelling from one place to another",
    partOfSpeech: "NOUN",
    cefrLevel: "A2",
    topic: "travel",
    exampleSentence: "A viagem ao Brasil foi incrível.",
    easierExplanation: "When you travel somewhere, especially somewhere new",
    synonyms: ["jornada", "excursão"],
    collocations: ["fazer uma viagem", "boa viagem", "viagem de negócios"],
    pronunciation: "vee-AH-zhehm",
    language: "Portuguese",
  },
  {
    word: "trabalho",
    translation: "work / job",
    definition: "Activity involving mental or physical effort done to achieve a result",
    partOfSpeech: "NOUN",
    cefrLevel: "A2",
    topic: "work",
    exampleSentence: "O meu trabalho começa às nove horas da manhã.",
    easierExplanation: "What you do to earn money or complete a task",
    synonyms: ["emprego", "serviço"],
    collocations: ["ir ao trabalho", "trabalho em equipe", "trabalho duro"],
    pronunciation: "trah-BAH-lyoo",
    language: "Portuguese",
  },
  {
    word: "negociar",
    translation: "to negotiate",
    definition: "To try to reach an agreement through discussion",
    partOfSpeech: "VERB",
    cefrLevel: "B1",
    topic: "work",
    exampleSentence: "Precisamos negociar os termos do contrato antes de assinar.",
    easierExplanation: "To talk with someone to reach an agreement",
    synonyms: ["discutir", "mediar"],
    collocations: ["negociar um acordo", "negociar salário", "negociar condições"],
    pronunciation: "neh-goh-see-AHR",
    language: "Portuguese",
  },
  // C2 words
  {
    word: "ephemeral",
    translation: "эфемерный / efímero / éphémère",
    definition: "Lasting for a very short time",
    partOfSpeech: "ADJECTIVE",
    cefrLevel: "C2",
    topic: "university",
    exampleSentence: "Fame can be ephemeral — here today and gone tomorrow.",
    easierExplanation: "Something that exists only for a very short time",
    synonyms: ["transient", "fleeting", "momentary"],
    collocations: ["ephemeral nature", "ephemeral pleasure", "ephemeral beauty"],
    pronunciation: "ih-FEM-er-ul",
    language: "English",
  },
  {
    word: "perspicacious",
    translation: "проницательный / perspicaz / perspicace",
    definition: "Having a ready insight into things; shrewd",
    partOfSpeech: "ADJECTIVE",
    cefrLevel: "C2",
    topic: "university",
    exampleSentence: "Her perspicacious analysis revealed problems no one else had noticed.",
    easierExplanation: "Very good at understanding and noticing things quickly",
    synonyms: ["shrewd", "insightful", "astute"],
    collocations: ["perspicacious observer", "perspicacious remark"],
    pronunciation: "per-spih-KAY-shus",
    language: "English",
  },
];

async function main() {
  await mongoose.connect(MONGODB_URI);
  console.log("Connected to MongoDB. Seeding vocabulary words...");

  let seeded = 0;
  let skipped = 0;

  for (const word of words) {
    try {
      const result = await VocabularyWord.findOneAndUpdate(
        { word: word.word, language: word.language, cefrLevel: word.cefrLevel },
        { $setOnInsert: word },
        { upsert: true, new: false }
      );
      if (result === null) {
        seeded++;
      } else {
        skipped++;
      }
    } catch (e) {
      console.error(`Error seeding "${word.word}":`, e);
    }
  }

  const learningSeed = await seedLearningFoundation();

  console.log(`Done. Seeded: ${seeded} new, skipped: ${skipped} existing.`);
  console.log(
    `Learning foundation upserted: curriculum=${learningSeed.curriculumCount}, media=${learningSeed.mediaCount}, removedMedia=${learningSeed.removedMediaCount}, words=${learningSeed.wordCount}.`
  );
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
